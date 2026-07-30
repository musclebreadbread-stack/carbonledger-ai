import { describe, expect, it } from "vitest";
import {
  annuityPresentValue,
  appraiseMeasure,
  buildCostCurve,
  capitalRecoveryFactor,
  compareScenarios,
  planAbatement,
  runScenario,
  type AbatementMeasure,
} from "@/lib/ai/scenario";
import { SAMPLE_ASSUMPTIONS, SAMPLE_MEASURES, SAMPLE_SCENARIOS } from "@/lib/ai/sample-data";

const assumptions = { discountRate: 0.07, carbonPriceKrw: 12_000 };

function measure(overrides: Partial<AbatementMeasure> = {}): AbatementMeasure {
  return {
    id: "m",
    nameKey: "m",
    capexKrw: 1_000_000_000,
    annualOpexDeltaKrw: 0,
    annualAbatementTco2e: 1_000,
    lifetimeYears: 10,
    scope: 1,
    ...overrides,
  };
}

describe("capitalRecoveryFactor", () => {
  it("is 1/years at a zero discount rate instead of dividing by zero", () => {
    expect(capitalRecoveryFactor(0, 10)).toBeCloseTo(0.1, 10);
  });

  it("matches the textbook annuity factor", () => {
    // 7% over 10 years -> 0.142378
    expect(capitalRecoveryFactor(0.07, 10)).toBeCloseTo(0.142378, 6);
  });

  it("is zero for a nonsensical lifetime", () => {
    expect(capitalRecoveryFactor(0.07, 0)).toBe(0);
  });
});

describe("annuityPresentValue", () => {
  it("is a plain multiple at a zero rate", () => {
    expect(annuityPresentValue(100, 0, 5)).toBe(500);
  });

  it("discounts a future stream below its nominal sum", () => {
    expect(annuityPresentValue(100, 0.07, 5)).toBeLessThan(500);
  });
});

describe("appraiseMeasure", () => {
  it("annualises capex over the lifetime rather than dividing raw capex", () => {
    const short = appraiseMeasure(measure({ lifetimeYears: 4 }), assumptions);
    const long = appraiseMeasure(measure({ lifetimeYears: 20 }), assumptions);

    // Same capex, same annual abatement, very different cost per tonne — the
    // property a naive capex/abatement division gets wrong.
    expect(short.marginalAbatementCostKrw).toBeGreaterThan(
      long.marginalAbatementCostKrw as number
    );
  });

  it("produces a negative marginal abatement cost for a measure that pays for itself", () => {
    const appraisal = appraiseMeasure(
      measure({ capexKrw: 100_000_000, annualOpexDeltaKrw: -200_000_000 }),
      assumptions
    );

    expect(appraisal.marginalAbatementCostKrw).toBeLessThan(0);
    expect(appraisal.npvKrw).toBeGreaterThan(0);
  });

  it("credits avoided carbon cost against the annual cost", () => {
    const withPrice = appraiseMeasure(measure(), assumptions);
    const withoutPrice = appraiseMeasure(measure(), { ...assumptions, carbonPriceKrw: 0 });

    expect(withPrice.netAnnualCostKrw).toBeLessThan(withoutPrice.netAnnualCostKrw);
    expect(withoutPrice.netAnnualCostKrw - withPrice.netAnnualCostKrw).toBe(12_000_000);
  });

  it("reports no payback rather than an infinite one when there is no benefit", () => {
    const appraisal = appraiseMeasure(
      measure({ annualOpexDeltaKrw: 0 }),
      { ...assumptions, carbonPriceKrw: 0 }
    );

    expect(appraisal.paybackYears).toBeNull();
  });

  it("reports a null MAC for a measure that abates nothing", () => {
    expect(
      appraiseMeasure(measure({ annualAbatementTco2e: 0 }), assumptions)
        .marginalAbatementCostKrw
    ).toBeNull();
  });

  it("multiplies abatement over the lifetime", () => {
    expect(
      appraiseMeasure(measure({ annualAbatementTco2e: 250, lifetimeYears: 8 }), assumptions)
        .lifetimeAbatementTco2e
    ).toBe(2_000);
  });
});

describe("buildCostCurve", () => {
  it("orders measures cheapest first and accumulates abatement", () => {
    const curve = buildCostCurve(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS);

    const costs = curve.map((step) => step.appraisal.marginalAbatementCostKrw as number);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));

    const cumulative = curve.map((step) => step.cumulativeAbatementTco2e);
    expect(cumulative).toEqual([...cumulative].sort((a, b) => a - b));
    expect(cumulative.at(-1)).toBeCloseTo(
      SAMPLE_MEASURES.reduce((sum, m) => sum + m.annualAbatementTco2e, 0),
      2
    );
  });

  it("drops measures that abate nothing instead of placing them on the curve", () => {
    const curve = buildCostCurve(
      [...SAMPLE_MEASURES, measure({ id: "zero", annualAbatementTco2e: 0 })],
      SAMPLE_ASSUMPTIONS
    );

    expect(curve.some((step) => step.appraisal.measure.id === "zero")).toBe(false);
  });

  it("surfaces at least one negative-cost measure in the sample portfolio", () => {
    const curve = buildCostCurve(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS);
    expect(curve[0].appraisal.marginalAbatementCostKrw).toBeLessThan(0);
  });
});

