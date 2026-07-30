/**
 * The nine report templates.
 *
 * A template maps a `ReportDataset` onto the disclosures one framework asks for.
 * All the arithmetic lives in `sections.ts`, so what is left here is the part
 * that is genuinely per-framework: which disclosures exist, what they are
 * called, and in what order.
 *
 * ## Full versus partial coverage
 *
 * Six templates are `full`: every disclosure they claim is derived from data.
 *
 * Three are `partial` — ISSB (IFRS S2), TCFD and CSRD (ESRS E1). Those
 * frameworks are majority *narrative*: governance oversight, strategy
 * resilience, scenario analysis, transition plans, internal carbon pricing.
 * None of that is stored anywhere in this system, and inventing it would be
 * worse than useless in a document meant for a regulator. So those templates
 * emit the framework's full disclosure index, fill the quantitative rows from
 * data, and mark the rest `NARRATIVE_REQUIRED`. The reader sees exactly which
 * requirements are answered and which are outstanding.
 */

import type { ReportDataset } from "./dataset";
import { reportTypeInfo } from "./registry";
import {
  EMISSION_UNIT,
  boundarySection,
  disclosureIndexTable,
  emissionsSummarySection,
  formatDecimal,
  formatPercent,
  formatQuantity,
  methodologySection,
  monthlyBreakdownSection,
  round,
  sbtiAssessmentSection,
  scope3CategoriesSection,
  scope3Split,
  significantSourcesSection,
  supplierEngagementSection,
  supplierListSection,
  targetProgressSection,
  targetsSection,
  yearComparisonSection,
} from "./sections";
import {
  NARRATIVE_REQUIRED,
  type ReportDocument,
  type ReportSection,
  type ReportType,
} from "./types";

/** A template turns a dataset into an ordered list of sections. */
type TemplateBuilder = (dataset: ReportDataset) => {
  title: string;
  sections: ReportSection[];
  /** Framework-specific caveats, appended after the generic ones. */
  notes?: string[];
};

/* ------------------------------------------------------------------------- *
 * ISO 14064-1 — GHG inventory report
 * ------------------------------------------------------------------------- */

const iso14064: TemplateBuilder = (dataset) => ({
  title: "GHG Inventory Report (ISO 14064-1)",
  sections: [
    boundarySection(dataset, "9.3.1-boundary"),
    emissionsSummarySection(dataset, "9.3.2-quantified", "Quantified GHG emissions by scope"),
    monthlyBreakdownSection(dataset, "9.3.3-periods"),
    significantSourcesSection(dataset, "9.3.4-sources"),
    scope3CategoriesSection(dataset, "9.3.5-indirect"),
    yearComparisonSection(dataset, "9.3.6-base-year"),
    methodologySection(dataset, "9.3.7-methodology"),
    {
      id: "9.3.8-uncertainty",
      title: "Uncertainty and exclusions",
      blocks: [
        {
          kind: "paragraph",
          text:
            "Uncertainty has not been quantified statistically for this inventory. The " +
            "dominant sources of uncertainty are the emission factors applied to purchased " +
            "electricity and the estimation methods used for uncalculated Scope 3 categories.",
        },
        {
          kind: "keyValues",
          items: [
            {
              label: "Scope 3 categories relevant but not calculated",
              value: String(
                dataset.scope3.categories.filter(
                  (category) => category.relevance === "relevant" && category.emissions === null
                ).length
              ),
            },
            { label: "Biogenic CO2 reported separately", value: "None identified" },
            { label: "GHG removals", value: "None claimed" },
            { label: "Verification statement", value: "Not obtained" },
          ],
        },
      ],
    },
  ],
});

/* ------------------------------------------------------------------------- *
 * CDP Climate Change questionnaire
 * ------------------------------------------------------------------------- */

