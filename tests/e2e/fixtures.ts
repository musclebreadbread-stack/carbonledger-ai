/**
 * Shared helpers and expected strings for the E2E specs.
 *
 * Expected text is read from the real message catalogues rather than duplicated
 * as literals, so a wording change in `ko.json` does not silently leave the
 * tests asserting on a string the app no longer renders. The catalogues are
 * already covered for key parity by `tests/i18n/messages-parity.test.ts`.
 *
 * The catalogues are loaded with `fs` rather than `import ... from "*.json"`:
 * this package is ESM (`"type": "module"`), and Playwright's Node loader
 * requires an `with { type: "json" }` attribute for JSON imports. A *type-only*
 * `typeof import(...)` still gives the specs full autocomplete and type
 * checking without emitting a runtime import.
 *
 * Note on screenshots: this sandbox has no CJK fonts installed, so Korean,
 * Japanese and Chinese text rasterises as tofu boxes. Visual comparison is
 * therefore meaningless here — every assertion works on DOM text, the `lang`
 * attribute, or the locale cookie instead.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALE_COOKIE } from "../../src/i18n/config";

type Catalogue = typeof import("../../src/messages/ko.json");

const MESSAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/messages");

function loadCatalogue(locale: string): Catalogue {
  return JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8")) as Catalogue;
}

export const MESSAGES = {
  ko: loadCatalogue("ko"),
  en: loadCatalogue("en"),
  ja: loadCatalogue("ja"),
  zh: loadCatalogue("zh"),
} as const;

export type TestLocale = keyof typeof MESSAGES;

export { LOCALE_COOKIE };

/** Language names as rendered in the switcher; identical in every locale. */
export const LOCALE_DISPLAY_NAMES: Record<TestLocale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};

/** Every dashboard route that existed before this phase, plus the new one. */
export const DASHBOARD_ROUTES = [
  "/dashboard",
  "/emissions",
  "/emissions/new",
  "/emission-factors",
  "/reports",
  "/audit-log",
  "/settings",
  "/sites",
] as const;

/** The `dashboard.title` string per locale, i.e. the dashboard's `<h1>`. */
export function dashboardHeading(locale: TestLocale): string {
  return MESSAGES[locale].dashboard.title;
}

/** The landing page's `<h1>` — the app name, which is not localised. */
export const LANDING_HEADING = MESSAGES.ko.app.name;
