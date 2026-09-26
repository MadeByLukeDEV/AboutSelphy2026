import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/modules/i18n/routing";

const handleI18n = createIntlMiddleware(routing);

// Runs before every matched request (Node runtime in Next 16). For now:
// locale detection/redirects for public pages ("/" → "/de" or "/en") and
// hreflang Link headers. Security headers and the /admin auth gate come
// next.
export function proxy(request: NextRequest) {
  return handleI18n(request);
}

export const config = {
  // Everything except API routes, the (future) admin area, Next internals
  // and files with an extension (favicon.ico, robots.txt, images...).
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
