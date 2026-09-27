import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/modules/i18n/routing";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { env, siteUrl } from "@/lib/env";
import { getStaffSession, loginUrl } from "@/modules/auth/session";
import { canAccessDashboard } from "@/modules/auth/roles";

const handleI18n = createIntlMiddleware(routing);

const CSP_HEADER = "Content-Security-Policy";

// The staff area: not locale-prefixed, behind central auth.
function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// Runs before every matched request (Node runtime in Next 16):
// 1. A fresh nonce + CSP per request. Next reads the nonce from the
//    *request* CSP header while rendering and applies it to its own
//    scripts; layouts pass it on via `x-nonce` (next-themes).
// 2. /admin: signed-out or non-staff visitors are redirected to the central
//    login (auth.aboutselphy.com), which returns them here afterwards. This
//    is only the first gate -- admin pages and every Server Action check
//    again (src/modules/auth/guards.ts), since prefetches skip the proxy.
// 3. Public pages: locale detection/redirects ("/" → "/de" or "/en") and
//    hreflang Link headers (next-intl). next-intl copies the request headers
//    into the response it forwards, so the nonce survives.
// Static security headers (HSTS, nosniff, ...) live in next.config.ts.
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce, new URL(env().AUTH_URL).origin);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER, csp);

  let response: NextResponse;
  const { pathname, search } = request.nextUrl;

  if (isAdminPath(pathname)) {
    const session = await getStaffSession(request.cookies);
    if (!session || !canAccessDashboard(session.user.role)) {
      // Return URL from the public site URL, not request.url (the
      // container's internal address behind Traefik).
      response = NextResponse.redirect(
        loginUrl(`${siteUrl()}${pathname}${search}`),
      );
    } else {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    }
  } else {
    response = handleI18n(new NextRequest(request, { headers: requestHeaders }));
  }

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
      // need a CSP (recommended by the Next.js CSP guide). Admin pages
      // re-check auth themselves for exactly this reason.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
