/**
 * Tests for submission validation.
 *
 * The theme: a supplier's figure goes straight into a company's reported Scope 3
 * once a reviewer verifies it, so the validation has to catch the errors that
 * would survive review unnoticed. A thousand-fold unit slip looks like a plausible
 * number; a 2023 figure filed against a 2024 request looks like a normal
 * submission. Both are caught here.
 */

import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  buildRequestData,
  isEvidenceUrl,
  isSubmittable,
  isSupplierMethodology,
  MAX_NOTES_LENGTH,
  MAX_REPORTED_TONNES,
  parseSubmission,
  statusForFailure,
  SUBMITTABLE_STATUSES,
  SUPPLIER_METHODOLOGIES,
} from "../_shared/intake.ts";

const PERIOD = "2024";

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reportedEmissions: 1980.25,
    methodology: "supplier_specific",
    period: PERIOD,
    ...overrides,
  };
}

Deno.test("a well-formed submission parses", () => {
  const result = parseSubmission(body(), PERIOD);
  assert(result.ok);
  assertEquals(result.value, {
    reportedEmissions: 1980.25,
    methodology: "supplier_specific",
    period: PERIOD,
    evidenceUrl: null,
    notes: null,
  });
});

Deno.test("the period is taken from the request, and a mismatch is refused", () => {
  // The submission below is internally consistent and would look fine in the UI.
  // Only the comparison against the request catches it.
  const mismatch = parseSubmission(body({ period: "2023" }), PERIOD);
  assertFalse(mismatch.ok);
  if (!mismatch.ok) assertEquals(mismatch.code, "period_mismatch");

  // Omitting the period is allowed; the request's own period is authoritative.
  const omitted = parseSubmission(body({ period: undefined }), PERIOD);
  assert(omitted.ok);
  if (omitted.ok) assertEquals(omitted.value.period, PERIOD);
});

Deno.test("monthly periods are accepted when they match, rejected when malformed", () => {
  const monthly = parseSubmission(body({ period: "2024-03" }), "2024-03");
  assert(monthly.ok);

  for (const period of ["2024-13", "2024-00", "24-03", "2024-3", "2024-03-01", "last year"]) {
    const result = parseSubmission(body({ period }), period);
    assertFalse(result.ok, `${period} must not be accepted`);
    if (!result.ok) assertEquals(result.code, "period_mismatch");
  }
});

Deno.test("zero is a real answer; negative is not", () => {
  const zero = parseSubmission(body({ reportedEmissions: 0 }), PERIOD);
  assert(zero.ok, "'nothing attributable to you' differs from 'no reply'");
  if (zero.ok) assertEquals(zero.value.reportedEmissions, 0);

  const negative = parseSubmission(body({ reportedEmissions: -1 }), PERIOD);
  assertFalse(negative.ok);
  if (!negative.ok) assertEquals(negative.code, "invalid_emissions");
});

Deno.test("a missing figure is distinguishable from an unusable one", () => {
  const missing = parseSubmission(body({ reportedEmissions: undefined }), PERIOD);
  assertFalse(missing.ok);
  if (!missing.ok) assertEquals(missing.code, "missing_emissions");

  const nulled = parseSubmission(body({ reportedEmissions: null }), PERIOD);
  assertFalse(nulled.ok);
  if (!nulled.ok) assertEquals(nulled.code, "missing_emissions");

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, "1980.25", "1,980.25", true, []]) {
    const result = parseSubmission(body({ reportedEmissions: value }), PERIOD);
    assertFalse(result.ok, `${JSON.stringify(value)} must not parse`);
    if (!result.ok) assertEquals(result.code, "invalid_emissions");
  }
});

Deno.test("a figure above the sanity ceiling is refused as out of range", () => {
  // The realistic cause is kg submitted as tonnes. Accepting it would put a
  // thousand-fold error into a reported total, where it would dominate every other
  // line and be believed.
  const atCeiling = parseSubmission(body({ reportedEmissions: MAX_REPORTED_TONNES }), PERIOD);
  assert(atCeiling.ok, "the ceiling itself is inclusive");

  const over = parseSubmission(body({ reportedEmissions: MAX_REPORTED_TONNES + 1 }), PERIOD);
  assertFalse(over.ok);
  if (!over.ok) assertEquals(over.code, "emissions_out_of_range");
});

Deno.test("figures are rounded to the six decimals the column stores", () => {
  const result = parseSubmission(body({ reportedEmissions: 1.23456789 }), PERIOD);
  assert(result.ok);
  if (result.ok) assertEquals(result.value.reportedEmissions, 1.234568);
});

