import { describe, expect, it } from "vitest";
import {
  calculateCbamCost,
  calculateKetsCost,
  impliedInternalCarbonPriceKrw,
  projectCarbonCost,
  totalProjectedCostKrw,
} from "@/lib/ai/carbon-cost";

describe("calculateKetsCost", () => {
  it("charges only for the shortfall, not for total emissions", () => {
    const result = calculateKetsCost({
      verifiedEmissions: 12_000,
      freeAllocation: 10_000,
      allowancePriceKrw: 12_000,
    });

    expect(result.shortfall).toBe(2_000);
    expect(result.purchaseCostKrw).toBe(24_000_000);
    // The naive "emissions x price" answer, which this must not produce.
    expect(result.purchaseCostKrw).not.toBe(12_000 * 12_000);
  });

  it("consumes banked allowances before buying any", () => {
    const result = calculateKetsCost({
      verifiedEmissions: 12_000,
      freeAllocation: 10_000,
      allowancePriceKrw: 12_000,
      bankedAllowances: 1_500,
    });

    expect(result.shortfall).toBe(500);
    expect(result.purchaseCostKrw).toBe(6_000_000);
  });

  it("reports a surplus without netting it against cost", () => {
    const result = calculateKetsCost({
      verifiedEmissions: 8_000,
      freeAllocation: 10_000,
      allowancePriceKrw: 12_000,
    });

    expect(result.shortfall).toBe(0);
    expect(result.purchaseCostKrw).toBe(0);
    expect(result.surplus).toBe(2_000);
    // Surplus is an option to sell, never a negative cost.
    expect(result.surplusValueKrw).toBe(24_000_000);
  });

  it("is exactly balanced when allocation equals emissions", () => {
    const result = calculateKetsCost({
      verifiedEmissions: 10_000,
      freeAllocation: 10_000,
      allowancePriceKrw: 12_000,
    });

    expect(result.shortfall).toBe(0);
    expect(result.surplus).toBe(0);
  });
});

describe("calculateCbamCost", () => {
  it("deducts the carbon price already paid at origin", () => {
    const result = calculateCbamCost({
      embeddedEmissions: 1_000,
      euEtsPriceEur: 80,
      originCarbonPriceEur: 10,
    });

    expect(result.netPriceEur).toBe(70);
    expect(result.grossChargeEur).toBe(70_000);
    // No phase-in supplied means the full charge, never a discounted one.
    expect(result.payableChargeEur).toBe(70_000);
  });

  it("does not refund an origin price above the EU price", () => {
    const result = calculateCbamCost({
      embeddedEmissions: 1_000,
      euEtsPriceEur: 50,
      originCarbonPriceEur: 90,
    });

    expect(result.netPriceEur).toBe(0);
    expect(result.payableChargeEur).toBe(0);
  });

  it("applies the phase-in factor to the payable charge only", () => {
    const result = calculateCbamCost({
      embeddedEmissions: 1_000,
      euEtsPriceEur: 80,
      originCarbonPriceEur: 0,
      phaseInFactor: 0.25,
    });

    expect(result.grossChargeEur).toBe(80_000);
    expect(result.payableChargeEur).toBe(20_000);
  });

  it("clamps an out-of-range phase-in factor", () => {
    expect(
      calculateCbamCost({
        embeddedEmissions: 100,
        euEtsPriceEur: 80,
        originCarbonPriceEur: 0,
        phaseInFactor: 4,
      }).payableChargeEur
    ).toBe(8_000);
  });
});

describe("projectCarbonCost", () => {
  it("compounds emissions, allocation and price independently", () => {
    const projection = projectCarbonCost({
      startYear: 2025,
      years: 3,
      baseEmissions: 10_000,
      emissionsTrend: -0.1,
      baseFreeAllocation: 9_000,
      allocationTrend: -0.2,
      basePriceKrw: 10_000,
      priceTrend: 0.1,
    });

    expect(projection).toHaveLength(3);
    expect(projection[0]).toMatchObject({ year: 2025, emissions: 10_000, freeAllocation: 9_000 });
    expect(projection[1].emissions).toBe(9_000);
    expect(projection[1].freeAllocation).toBe(7_200);
    expect(projection[1].priceKrw).toBe(11_000);
  });

  it("shows cost rising even while emissions fall, when allocation tightens faster", () => {
    // The whole reason the three drivers are modelled separately: collapsing
    // them into one growth rate hides this.
    const projection = projectCarbonCost({
      startYear: 2025,
      years: 5,
      baseEmissions: 10_000,
      emissionsTrend: -0.05,
      baseFreeAllocation: 9_500,
      allocationTrend: -0.15,
      basePriceKrw: 10_000,
      priceTrend: 0.08,
    });

    expect(projection[4].emissions).toBeLessThan(projection[0].emissions);
    expect(projection[4].costKrw).toBeGreaterThan(projection[0].costKrw);
  });

  it("never produces a negative shortfall or a negative price", () => {
    const projection = projectCarbonCost({
      startYear: 2025,
      years: 4,
      baseEmissions: 1_000,
      emissionsTrend: -0.9,
      baseFreeAllocation: 5_000,
      allocationTrend: 0,
      basePriceKrw: 10_000,
      priceTrend: -0.9,
    });

    for (const year of projection) {
      expect(year.shortfall).toBeGreaterThanOrEqual(0);
      expect(year.priceKrw).toBeGreaterThanOrEqual(0);
      expect(year.costKrw).toBe(0);
    }
  });

  it("returns nothing for a zero- or negative-length horizon", () => {
    const base = {
      startYear: 2025,
      baseEmissions: 1_000,
      emissionsTrend: 0,
      baseFreeAllocation: 0,
      allocationTrend: 0,
      basePriceKrw: 10_000,
      priceTrend: 0,
    };
    expect(projectCarbonCost({ ...base, years: 0 })).toEqual([]);
    expect(projectCarbonCost({ ...base, years: -3 })).toEqual([]);
  });

  it("totals the projection", () => {
    const projection = projectCarbonCost({
      startYear: 2025,
      years: 2,
      baseEmissions: 2_000,
      emissionsTrend: 0,
      baseFreeAllocation: 1_000,
      allocationTrend: 0,
      basePriceKrw: 10_000,
      priceTrend: 0,
    });

    expect(totalProjectedCostKrw(projection)).toBe(20_000_000);
  });
});

describe("impliedInternalCarbonPriceKrw", () => {
  it("divides spend by tonnes abated", () => {
    expect(impliedInternalCarbonPriceKrw(100_000_000, 5_000)).toBe(20_000);
  });

  it("is null for zero abatement rather than Infinity", () => {
    expect(impliedInternalCarbonPriceKrw(100_000_000, 0)).toBeNull();
    expect(impliedInternalCarbonPriceKrw(100_000_000, -5)).toBeNull();
  });
});
