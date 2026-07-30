/**
 * Reusable section builders shared by the nine report templates.
 *
 * Every framework asks for the same underlying facts in a different order with
 * different labels: an inventory table is an inventory table whether it is
 * ISO 14064-1 clause 9.3.1, GRI 305-1/2/3 or CDP C6.1. These builders own that
 * shared arithmetic once so a template is a short, readable statement of which
 * disclosures it makes.
 *
 * ## Where the English labels come from
 *
 * Source names, Scope 3 category names, methodologies and exclusion reasons are
 * read from the existing `en.json` catalogue rather than from a second table
 * maintained here. The report therefore says exactly what the English UI says,
 * and a wording fix lands in both at once. See the language note in `types.ts`
 * for why report bodies are English in every UI locale.
 */

import en from "@/messages/en.json";
import { SCOPE3_CATEGORIES } from "@/lib/scope3/categories";
import {
  calculatedCoveragePercent,
  totalScope3,
  weightedDataQuality,
  type Scope3CategoryNumber,
} from "@/lib/scope3/types";
import {
  SBTI_MIN_ANNUAL_LINEAR_REDUCTION_PCT,
  assessTarget,
  meetsSbtiLinearMinimum,
  type ReductionTarget,
} from "@/lib/targets/types";
import { aggregateByCategory, countRequests, responseRatePercent } from "@/lib/suppliers/types";
import { SAMPLE_AS_OF } from "@/lib/suppliers/sample-data";
import type { ReportDataset } from "./dataset";
import type { ReportBlock, ReportSection, ReportTable } from "./types";

/** Unit every absolute emission figure in a report is expressed in. */
export const EMISSION_UNIT = "tCO2e";

/* ------------------------------------------------------------------------- *
 * Formatting
 * ------------------------------------------------------------------------- */

/**
 * Fixed `en-US` grouping, not the user's locale.
 *
 * A disclosure document must not change its decimal separator based on who
 * clicked download — a reviewer diffing two exports of the same period would
 * see every number as changed.
 */
const INTEGER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatQuantity(value: number): string {
  return INTEGER.format(Math.round(value));
}

export function formatDecimal(value: number): string {
  return DECIMAL.format(value);
}

export function formatPercent(value: number): string {
  return `${DECIMAL.format(value)}%`;
}

/** Rounds to `decimals` places without trailing floating-point noise. */
export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/* ------------------------------------------------------------------------- *
 * Label lookups against en.json
 * ------------------------------------------------------------------------- */

const EMISSION_SOURCE_LABELS: Record<string, string> = en.emission_sources;
const SCOPE3_CATEGORY_LABELS: Record<string, string> = en.scope3_categories;
const SCOPE3_METHOD_LABELS: Record<string, string> = en.scope3.methods;
const SCOPE3_EXCLUSION_LABELS: Record<string, string> = en.scope3_exclusion_reasons;
const TARGET_DESCRIPTION_LABELS: Record<string, string> = en.target_descriptions;
const TARGET_METHODOLOGY_LABELS: Record<string, string> = en.targets.methodologies;
const SUPPLIER_INDUSTRY_LABELS: Record<string, string> = en.supplier_industries;

/**
 * Resolves a message key to its English label, falling back to the key itself.
 *
 * The fallback is not laziness: a database-backed provider returns *stored*
 * names rather than message keys, and those must pass through unchanged. This is
 * the same `has(key) ? t(key) : key` convention the pages already use.
 */
function label(table: Record<string, string>, key: string | null): string {
  if (key === null) return "-";
  return table[key] ?? key;
}

export function emissionSourceLabel(key: string): string {
  return label(EMISSION_SOURCE_LABELS, key);
}

export function scope3CategoryLabel(number: Scope3CategoryNumber): string {
  return label(SCOPE3_CATEGORY_LABELS, `cat${number}`);
}

export function scope3MethodLabel(method: string | null): string {
  return label(SCOPE3_METHOD_LABELS, method);
}

export function targetDescriptionLabel(key: string | null): string {
  return label(TARGET_DESCRIPTION_LABELS, key);
}

export function supplierIndustryLabel(key: string | null): string {
  return label(SUPPLIER_INDUSTRY_LABELS, key);
}

/* ------------------------------------------------------------------------- *
 * Shared derived figures
 * ------------------------------------------------------------------------- */

