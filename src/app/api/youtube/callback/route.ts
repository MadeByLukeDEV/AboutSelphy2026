import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { completeConnect, OAUTH_COOKIE, OAUTH_COOKIE_PATH } from "@/modules/stats";

export const dynamic = "force-dynamic";

// Google's redirect after the consent screen (registered redirect URI:
// <NEXT_PUBLIC_SITE_URL>/api/youtube/callback). Admin only; the state
// cookie from /api/youtube/connect must match. The outcome goes back to
// /admin/stats as a code, never an error message from Google.
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(OAUTH_COOKIE)?.value;
  let outcome: string;
  try {
    const session = await requireAdmin();
    outcome = await completeConnect({
      params: request.nextUrl.searchParams,
      cookie,
      connectedBy: session.user.name,
    });
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    outcome = "forbidden";
  }
  console.info("[youtube-analytics] callback:", outcome);

  const response = NextResponse.redirect(
    `${siteUrl()}/admin/stats?youtube=${outcome}#youtube-analytics`,
    303,
  );
  // Single use: the state and verifier are spent either way.
  response.cookies.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
