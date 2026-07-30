"use client";

/**
 * Month-by-month total emissions for the reporting year against the year
 * before — grouped (not stacked) bars, so the two years sit side by side and
 * the gap between them reads as the year-over-year delta.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyComparisonPoint } from "@/lib/dashboard/types";
import {
  CHART_HEIGHT_COMPACT,
  CHART_NEUTRAL,
  COMPARISON_COLORS,
  formatTonnes,
  formatTonnesCompact,
} from "./chart-theme";
import { ChartEmptyState } from "./chart-empty-state";

interface MonthlyComparisonChartProps {
  data: MonthlyComparisonPoint[];
  /** Reporting year, used to label the two series (e.g. "2024" vs "2023"). */
  year: number;
}

export function MonthlyComparisonChart({ data, year }: MonthlyComparisonChartProps) {
  const t = useTranslations("charts");
  const tMonths = useTranslations("months");
  const locale = useLocale();

  if (data.length === 0) {
    return <ChartEmptyState height={CHART_HEIGHT_COMPACT} />;
  }

  const chartData = data.map((point) => ({
    ...point,
    label: tMonths(`m${point.month}`),
  }));

  return (
    <div
      style={{ height: CHART_HEIGHT_COMPACT }}
      data-testid="chart-monthly-comparison"
      role="img"
      aria-label={t("aria_monthly_comparison")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_NEUTRAL.grid} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={CHART_NEUTRAL.axis}
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            stroke={CHART_NEUTRAL.axis}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => formatTonnesCompact(value, locale)}
          />
          <Tooltip
            cursor={{ fill: CHART_NEUTRAL.grid, fillOpacity: 0.4 }}
            contentStyle={{
              backgroundColor: CHART_NEUTRAL.tooltipBackground,
              borderColor: CHART_NEUTRAL.tooltipBorder,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => `${formatTonnes(Number(value), locale)} ${t("unit_tco2e")}`}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {/*
            Previous year is drawn first so the (visually louder) current year
            sits on the right of each pair, matching reading order.
          */}
          <Bar
            dataKey="previousYear"
            name={String(year - 1)}
            fill={COMPARISON_COLORS.previousYear}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="currentYear"
            name={String(year)}
            fill={COMPARISON_COLORS.currentYear}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