const cdp: TemplateBuilder = (dataset) => {
  const split = scope3Split(dataset);

  return {
    title: "CDP Climate Change Response",
    sections: [
      boundarySection(dataset, "C0-introduction"),
      targetsSection(dataset, "C4.1-targets"),
      targetProgressSection(dataset, "C4.2-progress"),
      {
        id: "C6.1-emissions",
        title: "C6.1-C6.5 Emissions data",
        blocks: [
          {
            kind: "table",
            table: {
              columns: ["Question", "Disclosure", `Gross emissions (${EMISSION_UNIT})`],
              numericColumns: [2],
              rows: [
                ["C6.1", "Scope 1 gross global emissions", round(dataset.dashboard.kpis.scope1)],
                [
                  "C6.3",
                  "Scope 2 gross global emissions (location-based)",
                  round(dataset.dashboard.kpis.scope2),
                ],
                [
                  "C6.5",
                  "Scope 3 gross global emissions (value chain, categories 1-15)",
                  split.valueChain,
                ],
              ],
            },
          },
          {
            kind: "paragraph",
            text:
              "CDP C6.3 requires a market-based Scope 2 figure alongside the location-based " +
              "one. No supplier-specific or residual-mix factors are held in this system, so " +
              "only the location-based figure is disclosed.",
          },
        ],
      },
      scope3CategoriesSection(dataset, "C6.5-scope3-detail"),
      {
        id: "C6.10-intensity",
        title: "C6.10 Emissions intensity",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: `Intensity (${EMISSION_UNIT} per million KRW revenue)`,
                value: formatDecimal(dataset.dashboard.kpis.intensityPerRevenue),
              },
              {
                label: "Total gross global emissions used as numerator",
                value: `${formatQuantity(dataset.dashboard.kpis.totalEmissions)} ${EMISSION_UNIT}`,
              },
              {
                label: "Year-over-year change in gross emissions",
                value: formatPercent(dataset.dashboard.kpis.yoyChangePercent),
              },
            ],
          },
        ],
      },
      supplierEngagementSection(dataset, "C12.1-value-chain"),
      methodologySection(dataset, "C5.2-methodology"),
    ],
    notes: [
      "Market-based Scope 2 (C6.3) is not disclosed: no market instruments or residual-mix " +
        "factors are held in this system.",
    ],
  };
};

/* ------------------------------------------------------------------------- *
 * SBTi — target validation and progress
 * ------------------------------------------------------------------------- */

const sbti: TemplateBuilder = (dataset) => ({
  title: "Science Based Targets Progress Report",
  sections: [
    boundarySection(dataset, "boundary"),
    targetsSection(dataset, "targets"),
    sbtiAssessmentSection(dataset, "criteria"),
    targetProgressSection(dataset, "progress"),
    emissionsSummarySection(dataset, "inventory", "Inventory underlying the targets"),
    scope3CategoriesSection(dataset, "scope3-coverage"),
    {
      id: "scope3-threshold",
      title: "Scope 3 target requirement",
      blocks: [
        {
          kind: "paragraph",
          text:
            "SBTi requires a Scope 3 target where Scope 3 exceeds 40% of total Scope 1+2+3 " +
            "emissions. The figures below use the full value chain inventory as the Scope 3 " +
            "numerator, which is the basis SBTi applies.",
        },
        {
          kind: "keyValues",
          items: (() => {
            const split = scope3Split(dataset);
            const scope12 = dataset.dashboard.kpis.scope1 + dataset.dashboard.kpis.scope2;
            const total = scope12 + split.valueChain;
            const share = total > 0 ? (split.valueChain / total) * 100 : 0;
            return [
              {
                label: `Scope 1+2 (${EMISSION_UNIT})`,
                value: formatQuantity(scope12),
              },
              {
                label: `Scope 3 value chain (${EMISSION_UNIT})`,
                value: formatQuantity(split.valueChain),
              },
              { label: "Scope 3 share of Scope 1+2+3", value: formatPercent(round(share, 2)) },
              {
                label: "Scope 3 target required",
                value: share > 40 ? "Yes (threshold exceeded)" : "No",
              },
            ];
          })(),
        },
      ],
    },
    methodologySection(dataset, "methodology"),
  ],
});

/* ------------------------------------------------------------------------- *
 * GRI 305: Emissions 2016
 * ------------------------------------------------------------------------- */

