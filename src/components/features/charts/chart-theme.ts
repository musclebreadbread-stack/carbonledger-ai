/**
 * Shared visual constants for the Recharts dashboard charts.
 *
 * Recharts renders SVG and styles geometry through `fill`/`stroke` props, so
 * these are literal colour values rather than Tailwind class names. They mirror
 * the Tailwind palette the rest of the UI uses (red-500 / blue-500 / green-500)
 * so scope colours stay recognisable across charts.
 */

import type { Scope } from "@/lib/dashboard/types";

export const SCOPE_COLORS: Record<Scope, string> = {
  1: "#ef4444",
  2: "#3b82f6",
  3: "#22c55e",
};

/** Bars for the current reporting year vs. the year before. */
export const COMPARISON_COLORS = {
  currentYear: "#0ea5e9",
  previousYear: "#94a3b8",
} as const;

/**
 * Muted greys for axes, grid lines and tooltips.
 *
 * `currentColor` is not usable here because Recharts writes these onto SVG
 * presentation attributes on elements outside the themed subtree.
 */
export const CHART_NEUTRAL = {
  grid: "#e2e8f0",
  axis: "#64748b",
  tooltipBackground: "#ffffff",
  tooltipBorder: "#cbd5e1",
} as const;

/** Uniform height for the taller charts, in pixels. */
export const CHART_HEIGHT = 288;

/** Uniform height for the compact charts, in pixels. */
export const CHART_HEIGHT_COMPACT = 240;

/**
 * Formats a tCO2e quantity for axis ticks and tooltips.
 *
 * Uses the active locale's grouping separators via `Intl`, and abbreviates
 * thousands on axis ticks so the labels stay readable.
 */
export function formatTonnes(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatTonnesCompact(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
