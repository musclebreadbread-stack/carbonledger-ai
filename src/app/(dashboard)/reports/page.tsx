import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  const reports = [
    { id: "1", name: "ISO 14064 Annual Report 2023", type: "ISO14064", status: "completed", date: "2024-03-15" },
    { id: "2", name: "CDP Climate Response 2024", type: "CDP", status: "draft", date: "2024-06-01" },
    { id: "3", name: "GRI 305 Emissions Report", type: "GRI", status: "in_progress", date: "2024-04-20" },
    { id: "4", name: "Monthly Summary - Jan 2024", type: "Internal", status: "completed", date: "2024-02-01" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Generate and manage compliance reports</p>
        </div>
        <Button>+ Generate Report</Button>
      </div>

      {/* Report Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Generate New Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-20 flex-col gap-1">
              <span className="text-lg font-semibold">ISO 14064</span>
              <span className="text-xs text-muted-foreground">GHG Inventory</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-1">
              <span className="text-lg font-semibold">CDP</span>
              <span className="text-xs text-muted-foreground">Climate Disclosure</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-1">
              <span className="text-lg font-semibold">GRI 305</span>
              <span className="text-xs text-muted-foreground">Emissions Standard</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-1">
              <span className="text-lg font-semibold">Custom</span>
              <span className="text-xs text-muted-foreground">Internal Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">{report.name}</p>
                  <p className="text-sm text-muted-foreground">Generated: {report.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={report.status === "completed" ? "default" : "secondary"}>
                    {report.status}
                  </Badge>
                  <Badge variant="outline">{report.type}</Badge>
                  {report.status === "completed" && (
                    <Button variant="outline" size="sm">Download</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
