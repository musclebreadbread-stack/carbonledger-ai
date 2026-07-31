"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      // In production, call signUp and create company
      window.location.href = "/";
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t("register_title")}</CardTitle>
        <CardDescription>{t("register_subtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
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
            <Input id="password" type="password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirm_password")}</Label>
            <Input id="confirmPassword" type="password" required />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("creating_account") : t("create_account")}
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
