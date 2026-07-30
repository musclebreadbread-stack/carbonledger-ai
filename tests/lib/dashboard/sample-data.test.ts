/**
 * The dashboard charts are only trustworthy if the numbers behind them agree
 * with each other. These tests pin the internal consistency of the sample
 * provider — and, because they assert against the `DashboardData` contract
 * rather than against literal figures, most of them keep their value when a
 * real database-backed provider replaces the fixtures.
 */

import { describe, expect, it } from "vitest";
import { buildSampleDashboardData, getDashboardData } from "@/lib/dashboard/sample-data";
import { buildSampleSitesOverview } from "@/lib/sites/sample-data";
import { parseCoordinate, withCoordinates } from "@/lib/sites/types";

describe("sample dashboard data", () => {
  const data = buildSampleDashboardData();

  it("is flagged as sample data so the UI can say so", () => {
    expect(data.isSampleData).toBe(true);
  });

  it("covers twelve months of trend and comparison data", () => {
    expect(data.trend).toHaveLength(12);
    expect(data.monthlyComparison).toHaveLength(12);
  });

  it("uses sortable ISO YYYY-MM periods in chronological order", () => {
    const periods = data.trend.map((point) => point.period);
    expect(periods.every((period) => /^\d{4}-(0[1-9]|1[0-2])$/.test(period))).toBe(true);
    expect(periods).toEqual([...periods].sort());
  });

  it("numbers comparison months 1..12", () => {
    expect(data.monthlyComparison.map((point) => point.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("keeps the scope breakdown equal to the trend totals", () => {
    for (const scope of [1, 2, 3] as const) {
      const fromTrend = data.trend.reduce(
        (sum, point) => sum + point[`scope${scope}` as const],
        0
      );
      const slice = data.scopeBreakdown.find((entry) => entry.scope === scope);
      expect(slice?.value).toBe(fromTrend);
    }
  });

  it("keeps total emissions equal to the sum of the three scopes", () => {
    const { kpis } = data;
    expect(kpis.totalEmissions).toBe(kpis.scope1 + kpis.scope2 + kpis.scope3);
  });

  it("keeps the KPI total equal to the sum of the monthly comparison's current year", () => {
    const fromComparison = data.monthlyComparison.reduce(
      (sum, point) => sum + point.currentYear,
      0
    );
    expect(fromComparison).toBe(data.kpis.totalEmissions);
  });

  it("reports a year-over-year reduction consistent with the comparison series", () => {
    const current = data.monthlyComparison.reduce((sum, p) => sum + p.currentYear, 0);
    const previous = data.monthlyComparison.reduce((sum, p) => sum + p.previousYear, 0);

    expect(current).toBeLessThan(previous);
    expect(data.kpis.yoyChangePercent).toBeLessThan(0);
    expect(data.kpis.yoyChangePercent).toBeCloseTo(((current - previous) / previous) * 100, 1);
  });

  it("ranks exactly ten emission sources, descending and densely ranked", () => {
    expect(data.topSources).toHaveLength(10);
    expect(data.topSources.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const emissions = data.topSources.map((s) => s.emissions);
    expect(emissions).toEqual([...emissions].sort((a, b) => b - a));
  });

  it("gives every ranked source a share consistent with the total", () => {
    for (const source of data.topSources) {
      const expected = (source.emissions / data.kpis.totalEmissions) * 100;
      expect(source.share).toBeCloseTo(expected, 1);
      expect(source.share).toBeGreaterThan(0);
      expect(source.share).toBeLessThanOrEqual(100);
    }
  });

  it("never claims the top ten exceed the reported total", () => {
    const ranked = data.topSources.reduce((sum, s) => sum + s.emissions, 0);
    expect(ranked).toBeLessThanOrEqual(data.kpis.totalEmissions);
  });

  it("uses only valid GHG Protocol scopes", () => {
    for (const source of data.topSources) {
      expect([1, 2, 3]).toContain(source.scope);
    }
  });

  it("honours the requested reporting year", async () => {
    const explicit = await getDashboardData({ year: 2019 });
    expect(explicit.year).toBe(2019);
  });
});

describe("sample site data", () => {
  const overview = buildSampleSitesOverview();

  it("is flagged as sample data", () => {
    expect(overview.isSampleData).toBe(true);
  });

  it("agrees with the dashboard on the annual total", () => {
    const siteTotal = overview.sites.reduce((sum, site) => sum + site.annualEmissions, 0);
    expect(siteTotal).toBe(buildSampleDashboardData().kpis.totalEmissions);
  });

  it("includes at least one site without coordinates, to exercise that path", () => {
    const plottable = withCoordinates(overview.sites);
    expect(plottable.length).toBeGreaterThan(0);
    expect(plottable.length).toBeLessThan(overview.sites.length);
  });

  it("returns a fresh copy so callers cannot mutate the fixture", () => {
    const first = buildSampleSitesOverview();
    first.sites[0].annualEmissions = -1;
    expect(buildSampleSitesOverview().sites[0].annualEmissions).toBeGreaterThan(0);
  });

  it("only plots coordinates that are actually on the globe", () => {
    for (const site of withCoordinates(overview.sites)) {
      expect(site.latitude).toBeGreaterThanOrEqual(-90);
      expect(site.latitude).toBeLessThanOrEqual(90);
      expect(site.longitude).toBeGreaterThanOrEqual(-180);
      expect(site.longitude).toBeLessThanOrEqual(180);
    }
  });
});

describe("withCoordinates", () => {
  const base = {
    id: "s",
    nameKey: "n",
    addressKey: null,
    gridRegion: null,
    facilityCount: 0,
    annualEmissions: 0,
  };

  it("rejects null coordinates rather than plotting them at (0, 0)", () => {
    expect(withCoordinates([{ ...base, latitude: null, longitude: 127 }])).toEqual([]);
    expect(withCoordinates([{ ...base, latitude: 37, longitude: null }])).toEqual([]);
  });

  it("rejects out-of-range coordinates from a bad import", () => {
    expect(withCoordinates([{ ...base, latitude: 37.5, longitude: 1291.14 }])).toEqual([]);
    expect(withCoordinates([{ ...base, latitude: 95, longitude: 127 }])).toEqual([]);
  });

  it("rejects NaN coordinates", () => {
    expect(withCoordinates([{ ...base, latitude: Number.NaN, longitude: 127 }])).toEqual([]);
  });

  it("keeps valid coordinates, including exact zeroes", () => {
    expect(withCoordinates([{ ...base, latitude: 0, longitude: 0 }])).toHaveLength(1);
  });
});

describe("parseCoordinate", () => {
  it("parses the strings Drizzle returns for decimal columns", () => {
    expect(parseCoordinate("35.5384000")).toBeCloseTo(35.5384, 6);
    expect(parseCoordinate("-127.1129")).toBeCloseTo(-127.1129, 6);
  });

  it("passes numbers through", () => {
    expect(parseCoordinate(36.5)).toBe(36.5);
  });

  it("treats absent and unparseable values as unknown", () => {
    expect(parseCoordinate(null)).toBeNull();
    expect(parseCoordinate(undefined)).toBeNull();
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate("not-a-number")).toBeNull();
  });

  it("does not mistake zero for missing", () => {
    expect(parseCoordinate("0")).toBe(0);
    expect(parseCoordinate(0)).toBe(0);
  });
});