const gri: TemplateBuilder = (dataset) => {
  const split = scope3Split(dataset);
  const { kpis } = dataset.dashboard;

  return {
    title: "GRI 305: Emissions Disclosure",
    sections: [
      boundarySection(dataset, "3-1-boundary"),
      {
        id: "305-1",
        title: "305-1 Direct (Scope 1) GHG emissions",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: "Gross direct (Scope 1) GHG emissions",
                value: `${formatQuantity(kpis.scope1)} ${EMISSION_UNIT}`,
              },
              { label: "Gases included", value: "CO2, CH4, N2O, HFCs, PFCs, SF6" },
              { label: "Biogenic CO2 emissions", value: "None identified" },
              { label: "Base year", value: "2018" },
              { label: "GWP source", value: "IPCC AR5, 100-year" },
              { label: "Consolidation approach", value: "Operational control" },
            ],
          },
        ],
      },
      {
        id: "305-2",
        title: "305-2 Energy indirect (Scope 2) GHG emissions",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: "Gross location-based energy indirect emissions",
                value: `${formatQuantity(kpis.scope2)} ${EMISSION_UNIT}`,
              },
              { label: "Gross market-based energy indirect emissions", value: "Not available" },
              { label: "Gases included", value: "CO2, CH4, N2O (aggregated as CO2e)" },
            ],
          },
          {
            kind: "paragraph",
            text:
              "GRI 305-2 asks for a market-based figure where contractual instruments exist. " +
              "None are held in this system, so only the location-based figure is disclosed.",
          },
        ],
      },
      {
        id: "305-3",
        title: "305-3 Other indirect (Scope 3) GHG emissions",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: "Gross other indirect emissions (value chain, categories 1-15)",
                value: `${formatQuantity(split.valueChain)} ${EMISSION_UNIT}`,
              },
              {
                label: "Scope 3 recorded in the operational inventory",
                value: `${formatQuantity(kpis.scope3)} ${EMISSION_UNIT}`,
              },
              { label: "Categories assessed as relevant", value: String(split.relevantCategories) },
              { label: "Relevant categories calculated", value: `${split.coveragePercent}%` },
            ],
          },
        ],
      },
      scope3CategoriesSection(dataset, "305-3-categories"),
      {
        id: "305-4",
        title: "305-4 GHG emissions intensity",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: "Intensity ratio",
                value: `${formatDecimal(kpis.intensityPerRevenue)} ${EMISSION_UNIT} per million KRW revenue`,
              },
              {
                label: "Numerator",
                value: `${formatQuantity(kpis.totalEmissions)} ${EMISSION_UNIT} (Scope 1+2+3 operational)`,
              },
              { label: "Denominator", value: "Annual revenue in millions of KRW" },
              {
                label: "Scopes included in the ratio",
                value: "Scope 1, 2 and operational Scope 3",
              },
            ],
          },
        ],
      },
      {
        id: "305-5",
        title: "305-5 Reduction of GHG emissions",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: "Year-over-year change in gross emissions",
                value: formatPercent(kpis.yoyChangePercent),
              },
              {
                label: "Progress against the active absolute reduction target",
                value: formatPercent(kpis.reductionProgressPercent),
              },
            ],
          },
        ],
      },
      targetsSection(dataset, "305-5-targets"),
      yearComparisonSection(dataset, "305-5-comparison"),
      methodologySection(dataset, "305-methodology"),
    ],
    notes: [
      "GRI 305-6 (ozone-depleting substances) and 305-7 (NOx, SOx and other significant air " +
        "emissions) are not covered: this system holds no non-GHG air emissions data.",
    ],
  };
};

/* ------------------------------------------------------------------------- *
 * ISSB IFRS S2 — partial
 * ------------------------------------------------------------------------- */

