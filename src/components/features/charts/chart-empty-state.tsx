"use client";

/**
 * Shown in place of a chart when the provider returns no rows.
 *
 * Keeping this in one place means every chart degrades identically instead of
 * rendering an empty axis frame that looks like a rendering bug.
 */

import { useTranslations } from "next-intl";

interface ChartEmptyStateProps {
  /** Matches the height the chart would have occupied, to avoid layout shift. */
  height: number;
}

export function ChartEmptyState({ height }: ChartEmptyStateProps) {
  const t = useTranslations("charts");

  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
    >
      {t("no_data")}
    </div>
  );
}
