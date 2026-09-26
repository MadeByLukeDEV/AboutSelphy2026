import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { AnimatedBackground } from "@/components/effects/animated-background";
import { CustomCursor } from "@/components/effects/custom-cursor";
import { ThemeProvider } from "@/modules/theme";
import { routing } from "@/modules/i18n";
import { env } from "@/lib/env";
import "../globals.css";

// Named "--font-sans" directly so it plugs into globals.css's
// `--font-sans: var(--font-sans)` indirection without touching that file.
// latin-ext covers German umlauts/ß.
const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

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
    metadataBase: new URL(env().NEXT_PUBLIC_SITE_URL),
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