const issb: TemplateBuilder = (dataset) => {
  const split = scope3Split(dataset);

  return {
    title: "IFRS S2 Climate-related Disclosures",
    sections: [
      boundarySection(dataset, "boundary"),
      {
        id: "index",
        title: "IFRS S2 disclosure index",
        blocks: [
          {
            kind: "table",
            table: disclosureIndexTable([
              {
                reference: "IFRS S2.6",
                requirement: "Governance of climate-related risks and opportunities",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.9-12",
                requirement: "Strategy and decision-making, transition plan",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.15-21",
                requirement: "Climate resilience and scenario analysis",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.24-26",
                requirement: "Risk management processes",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.29(a)(i)",
                requirement: "Scope 1 absolute gross GHG emissions",
                status: "Disclosed",
                where: "Cross-industry metrics",
              },
              {
                reference: "IFRS S2.29(a)(ii)",
                requirement: "Scope 2 absolute gross GHG emissions (location-based)",
                status: "Disclosed",
                where: "Cross-industry metrics",
              },
              {
                reference: "IFRS S2.29(a)(iii)",
                requirement: "Scope 3 absolute gross GHG emissions by category",
                status: "Disclosed",
                where: "Scope 3 value chain inventory",
              },
              {
                reference: "IFRS S2.29(b)",
                requirement: "Climate-related transition risks: amount and percentage of assets",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.29(c)",
                requirement: "Climate-related physical risks: amount and percentage of assets",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.29(e)",
                requirement: "Capital deployment towards climate-related risks",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.29(f)",
                requirement: "Internal carbon prices",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.29(g)",
                requirement: "Remuneration linked to climate considerations",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "IFRS S2.33-37",
                requirement: "Climate-related targets and progress",
                status: "Disclosed",
                where: "Targets and progress",
              },
            ]),
          },
          {
            kind: "paragraph",
            text:
              "Rows marked as requiring narrative input are disclosure requirements that this " +
              "system holds no data for. They are listed rather than omitted so the gap " +
              "against IFRS S2 is visible.",
          },
        ],
      },
      {
        id: "metrics",
        title: "IFRS S2.29 Cross-industry metrics",
        blocks: [
          {
            kind: "table",
            table: {
              columns: ["Metric", "Reference", `Value (${EMISSION_UNIT})`],
              numericColumns: [2],
              rows: [
                ["Scope 1 absolute gross", "S2.29(a)(i)", round(dataset.dashboard.kpis.scope1)],
                [
                  "Scope 2 absolute gross (location-based)",
                  "S2.29(a)(ii)",
                  round(dataset.dashboard.kpis.scope2),
                ],
                ["Scope 3 absolute gross (categories 1-15)", "S2.29(a)(iii)", split.valueChain],
              ],
            },
          },
          {
            kind: "keyValues",
            items: [
              {
                label: `GHG intensity (${EMISSION_UNIT} per million KRW revenue)`,
                value: formatDecimal(dataset.dashboard.kpis.intensityPerRevenue),
              },
              { label: "Measurement approach", value: "GHG Protocol Corporate Standard" },
              { label: "Scope 2 method", value: "Location-based" },
            ],
          },
        ],
      },
      scope3CategoriesSection(dataset, "scope3"),
      targetsSection(dataset, "targets"),
      targetProgressSection(dataset, "target-progress"),
      methodologySection(dataset, "methodology"),
    ],
    notes: [
      "Partial coverage: the IFRS S2 governance, strategy, resilience and risk-management " +
        "disclosures require narrative input that this system does not hold. The disclosure " +
        "index states which requirements are unanswered.",
    ],
  };
};

/* ------------------------------------------------------------------------- *
 * TCFD — partial
 * ------------------------------------------------------------------------- */

