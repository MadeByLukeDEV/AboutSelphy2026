import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { AnimatedBackground } from "@/components/effects/animated-background";
import { CustomCursor } from "@/components/effects/custom-cursor";
import { ThemeProvider } from "@/modules/theme";
import { routing } from "@/modules/i18n";
import { siteUrl } from "@/lib/env";
import { fontSans } from "../fonts";
import "../globals.css";


// No generateStaticParams: every page renders per request because the CSP
// nonce is per request (decision 2026-09-26, see src/lib/security/csp.ts).
// Keep data fetching cached so this stays fast.

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });

  // metadataBase turns every page's relative canonical/hreflang/OG URLs
  // into absolute ones. These are site-wide defaults; pages set their own
  // title and alternates (see localeAlternates).
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("title"), template: "%s — AboutSelphy" },
    description: t("description"),
    openGraph: {
      siteName: "AboutSelphy",
      type: "website",
      locale: locale === "de" ? "de_DE" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  // Set by src/proxy.ts. Next applies it to its own scripts automatically;
  // next-themes' pre-paint inline script needs it passed explicitly.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${fontSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <ThemeProvider nonce={nonce}>
            <AnimatedBackground />
            <CustomCursor />
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
