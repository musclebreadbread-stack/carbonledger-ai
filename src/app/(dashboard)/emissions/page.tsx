import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function EmissionsPage() {
  const t = await getTranslations("emissions");
  const tNav = await getTranslations("nav");
  const tStatus = await getTranslations("status");
  const tTypes = await getTranslations("emission_types");
  const tSources = await getTranslations("emission_sources");

  // Sample data for the emissions table
  const emissions = [
    { id: "1", source: tSources("boiler_1"), scope: "Scope 1", type: tTypes("stationary_combustion"), amount: "1,234", unit: "tCO2e", status: "approved", period: "2024-01" },
    { id: "2", source: tSources("company_fleet"), scope: "Scope 1", type: tTypes("mobile_combustion"), amount: "456", unit: "tCO2e", status: "pending", period: "2024-01" },
    { id: "3", source: tSources("grid_electricity"), scope: "Scope 2", type: tTypes("location_based"), amount: "2,891", unit: "tCO2e", status: "approved", period: "2024-01" },
    { id: "4", source: tSources("hvac_system"), scope: "Scope 1", type: tTypes("fugitive"), amount: "89", unit: "tCO2e", status: "draft", period: "2024-01" },
    { id: "5", source: tSources("business_travel"), scope: "Scope 3", type: tTypes("cat6"), amount: "234", unit: "tCO2e", status: "pending", period: "2024-01" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link href="/emissions/new">
          <Button>{t("add_record")}</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex gap-4 p-4">
          <Badge variant="secondary">{t("all_scopes")}</Badge>
          <Badge variant="outline">{tNav("scope1")}</Badge>
          <Badge variant="outline">{tNav("scope2")}</Badge>
          <Badge variant="outline">{tNav("scope3")}</Badge>
        </CardContent>
      </Card>

      {/* Emissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("records")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">{t("source")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("scope")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("type")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("amount")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("period")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {emissions.map((em) => (
                  <tr key={em.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{em.source}</td>
                    <td className="px-4 py-3">{em.scope}</td>
                    <td className="px-4 py-3">{em.type}</td>
                    <td className="px-4 py-3 text-right">{em.amount} {em.unit}</td>
                    <td className="px-4 py-3">{em.period}</td>
                    <td className="px-4 py-3">
                      <Badge variant={em.status === "approved" ? "default" : em.status === "pending" ? "secondary" : "outline"}>
                        {tStatus(em.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
