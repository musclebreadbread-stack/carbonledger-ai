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
import { getTargetsOverview } from "@/lib/targets/sample-data";
import {
  assessTarget,
  meetsSbtiLinearMinimum,
  SBTI_MIN_ANNUAL_LINEAR_REDUCTION_PCT,
  type PathwayVerdict,
  type ReductionTarget,
  type TargetAssessment,
} from "@/lib/targets/types";

/**
 * Reduction target management, served at `/targets`.
 *
 * A Server Component: it resolves the targets provider and derives every
 * progress figure through `assessTarget` from `@/lib/targets/types`. None of the
 * arithmetic lives here — that function is pure and unit-tested, and duplicating
 * any of it in the view would let the page and the tests disagree.
 *
 * Two presentation decisions follow from the domain rather than from taste:
 *
 *  - Intensity targets are rendered in tCO2e per million KRW, not tCO2e. Their
 *    `baseEmissions`/`targetEmissions` are intensity figures, so formatting them
 *    with the absolute unit would misstate them by six orders of magnitude.
 *  - A target with no measured year shows the `no_data` verdict rather than 0%.
 *    A company that has not reported yet is not a company that has achieved
 *    nothing.
 */

/** Badge styling per pathway verdict. Behind is the only failing state. */
const VERDICT_VARIANT: Record<PathwayVerdict, "default" | "secondary" | "destructive" | "outline"> =
  {
    ahead: "default",
    on_track: "secondary",
    behind: "destructive",
    no_data: "outline",
  };

