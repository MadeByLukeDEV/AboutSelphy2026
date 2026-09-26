import { getTranslations } from "next-intl/server";
import { Link } from "@/modules/i18n";
import { buttonVariants } from "@/components/ui/button";

// Rendered for notFound() inside a [locale] page (e.g. a missing entry).
// URLs that match no route at all get app/global-not-found.tsx instead.
export default async function LocaleNotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-fluid px-gutter py-section text-center">
      <p className="text-fluid-5xl font-extrabold text-brand-text">404</p>
      <h1 className="text-fluid-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Link href="/" className={buttonVariants()}>
        {t("back")}
      </Link>
    </main>
  );
}
