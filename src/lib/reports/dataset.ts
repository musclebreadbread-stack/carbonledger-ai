/**
 * Assembles the single input every report template reads from.
 *
 * The figures are pulled from the *same* providers the dashboard and the
 * `/scope3`, `/targets` and `/suppliers` pages render, rather than being
 * restated here. That is the point: a report that disagreed with the page the
 * user just looked at would be worse than no report. When those providers are
 * swapped for database-backed implementations, the reports follow with no change
 * to this file beyond the imports already being interface-typed.
 *
 * `isSampleData` is OR-ed across every provider, not taken from one of them: a
 * report mixing measured Scope 1-2 with sample Scope 3 is still a report that
 * must not be filed, so the disclaimer has to survive partial migration.
 */

import { getDashboardData } from "@/lib/dashboard/sample-data";
import type { DashboardData } from "@/lib/dashboard/types";
import { getScope3Overview } from "@/lib/scope3/sample-data";
import type { Scope3Overview } from "@/lib/scope3/types";
// From the store rather than the fixtures directly: `/suppliers` now records
// verifications there, and a report that ignored them would contradict the page
// the user just approved a figure on — the exact failure this file's opening
// comment is about.
import { getSuppliersOverview } from "@/lib/suppliers/store";
import type { SuppliersOverview } from "@/lib/suppliers/types";
import { getTargetsOverview } from "@/lib/targets/sample-data";
import type { TargetsOverview } from "@/lib/targets/types";

/**
 * Reporting organisation used when the caller does not name one.
 *
 * Latin-only and visibly fictional, matching the naming convention the supplier
 * sample data already uses ("Sample Components Co.").
 */
export const DEFAULT_ORGANIZATION_NAME = "Sample Manufacturing Co.";

/** Reporting year the sample providers describe. */
export const DEFAULT_REPORT_YEAR = 2024;

export interface ReportDataset {
  /** Reporting year the aggregate figures describe. */
  year: number;
  periodStart: string;
  periodEnd: string;
  organizationName: string;
  /** True when any contributing provider returned sample figures. */
  isSampleData: boolean;
  dashboard: DashboardData;
  scope3: Scope3Overview;
  targets: TargetsOverview;
  suppliers: SuppliersOverview;
}

export interface LoadDatasetOptions {
  companyId?: string;
  year?: number;
  periodStart?: string;
  periodEnd?: string;
  organizationName?: string;
}

/** Whether a string is an ISO-8601 calendar date that actually exists. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Round-tripping catches 2024-02-30, which `Date` silently rolls forward.
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * Derives the reporting year from the period.
 *
 * Uses the year of `periodEnd`, which is the convention every framework here
 * follows: a fiscal year ending 2024-03-31 is reported as FY2024, not FY2023.
 */
function yearOfPeriod(periodEnd: string): number {
  return Number(periodEnd.slice(0, 4));
}

/**
 * Loads every figure the templates need, in parallel.
 *
 * Throws on a malformed or inverted period rather than clamping: a report
 * silently covering a different window than the one requested is an audit
 * problem, and the API layer turns this into a 400.
 */
export async function loadReportDataset(options: LoadDatasetOptions = {}): Promise<ReportDataset> {
  const periodStart = options.periodStart ?? `${options.year ?? DEFAULT_REPORT_YEAR}-01-01`;
  const periodEnd = options.periodEnd ?? `${options.year ?? DEFAULT_REPORT_YEAR}-12-31`;

  if (!isIsoDate(periodStart)) {
    throw new Error(`period_start must be an ISO-8601 date (YYYY-MM-DD), got: ${periodStart}`);
  }
  if (!isIsoDate(periodEnd)) {
    throw new Error(`period_end must be an ISO-8601 date (YYYY-MM-DD), got: ${periodEnd}`);
  }
  if (periodStart > periodEnd) {
    throw new Error(`period_start ${periodStart} is after period_end ${periodEnd}`);
  }

  const year = options.year ?? yearOfPeriod(periodEnd);
  const { companyId } = options;

  const [dashboard, scope3, targets, suppliers] = await Promise.all([
    getDashboardData({ companyId, year }),
    getScope3Overview({ companyId, year }),
    getTargetsOverview({ companyId }),
    getSuppliersOverview({ companyId, year }),
  ]);

  return {
    year,
    periodStart,
    periodEnd,
    organizationName: options.organizationName ?? DEFAULT_ORGANIZATION_NAME,
    isSampleData:
      dashboard.isSampleData ||
      scope3.isSampleData ||
      targets.isSampleData ||
      suppliers.isSampleData,
    dashboard,
    scope3,
    targets,
    suppliers,
  };
}
