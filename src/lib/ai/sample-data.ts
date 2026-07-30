/**
 * SAMPLE (MOCK) INPUTS FOR THE AI ANALYSES — NOT MEASURED DATA.
 *
 * Drives `/ai-insights` while there is no live database. Payloads carry
 * `isSampleData: true` and the page renders `<SampleDataNotice />` off it.
 *
 * The observation series contains three deliberately planted faults, one for each
 * deterministic detector, because an analysis page whose sample data is clean
 * shows nothing and proves nothing:
 *
 *  - `boiler_1` 2024-07: emissions roughly quadrupled for a single month → a
 *    distributional outlier.
 *  - `grid_electricity` 2024-05: activity data entered in MWh instead of kWh, so
 *    the emissions are plausible but the implied factor is ~1000× wrong → an
 *    intensity anomaly, invisible to outlier detection.
 *  - `steam_purchased`: level shifts up ~60% from 2024-07 onward and stays there
 *    → a step change, invisible to both of the above once it becomes the norm.
 *  - `company_fleet`: 2024-03 and 2024-08 are absent → period gaps.
 *  - `refrigerant_topup`: emissions with no activity data → unverifiable figure.
 *
 * Abatement measures and their costs are illustrative Korean-manufacturing
 * figures, not quotations.
 */

import type { AbatementMeasure, Scenario } from "./scenario";
import type { EmissionObservation } from "./types";

const SAMPLE_YEAR = 2024;

function period(month: number): string {
  return `${SAMPLE_YEAR}-${String(month).padStart(2, "0")}`;
}

/**
 * Builds a monthly series for one source.
 *
 * `activityPerTonne` back-derives activity data from emissions so the implied
 * factor is constant by construction — which is what makes the one deliberately
 * wrong month in `grid_electricity` stand out instead of drowning in noise.
 */
function series(
  sourceKey: string,
  scope: 1 | 2 | 3,
  monthly: readonly (number | null)[],
  options: { activityPerTonne?: number; activityUnit?: string } = {}
): EmissionObservation[] {
  const observations: EmissionObservation[] = [];
  for (const [index, emissions] of monthly.entries()) {
    // null means the month is genuinely absent, not zero.
    if (emissions === null) continue;
    observations.push({
      period: period(index + 1),
      sourceKey,
      scope,
      emissions,
      ...(options.activityPerTonne !== undefined
        ? {
            activityData: Math.round(emissions * options.activityPerTonne),
            activityUnit: options.activityUnit,
          }
        : {}),
    });
  }
  return observations;
}

/** The sample observation set, faults included. */
export function buildSampleObservations(): EmissionObservation[] {
  const observations: EmissionObservation[] = [];

  // Outlier: July is ~4x its neighbours.
  observations.push(
    ...series("boiler_1", 1, [165, 158, 149, 143, 138, 151, 640, 178, 156, 145, 152, 163], {
      activityPerTonne: 500,
      activityUnit: "m3",
    })
  );

  // Two absent months, and otherwise unremarkable.
  observations.push(
    ...series("company_fleet", 1, [78, 74, null, 71, 76, 82, 88, null, 79, 73, 77, 81], {
      activityPerTonne: 380,
      activityUnit: "L",
    })
  );

  // Intensity anomaly in 2024-05: activity data a factor of 1000 too small,
  // while the emissions figure itself is entirely plausible.
  const grid = series(
    "grid_electricity",
    2,
    [520, 495, 470, 455, 480, 530, 610, 625, 540, 470, 485, 510],
    { activityPerTonne: 2170, activityUnit: "kWh" }
  );
  const may = grid.find((observation) => observation.period === "2024-05");
  if (may && may.activityData !== undefined) {
    may.activityData = Math.round(may.activityData / 1000);
    may.activityUnit = "kWh";
  }
  observations.push(...grid);

  // Step change: settles ~60% higher from July and does not revert.
  observations.push(
    ...series("steam_purchased", 2, [110, 108, 112, 109, 111, 107, 176, 181, 178, 174, 180, 177], {
      activityPerTonne: 3100,
      activityUnit: "GJ",
    })
  );

  // Emissions with no activity data at all — unverifiable, and invisible to the
  // intensity detector by construction.
  observations.push(...series("refrigerant_topup", 1, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 89.2, 0]));

  return observations;
}

