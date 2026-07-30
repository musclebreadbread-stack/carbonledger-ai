/**
 * SAMPLE (MOCK) DASHBOARD DATA — NOT MEASURED EMISSIONS.
 *
 * The sandbox has no live Postgres/Supabase instance, so the dashboard is
 * driven by the hard-coded figures below. Every payload produced here carries
 * `isSampleData: true`, and the dashboard renders a visible notice off that
 * flag so the numbers are never presented as real reported data.
 *
 * The figures are internally consistent on purpose: scope totals, the scope
 * breakdown, the year-over-year change and the emission-source shares are all
 * derived from the same monthly arrays rather than being independently
 * invented. That way the charts agree with each other and with the KPI row.
 *
 * To go live, replace `getDashboardData` with a Drizzle-backed implementation
 * that satisfies the same `DashboardDataProvider` signature. Nothing else has
 * to change — see the note at the bottom of this file.
 */

import type {
  DashboardData,
  DashboardDataProvider,
  EmissionSourceRank,
  EmissionsTrendPoint,
  MonthlyComparisonPoint,
  Scope,
  ScopeBreakdownSlice,
} from "./types";

/** Reporting year the sample figures describe. */
const SAMPLE_YEAR = 2024;

/**
 * Baseline-year total used to express reduction progress, and the revenue the
 * emission intensity is divided by. Both are sample values.
 */
const SAMPLE_BASELINE_TOTAL = 19_000;
const SAMPLE_REVENUE_MILLION_KRW = 30_762;

/** Monthly tCO2e by scope for the reporting year, January first. */
const SAMPLE_MONTHLY_SCOPE1 = [380, 355, 340, 330, 320, 345, 400, 410, 360, 335, 350, 375];
const SAMPLE_MONTHLY_SCOPE2 = [520, 495, 470, 455, 480, 530, 610, 625, 540, 470, 485, 510];
const SAMPLE_MONTHLY_SCOPE3 = [190, 180, 185, 195, 200, 210, 225, 230, 205, 195, 200, 215];

/** Monthly tCO2e totals for the year before, for the comparison chart. */
const SAMPLE_MONTHLY_PREVIOUS_YEAR = [
  1180, 1120, 1080, 1060, 1110, 1230, 1350, 1385, 1200, 1090, 1120, 1175,
];

/**
 * Largest emission sources, descending. `sourceKey` resolves against the
 * `emission_sources` message namespace so the ranking stays translatable.
 *
 * These deliberately do not add up to the full annual total — the remainder is
 * the long tail of smaller sources outside the top ten, which is what a real
 * ranking query would also produce.
 */
const SAMPLE_TOP_SOURCES: { sourceKey: string; scope: Scope; emissions: number }[] = [
  { sourceKey: "grid_electricity", scope: 2, emissions: 4820 },
  { sourceKey: "boiler_1", scope: 1, emissions: 1980 },
  { sourceKey: "steam_purchased", scope: 2, emissions: 1370 },
  { sourceKey: "company_fleet", scope: 1, emissions: 940 },
  { sourceKey: "purchased_goods", scope: 3, emissions: 880 },
  { sourceKey: "boiler_2", scope: 1, emissions: 760 },
  { sourceKey: "diesel_generator", scope: 1, emissions: 620 },
  { sourceKey: "upstream_transport", scope: 3, emissions: 560 },
  { sourceKey: "hvac_system", scope: 1, emissions: 430 },
  { sourceKey: "business_travel", scope: 3, emissions: 340 },
];

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Rounds to `decimals` places, avoiding trailing floating-point noise. */
function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildTrend(): EmissionsTrendPoint[] {
  return SAMPLE_MONTHLY_SCOPE1.map((scope1, index) => ({
    period: `${SAMPLE_YEAR}-${String(index + 1).padStart(2, "0")}`,
    scope1,
    scope2: SAMPLE_MONTHLY_SCOPE2[index],
    scope3: SAMPLE_MONTHLY_SCOPE3[index],
  }));
}

function buildMonthlyComparison(): MonthlyComparisonPoint[] {
  return SAMPLE_MONTHLY_PREVIOUS_YEAR.map((previousYear, index) => ({
    month: index + 1,
    currentYear:
      SAMPLE_MONTHLY_SCOPE1[index] + SAMPLE_MONTHLY_SCOPE2[index] + SAMPLE_MONTHLY_SCOPE3[index],
    previousYear,
  }));
}

function buildScopeBreakdown(): ScopeBreakdownSlice[] {
  return [
    { scope: 1, value: sum(SAMPLE_MONTHLY_SCOPE1) },
    { scope: 2, value: sum(SAMPLE_MONTHLY_SCOPE2) },
    { scope: 3, value: sum(SAMPLE_MONTHLY_SCOPE3) },
  ];
}

function buildTopSources(total: number): EmissionSourceRank[] {
  return SAMPLE_TOP_SOURCES.map((source, index) => ({
    rank: index + 1,
    sourceKey: source.sourceKey,
    scope: source.scope,
    emissions: source.emissions,
    share: round((source.emissions / total) * 100),
  }));
}

/**
 * Builds the full sample payload. Exported synchronously as well as through
 * `getDashboardData` so tests can assert on it without awaiting.
 */
export function buildSampleDashboardData(year: number = SAMPLE_YEAR): DashboardData {
  const scope1 = sum(SAMPLE_MONTHLY_SCOPE1);
  const scope2 = sum(SAMPLE_MONTHLY_SCOPE2);
  const scope3 = sum(SAMPLE_MONTHLY_SCOPE3);
  const totalEmissions = scope1 + scope2 + scope3;
  const previousTotal = sum(SAMPLE_MONTHLY_PREVIOUS_YEAR);

  return {
    year,
    isSampleData: true,
    kpis: {
      totalEmissions,
      scope1,
      scope2,
      scope3,
      yoyChangePercent: round(((totalEmissions - previousTotal) / previousTotal) * 100),
      reductionProgressPercent: round(
        ((SAMPLE_BASELINE_TOTAL - totalEmissions) / SAMPLE_BASELINE_TOTAL) * 100
      ),
      intensityPerRevenue: round(totalEmissions / SAMPLE_REVENUE_MILLION_KRW, 2),
    },
    trend: buildTrend(),
    scopeBreakdown: buildScopeBreakdown(),
    monthlyComparison: buildMonthlyComparison(),
    topSources: buildTopSources(totalEmissions),
  };
}

/**
 * Active dashboard data provider.
 *
 * Returns sample data. A production implementation would aggregate
 * `emission_records` for the given company and year, e.g.
 *
 * ```ts
 * export const getDashboardData: DashboardDataProvider = async ({ companyId, year }) => {
 *   const rows = await db.select({ ... }).from(emissionRecords).where(...);
 *   return { year, isSampleData: false, ... };
 * };
 * ```
 *
 * Callers must keep honouring `isSampleData` so the UI notice disappears on its
 * own once real figures arrive.
 */
export const getDashboardData: DashboardDataProvider = async ({ year } = {}) => {
  return buildSampleDashboardData(year ?? SAMPLE_YEAR);
};
