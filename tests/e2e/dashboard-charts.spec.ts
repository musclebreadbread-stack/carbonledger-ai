/**
 * The dashboard charts must actually mount and draw.
 *
 * Recharts renders nothing during SSR — it measures its container in the
 * browser — so a server-side HTML check would pass on an empty chart. These
 * tests therefore assert on the SVG Recharts produces after hydration.
 *
 * They also assert the sample-data banner is present. The figures are mock data
 * and the UI is required to say so; if that banner ever disappears while the
 * provider is still returning `isSampleData: true`, that is a correctness bug,
 * not a cosmetic one.
 */

import { expect, test } from "@playwright/test";
import { MESSAGES } from "./fixtures";

const ko = MESSAGES.ko;

const CHARTS = [
  { testId: "chart-emissions-trend", title: ko.dashboard.emissions_trend },
  { testId: "chart-scope-breakdown", title: ko.dashboard.scope_breakdown },
  { testId: "chart-monthly-comparison", title: ko.dashboard.monthly_comparison },
  { testId: "chart-top-sources", title: ko.dashboard.top_sources },
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/dashboard");
});

test.describe("dashboard charts", () => {
  for (const chart of CHARTS) {
    test(`${chart.testId} renders an SVG`, async ({ page }) => {
      const container = page.getByTestId(chart.testId);
      await expect(container).toBeVisible();

      /*
       * The plot surface is the <svg> Recharts emits once it has measured the
       * container, so its presence proves the chart actually drew rather than
       * just that the wrapper div exists.
       *
       * Scoped to a direct child of `.recharts-wrapper` on purpose: Recharts
       * also gives every legend swatch the `recharts-surface` class, so a bare
       * `svg.recharts-surface` matches four elements on a three-series chart.
       */
      const surface = container.locator(".recharts-wrapper > svg.recharts-surface");
      await expect(surface).toBeVisible();

      const box = await surface.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(0);
      expect(box?.height ?? 0).toBeGreaterThan(0);
    });

    test(`the ${chart.testId} card is labelled`, async ({ page }) => {
      await expect(page.getByText(chart.title, { exact: true }).first()).toBeVisible();
    });
  }

  test("the trend chart draws one stacked area per scope", async ({ page }) => {
    const areas = page.getByTestId("chart-emissions-trend").locator(".recharts-area");
    await expect(areas).toHaveCount(3);
  });

  test("the trend chart plots twelve months on the x axis", async ({ page }) => {
    const ticks = page
      .getByTestId("chart-emissions-trend")
      .locator(".recharts-xAxis .recharts-cartesian-axis-tick");
    await expect(ticks).toHaveCount(12);
  });

  test("the scope donut draws three slices and shows the total in the hole", async ({ page }) => {
    const donut = page.getByTestId("chart-scope-breakdown");

    await expect(donut.locator(".recharts-pie-sector")).toHaveCount(3);
    // 12,920 tCO2e of sample data, grouped per the ko locale.
    await expect(donut.getByText("12,920")).toBeVisible();
  });

  test("the comparison chart draws two series of twelve bars", async ({ page }) => {
    const bars = page.getByTestId("chart-monthly-comparison").locator(".recharts-bar");
    await expect(bars).toHaveCount(2);

    const rectangles = page
      .getByTestId("chart-monthly-comparison")
      .locator(".recharts-bar-rectangle");
    await expect(rectangles).toHaveCount(24);
  });

  test("the top-sources chart draws exactly ten bars", async ({ page }) => {
    const rectangles = page.getByTestId("chart-top-sources").locator(".recharts-bar-rectangle");
    await expect(rectangles).toHaveCount(10);
  });

  test("the top-sources chart labels sources in the active language", async ({ page }) => {
    const chart = page.getByTestId("chart-top-sources");
    await expect(chart.getByText(ko.emission_sources.grid_electricity)).toBeVisible();
    await expect(chart.getByText(ko.emission_sources.boiler_1)).toBeVisible();
  });

  test("the page states that the figures are sample data", async ({ page }) => {
    const notice = page.getByTestId("sample-data-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(ko.dashboard.sample_data_notice);
  });

  test("the KPI row reports the same total the donut shows", async ({ page }) => {
    await expect(page.getByText("12,920 tCO2e").first()).toBeVisible();
  });

  test("charts re-render in the newly selected language", async ({ page }) => {
    await page.getByTestId("locale-switcher").first().click();
    await page.getByRole("menuitem", { name: "English", exact: true }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const chart = page.getByTestId("chart-top-sources");
    await expect(chart.locator(".recharts-wrapper > svg.recharts-surface")).toBeVisible();
    await expect(chart.getByText(MESSAGES.en.emission_sources.grid_electricity)).toBeVisible();
  });
});
