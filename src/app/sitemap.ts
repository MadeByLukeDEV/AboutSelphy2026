import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { localeAlternates, routing } from "@/modules/i18n";
import { PUBLIC_PAGES } from "@/modules/seo";

// One entry per page *and* locale, each listing all language versions
// (hreflang de/en/x-default) -- the same alternates the pages emit in
// their <head>, via the same helper, so the two can't drift apart.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const absolute = (path: string) => (path === "/" ? base : `${base}${path}`);

  return PUBLIC_PAGES.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => {
      const { canonical, languages } = localeAlternates(locale, path);
      return {
        url: absolute(String(canonical)),
        changeFrequency,
        priority,
        alternates: {
          languages: Object.fromEntries(
            Object.entries(languages ?? {}).map(([lang, href]) => [
              lang,
              absolute(String(href)),
            ]),
          ),
        },
      };
    }),
  );
}
