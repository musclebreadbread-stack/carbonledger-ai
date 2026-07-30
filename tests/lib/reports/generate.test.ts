/**
 * End-to-end generation: every report type in every format.
 *
 * 27 combinations, each verified by re-parsing the bytes rather than by
 * inspecting them — a PDF that loads, a workbook ExcelJS reopens, a CSV Papa
 * Parse reads without errors. This is the test that would fail if a template
 * produced something one renderer could not lay out.
 */

import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { PDFDocument } from "pdf-lib";
import { generateReport, generateReportDocument, reportFilename } from "@/lib/reports";
import { REPORT_FORMATS, REPORT_TYPE_IDS, isReportFormat, isReportType } from "@/lib/reports/types";

const GENERATED_AT = new Date("2025-01-15T09:30:00.000Z");

const COMBINATIONS = REPORT_TYPE_IDS.flatMap((type) =>
  REPORT_FORMATS.map((format) => ({ type, format }))
);

describe("type guards", () => {
  it("accepts the canonical ids and rejects everything else", () => {
    expect(isReportType("iso14064")).toBe(true);
    expect(isReportType("ISO14064")).toBe(false);
    expect(isReportType("internal")).toBe(false);
    expect(isReportType(undefined)).toBe(false);

    expect(isReportFormat("xlsx")).toBe(true);
    expect(isReportFormat("json")).toBe(false);
  });
});

describe("reportFilename", () => {
  it("names the file after the type, period and format", () => {
    expect(
      reportFilename({
        type: "gri",
        format: "xlsx",
        periodStart: "2024-01-01",
        periodEnd: "2024-12-31",
      })
    ).toBe("carbonledger-gri-2024-01-01_2024-12-31.xlsx");
  });

  it("stays ASCII and free of spaces, so Content-Disposition needs no encoding", () => {
    const name = reportFilename({
      type: "sustainability",
      format: "pdf",
      periodStart: "2023-04-01",
      periodEnd: "2024-03-31",
    });
    expect(name).toMatch(/^[\x21-\x7e]+$/);
    expect(name).not.toContain(" ");
  });
});

describe("generateReportDocument", () => {
  it("honours an explicit period and organisation name", async () => {
    const document = await generateReportDocument({
      type: "cdp",
      periodStart: "2023-04-01",
      periodEnd: "2024-03-31",
      organizationName: "Acme Industrial",
      generatedAt: GENERATED_AT,
    });

    expect(document.periodStart).toBe("2023-04-01");
    expect(document.periodEnd).toBe("2024-03-31");
    expect(document.organizationName).toBe("Acme Industrial");
    expect(document.generatedAt).toBe(GENERATED_AT.toISOString());
  });

  it("rejects a bad period at the library boundary", async () => {
    await expect(
      generateReportDocument({ type: "cdp", periodStart: "not-a-date" })
    ).rejects.toThrow(/ISO-8601/);
  });
});

describe.each(COMBINATIONS)("generateReport %o", ({ type, format }) => {
  it("produces bytes that parse back in the target format", async () => {
    const report = await generateReport({ type, format, generatedAt: GENERATED_AT });

    expect(report.type).toBe(type);
    expect(report.format).toBe(format);
    expect(report.filename.endsWith(`.${format}`)).toBe(true);
    expect(report.bytes.byteLength).toBeGreaterThan(200);
    expect(report.document.type).toBe(type);

    if (format === "pdf") {
      expect(report.contentType).toBe("application/pdf");
      const pdf = await PDFDocument.load(report.bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(0);
    } else if (format === "xlsx") {
      expect(report.contentType).toContain("spreadsheetml");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(report.bytes.slice().buffer);
      expect(workbook.worksheets.length).toBe(report.document.sections.length + 1);
    } else {
      expect(report.contentType).toContain("text/csv");
      // The download carries a UTF-8 BOM for Excel. Asserted on the raw bytes:
      // `TextDecoder` silently swallows a leading BOM unless told not to, so
      // checking the decoded string would prove nothing either way.
      expect([report.bytes[0], report.bytes[1], report.bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

      const text = new TextDecoder().decode(report.bytes);
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
      expect(parsed.errors).toEqual([]);
      expect(parsed.data.length).toBeGreaterThan(0);
    }
  });
});
