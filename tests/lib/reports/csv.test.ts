/**
 * CSV renderer tests.
 *
 * The whole point is the round trip: render, parse the output back with Papa
 * Parse, and assert the cells that come out are the cells that went in. Values
 * carrying commas, double quotes and embedded CR/LF are the cases a hand-rolled
 * `join(",")` gets wrong, and they are driven explicitly rather than hoped for.
 */

import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { loadReportDataset } from "@/lib/reports/dataset";
import { CSV_COLUMNS, renderCsv, renderCsvString, toCsvRows } from "@/lib/reports/csv";
import { buildReportDocument } from "@/lib/reports/templates";
import { REPORT_TYPE_IDS } from "@/lib/reports/types";
import { CHINESE_TEXT, HOSTILE_VALUE, KOREAN_TEXT, hostileDocument } from "./fixtures";

const GENERATED_AT = new Date("2025-01-15T09:30:00.000Z");

interface ParsedRow {
  section_id: string;
  section_title: string;
  block_index: string;
  block_kind: string;
  row_index: string;
  column: string;
  value: string;
}

/** Parses with a header row, which is how a consumer would read the export. */
function parse(csv: string): ParsedRow[] {
  const result = Papa.parse<ParsedRow>(csv, {
    header: true,
    skipEmptyLines: false,
    newline: "\r\n",
  });
  expect(result.errors).toEqual([]);
  return result.data;
}

describe("CSV structure", () => {
  it("uses the declared column order as its header row", () => {
    const csv = renderCsvString(hostileDocument());
    const firstLine = csv.split("\r\n")[0];
    expect(firstLine).toBe(CSV_COLUMNS.join(","));
  });

  it("emits one row per cell, covering metadata, notes and every block", () => {
    const document = hostileDocument();
    const rows = toCsvRows(document);

    const kinds = new Set(rows.map((row) => row.block_kind));
    expect(kinds).toContain("metadata");
    expect(kinds).toContain("note");
    expect(kinds).toContain("paragraph");
    expect(kinds).toContain("key_value");
    expect(kinds).toContain("table");

    // The table in the fixture is 3 rows x 3 columns.
    const tableRows = rows.filter((row) => row.block_kind === "table");
    expect(tableRows).toHaveLength(9);
  });

  it("records the sample-data flag as an explicit field, not a footnote", () => {
    const rows = toCsvRows(hostileDocument());
    const flag = rows.find((row) => row.column === "is_sample_data");
    expect(flag?.value).toBe("true");
  });
});

describe("escaping", () => {
  it("round-trips a value containing a comma, quotes and a newline", () => {
    const csv = renderCsvString(hostileDocument());
    const parsed = parse(csv);

    const paragraph = parsed.find((row) => row.block_kind === "paragraph");
    expect(paragraph?.value).toBe(HOSTILE_VALUE);
  });

  it("quotes and doubles an embedded double quote", () => {
    const csv = renderCsvString(hostileDocument());
    // The header cell `Quoted "column"` must appear with its quotes doubled
    // inside a quoted field, per RFC 4180.
    expect(csv).toContain('"Quoted ""column"""');
  });

  it("round-trips a column name that contains a comma", () => {
    const parsed = parse(renderCsvString(hostileDocument()));
    expect(parsed.some((row) => row.column === "Label, with comma")).toBe(true);
  });

  it("round-trips CJK text, which CSV can represent unlike PDF", () => {
    const parsed = parse(renderCsvString(hostileDocument()));
    const values = parsed.map((row) => row.value);
    expect(values).toContain(KOREAN_TEXT);
    expect(values.some((value) => value.includes(CHINESE_TEXT))).toBe(true);
  });

  it("uses CRLF line endings, as RFC 4180 and Excel expect", () => {
    const csv = renderCsvString(hostileDocument());
    // Every newline outside a quoted field is a CRLF: stripping quoted fields
    // must leave no bare LF behind.
    const withoutQuoted = csv.replace(/"(?:[^"]|"")*"/g, "Q");
    expect(withoutQuoted).not.toMatch(/(?<!\r)\n/);
  });

  it("represents a null cell as an empty field rather than the string null", () => {
    const parsed = parse(renderCsvString(hostileDocument()));
    const nullCell = parsed.find(
      (row) => row.block_kind === "table" && row.row_index === "1" && row.column.includes("Quoted")
    );
    expect(nullCell?.value).toBe("");
  });
});

describe("byte order mark", () => {
  it("is absent by default so the pure function stays byte-predictable", () => {
    expect(renderCsvString(hostileDocument()).startsWith("\ufeff")).toBe(false);
  });

  it("is prepended on request, for Excel on Windows", () => {
    expect(renderCsvString(hostileDocument(), { bom: true }).startsWith("\ufeff")).toBe(true);
  });

  it("does not break parsing: Papa Parse strips it", () => {
    const withBom = renderCsvString(hostileDocument(), { bom: true });
    const parsed = parse(withBom);
    // If the BOM leaked into the first header name, this lookup would be undefined.
    expect(parsed[0].section_id).toBe("document");
  });

  it("encodes the BOM as the three expected bytes", () => {
    const bytes = renderCsv(hostileDocument(), { bom: true });
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe.each([...REPORT_TYPE_IDS])("%s CSV", (type) => {
  it("parses back with no errors and every cell preserved", async () => {
    const dataset = await loadReportDataset();
    const document = buildReportDocument(type, dataset, GENERATED_AT);
    const expected = toCsvRows(document);
    const parsed = parse(renderCsvString(document));

    expect(parsed).toHaveLength(expected.length);

    expected.forEach((row, index) => {
      const actual = parsed[index];
      expect(actual.section_id).toBe(row.section_id);
      expect(actual.block_kind).toBe(row.block_kind);
      expect(actual.column).toBe(row.column);
      expect(actual.value).toBe(row.value);
    });
  });

  it("encodes to bytes that decode back to the same string", async () => {
    const dataset = await loadReportDataset();
    const document = buildReportDocument(type, dataset, GENERATED_AT);
    const bytes = renderCsv(document);
    expect(new TextDecoder().decode(bytes)).toBe(renderCsvString(document));
  });
});
