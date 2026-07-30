"use client";

/**
 * Top-10 emission sources as a horizontal bar ranking.
 *
 * Horizontal (`layout="vertical"` in Recharts' axis-oriented naming) because
 * source names are long in every locale this app ships and would otherwise be
 * truncated or rotated on a categorical X axis. Bars are tinted by scope so the
 * ranking doubles as a scope-composition read.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EmissionSourceRank } from "@/lib/dashboard/types";
import { CHART_NEUTRAL, SCOPE_COLORS, formatTonnes, formatTonnesCompact } from "./chart-theme";
import { ChartEmptyState } from "./chart-empty-state";

interface TopSourcesChartProps {
  data: EmissionSourceRank[];
}

/** Vertical space each bar needs so long labels stay legible. */
const ROW_HEIGHT = 34;

export function TopSourcesChart({ data }: TopSourcesChartProps) {
  const t = useTranslations("charts");
  const tSources = useTranslations("emission_sources");
  const locale = useLocale();

  if (data.length === 0) {
    return <ChartEmptyState height={ROW_HEIGHT * 5} />;
  }

  /*
   * `sourceKey` is a message key for the sample data, but a database-backed
   * provider would return arbitrary stored names. Fall back to the raw value
   * rather than letting next-intl surface a missing-message error.
   */
  const chartData = data.map((source) => ({
    ...source,
    label: tSources.has(source.sourceKey) ? tSources(source.sourceKey) : source.sourceKey,
  }));

  return (
    <div
      style={{ height: ROW_HEIGHT * chartData.length + 32 }}
      role="img"
      aria-label={t("aria_top_sources")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 56, left: 0, bottom: 8 }}
        >
          <XAxis
            type="number"
            stroke={CHART_NEUTRAL.axis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatTonnesCompact(value, locale)}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke={CHART_NEUTRAL.axis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={150}
          />
          <Tooltip
            cursor={{ fill: CHART_NEUTRAL.grid, fillOpacity: 0.4 }}
            contentStyle={{
              backgroundColor: CHART_NEUTRAL.tooltipBackground,
              borderColor: CHART_NEUTRAL.tooltipBorder,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, _name, item) => {
              const share = (item?.payload as EmissionSourceRank | undefined)?.share;
              const tonnes = `${formatTonnes(Number(value), locale)} ${t("unit_tco2e")}`;
              return share === undefined ? tonnes : `${tonnes} (${share}%)`;
            }}
          />
          <Bar dataKey="emissions" name={t("unit_tco2e")} radius={[0, 3, 3, 0]} barSize={18}>
            {chartData.map((source) => (
              <Cell key={source.sourceKey} fill={SCOPE_COLORS[source.scope]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
