/**
 * Deterministic outlier and abnormal-emission detection (이상치 탐지 / 비정상 배출량 탐지).
 *
 * No API key, no model call — this is statistics, and it is the part of the AI
 * module an auditor can reproduce. Covered by
 * `tests/lib/ai/anomaly-detection.test.ts`.
 *
 * Three independent detectors, because they catch genuinely different faults:
 *
 *  1. `detectOutliers` — a value far from its own source's historical
 *     distribution. Uses the **median absolute deviation**, not the standard
 *     deviation. A classic z-score is computed from a mean and SD that the
 *     outlier itself inflates, so a single huge spike raises the threshold
 *     enough to hide itself (masking). MAD is not affected by up to half the
 *     points being contaminated, which is exactly the regime a data-entry typo
 *     lives in.
 *  2. `detectIntensityAnomalies` — a value that is plausible in absolute terms
 *     but implies an impossible emission factor once divided by its activity
 *     data. This catches unit errors (litres entered as kilolitres) that
 *     distribution-based detection cannot see, because the wrong value may sit
 *     comfortably inside a noisy history.
 *  3. `detectStepChanges` — a sustained level shift rather than a spike. A plant
 *     that quietly doubles its baseline never trips an outlier test once the new
 *     level becomes the norm, but it is the single most material error type in an
 *     annual inventory.
 */

import type { DetectionResult, EmissionObservation, Finding, Severity } from "./types";

/** Sorted copy. Kept private; every quantile helper below assumes sortedness. */
function sorted(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Median of a numeric sample.
 *
 * Exported because the intensity and step-change detectors both need it and a
 * second copy would be a place for the two to disagree.
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const list = sorted(values);
  const middle = Math.floor(list.length / 2);
  return list.length % 2 === 0 ? (list[middle - 1] + list[middle]) / 2 : list[middle];
}

/**
 * Median absolute deviation, scaled to be comparable with a standard deviation.
 *
 * The 1.4826 factor makes MAD a consistent estimator of σ for normally
 * distributed data, so the modified z-scores below can be read against the same
 * intuition as ordinary z-scores (3 is far, 5 is very far).
 */
export function medianAbsoluteDeviation(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const centre = median(values);
  const deviations = values.map((value) => Math.abs(value - centre));
  return median(deviations) * 1.4826;
}

/**
 * Modified z-score of each value against its own sample.
 *
 * Returns zeros when the MAD is zero. That happens when more than half the
 * sample is identical — a constant meter reading, say — and in that case *any*
 * deviation is infinitely many MADs away. Reporting Infinity would flag every
 * single non-constant month as a critical anomaly, which is noise, not signal.
 * The zero-MAD case is handled by `detectStepChanges` instead, which is the
 * detector that can actually say something useful about it.
 */
export function modifiedZScores(values: readonly number[]): number[] {
  const centre = median(values);
  const scale = medianAbsoluteDeviation(values);
  if (!Number.isFinite(scale) || scale === 0) {
    return values.map(() => 0);
  }
  return values.map((value) => (value - centre) / scale);
}

/** Threshold above which a modified z-score counts as an outlier. */
export const OUTLIER_Z_THRESHOLD = 3.5;

/** Minimum history before outlier detection is meaningful. */
export const MIN_OBSERVATIONS_FOR_OUTLIERS = 6;

