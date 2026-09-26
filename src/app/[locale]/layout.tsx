import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { AnimatedBackground } from "@/components/effects/animated-background";
import { CustomCursor } from "@/components/effects/custom-cursor";
import { ThemeProvider } from "@/modules/theme";
import { routing } from "@/modules/i18n";
import "../globals.css";

// Named "--font-sans" directly so it plugs into globals.css's
// `--font-sans: var(--font-sans)` indirection without touching that file.
// latin-ext covers German umlauts/ß.
const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

// Prerender both locales; unknown ones 404 instead of rendering on demand.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
    metadataBase: new URL(siteUrl),
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

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${fontSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <ThemeProvider>
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
