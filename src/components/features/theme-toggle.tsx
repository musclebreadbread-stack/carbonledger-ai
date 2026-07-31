"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/lib/use-has-mounted";

/**
 * Working dark-mode switch.
 *
 * `ThemeProvider` was already mounted in the root layout and `.dark` was already
 * defined in globals.css, but the only control was a sun icon in the header with
 * no handler — so dark mode existed and was unreachable unless the visitor's OS
 * happened to be set to it. This is that button, wired up.
 *
 * Cycles light -> dark -> system rather than toggling two states, because
 * "system" is the default and a two-way toggle makes it unrecoverable once the
 * user has clicked once.
 *
 * `resolvedTheme` is only known after mount (the server cannot know the OS
 * preference), so the icon is rendered from `mounted` state; without that guard
 * the first client render disagrees with the server HTML and React warns.
 */
export function ThemeToggle() {
  const t = useTranslations("header");
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("toggle_theme")}
      title={t("toggle_theme")}
      data-testid="theme-toggle"
      data-theme-state={mounted ? (theme ?? "system") : "unknown"}
      onClick={() => setTheme(next)}
    >
      {mounted && resolvedTheme === "dark" ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}

function SunIcon() {
  return (
    <svg
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9" />
    </svg>
  );
}
