import { errorInfo } from "@/lib/log";
import { getPublicSchedule } from "@/modules/schedule";

// GET /api/schedule?locale=de|en: the upcoming week as JSON, for the Twitch
// panel extension (../extension). Public and read-only, like the schedule
// page. The plan is cached under the `schedule` tag; "upcoming" is computed
// per request. Clients may cache for 2 minutes.
export const dynamic = "force-dynamic";

// Any origin may read it: the data is public, there are no cookies or
// credentials involved, and the extension's origin
// (https://<client-id>.ext-twitch.tv) differs per extension and version.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
} as const;

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "de" ? "de" : "en";
  try {
    return Response.json(await getPublicSchedule(locale), {
      headers: {
        ...CORS,
        "Cache-Control": "public, max-age=120, s-maxage=120",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("[schedule/json] failed", errorInfo(error));
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { ...CORS, "Cache-Control": "no-store" } },
    );
  }
}

// A plain GET needs no preflight; this answers clients that send one anyway.
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
