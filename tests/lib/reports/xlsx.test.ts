/**
 * Excel renderer tests.
 *
 * Verified by reopening the workbook with ExcelJS, which parses the real OOXML
 * package: a corrupt zip, a malformed sheet or an illegal worksheet name shows up
 * as a load failure or a missing sheet rather than passing silently.
 *
 * Two properties are worth more than the rest:
 *  - quantities come back as JavaScript numbers, not strings. A workbook whose
 *    tonnages are text cannot be summed, which is the main reason a reviewer
 *    wants the workbook instead of the PDF.
 *  - worksheet names obey Excel's rules. ExcelJS will write a name Excel then
 *    refuses to open, so this cannot be left to the library.
 */

import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { loadReportDataset } from "@/lib/reports/dataset";
import { buildReportDocument } from "@/lib/reports/templates";
import { renderXlsx, sanitizeSheetName, uniqueSheetName } from "@/lib/reports/xlsx";
import { REPORT_TYPE_IDS, type ReportDocument } from "@/lib/reports/types";
import { KOREAN_TEXT, hostileDocument } from "./fixtures";

const GENERATED_AT = new Date("2025-01-15T09:30:00.000Z");

/** Characters Excel rejects in a worksheet name. */
const ILLEGAL_SHEET_CHARACTERS = /[[\]:*?/\\]/;

async function reopen(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // A copy into a standalone ArrayBuffer: ExcelJS reads the whole buffer, and a
  // Uint8Array view over a larger pool would hand it trailing bytes.
  await workbook.xlsx.load(bytes.slice().buffer);
  return workbook;
}

describe("sanitizeSheetName", () => {
  it("removes every character Excel forbids", () => {
    const name = sanitizeSheetName("a/b:c*d?e[f]g");
    expect(name).not.toMatch(ILLEGAL_SHEET_CHARACTERS);
  });

  it("truncates to Excel's 31-character limit", () => {
    expect(sanitizeSheetName("x".repeat(60))).toHaveLength(31);
  });

  it("never returns an empty name", () => {
    expect(sanitizeSheetName("   ")).toBe("Sheet");
    expect(sanitizeSheetName("///")).toBe("Sheet");
  });

  it("strips leading and trailing apostrophes, which Excel also rejects", () => {
    expect(sanitizeSheetName("'quoted'")).toBe("quoted");
  });
});

describe("uniqueSheetName", () => {
  it("suffixes a collision instead of overwriting the earlier sheet", () => {
    const taken = new Set<string>();
    expect(uniqueSheetName("Targets", taken)).toBe("Targets");
    expect(uniqueSheetName("Targets", taken)).toBe("Targets (2)");
    expect(uniqueSheetName("Targets", taken)).toBe("Targets (3)");
  });

  it("treats names case-insensitively, as Excel does", () => {
    const taken = new Set<string>();
    uniqueSheetName("Targets", taken);
    expect(uniqueSheetName("targets", taken)).toBe("targets (2)");
  });

  it("keeps a suffixed name inside the 31-character limit", () => {
    const taken = new Set<string>();
    const long = "y".repeat(40);
    uniqueSheetName(long, taken);
    const second = uniqueSheetName(long, taken);
    expect(second.length).toBeLessThanOrEqual(31);
    expect(second.endsWith("(2)")).toBe(true);
  });
});

describe.each([...REPORT_TYPE_IDS])("%s workbook", (type) => {
  it("reopens in ExcelJS with a sheet per section", async () => {
    const dataset = await loadReportDataset();
    const document = buildReportDocument(type, dataset, GENERATED_AT);
    const workbook = await reopen(await renderXlsx(document));

    // Report Info plus one sheet per section.
    expect(workbook.worksheets).toHaveLength(document.sections.length + 1);
    expect(workbook.getWorksheet("Report Info")).toBeDefined();

    for (const sheet of workbook.worksheets) {
      expect(sheet.name).not.toMatch(ILLEGAL_SHEET_CHARACTERS);
      expect(sheet.name.length).toBeLessThanOrEqual(31);
      expect(sheet.name.trim()).not.toBe("");
    }
  });

  it("records the report metadata on the info sheet", async () => {
    const dataset = await loadReportDataset();
    const document = buildReportDocument(type, dataset, GENERATED_AT);
    const workbook = await reopen(await renderXlsx(document));
    const info = workbook.getWorksheet("Report Info");
    if (!info) throw new Error("Report Info sheet is missing");

    const pairs = new Map<string, string>();
    info.eachRow((row) => {
      const key = row.getCell(1).value;
      const value = row.getCell(2).value;
      if (typeof key === "string" && value !== null && value !== undefined) {
        pairs.set(key, String(value));
      }
    });

    expect(pairs.get("Report type")).toBe(type);
    expect(pairs.get("Period start")).toBe(document.periodStart);
    expect(pairs.get("Period end")).toBe(document.periodEnd);
    expect(pairs.get("Sample data")).toBe("YES");
    expect(pairs.get("Sections")).toBe(String(document.sections.length));
  });

  it("keeps quantities numeric so the sheet can be summed", async () => {
    const dataset = await loadReportDataset();
    const document = buildReportDocument(type, dataset, GENERATED_AT);
    const workbook = await reopen(await renderXlsx(document));

    const numbersFound = countNumericCells(workbook);
    expect(numbersFound).toBeGreaterThan(0);
  });
});

