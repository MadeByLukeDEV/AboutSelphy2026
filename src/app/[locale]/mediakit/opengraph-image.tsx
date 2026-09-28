import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getFormatter, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { loadBrandFonts } from "@/lib/og-font";
import { routing, type Locale } from "@/modules/i18n";
import { getMediaKit } from "@/modules/mediakit";

// The card shown when the media kit link is shared (sponsors pass it on):
// the live headline numbers, rendered per request from the stats cache.
// Satori: flexbox only, every element needs display: flex.

export const alt = "AboutSelphy media kit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Reads the database: never at build time (no DB there).
export const dynamic = "force-dynamic";

/** Finished PNG per locale, keyed by the numbers it shows. */
const memo = new Map<Locale, { key: string; png: Promise<ArrayBuffer> }>();

const INK = "#0a0a0a";
const BRAND = "#00ffa8";
const MUTED = "#a3a3a3";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const requested = (await params).locale;
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "MediaKit.card" });
  const format = await getFormatter({ locale });
  const kit = await getMediaKit(locale);

  const count = (value: number | undefined) =>
    value === undefined
      ? "–"
      : format.number(Math.round(value), value >= 10_000 ? { notation: "compact", maximumFractionDigits: 1 } : {});
  const latest = kit.stats.latest;
  const figures = [
    { value: count(latest["twitch/followers"]?.value), label: t("twitchFollowers") },
    { value: count(latest["youtube/subscribers"]?.value), label: t("youtubeSubscribers") },
    { value: count(latest["youtube/recentAverageViews"]?.value), label: t("averageViews") },
  ];
  const dates = [latest["twitch/followers"], latest["youtube/subscribers"]]
    .filter(Boolean)
    .map((m) => m!.capturedAt.getTime());
  const asOf = dates.length
    ? format.dateTime(new Date(Math.min(...dates)), { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Rendering (satori + resvg) is the expensive part: do it once per
  // language and set of numbers, and let parallel requests share it.
  const key = JSON.stringify([kit.displayName, figures, asOf]);
  let entry = memo.get(locale);
  if (entry?.key !== key) {
    entry = { key, png: render() };
    memo.set(locale, entry);
    // A failed render must not stay cached.
    entry.png.catch(() => memo.delete(locale));
  }
  return new Response(await entry.png, {
    headers: {
      "Content-Type": contentType,
      // Browsers and Cloudflare may reuse it for 5 minutes (the sync
      // interval); after that the memo above answers without re-rendering.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });

  async function render() {
    const [fonts, avatar] = await Promise.all([
      loadBrandFonts(),
      readFile(join(process.cwd(), "public/profile/avatar.png")),
    ]);
    const image = new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: 64,
            background: INK,
            color: "white",
            fontFamily: "Plus Jakarta Sans",
            borderTop: `12px solid ${BRAND}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
            <img
              src={`data:image/png;base64,${avatar.toString("base64")}`}
              width={120}
              height={120}
              style={{ borderRadius: 999, border: `4px solid ${BRAND}` }}
              alt=""
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>
                {kit.displayName}
              </div>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: BRAND }}>{t("title")}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 56 }}>
            {figures.map((figure) => (
              <div key={figure.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", fontSize: 88, fontWeight: 800, letterSpacing: -3 }}>
                  {figure.value}
                </div>
                <div style={{ display: "flex", fontSize: 26, color: MUTED, maxWidth: 300 }}>{figure.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: MUTED }}>
            <div style={{ display: "flex" }}>{asOf ? t("asOf", { date: asOf }) : ""}</div>
            <div style={{ display: "flex", color: "white", fontWeight: 700 }}>aboutselphy.com/mediakit</div>
          </div>
        </div>
      ),
      { ...size, fonts },
    );
    return image.arrayBuffer();
  }
}
