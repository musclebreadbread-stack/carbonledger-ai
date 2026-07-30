/**
 * Reduction idea recommendation (감축 아이디어 추천).
 *
 * Hybrid by design. The *ranking* is deterministic — it comes straight out of the
 * marginal abatement cost curve in `./scenario.ts`, so the order is reproducible
 * and defensible. Only the accompanying narrative is generative.
 *
 * That split matters because a model asked to rank abatement options will
 * produce a plausible order that does not survive contact with the company's
 * actual cost curve. Ranking is arithmetic; explanation is prose. Each is done by
 * the tool that is good at it.
 *
 * The deterministic part is covered by `tests/lib/ai/recommendations.test.ts`.
 * The narrative path requires `OPENAI_API_KEY` and was NOT verified in the
 * sandbox this was built in.
 */

import { BASE_SYSTEM_PROMPT, generateText, isAiConfigured } from "./client";
import { buildCostCurve, type AbatementMeasure, type AppraisalAssumptions } from "./scenario";
import type { AnalysisSource, Finding } from "./types";

/** One recommendation as the UI renders it. */
export interface Recommendation {
  id: string;
  /** Key under `ai.measures`, matching the measure it came from. */
  nameKey: string;
  /** 1-based rank on the cost curve, cheapest first. */
  rank: number;
  marginalAbatementCostKrw: number;
  annualAbatementTco2e: number;
  capexKrw: number;
  paybackYears: number | null;
  npvKrw: number;
  scope: 1 | 2 | 3;
  /**
   * Why this measure is being suggested, as a message key under
   * `ai.recommendation_reasons`. Derived from the economics, not from a model.
   */
  reasonKey: "negative_cost" | "fast_payback" | "large_abatement" | "cost_effective";
  source: AnalysisSource;
}

/**
 * Ranks measures and attaches a reason to each.
 *
 * The reason is chosen by the first condition that applies, in decreasing order
 * of how persuasive it is to a CFO: pays for itself, pays back fast, moves a lot
 * of tonnes, or is simply cheap per tonne. A measure always gets a reason, so the
 * UI never renders a recommendation it cannot justify.
 */
export function recommendMeasures(
  measures: readonly AbatementMeasure[],
  assumptions: AppraisalAssumptions,
  options: { limit?: number } = {}
): Recommendation[] {
  const curve = buildCostCurve(measures, assumptions);
  const totalAbatement = curve.reduce(
    (sum, step) => sum + step.appraisal.measure.annualAbatementTco2e,
    0
  );

  return curve.slice(0, options.limit ?? curve.length).map((step, index) => {
    const { appraisal } = step;
    const mac = appraisal.marginalAbatementCostKrw as number;
    const share =
      totalAbatement > 0 ? appraisal.measure.annualAbatementTco2e / totalAbatement : 0;

    let reasonKey: Recommendation["reasonKey"];
    if (mac < 0) reasonKey = "negative_cost";
    else if (appraisal.paybackYears !== null && appraisal.paybackYears <= 3)
      reasonKey = "fast_payback";
    else if (share >= 0.25) reasonKey = "large_abatement";
    else reasonKey = "cost_effective";

    return {
      id: appraisal.measure.id,
      nameKey: appraisal.measure.nameKey,
      rank: index + 1,
      marginalAbatementCostKrw: mac,
      annualAbatementTco2e: appraisal.measure.annualAbatementTco2e,
      capexKrw: appraisal.measure.capexKrw,
      paybackYears: appraisal.paybackYears,
      npvKrw: appraisal.npvKrw,
      scope: appraisal.measure.scope,
      reasonKey,
      source: "deterministic",
    };
  });
}

/**
 * Narrative to accompany the ranked list.
 *
 * The fallback is not an apology — it states the deterministic conclusion the
 * numbers already support, so the panel is useful with no API key at all. The
 * generative version adds context the arithmetic cannot: sequencing,
 * implementation risk, interactions between measures.
 */
export async function draftRecommendationNarrative(
  recommendations: readonly Recommendation[],
  findings: readonly Finding[],
  options: { locale?: string } = {}
): Promise<{ text: string; source: AnalysisSource; error?: string }> {
  const negativeCost = recommendations.filter((item) => item.marginalAbatementCostKrw < 0);
  const totalAbatement = recommendations.reduce(
    (sum, item) => sum + item.annualAbatementTco2e,
    0
  );

  const fallback = [
    `${recommendations.length} measures were ranked by marginal abatement cost.`,
    negativeCost.length > 0
      ? `${negativeCost.length} of them have a negative marginal abatement cost, meaning they pay for themselves at the assumed carbon price and should be actioned first.`
      : "No measure has a negative marginal abatement cost at the assumed carbon price.",
    `Together the ranked measures abate ${Math.round(totalAbatement)} tCO2e per year.`,
    findings.length > 0
      ? `${findings.length} data-quality findings are outstanding; resolving them may change this ranking.`
      : "No outstanding data-quality findings affect this ranking.",
    "This summary was generated deterministically from the cost curve because no language model is configured.",
  ].join(" ");

  if (!isAiConfigured()) {
    return { text: fallback, source: "fallback" };
  }

  // Only the fields the model needs, and no free-text company data: a narrower
  // prompt is both cheaper and less able to leak.
  const context = recommendations
    .map(
      (item) =>
        `${item.rank}. ${item.nameKey}: MAC ${item.marginalAbatementCostKrw} KRW/tCO2e, ` +
        `abatement ${item.annualAbatementTco2e} tCO2e/yr, capex ${item.capexKrw} KRW, ` +
        `payback ${item.paybackYears ?? "none"} yr, scope ${item.scope}`
    )
    .join("\n");

  return generateText({
    system: BASE_SYSTEM_PROMPT,
    prompt: [
      "Below is a marginal abatement cost curve computed from the company's own data.",
      "Write a short implementation commentary (max 6 sentences).",
      "Do not restate the numbers; explain sequencing and what would block each measure.",
      options.locale ? `Reply in the language with IETF tag: ${options.locale}.` : "",
      "",
      context,
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 500,
    fallback,
  });
}
