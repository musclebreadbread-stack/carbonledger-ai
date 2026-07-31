import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Localised 404.
 *
 * Without this file Next renders its own built-in not-found page, which is
 * hard-coded English — so the one screen a Korean visitor is most likely to hit
 * by accident was the one screen that ignored the default locale.
 *
 * Deliberately no `loading.tsx` sibling at the app root: a Suspense fallback at
 * this level starts streaming the response, and a streamed 404 cannot carry a 404
 * status code (see the Next.js `loading.js` "Status Codes" notes). Keeping this
 * segment non-streaming is what preserves the real status for crawlers and for
 * the routing E2E spec that asserts it.
 */
export default async function NotFound() {
  const t = await getTranslations("error_pages");

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center"
    >
      <p className="font-mono text-sm font-medium text-muted-foreground">HTTP 404</p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("not_found_title")}</h1>
      <p className="max-w-md text-muted-foreground">{t("not_found_body")}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          {t("go_dashboard")}
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {t("go_home")}
        </Link>
      </div>
    </main>
  );
}
