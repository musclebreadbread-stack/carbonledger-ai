import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmissionFactorLibrary, type EmissionFactorRow } from "@/components/features/emission-factor-library";

export default async function EmissionFactorsPage() {
  const t = await getTranslations("emission_factors");

  const factors: EmissionFactorRow[] = [
    { id: "1", name: t("item_natural_gas"), provider: t("provider_korea_moe"), version: "2023", value: "2.176", unit: "kgCO2/Nm3", category: t("cat_fuel") },
    { id: "2", name: t("item_diesel"), provider: t("provider_korea_moe"), version: "2023", value: "2.584", unit: "kgCO2/L", category: t("cat_fuel") },
    { id: "3", name: t("item_grid_electricity"), provider: t("provider_korea_moe"), version: "2023", value: "0.4594", unit: "kgCO2/kWh", category: t("cat_electricity") },
    { id: "4", name: t("item_gasoline"), provider: t("provider_korea_moe"), version: "2023", value: "2.208", unit: "kgCO2/L", category: t("cat_fuel") },
    { id: "5", name: t("item_r410a"), provider: t("provider_ipcc_ar6"), version: "2021", value: "2,256", unit: "kgCO2e/kg", category: t("cat_refrigerant") },
    { id: "6", name: t("item_air_travel"), provider: t("provider_defra"), version: "2023", value: "0.1935", unit: "kgCO2e/pkm", category: t("cat_travel") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline" disabled title={t("compare_unavailable")}>{t("compare_versions")}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("library")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("compare_unavailable")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <EmissionFactorLibrary
            factors={factors}
            labels={{
              search: t("search_placeholder"),
              allProviders: t("all_providers"),
              name: t("name"),
              provider: t("provider"),
              version: t("version"),
              value: t("value"),
              unit: t("unit"),
              category: t("category"),
              noResults: t("no_results"),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