/**
 * Scope 3 as this system knows it, split by source.
 *
 * The dashboard's `kpis.scope3` and the `/scope3` page's category roll-up are
 * *different numbers* — the dashboard tracks the operational Scope 3 lines that
 * flow through `emission_records`, while the category view is the full value
 * chain inventory. Reporting either one alone would misstate the footprint, so
 * every template that touches Scope 3 states both and labels which is which.
 */
export interface Scope3Split {
  /** Scope 3 recorded alongside Scope 1 and 2 in the operational inventory. */
  operational: number;
  /** Total of all calculated Scope 3 categories (GHG Protocol 1-15). */
  valueChain: number;
  relevantCategories: number;
  calculatedCategories: number;
  coveragePercent: number;
  weightedDataQuality: number | null;
}

export function scope3Split(dataset: ReportDataset): Scope3Split {
  const { categories } = dataset.scope3;
  return {
    operational: dataset.dashboard.kpis.scope3,
    valueChain: round(totalScope3(categories)),
    relevantCategories: categories.filter((c) => c.relevance === "relevant").length,
    calculatedCategories: categories.filter((c) => c.emissions !== null).length,
    coveragePercent: calculatedCoveragePercent(categories),
    weightedDataQuality: weightedDataQuality(categories),
  };
}

/* ------------------------------------------------------------------------- *
 * Section builders
 * ------------------------------------------------------------------------- */

/**
 * Reporting boundary and inventory metadata.
 *
 * Every framework here opens with some version of "who is reporting, over what
 * period, using which consolidation approach and which GWP set".
 */
export function boundarySection(dataset: ReportDataset, id = "boundary"): ReportSection {
  return {
    id,
    title: "Reporting organisation and boundary",
    blocks: [
      {
        kind: "keyValues",
        items: [
          { label: "Reporting organisation", value: dataset.organizationName },
          {
            label: "Reporting period",
            value: `${dataset.periodStart} to ${dataset.periodEnd}`,
          },
          { label: "Reporting year", value: String(dataset.year) },
          { label: "Consolidation approach", value: "Operational control" },
          { label: "Global warming potentials", value: "IPCC AR5, 100-year" },
          { label: "Quantification unit", value: EMISSION_UNIT },
          {
            label: "Gases covered",
            value: "CO2, CH4, N2O, HFCs, PFCs, SF6 (aggregated as CO2e)",
          },
        ],
      },
    ],
  };
}

/** Headline totals by scope, plus intensity and year-over-year movement. */
export function emissionsSummarySection(
  dataset: ReportDataset,
  id = "summary",
  title = "GHG emissions summary"
): ReportSection {
  const { kpis } = dataset.dashboard;
  const split = scope3Split(dataset);

  return {
    id,
    title,
    blocks: [
      {
        kind: "table",
        table: {
          columns: ["Scope", `Emissions (${EMISSION_UNIT})`, "Share of total (%)"],
          numericColumns: [1, 2],
          rows: [
            [
              "Scope 1 (direct)",
              round(kpis.scope1),
              round((kpis.scope1 / kpis.totalEmissions) * 100),
            ],
            [
              "Scope 2 (indirect, energy)",
              round(kpis.scope2),
              round((kpis.scope2 / kpis.totalEmissions) * 100),
            ],
            [
              "Scope 3 (operational records)",
              round(kpis.scope3),
              round((kpis.scope3 / kpis.totalEmissions) * 100),
            ],
            ["Total (Scope 1+2+3 operational)", round(kpis.totalEmissions), 100],
          ],
        },
      },
      {
        kind: "keyValues",
        items: [
          {
            label: "Scope 3 value chain inventory (categories 1-15)",
            value: `${formatQuantity(split.valueChain)} ${EMISSION_UNIT}`,
          },
          {
            label: "Year-over-year change",
            value: formatPercent(dataset.dashboard.kpis.yoyChangePercent),
          },
          {
            label: `Emission intensity (${EMISSION_UNIT} per million KRW revenue)`,
            value: formatDecimal(kpis.intensityPerRevenue),
          },
          {
            label: "Progress against active reduction target",
            value: formatPercent(kpis.reductionProgressPercent),
          },
        ],
      },
      {
        kind: "paragraph",
        text:
          "The Scope 3 figure in the table above covers only the value chain activity recorded " +
          "in the operational inventory. The full GHG Protocol category 1-15 inventory is " +
          "reported separately and is the larger of the two; the two are not additive.",
      },
    ],
  };
}