export default async function TargetsPage() {
  const t = await getTranslations("targets");
  const tDescriptions = await getTranslations("target_descriptions");
  const locale = await getLocale();

  const overview = await getTargetsOverview();
  const { targets } = overview;

  // Paired up front so the KPI row and the tables agree by construction rather
  // than by calling `assessTarget` twice with the same input.
  const assessed = targets.map((target) => ({
    target,
    assessment: assessTarget(target),
  }));

  const absoluteFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const intensityFormat = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  /** Formats an emission figure in the unit the target actually uses. */
  const quantity = (target: ReductionTarget, value: number) =>
    target.targetType === "intensity"
      ? `${intensityFormat.format(value)} ${t("unit_intensity")}`
      : `${absoluteFormat.format(value)} ${t("unit_tco2e")}`;

  const scopeLabel = (target: ReductionTarget) =>
    target.scope === null ? t("scope_all") : t("scope_one", { scope: target.scope });

  // Sample data addresses descriptions by message key; a database-backed
  // provider would return stored strings, which fall through unchanged.
  const descriptionOf = (key: string | null) =>
    key && tDescriptions.has(key) ? tDescriptions(key) : (key ?? "—");

  const activeCount = targets.filter((target) => target.status === "active").length;
  const onTrackCount = assessed.filter(
    ({ assessment }) => assessment.verdict === "ahead" || assessment.verdict === "on_track"
  ).length;
  const behindCount = assessed.filter(({ assessment }) => assessment.verdict === "behind").length;

  const sbtiOf = (target: ReductionTarget) => {
    const verdict = meetsSbtiLinearMinimum(target);
    if (verdict === null) return t("sbti_not_applicable");
    return verdict ? t("sbti_aligned") : t("sbti_not_aligned");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {overview.isSampleData && <SampleDataNotice message={t("sample_data_notice")} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title={t("total_targets")} value={String(targets.length)} />
        <KPICard title={t("active_targets")} value={String(activeCount)} />
        <KPICard title={t("on_track_count")} value={String(onTrackCount)} />
        <KPICard title={t("behind_count")} value={String(behindCount)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("list_title")}</CardTitle>
          <CardDescription>
            {t("latest_year_label", { year: overview.currentYear })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("target")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("scope")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("base_year")}</TableHead>
                <TableHead className="text-right">{t("target_year")}</TableHead>
                <TableHead className="text-right">{t("base_emissions")}</TableHead>
                <TableHead className="text-right">{t("target_emissions")}</TableHead>
                <TableHead className="text-right">{t("progress")}</TableHead>
                <TableHead>{t("verdict")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessed.map(({ target, assessment }) => (
                <TableRow key={target.id} data-testid="target-row">
                  <TableCell className="font-medium">
                    {descriptionOf(target.descriptionKey)}
                  </TableCell>
                  <TableCell>{t(`type_${target.targetType}`)}</TableCell>
                  <TableCell>{scopeLabel(target)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(`status_${target.status}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{target.baseYear}</TableCell>
                  <TableCell className="text-right">{target.targetYear}</TableCell>
                  <TableCell className="text-right">
                    {quantity(target, target.baseEmissions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {quantity(target, target.targetEmissions)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {assessment.verdict === "no_data" ? "—" : `${assessment.progressPercent}%`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={VERDICT_VARIANT[assessment.verdict]}>
                      {t(`verdict_${assessment.verdict}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail_title")}</CardTitle>
          <CardDescription>
            {t("sbti_threshold", { rate: SBTI_MIN_ANNUAL_LINEAR_REDUCTION_PCT })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {assessed.map(({ target, assessment }) => (
            <TargetDetail
              key={target.id}
              target={target}
              assessment={assessment}
              labels={{
                heading: descriptionOf(target.descriptionKey),
                methodology: target.methodologyKey
                  ? t(`methodologies.${target.methodologyKey}`)
                  : "—",
                type: t(`type_${target.targetType}`),
                scope: scopeLabel(target),
                progress: t("progress"),
                progressOf: t("progress_of", { percent: assessment.progressPercent }),
                exceeded:
                  assessment.rawProgressPercent > 100
                    ? t("exceeded", { percent: assessment.rawProgressPercent })
                    : null,
                latest: t("latest"),
                latestValue:
                  assessment.latestEmissions === null
                    ? "—"
                    : quantity(target, assessment.latestEmissions),
                latestYear:
                  assessment.latestYear === null
                    ? null
                    : t("latest_year_label", { year: assessment.latestYear }),
                pathway: t("pathway"),
                pathwayValue:
                  assessment.pathwayEmissions === null
                    ? "—"
                    : quantity(target, assessment.pathwayEmissions),
                achieved: t("achieved_reduction"),
                achievedValue: quantity(target, assessment.achievedReduction),
                remaining: t("remaining_reduction"),
                remainingValue: quantity(target, assessment.remainingReduction),
                requiredRate: t("required_rate"),
                requiredRateValue:
                  assessment.requiredAnnualReductionPercent === null
                    ? t("required_rate_none")
                    : t("required_rate_value", {
                        rate: assessment.requiredAnnualReductionPercent,
                      }),
                methodologyLabel: t("methodology"),
                sbtiLabel: t("sbti_check"),
                sbtiValue: sbtiOf(target),
                noData: t("no_progress_data"),
                verdict: t(`verdict_${assessment.verdict}`),
              }}
            />
          ))}
          <p className="text-xs text-muted-foreground">{t("intensity_note")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * One target's derived figures.
 *
 * Takes pre-translated strings rather than calling `getTranslations` itself:
 * that keeps the unit-formatting decision (absolute vs intensity) in one place
 * in the parent instead of being re-derived here.
 */
function TargetDetail({
  target,
  assessment,
  labels,
}: {
  target: ReductionTarget;
  assessment: TargetAssessment;
  labels: {
    heading: string;
    methodology: string;
    type: string;
    scope: string;
    progress: string;
    progressOf: string;
    exceeded: string | null;
    latest: string;
    latestValue: string;
    latestYear: string | null;
    pathway: string;
    pathwayValue: string;
    achieved: string;
    achievedValue: string;
    remaining: string;
    remainingValue: string;
    requiredRate: string;
    requiredRateValue: string;
    methodologyLabel: string;
    sbtiLabel: string;
    sbtiValue: string;
    noData: string;
    verdict: string;
  };
}) {
  const hasData = assessment.verdict !== "no_data";

  return (
    <div className="space-y-3 rounded-md border p-4" data-testid="target-detail">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{labels.heading}</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{labels.type}</span>
          <span aria-hidden="true">·</span>
          <span>{labels.scope}</span>
          <span aria-hidden="true">·</span>
          <span>
            {target.baseYear} → {target.targetYear}
          </span>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{labels.progress}</span>
              <span className="font-medium">{labels.exceeded ?? labels.progressOf}</span>
            </div>
            {/* Width is driven by the clamped percentage so an over-achieving
                target cannot overflow the track; the unclamped figure is stated
                in words above instead. */}
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={assessment.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={labels.progress}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${assessment.progressPercent}%` }}
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            <Figure label={labels.latest} value={labels.latestValue} note={labels.latestYear} />
            <Figure label={labels.pathway} value={labels.pathwayValue} note={labels.verdict} />
            <Figure label={labels.achieved} value={labels.achievedValue} />
            <Figure label={labels.remaining} value={labels.remainingValue} />
            <Figure label={labels.requiredRate} value={labels.requiredRateValue} />
            <Figure label={labels.sbtiLabel} value={labels.sbtiValue} />
            <Figure label={labels.methodologyLabel} value={labels.methodology} />
          </dl>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{labels.noData}</p>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}
