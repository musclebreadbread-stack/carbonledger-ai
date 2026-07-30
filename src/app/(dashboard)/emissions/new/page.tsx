"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewEmissionPage() {
  const t = useTranslations("emissions_new");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("source_section")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("scope")}</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="scope1">{t("scope1_option")}</option>
                <option value="scope2">{t("scope2_option")}</option>
                <option value="scope3">{t("scope3_option")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("source_type")}</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="stationary_combustion">{t("stationary_combustion")}</option>
                <option value="mobile_combustion">{t("mobile_combustion")}</option>
                <option value="fugitive_emissions">{t("fugitive_emissions")}</option>
                <option value="process_emissions">{t("process_emissions")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("fuel_source")}</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="natural_gas">{t("natural_gas")}</option>
                <option value="diesel">{t("diesel")}</option>
                <option value="gasoline">{t("gasoline")}</option>
                <option value="lpg">{t("lpg")}</option>
                <option value="kerosene">{t("kerosene")}</option>
                <option value="heavy_oil">{t("heavy_oil")}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("activity_section")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activityData">{t("activity_value")}</Label>
              <Input id="activityData" type="number" placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label>{t("unit")}</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="Nm3">Nm3</option>
                <option value="L">{t("unit_liters")}</option>
                <option value="kg">{t("unit_kilograms")}</option>
                <option value="kWh">kWh</option>
                <option value="t">{t("unit_tonnes")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">{t("reporting_period")}</Label>
              <Input id="period" type="month" defaultValue="2024-01" />
            </div>
            <Button className="w-full">{t("calculate")}</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("results_section")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
              {t("results_hint_1")}
              <br />
              {t("results_hint_2")}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("evidence_section")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("upload_evidence")}</Label>
              <Input type="file" accept=".pdf,.xlsx,.csv,.jpg,.png" />
              <p className="text-xs text-muted-foreground">{t("upload_hint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <textarea
                id="notes"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("notes_placeholder")}
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button variant="outline">{t("save_draft")}</Button>
              <Button>{t("submit_approval")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