/** Illustrative abatement measures for the CAPEX and recommendation views. */
export const SAMPLE_MEASURES: readonly AbatementMeasure[] = [
  {
    id: "m-led",
    nameKey: "led_retrofit",
    capexKrw: 320_000_000,
    // Saves electricity, so the opex delta is negative.
    annualOpexDeltaKrw: -180_000_000,
    annualAbatementTco2e: 420,
    lifetimeYears: 10,
    scope: 2,
  },
  {
    id: "m-vfd",
    nameKey: "motor_vfd",
    capexKrw: 540_000_000,
    annualOpexDeltaKrw: -210_000_000,
    annualAbatementTco2e: 510,
    lifetimeYears: 12,
    scope: 2,
  },
  {
    id: "m-heat-recovery",
    nameKey: "waste_heat_recovery",
    capexKrw: 2_100_000_000,
    annualOpexDeltaKrw: -430_000_000,
    annualAbatementTco2e: 1_180,
    lifetimeYears: 15,
    scope: 1,
  },
  {
    id: "m-ppa",
    nameKey: "renewable_ppa",
    capexKrw: 0,
    // A PPA above grid tariff costs money every year but abates a great deal.
    annualOpexDeltaKrw: 620_000_000,
    annualAbatementTco2e: 3_400,
    lifetimeYears: 20,
    scope: 2,
  },
  {
    id: "m-boiler-fuel-switch",
    nameKey: "boiler_fuel_switch",
    capexKrw: 1_450_000_000,
    annualOpexDeltaKrw: 95_000_000,
    annualAbatementTco2e: 760,
    lifetimeYears: 15,
    scope: 1,
  },
  {
    id: "m-heat-pump",
    nameKey: "industrial_heat_pump",
    capexKrw: 3_800_000_000,
    annualOpexDeltaKrw: -240_000_000,
    annualAbatementTco2e: 1_520,
    lifetimeYears: 18,
    scope: 1,
  },
  {
    id: "m-supplier-engagement",
    nameKey: "supplier_engagement",
    capexKrw: 180_000_000,
    annualOpexDeltaKrw: 120_000_000,
    annualAbatementTco2e: 2_900,
    lifetimeYears: 8,
    scope: 3,
  },
];

/** Illustrative scenarios for the pathway comparison. */
export const SAMPLE_SCENARIOS: readonly Scenario[] = [
  { id: "bau", nameKey: "business_as_usual", annualChange: 0.005 },
  { id: "current", nameKey: "current_measures", annualChange: -0.031 },
  { id: "sbti", nameKey: "sbti_aligned", annualChange: -0.042 },
  {
    id: "accelerated",
    nameKey: "accelerated",
    annualChange: -0.052,
    // A PPA switching on in 2027 takes a discrete bite out of Scope 2.
    stepChange: -0.12,
    stepYear: 2027,
  },
];

/** Assumptions the CAPEX appraisal uses. Illustrative, not company policy. */
export const SAMPLE_ASSUMPTIONS = {
  discountRate: 0.07,
  /** Roughly the K-ETS allowance price used elsewhere in the sample data. */
  carbonPriceKrw: 12_000,
} as const;

/** K-ETS inputs for the carbon-cost view. */
export const SAMPLE_KETS_INPUTS = {
  verifiedEmissions: 12_760,
  freeAllocation: 10_200,
  allowancePriceKrw: 12_000,
  bankedAllowances: 350,
} as const;

/** CBAM inputs for the carbon-cost view. */
export const SAMPLE_CBAM_INPUTS = {
  embeddedEmissions: 2_480,
  euEtsPriceEur: 72,
  /** K-ETS price expressed in EUR at an illustrative rate. */
  originCarbonPriceEur: 8.3,
  phaseInFactor: 0.485,
} as const;
