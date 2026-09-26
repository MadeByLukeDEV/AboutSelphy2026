import { cookies, headers } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

// Public pages get their locale from the [locale] segment. Routes outside
// it (the future /admin) have none, so fall back to the NEXT_LOCALE cookie
// and then Accept-Language -- the Social app's behavior. Only those routes
// pay for reading cookies/headers; [locale] pages stay static.
async function detectLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  if (hasLocale(routing.locales, cookieLocale)) return cookieLocale;

  const preferred = ((await headers()).get("accept-language") ?? "")
    .split(",")
    .map((part) => part.split(";")[0]!.trim().split("-")[0]!.toLowerCase());
  return preferred.find((lang) => hasLocale(routing.locales, lang)) ??
    routing.defaultLocale;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : await detectLocale();

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // Explicit: otherwise next-intl uses the server's zone, which is UTC in
    // the Docker container but local time on a dev machine -- schedule and
    // stream times would differ between dev and production.
    timeZone: "Europe/Vienna",
  };
});
