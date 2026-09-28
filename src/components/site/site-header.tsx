import { getTranslations } from "next-intl/server";
import { LocaleSwitcher, Link } from "@/modules/i18n";
import { ThemeToggle } from "@/modules/theme";
import { SiteNav } from "./site-nav";

// Shared header for public pages. Add new public pages to the nav here and
// to PUBLIC_PAGES (src/modules/seo/public-pages.ts) for the sitemap.
export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    // Phones: name and controls on the first row, the nav on its own row
    // below (four items don't fit next to the name). md+: one row.
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-gutter py-4">
      <Link href="/" className="order-1 font-extrabold tracking-tight">
        AboutSelphy
      </Link>
      <div className="order-2 flex items-center gap-2 md:order-3">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="order-3 w-full md:order-2 md:w-auto md:flex-1">
        <SiteNav
          label={t("label")}
          items={[
            { href: "/", label: t("home") },
            { href: "/streams", label: t("streams") },
            { href: "/schedule", label: t("schedule") },
            { href: "/mediakit", label: t("mediakit") },
          ]}
        />
      </div>
    </header>
  );
}
