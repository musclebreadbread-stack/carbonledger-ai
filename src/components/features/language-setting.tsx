"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";

/**
 * Language chooser for /settings.
 *
 * The product's language could only be changed from a globe icon in the top bar,
 * which is a discovery problem: a user looking for "how do I change the language"
 * looks in settings. This is that control, and it is the canonical one — the top
 * bar keeps its switcher as a quick toggle, and both write the same cookie through
 * the same Server Action, so neither can drift from the other.
 *
 * A radio group rather than a `<select>`, because the four options fit and the
 * current choice is then visible without opening anything — which is the reason
 * someone came to this screen.
 *
 * `router.refresh()` is not called: setting the cookie inside a Server Action
 * already causes Next.js to re-render the current tree from the server, which is
 * how the top-bar switcher has always worked. Adding a refresh would double the
 * round trip.
 */
export function LanguageSetting() {
  const activeLocale = useLocale() as Locale;
  const t = useTranslations("settings");
  const [selection, setSelection] = React.useState<{ from: Locale; to: Locale } | null>(null);
  const [isPending, startTransition] = React.useTransition();
  // Keep the optimistic choice only while the server still reports the locale it
  // was chosen from. Once either this action or the top-bar switcher changes the
  // server value, activeLocale becomes the source of truth without an effect.
  const selectedLocale = selection?.from === activeLocale ? selection.to : activeLocale;

  function select(next: Locale) {
    if (next === selectedLocale) return;

    // A controlled radio would otherwise snap back to the old server locale
    // while the action is pending. Reflect the user's choice immediately, then
    // let the server-rendered locale become the source of truth.
    setSelection({ from: activeLocale, to: next });
    startTransition(async () => {
      try {
        await setUserLocale(next);
      } catch (error) {
        setSelection(null);
        throw error;
      }
    });
  }

  return (
    <fieldset className="space-y-3" disabled={isPending} data-testid="language-setting">
      <legend className="text-sm font-medium">{t("language")}</legend>
      <p className="text-sm text-muted-foreground">{t("language_desc")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {locales.map((locale) => {
          const isActive = locale === selectedLocale;
          return (
            <label
              key={locale}
              data-testid="language-option"
              data-locale={locale}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors",
                isActive ? "border-primary bg-primary/5 font-semibold" : "hover:bg-accent",
                isPending && "cursor-wait opacity-70"
              )}
            >
              <input
                type="radio"
                name="locale"
                value={locale}
                checked={isActive}
                onChange={() => select(locale)}
                className="h-4 w-4"
              />
              <span>{localeNames[locale]}</span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("language_current", { language: localeNames[activeLocale] })}
      </p>
      <p className="text-xs text-muted-foreground">{t("language_switcher_hint")}</p>
    </fieldset>
  );
}
