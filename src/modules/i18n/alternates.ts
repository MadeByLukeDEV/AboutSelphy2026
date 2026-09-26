import type { Metadata } from "next";
import { getPathname } from "./navigation";
import { routing, type Locale } from "./routing";

type Href = Parameters<typeof getPathname>[0]["href"];

// canonical + hreflang alternates (de, en, x-default) for a public page.
// Paths are relative; the root layout's metadataBase makes them absolute.
// Every public page's generateMetadata must spread this in -- Next doesn't
// deep-merge `alternates` from the layout.
export function localeAlternates(
  locale: Locale,
  href: Href,
): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = getPathname({ locale: l, href });
  }
  // x-default is the unprefixed URL: the proxy redirects it by the
  // visitor's language, which is exactly what x-default is for. Matches the
  // hreflang Link header next-intl's middleware sends.
  const defaultPath = getPathname({ locale: routing.defaultLocale, href });
  languages["x-default"] =
    defaultPath.slice(`/${routing.defaultLocale}`.length) || "/";

  return {
    canonical: getPathname({ locale, href }),
    languages,
  };
}
