"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewEmissionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Emission Record</h1>
        <p className="text-muted-foreground">Add a new GHG emission record with automatic calculation</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emission Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Scope</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="scope1">Scope 1 - Direct Emissions</option>
                <option value="scope2">Scope 2 - Indirect (Energy)</option>
                <option value="scope3">Scope 3 - Value Chain</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Source Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="stationary_combustion">Stationary Combustion</option>
                <option value="mobile_combustion">Mobile Combustion</option>
                <option value="fugitive_emissions">Fugitive Emissions</option>
                <option value="process_emissions">Process Emissions</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fuel / Source</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="natural_gas">Natural Gas (LNG)</option>
                <option value="diesel">Diesel</option>
                <option value="gasoline">Gasoline</option>
                <option value="lpg">LPG</option>
                <option value="kerosene">Kerosene</option>
                <option value="heavy_oil">Heavy Oil</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activityData">Activity Data Value</Label>
              <Input id="activityData" type="number" placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="Nm3">Nm3</option>
                <option value="L">Liters (L)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="kWh">kWh</option>
                <option value="t">Tonnes (t)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">Reporting Period</Label>
              <Input id="period" type="month" defaultValue="2024-01" />
            </div>
            <Button className="w-full">Calculate Emissions</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Calculation Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
              Click &quot;Calculate Emissions&quot; to see the results here.
              <br />
              Results will include CO2e breakdown, formula used, and uncertainty estimate.
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evidence & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Evidence</Label>
              <Input type="file" accept=".pdf,.xlsx,.csv,.jpg,.png" />
              <p className="text-xs text-muted-foreground">Upload invoices, meter readings, or other supporting documents</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Additional notes or context..."
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button variant="outline">Save as Draft</Button>
              <Button>Submit for Approval</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
