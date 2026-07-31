"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";
import type { NavRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

interface CommandPaletteProps {
  /** Destinations the current role may see, resolved on the server. */
  routes: readonly NavRoute[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Command =
  | { id: string; group: "pages"; label: string; run: () => void }
  | { id: string; group: "language"; label: string; run: () => void }
  | { id: string; group: "theme"; label: string; run: () => void };

/**
 * Ctrl/Cmd-K palette.
 *
 * The header advertised this: it rendered a search box with a `Ctrl K` keycap and
 * neither the box nor the shortcut did anything. Rather than remove the promise,
 * this makes it true — and the palette is the cheapest place to also expose the
 * two settings a keyboard user is most likely to want mid-task, language and
 * theme, since both are otherwise mouse-only dropdowns.
 *
 * Filtering is a plain case-insensitive substring match over the *translated*
 * labels, so typing "배출" finds 배출량 on a Korean UI and "emis" finds it on an
 * English one. No fuzzy matcher: with a dozen destinations it would add a
 * dependency and a class of surprising near-misses for nothing.
 *
 * The route list arrives as a prop rather than being imported here, because it is
 * already filtered by role upstream; importing `NAV_ROUTES` directly would offer a
 * viewer a shortcut to a page their nav does not show.
 */
export function CommandPalette({ routes, open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslations("command_palette");
  const tNav = useTranslations("nav");
  const tSettings = useTranslations("settings");
  const router = useRouter();
  const activeLocale = useLocale() as Locale;
  const { setTheme } = useTheme();
  const [query, setQuery] = React.useState("");

  /**
   * Clears the query on the way out, so the next open starts empty.
   *
   * Done on close rather than in an effect watching `open`: a stale query is the
   * wrong initial state, but fixing it by scheduling a second render from an
   * effect is a cascade for something a single handler can do.
   */
  function handleOpenChange(next: boolean) {
    if (!next) setQuery("");
    onOpenChange(next);
  }

  const commands: Command[] = React.useMemo(() => {
    const pages: Command[] = routes.map((route) => ({
      id: `page:${route.href}`,
      group: "pages",
      label: tNav(route.titleKey),
      run: () => router.push(route.href),
    }));

    const languages: Command[] = locales
      .filter((locale) => locale !== activeLocale)
      .map((locale) => ({
        id: `locale:${locale}`,
        group: "language",
        label: localeNames[locale],
        run: () => {
          void setUserLocale(locale);
        },
      }));

    const themes: Command[] = (["light", "dark", "system"] as const).map((theme) => ({
      id: `theme:${theme}`,
      group: "theme",
      label: tSettings(`theme_${theme}`),
      run: () => setTheme(theme),
    }));

    return [...pages, ...languages, ...themes];
  }, [routes, tNav, tSettings, router, activeLocale, setTheme]);

  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(needle));
  }, [commands, query]);

  function run(command: Command) {
    handleOpenChange(false);
    command.run();
  }

  const groups: { group: Command["group"]; heading: string }[] = [
    { group: "pages", heading: t("group_pages") },
    { group: "language", heading: t("group_language") },
    { group: "theme", heading: t("group_theme") },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-24 max-w-lg translate-y-0 gap-3 p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">{t("title")}</DialogTitle>
          <DialogDescription className="text-xs">{t("description")}</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          data-testid="command-palette-input"
          onKeyDown={(event) => {
            // Enter runs the single best match, which is what a palette is for:
            // type three letters, press Enter, arrive.
            if (event.key === "Enter" && matches.length > 0) {
              event.preventDefault();
              run(matches[0]);
            }
          }}
        />
        <div className="max-h-72 overflow-y-auto" role="listbox" aria-label={t("title")}>
          {matches.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground" data-testid="command-empty">
              {t("empty")}
            </p>
          ) : (
            groups.map(({ group, heading }) => {
              const inGroup = matches.filter((command) => command.group === group);
              if (inGroup.length === 0) return null;
              return (
                <div key={group} className="py-1">
                  <p className="px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
                    {heading}
                  </p>
                  {inGroup.map((command) => (
                    <button
                      key={command.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      data-testid="command-option"
                      onClick={() => run(command)}
                      className={cn(
                        "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm",
                        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none"
                      )}
                    >
                      {command.label}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
        <p className="px-2 text-xs text-muted-foreground">{t("hint")}</p>
      </DialogContent>
    </Dialog>
  );
}
