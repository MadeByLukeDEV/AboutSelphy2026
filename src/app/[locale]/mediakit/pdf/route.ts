import { hasLocale } from "next-intl";
import { routing } from "@/modules/i18n";
import { renderMediaKitPdf } from "@/modules/mediakit/pdf";

// GET /{locale}/mediakit/pdf: the media kit as a downloadable PDF, built
// from the same live data as the page (memoized until the data changes).
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });

  try {
    const pdf = await renderMediaKitPdf(locale);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="AboutSelphy-${locale === "de" ? "Mediakit" : "Media-Kit"}.pdf"`,
        "Cache-Control": "public, max-age=300",
        // The page is the canonical version; the PDF shouldn't compete in search.
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    console.error("[mediakit] PDF rendering failed", error instanceof Error ? error.name : typeof error);
    return new Response("The PDF could not be created. Please try again later.", { status: 503 });
  }
}
