/**
 * Automatic report drafting (보고서 자동작성).
 *
 * Generates the *narrative* sections of a disclosure report — boundary
 * description, methodology statement, results discussion. It deliberately does
 * not generate any figures: those come from `src/lib/reports/`, which assembles
 * them from the inventory. The drafted prose is inserted around them.
 *
 * That boundary is the whole point. A model drafting "Scope 1 emissions were
 * 4,260 tCO2e" will eventually draft a number that does not match the table
 * three pages later, and a disclosure report that contradicts itself is worse
 * than one with a terse paragraph. So the figures are passed in, the prose is
 * generated, and the two never swap roles.
 *
 * Generative; requires `OPENAI_API_KEY`. NOT VERIFIED in the sandbox this was
 * built in. Every section has a deterministic fallback that states the facts
 * plainly, so a report drafted with no key configured is still a complete,
 * honest — if dry — document.
 */

import { BASE_SYSTEM_PROMPT, generateText, isAiConfigured } from "./client";
import type { AnalysisSource } from "./types";

/** Narrative sections a report can carry. */
export type ReportSection = "boundary" | "methodology" | "results" | "reduction_actions";

/** Facts the drafter is allowed to use. Figures in tCO2e. */
export interface ReportDraftContext {
  /** Reporting organisation name. */
  organizationName: string;
  year: number;
  totalEmissions: number;
  scope1: number;
  scope2: number;
  scope3: number;
  /** Previous year total, when available, for a like-for-like comparison. */
  previousTotal: number | null;
  /** Framework the report targets, e.g. `ISO14064` or `TCFD`. */
  framework: string;
  /** Consolidation approach, per the GHG Protocol. */
  consolidationApproach: "operational_control" | "financial_control" | "equity_share";
  /** Number of sites within the reporting boundary. */
  siteCount: number;
  /** Emission factor sources actually used, e.g. `["Korea MOE 2023", "IPCC AR6"]`. */
  factorSources: string[];
  isSampleData: boolean;
}

export interface DraftedSection {
  section: ReportSection;
  text: string;
  source: AnalysisSource;
  error?: string;
}

function yoySentence(context: ReportDraftContext): string {
  if (context.previousTotal === null || context.previousTotal === 0) {
    return "No comparable prior-year total is available, so no year-on-year change is reported.";
  }
  const change = ((context.totalEmissions - context.previousTotal) / context.previousTotal) * 100;
  const direction = change < 0 ? "a decrease" : change > 0 ? "an increase" : "no change";
  return `Compared with ${context.previousTotal} tCO2e in the previous year this represents ${direction} of ${Math.abs(Math.round(change * 10) / 10)}%.`;
}

/**
 * Deterministic text for a section.
 *
 * Exported so it can be unit-tested and so the reports module can use it
 * directly when it wants guaranteed-reproducible prose — an ISO 14064 inventory
 * report that must be byte-identical on regeneration cannot contain model output
 * at all.
 */
export function fallbackSection(section: ReportSection, context: ReportDraftContext): string {
  const sampleWarning = context.isSampleData
    ? " All figures in this section are sample data and must not be relied upon as reported emissions."
    : "";

  switch (section) {
    case "boundary":
      return (
        `${context.organizationName} reports greenhouse gas emissions for the ${context.year} ` +
        `reporting year across ${context.siteCount} site(s), consolidated on the ` +
        `${context.consolidationApproach.replace(/_/g, " ")} approach as defined by the GHG ` +
        `Protocol Corporate Standard.${sampleWarning}`
      );
    case "methodology":
      return (
        `Emissions were quantified by multiplying activity data by emission factors and, where ` +
        `applicable, global warming potentials, in accordance with ISO 14064-1 and the GHG ` +
        `Protocol Corporate Standard. Emission factors were taken from ` +
        `${context.factorSources.length > 0 ? context.factorSources.join(", ") : "the platform's factor library"}. ` +
        `Reported quantities are expressed in tonnes of CO2 equivalent (tCO2e).${sampleWarning}`
      );
    case "results":
      return (
        `Total emissions for ${context.year} were ${context.totalEmissions} tCO2e, comprising ` +
        `${context.scope1} tCO2e Scope 1, ${context.scope2} tCO2e Scope 2 and ` +
        `${context.scope3} tCO2e Scope 3. ${yoySentence(context)}${sampleWarning}`
      );
    case "reduction_actions":
      return (
        `Reduction measures are appraised on a marginal abatement cost basis and are reported ` +
        `separately in the reduction target register. No narrative commentary was generated ` +
        `because no language model is configured.${sampleWarning}`
      );
  }
}

