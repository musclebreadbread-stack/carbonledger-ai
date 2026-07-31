/**
 * Language and theme have to be changeable from /settings, and the change has to
 * stick.
 *
 * `i18n.spec.ts` already covers the top-bar switcher. This file covers the control
 * a user actually goes looking for — nobody hunts for a globe icon when they want
 * to change the language, they open settings — and the invariant that matters once
 * there are two controls: they must be the same setting, not two settings that
 * happen to agree today.
 *
 * As noted in `fixtures.ts`, this sandbox ships no CJK fonts, so every assertion
 * works on DOM text, the `lang` attribute or the cookie rather than on screenshots.
 */

import { expect, test } from "@playwright/test";
import { LOCALE_COOKIE, LOCALE_DISPLAY_NAMES, MESSAGES, dashboardHeading } from "./fixtures";

const ko = MESSAGES.ko;

/** Picks a language from the radio group on /settings. */
async function chooseLanguage(page: import("@playwright/test").Page, locale: string) {
  await page.locator(`[data-testid="language-option"][data-locale="${locale}"] input`).check();
}

test.describe("language, from settings", () => {
  test("offers every supported language and marks the active one", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByTestId("language-option")).toHaveCount(4);
    for (const name of Object.values(LOCALE_DISPLAY_NAMES)) {
      await expect(page.getByTestId("language-setting")).toContainText(name);
    }
    // Korean by default, and the card says which one is current rather than leaving
    // it to be inferred from a highlight.
    await expect(page.getByTestId("language-setting")).toContainText(
      ko.settings.language_current.replace("{language}", LOCALE_DISPLAY_NAMES.ko)
    );
    await expect(
      page.locator('[data-testid="language-option"][data-locale="ko"] input')
    ).toBeChecked();
  });

  test("changing it re-renders the page in that language", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("h1")).toHaveText(ko.settings.title);

    await chooseLanguage(page, "en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1")).toHaveText(MESSAGES.en.settings.title);
  });

  test("the choice persists across a reload and a navigation", async ({ page }) => {
    await page.goto("/settings");
    await chooseLanguage(page, "ja");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");

    await page.reload();
    await expect(page.locator("h1")).toHaveText(MESSAGES.ja.settings.title);

    await page.goto("/dashboard");
    await expect(page.locator("h1")).toHaveText(dashboardHeading("ja"));
  });

  test("it writes the same cookie the top-bar switcher does", async ({ context, page }) => {
    await page.goto("/settings");
    await chooseLanguage(page, "zh");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");

    const cookie = (await context.cookies()).find((c) => c.name === LOCALE_COOKIE);
    expect(cookie?.value).toBe("zh");
  });

  test("the top-bar switcher and this card stay in agreement", async ({ page }) => {
    await page.goto("/settings");

    // Change from the top bar...
    await page.getByTestId("locale-switcher").first().click();
    await page.getByRole("menuitem", { name: LOCALE_DISPLAY_NAMES.en, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // ...and the settings card must reflect it, because it is one setting.
    await expect(
      page.locator('[data-testid="language-option"][data-locale="en"] input')
    ).toBeChecked();
    await expect(
      page.locator('[data-testid="language-option"][data-locale="ko"] input')
    ).not.toBeChecked();
  });

  test("switching back to Korean works from here too", async ({ page }) => {
    await page.goto("/settings");
    await chooseLanguage(page, "en");
    await expect(page.locator("h1")).toHaveText(MESSAGES.en.settings.title);

    await chooseLanguage(page, "ko");

    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator("h1")).toHaveText(ko.settings.title);
  });

  test("the URL never gains a locale segment", async ({ page }) => {
    await page.goto("/settings");
    await chooseLanguage(page, "ja");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");

    expect(new URL(page.url()).pathname).toBe("/settings");
  });
});

test.describe("theme, from settings", () => {
  test("offers light, dark and system, defaulting to system", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByTestId("theme-option")).toHaveCount(3);
    await expect(page.locator('[data-testid="theme-option"][data-theme="system"] input')).toBeChecked();
  });

  test("choosing dark actually darkens the document", async ({ page }) => {
    await page.goto("/settings");

    await page.locator('[data-testid="theme-option"][data-theme="dark"] input').check();

    // `.dark` on <html> is what globals.css keys the dark palette off, so this is
    // the observable consequence rather than a proxy for it.
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("the choice survives a reload", async ({ page }) => {
    await page.goto("/settings");
    await page.locator('[data-testid="theme-option"][data-theme="dark"] input').check();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.reload();

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator('[data-testid="theme-option"][data-theme="dark"] input')).toBeChecked();
  });

  test("the top-bar toggle changes the same setting", async ({ page }) => {
    await page.goto("/settings");

    // The toggle cycles light -> dark -> system; from the default it lands on light.
    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.locator('[data-testid="theme-option"][data-theme="light"] input')).toBeChecked();

    await page.getByTestId("theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator('[data-testid="theme-option"][data-theme="dark"] input')).toBeChecked();
  });

  test("the toggle can get back to system, so the choice is not a trap", async ({ page }) => {
    await page.goto("/settings");

    // A two-state toggle would make "system" unrecoverable after one click, which is
    // why the control cycles three ways.
    await page.getByTestId("theme-toggle").click();
    await page.getByTestId("theme-toggle").click();
    await page.getByTestId("theme-toggle").click();

    await expect(page.locator('[data-testid="theme-option"][data-theme="system"] input')).toBeChecked();
  });
});


test.describe("settings without persistence", () => {
  test("does not present editable controls that cannot be saved", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.locator("#companyName")).toBeDisabled();
    await expect(page.locator("#industry")).toBeDisabled();
    await expect(page.locator("#country")).toBeDisabled();
    await expect(page.locator("#registrationNumber")).toBeDisabled();
    await expect(page.locator("#activeProvider")).toBeDisabled();
    await expect(page.getByRole("button", { name: ko.settings.save_changes })).toBeDisabled();
    await expect(page.getByRole("button", { name: ko.settings.invite_user })).toBeDisabled();
    await expect(page.getByText(ko.settings.not_persisted)).toHaveCount(3);
  });
});