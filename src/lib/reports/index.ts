/**
 * Public entry point for report generation.
 *
 * `generateReport` is the whole API: give it a type and a format, get back bytes
 * plus everything an HTTP response needs. The three renderers are imported
 * lazily so a caller that only wants CSV does not pay to load pdf-lib and
 * ExcelJS, which matters in a serverless cold start.
 */

import { loadReportDataset } from "./dataset";
import { buildReportDocument } from "./templates";
import {
  CONTENT_TYPES,
  FILE_EXTENSIONS,
  type GeneratedReport,
  type ReportDocument,
  type ReportRequest,
} from "./types";

export { REPORT_TYPES, reportTypeInfo, type ReportTypeInfo } from "./registry";
export { loadReportDataset, DEFAULT_ORGANIZATION_NAME, DEFAULT_REPORT_YEAR } from "./dataset";
export { buildReportDocument } from "./templates";
export { sanitizeWinAnsi } from "./pdf";
export { toCsvRows, renderCsvString, CSV_COLUMNS } from "./csv";
export { sanitizeSheetName, uniqueSheetName } from "./xlsx";
export * from "./types";

/**
 * Download filename.
 *
 * Deliberately ASCII-only and free of spaces: a `Content-Disposition` filename
 * containing non-ASCII needs RFC 5987 encoding that not every client honours, and
 * this name has to survive being saved on Windows, macOS and Linux alike.
 */
export function reportFilename(request: {
  type: string;
  format: keyof typeof FILE_EXTENSIONS;
  periodStart: string;
  periodEnd: string;
}): string {
  return `carbonledger-${request.type}-${request.periodStart}_${request.periodEnd}.${
    FILE_EXTENSIONS[request.format]
  }`;
}

/** Builds the document without rendering it, for the JSON view of a report. */
export async function generateReportDocument(
  request: Omit<ReportRequest, "format">
): Promise<ReportDocument> {
  const dataset = await loadReportDataset({
    periodStart: request.periodStart,
    periodEnd: request.periodEnd,
    organizationName: request.organizationName,
  });
  return buildReportDocument(request.type, dataset, request.generatedAt ?? new Date());
}

/**
 * Generates a report end to end.
 *
 * Throws on an invalid period (see `loadReportDataset`); callers at the HTTP
 * boundary turn that into a 400 rather than a 500, because it is the caller's
 * input that was wrong.
 */
export async function generateReport(request: ReportRequest): Promise<GeneratedReport> {
  const document = await generateReportDocument(request);

  let bytes: Uint8Array;
  if (request.format === "pdf") {
    const { renderPdf } = await import("./pdf");
    bytes = await renderPdf(document);
  } else if (request.format === "xlsx") {
    const { renderXlsx } = await import("./xlsx");
    bytes = await renderXlsx(document);
  } else {
    const { renderCsv } = await import("./csv");
    // BOM on: the download is opened in Excel far more often than it is piped
    // into a parser, and Papa Parse strips it on the way back in.
    bytes = renderCsv(document, { bom: true });
  }

  return {
    type: request.type,
    format: request.format,
    filename: reportFilename({
      type: request.type,
      format: request.format,
      periodStart: document.periodStart,
      periodEnd: document.periodEnd,
    }),
    contentType: CONTENT_TYPES[request.format],
    bytes,
    document,
  };
}