const tcfd: TemplateBuilder = (dataset) => ({
  title: "TCFD-aligned Climate Disclosure",
  sections: [
    boundarySection(dataset, "boundary"),
    {
      id: "index",
      title: "TCFD recommended disclosures",
      blocks: [
        {
          kind: "table",
          table: disclosureIndexTable([
            {
              reference: "Governance a)",
              requirement: "Board oversight of climate-related risks and opportunities",
              status: NARRATIVE_REQUIRED,
              where: "-",
            },
            {
              reference: "Governance b)",
              requirement: "Management's role in assessing and managing climate risk",
              status: NARRATIVE_REQUIRED,
              where: "-",
            },
            {
              reference: "Strategy a)",
              requirement:
                "Climate risks and opportunities identified over the short, medium and long term",
              status: NARRATIVE_REQUIRED,
              where: "-",
            },
            {
              reference: "Strategy b)",
              requirement: "Impact on business, strategy and financial planning",
              status: NARRATIVE_REQUIRED,
              where: "-",
            },
            {
              reference: "Strategy c)",
              requirement: "Resilience of strategy under different climate scenarios",
              status: NARRATIVE_REQUIRED,
              where: "-",
            },
            {
              reference: "Risk Management a)",
              requirement: "Processes for identifying and assessing climate-related risks",
              status: NARRATIVE_REQUIRED,
              where: "-",
            },
            {
              reference: "Risk Management b)",
              requirement: "Processes for managing climate-related risks",
              status: NARRATIVE_REQUIRED,
              where: "-",
            },
            {
              reference: "Risk Management c)",
              requirement: "Integration into overall risk management",
              status: NARRATIVE_REQUIRED,
              where: "-",
            },
            {
              reference: "Metrics and Targets a)",
              requirement: "Metrics used to assess climate-related risks and opportunities",
              status: "Disclosed",
              where: "Metrics",
            },
            {
              reference: "Metrics and Targets b)",
              requirement: "Scope 1, Scope 2 and Scope 3 GHG emissions",
              status: "Disclosed",
              where: "Metrics, Scope 3 inventory",
            },
            {
              reference: "Metrics and Targets c)",
              requirement: "Targets used to manage climate risk and performance against them",
              status: "Disclosed",
              where: "Targets and progress",
            },
          ]),
        },
        {
          kind: "paragraph",
          text:
            "Eight of the eleven TCFD recommended disclosures are narrative. This report " +
            "answers the three Metrics and Targets disclosures from measured data and lists " +
            "the remainder as outstanding rather than omitting them.",
        },
      ],
    },
    emissionsSummarySection(dataset, "metrics", "Metrics and Targets b) GHG emissions"),
    scope3CategoriesSection(dataset, "metrics-scope3"),
    significantSourcesSection(dataset, "metrics-sources"),
    targetsSection(dataset, "targets"),
    targetProgressSection(dataset, "target-progress"),
    yearComparisonSection(dataset, "trend"),
    methodologySection(dataset, "methodology"),
  ],
  notes: [
    "Partial coverage: the Governance, Strategy and Risk Management pillars require narrative " +
      "input that this system does not hold. Only Metrics and Targets is answered from data.",
  ],
});

/* ------------------------------------------------------------------------- *
 * CSRD / ESRS E1 — partial
 * ------------------------------------------------------------------------- */

