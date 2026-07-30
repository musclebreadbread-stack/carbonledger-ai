"use client";

/**
 * Scope 1 / 2 / 3 split as a donut, with the annual total in the middle.
 *
 * The donut hole is produced by `innerRadius` on Recharts' `Pie`; the centred
 * total is a plain absolutely-positioned element rather than a chart label so it
 * stays selectable text (and therefore assertable in E2E tests).
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ScopeBreakdownSlice } from "@/lib/dashboard/types";
import { CHART_HEIGHT, CHART_NEUTRAL, SCOPE_COLORS, formatTonnes } from "./chart-theme";
import { ChartEmptyState } from "./chart-empty-state";

interface ScopeBreakdownChartProps {
  data: ScopeBreakdownSlice[];
}

export function ScopeBreakdownChart({ data }: ScopeBreakdownChartProps) {
  const t = useTranslations("charts");
  const tScopes = useTranslations("scopes");
  const locale = useLocale();

  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  if (data.length === 0 || total === 0) {
    return <ChartEmptyState height={CHART_HEIGHT} />;
  }

  const chartData = data.map((slice) => ({
    ...slice,
    label: tScopes(`scope${slice.scope}`),
    percent: (slice.value / total) * 100,
  }));

  return (
    <div
      className="relative"
      style={{ height: CHART_HEIGHT }}
      data-testid="chart-scope-breakdown"
      role="img"
      aria-label={t("aria_scope_breakdown")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {chartData.map((slice) => (
              <Cell key={slice.scope} fill={SCOPE_COLORS[slice.scope]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: CHART_NEUTRAL.tooltipBackground,
              borderColor: CHART_NEUTRAL.tooltipBorder,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => `${formatTonnes(Number(value), locale)} ${t("unit_tco2e")}`}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>

      {/*
        Centred total. `pointer-events-none` keeps it from stealing hover events
        from the slices underneath, and the offset accounts for the legend row
        Recharts reserves at the bottom of the container.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-[42%] -translate-y-1/2 text-center">
        <div className="text-xs text-muted-foreground">{t("total")}</div>
        <div className="text-xl font-bold">{formatTonnes(total, locale)}</div>
        <div className="text-xs text-muted-foreground">{t("unit_tco2e")}</div>
      </div>
    </div>
  );
}
