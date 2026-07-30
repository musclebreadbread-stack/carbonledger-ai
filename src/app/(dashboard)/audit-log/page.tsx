import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AuditLogPage() {
  const t = await getTranslations("audit_log");

  const auditEntries = [
    { id: "1", action: "create", table: "emission_records", user: "admin@company.com", timestamp: "2024-01-15 14:32:00", description: t("entry_1") },
    { id: "2", action: "approve", table: "emission_records", user: "reviewer@company.com", timestamp: "2024-01-15 15:10:00", description: t("entry_2") },
    { id: "3", action: "update", table: "emission_factors", user: "admin@company.com", timestamp: "2024-01-14 09:00:00", description: t("entry_3") },
    { id: "4", action: "create", table: "reports", user: "admin@company.com", timestamp: "2024-01-13 16:45:00", description: t("entry_4") },
    { id: "5", action: "login", table: "users", user: "auditor@company.com", timestamp: "2024-01-13 10:00:00", description: t("entry_5") },
  ];

  const actionLabels: Record<string, string> = {
    create: t("action_create"),
    approve: t("action_approve"),
    update: t("action_update"),
    login: t("action_login"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("timeline")}</CardTitle>
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
                    {actionLabels[entry.action] ?? entry.action}
                  </Badge>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{entry.description}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{t("by")}: {entry.user}</span>
                    <span>{t("table_label")}: {entry.table}</span>
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
