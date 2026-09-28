import { getTranslations } from "next-intl/server";
import { Link } from "@/modules/i18n";
import { isLegalPublished } from "@/modules/legal";

// Shared footer for public pages: the legal links (once published in
// /admin/legal) and the copyright line.
export async function SiteFooter() {
  const t = await getTranslations("Legal");
  const published = await isLegalPublished();

  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-gutter py-6 text-sm text-muted-foreground">
      <p>{t("copyright", { year: new Date().getFullYear() })}</p>
      {published && (
        <nav aria-label={t("footerLabel")}>
          <ul className="flex gap-4">
            <li>
              <Link href="/imprint" className="hover:text-foreground">
                {t("imprintTitle")}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-foreground">
                {t("privacyTitle")}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </footer>
  );
}
