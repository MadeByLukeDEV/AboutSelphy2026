import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import type { MediaKit } from "../service";
import { CopyCode } from "./copy-code";

// Partners and packages on /mediakit. Each section is left out while it
// has nothing visible, so an empty admin list never shows a stub.

/** Brands AboutSelphy works with. Links are rel="sponsored" (Google's rule
 * for paid and referral links) and open in a new tab. */
export async function PartnersSection({ partners }: { partners: MediaKit["partners"] }) {
  const t = await getTranslations("MediaKit.partners");
  if (partners.length === 0) return null;

  return (
    <section aria-labelledby="partners-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="partners-heading" className="text-fluid-2xl font-bold tracking-tight">
          {t("heading")}
        </h2>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {partners.map((partner) => (
          <li key={partner.id} className="reveal flex flex-col gap-4 rounded-2xl border bg-background/60 p-fluid">
            <div className="flex min-h-12 items-center gap-4">
              {partner.logoUrl ? (
                // Logos keep their own shape; the box only caps the size.
                <span className="relative flex h-12 w-28 shrink-0 items-center">
                  <Image
                    src={partner.logoUrl}
                    alt={t("logoAlt", { name: partner.name })}
                    fill
                    sizes="7rem"
                    className="object-contain object-left"
                  />
                </span>
              ) : null}
              <h3 className="text-fluid-xl font-bold">{partner.name}</h3>
            </div>
            <p className="text-muted-foreground">{partner.description}</p>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              {partner.code && (
                <span className="flex items-center gap-2 text-sm">
                  {t("code")}
                  <CopyCode code={partner.code} copyLabel={t("copy")} copiedLabel={t("copied")} />
                </span>
              )}
              <a
                href={partner.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-brand-text underline-offset-4 hover:underline"
              >
                {t("visit", { name: partner.name })}
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sponsorship offers, each with a "from" price or "price on request". */
export async function PackagesSection({ packages }: { packages: MediaKit["packages"] }) {
  const t = await getTranslations("MediaKit.packages");
  const format = await getFormatter();
  if (packages.length === 0) return null;

  return (
    <section aria-labelledby="packages-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="packages-heading" className="text-fluid-2xl font-bold tracking-tight">
          {t("heading")}
        </h2>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </div>
      <ul className="flex flex-col divide-y border-y">
        {packages.map((pkg) => (
          <li key={pkg.id} className="reveal flex flex-col gap-2 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
            <div className="flex max-w-prose flex-col gap-1">
              <h3 className="text-fluid-lg font-bold">{pkg.title}</h3>
              <p className="whitespace-pre-line text-muted-foreground">{pkg.description}</p>
            </div>
            <p className="shrink-0 font-semibold sm:text-right">
              {pkg.priceFrom === null
                ? t("onRequest")
                : t("from", {
                    price: format.number(pkg.priceFrom, {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }),
                  })}
            </p>
          </li>
        ))}
      </ul>
      <a href="#inquiry" className="w-fit font-semibold text-brand-text underline-offset-4 hover:underline">
        {t("ask")}
      </a>
    </section>
  );
}
