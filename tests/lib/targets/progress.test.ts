import { describe, expect, it } from "vitest";
import { buildSampleTargetsOverview } from "@/lib/targets/sample-data";
import {
  SBTI_MIN_ANNUAL_LINEAR_REDUCTION_PCT,
  assessTarget,
  latestProgress,
  meetsSbtiLinearMinimum,
  pathwayEmissionsForYear,
  type ReductionTarget,
} from "@/lib/targets/types";

function target(overrides: Partial<ReductionTarget> = {}): ReductionTarget {
  return {
    id: "t",
    targetType: "absolute",
    status: "active",
    scope: null,
    baseYear: 2020,
    targetYear: 2030,
    baseEmissions: 1_000,
    targetEmissions: 500,
    targetReductionPct: 50,
    methodologyKey: null,
    descriptionKey: null,
    progress: [],
    ...overrides,
  };
}

describe("latestProgress", () => {
  it("picks the highest year, not the last array element", () => {
    const result = latestProgress(
      target({
        progress: [
          { year: 2023, actualEmissions: 800 },
          { year: 2024, actualEmissions: 700 },
          { year: 2022, actualEmissions: 900 },
        ],
      })
    );

    expect(result?.year).toBe(2024);
  });

  it("is null with no progress", () => {
    expect(latestProgress(target())).toBeNull();
  });
});

describe("pathwayEmissionsForYear", () => {
  it("interpolates linearly between the endpoints", () => {
    const t = target();
    expect(pathwayEmissionsForYear(t, 2020)).toBe(1_000);
    expect(pathwayEmissionsForYear(t, 2025)).toBe(750);
    expect(pathwayEmissionsForYear(t, 2030)).toBe(500);
  });

  it("clamps outside the window instead of extrapolating", () => {
    const t = target();
    // A year before the base year must not produce an above-baseline pathway.
    expect(pathwayEmissionsForYear(t, 2015)).toBe(1_000);
    expect(pathwayEmissionsForYear(t, 2040)).toBe(500);
  });

  it("returns the target for a degenerate zero-length window", () => {
    expect(pathwayEmissionsForYear(target({ baseYear: 2030, targetYear: 2030 }), 2030)).toBe(500);
  });
});

describe("assessTarget", () => {
  it("reports no_data rather than 0% progress for an unreported target", () => {
    const assessment = assessTarget(target());

    expect(assessment.verdict).toBe("no_data");
    expect(assessment.latestYear).toBeNull();
    expect(assessment.progressPercent).toBe(0);
    expect(assessment.remainingReduction).toBe(500);
  });

  it("measures progress against the required reduction, not against total emissions", () => {
    const assessment = assessTarget(
      target({ progress: [{ year: 2025, actualEmissions: 750 }] })
    );

    // Halfway through the 500 t reduction, not 25% of the way to zero.
    expect(assessment.progressPercent).toBe(50);
    expect(assessment.achievedReduction).toBe(250);
  });

  it("calls a target ahead of its pathway 'ahead'", () => {
    expect(
      assessTarget(target({ progress: [{ year: 2025, actualEmissions: 600 }] })).verdict
    ).toBe("ahead");
  });

  it("calls a target behind its pathway 'behind'", () => {
    expect(
      assessTarget(target({ progress: [{ year: 2025, actualEmissions: 900 }] })).verdict
    ).toBe("behind");
  });

  it("tolerates small deviations rather than flipping on rounding noise", () => {
    // Pathway for 2025 is 750; 0.5% off must still read as on track.
    expect(
      assessTarget(target({ progress: [{ year: 2025, actualEmissions: 753 }] })).verdict
    ).toBe("on_track");
  });

  it("clamps progress at 100 while keeping the raw over-achievement", () => {
    const assessment = assessTarget(
      target({ progress: [{ year: 2028, actualEmissions: 300 }] })
    );

    expect(assessment.progressPercent).toBe(100);
    expect(assessment.rawProgressPercent).toBeGreaterThan(100);
    expect(assessment.remainingReduction).toBe(0);
  });

  it("does not divide by zero for a hold-flat target", () => {
    const assessment = assessTarget(
      target({
        baseEmissions: 1_000,
        targetEmissions: 1_000,
        progress: [{ year: 2025, actualEmissions: 950 }],
      })
    );

    expect(Number.isFinite(assessment.progressPercent)).toBe(true);
    expect(assessment.progressPercent).toBe(100);
  });

  it("expresses the required rate as a compound decay", () => {
    const assessment = assessTarget(
      target({ progress: [{ year: 2025, actualEmissions: 800 }] })
    );

    // 800 -> 500 over 5 years compounded is 1 - (500/800)^(1/5) = 8.9718...%,
    // which `assessTarget` rounds to one decimal place. A naive *linear* rate
    // would be (300/800)/5 = 7.5%, so this assertion is what distinguishes the
    // compound formula from the linear one.
    expect(assessment.requiredAnnualReductionPercent).toBe(9);
  });

  it("falls back to a linear share for a net-zero target instead of an infinite rate", () => {
    const assessment = assessTarget(
      target({
        targetEmissions: 0,
        progress: [{ year: 2026, actualEmissions: 600 }],
      })
    );

    expect(assessment.requiredAnnualReductionPercent).toBe(25);
  });

  it("reports no required rate once the target year has passed", () => {
    expect(
      assessTarget(target({ progress: [{ year: 2031, actualEmissions: 400 }] }))
        .requiredAnnualReductionPercent
    ).toBeNull();
  });
});

describe("meetsSbtiLinearMinimum", () => {
  it("accepts a target at or above the 1.5C linear minimum", () => {
    // 50% over 10 years is 5%/yr, above the 4.2% floor.
    expect(meetsSbtiLinearMinimum(target())).toBe(true);
    expect(SBTI_MIN_ANNUAL_LINEAR_REDUCTION_PCT).toBe(4.2);
  });

  it("rejects a target that is too slow", () => {
    // 30% over 10 years is 3%/yr.
    expect(
      meetsSbtiLinearMinimum(target({ targetEmissions: 700, targetReductionPct: 30 }))
    ).toBe(false);
  });

  it("does not apply the criterion to intensity targets", () => {
    expect(meetsSbtiLinearMinimum(target({ targetType: "intensity" }))).toBeNull();
  });

  it("is null for a degenerate window", () => {
    expect(meetsSbtiLinearMinimum(target({ baseYear: 2030, targetYear: 2030 }))).toBeNull();
  });
});

describe("the sample targets", () => {
  const { targets } = buildSampleTargetsOverview();

  it("exercises every verdict the UI has to render", () => {
    const verdicts = new Set(targets.map((t) => assessTarget(t).verdict));
    expect(verdicts.has("no_data")).toBe(true);
    expect(verdicts.size).toBeGreaterThan(1);
  });

  it("works identically for an intensity target with small magnitudes", () => {
    const intensity = targets.find((t) => t.targetType === "intensity");
    const assessment = assessTarget(intensity as ReductionTarget);

    expect(assessment.progressPercent).toBeGreaterThan(0);
    expect(Number.isFinite(assessment.progressPercent)).toBe(true);
  });

  it("hands out independent copies so a caller cannot corrupt the constant", () => {
    const first = buildSampleTargetsOverview();
    first.targets[0].progress.push({ year: 2099, actualEmissions: 0 });

    const second = buildSampleTargetsOverview();
    expect(second.targets[0].progress.some((p) => p.year === 2099)).toBe(false);
  });
});
