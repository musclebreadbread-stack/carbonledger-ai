/**
 * Question answering over the company's own inventory (질의응답).
 *
 * Generative. Requires `OPENAI_API_KEY`; NOT VERIFIED in the sandbox this was
 * built in, where no key exists.
 *
 * Grounding, not retrieval-augmented guessing: the prompt carries a compact,
 * explicitly-labelled snapshot of the inventory, and the system prompt forbids
 * using anything else. Without that, the most likely failure is a confident
 * answer citing an emission factor the model remembers from training rather than
 * the one this company actually used — which in a regulated report is worse than
 * no answer.
 *
 * With no key configured, `answerQuestion` returns a deterministic response that
 * says plainly that Q&A is unavailable and points at the figures that *are*
 * available. It never fabricates an answer.
 */

import { BASE_SYSTEM_PROMPT, generateText, isAiConfigured } from "./client";
import type { AnalysisSource, Finding } from "./types";

/** The grounding snapshot handed to the model. All figures in tCO2e. */
export interface InventoryContext {
  year: number;
  totalEmissions: number;
  scope1: number;
  scope2: number;
  scope3: number;
  /** True when the figures are sample data — the model is told so explicitly. */
  isSampleData: boolean;
  /** Largest sources, as `sourceKey` → tCO2e. */
  topSources: { sourceKey: string; emissions: number }[];
  /** Outstanding data-quality findings, so the model can qualify its answer. */
  findings: readonly Finding[];
}

export interface QaAnswer {
  question: string;
  answer: string;
  source: AnalysisSource;
  /** True when the answer is the offline fallback rather than a model reply. */
  unavailable: boolean;
  error?: string;
}

/**
 * Renders the context as compact labelled text.
 *
 * Plain labelled lines rather than JSON: JSON in a prompt invites the model to
 * reply in JSON, and it wastes tokens on punctuation. The `SAMPLE DATA` warning
 * is first because it changes how every other number in the block should be
 * described.
 */
export function formatInventoryContext(context: InventoryContext): string {
  const lines: string[] = [];

  if (context.isSampleData) {
    lines.push(
      "WARNING: these figures are sample data, not reported emissions. Say so in your answer."
    );
  }

  lines.push(
    `Reporting year: ${context.year}`,
    `Total emissions: ${context.totalEmissions} tCO2e`,
    `Scope 1: ${context.scope1} tCO2e`,
    `Scope 2: ${context.scope2} tCO2e`,
    `Scope 3: ${context.scope3} tCO2e`
  );

  if (context.topSources.length > 0) {
    lines.push("Largest sources (tCO2e):");
    for (const source of context.topSources) {
      lines.push(`  - ${source.sourceKey}: ${source.emissions}`);
    }
  }

  if (context.findings.length > 0) {
    lines.push(`Outstanding data-quality findings: ${context.findings.length}`);
    for (const finding of context.findings.slice(0, 10)) {
      lines.push(
        `  - [${finding.severity}] ${finding.titleKey}` +
          (finding.sourceKey ? ` (${finding.sourceKey}` : "") +
          (finding.period ? `, ${finding.period})` : finding.sourceKey ? ")" : "")
      );
    }
  }

  return lines.join("\n");
}

/** Maximum question length accepted. */
export const MAX_QUESTION_LENGTH = 500;

/**
 * Answers a question about the inventory.
 *
 * Rejects an empty or over-long question before spending a request on it, and
 * returns the rejection as a normal answer with `unavailable: true` rather than
 * throwing — a Route Handler should not have to distinguish "no key" from "bad
 * input" in its error handling when both produce the same user-visible outcome.
 */
export async function answerQuestion(
  question: string,
  context: InventoryContext,
  options: { locale?: string } = {}
): Promise<QaAnswer> {
  const trimmed = question.trim();

  if (trimmed.length === 0) {
    return {
      question: trimmed,
      answer: "No question was provided.",
      source: "deterministic",
      unavailable: true,
      error: "empty_question",
    };
  }

  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return {
      question: trimmed.slice(0, MAX_QUESTION_LENGTH),
      answer: `Questions are limited to ${MAX_QUESTION_LENGTH} characters.`,
      source: "deterministic",
      unavailable: true,
      error: "question_too_long",
    };
  }

  const fallback = [
    "Question answering needs a configured language model (OPENAI_API_KEY), and none is set,",
    "so this question was not answered.",
    "The figures the assistant would have drawn on are shown below and remain available:",
    `total ${context.totalEmissions} tCO2e for ${context.year}`,
    `(Scope 1 ${context.scope1}, Scope 2 ${context.scope2}, Scope 3 ${context.scope3}).`,
    context.isSampleData ? "These are sample figures, not reported emissions." : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!isAiConfigured()) {
    return { question: trimmed, answer: fallback, source: "fallback", unavailable: true };
  }

  const result = await generateText({
    system: [
      BASE_SYSTEM_PROMPT,
      "Answer only from the inventory snapshot provided. If it does not contain",
      "what is needed, say which figure is missing.",
    ].join("\n"),
    prompt: [
      "Inventory snapshot:",
      formatInventoryContext(context),
      "",
      options.locale ? `Reply in the language with IETF tag: ${options.locale}.` : "",
      `Question: ${trimmed}`,
    ]
      .filter(Boolean)
      .join("\n"),
    maxTokens: 600,
    fallback,
  });

  return {
    question: trimmed,
    answer: result.text,
    source: result.source,
    unavailable: result.source !== "llm",
    error: result.error,
  };
}

/**
 * Suggested questions shown before the user types anything.
 *
 * Message keys under `ai.suggested_questions`, so the suggestions are translated
 * rather than English-only prompts bolted onto a Korean UI.
 */
export const SUGGESTED_QUESTION_KEYS: readonly string[] = [
  "largest_source",
  "yoy_driver",
  "scope2_reduction",
  "data_gaps",
  "target_feasibility",
] as const;
