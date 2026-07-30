/**
 * SAMPLE (MOCK) SITE DATA — NOT REAL FACILITIES OR MEASURED EMISSIONS.
 *
 * There is no live database in this sandbox, so the site map is driven by the
 * fixtures below. Every payload carries `isSampleData: true` and the page shows
 * a visible notice off that flag.
 *
 * Coordinates are genuine locations of Korean industrial areas so the map has
 * something plausible to render; the site names, facility counts and emission
 * figures are invented. Per-site emissions deliberately sum to the same annual
 * total as `src/lib/dashboard/sample-data.ts` (12,920 tCO2e) so the site view
 * and the dashboard do not contradict each other.
 *
 * `incheon_logistics` intentionally has no coordinates, exercising the
 * "un-geocoded site" path that the nullable `latitude`/`longitude` columns on
 * the `sites` table make possible.
 */

import type { SiteLocation, SitesOverview, SitesProvider } from "./types";

const SAMPLE_YEAR = 2024;

const SAMPLE_SITES: SiteLocation[] = [
  {
    id: "site-ulsan",
    nameKey: "ulsan_plant",
    addressKey: "ulsan_plant",
    latitude: 35.5384,
    longitude: 129.3114,
    gridRegion: "KR-SE",
    facilityCount: 6,
    annualEmissions: 4180,
  },
  {
    id: "site-pyeongtaek",
    nameKey: "pyeongtaek_plant",
    addressKey: "pyeongtaek_plant",
    latitude: 36.9922,
    longitude: 127.1129,
    gridRegion: "KR-CE",
    facilityCount: 5,
    annualEmissions: 3260,
  },
  {
    id: "site-gwangyang",
    nameKey: "gwangyang_plant",
    addressKey: "gwangyang_plant",
    latitude: 34.9407,
    longitude: 127.6959,
    gridRegion: "KR-SW",
    facilityCount: 4,
    annualEmissions: 2140,
  },
  {
    id: "site-cheongju",
    nameKey: "cheongju_plant",
    addressKey: "cheongju_plant",
    latitude: 36.6424,
    longitude: 127.489,
    gridRegion: "KR-CE",
    facilityCount: 3,
    annualEmissions: 1490,
  },
  {
    id: "site-busan",
    nameKey: "busan_plant",
    addressKey: "busan_plant",
    latitude: 35.1796,
    longitude: 129.0756,
    gridRegion: "KR-SE",
    facilityCount: 2,
    annualEmissions: 980,
  },
  {
    id: "site-seoul-hq",
    nameKey: "seoul_hq",
    addressKey: "seoul_hq",
    latitude: 37.5665,
    longitude: 126.978,
    gridRegion: "KR-NE",
    facilityCount: 1,
    annualEmissions: 520,
  },
  {
    id: "site-incheon",
    nameKey: "incheon_logistics",
    addressKey: "incheon_logistics",
    latitude: null,
    longitude: null,
    gridRegion: "KR-NE",
    facilityCount: 1,
    annualEmissions: 350,
  },
];

export function buildSampleSitesOverview(year: number = SAMPLE_YEAR): SitesOverview {
  return {
    year,
    isSampleData: true,
    // Copy so callers cannot mutate the module-level fixture.
    sites: SAMPLE_SITES.map((site) => ({ ...site })),
  };
}

/**
 * Active site provider.
 *
 * A production implementation would select from `sites`, left-join
 * `facilities` for the count and the emission records for the totals, and run
 * the `decimal` latitude/longitude columns through `parseCoordinate` before
 * returning them:
 *
 * ```ts
 * export const getSitesOverview: SitesProvider = async ({ companyId, year }) => {
 *   const rows = await db.select({ ... }).from(sites).where(eq(sites.companyId, companyId));
 *   return {
 *     year,
 *     isSampleData: false,
 *     sites: rows.map((r) => ({ ...r, latitude: parseCoordinate(r.latitude), ... })),
 *   };
 * };
 * ```
 */
export const getSitesOverview: SitesProvider = async ({ year } = {}) => {
  return buildSampleSitesOverview(year ?? SAMPLE_YEAR);
};
