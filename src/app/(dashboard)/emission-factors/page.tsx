import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function EmissionFactorsPage() {
  const factors = [
    { id: "1", name: "Natural Gas (LNG)", provider: "Korea MOE", version: "2023", value: "2.176", unit: "kgCO2/Nm3", category: "Fuel" },
    { id: "2", name: "Diesel", provider: "Korea MOE", version: "2023", value: "2.584", unit: "kgCO2/L", category: "Fuel" },
    { id: "3", name: "Grid Electricity (Korea)", provider: "Korea MOE", version: "2023", value: "0.4594", unit: "kgCO2/kWh", category: "Electricity" },
    { id: "4", name: "Gasoline", provider: "Korea MOE", version: "2023", value: "2.208", unit: "kgCO2/L", category: "Fuel" },
    { id: "5", name: "R410A (GWP)", provider: "IPCC AR6", version: "2021", value: "2,256", unit: "kgCO2e/kg", category: "Refrigerant" },
    { id: "6", name: "Business Travel (Air)", provider: "DEFRA", version: "2023", value: "0.1935", unit: "kgCO2e/pkm", category: "Travel" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emission Factors</h1>
          <p className="text-muted-foreground">Browse and manage emission factor libraries</p>
        </div>
        <Button variant="outline">Compare Versions</Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <Input placeholder="Search emission factors..." className="max-w-sm" />
        <Badge variant="secondary">All Providers</Badge>
        <Badge variant="outline">Korea MOE</Badge>
        <Badge variant="outline">IPCC</Badge>
        <Badge variant="outline">DEFRA</Badge>
      </div>

      {/* Factors Table */}
      <Card>
        <CardHeader>
          <CardTitle>Emission Factor Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Version</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-left font-medium">Unit</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
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
