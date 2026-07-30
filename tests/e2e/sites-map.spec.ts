/**
 * The Leaflet site map must mount client-side without breaking the page.
 *
 * Leaflet touches `window` at import time, so the map is loaded through
 * `next/dynamic` with `ssr: false`. Two consequences are tested here:
 * the map container is absent from the server-rendered HTML but present after
 * hydration, and the surrounding page renders either way.
 *
 * Map *tiles* are fetched from OpenStreetMap and need outbound network access
 * from the browser. Nothing below depends on a tile ever loading — the
 * assertions target the Leaflet panes and markers Leaflet creates locally, plus
 * the site table, which is the authoritative listing.
 */

import { expect, test } from "@playwright/test";
import { MESSAGES } from "./fixtures";

const ko = MESSAGES.ko;

/** Sites in the sample fixture, one of which has no coordinates. */
const TOTAL_SITES = 7;
const PLOTTABLE_SITES = 6;

test.describe("site map", () => {
  test("the map is not server-rendered but appears after hydration", async ({ page }) => {
    // Server HTML: fetched without executing scripts, so nothing has hydrated.
    const response = await page.request.get("/sites");
    expect(response.status()).toBe(200);
    const html = await response.text();
    // Leaflet's own class names are the tell — the message catalogue is inlined
    // into the RSC payload, so searching for UI copy would give a false positive.
    expect(html).not.toContain("leaflet-container");

    await page.goto("/sites");
    await expect(page.getByTestId("site-map")).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();
  });

  test("the page renders its heading and sample-data notice", async ({ page }) => {
    await page.goto("/sites");

    await expect(page.locator("h1")).toHaveText(ko.sites.title);
    await expect(page.getByTestId("sample-data-notice")).toContainText(
      ko.sites.sample_data_notice
    );
  });

  test("one marker is drawn per geolocated site", async ({ page }) => {
    await page.goto("/sites");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    // circleMarker renders an SVG <path> in Leaflet's overlay pane.
    const markers = page.locator(".leaflet-overlay-pane path.leaflet-interactive");
    await expect(markers).toHaveCount(PLOTTABLE_SITES);
  });

  test("clicking a marker opens a popup naming the site", async ({ page }) => {
    await page.goto("/sites");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    const popup = page.locator(".leaflet-popup");

    /*
     * Retried as a unit rather than clicked once. The map calls
     * `invalidateSize()` on the next animation frame after mount, which
     * repositions every marker; a click dispatched in that window lands on
     * empty map and silently opens nothing. `toPass` re-clicks until the popup
     * is actually up, instead of leaving this spec permanently flaky.
     */
    await expect(async () => {
      await page.locator(".leaflet-overlay-pane path.leaflet-interactive").first().click();
      await expect(popup).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await expect(popup).toContainText(ko.sites.annual_emissions);
    await expect(popup).toContainText(ko.sites.facilities);
  });

  test("the map credits OpenStreetMap, as its licence requires", async ({ page }) => {
    await page.goto("/sites");
    await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  });

  test("the table lists every site, including the un-geocoded one", async ({ page }) => {
    await page.goto("/sites");

    await expect(page.getByTestId("site-row")).toHaveCount(TOTAL_SITES);
    await expect(page.getByText(ko.site_names.ulsan_plant).first()).toBeVisible();
    await expect(page.getByText(ko.site_names.incheon_logistics).first()).toBeVisible();
  });

  test("a site with no coordinates is marked as such, not plotted at (0, 0)", async ({ page }) => {
    await page.goto("/sites");

    await expect(page.getByText(ko.sites.not_geocoded).first()).toBeVisible();

    /*
     * Assert the fully interpolated sentence, not just that the digit appears
     * somewhere: an unsubstituted ICU placeholder would still contain the rest
     * of the message and would sail past a looser check.
     */
    const expected = ko.sites.no_coordinates.replace(
      "{count}",
      String(TOTAL_SITES - PLOTTABLE_SITES)
    );
    await expect(page.getByText(expected)).toBeVisible();
  });

  test("the site view is reachable from the sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    await page.locator('aside a[href="/sites"]').first().click();

    await expect(page).toHaveURL(/\/sites$/);
    await expect(page.locator("h1")).toHaveText(ko.sites.title);
  });

  test("the map still mounts after switching language", async ({ page }) => {
    await page.goto("/sites");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.getByTestId("locale-switcher").first().click();
    await page.getByRole("menuitem", { name: "English", exact: true }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveText(MESSAGES.en.sites.title);
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-overlay-pane path.leaflet-interactive")).toHaveCount(
      PLOTTABLE_SITES
    );
  });

  test("no uncaught page errors while the map initialises", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/sites");
    await expect(page.locator(".leaflet-container")).toBeVisible();

    expect(errors).toEqual([]);
  });
});