function countNumericCells(workbook: ExcelJS.Workbook): number {
  let count = 0;
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === "number") count += 1;
      });
    });
  });
  return count;
}

describe("workbook content fidelity", () => {
  it("round-trips a table's numbers and labels exactly", async () => {
    const dataset = await loadReportDataset();
    const document = buildReportDocument("iso14064", dataset, GENERATED_AT);
    const workbook = await reopen(await renderXlsx(document));

    const section = document.sections.find((s) => s.id === "9.3.2-quantified");
    if (!section) throw new Error("expected the quantified emissions section");
    const table = section.blocks.find((block) => block.kind === "table");
    if (table?.kind !== "table") throw new Error("expected a table block");

    const sheet = sheetForSection(workbook, document, section.id);
    const headerRow = findRowStartingWith(sheet, table.table.columns[0]);
    expect(headerRow).toBeGreaterThan(0);

    table.table.rows.forEach((expectedRow, offset) => {
      const row = sheet.getRow(headerRow + 1 + offset);
      expectedRow.forEach((expectedCell, columnIndex) => {
        const actual = row.getCell(columnIndex + 1).value;
        if (typeof expectedCell === "number") {
          expect(actual).toBeCloseTo(expectedCell, 6);
        } else if (expectedCell === null) {
          expect(actual === null || actual === undefined).toBe(true);
        } else {
          expect(actual).toBe(expectedCell);
        }
      });
    });
  });

  it("preserves Korean text, which XLSX can represent and PDF cannot", async () => {
    const workbook = await reopen(await renderXlsx(hostileDocument()));
    const allText = collectText(workbook);
    expect(allText).toContain(KOREAN_TEXT);
    expect(allText).toContain("삼성전자 주식회사");
  });

  it("keeps a value with embedded quotes and newlines intact", async () => {
    const workbook = await reopen(await renderXlsx(hostileDocument()));
    const allText = collectText(workbook);
    expect(allText).toContain('Line "two" with quotes');
  });

  it("gives colliding section titles distinct sheets rather than dropping one", async () => {
    const document = hostileDocument();
    const workbook = await reopen(await renderXlsx(document));

    expect(workbook.worksheets).toHaveLength(document.sections.length + 1);
    const names = workbook.worksheets.map((sheet) => sheet.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});

/** Locates the sheet written for a section, by its id prefix. */
function sheetForSection(
  workbook: ExcelJS.Workbook,
  document: ReportDocument,
  sectionId: string
): ExcelJS.Worksheet {
  const index = document.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) throw new Error(`No section ${sectionId}`);
  // Sheet 0 is Report Info, so section n is sheet n + 1.
  const sheet = workbook.worksheets[index + 1];
  if (!sheet) throw new Error(`No sheet for section ${sectionId}`);
  return sheet;
}

function findRowStartingWith(sheet: ExcelJS.Worksheet, first: string): number {
  let found = -1;
  sheet.eachRow((row, rowNumber) => {
    if (found === -1 && row.getCell(1).value === first) found = rowNumber;
  });
  return found;
}

function collectText(workbook: ExcelJS.Workbook): string {
  const parts: string[] = [];
  workbook.eachSheet((sheet) => {
    parts.push(sheet.name);
    sheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value !== null && cell.value !== undefined) parts.push(String(cell.value));
      });
    });
  });
  return parts.join("\n");
}
