"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/auth";
import type { AuthFormState } from "../form-state";

const emailOnly = z.object({ email: z.string().trim().min(1).email() });

/**
 * Requests a password-reset email.
 *
 * Always reports the same thing, whether the address exists, does not exist, or
 * Supabase refused: telling an unauthenticated caller "no such account" turns this
 * form into a register-of-users lookup. The failure is logged server-side, which is
 * where someone who can act on it will look.
 */
export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const t = await getTranslations("auth");
  const tErrors = await getTranslations("errors");

  const parsed = emailOnly.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: tErrors("invalid_email"), notice: null };
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: appUrl ? `${appUrl}/login` : undefined,
    });
    if (error) {
      console.error("password reset request failed", error);
    }
  }

  return { error: null, notice: t("forgot_password_sent") };
}
