/**
 * Excel renderer, built on ExcelJS.
 *
 * Unlike the PDF path, a workbook has no encoding limitation: XLSX strings are
 * UTF-8, so Korean, Japanese and Chinese text round-trips intact. The renderer
 * is therefore free of sanitisation — the only escaping it has to get right is
 * the worksheet-name rules, which Excel enforces and ExcelJS does not.
 *
 * Layout: one "Report Info" sheet carrying the metadata and caveats, then one
 * sheet per report section. Sections rather than one flat sheet, because a
 * reviewer opening a CDP response wants C6.1 as a tab, not as row 340.
 */

import ExcelJS from "exceljs";
import type { ReportDocument, ReportSection, ReportTable } from "./types";

/**
 * Excel's worksheet name rules, which are stricter than they look:
 * at most 31 characters, none of `[ ] : * ? / \`, cannot be blank, and cannot
 * start or end with an apostrophe. ExcelJS will happily create a workbook that
 * Excel then refuses to open, so this is enforced here.
 */
export function sanitizeSheetName(name: string): string {
  const cleaned = name
    .replace(/[[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "")
    .slice(0, 31)
    .trim();
  return cleaned === "" ? "Sheet" : cleaned;
}

/**
 * Makes a sheet name unique within a workbook.
 *
 * Excel compares names case-insensitively, so `305-1` and `305-1` colliding
 * matters but so would `Targets` and `targets`. The suffix is inserted by
 * truncating rather than appending past 31 characters, which would produce a
 * name Excel rejects.
 */
export function uniqueSheetName(base: string, taken: Set<string>): string {
  const sanitized = sanitizeSheetName(base);
  if (!taken.has(sanitized.toLowerCase())) {
    taken.add(sanitized.toLowerCase());
    return sanitized;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const tail = ` (${suffix})`;
    const candidate = `${sanitized.slice(0, 31 - tail.length).trim()}${tail}`;
    if (!taken.has(candidate.toLowerCase())) {
      taken.add(candidate.toLowerCase());
      return candidate;
    }
  }
  throw new Error(`Could not derive a unique worksheet name from: ${base}`);
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFEFF1F3" },
};

const WARNING_FONT: Partial<ExcelJS.Font> = { color: { argb: "FF8A4B00" }, bold: true };

/** Column width heuristic: longest cell, clamped to something readable. */
function fitColumns(sheet: ExcelJS.Worksheet, startColumn = 1): void {
  sheet.columns.forEach((column, index) => {
    if (index + 1 < startColumn) return;
    let longest = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const text = cell.value === null || cell.value === undefined ? "" : String(cell.value);
      const longestLine = text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
      longest = Math.max(longest, longestLine);
    });
    column.width = Math.min(60, longest + 2);
  });
}

function writeTable(sheet: ExcelJS.Worksheet, table: ReportTable): void {
  const headerRow = sheet.addRow(table.columns);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  const numeric = new Set(table.numericColumns ?? []);

  for (const row of table.rows) {
    // Written as a plain array so ExcelJS keeps numbers numeric: a quantity
    // stored as text cannot be summed in the sheet, which is the main reason a
    // reviewer asks for the workbook rather than the PDF.
    const added = sheet.addRow(table.columns.map((_, index) => row[index] ?? null));
    added.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      if (numeric.has(columnNumber - 1) && typeof cell.value === "number") {
        cell.alignment = { horizontal: "right" };
        cell.numFmt = Number.isInteger(cell.value) ? "#,##0" : "#,##0.000";
      }
    });
  }

  // Freeze the header so a long table stays legible while scrolling.
  const headerRowNumber = headerRow.number;
  sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  sheet.addRow([]);
}

function writeSection(
  workbook: ExcelJS.Workbook,
  section: ReportSection,
  taken: Set<string>
): void {
  // The section id seeds the sheet name because ids are short and stable
  // ("305-1", "C6.1-emissions"); the title is appended when it still fits.
  const base = `${section.id} ${section.title}`;
  const sheet = workbook.addWorksheet(uniqueSheetName(base, taken));

  const titleRow = sheet.addRow([section.title]);
  titleRow.font = { bold: true, size: 13 };
  sheet.addRow([`Section: ${section.id}`]).font = { color: { argb: "FF6B7280" } };
  sheet.addRow([]);

  let hasTable = false;
  for (const block of section.blocks) {
    if (block.kind === "paragraph") {
      const row = sheet.addRow([block.text]);
      row.getCell(1).alignment = { wrapText: true, vertical: "top" };
      sheet.addRow([]);
    } else if (block.kind === "keyValues") {
      for (const item of block.items) {
        const row = sheet.addRow([item.label, item.value]);
        row.getCell(1).font = { color: { argb: "FF6B7280" } };
        row.getCell(2).font = { bold: true };
      }
      sheet.addRow([]);
    } else {
      writeTable(sheet, block.table);
      hasTable = true;
    }
  }

  fitColumns(sheet);
  // Paragraph text otherwise stretches column A to its 60-character cap on a
  // sheet whose real content is a two-column key/value list.
  if (!hasTable && sheet.columnCount <= 2) {
    sheet.getColumn(1).width = 52;
  }
}

/** Renders a report document to XLSX bytes. */
export async function renderXlsx(document: ReportDocument): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CarbonLedger AI";
  workbook.lastModifiedBy = "CarbonLedger AI";
  workbook.created = new Date(document.generatedAt);
  workbook.modified = new Date(document.generatedAt);

  const taken = new Set<string>();
  const info = workbook.addWorksheet(uniqueSheetName("Report Info", taken));

  const title = info.addRow([document.title]);
  title.font = { bold: true, size: 16 };
  info.addRow([document.standardReference]).font = { color: { argb: "FF6B7280" } };
  info.addRow([]);

  const metadata: [string, string][] = [
    ["Report type", document.type],
    ["Reporting organisation", document.organizationName],
    ["Period start", document.periodStart],
    ["Period end", document.periodEnd],
    ["Generated at", document.generatedAt],
    ["Coverage", document.coverage === "full" ? "Full" : "Partial (quantitative only)"],
    ["Sample data", document.isSampleData ? "YES" : "No"],
    ["Sections", String(document.sections.length)],
  ];
  for (const [key, value] of metadata) {
    const row = info.addRow([key, value]);
    row.getCell(1).font = { color: { argb: "FF6B7280" } };
    row.getCell(2).font = { bold: true };
  }

  info.addRow([]);
  info.addRow(["Notes"]).font = { bold: true };
  for (const note of document.notes) {
    const row = info.addRow([note]);
    row.getCell(1).font = WARNING_FONT;
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
  }

  info.addRow([]);
  info.addRow(["Contents"]).font = { bold: true };
  const contents = info.addRow(["Section", "Title"]);
  contents.font = { bold: true };
  contents.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
  for (const section of document.sections) {
    info.addRow([section.id, section.title]);
  }

  info.getColumn(1).width = 34;
  info.getColumn(2).width = 60;

  for (const section of document.sections) {
    writeSection(workbook, section, taken);
  }

  // `writeBuffer` returns an ArrayBuffer-like object; normalising to Uint8Array
  // keeps the return type identical across the three renderers.
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
