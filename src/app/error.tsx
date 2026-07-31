"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Localised error boundary for every route below the root layout.
 *
 * Next 16 renamed the recovery callback: the prop is `unstable_retry`, not the
 * `reset` of earlier versions. Naming it `reset` here would silently give
 * `undefined` and a retry button that throws on click.
 *
 * The root layout still renders, so `useTranslations` resolves against the active
 * locale and this page comes back in Korean by default — unlike the built-in
 * error screen it replaces.
 */
export default function GlobalRouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("error_pages");

  React.useEffect(() => {
    // No error reporting service is wired up; the digest is the only handle a
    // user can quote, so it is both logged and shown.
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center"
    >
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("error_title")}</h1>
      <p className="max-w-md text-muted-foreground">{t("error_body")}</p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          {t("digest", { digest: error.digest })}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => unstable_retry()}>{t("retry")}</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">{t("go_dashboard")}</Link>
        </Button>
      </div>
    </main>
  );
}
