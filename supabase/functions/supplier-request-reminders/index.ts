/**
 * `POST /functions/v1/supplier-request-reminders` — scheduled chasing of supplier
 * data requests.
 *
 * # Why this exists
 *
 * `data_request_status` starts at `pending` and the documented lifecycle is
 * `pending -> sent -> ...`, but nothing in the codebase ever performs that first
 * transition. A request created by staff sits at `pending` forever, the supplier
 * is never told, and `responseRatePercent` counts them as unanswered. Nothing
 * chases an overdue request either.
 *
 * # Why an Edge Function
 *
 * It is a scheduled job over the whole table, so it belongs next to the data
 * rather than on a request path. The repository has no Vercel cron configuration,
 * and a Next.js route woken by an external pinger would still need a service-role
 * key and its own tenancy discipline — the same code, further from the database.
 * `pg_cron` plus `pg_net` calling this function keeps the schedule in the same
 * place as the rows it acts on. Scheduling SQL is in `docs/edge-functions.md`.
 *
 * # Tenancy, given that `service_role` bypasses RLS
 *
 * This job legitimately spans tenants, which makes the discipline stricter rather
 * than looser:
 *
 *  * when `companyId` is supplied it is applied as a filter, so a single-tenant
 *    invocation cannot read or write another tenant's rows;
 *  * with no `companyId` the whole table is read, but `planReminders` returns the
 *    work **grouped by company** and every notification is dispatched per group.
 *    One company's overdue suppliers can never end up in another's digest,
 *    because they are never in the same list;
 *  * every write repeats `company_id` as a predicate alongside the row ids.
 *
 * # What is honestly incomplete
 *
 * There is no email provider configured in this project, and inventing one would
 * be scaffolding pretending to be a feature. Instead: the `pending -> sent`
 * transitions are real database writes, and the digest is POSTed to
 * `SUPPLIER_NOTIFICATION_WEBHOOK_URL` when that is set. With the variable unset
 * the function still does its database work and reports `notified: false`. Wiring
 * that webhook to a mail provider is a deployment decision, documented in
 * `docs/edge-functions.md`.
 */

import { ENV, MissingEnvError, optionalEnv, requireEnv } from "../_shared/env.ts";
import { isAuthorisedSchedulerCall, isUuid } from "../_shared/auth.ts";
import { recordAudit, serviceRoleClient, type SupabaseClient } from "../_shared/client.ts";
import { errorResponse, jsonResponse, methodNotAllowed, readJsonBody } from "../_shared/http.ts";
import {
  type CompanyPlan,
  DEFAULT_DUE_SOON_DAYS,
  planIsEmpty,
  planReminders,
  type RequestRow,
} from "../_shared/reminders.ts";

const TABLE = "supplier_data_requests";

/** Cap on rows read in one run, so a large tenant cannot exhaust the worker. */
const MAX_ROWS = 5000;

interface Options {
  companyId: string | null;
  asOf: Date;
  dueSoonDays: number;
  dryRun: boolean;
}

type OptionsResult = { ok: true; value: Options } | { ok: false; code: string };

function parseOptions(raw: unknown): OptionsResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, code: "invalid_payload" };
  }
  const body = raw as Record<string, unknown>;

  let companyId: string | null = null;
  if (body.companyId !== undefined && body.companyId !== null) {
    if (!isUuid(body.companyId)) return { ok: false, code: "invalid_company_id" };
    companyId = body.companyId;
  }

  let asOf = new Date();
  if (body.asOf !== undefined && body.asOf !== null) {
    if (typeof body.asOf !== "string" || Number.isNaN(Date.parse(body.asOf))) {
      return { ok: false, code: "invalid_as_of" };
    }
    asOf = new Date(body.asOf);
  }

  let dueSoonDays = DEFAULT_DUE_SOON_DAYS;
  if (body.dueSoonDays !== undefined && body.dueSoonDays !== null) {
    if (
      typeof body.dueSoonDays !== "number" ||
      !Number.isInteger(body.dueSoonDays) ||
      body.dueSoonDays < 0 ||
      body.dueSoonDays > 365
    ) {
      return { ok: false, code: "invalid_due_soon_days" };
    }
    dueSoonDays = body.dueSoonDays;
  }

  const dryRun = body.dryRun === true;

  return { ok: true, value: { companyId, asOf, dueSoonDays, dryRun } };
}

