/**
 * The language switcher must actually change the rendered language and remember
 * the choice.
 *
 * Locale is cookie-based (`NEXT_LOCALE`) via next-intl with no path routing, so
 * URLs do not change per language. That makes the URL useless as evidence and
 * puts the burden on three observable things: the `<html lang>` attribute, the
 * rendered text, and the cookie. All three are asserted here.
 *
 * Deliberately no screenshot comparison: this sandbox ships no CJK fonts, so
 * Korean/Japanese/Chinese glyphs rasterise as boxes and any image diff would be
 * measuring the font stack rather than the translation.
 */

import { expect, test } from "@playwright/test";
import { LOCALE_COOKIE, LOCALE_DISPLAY_NAMES, MESSAGES, dashboardHeading } from "./fixtures";
import { buildSampleDashboardData } from "../../src/lib/dashboard/sample-data";

/** Opens the switcher and picks a language by its (locale-invariant) name. */
async function switchLanguage(
  page: import("@playwright/test").Page,
  language: string
): Promise<void> {
  await page.getByTestId("locale-switcher").first().click();
  await page.getByRole("menuitem", { name: language, exact: true }).click();
}

test.describe("language switcher", () => {
  test("defaults to Korean for a visitor with no cookie", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ko"));
  });

  test("switching to English changes both the lang attribute and the text", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ko"));

    await switchLanguage(page, LOCALE_DISPLAY_NAMES.en);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveText(dashboardHeading("en"));
    // Guard against a partial re-render leaving Korean strings behind.
    await expect(page.locator("h1")).not.toHaveText(dashboardHeading("ko"));
  });

  test("the choice survives a full page reload", async ({ page }) => {
    await page.goto("/dashboard");
    await switchLanguage(page, LOCALE_DISPLAY_NAMES.ja);
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ja"));

    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ja"));
  });

  test("the choice survives navigating to another page", async ({ page }) => {
    await page.goto("/dashboard");
    await switchLanguage(page, LOCALE_DISPLAY_NAMES.zh);
    await expect(page.locator("h1")).toHaveText(dashboardHeading("zh"));

    await page.goto("/settings");

    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
    await expect(page.locator("h1")).toHaveText(MESSAGES.zh.settings.title);
  });

  test("the choice is persisted in the NEXT_LOCALE cookie", async ({ page, context }) => {
    await page.goto("/dashboard");
    await switchLanguage(page, LOCALE_DISPLAY_NAMES.en);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const cookie = (await context.cookies()).find((c) => c.name === LOCALE_COOKIE);
    expect(cookie?.value).toBe("en");
  });

  test("switching back to Korean works too", async ({ page }) => {
    await page.goto("/dashboard");
    await switchLanguage(page, LOCALE_DISPLAY_NAMES.en);
    await expect(page.locator("h1")).toHaveText(dashboardHeading("en"));

    await switchLanguage(page, LOCALE_DISPLAY_NAMES.ko);

    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ko"));
  });

  test("the URL never gains a locale segment", async ({ page }) => {
    await page.goto("/dashboard");
    await switchLanguage(page, LOCALE_DISPLAY_NAMES.ja);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");

    // Cookie-based locale: the path must stay exactly as it was.
    expect(new URL(page.url()).pathname).toBe("/dashboard");
  });

  test("a preset cookie is honoured on first render", async ({ context, page }) => {
    await context.addCookies([
      { name: LOCALE_COOKIE, value: "ja", url: "http://localhost:3000" },
    ]);

    await page.goto("/dashboard");

    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ja"));
  });

  test("the landing page is localised too", async ({ context, page }) => {
    await context.addCookies([
      { name: LOCALE_COOKIE, value: "en", url: "http://localhost:3000" },
    ]);

    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText(MESSAGES.en.home.tagline)).toBeVisible();
  });
});


test.describe("Korean-first server rendering", () => {
  test.use({ extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" } });

  test("ignores an English browser preference when no locale cookie exists", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ko"));
  });

  test("server HTML and metadata are Korean on the first response", async ({ request, page }) => {
    const response = await request.get("/dashboard", {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
    });
    const html = await response.text();
    expect(response.status()).toBe(200);
    expect(html).toContain('<html lang="ko"');
    expect(html).toContain(dashboardHeading("ko"));

    await page.goto("/dashboard");
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "ko_KR");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      MESSAGES.ko.app.description
    );
    await expect(page).toHaveTitle(MESSAGES.ko.app.title);
  });

  test("server-rendered numbers use the active Korean locale", async ({ page }) => {
    await page.goto("/dashboard");
    const total = buildSampleDashboardData().kpis.totalEmissions;
    const expected = `${new Intl.NumberFormat("ko", { maximumFractionDigits: 0 }).format(total)} tCO2e`;

    await expect(page.getByText(expected, { exact: true }).first()).toBeVisible();
  });

  test("server-rendered dates use the active Korean locale", async ({ page }) => {
    await page.goto("/suppliers");
    const expected = new Intl.DateTimeFormat("ko", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date("2024-11-30"));

    await expect(page.getByText(expected, { exact: true }).first()).toBeVisible();
  });
});
