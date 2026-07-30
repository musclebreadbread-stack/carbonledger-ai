import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ReportsPage() {
  const t = await getTranslations("reports");
  const tStatus = await getTranslations("status");
  const tCommon = await getTranslations("common");

  const reports = [
    { id: "1", name: t("item_iso_2023"), type: "ISO14064", status: "completed", date: "2024-03-15" },
    { id: "2", name: t("item_cdp_2024"), type: "CDP", status: "draft", date: "2024-06-01" },
    { id: "3", name: t("item_gri_305"), type: "GRI", status: "in_progress", date: "2024-04-20" },
    { id: "4", name: t("item_monthly_jan"), type: t("type_internal"), status: "completed", date: "2024-02-01" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button>{t("generate_btn")}</Button>
      </div>

      {/* Report Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>{t("generate_new")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-20 flex-col gap-1">
              <span className="text-lg font-semibold">ISO 14064</span>
              <span className="text-xs text-muted-foreground">{t("type_iso_desc")}</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-1">
              <span className="text-lg font-semibold">CDP</span>
              <span className="text-xs text-muted-foreground">{t("type_cdp_desc")}</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-1">
              <span className="text-lg font-semibold">GRI 305</span>
              <span className="text-xs text-muted-foreground">{t("type_gri_desc")}</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-1">
              <span className="text-lg font-semibold">{t("type_custom")}</span>
              <span className="text-xs text-muted-foreground">{t("type_custom_desc")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("generated_reports")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">{report.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("generated_at")}: {report.date}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={report.status === "completed" ? "default" : "secondary"}>
                    {tStatus(report.status)}
                  </Badge>
                  <Badge variant="outline">{report.type}</Badge>
                  {report.status === "completed" && (
                    <Button variant="outline" size="sm">
                      {tCommon("download")}
                    </Button>
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
