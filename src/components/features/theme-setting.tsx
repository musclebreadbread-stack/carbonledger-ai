"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useHasMounted } from "@/lib/use-has-mounted";
import { cn } from "@/lib/utils";

const THEMES = ["light", "dark", "system"] as const;

/**
 * Theme chooser for /settings.
 *
 * Paired with the language chooser because they are the same kind of decision —
 * how the product presents itself to this person on this device — and because
 * dark mode was previously unreachable from anywhere.
 *
 * `mounted` guards the checked state: `theme` is read from localStorage, which the
 * server cannot see, so rendering the selection before mount would produce markup
 * that disagrees with the client's first render.
 */
export function ThemeSetting() {
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const active = mounted ? (theme ?? "system") : null;

  return (
    <fieldset className="space-y-3" data-testid="theme-setting">
      <legend className="text-sm font-medium">{t("theme")}</legend>
      <p className="text-sm text-muted-foreground">{t("theme_desc")}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {THEMES.map((option) => (
          <label
            key={option}
            data-testid="theme-option"
            data-theme={option}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors",
              active === option ? "border-primary bg-primary/5 font-semibold" : "hover:bg-accent"
            )}
          >
            <input
              type="radio"
              name="theme"
              value={option}
              checked={active === option}
              onChange={() => setTheme(option)}
              className="h-4 w-4"
            />
            <span>{t(`theme_${option}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
