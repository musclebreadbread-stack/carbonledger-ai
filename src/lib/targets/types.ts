/**
 * Typed contract for reduction-target management, served at `/targets`.
 *
 * Mirrors `reduction_targets` and `target_progress` in
 * `src/lib/db/schema/targets.ts`. Emissions are in **tCO2e**; the schema stores
 * them as `numeric(18,6)`, which Drizzle hands back as strings, so a
 * database-backed provider must run them through `Number()` first.
 *
 * The progress arithmetic in this file is pure and deterministic and is covered
 * by `tests/lib/targets/progress.test.ts`. Nothing here talks to a data source.
 */

export type TargetType = "absolute" | "intensity" | "sbti";

export type TargetStatus = "draft" | "active" | "achieved" | "missed" | "expired";

/** Scope the target covers. `null` means all scopes combined. */
export type TargetScope = 1 | 2 | 3 | null;

/** One year of measured performance against a target. */
export interface TargetProgressPoint {
  year: number;
  /**
   * Measured emissions for the year. For an intensity target this is the
   * intensity figure (tCO2e per unit of activity), not absolute emissions —
   * the target's own `baseEmissions`/`targetEmissions` use the same unit, so
   * the arithmetic stays consistent either way.
   */
  actualEmissions: number;
}

export interface ReductionTarget {
  id: string;
  targetType: TargetType;
  status: TargetStatus;
  scope: TargetScope;
  baseYear: number;
  targetYear: number;
  baseEmissions: number;
  targetEmissions: number;
  /** Headline reduction percentage as stored, e.g. 42 for a 42% cut. */
  targetReductionPct: number;
  /** Key under `targets.methodologies`, or a stored free-text methodology. */
  methodologyKey: string | null;
  /** Key under `target_descriptions`, or a stored description. */
  descriptionKey: string | null;
  progress: TargetProgressPoint[];
}

export interface TargetsOverview {
  /** Year the "current" progress figures are measured against. */
  currentYear: number;
  /** True when these are sample targets rather than approved company targets. */
  isSampleData: boolean;
  targets: ReductionTarget[];
}

export type TargetsProvider = (options?: {
  companyId?: string;
}) => Promise<TargetsOverview>;

/** Whether a target is ahead of, on, or behind its linear reduction pathway. */
export type PathwayVerdict = "ahead" | "on_track" | "behind" | "no_data";

