"use client";

import { useTranslations } from "next-intl";

/**
 * Keyboard-only bypass link to the page's `<main>`.
 *
 * The dashboard shell puts a twelve-item sidebar before the content, so without
 * this a keyboard or screen-reader user tabs through the whole navigation on
 * every page before reaching anything. Visually hidden until focused, which is
 * the point: it costs sighted users nothing and is the first stop for everyone
 * else.
 *
 * Rendered from the root layout so it precedes every page, and targets
 * `#main-content` — the id the dashboard shell and the auth/landing layouts all
 * put on their `<main>`.
 */
export function SkipToContent() {
  const t = useTranslations("a11y");

  return (
    <a
      href="#main-content"
      className="sr-only z-[100] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {t("skip_to_content")}
    </a>
  );
}
