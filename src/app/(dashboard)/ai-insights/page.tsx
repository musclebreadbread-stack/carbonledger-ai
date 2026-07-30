import { getLocale, getTranslations } from "next-intl/server";
import { KPICard } from "@/components/features/kpi-card";
import { SampleDataNotice } from "@/components/features/sample-data-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  configuredModel,
  detectAllAnomalies,
  detectAllMissingData,
  isAiConfigured,
  type AnalysisSource,
  type Finding,
  type Severity,
} from "@/lib/ai";
import { buildSampleObservations } from "@/lib/ai/sample-data";
import { getScope3Overview } from "@/lib/scope3/sample-data";

/**
 * AI analysis results, served at `/ai-insights`.
 *
 * A Server Component showing the three detections the product promises:
 * 이상치 탐지, 누락 데이터 탐지 and 비정상 배출량 탐지.
 *
 * Every finding on this page is produced by deterministic, unit-tested code in
 * `@/lib/ai` — no model call happens here. That is deliberate and is surfaced in
 * the UI via each finding's `source`: a figure an auditor can reproduce must be
 * distinguishable from a suggestion a model made up. The generative parts of the
 * module (abatement narrative, Q&A, report drafting) need `OPENAI_API_KEY` and
 * are NOT wired into this page yet; the banner states whether that key is
 * present so the reader knows which mode the app is in.
 *
 * Findings carry `detail` as named numeric values rather than pre-built
 * sentences, so the message stays translatable into all four locales. The page
 * interpolates them into `ai.findings.<titleKey>`.
 */

const SEVERITY_VARIANT: Record<Severity, "default" | "secondary" | "destructive" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

export default async function AiInsightsPage() {
  const t = await getTranslations("ai");
  const tFindings = await getTranslations("ai.findings");
  const tSources = await getTranslations("emission_sources");
  const tCategories = await getTranslations("scope3_categories");
  const locale = await getLocale();

  const observations = buildSampleObservations();
  const scope3 = await getScope3Overview();

  const anomalies = detectAllAnomalies(observations);
  // The expected range is stated explicitly rather than inferred from the data:
  // inferring it from the first and last present month cannot detect a gap at
  // either end of the year, which is exactly where a late-reporting source sits.
  const missing = detectAllMissingData(observations, {
    expectedRange: { from: `${scope3.year}-01`, to: `${scope3.year}-12` },
    scope3Categories: scope3.categories,
  });

  const allFindings = [...anomalies.findings, ...missing.findings];
  const highCount = allFindings.filter((finding) => finding.severity === "high").length;

  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  /**
   * Resolves a finding's `sourceKey` to a label.
   *
   * Scope 3 findings use `catN` keys and emission findings use source keys, so
   * both catalogues are consulted before falling back to the raw key.
   */
  const sourceLabel = (finding: Finding) => {
    const key = finding.sourceKey;
    if (key === null) return t("all_scopes");
    if (tSources.has(key)) return tSources(key);
    if (tCategories.has(key)) return tCategories(key);
    return key;
  };

  const provenanceLabel = (source: AnalysisSource) => t(`source_${source}`);

  const findingsTable = (findings: Finding[], observationCount: number) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("severity")}</TableHead>
          <TableHead>{t("source")}</TableHead>
          <TableHead>{t("period")}</TableHead>
          <TableHead>{t("finding")}</TableHead>
          <TableHead>{t("provenance")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
              {t("no_findings", { count: observationCount })}
            </TableCell>
          </TableRow>
        ) : (
          findings.map((finding) => (
            <TableRow key={finding.id} data-testid="ai-finding-row">
              <TableCell>
                <Badge variant={SEVERITY_VARIANT[finding.severity]}>
                  {t(`severity_${finding.severity}`)}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{sourceLabel(finding)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {finding.period ?? "—"}
              </TableCell>
              <TableCell className="text-sm">
                {tFindings(finding.titleKey, finding.detail)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {provenanceLabel(finding.source)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <SampleDataNotice message={t("sample_data_notice")} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard title={t("total_findings")} value={String(allFindings.length)} />
        <KPICard title={t("high_severity")} value={String(highCount)} />
        <KPICard title={t("anomaly_findings")} value={String(anomalies.findings.length)} />
        <KPICard title={t("missing_findings")} value={String(missing.findings.length)} />
        <KPICard
          title={t("observations_examined")}
          value={numberFormat.format(observations.length)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("anomalies_title")}</CardTitle>
          <CardDescription>{t("anomalies_description")}</CardDescription>
        </CardHeader>
        <CardContent>{findingsTable(anomalies.findings, anomalies.observationCount)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("missing_title")}</CardTitle>
          <CardDescription>{t("missing_description")}</CardDescription>
        </CardHeader>
        <CardContent>{findingsTable(missing.findings, missing.observationCount)}</CardContent>
      </Card>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{t("determinism_note")}</p>
        <p>
          {isAiConfigured()
            ? t("model_configured", { model: configuredModel() })
            : t("model_not_configured")}
        </p>
      </div>
    </div>
  );
}