const SECTION_INSTRUCTIONS: Record<ReportSection, string> = {
  boundary:
    "Draft the organisational and operational boundary section. State the consolidation approach and what is included and excluded.",
  methodology:
    "Draft the quantification methodology section. Name the standards and the factor sources given, and state the units.",
  results:
    "Draft the results discussion. Interpret the split between scopes and the year-on-year movement. Do not introduce any figure not given.",
  reduction_actions:
    "Draft a short section on reduction actions and their governance. Do not invent specific projects, budgets or dates.",
};

/**
 * Drafts one narrative section.
 *
 * The fallback is computed first and passed in, so the offline path costs nothing
 * and the online path has a guaranteed landing place.
 */
export async function draftSection(
  section: ReportSection,
  context: ReportDraftContext,
  options: { locale?: string } = {}
): Promise<DraftedSection> {
  const fallback = fallbackSection(section, context);

  if (!isAiConfigured()) {
    return { section, text: fallback, source: "fallback" };
  }

  const facts = [
    `Organisation: ${context.organizationName}`,
    `Framework: ${context.framework}`,
    `Reporting year: ${context.year}`,
    `Consolidation approach: ${context.consolidationApproach}`,
    `Sites in boundary: ${context.siteCount}`,
    `Total: ${context.totalEmissions} tCO2e`,
    `Scope 1: ${context.scope1} tCO2e`,
    `Scope 2: ${context.scope2} tCO2e`,
    `Scope 3: ${context.scope3} tCO2e`,
    context.previousTotal === null
      ? "Previous year total: not available"
      : `Previous year total: ${context.previousTotal} tCO2e`,
    `Emission factor sources: ${context.factorSources.join(", ") || "not stated"}`,
    context.isSampleData ? "THESE ARE SAMPLE FIGURES, NOT REPORTED EMISSIONS." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateText({
    system: [
      BASE_SYSTEM_PROMPT,
      "You are drafting a section of a formal disclosure report.",
      "Use only the figures given. Never introduce a figure that is not listed.",
      "Write in the register of a published sustainability report: plain, precise, no marketing language.",
    ].join("\n"),
    prompt: [
      SECTION_INSTRUCTIONS[section],
      options.locale ? `Write in the language with IETF tag: ${options.locale}.` : "",
      "",
      "Facts:",
      facts,
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 600,
    fallback,
  });

  return { section, text: result.text, source: result.source, error: result.error };
}

/**
 * Drafts every section of a report.
 *
 * Sequential rather than parallel: with one API key these calls share a rate
 * limit, and four simultaneous requests are more likely to get one 429 — and so
 * one silently-fallback section in the middle of an otherwise generated report —
 * than four sequential ones are.
 */
export async function draftAllSections(
  context: ReportDraftContext,
  options: { locale?: string; sections?: readonly ReportSection[] } = {}
): Promise<DraftedSection[]> {
  const sections =
    options.sections ?? (["boundary", "methodology", "results", "reduction_actions"] as const);
  const drafted: DraftedSection[] = [];
  for (const section of sections) {
    drafted.push(await draftSection(section, context, { locale: options.locale }));
  }
  return drafted;
}
