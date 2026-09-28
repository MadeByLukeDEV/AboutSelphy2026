import type { Metadata } from "next";
import { PageBreadcrumbs } from "@/modules/seo";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageTransition } from "@/components/motion/page-transition";
import { localeAlternates, type Locale } from "@/modules/i18n";
import { getLegal, Markdown } from "@/modules/legal";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return {
    title: t("privacyTitle"),
    description: t("privacyDescription"),
    alternates: localeAlternates(locale, "/privacy"),
    openGraph: {
      title: `${t("privacyTitle")} — AboutSelphy`,
      description: t("privacyDescription"),
      siteName: "AboutSelphy",
      type: "website",
      locale: locale === "de" ? "de_DE" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

// Privacy policy: the controller block comes from the operator details in
// /admin/legal, the text is admin-written Markdown (rendered without HTML).
// 404 until published.
export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const legal = await getLegal(locale);
  if (!legal) notFound();
  const t = await getTranslations("Legal");
  const format = await getFormatter();
  const { operator } = legal;

  return (
    <PageTransition>
      <PageBreadcrumbs locale={locale} path="/privacy" name={t("privacyTitle")} />
      <main data-enter className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-gutter pt-fluid pb-section">
        <h1 className="text-fluid-4xl font-extrabold tracking-tight">{t("privacyTitle")}</h1>
        <section aria-labelledby="controller" className="flex flex-col gap-2 rounded-2xl border bg-background/60 p-fluid">
          <h2 id="controller" className="font-bold">
            {t("controller")}
          </h2>
          <address className="not-italic text-muted-foreground">
            {operator.name}
            <br />
            {operator.street}, {operator.postalCode} {operator.city}, {operator.country}
            <br />
            <a href={`mailto:${operator.email}`} className="font-medium text-brand-text underline underline-offset-4">
              {operator.email}
            </a>
          </address>
        </section>
        <Markdown source={legal.privacy} />
        <p className="text-sm text-muted-foreground">
          {t("updated", { date: format.dateTime(legal.updatedAt, { dateStyle: "long" }) })}
        </p>
      </main>
    </PageTransition>
  );
}