/** POSTs one company's digest, if an endpoint is configured. Never throws. */
async function notify(plan: CompanyPlan, asOf: Date): Promise<boolean> {
  const endpoint = optionalEnv(ENV.notificationWebhookUrl);
  if (endpoint === null) return false;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "supplier_request_digest",
        companyId: plan.companyId,
        asOf: asOf.toISOString(),
        issued: plan.toIssue.length,
        overdue: plan.overdue,
        dueSoon: plan.dueSoon,
      }),
      // Without a timeout a hanging endpoint holds the worker until the platform
      // kills it, and the database writes that already happened go unreported.
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("reminder digest rejected", {
        company: plan.companyId,
        status: response.status,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("reminder digest could not be delivered", {
      company: plan.companyId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Marks a company's `pending` requests as `sent`.
 *
 * Scoped by `company_id` as well as the id list — the ids came from our own read,
 * but repeating the tenant predicate is what makes the write safe to read in
 * isolation, and it costs one indexed column.
 */
async function issue(
  client: SupabaseClient,
  companyId: string,
  ids: readonly string[],
  at: string,
): Promise<{ issued: number; error: string | null }> {
  if (ids.length === 0) return { issued: 0, error: null };

  const { data, error } = await client
    .from(TABLE)
    .update({ status: "sent", updated_at: at })
    .eq("company_id", companyId)
    .in("id", ids)
    // Still `pending` at write time: if staff sent it manually in the meantime,
    // this must not drag a further-along request backwards.
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("could not issue requests", { company: companyId, code: error.code });
    return { issued: 0, error: error.code ?? "update_failed" };
  }
  return { issued: data?.length ?? 0, error: null };
}

Deno.serve(async (request: Request): Promise<Response> => {
  const wrongMethod = methodNotAllowed(request, "POST");
  if (wrongMethod !== null) return wrongMethod;

  let cronSecret: string;
  try {
    cronSecret = requireEnv(ENV.cronSecret);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("reminders job is not configured", { variable: error.variable });
      return errorResponse("not_configured", 500);
    }
    throw error;
  }

  if (!(await isAuthorisedSchedulerCall(request, cronSecret))) {
    return errorResponse("unauthorized", 401);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return errorResponse(body.code, body.code === "body_too_large" ? 413 : 400);
  }
  const options = parseOptions(body.value);
  if (!options.ok) return errorResponse(options.code, 422);
  const { companyId, asOf, dueSoonDays, dryRun } = options.value;

  const client = serviceRoleClient();

  let query = client
    .from(TABLE)
    .select("id, company_id, supplier_id, status, due_date, period")
    // Terminal and awaiting-us rows are filtered in the database rather than in
    // memory: on a large tenant most rows are `verified`, and reading them only to
    // discard them is the difference between one page and twenty.
    .in("status", ["pending", "sent", "in_progress"])
    .order("company_id", { ascending: true })
    .limit(MAX_ROWS);

  if (companyId !== null) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) {
    console.error("reminders job could not read requests", { code: error.code });
    return errorResponse("lookup_failed", 502);
  }

  const rows = (data ?? []) as RequestRow[];
  const plans = planReminders(rows, { asOf, dueSoonDays });
  const at = asOf.toISOString();

  const results: Array<{
    companyId: string;
    pendingToIssue: number;
    issued: number;
    overdue: number;
    dueSoon: number;
    notified: boolean;
    error: string | null;
  }> = [];

  for (const plan of plans) {
    if (planIsEmpty(plan)) continue;

    const outcome = dryRun
      ? { issued: 0, error: null }
      : await issue(client, plan.companyId, plan.toIssue, at);

    if (!dryRun && outcome.issued > 0) {
      await recordAudit(client, {
        companyId: plan.companyId,
        tableName: TABLE,
        // The audit trail wants a row id; a batch has none. The company id stands
        // in for the batch and `new_value` names the rows, which keeps the entry
        // truthful rather than attributing the batch to one arbitrary request.
        recordId: plan.companyId,
        action: "update",
        newValue: { status: "sent", requestIds: plan.toIssue.slice(0, 100) },
        reason: "supplier data requests issued by supplier-request-reminders",
      });
    }

    const notified = dryRun ? false : await notify(plan, asOf);

    results.push({
      companyId: plan.companyId,
      pendingToIssue: plan.toIssue.length,
      issued: outcome.issued,
      overdue: plan.overdue.length,
      dueSoon: plan.dueSoon.length,
      notified,
      error: outcome.error,
    });
  }

  return jsonResponse({
    asOf: at,
    dryRun,
    scope: companyId === null ? "all_companies" : "single_company",
    rowsExamined: rows.length,
    // A run that hit the cap has almost certainly not seen everything, so say so
    // rather than reporting a total that looks complete.
    truncated: rows.length === MAX_ROWS,
    companies: results,
  });
});
