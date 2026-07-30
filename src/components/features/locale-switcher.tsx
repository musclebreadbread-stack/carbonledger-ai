"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";

interface LocaleSwitcherProps {
  className?: string;
  /** Hide the language name and show only the globe icon (used in tight toolbars). */
  iconOnly?: boolean;
}

/**
 * Visible language switcher. Persists the choice in the locale cookie via a
 * Server Action, then refreshes the route so server-rendered strings come back
 * in the new language. URLs are unaffected.
 */
export function LocaleSwitcher({ className, iconOnly = false }: LocaleSwitcherProps) {
  const activeLocale = useLocale() as Locale;
  const t = useTranslations("locale_switcher");
  const [isPending, startTransition] = React.useTransition();

  function handleSelect(next: Locale) {
    if (next === activeLocale) return;
    startTransition(async () => {
      await setUserLocale(next);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={iconOnly ? "icon" : "sm"}
          aria-label={t("label")}
          title={t("label")}
          disabled={isPending}
          className={cn("gap-2", className)}
        >
          <GlobeIcon />
          {!iconOnly && <span className="text-sm font-medium">{localeNames[activeLocale]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onSelect={() => handleSelect(locale)}
            className={cn("cursor-pointer", locale === activeLocale && "font-semibold")}
          >
            <span className="flex w-full items-center justify-between gap-4">
              {localeNames[locale]}
              {locale === activeLocale && <CheckIcon />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobeIcon() {
  return (
    <svg
      className="h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
