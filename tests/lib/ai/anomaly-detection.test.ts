/**
 * The detectors are the part of the "AI" module that has to be right, because
 * they are the part an auditor will reproduce by hand. These tests pin the
 * properties that make them trustworthy rather than merely exercising the code:
 * that a masking spike is still found, that a unit error with plausible
 * emissions is found, and that a step change is not reported four times.
 */

import { describe, expect, it } from "vitest";
import {
  MIN_OBSERVATIONS_FOR_OUTLIERS,
  detectAllAnomalies,
  detectIntensityAnomalies,
  detectOutliers,
  detectStepChanges,
  impliedFactor,
  median,
  medianAbsoluteDeviation,
  modifiedZScores,
} from "@/lib/ai/anomaly-detection";
import { buildSampleObservations } from "@/lib/ai/sample-data";
import type { EmissionObservation } from "@/lib/ai/types";

function observation(
  period: string,
  emissions: number,
  extra: Partial<EmissionObservation> = {}
): EmissionObservation {
  return { period, sourceKey: "src", scope: 1, emissions, ...extra };
}

describe("median / MAD", () => {
  it("takes the mean of the middle pair for an even sample", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("is unaffected by an extreme value, unlike the mean", () => {
    expect(median([10, 11, 12, 13, 1000])).toBe(12);
  });

  it("returns NaN for an empty sample rather than 0", () => {
    // 0 would be indistinguishable from a genuine median of zero.
    expect(median([])).toBeNaN();
    expect(medianAbsoluteDeviation([])).toBeNaN();
  });

  it("reports zero spread for a constant sample", () => {
    expect(medianAbsoluteDeviation([5, 5, 5, 5])).toBe(0);
  });
});

describe("modifiedZScores", () => {
  it("returns all zeros when the MAD is zero", () => {
    // Half the sample identical makes every deviation infinitely many MADs away;
    // flagging all of them would be noise, so the detector stays silent here.
    expect(modifiedZScores([5, 5, 5, 5, 5, 99])).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("scores a symmetric sample around zero", () => {
    const scores = modifiedZScores([8, 9, 10, 11, 12]);
    expect(scores[2]).toBeCloseTo(0, 10);
    expect(scores[0]).toBeLessThan(0);
    expect(scores[4]).toBeGreaterThan(0);
  });
});

describe("detectOutliers", () => {
  it("finds a single spike that would mask itself under a classic z-score", () => {
    const values = [100, 102, 98, 101, 99, 103, 100, 97, 102, 900, 101, 99];
    const observations = values.map((value, index) =>
      observation(`2024-${String(index + 1).padStart(2, "0")}`, value)
    );

    const { findings } = detectOutliers(observations);

    expect(findings).toHaveLength(1);
    expect(findings[0].period).toBe("2024-10");
    expect(findings[0].titleKey).toBe("outlier_high");
    expect(findings[0].severity).toBe("high");

    // The property that motivated using MAD: the ordinary z-score of this point
    // is under 3.5, so a standard-deviation detector would miss it entirely.
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    );
    expect(Math.abs((900 - mean) / sd)).toBeLessThan(3.5);
  });

  it("flags an implausibly low month as well as a high one", () => {
    const observations = [100, 102, 98, 101, 99, 103, 2, 100].map((value, index) =>
      observation(`2024-${String(index + 1).padStart(2, "0")}`, value)
    );

    const { findings } = detectOutliers(observations);
    expect(findings.map((finding) => finding.titleKey)).toContain("outlier_low");
  });

  it("skips a source with too little history rather than guessing", () => {
    const observations = Array.from({ length: MIN_OBSERVATIONS_FOR_OUTLIERS - 1 }, (_, index) =>
      observation(`2024-0${index + 1}`, index === 0 ? 5000 : 10)
    );

    expect(detectOutliers(observations).findings).toEqual([]);
  });

  it("compares each source only against itself", () => {
    // A small source and a large source pooled together would flag every month
    // of the small one; separated, neither is anomalous.
    const observations = [
      ...Array.from({ length: 8 }, (_, i) =>
        observation(`2024-0${i + 1}`, 10 + i * 0.1, { sourceKey: "small" })
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        observation(`2024-0${i + 1}`, 5000 + i, { sourceKey: "large" })
      ),
    ];

    expect(detectOutliers(observations).findings).toEqual([]);
  });
});

describe("impliedFactor", () => {
  it("is null without activity data", () => {
    expect(impliedFactor(observation("2024-01", 100))).toBeNull();
  });

  it("is null for zero activity rather than Infinity", () => {
    expect(impliedFactor(observation("2024-01", 100, { activityData: 0 }))).toBeNull();
  });

  it("divides emissions by activity", () => {
    expect(impliedFactor(observation("2024-01", 100, { activityData: 50 }))).toBe(2);
  });
});

describe("detectIntensityAnomalies", () => {
  it("catches a unit error whose emissions figure is entirely plausible", () => {
    const observations = [
      observation("2024-01", 100, { activityData: 50_000 }),
      observation("2024-02", 102, { activityData: 51_000 }),
      observation("2024-03", 98, { activityData: 49_000 }),
      // Same emissions, activity a factor of 1000 out.
      observation("2024-04", 101, { activityData: 50 }),
    ];

    const { findings } = detectIntensityAnomalies(observations);

    expect(findings).toHaveLength(1);
    expect(findings[0].period).toBe("2024-04");
    expect(findings[0].titleKey).toBe("intensity_high");

    // And confirm the point is invisible to distributional detection, which is
    // the reason this detector exists at all.
    expect(detectOutliers(observations).findings).toEqual([]);
  });

  it("ignores ordinary factor variation", () => {
    const observations = [
      observation("2024-01", 100, { activityData: 50_000 }),
      observation("2024-02", 110, { activityData: 52_000 }),
      observation("2024-03", 95, { activityData: 49_500 }),
      observation("2024-04", 105, { activityData: 51_000 }),
    ];

    expect(detectIntensityAnomalies(observations).findings).toEqual([]);
  });

  it("needs at least three factors before it forms an opinion", () => {
    const observations = [
      observation("2024-01", 100, { activityData: 50_000 }),
      observation("2024-02", 100, { activityData: 5 }),
    ];

    expect(detectIntensityAnomalies(observations).findings).toEqual([]);
  });
});

describe("detectStepChanges", () => {
  it("finds a sustained level shift", () => {
    const observations = [110, 108, 112, 109, 176, 181, 178, 174].map((value, index) =>
      observation(`2024-0${index + 1}`, value)
    );

    const { findings } = detectStepChanges(observations);

    expect(findings).toHaveLength(1);
    expect(findings[0].titleKey).toBe("step_increase");
    expect(findings[0].detail.changePercent).toBeGreaterThan(40);
  });

  it("reports one finding per source, not one per candidate split", () => {
    // A long series with a single step offers several splits that all look
    // shifted; collapsing them is what keeps one fault from becoming four rows.
    const observations = [
      100, 101, 99, 100, 102, 98, 200, 201, 199, 200, 202, 198,
    ].map((value, index) => observation(`2024-${String(index + 1).padStart(2, "0")}`, value));

    expect(detectStepChanges(observations).findings).toHaveLength(1);
  });

  it("does not treat a one-month spike as a step", () => {
    const observations = [100, 101, 99, 100, 500, 100, 101, 99].map((value, index) =>
      observation(`2024-0${index + 1}`, value)
    );

    expect(detectStepChanges(observations).findings).toEqual([]);
  });

  it("sorts by period first, so a shuffled series still works", () => {
    const ordered = [110, 108, 112, 109, 176, 181, 178, 174].map((value, index) =>
      observation(`2024-0${index + 1}`, value)
    );
    const shuffled = [...ordered].reverse();

    expect(detectStepChanges(shuffled).findings).toEqual(detectStepChanges(ordered).findings);
  });
});

describe("detectAllAnomalies over the sample data", () => {
  const { findings } = detectAllAnomalies(buildSampleObservations());

  it("finds each of the three deliberately planted faults", () => {
    expect(findings.some((f) => f.id === "outlier:boiler_1:2024-07")).toBe(true);
    expect(findings.some((f) => f.id === "intensity:grid_electricity:2024-05")).toBe(true);
    expect(findings.some((f) => f.id.startsWith("step:steam_purchased:"))).toBe(true);
  });

  it("orders findings by severity so the actionable ones come first", () => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const ranks = findings.map((finding) => rank[finding.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("gives every finding a stable unique id", () => {
    const ids = findings.map((finding) => finding.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
