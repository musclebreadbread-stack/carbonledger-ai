import { describe, expect, it } from "vitest";
import {
  detectAllMissingData,
  detectMissingActivityData,
  detectMissingScope3Categories,
  detectPeriodGaps,
  monthIndex,
  monthRange,
  periodFromMonthIndex,
} from "@/lib/ai/missing-data";
import { buildSampleObservations } from "@/lib/ai/sample-data";
import { buildSampleScope3Overview } from "@/lib/scope3/sample-data";
import type { EmissionObservation } from "@/lib/ai/types";

function observation(
  period: string,
  extra: Partial<EmissionObservation> = {}
): EmissionObservation {
  return { period, sourceKey: "src", scope: 1, emissions: 100, activityData: 50, ...extra };
}

describe("period arithmetic", () => {
  it("round-trips a period through its month index", () => {
    for (const period of ["2024-01", "2024-12", "1999-07"]) {
      expect(periodFromMonthIndex(monthIndex(period) as number)).toBe(period);
    }
  });

  it("rejects malformed and out-of-range periods", () => {
    expect(monthIndex("2024-13")).toBeNull();
    expect(monthIndex("2024-00")).toBeNull();
    expect(monthIndex("2024-1")).toBeNull();
    expect(monthIndex("not-a-period")).toBeNull();
  });

  it("spans a year boundary", () => {
    expect(monthRange("2023-11", "2024-02")).toEqual([
      "2023-11",
      "2023-12",
      "2024-01",
      "2024-02",
    ]);
  });

  it("returns nothing for an inverted range instead of looping forever", () => {
    expect(monthRange("2024-06", "2024-01")).toEqual([]);
  });
});

describe("detectPeriodGaps", () => {
  it("finds a hole inside a source's own reporting window", () => {
    const observations = ["2024-01", "2024-02", "2024-04", "2024-05"].map((p) => observation(p));

    const { findings } = detectPeriodGaps(observations);

    expect(findings).toHaveLength(1);
    expect(findings[0].detail.missingPeriods).toBe("2024-03");
  });

  it("does not invent gaps before a source started reporting", () => {
    // A source commissioned in July is not missing January to June.
    const observations = ["2024-07", "2024-08", "2024-09"].map((p) => observation(p));

    expect(detectPeriodGaps(observations).findings).toEqual([]);
  });

  it("does report those months when an expected range is supplied", () => {
    const observations = ["2024-07", "2024-08", "2024-09"].map((p) => observation(p));

    const { findings } = detectPeriodGaps(observations, {
      expectedRange: { from: "2024-01", to: "2024-12" },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].detail.missingCount).toBe(9);
    expect(findings[0].severity).toBe("high");
  });

  it("escalates severity with the size of the gap", () => {
    const oneMonth = detectPeriodGaps(
      ["2024-01", "2024-03"].map((p) => observation(p))
    ).findings[0];
    const threeMonths = detectPeriodGaps(
      ["2024-01", "2024-05"].map((p) => observation(p))
    ).findings[0];

    expect(oneMonth.severity).toBe("low");
    expect(threeMonths.severity).toBe("high");
  });

  it("truncates a very long missing list", () => {
    const { findings } = detectPeriodGaps(
      ["2020-01", "2024-01"].map((p) => observation(p))
    );

    expect(findings[0].detail.missingCount).toBe(47);
    expect(String(findings[0].detail.missingPeriods).split(", ")).toHaveLength(6);
  });
});

describe("detectMissingActivityData", () => {
  it("flags a figure that cannot be recomputed", () => {
    const { findings } = detectMissingActivityData([
      observation("2024-01"),
      { period: "2024-02", sourceKey: "src", scope: 1, emissions: 2000 },
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].period).toBe("2024-02");
    // Severity tracks how much of the footprint is unverifiable, not the count.
    expect(findings[0].severity).toBe("high");
  });

  it("treats zero activity data as missing", () => {
    const { findings } = detectMissingActivityData([observation("2024-01", { activityData: 0 })]);
    expect(findings).toHaveLength(1);
  });

  it("grades a small unverifiable figure as low severity", () => {
    const { findings } = detectMissingActivityData([
      { period: "2024-01", sourceKey: "src", scope: 1, emissions: 2 },
    ]);
    expect(findings[0].severity).toBe("low");
  });
});

describe("detectMissingScope3Categories", () => {
  const { categories } = buildSampleScope3Overview();

  it("treats an unassessed category as worse than an uncalculated one", () => {
    const { findings } = detectMissingScope3Categories(categories);

    const unassessed = findings.find((f) => f.titleKey === "scope3_not_assessed");
    const uncalculated = findings.find((f) => f.titleKey === "scope3_uncalculated");

    expect(unassessed?.severity).toBe("high");
    expect(uncalculated?.severity).toBe("medium");
  });

  it("says nothing about a category assessed as not relevant", () => {
    const { findings } = detectMissingScope3Categories(categories);
    const notRelevant = categories
      .filter((category) => category.relevance === "not_relevant")
      .map((category) => category.number);

    expect(notRelevant.length).toBeGreaterThan(0);
    for (const number of notRelevant) {
      expect(findings.some((f) => f.sourceKey === `cat${number}`)).toBe(false);
    }
  });
});

describe("detectAllMissingData over the sample data", () => {
  it("finds the planted gaps and the unverifiable figure", () => {
    const { findings } = detectAllMissingData(buildSampleObservations());

    expect(findings.some((f) => f.id === "gap:company_fleet")).toBe(true);
    expect(findings.some((f) => f.id.startsWith("no-activity:refrigerant_topup"))).toBe(true);
  });

  it("skips the Scope 3 check when no categories are supplied", () => {
    const { findings } = detectAllMissingData(buildSampleObservations());
    expect(findings.some((f) => f.titleKey.startsWith("scope3_"))).toBe(false);
  });

  it("includes the Scope 3 check when categories are supplied", () => {
    const { findings } = detectAllMissingData(buildSampleObservations(), {
      scope3Categories: buildSampleScope3Overview().categories,
    });
    expect(findings.some((f) => f.titleKey.startsWith("scope3_"))).toBe(true);
  });
});