/** Month-by-month emissions by scope — the audit trail behind the annual total. */
export function monthlyBreakdownSection(dataset: ReportDataset, id = "monthly"): ReportSection {
  const rows = dataset.dashboard.trend.map((point) => [
    point.period,
    round(point.scope1),
    round(point.scope2),
    round(point.scope3),
    round(point.scope1 + point.scope2 + point.scope3),
  ]);

  return {
    id,
    title: "Monthly emissions by scope",
    blocks: [
      {
        kind: "table",
        table: {
          columns: ["Period", "Scope 1", "Scope 2", "Scope 3", "Total"],
          numericColumns: [1, 2, 3, 4],
          rows,
        },
      },
      {
        kind: "paragraph",
        text: `All quantities in ${EMISSION_UNIT}. Periods are ISO-8601 year-months.`,
      },
    ],
  };
}

/** Largest emission sources, which is what every framework's "significant sources" ask means. */
export function significantSourcesSection(dataset: ReportDataset, id = "sources"): ReportSection {
  const rows = dataset.dashboard.topSources.map((source) => [
    source.rank,
    emissionSourceLabel(source.sourceKey),
    `Scope ${source.scope}`,
    round(source.emissions),
    source.share,
  ]);

  const ranked = dataset.dashboard.topSources.reduce((sum, s) => sum + s.emissions, 0);
  const remainder = dataset.dashboard.kpis.totalEmissions - ranked;

  return {
    id,
    title: "Significant emission sources",
    blocks: [
      {
        kind: "table",
        table: {
          columns: ["Rank", "Source", "Scope", `Emissions (${EMISSION_UNIT})`, "Share (%)"],
          numericColumns: [0, 3, 4],
          rows,
        },
      },
      {
        kind: "paragraph",
        text:
          `The ranked sources above account for ${formatQuantity(ranked)} ${EMISSION_UNIT}. ` +
          `The remaining ${formatQuantity(Math.max(0, remainder))} ${EMISSION_UNIT} is the ` +
          "long tail of smaller sources outside the top ten.",
      },
    ],
  };
}

/**
 * The full GHG Protocol Scope 3 category table.
 *
 * Reports all 15 categories including the ones judged not relevant, with the
 * exclusion reason. That is a requirement, not a courtesy: the Corporate Value
 * Chain Standard obliges a reporter to disclose which categories were excluded
 * and why, so an inventory listing only what it calculated is non-compliant.
 * Categories that are relevant but uncalculated show "Not calculated" rather
 * than 0, because zero is a claim and a gap is not.
 */
export function scope3CategoriesSection(
  dataset: ReportDataset,
  id = "scope3-categories"
): ReportSection {
  const byNumber = new Map(dataset.scope3.categories.map((c) => [c.number, c]));

  const rows = SCOPE3_CATEGORIES.map((definition) => {
    const status = byNumber.get(definition.number);
    const relevance = status?.relevance ?? "not_assessed";
    const emissions = status?.emissions ?? null;

    return [
      definition.number,
      scope3CategoryLabel(definition.number),
      definition.side === "upstream" ? "Upstream" : "Downstream",
      relevance === "relevant"
        ? "Relevant"
        : relevance === "not_relevant"
          ? "Not relevant"
          : "Not assessed",
      emissions === null ? "Not calculated" : round(emissions),
      scope3MethodLabel(status?.method ?? null),
      status?.dataQuality === null || status?.dataQuality === undefined ? "-" : status.dataQuality,
      status?.supplierCount ?? 0,
      status?.exclusionReasonKey ? label(SCOPE3_EXCLUSION_LABELS, status.exclusionReasonKey) : "-",
    ];
  });

  const split = scope3Split(dataset);

  return {
    id,
    title: "Scope 3 value chain inventory (GHG Protocol categories 1-15)",
    blocks: [
      {
        kind: "table",
        table: {
          columns: [
            "No.",
            "Category",
            "Value chain",
            "Relevance",
            `Emissions (${EMISSION_UNIT})`,
            "Method",
            "Data quality (1-5)",
            "Suppliers",
            "Exclusion reason",
          ],
          numericColumns: [0, 4, 6, 7],
          rows,
        },
      },
      {
        kind: "keyValues",
        items: [
          {
            label: "Total calculated Scope 3",
            value: `${formatQuantity(split.valueChain)} ${EMISSION_UNIT}`,
          },
          { label: "Categories assessed as relevant", value: String(split.relevantCategories) },
          { label: "Relevant categories calculated", value: `${split.coveragePercent}%` },
          {
            label: "Emissions-weighted data quality",
            value:
              split.weightedDataQuality === null
                ? "Not determinable"
                : `${formatDecimal(split.weightedDataQuality)} / 5`,
          },
        ],
      },
      {
        kind: "paragraph",
        text:
          "Data quality is weighted by emissions rather than averaged evenly, so a poorly " +
          "estimated category carrying a large share of the footprint moves the score more " +
          "than a well-measured small one.",
      },
    ],
  };
}

