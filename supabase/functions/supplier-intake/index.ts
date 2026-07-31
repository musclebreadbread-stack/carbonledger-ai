/**
 * `POST /functions/v1/supplier-intake` — a supplier submits primary emissions data.
 *
 * # Why this is an Edge Function and not a Next.js route
 *
 * `0003_rls_policies_phase2.sql` states the constraint that forces this design:
 *
 * > Suppliers themselves are not users of this system and hold no JWT, so there
 * > is no supplier-side policy to write.
 *
 * A supplier cannot authenticate against Supabase Auth, so no policy on
 * `supplier_data_requests` can ever admit them. The alternatives are all worse:
 * granting `anon` write access to the table would expose every tenant's requests;
 * creating a Supabase user per supplier would put outside parties inside the
 * tenant's user table and its RBAC. What is left is a server-side endpoint that
 * runs as `service_role`, authenticates the supplier by a capability token this
 * platform issued, and does its own tenancy scoping. That is this function.
 *
 * It lives next to the database rather than in the Next.js app because it is the
 * one write path that must be reachable with no session, from an origin we do not
 * control, and must stay available independently of the dashboard's deployment.
 *
 * # The tenancy rule, since RLS is not helping here
 *
 * `service_role` bypasses RLS (see `_shared/client.ts`). The request is therefore
 * looked up by `id` **and** `supplier_id` **and** `company_id`, all three taken
 * from the signed token, and the update repeats the same three predicates. A
 * token replayed after the request was reassigned finds nothing rather than
 * writing into a tenant it no longer belongs to.
 *
 * # What it deliberately does not do
 *
 *  * it does not write `supplier_emissions`. Promoting a figure into the
 *    inventory is verification, a reviewer's act under
 *    `reviewer_update_supplier_requests`. A supplier reaching it would make the
 *    "only verified submissions count" rule in `src/lib/suppliers/types.ts`
 *    meaningless.
 *  * it does not set a data quality score. That is assessed *at* verification.
 *  * it does not overwrite an existing submission. A second attempt gets 409 with
 *    the first submission's timestamp, so a supplier who double-clicks learns
 *    that we already have their figure instead of silently replacing it.
 *  * it does not rate-limit. Stated plainly because it matters: this is a public
 *    endpoint, and per-token throttling needs state that does not exist here.
 *    See `docs/edge-functions.md`.
 */

import { ENV, MissingEnvError, requireEnv } from "../_shared/env.ts";
import { verifySupplierToken } from "../_shared/auth.ts";
import { recordAudit, serviceRoleClient } from "../_shared/client.ts";
import {
  clientAddress,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  preflightResponse,
  readJsonBody,
} from "../_shared/http.ts";
import {
  buildRequestData,
  isSubmittable,
  parseSubmission,
  statusForFailure,
} from "../_shared/intake.ts";

const TABLE = "supplier_data_requests";

Deno.serve(async (request: Request): Promise<Response> => {
  const preflight = preflightResponse(request);
  if (preflight !== null) return preflight;

  const wrongMethod = methodNotAllowed(request, "POST", true);
  if (wrongMethod !== null) return wrongMethod;

  let secret: string;
  try {
    secret = requireEnv(ENV.supplierTokenSecret);
  } catch (error) {
    if (error instanceof MissingEnvError) {
      // The variable name is safe to log; the value never is. An unset signing
      // secret must be a hard 500 — treating it as "" would verify every forgery.
      console.error("supplier-intake is not configured", { variable: error.variable });
      return errorResponse("not_configured", 500, { cors: true });
    }
    throw error;
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return errorResponse(body.code, body.code === "body_too_large" ? 413 : 400, { cors: true });
  }
  const payload = body.value as Record<string, unknown>;

  const nowMs = Date.now();
  const token = await verifySupplierToken(
    payload.token,
    secret,
    Math.floor(nowMs / 1000),
  );
  if (!token.ok) {
    // One response for every token failure. Distinguishing "expired" from
    // "forged" would tell an attacker which of their guesses was structurally
    // right, and the supplier's remedy is the same either way: ask for a new link.
    console.warn("supplier-intake rejected a token", { reason: token.reason });
    return errorResponse("invalid_token", 401, { cors: true });
  }
  const { requestId, supplierId, companyId } = token.claims;

  const client = serviceRoleClient();

  // Scoped by all three claims. `maybeSingle` rather than `single` so a miss is a
  // null row instead of an error we would have to distinguish from a real fault.
  const { data: existing, error: readError } = await client
    .from(TABLE)
    .select("id, company_id, supplier_id, status, period, submitted_at")
    .eq("id", requestId)
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (readError) {
    console.error("supplier-intake could not read the request", {
      code: readError.code,
      message: readError.message,
    });
    return errorResponse("lookup_failed", 502, { cors: true });
  }

  if (existing === null) {
    // Same code as a bad signature, and for the same reason: a token that
    // verifies but points at nothing must not be distinguishable from a forgery,
    // or the pair becomes an oracle for which request ids exist.
    return errorResponse("invalid_token", 401, { cors: true });
  }

  const currentStatus = String(existing.status);
  if (!isSubmittable(currentStatus)) {
    return jsonResponse(
      {
        error: { code: "already_submitted", message: "already_submitted" },
        status: currentStatus,
        submittedAt: existing.submitted_at ?? null,
      },
      { status: 409, cors: true },
    );
  }

  const submission = parseSubmission(payload, String(existing.period));
  if (!submission.ok) {
    return errorResponse(submission.code, statusForFailure(submission.code), { cors: true });
  }

  const receivedAt = new Date(nowMs).toISOString();
  const { data: updated, error: writeError } = await client
    .from(TABLE)
    .update({
      status: "submitted",
      submitted_at: receivedAt,
      updated_at: receivedAt,
      data: buildRequestData(submission.value, receivedAt),
    })
    .eq("id", requestId)
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    // The same status guard again, as a predicate this time. Between the read
    // above and this write, a concurrent submission may have landed; without this
    // the second one would overwrite the first. `select` returns no row when the
    // predicate no longer holds, which is how the race is detected.
    .in("status", ["pending", "sent", "in_progress"])
    .select("id, status, submitted_at")
    .maybeSingle();

  if (writeError) {
    console.error("supplier-intake could not record the submission", {
      code: writeError.code,
      message: writeError.message,
    });
    return errorResponse("write_failed", 502, { cors: true });
  }

  if (updated === null) {
    return errorResponse("already_submitted", 409, { cors: true });
  }

  const audited = await recordAudit(client, {
    companyId,
    tableName: TABLE,
    recordId: requestId,
    action: "submit",
    oldValue: { status: currentStatus },
    newValue: { status: "submitted", submittedAt: receivedAt },
    reason: "supplier submission received via supplier-intake edge function",
    ipAddress: clientAddress(request),
  });

  return jsonResponse(
    {
      status: "submitted",
      requestId,
      period: submission.value.period,
      reportedEmissions: submission.value.reportedEmissions,
      unit: "tCO2e",
      submittedAt: receivedAt,
      // Surfaced rather than hidden: a submission recorded without an audit entry
      // is a gap an auditor needs to know about, and the operator sees it here as
      // well as in the logs.
      audited,
    },
    { status: 202, cors: true },
  );
});