function severityFromZ(z: number): Severity {
  const magnitude = Math.abs(z);
  if (magnitude >= 6) return "high";
  if (magnitude >= 4.5) return "medium";
  return "low";
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Groups observations by source, preserving the input order within each group. */
function groupBySource(
  observations: readonly EmissionObservation[]
): Map<string, EmissionObservation[]> {
  const groups = new Map<string, EmissionObservation[]>();
  for (const observation of observations) {
    const existing = groups.get(observation.sourceKey);
    if (existing) existing.push(observation);
    else groups.set(observation.sourceKey, [observation]);
  }
  return groups;
}

/**
 * Flags observations whose value is far from their own source's distribution.
 *
 * Compares each source only against itself: a boiler and a data centre have
 * legitimately different magnitudes, and pooling them would flag the smaller
 * source's every month as low.
 *
 * Sources with fewer than `MIN_OBSERVATIONS_FOR_OUTLIERS` points are skipped
 * rather than tested against a two-point "distribution", which would produce
 * confident nonsense.
 */
export function detectOutliers(
  observations: readonly EmissionObservation[],
  options: { threshold?: number } = {}
): DetectionResult {
  const threshold = options.threshold ?? OUTLIER_Z_THRESHOLD;
  const findings: Finding[] = [];

  for (const [sourceKey, group] of groupBySource(observations)) {
    if (group.length < MIN_OBSERVATIONS_FOR_OUTLIERS) continue;

    const values = group.map((observation) => observation.emissions);
    const scores = modifiedZScores(values);
    const centre = median(values);

    for (const [index, score] of scores.entries()) {
      if (Math.abs(score) < threshold) continue;
      const observation = group[index];
      findings.push({
        id: `outlier:${sourceKey}:${observation.period}`,
        titleKey: score > 0 ? "outlier_high" : "outlier_low",
        severity: severityFromZ(score),
        source: "deterministic",
        period: observation.period,
        sourceKey,
        detail: {
          value: round(observation.emissions),
          median: round(centre),
          zScore: round(score, 1),
          deviationPercent: centre === 0 ? 0 : round(((observation.emissions - centre) / centre) * 100, 1),
        },
      });
    }
  }

  return { findings, observationCount: observations.length };
}

/**
 * Implied emission factor for an observation, in tCO2e per activity unit.
 *
 * Null when there is no activity data or it is zero — dividing by zero activity
 * would report an infinite factor for a month where a meter simply read zero.
 */
export function impliedFactor(observation: EmissionObservation): number | null {
  if (observation.activityData === undefined) return null;
  if (!Number.isFinite(observation.activityData) || observation.activityData === 0) return null;
  return observation.emissions / observation.activityData;
}

/**
 * Ratio beyond which an implied emission factor is treated as impossible.
 *
 * 2× is deliberately loose. Real factors do vary — grid intensity moves with
 * generation mix, fuel quality varies — so a tight band would flood the page
 * with false positives. A doubling, on the other hand, is almost always a unit
 * error or a transposed digit rather than physics.
 */
export const INTENSITY_DEVIATION_RATIO = 2;

/**
 * Flags observations whose implied emission factor is far from its source's
 * usual factor.
 *
 * This is the detector that catches unit mistakes. An observation can sit
 * perfectly inside its historical *emissions* range and still be wrong, if the
 * activity data it was derived from was entered in the wrong unit.
 */
export function detectIntensityAnomalies(
  observations: readonly EmissionObservation[],
  options: { ratio?: number } = {}
): DetectionResult {
  const ratio = options.ratio ?? INTENSITY_DEVIATION_RATIO;
  const findings: Finding[] = [];

  for (const [sourceKey, group] of groupBySource(observations)) {
    const withFactors = group
      .map((observation) => ({ observation, factor: impliedFactor(observation) }))
      .filter((entry): entry is { observation: EmissionObservation; factor: number } =>
        entry.factor !== null
      );

    // Three points is the minimum where a median is more than one of the values
    // itself, so anything less cannot establish a "usual" factor.
    if (withFactors.length < 3) continue;

    const typical = median(withFactors.map((entry) => entry.factor));
    if (!Number.isFinite(typical) || typical === 0) continue;

    for (const { observation, factor } of withFactors) {
      const deviation = factor / typical;
      if (deviation <= ratio && deviation >= 1 / ratio) continue;
      findings.push({
        id: `intensity:${sourceKey}:${observation.period}`,
        titleKey: deviation > 1 ? "intensity_high" : "intensity_low",
        severity: deviation >= ratio * 2 || deviation <= 1 / (ratio * 2) ? "high" : "medium",
        source: "deterministic",
        period: observation.period,
        sourceKey,
        detail: {
          impliedFactor: round(factor, 6),
          typicalFactor: round(typical, 6),
          ratio: round(deviation, 2),
          unit: observation.activityUnit ?? "",
        },
      });
    }
  }

  return { findings, observationCount: observations.length };
}

/** Relative level shift that counts as a step change. */
export const STEP_CHANGE_RATIO = 0.4;

/** Minimum consecutive months on each side of a candidate step. */
export const STEP_CHANGE_WINDOW = 3;

/**
 * Flags sustained level shifts in a source's series (비정상 배출량 탐지).
 *
 * Walks every split point with at least `STEP_CHANGE_WINDOW` months on each
 * side and compares the medians of the two windows. Requiring a *window* rather
 * than a single month is what distinguishes a step from a spike: a one-month
 * jump that reverts is an outlier and is `detectOutliers`'s business, whereas a
 * shift that persists is a change in the plant.
 *
 * Observations are sorted by period first, since a provider may return them in
 * any order and a step detector on shuffled data is meaningless.
 */
export function detectStepChanges(
  observations: readonly EmissionObservation[],
  options: { ratio?: number; window?: number } = {}
): DetectionResult {
  const ratio = options.ratio ?? STEP_CHANGE_RATIO;
  const window = options.window ?? STEP_CHANGE_WINDOW;
  const findings: Finding[] = [];

  for (const [sourceKey, group] of groupBySource(observations)) {
    const series = [...group].sort((a, b) => a.period.localeCompare(b.period));
    if (series.length < window * 2) continue;

    let best: { index: number; change: number } | null = null;

    for (let split = window; split <= series.length - window; split += 1) {
      const before = median(
        series.slice(Math.max(0, split - window), split).map((entry) => entry.emissions)
      );
      const after = median(
        series.slice(split, split + window).map((entry) => entry.emissions)
      );
      if (!Number.isFinite(before) || before === 0) continue;

      const change = (after - before) / before;
      if (Math.abs(change) < ratio) continue;
      // Keep only the largest shift per source: a single step makes every nearby
      // split look shifted too, and reporting all of them would be one fault
      // rendered as four findings.
      if (best === null || Math.abs(change) > Math.abs(best.change)) {
        best = { index: split, change };
      }
    }

    if (best === null) continue;

    findings.push({
      id: `step:${sourceKey}:${series[best.index].period}`,
      titleKey: best.change > 0 ? "step_increase" : "step_decrease",
      severity: Math.abs(best.change) >= ratio * 2 ? "high" : "medium",
      source: "deterministic",
      period: series[best.index].period,
      sourceKey,
      detail: {
        changePercent: round(best.change * 100, 1),
        from: round(
          median(
            series
              .slice(Math.max(0, best.index - window), best.index)
              .map((entry) => entry.emissions)
          )
        ),
        to: round(
          median(series.slice(best.index, best.index + window).map((entry) => entry.emissions))
        ),
      },
    });
  }

  return { findings, observationCount: observations.length };
}

/**
 * Runs all three detectors and merges their findings.
 *
 * Findings are returned highest-severity first so the page's top rows are the
 * ones worth acting on; ties keep detector order, which puts distributional
 * outliers before intensity and step findings.
 */
export function detectAllAnomalies(observations: readonly EmissionObservation[]): DetectionResult {
  const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  const findings = [
    ...detectOutliers(observations).findings,
    ...detectIntensityAnomalies(observations).findings,
    ...detectStepChanges(observations).findings,
  ].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return { findings, observationCount: observations.length };
}
