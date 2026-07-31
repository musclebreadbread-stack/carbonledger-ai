/**
 * Internationalization configuration
 * Supported locales and default settings
 */

export const locales = ["ko", "en", "ja", "zh"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ko";

export const localeNames: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};

/**
 * BCP 47 tags with a region, for `<meta property="og:locale">`.
 *
 * `<html lang>` keeps the bare subtag (`ko`, not `ko-KR`) because that is what
 * the locale cookie holds and what the E2E specs assert; Open Graph wants the
 * underscored regional form, so the two are kept as separate maps rather than
 * one being derived from the other by string surgery.
 */
export const openGraphLocales: Record<Locale, string> = {
  ko: "ko_KR",
  en: "en_US",
  ja: "ja_JP",
  zh: "zh_CN",
};

/**
 * Name of the cookie that persists the visitor's locale choice.
 *
 * This app resolves the locale from a cookie rather than from a `[locale]` URL
 * segment, so routes stay at `/emissions` instead of `/ko/emissions`.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Time zone every server-rendered date is formatted in.
 *
 * Without this, `Intl.DateTimeFormat` on the server uses the *server's* zone
 * (UTC on most hosts) while the same component re-rendering on the client uses
 * the visitor's, so a timestamp near midnight renders as two different days and
 * React reports a hydration mismatch. Pinning it removes the ambiguity, and
 * Asia/Seoul is the right default for a product whose default locale is Korean:
 * "2024-01-15 09:00" has to mean KST for a Korean reporting boundary to be
 * correct.
 *
 * Deliberately not derived from the locale — a Korean company reporting under
 * the Korean fiscal calendar keeps that boundary when a reviewer switches the UI
 * to English. The report generators pin UTC separately and say so.
 */
export const DEFAULT_TIME_ZONE = "Asia/Seoul";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
