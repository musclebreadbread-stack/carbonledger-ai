/**
 * `POST /functions/v1/target-progress-rollup` — recomputes `target_progress`
 * from approved emission data.
 *
 * # Why this exists
 *
 * `target_progress` is the only table in the schema that nothing writes.
 * `0003_rls_policies_phase2.sql` gives it four policies, `src/lib/targets/types.ts`
 * models it exactly, `/targets` renders a chart from it — and every figure on that
 * page today comes from sample data. Reduction-target progress is what a company
 * puts in a CDP response or an SBTi progress report, so it is not a page that
 * should be permanently fed by fixtures.
 *
 * # Why an Edge Function
 *
 * It is an aggregation over a company's whole year of records, run on a schedule,
 * and it must be idempotent. That is a database job. Doing it in a page render
 * would put a full-year scan on the request path and produce a different answer
 * every time a draft record changed; doing it in a Server Action would need
 * someone to press a button. `pg_cron` calling this nightly keeps the stored
 * figures in step with the records without either problem.
 *
 * # Idempotency
 *
 * The write is an upsert on `(target_id, year)`, which requires the unique index
 * added by `supabase/migrations/0004_target_progress_uniqueness.sql`. Without it
 * every nightly run would append another row for the same year and
 * `latestProgress` would start picking between duplicates. Re-running the job for
 * the same year is therefore safe and is the intended way to correct a figure
 * after a late approval.
 *
 * # Tenancy, given that `service_role` bypasses RLS
 *
 * Every read and the upsert are scoped by `company_id`, and the per-company work
 * is done one company at a time — targets, emission records and Scope 3 records
 * for a single tenant are never in the same list as another tenant's. Passing
 * `companyId` restricts the run to that tenant; omitting it iterates companies
 * individually rather than aggregating across them.
 */

import { ENV, MissingEnvError, requireEnv } from "../_shared/env.ts";
import { isAuthorisedSchedulerCall, isUuid } from "../_shared/auth.ts";
import { recordAudit, serviceRoleClient, type SupabaseClient } from "../_shared/client.ts";
import { errorResponse, jsonResponse, methodNotAllowed, readJsonBody } from "../_shared/http.ts";
import {
  calendarYearRange,
  type EmissionRow,
  planRollup,
  type Scope3Row,
  type TargetRow,
} from "../_shared/rollup.ts";

/** Cap on companies processed per invocation. */
const MAX_COMPANIES = 200;
/** Cap on records read per company-year. */
const MAX_RECORDS = 20_000;

interface Options {
  companyId: string | null;
  year: number;
}

type OptionsResult = { ok: true; value: Options } | { ok: false; code: string };

function parseOptions(raw: unknown, now: Date): OptionsResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, code: "invalid_payload" };
  }
  const body = raw as Record<string, unknown>;

  let companyId: string | null = null;
  if (body.companyId !== undefined && body.companyId !== null) {
    if (!isUuid(body.companyId)) return { ok: false, code: "invalid_company_id" };
    companyId = body.companyId;
  }

  // Defaults to the current UTC year. A nightly run in January therefore keeps
  // updating the year that just ended only if it is asked to — recomputing the
  // previous year needs an explicit `year`, because silently rolling over on
  // 1 January would freeze December's figures a day before the late approvals
  // that usually follow it.
  let year = now.getUTCFullYear();
  if (body.year !== undefined && body.year !== null) {
    if (
      typeof body.year !== "number" ||
      !Number.isInteger(body.year) ||
      body.year < 1990 ||
      body.year > 2100
    ) {
      return { ok: false, code: "invalid_year" };
    }
    year = body.year;
  }

  return { ok: true, value: { companyId, year } };
}

interface CompanyOutcome {
  companyId: string;
  targetsConsidered: number;
  written: number;
  skipped: Array<{ targetId: string; reason: string }>;
  error: string | null;
}

