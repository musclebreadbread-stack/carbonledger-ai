/**
 * Validating a supplier's submission. Pure — no database, no clock, no network.
 *
 * The counterpart of `src/lib/suppliers/types.ts`, which owns the *decision* side
 * of the lifecycle (verify, reject, re-request). This module owns the *intake*
 * side: what a supplier is allowed to send and which statuses may receive it.
 *
 * The lifecycle both halves share, from `src/lib/suppliers/types.ts`:
 *
 *   pending -> sent -> in_progress -> submitted -> verified | rejected
 *
 * Intake moves a request to `submitted`. It never moves it further. Verification
 * is a reviewer's act inside the application, subject to
 * `reviewer_update_supplier_requests`, and a supplier must not be able to reach
 * it — which is why nothing here writes `supplier_emissions`, sets a data quality
 * score, or touches `verified`.
 */

/**
 * Methodologies a supplier may declare, as an allowlist.
 *
 * Free text would end up rendered through a translation lookup in the portal and
 * would be written into the audit trail unchecked. The five values are the GHG
 * Protocol Scope 3 calculation methods the platform already reasons about.
 */
export const SUPPLIER_METHODOLOGIES = [
  "supplier_specific",
  "average_data",
  "spend_based",
  "activity_based",
  "hybrid",
] as const;

export type SupplierMethodology = (typeof SUPPLIER_METHODOLOGIES)[number];

export function isSupplierMethodology(value: unknown): value is SupplierMethodology {
  return typeof value === "string" &&
    (SUPPLIER_METHODOLOGIES as readonly string[]).includes(value);
}

/**
 * Statuses that can receive a submission.
 *
 * `pending` is included on purpose: a supplier who was told about a request out
 * of band should not be blocked because the reminder job has not marked it `sent`
 * yet. `submitted`, `verified` and `rejected` are excluded — the first would
 * silently overwrite a figure already in our queue, and the other two would
 * reopen a decision that is meant to be final (a rejection is followed by a *new*
 * request, per `reRequest`).
 */
export const SUBMITTABLE_STATUSES = ["pending", "sent", "in_progress"] as const;

export type SubmittableStatus = (typeof SUBMITTABLE_STATUSES)[number];

