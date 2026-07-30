/**
 * CSV renderer, built on Papa Parse.
 *
 * ## Why the output is long-format
 *
 * A report holds many heterogeneous tables — a nine-column Scope 3 inventory, a
 * three-column CDP metrics table, key/value metadata — and a CSV file is exactly
 * one rectangle. Emitting only the largest table would silently lose the rest;
 * padding them all into one wide grid would produce a file no tool can read.
 *
 * So the export is tidy/long format: one row per cell, with the coordinates that
 * locate it. Every value in the document survives, and the file is trivially
 * pivotable back into the original tables by grouping on
 * `section_id` + `block_index` + `row_index`.
 *
 * Escaping is Papa Parse's job and it does it correctly, but "correctly" is the
 * part worth testing rather than trusting: `tests/lib/reports/csv.test.ts` pushes
 * values containing commas, double quotes and embedded newlines through
 * `renderCsv` and parses the result back to assert the round trip is lossless.
 */

import Papa from "papaparse";
import type { ReportDocument } from "./types";

/** Column order of the long-format export. Stable: consumers key off it. */
export const CSV_COLUMNS = [
  "section_id",
  "section_title",
  "block_index",
  "block_kind",
  "row_index",
  "column",
  "value",
] as const;

export interface CsvRow {
  section_id: string;
  section_title: string;
  block_index: number | "";
  block_kind: string;
  row_index: number | "";
  column: string;
  value: string;
}

export interface RenderCsvOptions {
  /**
   * Prepend a UTF-8 byte order mark.
   *
   * Excel on Windows assumes the system code page for a `.csv` without one and
   * renders any non-ASCII text as mojibake — which, for a Korean-default
   * application, is the common case rather than the edge case. Papa Parse strips
   * a leading BOM when parsing, so the round trip is unaffected. Off by default
   * so the pure function stays byte-predictable; the download route turns it on.
   */
  bom?: boolean;
}

/** Stringifies a cell for CSV. Numbers keep full precision; `null` becomes empty. */
function cellValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return typeof value === "number" ? String(value) : value;
}

/**
 * Flattens a document into long-format rows.
 *
 * Exported separately from `renderCsv` so tests can assert on the structure
 * without going through a parse, and so a future JSON or Parquet export can
 * reuse the flattening rather than reimplementing it.
 */
export function toCsvRows(document: ReportDocument): CsvRow[] {
  const rows: CsvRow[] = [];

  const meta = (column: string, value: string) => {
    rows.push({
      section_id: "document",
      section_title: document.title,
      block_index: "",
      block_kind: "metadata",
      row_index: "",
      column,
      value,
    });
  };

  meta("type", document.type);
  meta("title", document.title);
  meta("standard_reference", document.standardReference);
  meta("coverage", document.coverage);
  meta("organization", document.organizationName);
  meta("period_start", document.periodStart);
  meta("period_end", document.periodEnd);
  meta("generated_at", document.generatedAt);
  meta("is_sample_data", document.isSampleData ? "true" : "false");
  document.notes.forEach((note, index) => {
    rows.push({
      section_id: "document",
      section_title: document.title,
      block_index: "",
      block_kind: "note",
      row_index: index,
      column: "note",
      value: note,
    });
  });

  for (const section of document.sections) {
    section.blocks.forEach((block, blockIndex) => {
      if (block.kind === "paragraph") {
        rows.push({
          section_id: section.id,
          section_title: section.title,
          block_index: blockIndex,
          block_kind: "paragraph",
          row_index: 0,
          column: "text",
          value: block.text,
        });
        return;
      }

      if (block.kind === "keyValues") {
        block.items.forEach((item, itemIndex) => {
          rows.push({
            section_id: section.id,
            section_title: section.title,
            block_index: blockIndex,
            block_kind: "key_value",
            row_index: itemIndex,
            column: item.label,
            value: item.value,
          });
        });
        return;
      }

      block.table.rows.forEach((row, rowIndex) => {
        block.table.columns.forEach((column, columnIndex) => {
          rows.push({
            section_id: section.id,
            section_title: section.title,
            block_index: blockIndex,
            block_kind: "table",
            row_index: rowIndex,
            column,
            value: cellValue(row[columnIndex]),
          });
        });
      });
    });
  }

  return rows;
}

/** Renders a report document to a CSV string. */
export function renderCsvString(document: ReportDocument, options: RenderCsvOptions = {}): string {
  const csv = Papa.unparse(
    {
      fields: [...CSV_COLUMNS],
      data: toCsvRows(document).map((row) => CSV_COLUMNS.map((column) => row[column])),
    },
    {
      // RFC 4180 line terminator, which is what Excel expects.
      newline: "\r\n",
      // Quote only where required. Papa handles the required cases — delimiter,
      // quote character and CR/LF inside a field — and doubles embedded quotes.
      quotes: false,
      quoteChar: '"',
      escapeChar: '"',
    }
  );

  return options.bom ? `\ufeff${csv}` : csv;
}

/** Renders a report document to CSV bytes. */
export function renderCsv(document: ReportDocument, options: RenderCsvOptions = {}): Uint8Array {
  return new TextEncoder().encode(renderCsvString(document, options));
}
