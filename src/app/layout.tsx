import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SkipToContent } from "@/components/features/skip-to-content";
import { isLocale, openGraphLocales } from "@/i18n/config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("app");

  return {
    title: t("title"),
    description: t("description"),
    keywords: ["carbon accounting", "GHG", "ESG", "ISO 14064", "Scope 1", "Scope 2", "Scope 3"],
    /*
     * The title and description above are already resolved in the active locale
     * — Korean unless the visitor changed the cookie — so the Open Graph locale
     * has to agree with them, otherwise a shared link advertises Korean copy as
     * English. Nothing derives it from Accept-Language: this product is Korean
     * first, and an English browser still gets Korean until the visitor says
     * otherwise.
     */
    openGraph: {
      title: t("title"),
      description: t("description"),
      locale: openGraphLocales[isLocale(locale) ? locale : "ko"],
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Both entries, so the browser chrome follows the theme the user picked rather
  // than staying light while the page goes dark.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved from the locale cookie by src/i18n/request.ts; defaults to Korean.
  const locale = await getLocale();

  return (
    <html lang={locale} dir="ltr" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SkipToContent />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
