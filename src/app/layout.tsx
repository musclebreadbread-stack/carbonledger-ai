import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CarbonLedger AI - Enterprise GHG Management Platform",
  description:
    "AI-powered enterprise greenhouse gas (Scope 1, 2, 3) integrated management platform. ISO 14064 / GHG Protocol compliant.",
  keywords: ["carbon accounting", "GHG", "ESG", "ISO 14064", "Scope 1", "Scope 2", "Scope 3"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
