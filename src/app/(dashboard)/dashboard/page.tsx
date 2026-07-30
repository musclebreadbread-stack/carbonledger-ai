import { getTranslations } from "next-intl/server";
import { KPICard } from "@/components/features/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t("total_emissions")}
          value="12,456 tCO2e"
          trend={{ value: -8.2, direction: "down" }}
          description={t("vs_last_year")}
          icon={<CloudIconSmall />}
        />
        <KPICard
          title={t("scope1_total")}
          value="4,231 tCO2e"
          trend={{ value: -5.1, direction: "down" }}
          description={t("direct_emissions")}
        />
        <KPICard
          title={t("scope2_total")}
          value="5,892 tCO2e"
          trend={{ value: -12.3, direction: "down" }}
          description={t("electricity_heat")}
        />
        <KPICard
          title={t("scope3_total")}
          value="2,333 tCO2e"
          trend={{ value: 3.4, direction: "up" }}
          description={t("value_chain")}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title={t("reduction_progress")}
          value="32%"
          description={t("target_progress_desc")}
          trend={{ value: 8, direction: "down" }}
        />
        <KPICard
          title={t("emission_intensity")}
          value="0.42 tCO2e/M KRW"
          description={t("revenue_intensity")}
          trend={{ value: -10.5, direction: "down" }}
        />
        <KPICard
          title={t("yoy_change")}
          value="-8.2%"
          description={t("vs_previous_year")}
          trend={{ value: -8.2, direction: "down" }}
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Emissions Trend Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>{t("emissions_trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
              <div className="space-y-2 text-center">
                <Skeleton className="mx-auto h-32 w-full max-w-xs" />
                <p className="text-sm text-muted-foreground">{t("trend_placeholder")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scope Breakdown Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t("scope_breakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-xs">{t("scope1_total")} (34%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-xs">{t("scope2_total")} (47%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-xs">{t("scope3_total")} (19%)</span>
                  </div>
                </div>
                <Skeleton className="mx-auto h-32 w-32 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Emission Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("top_sources")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>{t("monthly_comparison")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
            <div className="space-y-2 text-center">
              <Skeleton className="mx-auto h-32 w-full max-w-md" />
              <p className="text-sm text-muted-foreground">{t("comparison_placeholder")}</p>
            </div>
          </div>
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
