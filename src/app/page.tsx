import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/features/locale-switcher";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  const features = [
    { title: t("feature_iso_title"), description: t("feature_iso_desc") },
    { title: t("feature_ai_title"), description: t("feature_ai_desc") },
    { title: t("feature_mrv_title"), description: t("feature_mrv_desc") },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-carbon-50 to-ocean-50 dark:from-carbon-950 dark:to-ocean-950">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <main className="mx-auto max-w-4xl px-4 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-foreground">{tApp("name")}</h1>
        <p className="mb-8 text-xl text-muted-foreground">{t("tagline")}</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {/*
            Points at the dashboard index (/dashboard), not `/`. `/` is this
            landing page; the dashboard lives under the (dashboard) route group
            at /dashboard. src/proxy.ts bounces anonymous visitors to /login.
          */}
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            {t("get_started")}
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {t("create_account")}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {tAuth("login")}
          </Link>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
