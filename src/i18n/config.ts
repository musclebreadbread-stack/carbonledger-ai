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
 * Name of the cookie that persists the visitor's locale choice.
 *
 * This app resolves the locale from a cookie rather than from a `[locale]` URL
 * segment, so routes stay at `/emissions` instead of `/ko/emissions`.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
