import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  const users = [
    `admin@company.com (${t("role_company_admin")})`,
    `reviewer@company.com (${t("role_reviewer")})`,
    `auditor@company.com (${t("role_auditor")})`,
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle>{t("company_profile")}</CardTitle>
          <CardDescription>{t("company_profile_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("company_name")}</Label>
              <Input defaultValue={t("sample_company")} />
            </div>
            <div className="space-y-2">
              <Label>{t("industry")}</Label>
              <Input defaultValue={t("sample_industry")} />
            </div>
            <div className="space-y-2">
              <Label>{t("country")}</Label>
              <Input defaultValue={t("sample_country")} />
            </div>
            <div className="space-y-2">
              <Label>{t("registration_number")}</Label>
              <Input defaultValue="123-45-67890" />
            </div>
          </div>
          <Button>{t("save_changes")}</Button>
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
            <Label>{t("active_provider")}</Label>
            <select className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="korea_moe_2023">{t("provider_korea_moe_2023")}</option>
              <option value="ipcc_2006">{t("provider_ipcc_2006")}</option>
              <option value="defra_2023">{t("provider_defra_2023")}</option>
            </select>
          </div>
          <Button variant="outline">{t("apply_all")}</Button>
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
            {users.map((user, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{user}</span>
                <Button variant="outline" size="sm">
                  {t("edit_role")}
                </Button>
              </div>
            ))}
          </div>
          <Button className="mt-4" variant="outline">
            {t("invite_user")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
