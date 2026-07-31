import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/auth";
import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Password reset.
 *
 * This route did not exist: `/login` linked to `/forgot-password` and the link
 * 404ed. Nothing in the suite noticed, because the routing spec only walks links
 * rendered inside `<aside>`.
 *
 * On a configured project it sends a real Supabase reset email. In demo mode it
 * says so and points at the published test-account password rather than
 * pretending to send mail — the alternative is a visitor waiting for an email
 * that no code sends.
 */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  const demoMode = !isSupabaseConfigured();

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t("forgot_password_title")}</CardTitle>
        <CardDescription>{t("forgot_password_subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {demoMode ? (
          <p
            data-testid="forgot-password-demo-notice"
            className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
          >
            {t("forgot_password_demo")}
          </p>
        ) : (
          <ForgotPasswordForm />
        )}
      </CardContent>
      <CardFooter>
        <Link href="/login" className="text-sm text-primary hover:underline">
          {t("back_to_login")}
        </Link>
      </CardFooter>
    </Card>
  );
}
