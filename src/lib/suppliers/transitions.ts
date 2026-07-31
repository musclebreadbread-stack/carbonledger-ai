/**
 * Acting on a supplier submission: verify (승인), reject (반려), re-request (재요청).
 *
 * `./types` holds the pure status transitions. This module adds the
 * authorisation around them — the same rules
 * `supabase/migrations/0003_rls_policies_phase2.sql` enforces on
 * `supplier_data_requests`, restated server-side because a Server Action runs
 * with the server's privileges and is reachable by POST regardless of what the UI
 * rendered.
 *
 * The policies being mirrored:
 *   * `company_view_supplier_requests` / `reviewer_update_supplier_requests` /
 *     `writer_create_supplier_requests` — all scoped by
 *     `company_id = auth.user_company_id()`;
 *   * verification and rejection are review actions, so `auth.can_approve()`;
 *   * a re-request is an INSERT, so `auth.can_write()`;
 *   * **there is no DELETE policy at all**, and there is no delete here either.
 *     A rejected request is superseded, never removed — that is what keeps the
 *     chain of attempts auditable and what stops `aggregateByCategory`
 *     double-counting a supplier who was rejected and then re-submitted.
 */

import { canApprove, canWrite, ownsCompany, type Actor } from "@/lib/auth/actor";
import {
  isDataQualityScore,
  isSupplierRejectionReasonKey,
  rejectRequest,
  reRequest,
  verifyRequest,
  type SupplierDataRequest,
  type SupplierRejectionReasonKey,
} from "./types";

/** The three operations the portal exposes. */
export type SupplierAction = "verify" | "reject" | "re_request";

export const SUPPLIER_ACTIONS: readonly SupplierAction[] = ["verify", "reject", "re_request"];

export function isSupplierAction(value: unknown): value is SupplierAction {
  return typeof value === "string" && (SUPPLIER_ACTIONS as readonly string[]).includes(value);
}

/** Why an action was refused. Translated by the client, like `ApprovalDenial`. */
export type SupplierDenial =
  | "unauthenticated"
  | "forbidden_role"
  | "wrong_company"
  | "not_found"
  | "not_submitted"
  | "not_rejected"
  | "already_re_requested"
  | "invalid_input";

export type SupplierAuthorization = { ok: true } | { ok: false; reason: SupplierDenial };

/** How long a re-requested submission is given. */
export const RE_REQUEST_DUE_DAYS = 30;

/**
 * Whether `actor` may take `action` on `request`, given the other requests on
 * file.
 *
 * `siblings` is needed for one check only, and it is the important one: a request
 * that has already been re-requested must not be re-requested again. Two live
 * replacements for the same rejected attempt would both be un-superseded, and
 * `aggregateByCategory` would count the supplier twice — the exact bug the
 * `supersedesRequestId` link exists to prevent.
 */
export function authorizeSupplierAction(
  actor: Actor,
  request: SupplierDataRequest,
  action: SupplierAction,
  siblings: readonly SupplierDataRequest[]
): SupplierAuthorization {
  // Tenancy first, so a probe cannot tell "another company's request" apart from
  // "wrong status" and use the difference to enumerate other tenants' rows.
  if (!ownsCompany(actor, request.companyId)) {
    return { ok: false, reason: "wrong_company" };
  }

  if (action === "re_request") {
    // INSERT of a replacement row: `writer_create_supplier_requests`.
    if (!canWrite(actor.role)) return { ok: false, reason: "forbidden_role" };
    if (request.status !== "rejected") return { ok: false, reason: "not_rejected" };
    if (siblings.some((candidate) => candidate.supersedesRequestId === request.id)) {
      return { ok: false, reason: "already_re_requested" };
    }
    return { ok: true };
  }

  // Verification and rejection: `reviewer_update_supplier_requests`.
  if (!canApprove(actor.role)) return { ok: false, reason: "forbidden_role" };

  // Only a submitted request is decidable. This is also the freeze rule: once
  // verified or rejected the decision stands, and reversing it means a new
  // request, not an edit of the old one.
  if (request.status !== "submitted") return { ok: false, reason: "not_submitted" };

  return { ok: true };
}

export type SupplierActionResult =
  | {
      ok: true;
      action: SupplierAction;
      /** The row as it now stands, or for a re-request the row that was superseded. */
      request: SupplierDataRequest;
      /** Present only for a re-request: the replacement to insert. */
      created: SupplierDataRequest | null;
    }
  | { ok: false; reason: SupplierDenial };

/** ISO date `days` after `at`, for the replacement request's deadline. */
function dueDateAfter(at: string, days: number): string {
  const due = new Date(Date.parse(at) + days * 24 * 60 * 60 * 1000);
  return due.toISOString().slice(0, 10);
}

/**
 * Id for a replacement request: the superseded id with an `R` suffix, plus a
 * counter if that is somehow taken. Readable in the table next to the request it
 * replaces, which an opaque uuid would not be.
 */
function reRequestId(request: SupplierDataRequest, existing: readonly SupplierDataRequest[]): string {
  const taken = new Set(existing.map((candidate) => candidate.id));
  let candidate = `${request.id}R`;
  let counter = 2;
  while (taken.has(candidate)) {
    candidate = `${request.id}R${counter}`;
    counter += 1;
  }
  return candidate;
}

/**
 * Authorise, validate the inputs, then apply the transition.
 *
 * Inputs are validated here rather than trusted from the form: `dataQuality`
 * arrives as a string that may be anything, and `reasonKey` is rendered back
 * through a translation lookup, so an unchecked value would either break the
 * badge or write arbitrary text into the audit trail.
 */
export function recordSupplierAction(
  request: SupplierDataRequest,
  actor: Actor,
  siblings: readonly SupplierDataRequest[],
  input: {
    action: SupplierAction;
    dataQuality?: number | null;
    reasonKey?: string | null;
    at: string;
  }
): SupplierActionResult {
  if (Number.isNaN(Date.parse(input.at))) {
    return { ok: false, reason: "invalid_input" };
  }

  const authorization = authorizeSupplierAction(actor, request, input.action, siblings);
  if (!authorization.ok) return authorization;

  switch (input.action) {
    case "verify": {
      if (!isDataQualityScore(input.dataQuality)) {
        return { ok: false, reason: "invalid_input" };
      }
      return {
        ok: true,
        action: "verify",
        request: verifyRequest(request, { dataQuality: input.dataQuality, at: input.at }),
        created: null,
      };
    }
    case "reject": {
      if (!isSupplierRejectionReasonKey(input.reasonKey)) {
        return { ok: false, reason: "invalid_input" };
      }
      return {
        ok: true,
        action: "reject",
        request: rejectRequest(request, {
          reasonKey: input.reasonKey as SupplierRejectionReasonKey,
          at: input.at,
        }),
        created: null,
      };
    }
    case "re_request": {
      return {
        ok: true,
        action: "re_request",
        request,
        created: reRequest(request, {
          id: reRequestId(request, siblings),
          dueDate: dueDateAfter(input.at, RE_REQUEST_DUE_DAYS),
        }),
      };
    }
  }
}
