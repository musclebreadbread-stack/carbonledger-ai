import { getLocale, getTranslations } from "next-intl/server";
import { KPICard } from "@/components/features/kpi-card";
import { SiteMap } from "@/components/features/map/site-map";
import { SampleDataNotice } from "@/components/features/sample-data-notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSitesOverview } from "@/lib/sites/sample-data";
import { withCoordinates } from "@/lib/sites/types";

/**
 * Geographic view of sites and facilities, served at `/sites`.
 *
 * A Server Component: it resolves the site list and hands it to `<SiteMap />`,
 * which is the Client Component boundary that loads Leaflet with
 * `ssr: false`. The page itself never imports Leaflet, so nothing here can
 * touch `window` during prerendering.
 *
 * The table below the map is not just a fallback — map tiles need outbound
 * network access from the browser and un-geocoded sites cannot be plotted at
 * all, so the tabular list is the authoritative view of the data.
 */
export default async function SitesPage() {
  const t = await getTranslations("sites");
  const tNames = await getTranslations("site_names");
  const tAddresses = await getTranslations("site_addresses");
  const locale = await getLocale();

  const overview = await getSitesOverview();
  const { sites } = overview;

  const plottable = withCoordinates(sites);
  const missingCoordinates = sites.length - plottable.length;

  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const totalEmissions = sites.reduce((sum, site) => sum + site.annualEmissions, 0);
  const totalFacilities = sites.reduce((sum, site) => sum + site.facilityCount, 0);

  // Sample data addresses these by message key; a database-backed provider would
  // return stored strings, which fall through unchanged.
  const nameOf = (key: string) => (tNames.has(key) ? tNames(key) : key);
  const addressOf = (key: string | null) =>
    key && tAddresses.has(key) ? tAddresses(key) : (key ?? "—");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {overview.isSampleData && <SampleDataNotice message={t("sample_data_notice")} />}

      <div className="grid gap-4 md:grid-cols-3">
        <KPICard title={t("total_sites")} value={String(sites.length)} />
        <KPICard title={t("total_facilities")} value={String(totalFacilities)} />
        <KPICard
          title={t("total_emissions")}
          value={`${numberFormat.format(totalEmissions)} ${t("unit_tco2e")}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("map_title")}</CardTitle>
          <CardDescription>{t("map_legend")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SiteMap sites={sites} />
          {missingCoordinates > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("no_coordinates", { count: missingCoordinates })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("site_name")}</TableHead>
                <TableHead>{t("address")}</TableHead>
                <TableHead>{t("grid_region")}</TableHead>
                <TableHead className="text-right">{t("facilities")}</TableHead>
                <TableHead className="text-right">{t("annual_emissions")}</TableHead>
                <TableHead className="text-right">{t("coordinates")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id} data-testid="site-row">
                  <TableCell className="font-medium">{nameOf(site.nameKey)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {addressOf(site.addressKey)}
                  </TableCell>
                  <TableCell>{site.gridRegion ?? "—"}</TableCell>
                  <TableCell className="text-right">{site.facilityCount}</TableCell>
                  <TableCell className="text-right">
                    {numberFormat.format(site.annualEmissions)} {t("unit_tco2e")}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {site.latitude !== null && site.longitude !== null
                      ? `${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`
                      : t("not_geocoded")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
