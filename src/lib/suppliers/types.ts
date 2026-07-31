/**
 * Typed contract for the supplier portal served at `/suppliers`.
 *
 * Mirrors `suppliers` and `supplier_data_requests` in
 * `src/lib/db/schema/suppliers.ts`, plus the emission figures a request carries
 * once submitted (`supplier_emissions`).
 *
 * The portal covers the four operations the product promises — submission,
 * verification (승인), rejection (반려) and re-request (재요청) — and the Scope 3
 * roll-up that follows from them. The roll-up rule lives in
 * `aggregateByCategory` below and is the part worth reading closely: only
 * *verified* submissions count towards reported Scope 3, because a number a
 * supplier typed in but nobody checked is not an inventory input.
 *
 * Emissions are in **tCO2e**; `supplier_emissions.co2e_kg` is kg, so use
 * `kgToTonnes` from `src/lib/scope3/types.ts` in a database-backed provider.
 */

import type { Scope3CategoryNumber } from "@/lib/scope3/types";

/** Matches the `supplier_status` enum. */
export type SupplierStatus = "active" | "pending" | "inactive";

/**
 * Matches the `data_request_status` enum.
 *
 * The lifecycle is: `pending` (created) → `sent` (issued to the supplier) →
 * `in_progress` (supplier started) → `submitted` (awaiting our verification) →
 * `verified` or `rejected`. A rejection is followed by a *new* request rather
 * than by reopening the old one, so the rejected submission stays on the record —
 * see `reRequest`.
 */
export type DataRequestStatus =
  | "pending"
  | "sent"
  | "in_progress"
  | "submitted"
  | "verified"
  | "rejected";

export interface Supplier {
  id: string;
  /** Supplier company name. Stored, not translated. */
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  /** Key under `supplier_industries`, or a stored industry string. */
  industryKey: string | null;
  /** ISO 3166-1 alpha-2 country code, or null when unknown. */
  country: string | null;
  status: SupplierStatus;
  /**
   * Annual spend with this supplier, in millions of KRW. Drives the spend-based
   * fallback estimate when the supplier never submits primary data.
   */
  annualSpendMillionKrw: number | null;
}

/**
 * Reasons a submission may be rejected.
 *
 * An allowlist rather than free text, because the reason arrives from a form and
 * is rendered back through `supplier_rejection_reasons.<key>`: an unchecked value
 * would either surface a raw string where a translation is expected, or let a
 * caller write arbitrary text into the audit trail. Every key here must exist in
 * all four catalogues, which `tests/lib/suppliers/transitions.test.ts` checks.
 */
export const SUPPLIER_REJECTION_REASON_KEYS = [
  "no_methodology_disclosed",
  "missing_supporting_evidence",
  "boundary_mismatch",
  "outdated_emission_factors",
  "inconsistent_with_prior_period",
] as const;

export type SupplierRejectionReasonKey = (typeof SUPPLIER_REJECTION_REASON_KEYS)[number];

export function isSupplierRejectionReasonKey(value: unknown): value is SupplierRejectionReasonKey {
  return (
    typeof value === "string" &&
    (SUPPLIER_REJECTION_REASON_KEYS as readonly string[]).includes(value)
  );
}

/** Data quality is assessed on a 1-5 scale, matching `supplier_emissions.data_quality`. */
export const MIN_DATA_QUALITY = 1;
export const MAX_DATA_QUALITY = 5;

export function isDataQualityScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_DATA_QUALITY &&
    value <= MAX_DATA_QUALITY
  );
}

export interface SupplierDataRequest {
  id: string;
  /**
   * Owning tenant, mirroring `supplier_data_requests.company_id`. Every policy on
   * the table in `0003_rls_policies_phase2.sql` is scoped by it, so a Server
   * Action has to check it too.
   */
  companyId: string;
  supplierId: string;
  /** Reporting period the request covers, as `YYYY` or `YYYY-MM`. */
  period: string;
  categoryNumber: Scope3CategoryNumber;
  status: DataRequestStatus;
  /** ISO-8601 date the response is due. */
  dueDate: string;
  /** ISO-8601 instant the supplier submitted, null until they do. */
  submittedAt: string | null;
  /**
   * Emissions the supplier reported, in tCO2e. Null until submitted. Stays
   * populated after a rejection so the rejected figure remains auditable.
   */
  reportedEmissions: number | null;
  /** Data quality 1-5 as assessed on verification, null before that. */
  dataQuality: number | null;
  /**
   * ISO-8601 instant we verified or rejected the submission, null while the
   * decision is outstanding. Distinct from `submittedAt`, which is the supplier's
   * side of the exchange: the gap between the two is our own turnaround, and
   * `isOverdue` deliberately does not blame the supplier for it.
   */
  verifiedAt: string | null;
  /** Key under `supplier_rejection_reasons`, set when `rejected`. */
  rejectionReasonKey: SupplierRejectionReasonKey | string | null;
  /**
   * Id of the request this one replaces, when it was raised as a re-request
   * (재요청). Null for a first request. Makes the chain of attempts explicit
   * instead of leaving it to be inferred from timestamps.
   */
  supersedesRequestId: string | null;
}

