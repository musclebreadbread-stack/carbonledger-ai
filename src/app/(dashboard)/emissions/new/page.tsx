"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculate, type CalculationResult, type EmissionSourceType, type FuelType, type Scope } from "@/lib/calculation-engine";

const SOURCE_OPTIONS: Record<Scope, readonly EmissionSourceType[]> = {
  scope1: ["stationary_combustion", "mobile_combustion", "fugitive_emissions", "process_emissions"],
  scope2: ["location_based", "market_based"],
  // The engine accepts all fifteen Scope 3 categories, but only these two have
  // translated names today. The rest would render as raw enum keys, so they are
  // deliberately withheld rather than shown untranslated.
  scope3: ["business_travel", "purchased_goods"],
};

const FUELS: readonly FuelType[] = [
  "natural_gas",
  "diesel",
  "gasoline",
  "lpg",
  "kerosene",
  "heavy_oil",
];

function unitFor(scope: Scope, source: EmissionSourceType, fuel: FuelType): string {
  if (scope === "scope2") return "kWh";
  if (scope === "scope3") return source === "business_travel" ? "km" : "million KRW";
  if (source === "fugitive_emissions") return "kg";
  if (source === "process_emissions") return "t";
  return fuel === "natural_gas" ? "Nm3" : "L";
}

export default function NewEmissionPage() {
  const t = useTranslations("emissions_new");
  const locale = useLocale();
  const [scope, setScope] = React.useState<Scope>("scope1");
  const [source, setSource] = React.useState<EmissionSourceType>("stationary_combustion");
  const [fuel, setFuel] = React.useState<FuelType>("natural_gas");
  const [activity, setActivity] = React.useState("");
  const [processEf, setProcessEf] = React.useState("");
  const [result, setResult] = React.useState<CalculationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const number = React.useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }),
    [locale]
  );
  const unit = unitFor(scope, source, fuel);
  const usesFuel = source === "stationary_combustion" || source === "mobile_combustion";
  const usesProcessEf = source === "process_emissions";

  function changeScope(next: Scope) {
    setScope(next);
    setSource(SOURCE_OPTIONS[next][0]);
    setProcessEf("");
    setResult(null);
    setError(null);
  }

  function changeSource(next: EmissionSourceType) {
    setSource(next);
    setResult(null);
    // Clears a validation message that belonged to the previous source type.
    setError(null);
  }

  function runCalculation() {
    const value = Number(activity);
    if (!Number.isFinite(value) || value <= 0) {
      setResult(null);
      setError(t("invalid_activity"));
      return;
    }

    /*
     * Process emissions have no published default. The engine falls back to an
     * emission factor of 1.0, which would silently report a made-up number, so
     * the factor is required from the operator instead of defaulted.
     */
    const customEf = Number(processEf);
    if (usesProcessEf && (!Number.isFinite(customEf) || customEf <= 0)) {
      setResult(null);
      setError(t("invalid_process_ef"));
      return;
    }

    setError(null);
    setResult(
      calculate({
        activity_data: value,
        unit,
        scope,
        emission_source_type: source,
        ...(usesFuel ? { fuel_type: fuel } : {}),
        ...(source === "fugitive_emissions" ? { refrigerant_type: "R410A" as const } : {}),
        ...(usesProcessEf ? { custom_ef: customEf } : {}),
      })
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("source_section")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scope">{t("scope")}</Label>
              <select
                id="scope"
                value={scope}
                onChange={(event) => changeScope(event.target.value as Scope)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="scope1">{t("scope1_option")}</option>
                <option value="scope2">{t("scope2_option")}</option>
                <option value="scope3">{t("scope3_option")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sourceType">{t("source_type")}</Label>
              <select
                id="sourceType"
                value={source}
                onChange={(event) => changeSource(event.target.value as EmissionSourceType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SOURCE_OPTIONS[scope].map((option) => (
                  <option key={option} value={option}>{t(option)}</option>
                ))}
              </select>
            </div>
            {usesFuel && (
              <div className="space-y-2">
                <Label htmlFor="fuel">{t("fuel_source")}</Label>
                <select
                  id="fuel"
                  value={fuel}
                  onChange={(event) => {
                    setFuel(event.target.value as FuelType);
                    setResult(null);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {FUELS.map((option) => <option key={option} value={option}>{t(option)}</option>)}
                </select>
              </div>
            )}
            {source === "fugitive_emissions" && (
              <div className="space-y-2">
                <Label htmlFor="refrigerant">{t("fuel_source")}</Label>
                <select id="refrigerant" disabled className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                  <option>R410A</option>
                </select>
              </div>
            )}
            {usesProcessEf && (
              <div className="space-y-2">
                <Label htmlFor="processEf">{t("process_ef")}</Label>
                <Input
                  id="processEf"
                  type="number"
                  min="0"
                  step="any"
                  value={processEf}
                  onChange={(event) => setProcessEf(event.target.value)}
                  data-testid="process-ef"
                />
                <p className="text-xs text-muted-foreground">{t("process_ef_hint")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("activity_section")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activityData">{t("activity_value")}</Label>
              <Input id="activityData" type="number" min="0" step="any" value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">{t("unit")}</Label>
              <Input id="unit" value={unit} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">{t("reporting_period")}</Label>
              <Input id="period" type="month" defaultValue="2024-01" />
            </div>
            {error && <p role="alert" data-testid="activity-error" className="text-sm text-destructive">{error}</p>}
            <Button type="button" className="w-full" onClick={runCalculation} data-testid="calculate-emissions">{t("calculate")}</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("results_section")}</CardTitle></CardHeader>
          <CardContent>
            {result === null ? (
              <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                {t("results_hint_1")}<br />{t("results_hint_2")}
              </div>
            ) : (
              <div className="space-y-4" data-testid="calculation-result">
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="text-sm text-muted-foreground">{t("total_co2e")}</dt><dd className="text-xl font-semibold">{number.format(result.co2e_kg / 1000)} tCO2e</dd></div>
                  <div><dt className="text-sm text-muted-foreground">{t("factor_used")}</dt><dd className="font-medium">{number.format(result.emission_factor_used.value)} {result.emission_factor_used.unit}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">{t("uncertainty")}</dt><dd className="font-medium">±{number.format(result.uncertainty_pct)}%</dd></div>
                  <div><dt className="text-sm text-muted-foreground">{t("data_quality")}</dt><dd className="font-medium">{number.format(result.data_quality_score)}/5</dd></div>
                </dl>
                <div className="rounded-md bg-muted p-3 font-mono text-xs break-words">{result.formula_used}</div>
                <p className="text-xs text-muted-foreground">{t("sample_calculation_note")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("evidence_section")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("upload_evidence")}</Label>
              <Input type="file" accept=".pdf,.xlsx,.csv,.jpg,.png" disabled />
              <p className="text-xs text-muted-foreground">{t("persistence_unavailable")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <textarea id="notes" disabled className="flex min-h-[100px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" placeholder={t("notes_placeholder")} />
            </div>
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" disabled>{t("save_draft")}</Button>
              <Button type="button" disabled>{t("submit_approval")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