/** Reduction targets with derived progress against the linear pathway. */
export function targetsSection(dataset: ReportDataset, id = "targets"): ReportSection {
  const rows = dataset.targets.targets.map((target) => {
    const assessment = assessTarget(target);
    const isIntensity = target.targetType === "intensity";
    const quantity = (value: number) => (isIntensity ? round(value, 3) : round(value));

    return [
      targetDescriptionLabel(target.descriptionKey),
      target.targetType,
      target.scope === null ? "All scopes" : `Scope ${target.scope}`,
      target.status,
      target.baseYear,
      target.targetYear,
      quantity(target.baseEmissions),
      quantity(target.targetEmissions),
      round(target.targetReductionPct),
      assessment.latestYear ?? "No data",
      assessment.latestEmissions === null ? "No data" : quantity(assessment.latestEmissions),
      assessment.verdict === "no_data" ? "No data" : assessment.progressPercent,
      assessment.verdict,
      label(TARGET_METHODOLOGY_LABELS, target.methodologyKey),
    ];
  });

  return {
    id,
    title: "Reduction targets and progress",
    blocks: [
      {
        kind: "table",
        table: {
          columns: [
            "Target",
            "Type",
            "Scope",
            "Status",
            "Base year",
            "Target year",
            "Base",
            "Target",
            "Reduction (%)",
            "Latest year",
            "Latest",
            "Progress (%)",
            "Pathway verdict",
            "Methodology",
          ],
          numericColumns: [4, 5, 6, 7, 8, 11],
          rows,
        },
      },
      {
        kind: "paragraph",
        text:
          `Absolute and SBTi targets are stated in ${EMISSION_UNIT}; intensity targets are ` +
          `stated in ${EMISSION_UNIT} per million KRW of revenue. Progress is the share of ` +
          "the required reduction already achieved, clamped to 100%. The pathway verdict " +
          "compares latest emissions with the straight-line pathway from base year to target " +
          "year, with a 1% tolerance band.",
      },
    ],
  };
}

/** Per-year measured performance for every target that has reported data. */
export function targetProgressSection(
  dataset: ReportDataset,
  id = "target-progress"
): ReportSection {
  const rows: (string | number | null)[][] = [];
  for (const target of dataset.targets.targets) {
    for (const point of [...target.progress].sort((a, b) => a.year - b.year)) {
      rows.push([
        targetDescriptionLabel(target.descriptionKey),
        point.year,
        target.targetType === "intensity"
          ? round(point.actualEmissions, 3)
          : round(point.actualEmissions),
        target.targetType === "intensity"
          ? round(pathwayFor(target, point.year), 3)
          : round(pathwayFor(target, point.year)),
      ]);
    }
  }

  const blocks: ReportBlock[] =
    rows.length === 0
      ? [{ kind: "paragraph", text: "No measured progress has been recorded against any target." }]
      : [
          {
            kind: "table",
            table: {
              columns: ["Target", "Year", "Actual", "Linear pathway"],
              numericColumns: [1, 2, 3],
              rows,
            },
          },
        ];

  return { id, title: "Measured progress by year", blocks };
}

