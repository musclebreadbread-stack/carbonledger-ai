import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AuditLogPage() {
  const auditEntries = [
    { id: "1", action: "create", table: "emission_records", user: "admin@company.com", timestamp: "2024-01-15 14:32:00", description: "Created emission record for Boiler #1" },
    { id: "2", action: "approve", table: "emission_records", user: "reviewer@company.com", timestamp: "2024-01-15 15:10:00", description: "Approved emission record ER-2024-001" },
    { id: "3", action: "update", table: "emission_factors", user: "admin@company.com", timestamp: "2024-01-14 09:00:00", description: "Updated grid electricity factor to 2023 version" },
    { id: "4", action: "create", table: "reports", user: "admin@company.com", timestamp: "2024-01-13 16:45:00", description: "Generated ISO 14064 Annual Report" },
    { id: "5", action: "login", table: "users", user: "auditor@company.com", timestamp: "2024-01-13 10:00:00", description: "User login from 192.168.1.100" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">Immutable record of all system activities</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {auditEntries.map((entry) => (
              <div key={entry.id} className="flex gap-4 rounded-lg border p-4">
                <div className="flex-shrink-0">
                  <Badge variant={
                    entry.action === "create" ? "default" :
                    entry.action === "approve" ? "secondary" :
                    "outline"
                  }>
                    {entry.action}
                  </Badge>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{entry.description}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>By: {entry.user}</span>
                    <span>Table: {entry.table}</span>
                    <span>{entry.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
