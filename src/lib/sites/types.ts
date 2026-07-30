/**
 * Typed contract for the geographic site/facility view.
 *
 * Mirrors the columns already present on the `sites` table in
 * `src/lib/db/schema/organizations.ts` (name, address, latitude, longitude,
 * grid_region) plus two aggregates a real query would join in: how many
 * facilities the site contains and how much it emitted.
 *
 * As with the dashboard, no live database exists in this sandbox — see
 * `src/lib/sites/sample-data.ts`.
 */

/** A site as the map and the accompanying table need it. */
export interface SiteLocation {
  id: string;
  /**
   * Either a key under the `site_names` message namespace (sample data) or a
   * stored site name (database). The UI resolves it as a message key and falls
   * back to rendering the raw value.
   */
  nameKey: string;
  /** Same key-or-literal convention as `nameKey`, against `site_addresses`. */
  addressKey: string | null;
  /**
   * WGS84 coordinates. Null when the site has not been geocoded yet — the
   * `sites` table allows both columns to be null, so the UI must cope with it
   * rather than plotting a marker at (0, 0) in the Gulf of Guinea.
   */
  latitude: number | null;
  longitude: number | null;
  /** Electricity grid region, used for location-based Scope 2 factors. */
  gridRegion: string | null;
  facilityCount: number;
  /** Annual emissions attributed to the site, in tCO2e. */
  annualEmissions: number;
}

/** A site that is known to be plottable. Produced by `withCoordinates`. */
export type GeolocatedSite = SiteLocation & {
  latitude: number;
  longitude: number;
};

export interface SitesOverview {
  /** Reporting year the emission figures describe. */
  year: number;
  /** True when these are sample figures rather than measured emissions. */
  isSampleData: boolean;
  sites: SiteLocation[];
}

export type SitesProvider = (options?: {
  companyId?: string;
  year?: number;
}) => Promise<SitesOverview>;

/**
 * Narrows a site list to the entries that can actually be drawn on a map.
 *
 * Also rejects out-of-range coordinates: a bad import can leave a longitude of
 * 1291.14 behind, and Leaflet would happily wrap it around the globe instead of
 * failing visibly.
 */
export function withCoordinates(sites: SiteLocation[]): GeolocatedSite[] {
  return sites.filter((site): site is GeolocatedSite => {
    const { latitude: lat, longitude: lng } = site;
    return (
      lat !== null &&
      lng !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  });
}

/**
 * Converts a Postgres `numeric`/`decimal` column into a number.
 *
 * Drizzle returns `decimal` columns as strings to avoid precision loss, so a
 * database-backed provider has to run coordinates through something like this
 * before handing them to Leaflet.
 */
export function parseCoordinate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
