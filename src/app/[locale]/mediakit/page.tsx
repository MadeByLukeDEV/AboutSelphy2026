import type { Metadata } from "next";
import { PageBreadcrumbs } from "@/modules/seo";
import { PageTransition } from "@/components/motion/page-transition";
import Image from "next/image";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileDown } from "lucide-react";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { localeAlternates, type Locale } from "@/modules/i18n";
import { clientMessages } from "@/modules/i18n/client-messages";
import { isTurnstileConfigured, TURNSTILE_ACTION } from "@/modules/inquiries";
import { isLegalPublished } from "@/modules/legal";
import { LazyInquiryForm } from "@/modules/inquiries/components/lazy-inquiry-form";
import {
  AudienceSummary,
  getMediaKit,
  GrowthSection,
  MediaKitGames,
  PackagesSection,
  PartnersSection,
  PlatformStats,
} from "@/modules/mediakit";
import { CHANNELS, PROFILE_IMAGES } from "@/modules/profile";
import { Demographics } from "@/modules/stats";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/mediakit">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "MediaKit" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(locale, "/mediakit"),
    // Metadata doesn't deep-merge openGraph: repeat every field. The image
    // comes from ./opengraph-image.tsx (live numbers).
    openGraph: {
      title: `${t("metaTitle")} — AboutSelphy`,
      description: t("metaDescription"),
      siteName: "AboutSelphy",
      type: "website",
      locale: locale === "de" ? "de_DE" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function MediaKitPage({
  params,
}: PageProps<"/[locale]/mediakit">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("MediaKit");
  const ti = await getTranslations("Inquiry");
  const kit = await getMediaKit(locale);
  const siteKey = env().TURNSTILE_SITE_KEY;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { avatar } = PROFILE_IMAGES;

  return (
    <PageTransition>
      <PageBreadcrumbs locale={locale} path="/mediakit" name={t("title")} />
      <main data-enter className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-section px-gutter pt-fluid pb-section">
        <header className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Image
              src={avatar.src}
              alt=""
              width={avatar.width}
              height={avatar.height}
              sizes="4rem"
              className="size-16 shrink-0 rounded-full object-cover ring-2 ring-border"
            />
            <div className="flex min-w-0 flex-col">
              <p className="font-bold">{kit.displayName}</p>
              {kit.tagline && <p className="text-sm text-muted-foreground">{kit.tagline}</p>}
            </div>
          </div>
          <h1 className="text-fluid-5xl font-extrabold tracking-[-0.04em]">{t("title")}</h1>
          <p className="max-w-prose text-fluid-lg text-muted-foreground">{t("intro")}</p>
          <div className="flex flex-wrap gap-2">
            <a href="#inquiry" className={buttonVariants({ size: "lg" })}>
              {t("inquiryCta")}
            </a>
            <a href={CHANNELS.twitch} className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              {t("twitchChannel")}
            </a>
            <a href={CHANNELS.youtube} className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
              {t("youtubeChannel")}
            </a>
            {/* A plain link: the PDF is a route handler, not a page. */}
            <a
              href={`/${locale}/mediakit/pdf`}
              download
              className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
            >
              <FileDown aria-hidden />
              {t("downloadPdf")}
            </a>
          </div>
        </header>

        <section aria-labelledby="audience-heading" className="flex flex-col gap-6">
          <h2 id="audience-heading" className="text-fluid-2xl font-bold tracking-tight">
            {t("audienceHeading")}
          </h2>
          <AudienceSummary stats={kit.stats} />
          <PlatformStats stats={kit.stats} />
        </section>

        {kit.audience && <Demographics audience={kit.audience} />}

        <GrowthSection growth={kit.growth} />

        <MediaKitGames games={kit.games} />

        <PartnersSection partners={kit.partners} />

        <PackagesSection packages={kit.packages} />

        <section id="inquiry" aria-labelledby="inquiry-heading" className="flex flex-col gap-6 scroll-mt-8">
          <div className="flex flex-col gap-2">
            <h2 id="inquiry-heading" className="text-fluid-2xl font-bold tracking-tight">
              {ti("heading")}
            </h2>
            <p className="max-w-prose text-muted-foreground">{ti("intro")}</p>
          </div>
          {siteKey && isTurnstileConfigured() ? (
            // Only this page ships the form's texts to the browser.
            <NextIntlClientProvider messages={await clientMessages(["Inquiry"])}>
              <LazyInquiryForm
                siteKey={siteKey}
                action={TURNSTILE_ACTION}
                nonce={nonce}
                privacyHref={(await isLegalPublished()) ? `/${locale}/privacy` : undefined}
              />
            </NextIntlClientProvider>
          ) : (
            <p className="rounded-xl border bg-background/60 p-4">{ti("errors.unavailable")}</p>
          )}
        </section>
      </main>
    </PageTransition>
  );
}