const csrd: TemplateBuilder = (dataset) => {
  const split = scope3Split(dataset);
  const { kpis } = dataset.dashboard;
  const totalIncludingValueChain = kpis.scope1 + kpis.scope2 + split.valueChain;

  return {
    title: "ESRS E1 Climate Change Disclosure (CSRD)",
    sections: [
      boundarySection(dataset, "boundary"),
      {
        id: "index",
        title: "ESRS E1 disclosure requirements",
        blocks: [
          {
            kind: "table",
            table: disclosureIndexTable([
              {
                reference: "E1-1",
                requirement: "Transition plan for climate change mitigation",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "E1-2",
                requirement: "Policies related to climate change mitigation and adaptation",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "E1-3",
                requirement: "Actions and resources in relation to climate change policies",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "E1-4",
                requirement: "Targets related to climate change mitigation and adaptation",
                status: "Disclosed",
                where: "E1-4 Targets",
              },
              {
                reference: "E1-5",
                requirement: "Energy consumption and mix",
                status: "Not available - no energy consumption data held",
                where: "-",
              },
              {
                reference: "E1-6",
                requirement: "Gross Scopes 1, 2, 3 and total GHG emissions",
                status: "Disclosed",
                where: "E1-6 Gross emissions",
              },
              {
                reference: "E1-7",
                requirement: "GHG removals and mitigation projects financed by carbon credits",
                status: "None claimed",
                where: "E1-6 Gross emissions",
              },
              {
                reference: "E1-8",
                requirement: "Internal carbon pricing",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
              {
                reference: "E1-9",
                requirement: "Anticipated financial effects from physical and transition risks",
                status: NARRATIVE_REQUIRED,
                where: "-",
              },
            ]),
          },
        ],
      },
      {
        id: "E1-6",
        title: "E1-6 Gross Scopes 1, 2, 3 and total GHG emissions",
        blocks: [
          {
            kind: "table",
            table: {
              columns: ["Disclosure", `Emissions (${EMISSION_UNIT})`, "Share of total (%)"],
              numericColumns: [1, 2],
              rows: [
                [
                  "Gross Scope 1 GHG emissions",
                  round(kpis.scope1),
                  round((kpis.scope1 / totalIncludingValueChain) * 100),
                ],
                [
                  "Gross location-based Scope 2 GHG emissions",
                  round(kpis.scope2),
                  round((kpis.scope2 / totalIncludingValueChain) * 100),
                ],
                [
                  "Gross Scope 3 GHG emissions (value chain)",
                  split.valueChain,
                  round((split.valueChain / totalIncludingValueChain) * 100),
                ],
                ["Total GHG emissions", round(totalIncludingValueChain), 100],
              ],
            },
          },
          {
            kind: "keyValues",
            items: [
              {
                label: `GHG intensity per net revenue (${EMISSION_UNIT} per million KRW)`,
                value: formatDecimal(kpis.intensityPerRevenue),
              },
              { label: "Gross market-based Scope 2 GHG emissions", value: "Not available" },
              { label: "GHG removals (E1-7)", value: "None claimed" },
              { label: "Carbon credits cancelled or planned", value: "None" },
            ],
          },
          {
            kind: "paragraph",
            text:
              "ESRS E1-6 requires the total to include the full value chain, so the total " +
              "above uses the category 1-15 Scope 3 inventory rather than the smaller " +
              "operational Scope 3 figure.",
          },
        ],
      },
      scope3CategoriesSection(dataset, "E1-6-scope3"),
      targetsSection(dataset, "E1-4"),
      targetProgressSection(dataset, "E1-4-progress"),
      supplierEngagementSection(dataset, "E1-6-value-chain"),
      methodologySection(dataset, "methodology"),
    ],
    notes: [
      "Partial coverage: ESRS E1-1, E1-2, E1-3, E1-8 and E1-9 require narrative and financial " +
        "input this system does not hold, and E1-5 requires energy consumption data that is " +
        "not recorded. The disclosure index states the position on each requirement.",
      "ESRS E1-6 requires assurance of the reported figures. No assurance has been obtained.",
    ],
  };
};

/* ------------------------------------------------------------------------- *
 * ESG report — internal environmental chapter
 * ------------------------------------------------------------------------- */

const esg: TemplateBuilder = (dataset) => {
  const split = scope3Split(dataset);
  const { kpis } = dataset.dashboard;

  return {
    title: "ESG Report - Environmental Chapter",
    sections: [
      boundarySection(dataset, "about"),
      {
        id: "highlights",
        title: "Environmental performance highlights",
        blocks: [
          {
            kind: "keyValues",
            items: [
              {
                label: `Total operational emissions (${EMISSION_UNIT})`,
                value: formatQuantity(kpis.totalEmissions),
              },
              {
                label: `Value chain emissions, categories 1-15 (${EMISSION_UNIT})`,
                value: formatQuantity(split.valueChain),
              },
              { label: "Year-over-year change", value: formatPercent(kpis.yoyChangePercent) },
              {
                label: "Progress against the 2030 absolute target",
                value: formatPercent(kpis.reductionProgressPercent),
              },
              {
                label: "Emission intensity",
                value: `${formatDecimal(kpis.intensityPerRevenue)} ${EMISSION_UNIT} per million KRW`,
              },
              {
                label: "Suppliers engaged for primary data",
                value: String(dataset.suppliers.suppliers.length),
              },
            ],
          },
        ],
      },
      emissionsSummarySection(dataset, "emissions", "Emissions by scope"),
      significantSourcesSection(dataset, "sources"),
      monthlyBreakdownSection(dataset, "monthly"),
      yearComparisonSection(dataset, "comparison"),
      scope3CategoriesSection(dataset, "value-chain"),
      supplierEngagementSection(dataset, "supplier-engagement"),
      supplierListSection(dataset, "supplier-list"),
      targetsSection(dataset, "targets"),
      targetProgressSection(dataset, "target-progress"),
      methodologySection(dataset, "methodology"),
    ],
    notes: [
      "This chapter covers the environmental (E) pillar only. Social and governance pillars " +
        "are outside the scope of this system.",
    ],
  };
};

/* ------------------------------------------------------------------------- *
 * Sustainability report — climate chapter
 * ------------------------------------------------------------------------- */

const sustainability: TemplateBuilder = (dataset) => {
  const split = scope3Split(dataset);
  const { kpis } = dataset.dashboard;
  const targetCount = dataset.targets.targets.length;

  return {
    title: "Sustainability Report - Climate Chapter",
    sections: [
      boundarySection(dataset, "about"),
      {
        id: "summary",
        title: "Climate performance at a glance",
        blocks: [
          {
            kind: "paragraph",
            text:
              `In ${dataset.year} the reporting organisation recorded ` +
              `${formatQuantity(kpis.totalEmissions)} ${EMISSION_UNIT} of operational emissions ` +
              `across Scopes 1, 2 and 3, a change of ${formatPercent(kpis.yoyChangePercent)} ` +
              `against the previous year. The value chain inventory adds a further ` +
              `${formatQuantity(split.valueChain)} ${EMISSION_UNIT} across ` +
              `${split.calculatedCategories} calculated GHG Protocol categories, with ` +
              `${split.coveragePercent}% of the categories assessed as relevant now calculated.`,
          },
          {
            kind: "keyValues",
            items: [
              {
                label: `Scope 1 (${EMISSION_UNIT})`,
                value: formatQuantity(kpis.scope1),
              },
              {
                label: `Scope 2 (${EMISSION_UNIT})`,
                value: formatQuantity(kpis.scope2),
              },
              {
                label: `Scope 3, value chain (${EMISSION_UNIT})`,
                value: formatQuantity(split.valueChain),
              },
              { label: "Reduction targets in place", value: String(targetCount) },
              {
                label: "Emissions-weighted Scope 3 data quality",
                value:
                  split.weightedDataQuality === null
                    ? "Not determinable"
                    : `${formatDecimal(split.weightedDataQuality)} / 5`,
              },
            ],
          },
        ],
      },
      emissionsSummarySection(dataset, "emissions", "Our greenhouse gas footprint"),
      monthlyBreakdownSection(dataset, "monthly"),
      significantSourcesSection(dataset, "where-emissions-come-from"),
      scope3CategoriesSection(dataset, "value-chain"),
      targetsSection(dataset, "targets"),
      targetProgressSection(dataset, "progress"),
      sbtiAssessmentSection(dataset, "science-based"),
      supplierEngagementSection(dataset, "suppliers"),
      yearComparisonSection(dataset, "comparison"),
      methodologySection(dataset, "how-we-measure"),
    ],
    notes: [
      "This chapter covers climate and greenhouse gas performance. Water, waste and " +
        "biodiversity disclosures are outside the scope of this system.",
    ],
  };
};

/* ------------------------------------------------------------------------- *
 * Assembly
 * ------------------------------------------------------------------------- */

const TEMPLATES: Record<ReportType, TemplateBuilder> = {
  iso14064,
  cdp,
  sbti,
  gri,
  issb,
  tcfd,
  csrd,
  esg,
  sustainability,
};

/**
 * Builds the document for one report type.
 *
 * The sample-data disclaimer is prepended here rather than left to each
 * template, so no template can forget it — which is exactly the mistake that
 * would let sample figures be filed as a real disclosure.
 */
export function buildReportDocument(
  type: ReportType,
  dataset: ReportDataset,
  generatedAt: Date
): ReportDocument {
  const info = reportTypeInfo(type);
  const { title, sections, notes = [] } = TEMPLATES[type](dataset);

  const allNotes: string[] = [];
  if (dataset.isSampleData) {
    allNotes.push(
      "SAMPLE DATA - NOT MEASURED EMISSIONS. Every figure in this document comes from the " +
        "sample data providers used while no live database is connected. This document must " +
        "not be filed, submitted or presented as a reported greenhouse gas inventory."
    );
  }
  if (info.coverage === "partial") {
    allNotes.push(
      `Partial coverage of ${info.label}: quantitative disclosures are derived from data, ` +
        "qualitative disclosures are listed as outstanding."
    );
  }
  allNotes.push(...notes);
  allNotes.push(
    `All emission quantities are in ${EMISSION_UNIT} (metric tonnes of CO2 equivalent) ` +
      "unless a label states otherwise."
  );

  return {
    type,
    title,
    standardReference: info.standardReference,
    coverage: info.coverage,
    organizationName: dataset.organizationName,
    periodStart: dataset.periodStart,
    periodEnd: dataset.periodEnd,
    generatedAt: generatedAt.toISOString(),
    isSampleData: dataset.isSampleData,
    notes: allNotes,
    sections,
  };
}