/** Straight-line pathway value, re-exported through the targets library. */
function pathwayFor(target: ReductionTarget, year: number): number {
  const span = target.targetYear - target.baseYear;
  if (span <= 0) return target.targetEmissions;
  const elapsed = Math.min(Math.max(year - target.baseYear, 0), span);
  return target.baseEmissions - (target.baseEmissions - target.targetEmissions) * (elapsed / span);
}

/** SBTi criteria assessment for each target. */
export function sbtiAssessmentSection(dataset: ReportDataset, id = "sbti"): ReportSection {
  const rows = dataset.targets.targets.map((target) => {
    const span = target.targetYear - target.baseYear;
    const totalReductionPct =
      target.baseEmissions > 0
        ? ((target.baseEmissions - target.targetEmissions) / target.baseEmissions) * 100
        : 0;
    const impliedAnnual = span > 0 ? totalReductionPct / span : 0;
    const verdict = meetsSbtiLinearMinimum(target);

    return [
      targetDescriptionLabel(target.descriptionKey),
      target.targetType,
      span,
      round(totalReductionPct),
      round(impliedAnnual, 2),
      verdict === null ? "Not applicable" : verdict ? "Meets minimum" : "Below minimum",
    ];
  });

  return {
    id,
    title: "SBTi near-term criteria assessment",
    blocks: [
      {
        kind: "table",
        table: {
          columns: [
            "Target",
            "Type",
            "Years",
            "Total reduction (%)",
            "Implied annual linear rate (%)",
            "Against SBTi 1.5C minimum",
          ],
          numericColumns: [2, 3, 4],
          rows,
        },
      },
      {
        kind: "paragraph",
        text:
          `The SBTi Corporate Near-Term Criteria require a minimum linear annual reduction of ` +
          `${SBTI_MIN_ANNUAL_LINEAR_REDUCTION_PCT}% of base-year emissions for a 1.5C-aligned ` +
          "absolute contraction target. The criterion does not apply to intensity targets, " +
          "which are reported as not applicable rather than as failing.",
      },
    ],
  };
}

/** Supplier engagement: request lifecycle counts and the verified roll-up. */
export function supplierEngagementSection(
  dataset: ReportDataset,
  id = "supplier-engagement"
): ReportSection {
  const { suppliers, requests } = dataset.suppliers;
  const counts = countRequests(requests, SAMPLE_AS_OF);
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));

  const requestRows = requests.map((request) => [
    request.id,
    supplierName.get(request.supplierId) ?? request.supplierId,
    request.categoryNumber,
    scope3CategoryLabel(request.categoryNumber),
    request.status,
    request.dueDate,
    request.submittedAt ?? "-",
    request.reportedEmissions === null ? "-" : round(request.reportedEmissions),
    request.dataQuality ?? "-",
    request.supersedesRequestId ?? "-",
  ]);

  const aggregates = aggregateByCategory(requests);
  const aggregateRows = aggregates.map((aggregate) => [
    aggregate.categoryNumber,
    scope3CategoryLabel(aggregate.categoryNumber),
    aggregate.verifiedEmissions,
    aggregate.verifiedSupplierCount,
    aggregate.pendingEmissions,
    aggregate.pendingSupplierCount,
  ]);

  return {
    id,
    title: "Supplier engagement and primary data",
    blocks: [
      {
        kind: "keyValues",
        items: [
          { label: "Suppliers in programme", value: String(suppliers.length) },
          { label: "Data requests issued", value: String(counts.total) },
          { label: "Awaiting supplier response", value: String(counts.awaitingSupplier) },
          { label: "Awaiting our verification", value: String(counts.awaitingVerification) },
          { label: "Verified", value: String(counts.verified) },
          { label: "Rejected", value: String(counts.rejected) },
          { label: "Overdue with supplier", value: String(counts.overdue) },
          { label: "Response rate", value: `${responseRatePercent(requests)}%` },
        ],
      },
      {
        kind: "table",
        table: {
          columns: [
            "Category",
            "Category name",
            `Verified (${EMISSION_UNIT})`,
            "Verified suppliers",
            `Submitted, unverified (${EMISSION_UNIT})`,
            "Unverified suppliers",
          ],
          numericColumns: [0, 2, 3, 4, 5],
          rows: aggregateRows,
        },
      },
      {
        kind: "paragraph",
        text:
          "Only verified submissions contribute to reported Scope 3. Submitted but unverified " +
          "figures are stated separately and superseded requests are excluded, so a rejected " +
          "submission that was re-requested and verified is counted once, not twice.",
      },
      {
        kind: "table",
        table: {
          columns: [
            "Request",
            "Supplier",
            "Category",
            "Category name",
            "Status",
            "Due",
            "Submitted",
            `Reported (${EMISSION_UNIT})`,
            "Data quality",
            "Supersedes",
          ],
          numericColumns: [2, 7],
          rows: requestRows,
        },
      },
    ],
  };
}

