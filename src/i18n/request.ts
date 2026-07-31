/**
 * next-intl server configuration
 * Resolves the request locale from the locale cookie and loads its messages.
 */

import { getRequestConfig } from "next-intl/server";
import { DEFAULT_TIME_ZONE, defaultLocale } from "./config";
import { getUserLocale } from "./locale";

/**
 * Loads a catalogue, falling back to Korean if the module cannot be resolved.
 *
 * `getUserLocale()` already narrows the cookie to a supported locale, so this
 * only fires if a catalogue file is missing from the build — but the failure mode
 * without it is a 500 on every route, which is a far worse outcome than rendering
 * the default language. Korean is the fallback because it is the default locale,
 * not merely the first one in the list.
 */
async function loadMessages(locale: string) {
  try {
    return (await import(`@/messages/${locale}.json`)).default;
  } catch {
    return (await import(`@/messages/${defaultLocale}.json`)).default;
  }
}

export default getRequestConfig(async () => {
  const locale = await getUserLocale();

  return {
    locale,
    messages: await loadMessages(locale),
    /*
     * Pinned so a date formatted during server rendering and the same date
     * formatted after hydration agree. See DEFAULT_TIME_ZONE for why it is not
     * derived from the locale.
     */
    timeZone: DEFAULT_TIME_ZONE,
  };
});
