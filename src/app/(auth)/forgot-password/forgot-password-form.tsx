"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "./actions";
import { EMPTY_AUTH_STATE } from "../form-state";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, isPending] = React.useActionState(
    requestPasswordResetAction,
    EMPTY_AUTH_STATE
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      {state.notice && (
        <p
          role="status"
          data-testid="forgot-password-sent"
          className="rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm text-foreground"
        >
          {state.notice}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {t("forgot_password_submit")}
      </Button>
    </form>
  );
}
