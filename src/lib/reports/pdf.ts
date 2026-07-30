/**
 * PDF renderer, built on pdf-lib's standard fonts.
 *
 * ## The Korean problem, and the decision taken
 *
 * pdf-lib's 14 standard fonts (Helvetica and friends) are **WinAnsi-encoded**.
 * `drawText` and even `widthOfTextAtSize` throw on any code point outside
 * CP1252 — including every Hangul syllable. Korean is this application's default
 * locale, so a naive implementation crashes at runtime for the majority of
 * users, on the happy path.
 *
 * Two ways out:
 *
 *  1. Register `@pdf-lib/fontkit` and embed a CJK font. Correct output, but it
 *     means a new dependency plus a multi-megabyte font binary committed to the
 *     repository, for a document body that CDP, ISSB and SBTi accept in English
 *     anyway.
 *  2. Keep the document body Latin, and make that a stated product limitation
 *     rather than an accident.
 *
 * This file takes route 2, and takes it defensively rather than optimistically:
 *
 *  - Templates build English bodies (see the language note in `types.ts`).
 *  - **Every** string still passes through `sanitizeWinAnsi` before it reaches
 *    pdf-lib. That is the part that matters. A supplier named in Hangul, a
 *    stored methodology string, a future locale leaking through — any of those
 *    would otherwise be an unhandled exception in a download handler. Instead
 *    the unsupported run is replaced with `?` and the document carries a visible
 *    footnote saying characters were dropped.
 *
 * `npx tsx` cannot be relied on to catch this; `tests/lib/reports/pdf.test.ts`
 * drives Korean, Japanese and Chinese text through the renderer and asserts the
 * result is a loadable PDF rather than a thrown error.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ReportDocument, ReportTable } from "./types";

/* ------------------------------------------------------------------------- *
 * Encoding safety
 * ------------------------------------------------------------------------- */

/**
 * Code points the WinAnsi (CP1252) encoding can represent.
 *
 * 0x20-0x7E is printable ASCII and 0xA0-0xFF is the Latin-1 supplement. The
 * 0x80-0x9F band in CP1252 holds typographic extras (curly quotes, dashes, the
 * euro sign) at code points that do *not* match their Unicode values, so rather
 * than encode that mapping the common ones are transliterated below and the rest
 * are treated as unsupported.
 */
function isWinAnsiRepresentable(codePoint: number): boolean {
  return (codePoint >= 0x20 && codePoint <= 0x7e) || (codePoint >= 0xa0 && codePoint <= 0xff);
}

/**
 * Characters worth transliterating rather than dropping.
 *
 * These turn up in real report text — arrows in pathway descriptions, en dashes
 * in year ranges, the degree sign in "1.5C" — and losing them to a `?` would
 * make otherwise fine sentences look broken.
 */
const TRANSLITERATIONS: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "...",
  "\u2192": "->",
  "\u2190": "<-",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2212": "-",
  "\u00b7": "-",
  "\u20a9": "KRW",
  "\u20ac": "EUR",
  "\u2103": "degC",
  "\u00a0": " ",
  "\u2022": "*",
  "\u2032": "'",
  "\u2033": '"',
};

export interface SanitizeResult {
  text: string;
  /** True when at least one character could not be represented. */
  droppedCharacters: boolean;
}

/**
 * Makes a string safe for a WinAnsi standard font.
 *
 * Consecutive unsupported characters collapse to a single `?` rather than one
 * `?` each: a dropped Korean phrase reads as `?` instead of `??????`, which is
 * both shorter and less likely to be mistaken for corrupted Latin text.
 */
export function sanitizeWinAnsi(input: string): SanitizeResult {
  let out = "";
  let dropped = false;
  let inDroppedRun = false;

  for (const character of input) {
    const transliteration = TRANSLITERATIONS[character];
    if (transliteration !== undefined) {
      out += transliteration;
      inDroppedRun = false;
      continue;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    if (isWinAnsiRepresentable(codePoint)) {
      out += character;
      inDroppedRun = false;
      continue;
    }

    dropped = true;
    if (!inDroppedRun) {
      out += "?";
      inDroppedRun = true;
    }
  }

  return { text: out, droppedCharacters: dropped };
}

/* ------------------------------------------------------------------------- *
 * Layout constants
 * ------------------------------------------------------------------------- */

/** A4 in PostScript points. */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 28;

const SIZE = {
  documentTitle: 20,
  subtitle: 10.5,
  sectionTitle: 13,
  body: 9.5,
  table: 8,
  footer: 7.5,
} as const;

const LINE_GAP = 1.35;
const CELL_PADDING = 4;

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.44, 0.48);
const RULE = rgb(0.82, 0.83, 0.85);
const HEADER_FILL = rgb(0.94, 0.95, 0.96);
const WARNING_FILL = rgb(1, 0.96, 0.86);
const WARNING_INK = rgb(0.45, 0.28, 0.02);

