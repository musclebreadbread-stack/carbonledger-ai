"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocalisedNotification } from "@/lib/notifications";

const SEVERITY_VARIANT: Record<
  LocalisedNotification["severity"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

interface NotificationMenuProps {
  items: LocalisedNotification[];
}

/**
 * The header bell, now with contents.
 *
 * Two things it deliberately does not do. There is no unread state, because the
 * feed is derived and there is nowhere to record a read (see
 * `src/lib/notifications/types.ts`) — the dot reflects whether anything is
 * outstanding, which is a claim the code can actually support, rather than the
 * unconditional red dot this replaces. And there is no "mark all read", for the
 * same reason: the only way to clear an item is to deal with the thing it points
 * at.
 *
 * Items are already localised on the server; this component renders text.
 */
export function NotificationMenu({ items }: NotificationMenuProps) {
  const t = useTranslations("notifications");
  const tSeverity = (severity: LocalisedNotification["severity"]) => t(`severity_${severity}`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={items.length > 0 ? t("count_label", { count: items.length }) : t("title")}
          title={t("title")}
          data-testid="notification-bell"
          data-notification-count={items.length}
        >
          <BellIcon />
          {items.length > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{t("title")}</p>
          <p className="text-xs text-muted-foreground">
            {items.length > 0 ? t("count_label", { count: items.length }) : t("description")}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-3 text-sm" data-testid="notification-empty">
            <p>{t("empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("empty_hint")}</p>
          </div>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild className="cursor-pointer">
              <Link
                href={item.href}
                data-testid="notification-item"
                className="flex items-start gap-2"
              >
                <Badge variant={SEVERITY_VARIANT[item.severity]} className="mt-0.5 shrink-0">
                  {tSeverity(item.severity)}
                </Badge>
                <span className="whitespace-normal text-xs leading-snug">{item.message}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BellIcon() {
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
