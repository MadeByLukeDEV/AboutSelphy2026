import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import {
  canConnectTwitch,
  startTwitchConnect,
  TWITCH_OAUTH_COOKIE,
  TWITCH_OAUTH_COOKIE_MAX_AGE,
  TWITCH_OAUTH_COOKIE_PATH,
} from "@/modules/schedule/twitch/service";

export const dynamic = "force-dynamic";

// "Connect Twitch" in /admin/schedule links here (a plain link: the CSP's
// form-action doesn't allow Twitch, and a navigation needs no exception).
// Admin only -- /api is outside the proxy, so this route checks itself.
// Sets the state cookie and sends the admin to Twitch's consent screen.
export async function GET() {
  const back = (outcome: string) =>
    NextResponse.redirect(`${siteUrl()}/admin/schedule?twitch=${outcome}#twitch-heading`, 303);
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return back("forbidden");
    throw error;
  }
  if (!canConnectTwitch()) return back("notConfigured");

  const { url, state } = startTwitchConnect();
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(TWITCH_OAUTH_COOKIE, state, {
    httpOnly: true,
    secure: siteUrl().startsWith("https://"),
    // Lax: Twitch's redirect back is a top-level GET navigation.
    sameSite: "lax",
    path: TWITCH_OAUTH_COOKIE_PATH,
    maxAge: TWITCH_OAUTH_COOKIE_MAX_AGE,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