describe("planAbatement", () => {
  it("takes the cheapest measures until the target is reached", () => {
    const plan = planAbatement(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS, 1_000);

    expect(plan.targetMet).toBe(true);
    expect(plan.totalAbatementTco2e).toBeGreaterThanOrEqual(1_000);
    // Should not have bought the whole portfolio for a small target.
    expect(plan.steps.length).toBeLessThan(SAMPLE_MEASURES.length);
  });

  it("reports how far it got rather than throwing on an unreachable target", () => {
    const plan = planAbatement(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS, 1_000_000);

    expect(plan.targetMet).toBe(false);
    expect(plan.steps).toHaveLength(SAMPLE_MEASURES.length);
    expect(plan.totalAbatementTco2e).toBeGreaterThan(0);
  });

  it("selects nothing for a zero target", () => {
    const plan = planAbatement(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS, 0);

    expect(plan.steps).toEqual([]);
    expect(plan.averageCostKrw).toBeNull();
    expect(plan.targetMet).toBe(true);
  });

  it("costs no more than an arbitrary selection reaching the same abatement", () => {
    const target = 2_000;
    const plan = planAbatement(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS, target);

    // A greedy walk up the cost curve is optimal for independent measures; check
    // it against the reverse (most expensive first) ordering.
    const reverse = buildCostCurve(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS).reverse();
    let abated = 0;
    let cost = 0;
    for (const step of reverse) {
      if (abated >= target) break;
      abated += step.appraisal.measure.annualAbatementTco2e;
      cost += step.appraisal.netAnnualCostKrw;
    }

    expect(plan.totalNetAnnualCostKrw).toBeLessThanOrEqual(cost);
  });
});

describe("runScenario", () => {
  it("includes the base year unchanged and produces years + 1 points", () => {
    const result = runScenario(
      { id: "s", nameKey: "s", annualChange: -0.1 },
      { baseYear: 2024, baseEmissions: 1_000, years: 5 }
    );

    expect(result.pathway).toHaveLength(6);
    expect(result.pathway[0]).toEqual({ year: 2024, emissions: 1_000 });
    expect(result.pathway[1].emissions).toBe(900);
  });

  it("applies a step change on top of the annual trend, in the stated year only", () => {
    const withStep = runScenario(
      { id: "s", nameKey: "s", annualChange: -0.1, stepChange: -0.5, stepYear: 2026 },
      { baseYear: 2024, baseEmissions: 1_000, years: 3 }
    );
    const withoutStep = runScenario(
      { id: "s", nameKey: "s", annualChange: -0.1 },
      { baseYear: 2024, baseEmissions: 1_000, years: 3 }
    );

    expect(withStep.pathway[1].emissions).toBe(withoutStep.pathway[1].emissions);
    expect(withStep.pathway[2].emissions).toBeCloseTo(withoutStep.pathway[2].emissions / 2, 1);
  });

  it("reports cumulative emissions, which distinguishes pathways with the same endpoint", () => {
    // Both land near half the base by 2034, but one cuts hard in 2025 and then
    // coasts while the other declines steadily.
    const frontLoaded = runScenario(
      { id: "front", nameKey: "f", annualChange: -0.03, stepChange: -0.42, stepYear: 2025 },
      { baseYear: 2024, baseEmissions: 1_000, years: 10 }
    );
    const steady = runScenario(
      { id: "steady", nameKey: "s", annualChange: -0.067 },
      { baseYear: 2024, baseEmissions: 1_000, years: 10 }
    );

    expect(Math.abs(frontLoaded.endEmissions - steady.endEmissions)).toBeLessThan(120);
    // Same destination, materially different carbon budget spent getting there.
    expect(steady.cumulativeEmissions - frontLoaded.cumulativeEmissions).toBeGreaterThan(1_500);
  });

  it("never goes negative", () => {
    const result = runScenario(
      { id: "s", nameKey: "s", annualChange: -0.99 },
      { baseYear: 2024, baseEmissions: 100, years: 30 }
    );

    for (const point of result.pathway) {
      expect(point.emissions).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports a negative reduction for a growing pathway", () => {
    const result = runScenario(
      { id: "s", nameKey: "s", annualChange: 0.05 },
      { baseYear: 2024, baseEmissions: 1_000, years: 5 }
    );

    expect(result.totalReductionPercent).toBeLessThan(0);
  });

  it("returns 0% reduction rather than NaN for a zero base", () => {
    const result = runScenario(
      { id: "s", nameKey: "s", annualChange: -0.1 },
      { baseYear: 2024, baseEmissions: 0, years: 5 }
    );

    expect(result.totalReductionPercent).toBe(0);
  });
});

describe("compareScenarios", () => {
  it("ranks the sample scenarios in the expected order", () => {
    const results = compareScenarios(SAMPLE_SCENARIOS, {
      baseYear: 2024,
      baseEmissions: 12_760,
      years: 11,
    });

    const byId = new Map(results.map((result) => [result.scenario.id, result]));
    const bau = byId.get("bau");
    const accelerated = byId.get("accelerated");

    expect(bau?.totalReductionPercent).toBeLessThan(0);
    expect(accelerated?.totalReductionPercent).toBeGreaterThan(40);
  });
});
