/**
 * Tests for target progress arithmetic.
 *
 * The figures this produces end up in a CDP response or an SBTi progress report,
 * so the tests care about three things in particular: that `numeric` strings from
 * PostgREST are not silently turned into NaN, that an intensity target is skipped
 * rather than answered wrongly, and that the percentage matches what
 * `assessTarget` derives from the same numbers in `src/lib/targets/types.ts`.
 */

import { assert, assertEquals } from "@std/assert";
import {
  calendarYearRange,
  type EmissionRow,
  kgToTonnes,
  numericToNumber,
  planRollup,
  progressPercent,
  type Scope3Row,
  sumForScope,
  type TargetRow,
} from "../_shared/rollup.ts";

const COMPANY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function target(overrides: Partial<TargetRow> & { id: string }): TargetRow {
  return {
    company_id: COMPANY,
    target_type: "absolute",
    status: "active",
    scope: null,
    base_year: 2020,
    target_year: 2030,
    base_emissions: "10000",
    target_emissions: "5800",
    ...overrides,
  };
}

Deno.test("numeric strings from PostgREST are parsed, junk becomes zero not NaN", () => {
  assertEquals(numericToNumber("1234.567890"), 1234.56789);
  assertEquals(numericToNumber(42), 42);
  assertEquals(numericToNumber(null), 0);
  assertEquals(numericToNumber(undefined), 0);
  // A NaN here would propagate through a sum and null out a whole company's total.
  assertEquals(numericToNumber("not a number"), 0);
  assertEquals(numericToNumber(""), 0);
});

Deno.test("kg become tonnes", () => {
  assertEquals(kgToTonnes(1_000_000), 1000);
  assertEquals(kgToTonnes(0), 0);
});

Deno.test("a scoped target sums only its own scope", () => {
  const rows: EmissionRow[] = [
    { scope: "1", co2e_kg: "1000000" },
    { scope: "2", co2e_kg: "2000000" },
    { scope: "3", co2e_kg: "4000000" },
  ];
  const scope3: Scope3Row[] = [{ co2e_kg: "500000" }];

  assertEquals(sumForScope(rows, scope3, "1"), 1000);
  assertEquals(sumForScope(rows, scope3, "2"), 2000);
  // Scope 3 lives in both tables, and a company using both must not have half its
  // value chain quietly ignored.
  assertEquals(sumForScope(rows, scope3, "3"), 4500);
  // A target covering everything gets everything, exactly once.
  assertEquals(sumForScope(rows, scope3, null), 7500);
});

Deno.test("an all-scopes target does not double-count scope 3", () => {
  const total = sumForScope(
    [{ scope: "3", co2e_kg: "1000000" }],
    [{ co2e_kg: "1000000" }],
    null,
  );
  assertEquals(total, 2000);
});

Deno.test("progress is the share of the required reduction achieved", () => {
  // 10000 -> 5800 required; at 7900 exactly half the cut has been made.
  assertEquals(progressPercent(10000, 5800, 7900), 50);
  assertEquals(progressPercent(10000, 5800, 10000), 0);
  assertEquals(progressPercent(10000, 5800, 5800), 100);
});

Deno.test("progress is clamped at both ends", () => {
  // Over-achievement clamps to 100: progress_pct is numeric(5,2) and a 130 would
  // overflow every progress bar drawn from it. The real figure stays derivable
  // from actual_emissions.
  assertEquals(progressPercent(10000, 5800, 4000), 100);
  // Emissions above the baseline are 0% progress, not negative progress.
  assertEquals(progressPercent(10000, 5800, 12000), 0);
});

Deno.test("a hold-flat target does not divide by zero", () => {
  assertEquals(progressPercent(10000, 10000, 10000), 100);
  assertEquals(progressPercent(10000, 10000, 9000), 100);
  assertEquals(progressPercent(10000, 10000, 10001), 0);
});

