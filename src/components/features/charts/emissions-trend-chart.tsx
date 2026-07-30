"use client";

/**
 * Emissions trend over time — stacked area, one band per GHG scope.
 *
 * Recharts measures its container in the browser, so this is a Client Component
 * (`"use client"` per the Next.js 16 directive docs). It receives already-shaped
 * data as serializable props and never touches a data source itself.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EmissionsTrendPoint } from "@/lib/dashboard/types";
import {
  CHART_HEIGHT,
  CHART_NEUTRAL,
  SCOPE_COLORS,
  formatTonnes,
  formatTonnesCompact,
} from "./chart-theme";
import { ChartEmptyState } from "./chart-empty-state";

interface EmissionsTrendChartProps {
  data: EmissionsTrendPoint[];
}

export function EmissionsTrendChart({ data }: EmissionsTrendChartProps) {
  const t = useTranslations("charts");
  const tScopes = useTranslations("scopes");
  const tMonths = useTranslations("months");
  const locale = useLocale();

  if (data.length === 0) {
    return <ChartEmptyState height={CHART_HEIGHT} />;
  }

  /**
   * `period` arrives as an ISO `YYYY-MM` string. Split rather than `new Date()`
   * so no timezone shifting can move a data point into the wrong month.
   */
  const chartData = data.map((point) => {
    const month = Number(point.period.slice(5, 7));
    return { ...point, label: tMonths(`m${month}`) };
  });

  return (
    <div style={{ height: CHART_HEIGHT }} role="img" aria-label={t("aria_trend")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            contentStyle={{
              backgroundColor: CHART_NEUTRAL.tooltipBackground,
              borderColor: CHART_NEUTRAL.tooltipBorder,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => `${formatTonnes(Number(value), locale)} ${t("unit_tco2e")}`}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="scope1"
            name={tScopes("scope1")}
            stackId="scopes"
            stroke={SCOPE_COLORS[1]}
            fill={SCOPE_COLORS[1]}
            fillOpacity={0.65}
          />
          <Area
            type="monotone"
            dataKey="scope2"
            name={tScopes("scope2")}
            stackId="scopes"
            stroke={SCOPE_COLORS[2]}
            fill={SCOPE_COLORS[2]}
            fillOpacity={0.65}
          />
          <Area
            type="monotone"
            dataKey="scope3"
            name={tScopes("scope3")}
            stackId="scopes"
            stroke={SCOPE_COLORS[3]}
            fill={SCOPE_COLORS[3]}
            fillOpacity={0.65}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
