"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "../actions";
import { EMPTY_AUTH_STATE } from "../form-state";

export interface TestAccountSummary {
  email: string;
  name: string;
  /** Key under the `user_roles` namespace. */
  roleKey: string;
}

interface LoginFormProps {
  /** True when no Supabase project is configured, i.e. the test-account path. */
  demoMode: boolean;
  /** `?redirect=` from the proxy, passed through to the action. */
  redirectTo: string | null;
  testAccounts: TestAccountSummary[];
  testPassword: string | null;
}

/**
 * The sign-in form.
 *
 * Submits to a Server Action through `useActionState` rather than an `onSubmit`
 * that sets `window.location`. The old version validated nothing and navigated
 * unconditionally, so any two strings "logged you in"; the visible consequence
 * was that the header's user, the approval signer and the nav were all fixed
 * regardless of who you claimed to be.
 *
 * The form is a real `<form action={...}>`, so it submits without JavaScript.
 * `?redirect=` travels as a hidden field: the action re-validates it as a
 * same-origin path, since a query parameter is attacker-controlled.
 */
export function LoginForm({ demoMode, redirectTo, testAccounts, testPassword }: LoginFormProps) {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const tRoles = useTranslations("user_roles");
  const [state, formAction, isPending] = React.useActionState(signInAction, EMPTY_AUTH_STATE);

  const formRef = React.useRef<HTMLFormElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  /**
   * Fills the credentials for one test account without submitting.
   *
   * Offered alongside the sign-in shortcut because it shows the reviewer exactly
   * which credentials produced the session — so a later "why am I only a viewer"
   * is answerable from the screen rather than from the source.
   */
  function fill(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current && testPassword) passwordRef.current.value = testPassword;
    emailRef.current?.focus();
  }

  /**
   * Fills and submits in one click.
   *
   * `requestSubmit()` rather than calling the action directly, so the submission
   * goes through the same form — same hidden `redirect` field, same validation,
   * same pending state. Calling `formAction` by hand would bypass all three.
   */
  function signInAs(email: string) {
    fill(email);
    formRef.current?.requestSubmit();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">{tApp("name")}</CardTitle>
          <CardDescription>{t("login_subtitle")}</CardDescription>
        </CardHeader>
        <form ref={formRef} action={formAction}>
          {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
          <CardContent className="space-y-4">
            <div
              className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
              data-testid="login-mode-notice"
            >
              <p className="font-medium text-foreground">
                {demoMode ? t("demo_mode_title") : t("supabase_mode_title")}
              </p>
              <p>{demoMode ? t("demo_mode_body") : t("supabase_mode_body")}</p>
            </div>

            {state.error && (
              <p
                // `role="alert"` so the failure is announced; without it a
                // screen-reader user gets a silent no-op on submit.
                role="alert"
                data-testid="login-error"
                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {state.error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder={testAccounts[0]?.email ?? t("placeholder_email")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm" htmlFor="remember">
                <input id="remember" name="remember" type="checkbox" className="rounded border" />
                {t("remember_me")}
              </label>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                {t("forgot_password")}
              </Link>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isPending} data-testid="login-submit">
              {isPending ? t("signing_in") : t("sign_in")}
            </Button>
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t("or_continue_with")}</span>
              </div>
            </div>
            {/* The SSO buttons were inert. They stay visible because both providers
                are on the roadmap, but they are disabled and say why rather than
                silently doing nothing when clicked. */}
            <div className="grid w-full grid-cols-2 gap-4">
              <Button variant="outline" type="button" disabled title={t("sso_unavailable")}>
                {t("google_sso")}
              </Button>
              <Button variant="outline" type="button" disabled title={t("sso_unavailable")}>
                {t("microsoft")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("sso_unavailable")}</p>
            <p className="text-center text-sm text-muted-foreground">
              {t("no_account")}{" "}
              <Link href="/register" className="text-primary hover:underline">
                {t("sign_up")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>

      {testAccounts.length > 0 && testPassword && (
        <Card data-testid="test-accounts">
          <CardHeader>
            <CardTitle className="text-base">{t("test_accounts_title")}</CardTitle>
            <CardDescription>{t("test_accounts_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("test_accounts_password")}:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                {testPassword}
              </code>
            </p>
            <ul className="space-y-2">
              {testAccounts.map((account) => (
                <li
                  key={account.email}
                  data-testid="test-account-row"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{account.name}</span>
                      <Badge variant="outline">{tRoles(account.roleKey)}</Badge>
                    </span>
                    <code className="truncate font-mono text-xs text-muted-foreground">
                      {account.email}
                    </code>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid="test-account-fill"
                      data-account-email={account.email}
                      onClick={() => fill(account.email)}
                    >
                      {t("test_accounts_fill")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      data-testid="test-account-signin"
                      data-account-email={account.email}
                      onClick={() => signInAs(account.email)}
                    >
                      {t("test_accounts_use")}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
