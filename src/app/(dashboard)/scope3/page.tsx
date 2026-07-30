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
import { categoryDefinition } from "@/lib/scope3/categories";
import { getScope3Overview } from "@/lib/scope3/sample-data";
import {
  calculatedCoveragePercent,
  totalScope3,
  weightedDataQuality,
  type CategoryRelevance,
  type Scope3CategoryStatus,
  type ValueChainSide,
} from "@/lib/scope3/types";

/**
 * The 15 GHG Protocol Scope 3 categories, served at `/scope3`.
 *
 * A Server Component. The category definitions come from
 * `@/lib/scope3/categories` — they are fixed by the GHG Protocol Corporate Value
 * Chain standard, not sample data — while the emission figures come from the
 * provider and carry `isSampleData`.
 *
 * The single most important rendering rule here: a relevant category with
 * `emissions === null` is shown as "not calculated", never as 0. Those are
 * materially different disclosures — one says the company measured nothing, the
 * other says it measured zero — and collapsing them would understate the
 * footprint while making the inventory look complete.
 *
 * Upstream and downstream are split into two tables rather than tabs so the
 * whole inventory is visible (and printable) at once, and so the page needs no
 * client-side JavaScript.
 */

const RELEVANCE_VARIANT: Record<
  CategoryRelevance,
  "default" | "secondary" | "destructive" | "outline"
> = {
  relevant: "default",
  not_relevant: "secondary",
  not_assessed: "destructive",
};

export default async function Scope3Page() {
  const t = await getTranslations("scope3");
  const tNames = await getTranslations("scope3_categories");
  const tDescriptions = await getTranslations("scope3_category_descriptions");
  const tExclusions = await getTranslations("scope3_exclusion_reasons");
  const locale = await getLocale();

  const overview = await getScope3Overview();
  const { categories } = overview;

  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const total = totalScope3(categories);
  const coverage = calculatedCoveragePercent(categories);
  const quality = weightedDataQuality(categories);
  const relevantCount = categories.filter((category) => category.relevance === "relevant").length;
  const calculatedCount = categories.filter(
    (category) => category.relevance === "relevant" && category.emissions !== null
  ).length;

  const sideTotal = (side: ValueChainSide) =>
    totalScope3(categories.filter((category) => categoryDefinition(category.number).side === side));

  const rowsFor = (side: ValueChainSide) =>
    categories.filter((category) => categoryDefinition(category.number).side === side);

  /** Share of the Scope 3 total, or null when there is nothing to divide by. */
  const shareOf = (category: Scope3CategoryStatus) =>
    category.emissions === null || total <= 0
      ? null
      : Math.round((category.emissions / total) * 1000) / 10;

  const table = (side: ValueChainSide, title: string, totalLabel: string) => {
    const rows = rowsFor(side);
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {totalLabel}: {numberFormat.format(sideTotal(side))} {t("unit_tco2e")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-right">{t("category")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("relevance")}</TableHead>
                <TableHead className="text-right">{t("emissions")}</TableHead>
                <TableHead className="text-right">{t("share")}</TableHead>
                <TableHead>{t("method")}</TableHead>
                <TableHead className="text-right">{t("data_quality")}</TableHead>
                <TableHead className="text-right">{t("suppliers")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((category) => {
                const definition = categoryDefinition(category.number);
                const share = shareOf(category);
                return (
                  <TableRow key={category.number} data-testid="scope3-category-row">
                    <TableCell className="text-right font-mono text-xs">
                      {category.number}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{tNames(definition.nameKey)}</div>
                      <div className="text-xs text-muted-foreground">
                        {tDescriptions(definition.descriptionKey)}
                      </div>
                      {category.relevance === "not_relevant" && category.exclusionReasonKey && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t("exclusion_reason")}:{" "}
                          {tExclusions.has(category.exclusionReasonKey)
                            ? tExclusions(category.exclusionReasonKey)
                            : category.exclusionReasonKey}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t("allowed_methods")}:{" "}
                        {definition.methods.map((method) => t(`methods.${method}`)).join(", ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={RELEVANCE_VARIANT[category.relevance]}>
                        {t(`relevance_${category.relevance}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {/* null is "not calculated", never 0 — see the file comment. */}
                      {category.emissions === null ? (
                        <span className="text-xs text-muted-foreground">
                          {t("not_calculated")}
                        </span>
                      ) : (
                        `${numberFormat.format(category.emissions)} ${t("unit_tco2e")}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {share === null ? "—" : `${share}%`}
                    </TableCell>
                    <TableCell className="text-xs">
                      {category.method === null ? "—" : t(`methods.${category.method}`)}
                    </TableCell>
                    <TableCell className="text-right">
                      {category.dataQuality === null
                        ? "—"
                        : t("quality_scale", { score: category.dataQuality })}
                    </TableCell>
                    <TableCell className="text-right">{category.supplierCount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {overview.isSampleData && <SampleDataNotice message={t("sample_data_notice")} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title={t("total_emissions")}
          value={`${numberFormat.format(total)} ${t("unit_tco2e")}`}
          description={t("year_label", { year: overview.year })}
        />
        <KPICard
          title={t("coverage")}
          value={`${coverage}%`}
          description={t("coverage_note", { calculated: calculatedCount, relevant: relevantCount })}
        />
        <KPICard
          title={t("weighted_quality")}
          value={quality === null ? t("quality_unavailable") : t("quality_scale", { score: quality })}
        />
        <KPICard title={t("relevant_categories")} value={`${relevantCount}/15`} />
      </div>

      {table("upstream", t("upstream_title"), t("upstream_total"))}
      {table("downstream", t("downstream_title"), t("downstream_total"))}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{t("not_calculated_note")}</p>
        <p>{t("disclosure_note")}</p>
        <p>{t("quality_note")}</p>
      </div>
    </div>
  );
}
