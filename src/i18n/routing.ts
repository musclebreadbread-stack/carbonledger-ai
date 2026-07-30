/**
 * Locale routing configuration
 */

import { locales, defaultLocale } from "./config";

export const routing = {
  locales,
  defaultLocale,
  localePrefix: "as-needed" as const,
};