export function isSubmittable(status: string): status is SubmittableStatus {
  return (SUBMITTABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Upper bound on a single reported figure, in tCO2e.
 *
 * One hundred million tonnes from one supplier for one category in one period is
 * about a fifth of South Korea's entire national inventory, so a figure above it
 * is a unit error — kg entered as tonnes is the usual one — not a real number.
 * Rejecting it is far better than letting a thousand-fold error into a reported
 * Scope 3 total, where it would dwarf everything else and be believed.
 */
export const MAX_REPORTED_TONNES = 100_000_000;

/** Longest free-text note accepted, in characters. */
export const MAX_NOTES_LENGTH = 2000;

export interface SupplierSubmission {
  /** Emissions in tCO2e, as the platform's supplier figures are held. */
  reportedEmissions: number;
  methodology: SupplierMethodology;
  /** Reporting period the supplier says this covers, `YYYY` or `YYYY-MM`. */
  period: string;
  /** Link to supporting evidence, https only. Null when not supplied. */
  evidenceUrl: string | null;
  notes: string | null;
}

export type SubmissionFailure =
  | "missing_emissions"
  | "invalid_emissions"
  | "emissions_out_of_range"
  | "invalid_methodology"
  | "period_mismatch"
  | "invalid_evidence_url"
  | "notes_too_long"
  | "invalid_payload";

export type SubmissionResult =
  | { ok: true; value: SupplierSubmission }
  | { ok: false; code: SubmissionFailure };

const PERIOD_PATTERN = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

/** Whether `value` is an acceptable evidence link. */
export function isEvidenceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // https only. An `http:` link in an audit trail is evidence that can be
  // rewritten in transit, and `data:`/`javascript:` would be rendered back into
  // the reviewer's browser by the portal.
  return url.protocol === "https:" && value.length <= 2048;
}

/**
 * Parses and validates a submission body against the request it targets.
 *
 * `requestPeriod` is checked rather than taken from the payload. A supplier
 * submitting 2023 figures against a 2024 request is a real and common mistake,
 * and silently accepting it would file the wrong year's emissions under the right
 * request — an error nothing downstream could detect.
 */
export function parseSubmission(raw: unknown, requestPeriod: string): SubmissionResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, code: "invalid_payload" };
  }
  const body = raw as Record<string, unknown>;

  const rawEmissions = body.reportedEmissions;
  if (rawEmissions === undefined || rawEmissions === null) {
    return { ok: false, code: "missing_emissions" };
  }
  // Numbers only. A numeric string would work by coercion, but accepting one
  // means accepting "1,980.25", which parses to 1 under `Number` in some locales'
  // formatting and to NaN in others.
  if (typeof rawEmissions !== "number" || !Number.isFinite(rawEmissions)) {
    return { ok: false, code: "invalid_emissions" };
  }
  // Zero is allowed: "we emitted nothing attributable to you this period" is a
  // real answer and is different from not answering. Negative is not.
  if (rawEmissions < 0) return { ok: false, code: "invalid_emissions" };
  if (rawEmissions > MAX_REPORTED_TONNES) {
    return { ok: false, code: "emissions_out_of_range" };
  }

  if (!isSupplierMethodology(body.methodology)) {
    return { ok: false, code: "invalid_methodology" };
  }

  const period = body.period;
  if (period !== undefined && period !== null) {
    if (typeof period !== "string" || !PERIOD_PATTERN.test(period)) {
      return { ok: false, code: "period_mismatch" };
    }
    if (period !== requestPeriod) return { ok: false, code: "period_mismatch" };
  }

  let evidenceUrl: string | null = null;
  const rawEvidence = body.evidenceUrl;
  if (rawEvidence !== undefined && rawEvidence !== null && rawEvidence !== "") {
    if (typeof rawEvidence !== "string" || !isEvidenceUrl(rawEvidence)) {
      return { ok: false, code: "invalid_evidence_url" };
    }
    evidenceUrl = rawEvidence;
  }

  let notes: string | null = null;
  const rawNotes = body.notes;
  if (rawNotes !== undefined && rawNotes !== null && rawNotes !== "") {
    if (typeof rawNotes !== "string") return { ok: false, code: "invalid_payload" };
    if (rawNotes.length > MAX_NOTES_LENGTH) return { ok: false, code: "notes_too_long" };
    notes = rawNotes;
  }

  return {
    ok: true,
    value: {
      // Six decimal places matches `supplier_emissions.co2e_kg`'s numeric(18,6);
      // anything finer would be rounded by the database anyway, and rounding here
      // means the figure in `data` matches the figure that gets stored later.
      reportedEmissions: Math.round(rawEmissions * 1e6) / 1e6,
      methodology: body.methodology,
      period: requestPeriod,
      evidenceUrl,
      notes,
    },
  };
}

/**
 * The `supplier_data_requests.data` payload for an accepted submission.
 *
 * Shaped to match the fields `src/lib/suppliers/types.ts` reads back
 * (`reportedEmissions`), plus provenance. `source` records that this arrived
 * through the public intake rather than being typed in by staff, which is the
 * difference between a supplier's own claim and an internal estimate — and is
 * exactly what an auditor asks about.
 */
export function buildRequestData(
  submission: SupplierSubmission,
  receivedAt: string,
): Record<string, unknown> {
  return {
    reportedEmissions: submission.reportedEmissions,
    unit: "tCO2e",
    methodology: submission.methodology,
    period: submission.period,
    evidenceUrl: submission.evidenceUrl,
    notes: submission.notes,
    source: "edge:supplier-intake",
    receivedAt,
  };
}

/** HTTP status for each rejection reason. */
export function statusForFailure(code: SubmissionFailure): number {
  // Everything here is the caller sending something wrong, so 422 throughout:
  // the request was well-formed JSON but its contents are not acceptable.
  switch (code) {
    case "invalid_payload":
      return 400;
    default:
      return 422;
  }
}
