/**
 * Recomputing measured performance against reduction targets. Pure — no database.
 *
 * `target_progress` is the one table in the schema with no writer anywhere in the
 * codebase: `0003_rls_policies_phase2.sql` gives it policies, `/targets` reads a
 * shape that matches it, and nothing has ever filled it in. This module is the
 * arithmetic for filling it in; `target-progress-rollup/index.ts` is the plumbing.
 *
 * The arithmetic deliberately mirrors `assessTarget` in
 * `src/lib/targets/types.ts`. If the stored `progress_pct` disagreed with the
 * percentage the UI derives from the same numbers, one of the two would be wrong
 * on screen and there would be no way to tell which.
 *
 * ## What counts
 *
 * Only **approved** emission records. `record_status` runs
 * draft -> submitted -> reviewed -> approved -> rejected, and the platform's
 * stated position — see the roll-up rule in `src/lib/suppliers/types.ts` — is that
 * a figure nobody checked is not an inventory input. Publishing target progress
 * from draft data would be the same mistake in a more consequential place, since
 * target progress is what goes into a CDP or SBTi submission.
 *
 * A record is attributed to the year its `period_start` falls in. A period
 * straddling a year boundary therefore lands wholly in the earlier year rather
 * than being split, because the schema stores no basis on which to split it.
 */

/** The subset of `reduction_targets` the roll-up reads. */
export interface TargetRow {
  id: string;
  company_id: string;
  target_type: string;
  status: string;
  /** `emission_scope` enum as text, or null for "all scopes combined". */
  scope: string | null;
  base_year: number;
  target_year: number;
  /** `numeric` — PostgREST returns these as strings. */
  base_emissions: string | number;
  target_emissions: string | number;
}

/** An approved emission record, reduced to what matters here. */
export interface EmissionRow {
  scope: string;
  co2e_kg: string | number;
}

/** A Scope 3 record; `scope3_records` has no `scope` column because it is all Scope 3. */
export interface Scope3Row {
  co2e_kg: string | number;
}

/** One row destined for `target_progress`. */
export interface ProgressRow {
  target_id: string;
  year: number;
  actual_emissions: number;
  progress_pct: number;
}

export type SkipReason =
  | "intensity_target_needs_denominator"
  | "target_not_active"
  | "year_before_base_year"
  | "degenerate_target_window";

export interface SkippedTarget {
  targetId: string;
  reason: SkipReason;
}

export interface RollupPlan {
  rows: ProgressRow[];
  skipped: SkippedTarget[];
}

/**
 * `numeric` arrives from PostgREST as a string to avoid float loss.
 *
 * Returns 0 for anything unparseable rather than NaN: a NaN would propagate into
 * a sum and turn one bad row into a null total for the whole company.
 */
export function numericToNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** kg -> tonnes. Targets are held in tCO2e; `co2e_kg` is, as named, kg. */
export function kgToTonnes(kg: number): number {
  return kg / 1000;
}

/** Statuses a target must be in for progress to be recomputed. */
const MEASURABLE_STATUSES = ["active", "achieved", "missed"] as const;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Sums approved records for the scope a target covers, in tCO2e.
 *
 * `scope === null` means the target covers everything, so Scope 3 records are
 * added to the Scope 1/2/3 emission records. When a target names Scope 3
 * explicitly, `scope3_records` are included and `emission_records` with
 * `scope = '3'` are too — the schema allows Scope 3 in both tables and a
 * company that uses both would otherwise have half its value chain ignored.
 */
export function sumForScope(
  emissionRows: readonly EmissionRow[],
  scope3Rows: readonly Scope3Row[],
  scope: string | null,
): number {
  let kg = 0;
  for (const row of emissionRows) {
    if (scope !== null && row.scope !== scope) continue;
    kg += numericToNumber(row.co2e_kg);
  }
  if (scope === null || scope === "3") {
    for (const row of scope3Rows) kg += numericToNumber(row.co2e_kg);
  }
  return round(kgToTonnes(kg), 6);
}

