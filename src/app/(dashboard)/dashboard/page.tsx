import { getLocale, getTranslations } from "next-intl/server";
import { KPICard } from "@/components/features/kpi-card";
import { SampleDataNotice } from "@/components/features/sample-data-notice";
import { EmissionsTrendChart } from "@/components/features/charts/emissions-trend-chart";
import { MonthlyComparisonChart } from "@/components/features/charts/monthly-comparison-chart";
import { ScopeBreakdownChart } from "@/components/features/charts/scope-breakdown-chart";
import { ScopeLegend } from "@/components/features/charts/scope-legend";
import { TopSourcesChart } from "@/components/features/charts/top-sources-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/dashboard/sample-data";

/**
 * Dashboard index, served at `/dashboard`.
 *
 * Note the route: `/` is the marketing landing page. This page previously lived
 * at `src/app/(dashboard)/page.tsx`, which compiled to `/` as well and lost the
 * collision, making the dashboard unreachable.
 *
 * This is a Server Component. It resolves the data once and hands plain
 * serializable arrays to the chart components, which are Client Components
 * because Recharts measures its container in the browser.
 *
 * The figures are sample data (see `src/lib/dashboard/sample-data.ts`) — there
 * is no live database yet. `data.isSampleData` drives the banner at the top of
 * the page so the numbers are never mistaken for reported emissions.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tScopes = await getTranslations("scopes");
  const tCharts = await getTranslations("charts");

  const locale = await getLocale();

  const data = await getDashboardData();
  const { kpis } = data;

  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const tonnes = (value: number) => `${numberFormat.format(value)} ${tCharts("unit_tco2e")}`;

  /** Negative change is an emissions reduction, i.e. good news. */
  const yoyDirection = kpis.yoyChangePercent <= 0 ? "down" : "up";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {data.isSampleData && <SampleDataNotice message={t("sample_data_notice")} />}

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t("total_emissions")}
          value={tonnes(kpis.totalEmissions)}
          trend={{ value: kpis.yoyChangePercent, direction: yoyDirection }}
          description={t("vs_last_year")}
          icon={<CloudIconSmall />}
        />
        <KPICard
          title={t("scope1_total")}
          value={tonnes(kpis.scope1)}
          description={t("direct_emissions")}
        />
        <KPICard
          title={t("scope2_total")}
          value={tonnes(kpis.scope2)}
          description={t("electricity_heat")}
        />
        <KPICard
          title={t("scope3_total")}
          value={tonnes(kpis.scope3)}
          description={t("value_chain")}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title={t("reduction_progress")}
          value={`${kpis.reductionProgressPercent}%`}
          description={t("target_progress_desc")}
        />
        <KPICard
          title={t("emission_intensity")}
          value={`${kpis.intensityPerRevenue} tCO2e/M KRW`}
          description={t("revenue_intensity")}
        />
        <KPICard
          title={t("yoy_change")}
          value={`${kpis.yoyChangePercent}%`}
          description={t("vs_previous_year")}
          trend={{ value: kpis.yoyChangePercent, direction: yoyDirection }}
        />
      </div>

      {/* Emissions trend + scope breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("emissions_trend")}</CardTitle>
            <CardDescription>{t("emissions_trend_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <EmissionsTrendChart data={data.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("scope_breakdown")}</CardTitle>
            <CardDescription>{t("scope_breakdown_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScopeBreakdownChart data={data.scopeBreakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Monthly year-over-year comparison */}
      <Card>
        <CardHeader>
          <CardTitle>{t("monthly_comparison")}</CardTitle>
          <CardDescription>
            {/*
              Years are passed as strings on purpose: ICU formats a numeric
              argument with locale grouping separators, which would render 2024
              as "2,024".
            */}
            {t("monthly_comparison_desc", {
              current: String(data.year),
              previous: String(data.year - 1),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyComparisonChart data={data.monthlyComparison} year={data.year} />
        </CardContent>
      </Card>

      {/* Top 10 emission sources */}
      <Card>
        <CardHeader>
          <CardTitle>{t("top_sources")}</CardTitle>
          <CardDescription>{t("top_sources_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TopSourcesChart data={data.topSources} />
          <ScopeLegend />
        </CardContent>
      </Card>

      {/* Scope totals as text, so the figures behind the donut stay readable
          for screen readers and anywhere the chart cannot render. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("scope_summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            {data.scopeBreakdown.map((slice) => (
              <div key={slice.scope} className="rounded-md border p-4">
                <dt className="text-sm text-muted-foreground">{tScopes(`scope${slice.scope}`)}</dt>
                <dd className="text-lg font-semibold">{tonnes(slice.value)}</dd>
                <dd className="text-xs text-muted-foreground">
                  {Math.round((slice.value / kpis.totalEmissions) * 1000) / 10}%
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function CloudIconSmall() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}
