import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/modules/i18n/routing";
import { buildCsp, createNonce } from "@/lib/security/csp";

const handleI18n = createIntlMiddleware(routing);

const CSP_HEADER = "Content-Security-Policy";

// Paths that are not locale-prefixed public pages. They still get the CSP.
// /admin gets its auth gate here once central auth is integrated.
function isOutsideI18n(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// Runs before every matched request (Node runtime in Next 16):
// 1. A fresh nonce + CSP per request. Next reads the nonce from the
//    *request* CSP header while rendering and applies it to its own
//    scripts; the layout passes it on via `x-nonce` (next-themes).
// 2. Locale detection/redirects for public pages ("/" → "/de" or "/en")
//    and hreflang Link headers (next-intl). next-intl copies the request
//    headers into the response it forwards, so the nonce survives.
// Static security headers (HSTS, nosniff, ...) live in next.config.ts.
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER, csp);

  const response = isOutsideI18n(request.nextUrl.pathname)
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : handleI18n(new NextRequest(request, { headers: requestHeaders }));

  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except API routes, Next internals, generated icons
      // (/icon/32, /apple-icon: no file extension, but not pages) and
      // files with an extension (robots.txt, sitemap.xml, images...).
      // No backslashes in here: the production build turned `\\.` into a
      // plain "." and `.*\\..*` then excluded every path except "/", so no
      // page got the CSP. Use a character class ([.]) instead, and re-check
      // the CSP on a production build after any matcher change.
      source: "/((?!api|_next|_vercel|icon/|apple-icon|.*[.].*).*)",
      // Skip next/link prefetches: they don't render HTML, so they don't
      // need a CSP (recommended by the Next.js CSP guide).
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
