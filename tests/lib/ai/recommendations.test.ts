/**
 * Only the deterministic half is tested here: the ranking and the reason
 * assignment. `draftRecommendationNarrative`'s fallback path is asserted (it runs
 * with no API key, which is the sandbox condition), but its OpenAI path is NOT
 * verified — no key exists here.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { draftRecommendationNarrative, recommendMeasures } from "@/lib/ai/recommendations";
import { SAMPLE_ASSUMPTIONS, SAMPLE_MEASURES } from "@/lib/ai/sample-data";
import type { AbatementMeasure } from "@/lib/ai/scenario";

describe("recommendMeasures", () => {
  const recommendations = recommendMeasures(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS);

  it("ranks every measure that abates something, cheapest first", () => {
    expect(recommendations).toHaveLength(SAMPLE_MEASURES.length);
    expect(recommendations.map((item) => item.rank)).toEqual(
      SAMPLE_MEASURES.map((_, index) => index + 1)
    );

    const costs = recommendations.map((item) => item.marginalAbatementCostKrw);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });

  it("marks the whole ranking as deterministic, not model output", () => {
    for (const item of recommendations) {
      expect(item.source).toBe("deterministic");
    }
  });

  it("labels a self-funding measure as negative-cost", () => {
    expect(recommendations[0].marginalAbatementCostKrw).toBeLessThan(0);
    expect(recommendations[0].reasonKey).toBe("negative_cost");
  });

  it("gives every recommendation a reason", () => {
    for (const item of recommendations) {
      expect(["negative_cost", "fast_payback", "large_abatement", "cost_effective"]).toContain(
        item.reasonKey
      );
    }
  });

  it("prefers 'large_abatement' over 'cost_effective' for a dominant measure", () => {
    const measures: AbatementMeasure[] = [
      {
        id: "big",
        nameKey: "big",
        capexKrw: 10_000_000_000,
        annualOpexDeltaKrw: 500_000_000,
        annualAbatementTco2e: 9_000,
        lifetimeYears: 15,
        scope: 1,
      },
      {
        id: "small",
        nameKey: "small",
        capexKrw: 100_000_000,
        annualOpexDeltaKrw: 50_000_000,
        annualAbatementTco2e: 100,
        lifetimeYears: 15,
        scope: 2,
      },
    ];

    const result = recommendMeasures(measures, { discountRate: 0.07, carbonPriceKrw: 0 });
    expect(result.find((item) => item.id === "big")?.reasonKey).toBe("large_abatement");
  });

  it("honours the limit", () => {
    expect(recommendMeasures(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS, { limit: 3 })).toHaveLength(3);
  });

  it("returns nothing for an empty portfolio instead of throwing", () => {
    expect(recommendMeasures([], SAMPLE_ASSUMPTIONS)).toEqual([]);
  });
});

describe("draftRecommendationNarrative without an API key", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("still produces a useful summary, marked as a fallback", async () => {
    const recommendations = recommendMeasures(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS);
    const result = await draftRecommendationNarrative(recommendations, []);

    expect(result.source).toBe("fallback");
    expect(result.text).toContain("negative marginal abatement cost");
    // States the deterministic conclusion rather than only apologising.
    expect(result.text).toMatch(/\d+ measures were ranked/);
  });

  it("mentions outstanding findings when there are any", async () => {
    const recommendations = recommendMeasures(SAMPLE_MEASURES, SAMPLE_ASSUMPTIONS);
    const result = await draftRecommendationNarrative(recommendations, [
      {
        id: "f1",
        titleKey: "outlier_high",
        severity: "high",
        source: "deterministic",
        period: "2024-07",
        sourceKey: "boiler_1",
        detail: {},
      },
    ]);

    expect(result.text).toContain("1 data-quality findings");
  });

  it("never throws when the portfolio is empty", async () => {
    const result = await draftRecommendationNarrative([], []);
    expect(result.source).toBe("fallback");
    expect(result.text.length).toBeGreaterThan(0);
  });
});