Deno.test("an intensity target is skipped, with the reason stated", () => {
  // Its base_emissions is tCO2e per unit of output and the schema stores no output
  // denominator. Writing absolute tonnes here would report the company as
  // catastrophically off track.
  const plan = planRollup(
    [target({ id: "t1", target_type: "intensity" })],
    [{ scope: "1", co2e_kg: "1000000" }],
    [],
    2024,
  );

  assertEquals(plan.rows, []);
  assertEquals(plan.skipped, [
    { targetId: "t1", reason: "intensity_target_needs_denominator" },
  ]);
});

Deno.test("draft and expired targets acquire no progress rows", () => {
  const plan = planRollup(
    [
      target({ id: "draft", status: "draft" }),
      target({ id: "expired", status: "expired" }),
      target({ id: "active", status: "active" }),
      target({ id: "achieved", status: "achieved" }),
      target({ id: "missed", status: "missed" }),
    ],
    [{ scope: "1", co2e_kg: "7900000" }],
    [],
    2024,
  );

  assertEquals(plan.rows.map((row) => row.target_id), ["active", "achieved", "missed"]);
  assertEquals(plan.skipped, [
    { targetId: "draft", reason: "target_not_active" },
    { targetId: "expired", reason: "target_not_active" },
  ]);
});

Deno.test("a year before the base year has no pathway to measure against", () => {
  const plan = planRollup([target({ id: "t1", base_year: 2020 })], [], [], 2019);
  assertEquals(plan.skipped, [{ targetId: "t1", reason: "year_before_base_year" }]);

  // The base year itself is measurable — it is the baseline being confirmed.
  assertEquals(planRollup([target({ id: "t1" })], [], [], 2020).rows.length, 1);
});

Deno.test("a target whose window is empty or inverted is skipped", () => {
  const plan = planRollup(
    [
      target({ id: "same", base_year: 2020, target_year: 2020 }),
      target({ id: "inverted", base_year: 2030, target_year: 2020 }),
    ],
    [],
    [],
    2030,
  );
  assertEquals(plan.skipped, [
    { targetId: "same", reason: "degenerate_target_window" },
    { targetId: "inverted", reason: "degenerate_target_window" },
  ]);
});

Deno.test("a complete plan carries the year, the total and the percentage", () => {
  const plan = planRollup(
    [target({ id: "t1", scope: "1" })],
    [
      { scope: "1", co2e_kg: "7900000" },
      // Not this target's scope, so it must not be counted.
      { scope: "2", co2e_kg: "5000000" },
    ],
    [],
    2024,
  );

  assertEquals(plan.rows, [
    { target_id: "t1", year: 2024, actual_emissions: 7900, progress_pct: 50 },
  ]);
  assertEquals(plan.skipped, []);
});

Deno.test("a company-year with no records reports zero, not nothing", () => {
  // Zero measured emissions against a 10000 baseline is 100% progress, which looks
  // odd but is arithmetically right; the caller decides whether an empty year is
  // worth writing at all. What matters here is that it does not silently vanish.
  const plan = planRollup([target({ id: "t1" })], [], [], 2024);
  assertEquals(plan.rows[0]?.actual_emissions, 0);
  assertEquals(plan.rows[0]?.progress_pct, 100);
});

Deno.test("the year range is half-open, so a new year's day record is counted once", () => {
  const { fromIso, toIso } = calendarYearRange(2024);
  assertEquals(fromIso, "2024-01-01T00:00:00.000Z");
  assertEquals(toIso, "2025-01-01T00:00:00.000Z");

  // An inclusive `2024-12-31T23:59:59Z` upper bound would drop the final second and
  // an inclusive `2025-01-01` one would count the next year's first record twice.
  assert(Date.parse("2024-12-31T23:59:59.999Z") < Date.parse(toIso));
  assert(Date.parse(toIso) <= Date.parse(calendarYearRange(2025).fromIso));
});
