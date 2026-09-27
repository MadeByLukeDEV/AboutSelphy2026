import { getTranslations } from "next-intl/server";
import { LocaleSwitcher, Link } from "@/modules/i18n";
import { ThemeToggle } from "@/modules/theme";
import { SiteNav } from "./site-nav";

// Shared header for public pages. Add new public pages to the nav here and
// to PUBLIC_PAGES (src/modules/seo/public-pages.ts) for the sitemap.
export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-gutter py-4">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-extrabold tracking-tight">
          AboutSelphy
        </Link>
        <SiteNav
          label={t("label")}
          items={[
            { href: "/", label: t("home") },
            { href: "/streams", label: t("streams") },
          ]}
        />
      </div>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
