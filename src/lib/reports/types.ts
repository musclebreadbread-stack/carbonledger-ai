/**
 * The document model every report generator renders from.
 *
 * The nine promised report types (ISO 14064, CDP, SBTi, ISSB, GRI, TCFD, CSRD,
 * ESG, Sustainability) differ in *what* they disclose, not in *how* a PDF, a
 * workbook or a CSV is laid out. So the pipeline is deliberately two-stage:
 *
 *   dataset  ->  ReportDocument  ->  bytes
 *   (data)       (templates/)        (pdf.ts | xlsx.ts | csv.ts)
 *
 * A template's only job is to turn measured figures into an ordered list of
 * sections and blocks. A renderer's only job is to lay that out. Neither knows
 * about the other, which is what keeps "add a report type" from touching the
 * renderers and "fix table pagination" from touching nine templates.
 *
 * ## Language of the document body
 *
 * Report bodies are generated in **English**, in every UI locale. Two reasons,
 * one practical and one deliberate:
 *
 *  - pdf-lib's 14 standard fonts are WinAnsi-encoded and *throw* on any
 *    character outside CP1252. Korean is this app's default locale, so a PDF
 *    that interpolated UI strings would crash at runtime on the default
 *    language. `pdf.ts` sanitises defensively, but the real fix is not to feed
 *    it CJK text in the first place. Embedding a CJK font (fontkit + a ~5 MB
 *    Noto Sans KR binary in the repo) was the alternative and was rejected: it
 *    is a large binary asset and a new dependency for a body of text that is,
 *    for CDP/ISSB/SBTi, submitted in English anyway.
 *  - The labels come from the existing `en.json` catalogue rather than a
 *    duplicate table, so an English report says exactly what the English UI
 *    says.
 *
 * The `/reports` page states this limitation in all four locales rather than
 * leaving the user to discover it. See `reports.format_notice`.
 */

/** The nine report types, matching the `report_type` enum in 0001_initial_schema.sql. */
export type ReportType =
  "iso14064" | "cdp" | "sbti" | "issb" | "gri" | "tcfd" | "csrd" | "esg" | "sustainability";

export const REPORT_TYPE_IDS: readonly ReportType[] = [
  "iso14064",
  "cdp",
  "sbti",
  "issb",
  "gri",
  "tcfd",
  "csrd",
  "esg",
  "sustainability",
];

/** Output formats a report can be rendered to. */
export type ReportFormat = "pdf" | "xlsx" | "csv";

export const REPORT_FORMATS: readonly ReportFormat[] = ["pdf", "xlsx", "csv"];

/**
 * How completely a report type is implemented.
 *
 * `full` — every disclosure the template claims is derived from data.
 * `partial` — the quantitative disclosures are derived from data, but the
 *   framework also requires governance/strategy/risk narrative that no table in
 *   this system holds. Those rows are emitted with an explicit
 *   "requires narrative input" marker rather than being silently omitted or,
 *   worse, filled with invented prose. TCFD, ISSB (IFRS S2) and CSRD (ESRS E1)
 *   are in this state.
 */
export type ReportCoverage = "full" | "partial";

/** Marker used for a disclosure the framework requires but no data can fill. */
export const NARRATIVE_REQUIRED = "Not available - requires narrative input";

/** A single labelled figure, rendered as a two-column row. */
export interface ReportKeyValue {
  label: string;
  value: string;
}

/**
 * A rectangular table.
 *
 * `numericColumns` marks the column indices that hold quantities, which the
 * renderers use to right-align (PDF, XLSX) and to avoid quoting numbers as text
 * in the workbook. It is explicit rather than sniffed from the values because a
 * column of years and a column of tonnages want different formatting even
 * though both are numbers.
 */
export interface ReportTable {
  columns: string[];
  rows: (string | number | null)[][];
  numericColumns?: number[];
}

export type ReportBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "keyValues"; items: ReportKeyValue[] }
  | { kind: "table"; table: ReportTable };

export interface ReportSection {
  /**
   * Stable machine identifier, e.g. `"305-1"` for a GRI disclosure. Used as the
   * CSV `section_id` column and to seed worksheet names, so it must not change
   * casually — a consumer diffing two exports keys off it.
   */
  id: string;
  title: string;
  blocks: ReportBlock[];
}

/** A rendered-ready report: metadata plus an ordered list of sections. */
export interface ReportDocument {
  type: ReportType;
  /** Document title, e.g. "GHG Inventory Report (ISO 14064-1)". */
  title: string;
  /** The standard or framework this report answers to. */
  standardReference: string;
  coverage: ReportCoverage;
  organizationName: string;
  /** Inclusive reporting period bounds as ISO-8601 dates (`YYYY-MM-DD`). */
  periodStart: string;
  periodEnd: string;
  /** ISO-8601 instant the document was generated. */
  generatedAt: string;
  /**
   * True when any figure in the document came from a sample-data provider.
   * Every renderer stamps a visible disclaimer off this flag; it is never a
   * silent field.
   */
  isSampleData: boolean;
  /** Caveats shown up front: sample data, partial coverage, unit conventions. */
  notes: string[];
  sections: ReportSection[];
}

/** What a caller asks for. */
export interface ReportRequest {
  type: ReportType;
  format: ReportFormat;
  /** ISO-8601 date. Defaults to the start of the sample reporting year. */
  periodStart?: string;
  /** ISO-8601 date. Defaults to the end of the sample reporting year. */
  periodEnd?: string;
  organizationName?: string;
  /** Fixed instant for the `generatedAt` stamp. Tests pass one for determinism. */
  generatedAt?: Date;
}

/** A generated artifact, ready to hand to an HTTP response or write to disk. */
export interface GeneratedReport {
  type: ReportType;
  format: ReportFormat;
  /** Suggested download filename, including extension. */
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  /** The document the bytes were rendered from, for callers wanting the data. */
  document: ReportDocument;
}

export const CONTENT_TYPES: Record<ReportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

export const FILE_EXTENSIONS: Record<ReportFormat, string> = {
  pdf: "pdf",
  xlsx: "xlsx",
  csv: "csv",
};

/** Type guards, used to validate untrusted query strings and request bodies. */
export function isReportType(value: unknown): value is ReportType {
  return typeof value === "string" && (REPORT_TYPE_IDS as readonly string[]).includes(value);
}

export function isReportFormat(value: unknown): value is ReportFormat {
  return typeof value === "string" && (REPORT_FORMATS as readonly string[]).includes(value);
}
