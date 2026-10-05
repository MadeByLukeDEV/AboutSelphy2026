import { errorInfo } from "@/lib/log";
import { getScheduleImage } from "@/modules/schedule";

// GET /api/schedule/image?locale=de|en: the week as a PNG (the same image
// the Discord message carries; also the admin preview). Public, like the
// schedule page itself. Rendered once per week content and language
// (memoized), and cacheable for 5 minutes.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "de" ? "de" : "en";
  try {
    const { png } = await getScheduleImage(locale);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("[schedule/image] rendering failed", errorInfo(error));
    return new Response("The image could not be created.", { status: 503 });
  }
}
