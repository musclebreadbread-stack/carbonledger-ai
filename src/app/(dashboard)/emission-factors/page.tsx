import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function EmissionFactorsPage() {
  const t = await getTranslations("emission_factors");

  const factors = [
    { id: "1", name: t("item_natural_gas"), provider: t("provider_korea_moe"), version: "2023", value: "2.176", unit: "kgCO2/Nm3", category: t("cat_fuel") },
    { id: "2", name: t("item_diesel"), provider: t("provider_korea_moe"), version: "2023", value: "2.584", unit: "kgCO2/L", category: t("cat_fuel") },
    { id: "3", name: t("item_grid_electricity"), provider: t("provider_korea_moe"), version: "2023", value: "0.4594", unit: "kgCO2/kWh", category: t("cat_electricity") },
    { id: "4", name: t("item_gasoline"), provider: t("provider_korea_moe"), version: "2023", value: "2.208", unit: "kgCO2/L", category: t("cat_fuel") },
    { id: "5", name: t("item_r410a"), provider: t("provider_ipcc_ar6"), version: "2021", value: "2,256", unit: "kgCO2e/kg", category: t("cat_refrigerant") },
    { id: "6", name: t("item_air_travel"), provider: t("provider_defra"), version: "2023", value: "0.1935", unit: "kgCO2e/pkm", category: t("cat_travel") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline">{t("compare_versions")}</Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <Input placeholder={t("search_placeholder")} className="max-w-sm" />
        <Badge variant="secondary">{t("all_providers")}</Badge>
        <Badge variant="outline">{t("provider_korea_moe")}</Badge>
        <Badge variant="outline">{t("provider_ipcc")}</Badge>
        <Badge variant="outline">{t("provider_defra")}</Badge>
      </div>

      {/* Factors Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("library")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("provider")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("version")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("value")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("unit")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("category")}</th>
                </tr>
              </thead>
              <tbody>
                {factors.map((f) => (
                  <tr key={f.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{f.provider}</Badge>
                    </td>
                    <td className="px-4 py-3">{f.version}</td>
                    <td className="px-4 py-3 text-right font-mono">{f.value}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.unit}</td>
                    <td className="px-4 py-3">{f.category}</td>
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
