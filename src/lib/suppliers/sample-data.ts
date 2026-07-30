/**
 * SAMPLE (MOCK) SUPPLIERS AND DATA REQUESTS — NOT REAL TRADING PARTNERS.
 *
 * Drives `/suppliers` while there is no live database. Payloads carry
 * `isSampleData: true` and the page renders `<SampleDataNotice />` off it.
 *
 * The sample deliberately includes a rejected request that was re-requested and
 * then verified (REQ-004 → REQ-004R), because that pair is what exercises the
 * de-duplication rule in `aggregateByCategory`. It also includes an overdue
 * request and a supplier who has never responded, since a portal whose sample
 * data shows a 100% response rate would never surface the follow-up UI.
 *
 * Supplier names are invented placeholders in a deliberately fictional form
 * ("Sample Components Co."), not the names of real companies.
 *
 * To go live, replace `getSuppliersOverview` with a Drizzle-backed
 * implementation satisfying `SuppliersProvider`.
 */

import type { Supplier, SupplierDataRequest, SuppliersOverview, SuppliersProvider } from "./types";

const SAMPLE_YEAR = 2024;

/**
 * Reference instant the sample's overdue/upcoming split is built around.
 *
 * Fixed rather than `new Date()` so the page and its tests agree: with a live
 * clock the "overdue" count would change on 2025-01-31 and a passing test would
 * start failing for no code change.
 */
export const SAMPLE_AS_OF = new Date("2024-12-10T00:00:00.000Z");

const SAMPLE_SUPPLIERS: readonly Supplier[] = [
  {
    id: "s-0001",
    name: "Sample Components Co.",
    contactName: "J. Ahn",
    contactEmail: "esg@example.com",
    industryKey: "electronic_components",
    country: "KR",
    status: "active",
    annualSpendMillionKrw: 12_400,
  },
  {
    id: "s-0002",
    name: "Sample Steel Works",
    contactName: "T. Nakamura",
    contactEmail: "sustainability@example.com",
    industryKey: "metals",
    country: "JP",
    status: "active",
    annualSpendMillionKrw: 9_800,
  },
  {
    id: "s-0003",
    name: "Sample Logistics Partners",
    contactName: "L. Wang",
    contactEmail: "carbon@example.com",
    industryKey: "logistics",
    country: "CN",
    status: "active",
    annualSpendMillionKrw: 3_150,
  },
  {
    id: "s-0004",
    name: "Sample Chemicals Ltd.",
    contactName: "R. Gupta",
    contactEmail: "hse@example.com",
    industryKey: "chemicals",
    country: "IN",
    status: "active",
    annualSpendMillionKrw: 5_600,
  },
  {
    id: "s-0005",
    name: "Sample Packaging Group",
    contactName: null,
    contactEmail: null,
    industryKey: "packaging",
    country: "VN",
    // Never responded to anything and has no named contact — the case the
    // portal's chase-up flow exists for.
    status: "pending",
    annualSpendMillionKrw: 1_740,
  },
];

const SAMPLE_REQUESTS: readonly SupplierDataRequest[] = [
  {
    id: "REQ-001",
    supplierId: "s-0001",
    period: "2024",
    categoryNumber: 1,
    status: "verified",
    dueDate: "2024-11-30",
    submittedAt: "2024-11-18T02:00:00.000Z",
    reportedEmissions: 8_420.5,
    dataQuality: 4,
    rejectionReasonKey: null,
    supersedesRequestId: null,
  },
  {
    id: "REQ-002",
    supplierId: "s-0002",
    period: "2024",
    categoryNumber: 1,
    status: "verified",
    dueDate: "2024-11-30",
    submittedAt: "2024-11-22T06:30:00.000Z",
    reportedEmissions: 11_260.0,
    dataQuality: 5,
    rejectionReasonKey: null,
    supersedesRequestId: null,
  },
  {
    id: "REQ-003",
    supplierId: "s-0003",
    period: "2024",
    categoryNumber: 4,
    status: "submitted",
    dueDate: "2024-12-15",
    submittedAt: "2024-12-08T01:15:00.000Z",
    reportedEmissions: 1_980.25,
    dataQuality: null,
    rejectionReasonKey: null,
    supersedesRequestId: null,
  },
  // Rejected, then re-requested and verified. Both rows survive; only the
  // replacement counts towards the roll-up.
  {
    id: "REQ-004",
    supplierId: "s-0004",
    period: "2024",
    categoryNumber: 1,
    status: "rejected",
    dueDate: "2024-10-31",
    submittedAt: "2024-10-25T04:00:00.000Z",
    reportedEmissions: 6_100.0,
    dataQuality: 1,
    rejectionReasonKey: "no_methodology_disclosed",
    supersedesRequestId: null,
  },
  {
    id: "REQ-004R",
    supplierId: "s-0004",
    period: "2024",
    categoryNumber: 1,
    status: "verified",
    dueDate: "2024-12-05",
    submittedAt: "2024-12-02T07:45:00.000Z",
    reportedEmissions: 5_740.0,
    dataQuality: 3,
    rejectionReasonKey: null,
    supersedesRequestId: "REQ-004",
  },
  // Overdue relative to SAMPLE_AS_OF and never opened by the supplier.
  {
    id: "REQ-005",
    supplierId: "s-0005",
    period: "2024",
    categoryNumber: 1,
    status: "sent",
    dueDate: "2024-11-15",
    submittedAt: null,
    reportedEmissions: null,
    dataQuality: null,
    rejectionReasonKey: null,
    supersedesRequestId: null,
  },
  {
    id: "REQ-006",
    supplierId: "s-0001",
    period: "2024",
    categoryNumber: 4,
    status: "in_progress",
    dueDate: "2024-12-20",
    submittedAt: null,
    reportedEmissions: null,
    dataQuality: null,
    rejectionReasonKey: null,
    supersedesRequestId: null,
  },
  {
    id: "REQ-007",
    supplierId: "s-0002",
    period: "2024",
    categoryNumber: 5,
    status: "verified",
    dueDate: "2024-11-30",
    submittedAt: "2024-11-27T03:20:00.000Z",
    reportedEmissions: 412.75,
    dataQuality: 4,
    rejectionReasonKey: null,
    supersedesRequestId: null,
  },
];

/** Builds the sample payload synchronously so tests can assert without awaiting. */
export function buildSampleSuppliersOverview(year: number = SAMPLE_YEAR): SuppliersOverview {
  return {
    year,
    isSampleData: true,
    suppliers: SAMPLE_SUPPLIERS.map((supplier) => ({ ...supplier })),
    requests: SAMPLE_REQUESTS.map((request) => ({ ...request })),
  };
}

/** Active suppliers provider. Returns sample suppliers and requests. */
export const getSuppliersOverview: SuppliersProvider = async ({ year } = {}) => {
  return buildSampleSuppliersOverview(year ?? SAMPLE_YEAR);
};
