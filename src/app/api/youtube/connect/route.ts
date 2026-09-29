import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import {
  isYoutubeAnalyticsConfigured,
  OAUTH_COOKIE,
  OAUTH_COOKIE_MAX_AGE,
  OAUTH_COOKIE_PATH,
  startConnect,
} from "@/modules/stats";

export const dynamic = "force-dynamic";

// "Connect YouTube" in /admin/stats links here (a plain link: the CSP's
// form-action doesn't allow Google, and a navigation needs no exception).
// Admin only -- /api is outside the proxy, so this route checks itself.
// Sets the state + PKCE verifier cookie and sends the admin to Google.
export async function GET() {
  const back = (outcome: string) =>
    NextResponse.redirect(`${siteUrl()}/admin/stats?youtube=${outcome}#youtube-analytics`, 303);
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return back("forbidden");
    throw error;
  }
  if (!isYoutubeAnalyticsConfigured()) return back("notConfigured");

  const { url, cookie } = startConnect();
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: siteUrl().startsWith("https://"),
    // Lax: Google's redirect back is a top-level GET navigation.
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
