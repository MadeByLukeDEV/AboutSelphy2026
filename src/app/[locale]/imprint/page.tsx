import type { Metadata } from "next";
import { PageBreadcrumbs } from "@/modules/seo";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { PageTransition } from "@/components/motion/page-transition";
import { localeAlternates, type Locale } from "@/modules/i18n";
import { getLegal, Markdown } from "@/modules/legal";

export async function generateMetadata({ params }: PageProps<"/[locale]/imprint">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return {
    title: t("imprintTitle"),
    description: t("imprintDescription"),
    alternates: localeAlternates(locale, "/imprint"),
    openGraph: {
      title: `${t("imprintTitle")} — AboutSelphy`,
      description: t("imprintDescription"),
      siteName: "AboutSelphy",
      type: "website",
      locale: locale === "de" ? "de_DE" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

// Impressum: built from the operator details in /admin/legal (so the
// required information is always complete and in the usual order), plus
// optional extra text. 404 until published.
export default async function ImprintPage({ params }: PageProps<"/[locale]/imprint">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const legal = await getLegal(locale);
  if (!legal) notFound();
  const t = await getTranslations("Legal");
  const format = await getFormatter();
  const { operator } = legal;

  return (
    <PageTransition>
      <PageBreadcrumbs locale={locale} path="/imprint" name={t("imprintTitle")} />
      <main data-enter className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-gutter pt-fluid pb-section">
        <h1 className="text-fluid-4xl font-extrabold tracking-tight">{t("imprintTitle")}</h1>
        <section aria-labelledby="statutory" className="flex flex-col gap-3">
          <h2 id="statutory" className="text-fluid-xl font-bold">
            {t("statutory")}
          </h2>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">{t("operator")}</dt>
            <dd className="font-medium">{operator.name}</dd>
            <dt className="text-muted-foreground">{t("address")}</dt>
            <dd>
              <address className="not-italic">
                {operator.street}
                <br />
                {operator.postalCode} {operator.city}
                <br />
                {operator.country}
              </address>
            </dd>
            <dt className="text-muted-foreground">{t("email")}</dt>
            <dd>
              <a href={`mailto:${operator.email}`} className="font-medium text-brand-text underline underline-offset-4">
                {operator.email}
              </a>
            </dd>
            {operator.phone && (
              <>
                <dt className="text-muted-foreground">{t("phone")}</dt>
                <dd>{operator.phone}</dd>
              </>
            )}
          </dl>
        </section>
        {legal.imprintExtra && <Markdown source={legal.imprintExtra} />}
        <p className="text-sm text-muted-foreground">
          {t("updated", { date: format.dateTime(legal.updatedAt, { dateStyle: "long" }) })}
        </p>
      </main>
    </PageTransition>
  );
}