async function rollUpCompany(
  client: SupabaseClient,
  companyId: string,
  year: number,
): Promise<CompanyOutcome> {
  const base: CompanyOutcome = {
    companyId,
    targetsConsidered: 0,
    written: 0,
    skipped: [],
    error: null,
  };

  const { data: targetData, error: targetError } = await client
    .from("reduction_targets")
    .select(
      "id, company_id, target_type, status, scope, base_year, target_year, base_emissions, target_emissions",
    )
    .eq("company_id", companyId);

  if (targetError) {
    console.error("could not read targets", { company: companyId, code: targetError.code });
    return { ...base, error: "targets_unreadable" };
  }

  const targets = (targetData ?? []) as TargetRow[];
  if (targets.length === 0) return base;

  const { fromIso, toIso } = calendarYearRange(year);

  const { data: emissionData, error: emissionError } = await client
    .from("emission_records")
    .select("scope, co2e_kg")
    .eq("company_id", companyId)
    // Approved only. Anything earlier in the workflow is a proposal, and target
    // progress derived from proposals is not a figure to publish.
    .eq("status", "approved")
    .gte("period_start", fromIso)
    .lt("period_start", toIso)
    .limit(MAX_RECORDS);

  if (emissionError) {
    console.error("could not read emission records", {
      company: companyId,
      code: emissionError.code,
    });
    return { ...base, targetsConsidered: targets.length, error: "records_unreadable" };
  }

  const { data: scope3Data, error: scope3Error } = await client
    .from("scope3_records")
    .select("co2e_kg")
    .eq("company_id", companyId)
    .gte("period_start", fromIso)
    .lt("period_start", toIso)
    .limit(MAX_RECORDS);

  if (scope3Error) {
    console.error("could not read scope 3 records", {
      company: companyId,
      code: scope3Error.code,
    });
    return { ...base, targetsConsidered: targets.length, error: "scope3_unreadable" };
  }

  const plan = planRollup(
    targets,
    (emissionData ?? []) as EmissionRow[],
    (scope3Data ?? []) as Scope3Row[],
    year,
  );

  if (plan.rows.length === 0) {
    return { ...base, targetsConsidered: targets.length, skipped: plan.skipped };
  }

  const { data: written, error: writeError } = await client
    .from("target_progress")
    .upsert(plan.rows, { onConflict: "target_id,year" })
    .select("id");

  if (writeError) {
    console.error("could not write target progress", {
      company: companyId,
      code: writeError.code,
      message: writeError.message,
    });
    return { ...base, targetsConsidered: targets.length, error: "write_failed" };
  }

  await recordAudit(client, {
    companyId,
    tableName: "target_progress",
    // A batch has no single row id; the company id stands in for it and
    // `new_value` names what was written. See the same choice in the reminders job.
    recordId: companyId,
    action: "update",
    newValue: { year, rows: plan.rows },
    reason: "target progress recomputed by target-progress-rollup",
  });

  return {
    companyId,
    targetsConsidered: targets.length,
    written: written?.length ?? plan.rows.length,
    skipped: plan.skipped,
    error: null,
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  const wrongMethod = methodNotAllowed(request, "POST");
  if (wrongMethod !== null) return wrongMethod;

  let cronSecret: string;
  try {
    cronSecret = requireEnv(ENV.cronSecret);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("rollup job is not configured", { variable: error.variable });
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
  const options = parseOptions(body.value, new Date());
  if (!options.ok) return errorResponse(options.code, 422);
  const { companyId, year } = options.value;

  const client = serviceRoleClient();

  let companyIds: string[];
  if (companyId !== null) {
    companyIds = [companyId];
  } else {
    const { data, error } = await client
      .from("companies")
      .select("id")
      // Soft-deleted tenants keep their rows; recomputing their targets would
      // resurrect figures for a company that is gone.
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .limit(MAX_COMPANIES);

    if (error) {
      console.error("rollup job could not list companies", { code: error.code });
      return errorResponse("lookup_failed", 502);
    }
    companyIds = (data ?? []).map((row) => String(row.id));
  }

  const outcomes: CompanyOutcome[] = [];
  for (const id of companyIds) {
    // Sequential on purpose. Fanning out with `Promise.all` would open one
    // connection per company against a pooled database for a job with no deadline,
    // and a partial failure would be much harder to report per tenant.
    outcomes.push(await rollUpCompany(client, id, year));
  }

  const failed = outcomes.filter((outcome) => outcome.error !== null);

  return jsonResponse(
    {
      year,
      scope: companyId === null ? "all_companies" : "single_company",
      companiesProcessed: outcomes.length,
      truncated: companyId === null && companyIds.length === MAX_COMPANIES,
      rowsWritten: outcomes.reduce((total, outcome) => total + outcome.written, 0),
      companies: outcomes,
    },
    // 207 when some tenants failed and others succeeded: a 200 would let a
    // scheduler record a clean run over a job that half worked.
    { status: failed.length > 0 && failed.length < outcomes.length ? 207 : 200 },
  );
});
