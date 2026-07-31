import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LanguageSetting } from "@/components/features/language-setting";
import { ThemeSetting } from "@/components/features/theme-setting";
import { signOutAction } from "@/app/(auth)/actions";
import { actorDisplayName } from "@/lib/auth/current-actor";
import { getSessionSummary } from "@/lib/auth/session";
import { getPermissions } from "@/lib/auth/roles";
import { TEST_ACCOUNTS } from "@/lib/auth/test-accounts";

/**
 * Organisation and system settings, served at `/settings`.
 *
 * The display card is where a user actually looks for "change the language", and
 * before it the only way to do so was a globe icon in the top bar. It is now the
 * canonical control; the top-bar switcher stays as a quick toggle and both write
 * the same cookie through the same Server Action, so the two cannot drift.
 *
 * The account card answers "what am I allowed to do" by listing the permissions the
 * current role holds — previously the role was invisible on every screen.
 *
 * The company-profile and emission-factor cards are unchanged in substance but no
 * longer imply they save. There is no persistence behind them yet, and a Save
 * button that silently does nothing is worse than one that says so — each now
 * carries the "not persisted" note and a disabled control, which is the honest
 * state until a database-backed provider exists.
 *
 * The user list is now the real test-account roster rather than three invented
 * addresses, so the names here match the ones on the login screen and in
 * supabase/seed.sql.
 */
export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const tRoles = await getTranslations("user_roles");
  const tPermissions = await getTranslations("permissions");
  const tActor = await getTranslations("actor");

  const session = await getSessionSummary();
  const actor = session.actor;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Display: language and theme */}
      <Card id="display">
        <CardHeader>
          <CardTitle>{t("appearance")}</CardTitle>
          <CardDescription>{t("appearance_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LanguageSetting />
          <Separator />
          <ThemeSetting />
        </CardContent>
      </Card>

      {/* Who am I, and what may I do */}
      <Card id="account">
        <CardHeader>
          <CardTitle>{t("my_account")}</CardTitle>
          <CardDescription>{t("my_account_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {actor === null ? (
            <p className="text-sm text-muted-foreground">{t("not_signed_in")}</p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2" data-testid="account-summary">
              <div>
                <dt className="text-muted-foreground">{t("signed_in_as")}</dt>
                <dd className="font-medium">
                  {actorDisplayName(actor, tActor("unauthenticated_operator"))}
                  {session.email && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {session.email}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("role_label")}</dt>
                <dd>
                  <Badge variant="secondary" data-testid="account-role">
                    {tRoles(actor.role)}
                  </Badge>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t("permissions_label")}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {getPermissions(actor.role).map((permission) => (
                    <Badge key={permission} variant="outline" data-testid="account-permission">
                      {tPermissions(permission)}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t("company_label")}</dt>
                <dd className="font-mono text-xs">{actor.companyId}</dd>
              </div>
            </dl>
          )}

          {!session.isSignedIn && (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {t("demo_session_note")}
            </p>
          )}

          {session.isSignedIn ? (
            <form action={signOutAction}>
              <Button type="submit" variant="outline" data-testid="settings-sign-out">
                {t("sign_out")}
              </Button>
            </form>
          ) : (
            <Button asChild variant="outline">
              <Link href="/login">{t("sign_in_cta")}</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle>{t("company_profile")}</CardTitle>
          <CardDescription>{t("company_profile_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">{t("company_name")}</Label>
              <Input id="companyName" defaultValue={t("sample_company")} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">{t("industry")}</Label>
              <Input id="industry" defaultValue={t("sample_industry")} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("country")}</Label>
              <Input id="country" defaultValue={t("sample_country")} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">{t("registration_number")}</Label>
              <Input id="registrationNumber" defaultValue="123-45-67890" disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("not_persisted")}</p>
          <Button disabled>{t("save_changes")}</Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Emission Factor Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t("emission_factor_version")}</CardTitle>
          <CardDescription>{t("emission_factor_version_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activeProvider">{t("active_provider")}</Label>
            <select
              id="activeProvider"
              disabled
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="korea_moe_2023">{t("provider_korea_moe_2023")}</option>
              <option value="ipcc_2006">{t("provider_ipcc_2006")}</option>
              <option value="defra_2023">{t("provider_defra_2023")}</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">{t("not_persisted")}</p>
          <Button variant="outline" disabled>
            {t("apply_all")}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t("user_management")}</CardTitle>
          <CardDescription>{t("user_management_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {TEST_ACCOUNTS.map((account) => (
              <div
                key={account.email}
                data-testid="settings-user-row"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{account.name}</span>
                    <Badge variant="outline">{tRoles(account.roleKey)}</Badge>
                    {actor?.id === account.id && <Badge variant="secondary">{t("signed_in_as")}</Badge>}
                  </span>
                  <code className="truncate font-mono text-xs text-muted-foreground">
                    {account.email}
                  </code>
                </span>
                <Button variant="outline" size="sm" disabled>
                  {t("edit_role")}
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("not_persisted")}</p>
          <Button className="mt-2" variant="outline" disabled>
            {t("invite_user")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
