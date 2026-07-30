/**
 * PDF renderer tests.
 *
 * Verification is by re-parsing, not by inspection: every generated document is
 * loaded back through `PDFDocument.load`, which fails on a malformed xref table
 * or a truncated stream, and the page geometry is checked against what was asked
 * for. A test that only asserted `bytes.length > 0` would pass on garbage.
 *
 * The Korean cases are the reason this file exists. pdf-lib's standard fonts are
 * WinAnsi-encoded and throw on Hangul; Korean is this app's default locale, so
 * "does not throw on CJK input" is a correctness property, not a nicety.
 */

import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { loadReportDataset } from "@/lib/reports/dataset";
import { renderPdf, sanitizeWinAnsi, wrapText } from "@/lib/reports/pdf";
import { buildReportDocument } from "@/lib/reports/templates";
import { REPORT_TYPE_IDS } from "@/lib/reports/types";
import { CHINESE_TEXT, JAPANESE_TEXT, KOREAN_TEXT, hostileDocument } from "./fixtures";

const GENERATED_AT = new Date("2025-01-15T09:30:00.000Z");
const PDF_MAGIC = "%PDF-";

/** A4 in points, as `pdf.ts` sets it. */
const A4 = { width: 595.28, height: 841.89 };

describe("sanitizeWinAnsi", () => {
  it("passes ASCII through untouched", () => {
    const result = sanitizeWinAnsi("Scope 1 (direct): 4,300 tCO2e");
    expect(result.text).toBe("Scope 1 (direct): 4,300 tCO2e");
    expect(result.droppedCharacters).toBe(false);
  });

  it("keeps Latin-1 accented characters, which WinAnsi can represent", () => {
    const result = sanitizeWinAnsi("Société Générale — café");
    expect(result.text).toBe("Société Générale - café");
    // The em dash was transliterated, not dropped.
    expect(result.droppedCharacters).toBe(false);
  });

  it("transliterates typography instead of losing it", () => {
    expect(sanitizeWinAnsi("2018 \u2192 2030").text).toBe("2018 -> 2030");
    expect(sanitizeWinAnsi("\u2265 4.2%").text).toBe(">= 4.2%");
    expect(sanitizeWinAnsi("\u201cquoted\u201d").text).toBe('"quoted"');
    expect(sanitizeWinAnsi("wait\u2026").text).toBe("wait...");
  });

  it("collapses a run of unrepresentable characters to a single marker", () => {
    const result = sanitizeWinAnsi(KOREAN_TEXT);
    // Three space-separated Hangul words -> three collapsed runs, spaces kept.
    expect(result.text).toBe("? ? ?");
    expect(result.droppedCharacters).toBe(true);
  });

  it("flags Japanese and Chinese as dropped too", () => {
    expect(sanitizeWinAnsi(JAPANESE_TEXT).droppedCharacters).toBe(true);
    expect(sanitizeWinAnsi(CHINESE_TEXT).droppedCharacters).toBe(true);
  });

  it("produces output the standard font can actually encode", async () => {
    // The real invariant: whatever comes out must not throw in pdf-lib. This is
    // the assertion that would have caught a sanitiser that missed a code point.
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const inputs = [KOREAN_TEXT, JAPANESE_TEXT, CHINESE_TEXT, "emoji \u{1F600}", "\u0000\u001f"];

    for (const input of inputs) {
      const { text } = sanitizeWinAnsi(input);
      expect(() => font.widthOfTextAtSize(text, 10)).not.toThrow();
      expect(() => doc.addPage().drawText(text, { x: 10, y: 10, size: 10, font })).not.toThrow();
    }
  });
});

describe("wrapText", () => {
  it("breaks on word boundaries within the given width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("one two three four five six seven eight", font, 10, 60);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(60);
    }
  });

  it("hard-breaks a single word too long for the line instead of overflowing", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("A".repeat(200), font, 10, 50);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(50);
    }
  });

  it("preserves explicit newlines as line breaks", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(wrapText("first\nsecond", font, 10, 500)).toEqual(["first", "second"]);
  });
});

describe.each([...REPORT_TYPE_IDS])("%s PDF", (type) => {
  it("produces a file that parses back as a PDF", async () => {
    const dataset = await loadReportDataset();
    const document = buildReportDocument(type, dataset, GENERATED_AT);
    const bytes = await renderPdf(document);

    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe(PDF_MAGIC);

    // `updateMetadata: false` on load, or pdf-lib rewrites Producer and ModDate
    // in memory the moment the document is parsed and the assertions below would
    // be testing the loader rather than the file.
    const reloaded = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(reloaded.getPageCount()).toBeGreaterThan(0);

    const [first] = reloaded.getPages();
    expect(first.getWidth()).toBeCloseTo(A4.width, 1);
    expect(first.getHeight()).toBeCloseTo(A4.height, 1);

    // Metadata survived, which also proves the trailer was written correctly.
    expect(reloaded.getTitle()).toBe(sanitizeWinAnsi(document.title).text);
    expect(reloaded.getProducer()).toBe("CarbonLedger AI");
    expect(reloaded.getCreationDate()?.toISOString()).toBe(document.generatedAt);
  });
});

describe("PDF with non-Latin content", () => {
  it("renders Korean, Japanese and Chinese input without throwing", async () => {
    const bytes = await renderPdf(hostileDocument());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe(PDF_MAGIC);

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThan(0);
  });

  it("keeps the sanitised title in the document metadata", async () => {
    const bytes = await renderPdf(hostileDocument());
    const reloaded = await PDFDocument.load(bytes, { updateMetadata: false });
    // The Korean part of the title collapsed to markers; the Latin part survived.
    expect(reloaded.getTitle()).toContain("GHG Inventory");
    expect(reloaded.getTitle()).not.toContain(KOREAN_TEXT);
  });

  it("survives a value containing commas, quotes and embedded newlines", async () => {
    // The same hostile value CSV has to escape also has to not break layout.
    const bytes = await renderPdf(hostileDocument());
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });
});

describe("pagination", () => {
  it("spans multiple pages for a long report rather than clipping content", async () => {
    const dataset = await loadReportDataset();
    // The sustainability template is the longest: eleven sections including two
    // full Scope 3 tables and every supplier request.
    const document = buildReportDocument("sustainability", dataset, GENERATED_AT);
    const reloaded = await PDFDocument.load(await renderPdf(document));

    expect(reloaded.getPageCount()).toBeGreaterThan(1);
  });

  it("keeps every page at A4 after a page break", async () => {
    const dataset = await loadReportDataset();
    const document = buildReportDocument("csrd", dataset, GENERATED_AT);
    const reloaded = await PDFDocument.load(await renderPdf(document));

    for (const page of reloaded.getPages()) {
      expect(page.getWidth()).toBeCloseTo(A4.width, 1);
      expect(page.getHeight()).toBeCloseTo(A4.height, 1);
    }
  });
});
