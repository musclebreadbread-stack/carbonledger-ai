"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher } from "@/components/features/locale-switcher";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { signOutAction } from "@/app/(auth)/actions";

export interface HeaderUser {
  /** Display name, already translated where it needed to be. */
  name: string;
  /** Email of the signed-in account, or null when nobody signed in. */
  email: string | null;
  /** Translated role label. */
  roleLabel: string;
  /** Two-character avatar fallback. */
  initials: string;
  /** False for the anonymous stub session. */
  isSignedIn: boolean;
}

interface HeaderProps {
  onMenuToggle?: () => void;
  user: HeaderUser;
}

/**
 * Top bar.
 *
 * The identity half used to be false: the avatar said "AD" and
 * "admin@company.com" whoever you were, and the profile/settings/logout menu items
 * had no handlers. All of that now reflects the real session.
 *
 * The user is passed in rather than read here: identity comes from the session on
 * the server (see `src/lib/auth/session.ts`), and a client component cannot be
 * trusted to resolve it — nor should the browser be sent the machinery to try.
 */
export function Header({ onMenuToggle, user }: HeaderProps) {
  const t = useTranslations("header");
  const signOutFormRef = React.useRef<HTMLFormElement>(null);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      {/* Lives outside the dropdown so closing the menu cannot cancel the submit. */}
      <form ref={signOutFormRef} action={signOutAction} className="hidden" aria-hidden="true" />

      {/* Left side - Mobile menu + command palette */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuToggle}
          aria-label={t("open_menu")}
        >
          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </Button>

        <Button variant="outline" className="hidden w-60 justify-start text-muted-foreground md:flex">
          <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          {t("search")}
          <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </Button>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications")}>
          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </Button>

        <LocaleSwitcher iconOnly />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full"
              aria-label={t("account")}
              data-testid="user-menu-trigger"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback>{user.initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1" data-testid="user-menu-identity">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                {user.email && (
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                )}
                <p className="text-xs leading-none text-muted-foreground">
                  {t("role_label")}: {user.roleLabel}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* "Profile" is gone: there is no profile screen, and a menu item that
                goes nowhere is the thing being fixed here, not preserved. */}
            <DropdownMenuItem asChild>
              <Link href="/settings">{t("settings")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user.isSignedIn ? (
              /*
                Submits a real form rather than calling the action from an onClick,
                because signing out mutates server state (it clears a cookie) and
                that is a POST.
                The form is rendered *outside* the menu content, and `onSelect`
                preventDefaults so Radix does not close the menu mid-click: a form
                inside the dropdown is unmounted by the close animation before the
                browser gets to the submit, which is exactly the silent no-op this
                menu item used to be.
              */
              <DropdownMenuItem
                data-testid="sign-out"
                onSelect={(event) => {
                  event.preventDefault();
                  signOutFormRef.current?.requestSubmit();
                }}
              >
                {t("logout")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href="/login" data-testid="sign-in-link">
                  {t("sign_in")}
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
