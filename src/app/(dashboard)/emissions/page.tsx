import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EmissionsPage() {
  // Sample data for the emissions table
  const emissions = [
    { id: "1", source: "Boiler #1", scope: "Scope 1", type: "Stationary Combustion", amount: "1,234", unit: "tCO2e", status: "approved", period: "2024-01" },
    { id: "2", source: "Company Fleet", scope: "Scope 1", type: "Mobile Combustion", amount: "456", unit: "tCO2e", status: "pending", period: "2024-01" },
    { id: "3", source: "Grid Electricity", scope: "Scope 2", type: "Location-based", amount: "2,891", unit: "tCO2e", status: "approved", period: "2024-01" },
    { id: "4", source: "HVAC System", scope: "Scope 1", type: "Fugitive", amount: "89", unit: "tCO2e", status: "draft", period: "2024-01" },
    { id: "5", source: "Business Travel", scope: "Scope 3", type: "Cat. 6", amount: "234", unit: "tCO2e", status: "pending", period: "2024-01" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emissions</h1>
          <p className="text-muted-foreground">Manage and track GHG emission records</p>
        </div>
        <Link href="/emissions/new">
          <Button>+ New Record</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex gap-4 p-4">
          <Badge variant="secondary">All Scopes</Badge>
          <Badge variant="outline">Scope 1</Badge>
          <Badge variant="outline">Scope 2</Badge>
          <Badge variant="outline">Scope 3</Badge>
        </CardContent>
      </Card>

      {/* Emissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Emission Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="px-4 py-3 text-left font-medium">Scope</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Period</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
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
                        {em.status}
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
