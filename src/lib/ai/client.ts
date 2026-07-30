/**
 * OpenAI access for the generative half of the AI module.
 *
 * Design constraint that shapes this whole file: **there is no
 * `OPENAI_API_KEY` in the sandbox this was built in**, and there may be none in
 * a given deployment either. So no caller may assume a model is reachable. Every
 * generative feature asks `isAiConfigured()` first and has a deterministic
 * fallback; nothing throws, and nothing renders a spinner forever waiting on a
 * client that was never going to work.
 *
 * The `openai` package is imported dynamically rather than at module load. Two
 * reasons: a Server Component that only uses the deterministic analyses should
 * not pull the SDK into its module graph, and a missing/broken dependency should
 * degrade to the fallback rather than crash the page render.
 *
 * NOT VERIFIED IN THIS SANDBOX: no request in this file has ever been executed
 * against the real API here. The fallback paths are tested; the live paths are
 * not.
 */

import type { AnalysisSource } from "./types";

/** Default model. Overridable so a deployment can pin or downgrade. */
export const DEFAULT_MODEL = "gpt-4o-mini";

/** Whether a generative call can even be attempted. */
export function isAiConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/** Model name in force, for the UI to disclose. */
export function configuredModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Result of a generative call, always tagged with its provenance. */
export interface GenerationResult {
  text: string;
  source: AnalysisSource;
  /** Set when the call was attempted and failed, for the UI to surface. */
  error?: string;
}

export interface GenerateOptions {
  /** System prompt establishing the assistant's role and constraints. */
  system: string;
  /** User prompt, already containing any data context. */
  prompt: string;
  /** Upper bound on response length. */
  maxTokens?: number;
  /**
   * Sampling temperature. Defaults low: these outputs sit next to regulated
   * figures, and a creative rewording of a GHG Protocol category name is not a
   * feature.
   */
  temperature?: number;
  /**
   * Deterministic text to return when no key is configured or the call fails.
   * Required, not optional — a generative feature without a fallback would have
   * no behaviour at all in this environment, and making callers supply one forces
   * the question "what does this look like offline?" to be answered.
   */
  fallback: string;
}

/**
 * Requests a completion, degrading to `options.fallback`.
 *
 * Never throws. A caller rendering a page cannot usefully handle an OpenAI
 * outage, and an unhandled rejection in a Server Component would take out the
 * whole route — including the deterministic analyses, which are the ones that
 * still work.
 */
export async function generateText(options: GenerateOptions): Promise<GenerationResult> {
  if (!isAiConfigured()) {
    return { text: options.fallback, source: "fallback" };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.chat.completions.create({
      model: configuredModel(),
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 700,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.prompt },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      // An empty completion is a failure, not a valid answer. Falling through to
      // the fallback is better than rendering a blank recommendations panel.
      return { text: options.fallback, source: "fallback", error: "empty_completion" };
    }

    return { text, source: "llm" };
  } catch (error) {
    return {
      text: options.fallback,
      source: "fallback",
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/**
 * The system prompt every generative feature in this module shares.
 *
 * The constraints are not decoration. A model asked about carbon accounting will
 * happily invent an emission factor to three decimal places, and an invented
 * factor inside an ISO 14064 inventory is a compliance failure, not a typo. So:
 * never produce figures, and say so when the data is insufficient.
 */
export const BASE_SYSTEM_PROMPT = [
  "You are a GHG accounting assistant for a corporate carbon management platform.",
  "You follow the GHG Protocol Corporate Standard, ISO 14064-1, and SBTi criteria.",
  "Rules you must not break:",
  "1. Never invent emission factors, emission figures, or regulatory thresholds.",
  "   Use only numbers present in the context you are given.",
  "2. If the context is insufficient to answer, say so explicitly instead of guessing.",
  "3. Distinguish clearly between what the data shows and what you are inferring.",
  "4. Keep answers concise and specific to the data provided.",
].join("\n");
