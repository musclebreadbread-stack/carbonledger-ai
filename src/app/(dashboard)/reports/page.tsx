import { getTranslations } from "next-intl/server";
import { SampleDataNotice } from "@/components/features/sample-data-notice";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { loadReportDataset } from "@/lib/reports/dataset";
import { REPORT_TYPES } from "@/lib/reports/registry";
import { REPORT_FORMATS, type ReportFormat } from "@/lib/reports/types";

/**
 * Report catalogue, served at `/reports`.
 *
 * A Server Component with no client JavaScript at all: each download is an
 * ordinary `<a download>` pointing at `GET /api/v1/reports?type=…&format=…`,
 * which generates and streams the file. A button wired to a client-side fetch and
 * a blob URL would have been more code for less — no progressive enhancement, no
 * right-click "save as", nothing to link to.
 *
 * Two honesty requirements drive the layout as much as the download links do:
 *
 *  - the sample-data notice, off `dataset.isSampleData`, because none of these
 *    figures are measured emissions;
 *  - the language and PDF-encoding notice. Report bodies are English and PDF
 *    output cannot represent Hangul, and Korean is this app's default locale.
 *    Stating that here is the difference between a documented limitation and a
 *    user wondering why their report is full of question marks.
 *
 * Only `registry` and `dataset` are imported, never the renderers: pulling
 * pdf-lib and ExcelJS into this page's module graph would load two large
 * libraries into a render that generates nothing.
 */

const API_ENDPOINT = "/api/v1/reports";

/** Message key for a format's short label. */
const FORMAT_LABEL_KEY: Record<ReportFormat, string> = {
  pdf: "format_pdf",
  xlsx: "format_xlsx",
  csv: "format_csv",
};

export default async function ReportsPage() {
  const t = await getTranslations("reports");

  const dataset = await loadReportDataset();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {dataset.isSampleData && <SampleDataNotice message={t("sample_data_notice")} />}

      <Card>
        <CardHeader>
          <CardTitle>{t("language_notice_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p data-testid="report-language-notice">{t("language_notice_body")}</p>
          <div>
            <p className="font-medium text-foreground">{t("api_title")}</p>
            <p>{t("api_body", { endpoint: API_ENDPOINT })}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("catalogue_title")}</CardTitle>
          <CardDescription>
            {t("catalogue_subtitle")}{" "}
            {t("period_label", { start: dataset.periodStart, end: dataset.periodEnd })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {REPORT_TYPES.map((info) => (
              <div
                key={info.id}
                data-testid="report-type-card"
                data-report-type={info.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-base font-semibold leading-tight">{info.label}</span>
                  <Badge variant={info.coverage === "full" ? "default" : "secondary"}>
                    {info.coverage === "full" ? t("coverage_full") : t("coverage_partial")}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">{t(`descriptions.${info.id}`)}</p>

                <dl className="space-y-1 text-xs text-muted-foreground">
                  <div>
                    <dt className="inline font-medium">{t("standard_label")}: </dt>
                    <dd className="inline">{info.standardReference}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">{t("coverage_label")}: </dt>
                    <dd className="inline">
                      {info.coverage === "full"
                        ? t("coverage_full_hint")
                        : t("coverage_partial_hint")}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {REPORT_FORMATS.map((format) => {
                    const formatLabel = t(FORMAT_LABEL_KEY[format]);
                    return (
                      <a
                        key={format}
                        href={`${API_ENDPOINT}?type=${info.id}&format=${format}`}
                        download
                        data-testid="report-download-link"
                        data-report-type={info.id}
                        data-report-format={format}
                        aria-label={t("download_aria", {
                          report: info.label,
                          format: formatLabel,
                        })}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        {formatLabel}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
