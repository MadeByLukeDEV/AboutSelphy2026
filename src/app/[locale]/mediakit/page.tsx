import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { env } from "@/lib/env";
import { localeAlternates, type Locale } from "@/modules/i18n";
import { clientMessages } from "@/modules/i18n/client-messages";
import { isTurnstileConfigured, TURNSTILE_ACTION } from "@/modules/inquiries";
import { InquiryForm } from "@/modules/inquiries/components/inquiry-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/mediakit">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "MediaKit" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(locale, "/mediakit"),
    // Not indexed (and not in the sitemap or nav) until the full media kit
    // -- numbers, partners, packages -- is built. Only the form exists yet.
    robots: { index: false, follow: true },
  };
}

export default async function MediaKitPage({
  params,
}: PageProps<"/[locale]/mediakit">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("MediaKit");
  const ti = await getTranslations("Inquiry");
  const siteKey = env().TURNSTILE_SITE_KEY;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-section px-gutter pt-fluid pb-section">
      <header className="flex flex-col gap-3">
        <h1 className="text-fluid-4xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-fluid-lg text-muted-foreground">{t("intro")}</p>
      </header>

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
            <InquiryForm siteKey={siteKey} action={TURNSTILE_ACTION} nonce={nonce} />
          </NextIntlClientProvider>
        ) : (
          <p className="rounded-xl border bg-background/60 p-4">{ti("errors.unavailable")}</p>
        )}
      </section>
    </main>
  );
}
