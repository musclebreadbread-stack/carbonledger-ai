"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "../actions";
import { EMPTY_AUTH_STATE } from "../form-state";

/**
 * Sign-up.
 *
 * The previous version called nothing and navigated to `/` on submit, which read
 * as success: the visitor came away believing an account existed. It now goes
 * through a Server Action that either creates the account in Supabase or says
 * plainly that a demo deployment cannot, and reports mismatched or short
 * passwords instead of accepting them.
 *
 * No redirect on success. Supabase may require email confirmation, so the truthful
 * outcome is "check your inbox, then sign in".
 */
export default function RegisterPage() {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = React.useActionState(registerAction, EMPTY_AUTH_STATE);

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t("register_title")}</CardTitle>
        <CardDescription>{t("register_subtitle")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {state.error && (
            <p
              role="alert"
              data-testid="register-error"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          )}
          {state.notice && (
            <p
              role="status"
              data-testid="register-notice"
              className="rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-foreground"
            >
              {state.notice}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("first_name")}</Label>
              <Input id="firstName" name="firstName" placeholder={t("placeholder_first_name")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("last_name")}</Label>
              <Input id="lastName" name="lastName" placeholder={t("placeholder_last_name")} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">{t("company_name")}</Label>
            <Input id="companyName" name="companyName" placeholder={t("placeholder_company")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("work_email")}</Label>
            <Input id="email" name="email" type="email" placeholder={t("placeholder_email")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirm_password")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? t("creating_account") : t("create_account")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("have_account")}{" "}
            <Link href="/login" className="text-primary hover:underline">{t("sign_in")}</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
