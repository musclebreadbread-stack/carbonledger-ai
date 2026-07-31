/**
 * Tests for reminder planning.
 *
 * Two properties carry most of the weight:
 *
 *  1. **A `submitted` request is never overdue.** It is waiting on our own
 *     verification queue. `isOverdue` in `src/lib/suppliers/types.ts` says so, and
 *     if this job disagreed the dashboard and the reminders would report different
 *     numbers of late suppliers.
 *  2. **Tenants stay separated.** `service_role` bypasses RLS, so the grouping is
 *     the only thing keeping one company's suppliers out of another's digest.
 */

import { assert, assertEquals } from "@std/assert";
import {
  DEFAULT_DUE_SOON_DAYS,
  isAwaitingSupplier,
  planIsEmpty,
  planReminders,
  type RequestRow,
} from "../_shared/reminders.ts";

const COMPANY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SUPPLIER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const AS_OF = new Date("2024-06-15T00:00:00.000Z");

function row(overrides: Partial<RequestRow> & { id: string }): RequestRow {
  return {
    company_id: COMPANY_A,
    supplier_id: SUPPLIER,
    status: "sent",
    due_date: "2024-07-01T00:00:00.000Z",
    period: "2024",
    ...overrides,
  };
}

Deno.test("pending requests are queued for issue", () => {
  const plans = planReminders(
    [row({ id: "r1", status: "pending" }), row({ id: "r2", status: "sent" })],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );

  assertEquals(plans.length, 1);
  assertEquals(plans[0]?.toIssue, ["r1"]);
});

Deno.test("an overdue request is reported with the days it is late", () => {
  const plans = planReminders(
    [row({ id: "r1", due_date: "2024-06-01T00:00:00.000Z" })],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );

  assertEquals(plans[0]?.overdue.length, 1);
  assertEquals(plans[0]?.overdue[0]?.requestId, "r1");
  assertEquals(plans[0]?.overdue[0]?.daysLate, 14);
  assertEquals(plans[0]?.dueSoon.length, 0);
});

Deno.test("a request that just slipped past its deadline is one day late, not zero", () => {
  const plans = planReminders(
    [row({ id: "r1", due_date: "2024-06-14T23:00:00.000Z" })],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );
  // Reporting "0 days late" in a chaser email would read as though it were not
  // late at all.
  assertEquals(plans[0]?.overdue[0]?.daysLate, 1);
});

Deno.test("a submitted request past its due date is nobody's lateness", () => {
  // The delay is in our verification queue. Blaming the supplier for it would
  // misattribute our own backlog in every engagement report.
  const plans = planReminders(
    [row({ id: "r1", status: "submitted", due_date: "2024-01-01T00:00:00.000Z" })],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );
  assertEquals(plans.length, 0);
});

Deno.test("terminal requests are ignored entirely", () => {
  const plans = planReminders(
    [
      row({ id: "r1", status: "verified", due_date: "2024-01-01T00:00:00.000Z" }),
      row({ id: "r2", status: "rejected", due_date: "2024-01-01T00:00:00.000Z" }),
    ],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );
  assertEquals(plans.length, 0);
});

Deno.test("due-soon is bounded by the window and excludes what is already overdue", () => {
  const plans = planReminders(
    [
      row({ id: "inside", due_date: "2024-06-20T00:00:00.000Z" }),
      row({ id: "boundary", due_date: "2024-06-22T00:00:00.000Z" }),
      row({ id: "outside", due_date: "2024-06-23T00:00:00.000Z" }),
      row({ id: "late", due_date: "2024-06-10T00:00:00.000Z" }),
    ],
    { asOf: AS_OF, dueSoonDays: 7 },
  );

  const dueSoon = plans[0]?.dueSoon.map((entry) => entry.requestId) ?? [];
  assertEquals(dueSoon, ["inside", "boundary"]);
  assertEquals(plans[0]?.overdue.map((entry) => entry.requestId), ["late"]);
});

Deno.test("a request due today reports zero days remaining, not one", () => {
  const plans = planReminders(
    [row({ id: "r1", due_date: "2024-06-15T12:00:00.000Z" })],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );
  assertEquals(plans[0]?.dueSoon[0]?.daysRemaining, 0);
});

Deno.test("a request with no due date is still issued but never chased", () => {
  const plans = planReminders(
    [row({ id: "r1", status: "pending", due_date: null })],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );

  assertEquals(plans[0]?.toIssue, ["r1"]);
  // Emailing a supplier about a deadline nobody set is worse than staying quiet.
  assertEquals(plans[0]?.overdue.length, 0);
  assertEquals(plans[0]?.dueSoon.length, 0);
});

Deno.test("an unparseable due date is left alone rather than guessed at", () => {
  const plans = planReminders(
    [row({ id: "r1", status: "sent", due_date: "not a date" })],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );
  assertEquals(plans.length, 0);
});

Deno.test("work is grouped per company and never merged", () => {
  const plans = planReminders(
    [
      row({ id: "b-late", company_id: COMPANY_B, due_date: "2024-01-01T00:00:00.000Z" }),
      row({ id: "a-pending", company_id: COMPANY_A, status: "pending" }),
      row({ id: "a-late", company_id: COMPANY_A, due_date: "2024-02-01T00:00:00.000Z" }),
    ],
    { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS },
  );

  assertEquals(plans.length, 2);
  // Sorted by company id, so a run over the same rows produces the same plan and a
  // dry run is comparable with the real thing.
  assertEquals(plans[0]?.companyId, COMPANY_A);
  assertEquals(plans[1]?.companyId, COMPANY_B);

  // The important assertion: nothing belonging to B appears anywhere in A's plan.
  const companyAIds = [
    ...(plans[0]?.toIssue ?? []),
    ...(plans[0]?.overdue.map((entry) => entry.requestId) ?? []),
    ...(plans[0]?.dueSoon.map((entry) => entry.requestId) ?? []),
  ];
  assertEquals(companyAIds.sort(), ["a-late", "a-pending"]);
  assertEquals(plans[1]?.overdue.map((entry) => entry.requestId), ["b-late"]);
});

Deno.test("a company with nothing to do produces no plan at all", () => {
  const plans = planReminders([], { asOf: AS_OF, dueSoonDays: DEFAULT_DUE_SOON_DAYS });
  assertEquals(plans, []);

  assert(planIsEmpty({ companyId: COMPANY_A, toIssue: [], overdue: [], dueSoon: [] }));
});

Deno.test("isAwaitingSupplier matches the lifecycle in src/lib/suppliers/types.ts", () => {
  for (const status of ["pending", "sent", "in_progress"]) {
    assert(isAwaitingSupplier(status), status);
  }
  for (const status of ["submitted", "verified", "rejected"]) {
    assertEquals(isAwaitingSupplier(status), false, status);
  }
});
