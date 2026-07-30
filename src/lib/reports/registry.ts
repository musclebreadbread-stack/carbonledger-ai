/**
 * Catalogue of report types.
 *
 * Deliberately free of any renderer or template import: the `/reports` page is
 * a Server Component that only needs the list, and pulling `pdf.ts` (pdf-lib)
 * or `xlsx.ts` (exceljs) into that module graph would drag two heavy libraries
 * into a page render that never generates anything.
 *
 * `coverage` is the honest field. `partial` means the template emits the
 * framework's quantitative disclosures from real figures and marks the
 * qualitative ones as requiring narrative input — see `NARRATIVE_REQUIRED`.
 */

import type { ReportCoverage, ReportFormat, ReportType } from "./types";
import { REPORT_FORMATS } from "./types";

export interface ReportTypeInfo {
  id: ReportType;
  /**
   * Display name. Not translated: these are proper nouns of the standards
   * bodies ("CDP", "GRI 305", "ISSB IFRS S2") and are cited untranslated in
   * Korean disclosure practice too.
   */
  label: string;
  /** The clause, standard or questionnaire section the report answers to. */
  standardReference: string;
  coverage: ReportCoverage;
  formats: readonly ReportFormat[];
}

export const REPORT_TYPES: readonly ReportTypeInfo[] = [
  {
    id: "iso14064",
    label: "ISO 14064-1",
    standardReference: "ISO 14064-1:2018, clauses 8-9 (GHG inventory report)",
    coverage: "full",
    formats: REPORT_FORMATS,
  },
  {
    id: "cdp",
    label: "CDP Climate Change",
    standardReference: "CDP Climate Change questionnaire, modules C4, C5, C6, C7",
    coverage: "full",
    formats: REPORT_FORMATS,
  },
  {
    id: "sbti",
    label: "SBTi",
    standardReference: "SBTi Corporate Near-Term Criteria (target validation and progress)",
    coverage: "full",
    formats: REPORT_FORMATS,
  },
  {
    id: "gri",
    label: "GRI 305",
    standardReference: "GRI 305: Emissions 2016, disclosures 305-1 to 305-5",
    coverage: "full",
    formats: REPORT_FORMATS,
  },
  {
    id: "esg",
    label: "ESG Report",
    standardReference: "Internal ESG summary (environmental chapter)",
    coverage: "full",
    formats: REPORT_FORMATS,
  },
  {
    id: "sustainability",
    label: "Sustainability Report",
    standardReference: "Internal sustainability report (climate chapter)",
    coverage: "full",
    formats: REPORT_FORMATS,
  },
  {
    id: "issb",
    label: "ISSB IFRS S2",
    standardReference: "IFRS S2 Climate-related Disclosures, paragraphs 29-37",
    coverage: "partial",
    formats: REPORT_FORMATS,
  },
  {
    id: "tcfd",
    label: "TCFD",
    standardReference: "TCFD Recommendations: Governance, Strategy, Risk Management, Metrics",
    coverage: "partial",
    formats: REPORT_FORMATS,
  },
  {
    id: "csrd",
    label: "CSRD / ESRS E1",
    standardReference: "ESRS E1 Climate change, disclosure requirements E1-1 to E1-9",
    coverage: "partial",
    formats: REPORT_FORMATS,
  },
];

const BY_ID = new Map<ReportType, ReportTypeInfo>(REPORT_TYPES.map((info) => [info.id, info]));

/**
 * Metadata for a report type.
 *
 * Throws rather than returning undefined: every caller is either handling a
 * validated `ReportType` or iterating `REPORT_TYPES`, so a miss is a
 * programming error and should not be papered over with a default.
 */
export function reportTypeInfo(type: ReportType): ReportTypeInfo {
  const info = BY_ID.get(type);
  if (!info) throw new Error(`Unknown report type: ${type}`);
  return info;
}
