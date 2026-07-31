/**
 * Deciding which supplier data requests need chasing. Pure — no database, no clock.
 *
 * The rules are lifted from `src/lib/suppliers/types.ts` rather than reinvented,
 * because a reminder job that disagreed with the dashboard about what "overdue"
 * means would be worse than no reminder job: the UI would show nine late
 * suppliers and the emails would go to eleven.
 *
 * The rule worth restating, because it is the one that is easy to get wrong:
 *
 * > Only requests still awaiting the supplier can be overdue. A `submitted`
 * > request sitting past its due date is waiting on *our* verification queue, and
 * > counting that as supplier lateness misattributes our delay to them.
 *
 * `isOverdue` in `types.ts` says the same thing, and the two must not drift.
 */

/** The subset of `supplier_data_requests` this planner reads. */
export interface RequestRow {
  id: string;
  company_id: string;
  supplier_id: string;
  status: string;
  /** `due_date` as returned by PostgREST: an ISO instant, or null. */
  due_date: string | null;
  period: string;
}

/** Statuses that mean the ball is in the supplier's court. */
const AWAITING_SUPPLIER = ["pending", "sent", "in_progress"] as const;

export function isAwaitingSupplier(status: string): boolean {
  return (AWAITING_SUPPLIER as readonly string[]).includes(status);
}

export interface OverdueEntry {
  requestId: string;
  supplierId: string;
  period: string;
  dueDate: string;
  /** Whole days past due, at least 1. */
  daysLate: number;
}

export interface DueSoonEntry {
  requestId: string;
  supplierId: string;
  period: string;
  dueDate: string;
  /** Whole days remaining, 0 when due today. */
  daysRemaining: number;
}

/** What one company's requests need, grouped so tenants cannot be merged. */
export interface CompanyPlan {
  companyId: string;
  /** Request ids to move `pending` -> `sent`. */
  toIssue: string[];
  overdue: OverdueEntry[];
  dueSoon: DueSoonEntry[];
}

export interface PlanOptions {
  /** The instant the run is reasoning about. */
  asOf: Date;
  /** How far ahead counts as "due soon". */
  dueSoonDays: number;
}

export const DEFAULT_DUE_SOON_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Groups requests by company and works out what each one needs.
 *
 * Returned per company rather than as three flat lists, and that is a tenancy
 * decision, not a formatting one: `service_role` bypasses RLS, so a single flat
 * list of "everything overdue" is one careless `join` away from putting one
 * company's suppliers in another company's digest. Keeping the boundary in the
 * data structure means the notification step cannot cross it by accident.
 *
 * Companies are ordered by id and requests keep their input order, so a run over
 * the same rows produces the same plan — which is what makes the dry-run output
 * comparable to what the real run will do.
 */
export function planReminders(
  rows: readonly RequestRow[],
  options: PlanOptions,
): CompanyPlan[] {
  const asOfMs = options.asOf.getTime();
  const dueSoonCutoff = asOfMs + options.dueSoonDays * MS_PER_DAY;
  const byCompany = new Map<string, CompanyPlan>();

  for (const row of rows) {
    // Anything not awaiting the supplier is none of this job's business: a
    // `submitted` row is in our queue and a terminal one is closed.
    if (!isAwaitingSupplier(row.status)) continue;

    let plan = byCompany.get(row.company_id);
    if (plan === undefined) {
      plan = { companyId: row.company_id, toIssue: [], overdue: [], dueSoon: [] };
      byCompany.set(row.company_id, plan);
    }

    if (row.status === "pending") plan.toIssue.push(row.id);

    if (row.due_date === null) continue;
    const due = Date.parse(row.due_date);
    // An unparseable date is left alone rather than guessed at. Treating it as
    // due-now would email a supplier about a deadline nobody set.
    if (!Number.isFinite(due)) continue;

    if (due < asOfMs) {
      plan.overdue.push({
        requestId: row.id,
        supplierId: row.supplier_id,
        period: row.period,
        dueDate: row.due_date,
        daysLate: Math.max(1, Math.ceil((asOfMs - due) / MS_PER_DAY)),
      });
    } else if (due <= dueSoonCutoff) {
      plan.dueSoon.push({
        requestId: row.id,
        supplierId: row.supplier_id,
        period: row.period,
        dueDate: row.due_date,
        daysRemaining: Math.max(0, Math.floor((due - asOfMs) / MS_PER_DAY)),
      });
    }
  }

  // Companies with nothing to do are dropped rather than returned as empty plans.
  // A company can reach this point with no work — every one of its open requests
  // is already `sent` and comfortably inside its deadline — and returning that as
  // a plan would mean the caller dispatching an empty digest to a company whose
  // suppliers are all up to date.
  return [...byCompany.values()]
    .filter((plan) => !planIsEmpty(plan))
    .sort((a, b) => a.companyId.localeCompare(b.companyId));
}

/** Whether a plan has anything worth telling anybody about. */
export function planIsEmpty(plan: CompanyPlan): boolean {
  return plan.toIssue.length === 0 && plan.overdue.length === 0 && plan.dueSoon.length === 0;
}
