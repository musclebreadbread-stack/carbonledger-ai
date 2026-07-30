"use client";

/**
 * Standalone scope colour key.
 *
 * Charts that tint individual bars per scope (rather than having one Recharts
 * series per scope) cannot use the built-in `<Legend>`, because Recharts derives
 * legend entries from series and would show a single entry. This renders the
 * same key as plain DOM.
 */

import { useTranslations } from "next-intl";
import type { Scope } from "@/lib/dashboard/types";
import { SCOPE_COLORS } from "./chart-theme";

const SCOPES: Scope[] = [1, 2, 3];

export function ScopeLegend() {
  const tScopes = useTranslations("scopes");

  return (
    <div className="flex flex-wrap items-center gap-4 pt-2">
      {SCOPES.map((scope) => (
        <div key={scope} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: SCOPE_COLORS[scope] }}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">{tScopes(`scope${scope}`)}</span>
        </div>
      ))}
    </div>
  );
}