export interface SuppliersOverview {
  /** Reporting year the requests belong to. */
  year: number;
  /** True when these are sample suppliers rather than real trading partners. */
  isSampleData: boolean;
  suppliers: Supplier[];
  requests: SupplierDataRequest[];
}

export type SuppliersProvider = (options?: {
  companyId?: string;
  year?: number;
}) => Promise<SuppliersOverview>;

/** Terminal statuses — a request in one of these needs no further chasing. */
const TERMINAL_STATUSES: readonly DataRequestStatus[] = ["verified", "rejected"];

/** Whether a request is still waiting on the supplier. */
export function isAwaitingSupplier(request: SupplierDataRequest): boolean {
  return (
    request.status === "pending" || request.status === "sent" || request.status === "in_progress"
  );
}

/** Whether a request is waiting on us to verify or reject it. */
export function isAwaitingVerification(request: SupplierDataRequest): boolean {
  return request.status === "submitted";
}

/**
 * Whether a request is overdue as of `asOf`.
 *
 * Only requests still awaiting the supplier can be overdue: a submitted request
 * sitting in our own verification queue past its due date is our delay, not the
 * supplier's, and counting it as supplier lateness would misattribute blame in
 * every engagement report.
 */
export function isOverdue(request: SupplierDataRequest, asOf: Date): boolean {
  if (!isAwaitingSupplier(request)) return false;
  const due = Date.parse(request.dueDate);
  if (!Number.isFinite(due)) return false;
  return due < asOf.getTime();
}

/** Headline counts for the KPI row. */
export interface SupplierRequestCounts {
  total: number;
  awaitingSupplier: number;
  awaitingVerification: number;
  verified: number;
  rejected: number;
  overdue: number;
}

export function countRequests(
  requests: readonly SupplierDataRequest[],
  asOf: Date
): SupplierRequestCounts {
  const counts: SupplierRequestCounts = {
    total: requests.length,
    awaitingSupplier: 0,
    awaitingVerification: 0,
    verified: 0,
    rejected: 0,
    overdue: 0,
  };

  for (const request of requests) {
    if (request.status === "verified") counts.verified += 1;
    else if (request.status === "rejected") counts.rejected += 1;
    else if (isAwaitingVerification(request)) counts.awaitingVerification += 1;
    else counts.awaitingSupplier += 1;

    if (isOverdue(request, asOf)) counts.overdue += 1;
  }

  return counts;
}

/**
 * Response rate: the share of requests the supplier actually answered.
 *
 * A rejected submission still counts as a response — the supplier did send
 * something. Excluding it would conflate "did not reply" with "replied badly",
 * which are different problems needing different follow-up.
 */
export function responseRatePercent(requests: readonly SupplierDataRequest[]): number {
  if (requests.length === 0) return 0;
  const responded = requests.filter(
    (request) => request.submittedAt !== null || TERMINAL_STATUSES.includes(request.status)
  ).length;
  return Math.round((responded / requests.length) * 100);
}

/** One row of the Scope 3 roll-up produced from supplier submissions. */
export interface CategoryAggregate {
  categoryNumber: Scope3CategoryNumber;
  /** Sum of verified supplier emissions, in tCO2e. */
  verifiedEmissions: number;
  /** Number of suppliers with a verified submission in this category. */
  verifiedSupplierCount: number;
  /**
   * Emissions submitted but not yet verified, in tCO2e. Reported separately so
   * the UI can show what the total *would* become without letting unverified
   * figures leak into the reported number.
   */
  pendingEmissions: number;
  pendingSupplierCount: number;
}

/**
 * Aggregates supplier submissions into Scope 3 categories (Scope 3 자동 집계).
 *
 * Two rules make this correct rather than a plain `groupBy`:
 *
 *  1. Only `verified` submissions contribute to `verifiedEmissions`. Submitted
 *     but unverified figures are tracked separately, and rejected ones are
 *     excluded entirely.
 *  2. Superseded requests are dropped. When a rejected request has been
 *     re-requested and the replacement verified, both rows exist in the table;
 *     summing them would double-count the supplier. The replacement wins.
 *
 * Deterministic and pure — covered by `tests/lib/suppliers/aggregate.test.ts`.
 */
