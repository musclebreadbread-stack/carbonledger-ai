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
