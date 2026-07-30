import { KPICard } from "@/components/features/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">GHG emissions overview and key performance indicators</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Emissions"
          value="12,456 tCO2e"
          trend={{ value: -8.2, direction: "down" }}
          description="vs. last year"
          icon={<CloudIconSmall />}
        />
        <KPICard
          title="Scope 1"
          value="4,231 tCO2e"
          trend={{ value: -5.1, direction: "down" }}
          description="Direct emissions"
        />
        <KPICard
          title="Scope 2"
          value="5,892 tCO2e"
          trend={{ value: -12.3, direction: "down" }}
          description="Electricity & heat"
        />
        <KPICard
          title="Scope 3"
          value="2,333 tCO2e"
          trend={{ value: 3.4, direction: "up" }}
          description="Value chain"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Reduction Progress"
          value="32%"
          description="of 2030 target (50% reduction)"
          trend={{ value: 8, direction: "down" }}
        />
        <KPICard
          title="Emission Intensity"
          value="0.42 tCO2e/M KRW"
          description="Revenue intensity"
          trend={{ value: -10.5, direction: "down" }}
        />
        <KPICard
          title="YoY Change"
          value="-8.2%"
          description="Compared to previous year"
          trend={{ value: -8.2, direction: "down" }}
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Emissions Trend Chart Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Emissions Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
              <div className="space-y-2 text-center">
                <Skeleton className="mx-auto h-32 w-full max-w-xs" />
                <p className="text-sm text-muted-foreground">Monthly emissions trend (Recharts)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scope Breakdown Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Scope Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed">
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-xs">Scope 1 (34%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-xs">Scope 2 (47%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-xs">Scope 3 (19%)</span>
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
          <CardTitle>Top 10 Emission Sources</CardTitle>
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
          <CardTitle>Monthly Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
            <div className="space-y-2 text-center">
              <Skeleton className="mx-auto h-32 w-full max-w-md" />
              <p className="text-sm text-muted-foreground">Monthly comparison bar chart (Recharts)</p>
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