/** Everything the UI needs to render one target's progress, all derived. */
export interface TargetAssessment {
  /** Latest year with measured data, null when there is none. */
  latestYear: number | null;
  latestEmissions: number | null;
  /**
   * Share of the required reduction already achieved, 0-100 and clamped.
   *
   * Clamping matters: an over-achieving target would otherwise report 130%
   * progress and overflow every progress bar in the UI. `rawProgressPercent`
   * keeps the unclamped value for callers that want to say "target exceeded".
   */
  progressPercent: number;
  rawProgressPercent: number;
  /** Absolute reduction achieved so far, in the target's own unit. */
  achievedReduction: number;
  /** Reduction still needed to reach the target. Never negative. */
  remainingReduction: number;
  /**
   * Where the linear pathway from base year to target year says the company
   * should be in `latestYear`. Null when there is no measured data.
   */
  pathwayEmissions: number | null;
  verdict: PathwayVerdict;
  /**
   * Annual reduction rate required from `latestYear` onward to still hit the
   * target, as a percentage of latest emissions. Null when the target year has
   * already passed or there is no data.
   */
  requiredAnnualReductionPercent: number | null;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Latest progress point by year, or null when the target has no data. */
export function latestProgress(target: ReductionTarget): TargetProgressPoint | null {
  if (target.progress.length === 0) return null;
  return target.progress.reduce((latest, point) => (point.year > latest.year ? point : latest));
}

/**
 * The linear reduction pathway value for `year`.
 *
 * Interpolates straight-line between (baseYear, baseEmissions) and
 * (targetYear, targetEmissions). Straight-line is what SBTi's own progress
 * tracking assumes, and it is the only interpolation that does not require
 * inventing an unstated decarbonisation curve.
 *
 * Years outside the target window are clamped to the endpoints rather than
 * extrapolated, so a company reporting a year before its base year does not get
 * a nonsensical above-baseline pathway.
 */
export function pathwayEmissionsForYear(target: ReductionTarget, year: number): number {
  const span = target.targetYear - target.baseYear;
  if (span <= 0) return target.targetEmissions;
  const elapsed = clamp(year - target.baseYear, 0, span);
  const fraction = elapsed / span;
  return target.baseEmissions - (target.baseEmissions - target.targetEmissions) * fraction;
}

/**
 * Derives every progress figure for one target.
 *
 * Guards two degenerate cases that a naive formula gets wrong:
 *  - `baseEmissions === targetEmissions` (a "hold flat" target) would divide by
 *    zero; progress is reported as 100% once emissions are at or below base.
 *  - a target with no measured years at all reports `no_data` rather than
 *    silently claiming 0% progress, which would look like a failing company
 *    instead of a company that has not reported yet.
 */
export function assessTarget(target: ReductionTarget): TargetAssessment {
  const latest = latestProgress(target);
  const requiredReduction = target.baseEmissions - target.targetEmissions;

  if (latest === null) {
    return {
      latestYear: null,
      latestEmissions: null,
      progressPercent: 0,
      rawProgressPercent: 0,
      achievedReduction: 0,
      remainingReduction: Math.max(0, requiredReduction),
      pathwayEmissions: null,
      verdict: "no_data",
      requiredAnnualReductionPercent: null,
    };
  }

  const achievedReduction = target.baseEmissions - latest.actualEmissions;
  const rawProgressPercent =
    requiredReduction === 0
      ? achievedReduction >= 0
        ? 100
        : 0
      : (achievedReduction / requiredReduction) * 100;

  const pathway = pathwayEmissionsForYear(target, latest.year);

  // A 1% tolerance band around the pathway avoids flipping a target between
  // "ahead" and "behind" on rounding noise.
  const tolerance = Math.abs(pathway) * 0.01;
  let verdict: PathwayVerdict;
  if (latest.actualEmissions < pathway - tolerance) {
    verdict = "ahead";
  } else if (latest.actualEmissions > pathway + tolerance) {
    verdict = "behind";
  } else {
    verdict = "on_track";
  }

  const yearsLeft = target.targetYear - latest.year;
  let requiredAnnualReductionPercent: number | null = null;
  if (yearsLeft > 0 && latest.actualEmissions > 0) {
    if (target.targetEmissions <= 0) {
      // A net-zero target cannot be expressed as a constant percentage decay;
      // report the linear share instead of an infinite rate.
      requiredAnnualReductionPercent = round(100 / yearsLeft);
    } else {
      const factor = target.targetEmissions / latest.actualEmissions;
      requiredAnnualReductionPercent = round((1 - Math.pow(factor, 1 / yearsLeft)) * 100);
    }
  }

  return {
    latestYear: latest.year,
    latestEmissions: latest.actualEmissions,
    progressPercent: round(clamp(rawProgressPercent, 0, 100)),
    rawProgressPercent: round(rawProgressPercent),
    achievedReduction: round(achievedReduction),
    remainingReduction: round(Math.max(0, latest.actualEmissions - target.targetEmissions)),
    pathwayEmissions: round(pathway),
    verdict,
    requiredAnnualReductionPercent,
  };
}

/**
 * SBTi's minimum linear annual reduction rate for a 1.5°C-aligned absolute
 * contraction target, in percent per year of base-year emissions.
 *
 * Published figure from the SBTi Corporate Near-Term Criteria; exported as a
 * named constant so the UI can explain where the threshold comes from instead of
 * hard-coding 4.2 in a comparison.
 */
export const SBTI_MIN_ANNUAL_LINEAR_REDUCTION_PCT = 4.2;

/**
 * Whether an absolute target's implied linear rate clears the SBTi 1.5°C
 * minimum. Returns null for target types the criterion does not apply to.
 */
export function meetsSbtiLinearMinimum(target: ReductionTarget): boolean | null {
  if (target.targetType === "intensity") return null;
  const span = target.targetYear - target.baseYear;
  if (span <= 0 || target.baseEmissions <= 0) return null;
  const totalReductionPct =
    ((target.baseEmissions - target.targetEmissions) / target.baseEmissions) * 100;
  return totalReductionPct / span >= SBTI_MIN_ANNUAL_LINEAR_REDUCTION_PCT;
}
