/**
 * Typed contract for the Scope 3 (value chain) view served at `/scope3`.
 *
 * Mirrors the columns on `scope3_categories`, `scope3_records` and
 * `supplier_emissions` in `src/lib/db/schema/scope3.ts`. The 15 categories
 * themselves are not sample data — they are fixed by the GHG Protocol Corporate
 * Value Chain (Scope 3) Standard and live in `./categories.ts`. Only the
 * emission figures are sampled, in `./sample-data.ts`.
 *
 * Emission quantities are in **tCO2e** unless a field name says otherwise. The
 * database stores kg (`co2e_kg`), so a database-backed provider has to divide by
 * 1000 — see `kgToTonnes` below.
 */

/** GHG Protocol Scope 3 category number. */
export type Scope3CategoryNumber =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15;

/**
 * Where the category sits in the value chain. The GHG Protocol splits the 15
 * categories into 8 upstream (1-8) and 7 downstream (9-15).
 */
export type ValueChainSide = "upstream" | "downstream";

/**
 * Calculation method allowed for a category, in GHG Protocol terminology.
 *
 * `supplier_specific` is the highest-quality method and `spend_based` the
 * lowest; the ordering matters because the UI nudges towards better methods.
 */
export type Scope3Method =
  | "supplier_specific"
  | "hybrid"
  | "average_data"
  | "spend_based"
  | "distance_based"
  | "fuel_based"
  | "waste_type_specific"
  | "asset_specific";

/** Static definition of one of the 15 categories. */
export interface Scope3CategoryDefinition {
  number: Scope3CategoryNumber;
  side: ValueChainSide;
  /**
   * Key under the `scope3_categories` message namespace. Category names are
   * fixed by the standard but still need translating, so they are addressed by
   * key rather than stored as display strings.
   */
  nameKey: string;
  /** Key under `scope3_category_descriptions`. */
  descriptionKey: string;
  /** Methods the standard permits, best first. */
  methods: Scope3Method[];
}

/**
 * Whether a category has been assessed as relevant to the reporting company.
 *
 * The GHG Protocol requires companies to disclose which categories they judged
 * not relevant and why, so "not relevant" is a first-class state rather than the
 * absence of data. `not_assessed` is the honest third option and is what makes
 * an inventory visibly incomplete.
 */
export type CategoryRelevance = "relevant" | "not_relevant" | "not_assessed";

/** Data quality, 1 (poor) to 5 (excellent), matching `data_quality_score`. */
export type DataQualityScore = 1 | 2 | 3 | 4 | 5;

/** One category as the `/scope3` page renders it. */
export interface Scope3CategoryStatus {
  number: Scope3CategoryNumber;
  relevance: CategoryRelevance;
  /**
   * Emissions attributed to the category in tCO2e. Null when the category is
   * relevant but has not been calculated yet — which is materially different
   * from zero and must not be rendered as "0".
   */
  emissions: number | null;
  /** Method actually used, null when nothing has been calculated. */
  method: Scope3Method | null;
  dataQuality: DataQualityScore | null;
  /** Number of suppliers contributing primary data to this category. */
  supplierCount: number;
  /** Key under `scope3_exclusion_reasons`, set when `not_relevant`. */
  exclusionReasonKey: string | null;
}

export interface Scope3Overview {
  year: number;
  /** True when the emission figures are sample rather than reported values. */
  isSampleData: boolean;
  categories: Scope3CategoryStatus[];
}

export type Scope3Provider = (options?: {
  companyId?: string;
  year?: number;
}) => Promise<Scope3Overview>;

/** Converts the database's `co2e_kg` (a `numeric`, so a string) to tCO2e. */
export function kgToTonnes(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed / 1000 : null;
}

/** Total of every calculated category. Categories with null emissions are skipped. */
export function totalScope3(categories: readonly Scope3CategoryStatus[]): number {
  return categories.reduce((sum, category) => sum + (category.emissions ?? 0), 0);
}

/**
 * Coverage of the inventory: how many relevant categories actually have a
 * number attached, as a percentage of relevant categories.
 *
 * Returns 0 rather than NaN when nothing has been assessed as relevant — a
 * fresh inventory has 0% coverage, not undefined coverage.
 */
export function calculatedCoveragePercent(categories: readonly Scope3CategoryStatus[]): number {
  const relevant = categories.filter((category) => category.relevance === "relevant");
  if (relevant.length === 0) return 0;
  const calculated = relevant.filter((category) => category.emissions !== null).length;
  return Math.round((calculated / relevant.length) * 100);
}

/**
 * Weighted average data quality across categories that carry both a score and
 * emissions, weighted by emissions.
 *
 * Weighting by emissions rather than taking a plain mean is deliberate: a
 * poorly-estimated category worth 60% of the footprint should drag the score
 * down far harder than a well-measured rounding error.
 *
 * Returns null when no category has both, because an unweighted guess would be
 * more misleading than admitting there is nothing to average.
 */
export function weightedDataQuality(categories: readonly Scope3CategoryStatus[]): number | null {
  let weight = 0;
  let weighted = 0;
  for (const category of categories) {
    if (category.dataQuality === null || category.emissions === null) continue;
    if (category.emissions <= 0) continue;
    weight += category.emissions;
    weighted += category.emissions * category.dataQuality;
  }
  if (weight === 0) return null;
  return Math.round((weighted / weight) * 10) / 10;
}
