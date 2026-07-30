/**
 * SAMPLE (MOCK) SCOPE 3 FIGURES — NOT REPORTED EMISSIONS.
 *
 * No live Postgres/Supabase instance exists in this sandbox, so the `/scope3`
 * page is driven by the table below. Every payload carries `isSampleData: true`
 * and the page renders `<SampleDataNotice />` off that flag.
 *
 * The shape of the sample is deliberately realistic for a Korean manufacturer:
 * category 1 (purchased goods) dominates, several categories are genuinely not
 * relevant, and three relevant categories are still uncalculated. A sample where
 * all 15 categories are neatly filled in would hide exactly the incompleteness
 * the page exists to surface.
 *
 * To go live, replace `getScope3Overview` with a Drizzle-backed implementation
 * satisfying `Scope3Provider`, aggregating `scope3_records.co2e_kg` and
 * `supplier_emissions.co2e_kg` by `category_number` (remember: the columns are kg
 * and this contract is tonnes — use `kgToTonnes`).
 */

import type {
  CategoryRelevance,
  DataQualityScore,
  Scope3CategoryNumber,
  Scope3CategoryStatus,
  Scope3Method,
  Scope3Overview,
  Scope3Provider,
} from "./types";
import { SCOPE3_CATEGORIES } from "./categories";

const SAMPLE_YEAR = 2024;

interface SampleRow {
  number: Scope3CategoryNumber;
  relevance: CategoryRelevance;
  emissions: number | null;
  method: Scope3Method | null;
  dataQuality: DataQualityScore | null;
  supplierCount: number;
  exclusionReasonKey: string | null;
}

const SAMPLE_ROWS: readonly SampleRow[] = [
  {
    number: 1,
    relevance: "relevant",
    emissions: 41_820,
    method: "hybrid",
    dataQuality: 4,
    supplierCount: 38,
    exclusionReasonKey: null,
  },
  {
    number: 2,
    relevance: "relevant",
    emissions: 6_450,
    method: "spend_based",
    dataQuality: 2,
    supplierCount: 5,
    exclusionReasonKey: null,
  },
  {
    number: 3,
    relevance: "relevant",
    emissions: 1_980,
    method: "average_data",
    dataQuality: 4,
    supplierCount: 0,
    exclusionReasonKey: null,
  },
  {
    number: 4,
    relevance: "relevant",
    emissions: 3_240,
    method: "distance_based",
    dataQuality: 3,
    supplierCount: 12,
    exclusionReasonKey: null,
  },
  {
    number: 5,
    relevance: "relevant",
    emissions: 720,
    method: "waste_type_specific",
    dataQuality: 4,
    supplierCount: 3,
    exclusionReasonKey: null,
  },
  {
    number: 6,
    relevance: "relevant",
    emissions: 340,
    method: "distance_based",
    dataQuality: 5,
    supplierCount: 0,
    exclusionReasonKey: null,
  },
  {
    number: 7,
    relevance: "relevant",
    emissions: 510,
    method: "average_data",
    dataQuality: 3,
    supplierCount: 0,
    exclusionReasonKey: null,
  },
  // Relevant but not yet calculated — leased upstream assets are still being
  // inventoried. Null, not zero.
  {
    number: 8,
    relevance: "relevant",
    emissions: null,
    method: null,
    dataQuality: null,
    supplierCount: 0,
    exclusionReasonKey: null,
  },
  {
    number: 9,
    relevance: "relevant",
    emissions: 2_180,
    method: "distance_based",
    dataQuality: 3,
    supplierCount: 7,
    exclusionReasonKey: null,
  },
  {
    number: 10,
    relevance: "relevant",
    emissions: 8_930,
    method: "average_data",
    dataQuality: 2,
    supplierCount: 0,
    exclusionReasonKey: null,
  },
  {
    number: 11,
    relevance: "relevant",
    emissions: null,
    method: null,
    dataQuality: null,
    supplierCount: 0,
    exclusionReasonKey: null,
  },
  {
    number: 12,
    relevance: "relevant",
    emissions: 1_140,
    method: "waste_type_specific",
    dataQuality: 3,
    supplierCount: 0,
    exclusionReasonKey: null,
  },
  {
    number: 13,
    relevance: "not_relevant",
    emissions: null,
    method: null,
    dataQuality: null,
    supplierCount: 0,
    exclusionReasonKey: "no_downstream_leases",
  },
  {
    number: 14,
    relevance: "not_relevant",
    emissions: null,
    method: null,
    dataQuality: null,
    supplierCount: 0,
    exclusionReasonKey: "no_franchises",
  },
  {
    number: 15,
    relevance: "not_assessed",
    emissions: null,
    method: null,
    dataQuality: null,
    supplierCount: 0,
    exclusionReasonKey: null,
  },
];

/** Builds the sample payload synchronously so tests can assert without awaiting. */
export function buildSampleScope3Overview(year: number = SAMPLE_YEAR): Scope3Overview {
  // Iterate the canonical category list rather than the sample rows so a
  // forgotten row surfaces as a loud error instead of a quietly short table.
  const categories: Scope3CategoryStatus[] = SCOPE3_CATEGORIES.map((definition) => {
    const row = SAMPLE_ROWS.find((candidate) => candidate.number === definition.number);
    if (!row) {
      throw new Error(`Sample Scope 3 data is missing category ${definition.number}`);
    }
    return {
      number: row.number,
      relevance: row.relevance,
      emissions: row.emissions,
      method: row.method,
      dataQuality: row.dataQuality,
      supplierCount: row.supplierCount,
      exclusionReasonKey: row.exclusionReasonKey,
    };
  });

  return { year, isSampleData: true, categories };
}

/** Active Scope 3 provider. Returns sample figures. */
export const getScope3Overview: Scope3Provider = async ({ year } = {}) => {
  return buildSampleScope3Overview(year ?? SAMPLE_YEAR);
};
