/**
 * Regression guard for the `/` route collision.
 *
 * `src/app/page.tsx` (landing) and the old `src/app/(dashboard)/page.tsx` both
 * compiled to `/`. The landing page won, so the dashboard index — fully built
 * and translated — was unreachable in the running app. The dashboard now lives
 * at `/dashboard`.
 *
 * A build-time check cannot catch a reintroduction of this: Next.js does not
 * error on the collision, it just silently picks one page. Only a request can
 * tell the two apart, which is what these tests do.
 */

import { expect, test } from "@playwright/test";
import { DASHBOARD_ROUTES, LANDING_HEADING, dashboardHeading } from "./fixtures";

test.describe("route resolution", () => {
  test("/ serves the landing page, not the dashboard", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText(LANDING_HEADING);
    // The distinguishing assertion: if the collision came back and the dashboard
    // won instead, this heading would be the dashboard title.
    await expect(page.locator("h1")).not.toHaveText(dashboardHeading("ko"));
  });

  test("/dashboard serves the dashboard index", async ({ page }) => {
    const response = await page.goto("/dashboard");

    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ko"));
  });

  test("the landing page and the dashboard are genuinely different pages", async ({ page }) => {
    await page.goto("/");
    const landing = await page.locator("h1").textContent();

    await page.goto("/dashboard");
    const dashboard = await page.locator("h1").textContent();

    expect(landing).not.toBe(dashboard);
  });

  for (const route of DASHBOARD_ROUTES) {
    test(`${route} resolves and renders a heading`, async ({ page }) => {
      const response = await page.goto(route);

      expect(response?.status()).toBe(200);
      // A missing route still returns markup, so assert on the 404 body Next
      // renders rather than trusting the status code alone.
      await expect(page.locator("h1")).not.toHaveText("404");
      await expect(page.locator("h1").first()).not.toBeEmpty();
    });
  }

  test("an unknown route still 404s (the matcher is not swallowing everything)", async ({
    page,
  }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("the landing page's primary call to action leads to the dashboard", async ({ page }) => {
    await page.goto("/");

    const cta = page.locator('a[href="/dashboard"]').first();
    await expect(cta).toBeVisible();

    await cta.click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ko"));
  });

  test("the sidebar dashboard link points at /dashboard, not /", async ({ page }) => {
    await page.goto("/emissions");

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
    // No sidebar link should target the landing page.
    await expect(sidebar.locator('a[href="/"]')).toHaveCount(0);
    await expect(sidebar.locator('a[href="/dashboard"]')).not.toHaveCount(0);
  });

  test("navigating from the sidebar reaches the dashboard", async ({ page }) => {
    await page.goto("/emissions");

    await page.locator('aside a[href="/dashboard"]').first().click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ko"));
  });
});