export function aggregateByCategory(
  requests: readonly SupplierDataRequest[]
): CategoryAggregate[] {
  const superseded = new Set(
    requests
      .map((request) => request.supersedesRequestId)
      .filter((id): id is string => id !== null)
  );

  const byCategory = new Map<Scope3CategoryNumber, CategoryAggregate>();

  for (const request of requests) {
    if (superseded.has(request.id)) continue;
    if (request.reportedEmissions === null) continue;
    if (request.status === "rejected") continue;

    const existing =
      byCategory.get(request.categoryNumber) ??
      ({
        categoryNumber: request.categoryNumber,
        verifiedEmissions: 0,
        verifiedSupplierCount: 0,
        pendingEmissions: 0,
        pendingSupplierCount: 0,
      } satisfies CategoryAggregate);

    if (request.status === "verified") {
      existing.verifiedEmissions += request.reportedEmissions;
      existing.verifiedSupplierCount += 1;
    } else if (request.status === "submitted") {
      existing.pendingEmissions += request.reportedEmissions;
      existing.pendingSupplierCount += 1;
    }

    byCategory.set(request.categoryNumber, existing);
  }

  return [...byCategory.values()]
    .map((aggregate) => ({
      ...aggregate,
      verifiedEmissions: Math.round(aggregate.verifiedEmissions * 100) / 100,
      pendingEmissions: Math.round(aggregate.pendingEmissions * 100) / 100,
    }))
    .sort((a, b) => a.categoryNumber - b.categoryNumber);
}

/**
 * Marks a submission verified (승인) with the data quality assessed at
 * verification.
 *
 * Pure, like `reRequest`: returns the new row and lets the caller persist it.
 *
 * Throws unless the request is `submitted`. Two separate reasons, both worth
 * refusing over: verifying something the supplier has not sent would put a null
 * figure into the reported Scope 3 roll-up, and re-verifying an already terminal
 * request would let a rejection be quietly overturned without either decision
 * being visible.
 */
export function verifyRequest(
  request: SupplierDataRequest,
  options: { dataQuality: number; at: string }
): SupplierDataRequest {
  if (request.status !== "submitted") {
    throw new Error(
      `Only a submitted request can be verified; ${request.id} is ${request.status}`
    );
  }
  if (!isDataQualityScore(options.dataQuality)) {
    throw new Error(
      `Data quality must be an integer ${MIN_DATA_QUALITY}-${MAX_DATA_QUALITY}, got ${options.dataQuality}`
    );
  }
  return {
    ...request,
    status: "verified",
    dataQuality: options.dataQuality,
    // A verification clears any earlier rejection note; the rejected attempt it
    // superseded keeps its own reason on its own row.
    rejectionReasonKey: null,
    verifiedAt: options.at,
  };
}

/**
 * Marks a submission rejected (반려) with a stated reason.
 *
 * `reportedEmissions` is left in place on purpose. The rejected figure is
 * evidence — of what the supplier claimed and of why it was not accepted — and
 * `aggregateByCategory` already excludes rejected rows from the roll-up, so
 * keeping it costs nothing and erasing it would destroy the trail.
 */
export function rejectRequest(
  request: SupplierDataRequest,
  options: { reasonKey: SupplierRejectionReasonKey; at: string }
): SupplierDataRequest {
  if (request.status !== "submitted") {
    throw new Error(
      `Only a submitted request can be rejected; ${request.id} is ${request.status}`
    );
  }
  if (!isSupplierRejectionReasonKey(options.reasonKey)) {
    throw new Error(`Unknown rejection reason: ${String(options.reasonKey)}`);
  }
  return {
    ...request,
    status: "rejected",
    rejectionReasonKey: options.reasonKey,
    verifiedAt: options.at,
  };
}

/**
 * Builds the replacement request for a rejected submission (재요청).
 *
 * Pure: it returns the new request rather than mutating anything, so the caller
 * decides whether to persist it. `supersedesRequestId` points back at the
 * rejected attempt, which is what keeps `aggregateByCategory` from
 * double-counting.
 *
 * Throws when the source request was not rejected — re-requesting a verified
 * submission would silently drop a good number out of the roll-up.
 */
export function reRequest(
  request: SupplierDataRequest,
  options: { id: string; dueDate: string }
): SupplierDataRequest {
  if (request.status !== "rejected") {
    throw new Error(
      `Only a rejected request can be re-requested; ${request.id} is ${request.status}`
    );
  }
  return {
    id: options.id,
    companyId: request.companyId,
    supplierId: request.supplierId,
    period: request.period,
    categoryNumber: request.categoryNumber,
    status: "sent",
    dueDate: options.dueDate,
    submittedAt: null,
    reportedEmissions: null,
    dataQuality: null,
    verifiedAt: null,
    rejectionReasonKey: null,
    supersedesRequestId: request.id,
  };
}
