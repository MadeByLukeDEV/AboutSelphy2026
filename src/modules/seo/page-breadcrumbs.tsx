import { getTranslations } from "next-intl/server";
import { siteUrl } from "@/lib/env";
import type { Locale } from "@/modules/i18n";
import { JsonLd } from "./json-ld";
import { breadcrumbSchema } from "./schemas";

// BreadcrumbList JSON-LD for a page one level below home. Render it outside
// <main data-enter>: inside, the <script> would become main's first child
// and take the "move, don't fade" slot meant for the first real section.
export async function PageBreadcrumbs({ locale, path, name }: { locale: Locale; path: string; name: string }) {
  const t = await getTranslations({ locale, namespace: "Nav" });
  const base = `${siteUrl()}/${locale}`;
  return (
    <JsonLd
      data={breadcrumbSchema([
        { name: t("home"), url: base },
        { name, url: `${base}${path}` },
      ])}
    />
  );
}