/* ------------------------------------------------------------------------- *
 * Cursor
 * ------------------------------------------------------------------------- */

/**
 * Mutable render state.
 *
 * A cursor object rather than threading `y` through every function: table
 * rendering has to be able to break a page mid-table and keep drawing, and
 * returning a new y from every primitive made that unreadable.
 */
interface Cursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  /** Set when any string lost characters to sanitisation. */
  droppedCharacters: boolean;
}

function newPage(cursor: Cursor): void {
  cursor.page = cursor.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cursor.y = PAGE_HEIGHT - MARGIN;
}

/** Ensures `needed` points of vertical space, starting a page if not. */
function ensureSpace(cursor: Cursor, needed: number): void {
  if (cursor.y - needed < MARGIN + FOOTER_HEIGHT) newPage(cursor);
}

/** Sanitises, recording on the cursor whether anything was lost. */
function safe(cursor: Cursor, text: string): string {
  const result = sanitizeWinAnsi(text);
  if (result.droppedCharacters) cursor.droppedCharacters = true;
  return result.text;
}

/* ------------------------------------------------------------------------- *
 * Text primitives
 * ------------------------------------------------------------------------- */

/**
 * Greedy word wrap against real glyph widths.
 *
 * A word longer than `maxWidth` (a long URL, a run-together identifier) is
 * broken character by character rather than allowed to overflow the margin,
 * which is the failure mode of a naive `split(" ")` wrapper.
 */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current === "" ? word : `${current} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current !== "") lines.push(current);

      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }

      // Hard-break an over-long word.
      let chunk = "";
      for (const character of word) {
        if (font.widthOfTextAtSize(chunk + character, size) > maxWidth && chunk !== "") {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk += character;
        }
      }
      current = chunk;
    }
    if (current !== "") lines.push(current);
  }

  return lines;
}

function drawWrapped(
  cursor: Cursor,
  text: string,
  options: {
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
    x?: number;
    width?: number;
    spaceAfter?: number;
  }
): void {
  const { size, font } = options;
  const x = options.x ?? MARGIN;
  const width = options.width ?? CONTENT_WIDTH;
  const lineHeight = size * LINE_GAP;
  const lines = wrapText(safe(cursor, text), font, size, width);

  for (const line of lines) {
    ensureSpace(cursor, lineHeight);
    cursor.page.drawText(line, {
      x,
      y: cursor.y - size,
      size,
      font,
      color: options.color ?? INK,
    });
    cursor.y -= lineHeight;
  }
  cursor.y -= options.spaceAfter ?? 0;
}

/* ------------------------------------------------------------------------- *
 * Blocks
 * ------------------------------------------------------------------------- */

function drawKeyValues(cursor: Cursor, items: readonly { label: string; value: string }[]): void {
  const labelWidth = CONTENT_WIDTH * 0.46;
  const valueWidth = CONTENT_WIDTH - labelWidth - 10;

  for (const item of items) {
    const labelLines = wrapText(safe(cursor, item.label), cursor.regular, SIZE.body, labelWidth);
    const valueLines = wrapText(safe(cursor, item.value), cursor.bold, SIZE.body, valueWidth);
    const rowHeight = Math.max(labelLines.length, valueLines.length) * SIZE.body * LINE_GAP;

    ensureSpace(cursor, rowHeight + 2);
    const top = cursor.y;

    labelLines.forEach((line, index) => {
      cursor.page.drawText(line, {
        x: MARGIN,
        y: top - SIZE.body - index * SIZE.body * LINE_GAP,
        size: SIZE.body,
        font: cursor.regular,
        color: MUTED,
      });
    });
    valueLines.forEach((line, index) => {
      cursor.page.drawText(line, {
        x: MARGIN + labelWidth + 10,
        y: top - SIZE.body - index * SIZE.body * LINE_GAP,
        size: SIZE.body,
        font: cursor.bold,
        color: INK,
      });
    });

    cursor.y = top - rowHeight - 2;
  }
  cursor.y -= 6;
}

/** Renders a cell value; `null` becomes an em-dash placeholder. */
function cellText(value: string | number | null): string {
  if (value === null) return "-";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? new Intl.NumberFormat("en-US").format(value)
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
  }
  return value;
}

/**
 * Column widths: natural width, then proportionally squeezed to fit.
 *
 * Sampling only the first 40 rows for the natural width is a deliberate cap —
 * measuring every cell of a 200-row table costs more than the layout gains, and
 * cells wrap anyway.
 */
function columnWidths(cursor: Cursor, table: ReportTable): number[] {
  const sample = table.rows.slice(0, 40);
  const natural = table.columns.map((column, index) => {
    let width = cursor.bold.widthOfTextAtSize(safe(cursor, column), SIZE.table);
    for (const row of sample) {
      const text = safe(cursor, cellText(row[index] ?? null));
      width = Math.max(width, cursor.regular.widthOfTextAtSize(text, SIZE.table));
    }
    return width + CELL_PADDING * 2;
  });

  const total = natural.reduce((sum, width) => sum + width, 0);
  if (total <= CONTENT_WIDTH) {
    // Distribute the slack so the table spans the text block rather than
    // leaving a ragged right edge.
    const slack = (CONTENT_WIDTH - total) / natural.length;
    return natural.map((width) => width + slack);
  }

  const minimum = 34;
  const scaled = natural.map((width) => Math.max(minimum, (width / total) * CONTENT_WIDTH));
  const scaledTotal = scaled.reduce((sum, width) => sum + width, 0);
  return scaled.map((width) => (width / scaledTotal) * CONTENT_WIDTH);
}

function drawTable(cursor: Cursor, table: ReportTable): void {
  if (table.columns.length === 0) return;

  const widths = columnWidths(cursor, table);
  const numeric = new Set(table.numericColumns ?? []);
  const lineHeight = SIZE.table * LINE_GAP;

  const drawHeader = () => {
    const cells = table.columns.map((column, index) =>
      wrapText(safe(cursor, column), cursor.bold, SIZE.table, widths[index] - CELL_PADDING * 2)
    );
    const height = Math.max(...cells.map((lines) => lines.length)) * lineHeight + CELL_PADDING;

    ensureSpace(cursor, height + lineHeight);
    const top = cursor.y;

    cursor.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: CONTENT_WIDTH,
      height,
      color: HEADER_FILL,
    });

    let x = MARGIN;
    cells.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        cursor.page.drawText(line, {
          x: x + CELL_PADDING,
          y: top - SIZE.table - CELL_PADDING / 2 - lineIndex * lineHeight,
          size: SIZE.table,
          font: cursor.bold,
          color: INK,
        });
      });
      x += widths[index];
    });

    cursor.y = top - height;
  };

  drawHeader();

  for (const row of table.rows) {
    const cells = table.columns.map((_, index) =>
      wrapText(
        safe(cursor, cellText(row[index] ?? null)),
        cursor.regular,
        SIZE.table,
        widths[index] - CELL_PADDING * 2
      )
    );
    const height = Math.max(...cells.map((lines) => lines.length)) * lineHeight + CELL_PADDING / 2;

    // A row that will not fit starts a new page *with its header repeated*, so a
    // table spanning pages stays readable instead of turning into anonymous
    // columns of numbers.
    if (cursor.y - height < MARGIN + FOOTER_HEIGHT) {
      newPage(cursor);
      drawHeader();
    }

    const top = cursor.y;
    let x = MARGIN;
    cells.forEach((lines, index) => {
      const rightAlign = numeric.has(index);
      lines.forEach((line, lineIndex) => {
        const textWidth = cursor.regular.widthOfTextAtSize(line, SIZE.table);
        const cellX = rightAlign ? x + widths[index] - CELL_PADDING - textWidth : x + CELL_PADDING;
        cursor.page.drawText(line, {
          x: cellX,
          y: top - SIZE.table - lineIndex * lineHeight,
          size: SIZE.table,
          font: cursor.regular,
          color: INK,
        });
      });
      x += widths[index];
    });

    cursor.page.drawLine({
      start: { x: MARGIN, y: top - height },
      end: { x: MARGIN + CONTENT_WIDTH, y: top - height },
      thickness: 0.4,
      color: RULE,
    });

    cursor.y = top - height;
  }

  cursor.y -= 10;
}

/* ------------------------------------------------------------------------- *
 * Document
 * ------------------------------------------------------------------------- */

function drawCoverBlock(cursor: Cursor, document: ReportDocument): void {
  drawWrapped(cursor, document.title, {
    size: SIZE.documentTitle,
    font: cursor.bold,
    spaceAfter: 4,
  });
  drawWrapped(cursor, document.standardReference, {
    size: SIZE.subtitle,
    font: cursor.regular,
    color: MUTED,
    spaceAfter: 10,
  });

  drawKeyValues(cursor, [
    { label: "Reporting organisation", value: document.organizationName },
    { label: "Reporting period", value: `${document.periodStart} to ${document.periodEnd}` },
    { label: "Generated at", value: document.generatedAt },
    {
      label: "Coverage",
      value:
        document.coverage === "full"
          ? "Full - all disclosures derived from data"
          : "Partial - quantitative disclosures only",
    },
  ]);

  for (const note of document.notes) {
    const size = SIZE.body;
    const lines = wrapText(safe(cursor, note), cursor.regular, size, CONTENT_WIDTH - 16);
    const height = lines.length * size * LINE_GAP + 10;

    ensureSpace(cursor, height + 6);
    const top = cursor.y;

    cursor.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: CONTENT_WIDTH,
      height,
      color: WARNING_FILL,
    });
    lines.forEach((line, index) => {
      cursor.page.drawText(line, {
        x: MARGIN + 8,
        y: top - size - 5 - index * size * LINE_GAP,
        size,
        font: cursor.regular,
        color: WARNING_INK,
      });
    });

    cursor.y = top - height - 6;
  }

  cursor.y -= 6;
}

function drawSectionHeading(cursor: Cursor, index: number, title: string): void {
  const heading = `${index}. ${title}`;
  ensureSpace(cursor, SIZE.sectionTitle * LINE_GAP + 14);
  cursor.y -= 6;
  drawWrapped(cursor, heading, {
    size: SIZE.sectionTitle,
    font: cursor.bold,
    spaceAfter: 2,
  });
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y + 2 },
    end: { x: MARGIN + CONTENT_WIDTH, y: cursor.y + 2 },
    thickness: 0.8,
    color: RULE,
  });
  cursor.y -= 8;
}

/**
 * Renders a report document to PDF bytes.
 *
 * Never throws on content: unrepresentable characters are replaced and noted in
 * the footer rather than aborting the download.
 */
export async function renderPdf(document: ReportDocument): Promise<Uint8Array> {
  // `updateMetadata: false` matters twice over: pdf-lib otherwise overwrites
  // Producer and ModDate on every `save()`, discarding what is set below, and it
  // stamps the wall clock, which would make two exports of the same period
  // differ byte for byte for no substantive reason.
  const doc = await PDFDocument.create({ updateMetadata: false });
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const generatedAt = new Date(document.generatedAt);
  doc.setTitle(sanitizeWinAnsi(document.title).text);
  doc.setSubject(sanitizeWinAnsi(document.standardReference).text);
  doc.setAuthor(sanitizeWinAnsi(document.organizationName).text);
  doc.setProducer("CarbonLedger AI");
  doc.setCreator("CarbonLedger AI");
  doc.setCreationDate(generatedAt);
  doc.setModificationDate(generatedAt);

  const cursor: Cursor = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
    regular,
    bold,
    droppedCharacters: false,
  };

  drawCoverBlock(cursor, document);

  document.sections.forEach((section, index) => {
    drawSectionHeading(cursor, index + 1, section.title);
    for (const block of section.blocks) {
      if (block.kind === "paragraph") {
        drawWrapped(cursor, block.text, {
          size: SIZE.body,
          font: cursor.regular,
          color: MUTED,
          spaceAfter: 8,
        });
      } else if (block.kind === "keyValues") {
        drawKeyValues(cursor, block.items);
      } else {
        drawTable(cursor, block.table);
      }
    }
  });

  drawFooters(cursor, document);

  return doc.save();
}

/**
 * Footers are drawn last because "Page 3 of 11" needs the final page count,
 * which is only known once every section has been laid out.
 */
function drawFooters(cursor: Cursor, document: ReportDocument): void {
  const pages = cursor.doc.getPages();
  const left = sanitizeWinAnsi(
    `${document.organizationName} - ${document.title}${
      document.isSampleData ? " - SAMPLE DATA" : ""
    }`
  ).text;
  const encodingNote = cursor.droppedCharacters
    ? " - some characters could not be represented in this PDF and were replaced with ?"
    : "";

  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: MARGIN + FOOTER_HEIGHT - 6 },
      end: { x: MARGIN + CONTENT_WIDTH, y: MARGIN + FOOTER_HEIGHT - 6 },
      thickness: 0.4,
      color: RULE,
    });

    const leftText = wrapText(
      left + encodingNote,
      cursor.regular,
      SIZE.footer,
      CONTENT_WIDTH - 70
    )[0];
    page.drawText(leftText ?? "", {
      x: MARGIN,
      y: MARGIN + FOOTER_HEIGHT - 18,
      size: SIZE.footer,
      font: cursor.regular,
      color: MUTED,
    });

    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    page.drawText(pageLabel, {
      x: MARGIN + CONTENT_WIDTH - cursor.regular.widthOfTextAtSize(pageLabel, SIZE.footer),
      y: MARGIN + FOOTER_HEIGHT - 18,
      size: SIZE.footer,
      font: cursor.regular,
      color: MUTED,
    });
  });
}