/**
 * Share of the required reduction achieved, 0-100.
 *
 * The same arithmetic as `assessTarget`'s `progressPercent` in
 * `src/lib/targets/types.ts`, kept to two decimals rather than that function's one
 * because `target_progress.progress_pct` is `numeric(5,2)` and there is no reason
 * to throw away precision the column can hold. The UI rounding to 1dp for display
 * is a display choice; the stored figure is the one an auditor recomputes.
 *
 * Both of the two cases a naive formula gets wrong are handled the same way:
 *
 *  * a hold-flat target (`base === target`) would divide by zero; progress is
 *    100 once emissions are at or below the baseline and 0 otherwise;
 *  * over-achievement is clamped to 100, because `target_progress.progress_pct`
 *    is `numeric(5,2)` and a genuine 130% would be stored as 130 and then
 *    overflow every progress bar the UI draws from it. The unclamped figure is
 *    still derivable from `actual_emissions`, so nothing is lost.
 */
export function progressPercent(
  baseEmissions: number,
  targetEmissions: number,
  actualEmissions: number,
): number {
  const required = baseEmissions - targetEmissions;
  const achieved = baseEmissions - actualEmissions;
  if (required === 0) return achieved >= 0 ? 100 : 0;
  const raw = (achieved / required) * 100;
  return round(Math.min(100, Math.max(0, raw)), 2);
}

/**
 * Builds the `target_progress` rows for one company-year.
 *
 * Skips rather than guesses, and reports every skip:
 *
 *  * **intensity targets.** Their `base_emissions` is an intensity (tCO2e per
 *    unit of output) and the schema stores no output denominator anywhere, so
 *    there is nothing to divide by. Writing absolute emissions into an intensity
 *    target's progress would compare tonnes against tonnes-per-unit and report a
 *    company as catastrophically off track. A skip with a stated reason is the
 *    honest outcome until a production-volume table exists.
 *  * **draft and expired targets.** A draft is not yet a commitment; an expired
 *    one is history. Neither should acquire new progress rows.
 *  * **years before the base year.** There is no pathway to measure against.
 */
export function planRollup(
  targets: readonly TargetRow[],
  emissionRows: readonly EmissionRow[],
  scope3Rows: readonly Scope3Row[],
  year: number,
): RollupPlan {
  const rows: ProgressRow[] = [];
  const skipped: SkippedTarget[] = [];

  for (const target of targets) {
    if (!(MEASURABLE_STATUSES as readonly string[]).includes(target.status)) {
      skipped.push({ targetId: target.id, reason: "target_not_active" });
      continue;
    }
    if (target.target_type === "intensity") {
      skipped.push({ targetId: target.id, reason: "intensity_target_needs_denominator" });
      continue;
    }
    if (year < target.base_year) {
      skipped.push({ targetId: target.id, reason: "year_before_base_year" });
      continue;
    }
    if (target.target_year <= target.base_year) {
      skipped.push({ targetId: target.id, reason: "degenerate_target_window" });
      continue;
    }

    const actual = sumForScope(emissionRows, scope3Rows, target.scope);
    rows.push({
      target_id: target.id,
      year,
      actual_emissions: actual,
      progress_pct: progressPercent(
        numericToNumber(target.base_emissions),
        numericToNumber(target.target_emissions),
        actual,
      ),
    });
  }

  return { rows, skipped };
}

/**
 * The half-open instant range for a calendar year, as ISO strings.
 *
 * Half-open on purpose: `[year-01-01, year+1-01-01)` cannot double-count a record
 * that starts exactly at midnight on 1 January, which an inclusive upper bound of
 * `year-12-31T23:59:59Z` both mis-handles and silently drops the last second of.
 *
 * UTC, matching `timestamp with time zone` columns. A company whose fiscal year
 * does not start in January is a separate feature: `companies.fiscal_year_start`
 * exists and this function does not read it, which is a stated limitation rather
 * than an oversight.
 */
export function calendarYearRange(year: number): { fromIso: string; toIso: string } {
  return {
    fromIso: new Date(Date.UTC(year, 0, 1)).toISOString(),
    toIso: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
  };
}