/** Supplier master list, for frameworks that ask who is in the programme. */
export function supplierListSection(dataset: ReportDataset, id = "suppliers"): ReportSection {
  const rows = dataset.suppliers.suppliers.map((supplier) => [
    supplier.name,
    supplierIndustryLabel(supplier.industryKey),
    supplier.country ?? "-",
    supplier.status,
    supplier.annualSpendMillionKrw ?? "-",
    supplier.contactEmail ?? "-",
  ]);

  return {
    id,
    title: "Suppliers in the engagement programme",
    blocks: [
      {
        kind: "table",
        table: {
          columns: [
            "Supplier",
            "Industry",
            "Country",
            "Status",
            "Annual spend (million KRW)",
            "Contact",
          ],
          numericColumns: [4],
          rows,
        },
      },
    ],
  };
}

/** Year-over-year comparison, i.e. the base-year recalculation evidence. */
export function yearComparisonSection(
  dataset: ReportDataset,
  id = "year-comparison"
): ReportSection {
  const rows = dataset.dashboard.monthlyComparison.map((point) => [
    point.month,
    round(point.currentYear),
    round(point.previousYear),
    round(point.currentYear - point.previousYear),
    point.previousYear === 0
      ? "-"
      : round(((point.currentYear - point.previousYear) / point.previousYear) * 100),
  ]);

  return {
    id,
    title: "Comparison with the previous reporting year",
    blocks: [
      {
        kind: "table",
        table: {
          columns: ["Month", `${dataset.year}`, `${dataset.year - 1}`, "Change", "Change (%)"],
          numericColumns: [0, 1, 2, 3, 4],
          rows,
        },
      },
    ],
  };
}

/** Quantification methodology, uncertainty and the data-quality position. */
export function methodologySection(dataset: ReportDataset, id = "methodology"): ReportSection {
  const split = scope3Split(dataset);

  return {
    id,
    title: "Quantification methodology and data quality",
    blocks: [
      {
        kind: "keyValues",
        items: [
          { label: "Calculation approach", value: "Activity data multiplied by emission factor" },
          {
            label: "Emission factor sources",
            value: "Korea MOE, IPCC 2006 Guidelines, DEFRA (set selected per activity)",
          },
          { label: "GWP set", value: "IPCC AR5, 100-year time horizon" },
          { label: "Scope 2 method", value: "Location-based, using grid region factors" },
          {
            label: "Scope 3 screening",
            value: `${split.relevantCategories} of 15 categories assessed as relevant`,
          },
          {
            label: "Emissions-weighted Scope 3 data quality",
            value:
              split.weightedDataQuality === null
                ? "Not determinable"
                : `${formatDecimal(split.weightedDataQuality)} / 5`,
          },
          { label: "Third-party verification", value: "Not performed" },
        ],
      },
      {
        kind: "paragraph",
        text:
          "Scope 3 categories marked relevant but not calculated are gaps in the inventory " +
          "and are reported as such rather than as zero. Where a supplier has submitted " +
          "primary data that has not been verified, that figure is excluded from reported " +
          "totals and disclosed separately.",
      },
    ],
  };
}

/**
 * Rows for a disclosure index, used by the partially-covered frameworks.
 *
 * A disclosure the system cannot fill gets `NARRATIVE_REQUIRED` in the status
 * column. Emitting the row with an explicit gap is the whole point: a reader can
 * see the framework has ten requirements and this system answers six of them,
 * which a report that quietly listed only the six could not convey.
 */
export function disclosureIndexTable(
  entries: readonly { reference: string; requirement: string; status: string; where: string }[]
): ReportTable {
  return {
    columns: ["Reference", "Requirement", "Status", "Where in this report"],
    rows: entries.map((entry) => [entry.reference, entry.requirement, entry.status, entry.where]),
  };
}
