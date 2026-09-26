import { defineRouting } from "next-intl/routing";

// Locale-prefixed URLs (/de/..., /en/...) for every public page -- unlike
// the Social app's cookie-only approach, which lets search engines index
// just one language. `/` redirects by NEXT_LOCALE cookie, then
// Accept-Language, then the default. English is the default/x-default
// because sponsors and non-German visitors land on it.
export const routing = defineRouting({
  locales: ["de", "en"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
