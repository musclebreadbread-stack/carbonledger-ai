/**
 * Report catalogue and generation endpoint.
 *
 * `GET` does double duty, deliberately:
 *
 *  - without a `type`, it returns the catalogue — what can be generated, in what
 *    formats, over what default period.
 *  - with a `type`, it *generates and streams the file*.
 *
 * The download being a GET is what lets `/reports` be a plain Server Component
 * with ordinary `<a download>` links: no client-side fetch, no blob URL, no
 * Server Action. A POST-only generator would have forced the page to ship
 * JavaScript to do something a hyperlink already does.
 *
 * `POST` is the programmatic path for callers that would rather send a body, and
 * additionally supports `format=json` to retrieve the document model instead of a
 * rendered file.
 *
 * Route Handlers are not cached by default in Next.js 16, and reading
 * `request.nextUrl` makes this one request-time regardless, so no cache config is
 * needed here.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  DEFAULT_REPORT_YEAR,
  REPORT_TYPES,
  generateReport,
  generateReportDocument,
} from "@/lib/reports";
import {
  REPORT_FORMATS,
  REPORT_TYPE_IDS,
  isReportType,
  type ReportFormat,
  type ReportType,
} from "@/lib/reports/types";

/** `json` is accepted alongside the three rendered formats. */
const REQUESTABLE_FORMATS = [...REPORT_FORMATS, "json"] as const;
type RequestableFormat = (typeof REQUESTABLE_FORMATS)[number];

const DEFAULT_PERIOD = {
  start: `${DEFAULT_REPORT_YEAR}-01-01`,
  end: `${DEFAULT_REPORT_YEAR}-12-31`,
};

/**
 * Normalises a report type, accepting the legacy uppercase spellings.
 *
 * The previous version of this endpoint took `"ISO14064" | "CDP" | "GRI" |
 * "internal"`. The first three are the same reports under a different casing, so
 * they are folded in rather than broken. `"internal"` has no canonical
 * equivalent and is rejected with the valid list, which is more useful than
 * quietly mapping it to whichever report seemed closest.
 */
function normalizeType(value: unknown): ReportType | null {
  if (typeof value !== "string") return null;
  const lowered = value.toLowerCase();
  return isReportType(lowered) ? lowered : null;
}

function normalizeFormat(value: unknown, fallback: RequestableFormat): RequestableFormat | null {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return null;
  const lowered = value.toLowerCase();
  return (REQUESTABLE_FORMATS as readonly string[]).includes(lowered)
    ? (lowered as RequestableFormat)
    : null;
}

const GenerateReportSchema = z.object({
  type: z.string(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  organization_name: z.string().min(1).max(200).optional(),
  format: z.string().optional(),
});

function badRequest(error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status: 400 });
}

/** The catalogue: what this endpoint can produce. */
function catalogueResponse() {
  return Response.json({
    types: REPORT_TYPES.map((info) => ({
      id: info.id,
      label: info.label,
      standard_reference: info.standardReference,
      coverage: info.coverage,
      formats: info.formats,
    })),
    formats: REQUESTABLE_FORMATS,
    default_period: DEFAULT_PERIOD,
    /**
     * Stated in the payload rather than left for the caller to infer. Anything
     * consuming this API has the same obligation the UI does: not to present
     * sample figures as reported emissions.
     */
    is_sample_data: true,
    total: REPORT_TYPES.length,
  });
}

/**
 * Renders a report to an HTTP response.
 *
 * `Content-Disposition: attachment` with an ASCII filename — see
 * `reportFilename` for why the name is kept ASCII rather than localised.
 */
async function respondWithReport(options: {
  type: ReportType;
  format: RequestableFormat;
  periodStart?: string;
  periodEnd?: string;
  organizationName?: string;
}): Promise<Response> {
  if (options.format === "json") {
    const document = await generateReportDocument({
      type: options.type,
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
      organizationName: options.organizationName,
    });
    return Response.json(document);
  }

  const report = await generateReport({
    type: options.type,
    format: options.format as ReportFormat,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    organizationName: options.organizationName,
  });

  return new Response(report.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": report.contentType,
      "Content-Length": String(report.bytes.byteLength),
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      // A generated report is specific to the moment it was asked for and must
      // never be served from a shared cache to another tenant.
      "Cache-Control": "no-store",
      "X-Report-Type": report.type,
      "X-Report-Sample-Data": String(report.document.isSampleData),
    },
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawType = params.get("type");

  if (rawType === null) return catalogueResponse();

  const type = normalizeType(rawType);
  if (type === null) {
    return badRequest(`Unknown report type: ${rawType}`, { valid_types: REPORT_TYPE_IDS });
  }

  const format = normalizeFormat(params.get("format"), "pdf");
  if (format === null) {
    return badRequest(`Unknown format: ${params.get("format")}`, {
      valid_formats: REQUESTABLE_FORMATS,
    });
  }

  try {
    return await respondWithReport({
      type,
      format,
      periodStart: params.get("period_start") ?? undefined,
      periodEnd: params.get("period_end") ?? undefined,
      organizationName: params.get("organization_name") ?? undefined,
    });
  } catch (error) {
    return handleGenerationError(error);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be JSON");
  }

  const parsed = GenerateReportSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Validation failed", { details: parsed.error.issues });
  }

  const type = normalizeType(parsed.data.type);
  if (type === null) {
    return badRequest(`Unknown report type: ${parsed.data.type}`, {
      valid_types: REPORT_TYPE_IDS,
    });
  }

  const format = normalizeFormat(parsed.data.format, "pdf");
  if (format === null) {
    return badRequest(`Unknown format: ${parsed.data.format}`, {
      valid_formats: REQUESTABLE_FORMATS,
    });
  }

  try {
    return await respondWithReport({
      type,
      format,
      periodStart: parsed.data.period_start,
      periodEnd: parsed.data.period_end,
      organizationName: parsed.data.organization_name,
    });
  } catch (error) {
    return handleGenerationError(error);
  }
}

/**
 * Period validation failures are the caller's fault, so they are 400s carrying
 * the reason. Anything else is ours and stays a 500 with no internals leaked.
 */
function handleGenerationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (/ISO-8601|is after/.test(message)) return badRequest(message);

  console.error("Report generation failed", error);
  return Response.json({ error: "Report generation failed" }, { status: 500 });
}