Deno.test("methodology must come from the allowlist", () => {
  for (const methodology of SUPPLIER_METHODOLOGIES) {
    assert(parseSubmission(body({ methodology }), PERIOD).ok, methodology);
    assert(isSupplierMethodology(methodology));
  }

  for (const methodology of [undefined, null, "", "guesswork", "SPEND_BASED", 3, {}]) {
    const result = parseSubmission(body({ methodology }), PERIOD);
    assertFalse(result.ok, `${JSON.stringify(methodology)} must not parse`);
    if (!result.ok) assertEquals(result.code, "invalid_methodology");
  }
});

Deno.test("evidence links must be https", () => {
  assert(isEvidenceUrl("https://example.com/report.pdf"));
  assertFalse(isEvidenceUrl("http://example.com/report.pdf"));
  assertFalse(isEvidenceUrl("javascript:alert(1)"));
  assertFalse(isEvidenceUrl("data:text/html,hi"));
  assertFalse(isEvidenceUrl("ftp://example.com/report.pdf"));
  assertFalse(isEvidenceUrl("/relative/path.pdf"));
  assertFalse(isEvidenceUrl(`https://example.com/${"a".repeat(2100)}`));

  const accepted = parseSubmission(body({ evidenceUrl: "https://example.com/e.pdf" }), PERIOD);
  assert(accepted.ok);
  if (accepted.ok) assertEquals(accepted.value.evidenceUrl, "https://example.com/e.pdf");

  const refused = parseSubmission(body({ evidenceUrl: "http://example.com/e.pdf" }), PERIOD);
  assertFalse(refused.ok);
  if (!refused.ok) assertEquals(refused.code, "invalid_evidence_url");

  // An empty string is "not supplied", not "supplied and broken".
  const empty = parseSubmission(body({ evidenceUrl: "" }), PERIOD);
  assert(empty.ok);
  if (empty.ok) assertEquals(empty.value.evidenceUrl, null);
});

Deno.test("notes are capped", () => {
  const atCap = parseSubmission(body({ notes: "n".repeat(MAX_NOTES_LENGTH) }), PERIOD);
  assert(atCap.ok);

  const over = parseSubmission(body({ notes: "n".repeat(MAX_NOTES_LENGTH + 1) }), PERIOD);
  assertFalse(over.ok);
  if (!over.ok) assertEquals(over.code, "notes_too_long");
});

Deno.test("a non-object payload is a 400, everything else a 422", () => {
  for (const payload of [null, "a string", 42, [], undefined]) {
    const result = parseSubmission(payload, PERIOD);
    assertFalse(result.ok, `${JSON.stringify(payload)} must not parse`);
    if (!result.ok) {
      assertEquals(result.code, "invalid_payload");
      assertEquals(statusForFailure(result.code), 400);
    }
  }
  assertEquals(statusForFailure("invalid_methodology"), 422);
  assertEquals(statusForFailure("period_mismatch"), 422);
  assertEquals(statusForFailure("emissions_out_of_range"), 422);
});

Deno.test("only the three pre-submission statuses may receive a submission", () => {
  assertEquals([...SUBMITTABLE_STATUSES], ["pending", "sent", "in_progress"]);

  for (const status of SUBMITTABLE_STATUSES) assert(isSubmittable(status), status);

  // The three that must not: overwriting a queued figure, and reopening either
  // terminal decision. A rejection is followed by a new request, never an edit.
  for (const status of ["submitted", "verified", "rejected", "", "SENT"]) {
    assertFalse(isSubmittable(status), status);
  }
});

Deno.test("the stored payload records provenance and carries no verification fields", () => {
  const parsed = parseSubmission(
    body({ evidenceUrl: "https://example.com/e.pdf", notes: "measured, not estimated" }),
    PERIOD,
  );
  assert(parsed.ok);
  if (!parsed.ok) return;

  const data = buildRequestData(parsed.value, "2024-06-01T00:00:00.000Z");

  assertEquals(data.reportedEmissions, 1980.25);
  assertEquals(data.unit, "tCO2e");
  assertEquals(data.methodology, "supplier_specific");
  assertEquals(data.period, PERIOD);
  assertEquals(data.evidenceUrl, "https://example.com/e.pdf");
  assertEquals(data.notes, "measured, not estimated");
  // Provenance: an auditor asks whether a figure is the supplier's own claim or an
  // internal estimate, and this is the answer.
  assertEquals(data.source, "edge:supplier-intake");
  assertEquals(data.receivedAt, "2024-06-01T00:00:00.000Z");

  // Nothing a supplier must not be able to set. Verification is a reviewer's act.
  for (const forbidden of ["dataQuality", "verifiedAt", "status", "companyId"]) {
    assertFalse(forbidden in data, `${forbidden} must not be written by the intake`);
  }
});
