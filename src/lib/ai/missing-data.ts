/**
 * Deterministic missing-data detection (누락 데이터 탐지).
 *
 * No API key, no model call. Covered by `tests/lib/ai/missing-data.test.ts`.
 *
 * Completeness is the failure mode that quietly ruins an inventory: an
 * arithmetically perfect total over data that is missing three months of one
 * boiler understates emissions with no visible error anywhere. Three checks:
 *
 *  1. `detectPeriodGaps` — months absent from a source's series.
 *  2. `detectMissingActivityData` — emissions recorded with no activity data
 *     behind them, i.e. figures that cannot be recalculated or verified.
 *  3. `detectMissingScope3Categories` — relevant Scope 3 categories with no
 *     number attached.
 *
 * A gap is only meaningful relative to an expected calendar, so
 * `detectPeriodGaps` derives the expectation from each source's own first and
 * last observed month rather than assuming a full year. A source commissioned in
 * July should not be reported as missing January through June.
 */

import type { Scope3CategoryStatus } from "@/lib/scope3/types";
import type { DetectionResult, EmissionObservation, Finding } from "./types";

/** Parses `YYYY-MM` into a comparable month index. Null when malformed. */
export function monthIndex(period: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return year * 12 + (month - 1);
}

/** Inverse of `monthIndex`. */
export function periodFromMonthIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Every month between two `YYYY-MM` bounds, inclusive. */
export function monthRange(from: string, to: string): string[] {
  const start = monthIndex(from);
  const end = monthIndex(to);
  if (start === null || end === null || end < start) return [];
  const periods: string[] = [];
  for (let index = start; index <= end; index += 1) {
    periods.push(periodFromMonthIndex(index));
  }
  return periods;
}

/**
 * Flags months absent from each source's own reporting window.
 *
 * `expectedRange` overrides the per-source inference when the caller knows the
 * reporting period — that is the stricter and more correct check for an annual
 * inventory, where a source that stopped reporting in September genuinely is
 * missing October to December.
 */
export function detectPeriodGaps(
  observations: readonly EmissionObservation[],
  options: { expectedRange?: { from: string; to: string } } = {}
): DetectionResult {
  const findings: Finding[] = [];
  const bySource = new Map<string, Set<string>>();

  for (const observation of observations) {
    const existing = bySource.get(observation.sourceKey);
    if (existing) existing.add(observation.period);
    else bySource.set(observation.sourceKey, new Set([observation.period]));
  }

  for (const [sourceKey, periods] of bySource) {
    const present = [...periods].filter((period) => monthIndex(period) !== null).sort();
    if (present.length === 0) continue;

    const expected = options.expectedRange
      ? monthRange(options.expectedRange.from, options.expectedRange.to)
      : monthRange(present[0], present[present.length - 1]);

    const missing = expected.filter((period) => !periods.has(period));
    if (missing.length === 0) continue;

    findings.push({
      id: `gap:${sourceKey}`,
      titleKey: "missing_periods",
      // More than a quarter of the year missing stops being an administrative
      // slip and starts being a materially incomplete inventory.
      severity: missing.length >= 3 ? "high" : missing.length >= 2 ? "medium" : "low",
      source: "deterministic",
      period: missing[0],
      sourceKey,
      detail: {
        missingCount: missing.length,
        // Bounded so a source with a two-year hole does not produce a message
        // longer than the table it sits in.
        missingPeriods: missing.slice(0, 6).join(", "),
        expectedCount: expected.length,
      },
    });
  }

  return { findings, observationCount: observations.length };
}

/**
 * Flags emission figures with no activity data behind them.
 *
 * ISO 14064-1 requires the inventory to be verifiable, which in practice means
 * every figure must be recomputable from an activity quantity and a factor. A
 * bare tCO2e number cannot be re-derived, so it cannot be verified — and it also
 * silently escapes `detectIntensityAnomalies`, which needs activity data to work.
 */
export function detectMissingActivityData(
  observations: readonly EmissionObservation[]
): DetectionResult {
  const findings: Finding[] = [];

  for (const observation of observations) {
    const hasActivity =
      observation.activityData !== undefined &&
      Number.isFinite(observation.activityData) &&
      observation.activityData > 0;
    if (hasActivity) continue;

    findings.push({
      id: `no-activity:${observation.sourceKey}:${observation.period}`,
      titleKey: "missing_activity_data",
      // Weighted by how much of the footprint is unverifiable, not by count:
      // one unverifiable 5000 t figure matters more than ten 2 t ones.
      severity: observation.emissions >= 1000 ? "high" : observation.emissions >= 100 ? "medium" : "low",
      source: "deterministic",
      period: observation.period,
      sourceKey: observation.sourceKey,
      detail: { emissions: Math.round(observation.emissions * 100) / 100 },
    });
  }

  return { findings, observationCount: observations.length };
}

/**
 * Flags Scope 3 categories that are relevant but uncalculated, and categories
 * nobody has assessed at all.
 *
 * `not_assessed` is reported as the more severe of the two: an uncalculated but
 * assessed category is a known gap with an owner, whereas an unassessed one has
 * not even been looked at, and the GHG Protocol requires a stated relevance
 * judgement for all 15.
 */
export function detectMissingScope3Categories(
  categories: readonly Scope3CategoryStatus[]
): DetectionResult {
  const findings: Finding[] = [];

  for (const category of categories) {
    if (category.relevance === "not_assessed") {
      findings.push({
        id: `scope3-unassessed:${category.number}`,
        titleKey: "scope3_not_assessed",
        severity: "high",
        source: "deterministic",
        period: null,
        sourceKey: `cat${category.number}`,
        detail: { category: category.number },
      });
      continue;
    }
    if (category.relevance === "relevant" && category.emissions === null) {
      findings.push({
        id: `scope3-uncalculated:${category.number}`,
        titleKey: "scope3_uncalculated",
        severity: "medium",
        source: "deterministic",
        period: null,
        sourceKey: `cat${category.number}`,
        detail: { category: category.number },
      });
    }
  }

  return { findings, observationCount: categories.length };
}

/**
 * Runs every completeness check over the data available.
 *
 * `scope3Categories` is optional so the function is usable on an
 * emissions-only dataset; omitting it skips the Scope 3 check rather than
 * reporting all 15 categories as missing.
 */
export function detectAllMissingData(
  observations: readonly EmissionObservation[],
  options: {
    expectedRange?: { from: string; to: string };
    scope3Categories?: readonly Scope3CategoryStatus[];
  } = {}
): DetectionResult {
  const findings = [
    ...detectPeriodGaps(observations, { expectedRange: options.expectedRange }).findings,
    ...detectMissingActivityData(observations).findings,
    ...(options.scope3Categories
      ? detectMissingScope3Categories(options.scope3Categories).findings
      : []),
  ];

  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return { findings, observationCount: observations.length };
}
