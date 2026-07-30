/**
 * SAMPLE (MOCK) REDUCTION TARGETS — NOT APPROVED COMPANY TARGETS.
 *
 * Drives `/targets` while there is no live database. Payloads carry
 * `isSampleData: true` and the page renders `<SampleDataNotice />` off it.
 *
 * The four sample targets are chosen to exercise every state the UI has to
 * render rather than to flatter the company: one absolute target running ahead
 * of its pathway, one SBTi net-zero target that is behind, one intensity target,
 * and one draft target with no measured progress at all.
 *
 * To go live, replace `getTargetsOverview` with a Drizzle-backed implementation
 * satisfying `TargetsProvider`: select from `reduction_targets` and left-join
 * `target_progress`, converting the `numeric` columns with `Number()`.
 */

import type { ReductionTarget, TargetsOverview, TargetsProvider } from "./types";

const SAMPLE_CURRENT_YEAR = 2024;

const SAMPLE_TARGETS: readonly ReductionTarget[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    targetType: "absolute",
    status: "active",
    scope: null,
    baseYear: 2018,
    targetYear: 2030,
    baseEmissions: 19_000,
    targetEmissions: 9_500,
    targetReductionPct: 50,
    methodologyKey: "ghg_protocol",
    descriptionKey: "absolute_2030",
    progress: [
      { year: 2019, actualEmissions: 18_420 },
      { year: 2020, actualEmissions: 16_980 },
      { year: 2021, actualEmissions: 16_240 },
      { year: 2022, actualEmissions: 15_100 },
      { year: 2023, actualEmissions: 13_760 },
      { year: 2024, actualEmissions: 12_760 },
    ],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    targetType: "sbti",
    status: "active",
    // Scope 1+2 in the schema is expressed by picking the dominant scope; the
    // sample uses Scope 2 because grid electricity is the largest single lever.
    scope: 2,
    baseYear: 2020,
    targetYear: 2035,
    baseEmissions: 7_400,
    targetEmissions: 0,
    targetReductionPct: 100,
    methodologyKey: "sbti_1_5c",
    descriptionKey: "sbti_net_zero",
    progress: [
      { year: 2021, actualEmissions: 7_150 },
      { year: 2022, actualEmissions: 6_980 },
      { year: 2023, actualEmissions: 6_640 },
      { year: 2024, actualEmissions: 6_190 },
    ],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    targetType: "intensity",
    status: "active",
    scope: null,
    baseYear: 2019,
    targetYear: 2030,
    // Intensity targets are in tCO2e per million KRW of revenue, so the figures
    // are small — the same arithmetic applies regardless of unit.
    baseEmissions: 0.62,
    targetEmissions: 0.31,
    targetReductionPct: 50,
    methodologyKey: "revenue_intensity",
    descriptionKey: "intensity_2030",
    progress: [
      { year: 2020, actualEmissions: 0.58 },
      { year: 2021, actualEmissions: 0.55 },
      { year: 2022, actualEmissions: 0.5 },
      { year: 2023, actualEmissions: 0.45 },
      { year: 2024, actualEmissions: 0.41 },
    ],
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    targetType: "absolute",
    status: "draft",
    scope: 3,
    baseYear: 2024,
    targetYear: 2032,
    baseEmissions: 67_310,
    targetEmissions: 47_120,
    targetReductionPct: 30,
    methodologyKey: "ghg_protocol",
    descriptionKey: "scope3_draft",
    progress: [],
  },
];

/** Builds the sample payload synchronously so tests can assert without awaiting. */
export function buildSampleTargetsOverview(currentYear: number = SAMPLE_CURRENT_YEAR): TargetsOverview {
  return {
    currentYear,
    isSampleData: true,
    // Deep-copied so a caller mutating a progress array cannot corrupt the
    // module-level constant for every subsequent request.
    targets: SAMPLE_TARGETS.map((target) => ({
      ...target,
      progress: target.progress.map((point) => ({ ...point })),
    })),
  };
}

/** Active targets provider. Returns sample targets. */
export const getTargetsOverview: TargetsProvider = async () => {
  return buildSampleTargetsOverview();
};
