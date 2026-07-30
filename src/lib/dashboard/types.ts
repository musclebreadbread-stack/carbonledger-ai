/**
 * Typed contract for everything the dashboard charts render.
 *
 * Nothing in here is wired to the database yet. The sandbox has no live
 * Postgres/Supabase instance, so `src/lib/dashboard/sample-data.ts` supplies
 * hard-coded sample figures that satisfy these interfaces. When a real data
 * layer lands it only has to return the same shapes — the chart components
 * never reach for a data source themselves.
 *
 * Emission quantities are expressed in **tCO2e** (metric tonnes of CO2
 * equivalent) unless a field name says otherwise.
 */

/** GHG Protocol / ISO 14064 emission scope. */
export type Scope = 1 | 2 | 3;

/**
 * One point on the emissions trend chart.
 *
 * `period` is an ISO-8601 year-month (`YYYY-MM`) so it sorts lexicographically
 * and stays locale-neutral; the chart formats it for display.
 */
export interface EmissionsTrendPoint {
  period: string;
  scope1: number;
  scope2: number;
  scope3: number;
}

/** One slice of the scope-breakdown donut. */
export interface ScopeBreakdownSlice {
  scope: Scope;
  /** Absolute emissions attributed to this scope. */
  value: number;
}

/**
 * One month of the year-over-year comparison chart.
 *
 * `month` is 1-based (1 = January) so it maps directly onto the `months`
 * message namespace without any date parsing.
 */
export interface MonthlyComparisonPoint {
  month: number;
  currentYear: number;
  previousYear: number;
}

/** One row of the "top emission sources" ranking. */
export interface EmissionSourceRank {
  /** 1-based rank, already sorted ascending by the provider. */
  rank: number;
  /**
   * Key under the `emission_sources` message namespace. Kept as a key rather
   * than a display string so the ranking stays translatable; a database-backed
   * implementation would return the stored source name instead and callers
   * should fall back to `sourceName` when the key is absent.
   */
  sourceKey: string;
  scope: Scope;
  emissions: number;
  /** Percentage of total emissions, 0-100. */
  share: number;
}

/** Headline figures rendered by the KPI row above the charts. */
export interface DashboardKpis {
  totalEmissions: number;
  scope1: number;
  scope2: number;
  scope3: number;
  /** Percent change against the same period last year (negative = reduction). */
  yoyChangePercent: number;
  /** Progress towards the active reduction target, 0-100. */
  reductionProgressPercent: number;
  /** tCO2e per million KRW of revenue. */
  intensityPerRevenue: number;
}

/** Everything the dashboard page needs in a single payload. */
export interface DashboardData {
  /** Reporting year the figures describe. */
  year: number;
  /**
   * True when the payload is sample/mock data rather than measured emissions.
   * The dashboard renders a visible notice when this is set so the numbers are
   * never mistaken for real reported data.
   */
  isSampleData: boolean;
  kpis: DashboardKpis;
  trend: EmissionsTrendPoint[];
  scopeBreakdown: ScopeBreakdownSlice[];
  monthlyComparison: MonthlyComparisonPoint[];
  topSources: EmissionSourceRank[];
}

/**
 * The single seam a real implementation has to fill.
 *
 * A database-backed version would accept a company id and reporting year and
 * run the aggregate queries; the sample provider ignores both.
 */
export type DashboardDataProvider = (options?: {
  companyId?: string;
  year?: number;
}) => Promise<DashboardData>;
