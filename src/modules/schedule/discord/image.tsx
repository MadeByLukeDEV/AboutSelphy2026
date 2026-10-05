import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadBrandFonts } from "@/lib/og-font";
import { findAsset } from "@/modules/assets";
import type { Locale } from "@/modules/i18n";
import type { CategoryColor } from "../schema";
import type { StreamOccurrence } from "../occurrences";

// The week as a PNG for the Discord message (and the admin preview /
// public /api/schedule/image). Times are Vienna time with the zone named in
// the header; Discord's text below the image shows each viewer's own time.
// Satori: flexbox only, every element needs display: flex.

const WIDTH = 1200;
const INK = "#0a0a0a";
const CARD = "#151515";
const LINE = "#262626";
const MUTED = "#a3a3a3";
const BRAND = "#00ffa8";
const RED = "#f87171";

/** Dark-background versions of the category palette (same hues as the site). */
const CHIP: Record<CategoryColor, { bg: string; fg: string }> = {
  green: { bg: "rgba(16,185,129,0.18)", fg: "#6ee7b7" },
  blue: { bg: "rgba(14,165,233,0.18)", fg: "#7dd3fc" },
  violet: { bg: "rgba(139,92,246,0.2)", fg: "#c4b5fd" },
  amber: { bg: "rgba(245,158,11,0.18)", fg: "#fcd34d" },
  rose: { bg: "rgba(244,63,94,0.18)", fg: "#fda4af" },
  slate: { bg: "rgba(100,116,139,0.25)", fg: "#cbd5e1" },
};

export type ImageTexts = {
  heading: string;
  /** "All times: Vienna (CEST)". */
  zone: string;
  cancelled: string;
  empty: string;
  footer: string;
  dayLabel: (start: Date) => string;
};

// ─── covers ──────────────────────────────────────────────────────────────

const coverCache = new Map<string, Promise<string | null>>();

/** A cover as a small PNG data URL (satori can't load relative URLs or WebP reliably). */
function coverDataUrl(url: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  let cached = coverCache.get(url);
  if (!cached) {
    cached = loadCover(url).catch(() => null);
    // A failed load (CDN hiccup, timeout) must not stick: retry next render.
    cached.then((data) => {
      if (data === null) coverCache.delete(url);
    });
    if (coverCache.size > 100) coverCache.clear();
    coverCache.set(url, cached);
  }
  return cached;
}

async function loadCover(url: string): Promise<string | null> {
  let bytes: Uint8Array | null = null;
  const media = /^\/api\/media\/([a-z0-9]{20,40})$/.exec(url);
  if (media) {
    bytes = (await findAsset(media[1]))?.data ?? null;
  } else if (url.startsWith("https://static-cdn.jtvnw.net/ttv-boxart/")) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return null;
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > 2_000_000) return null;
    bytes = buffer;
  }
  if (!bytes) return null;
  const png = await sharp(bytes, { limitInputPixels: 20_000_000 })
    .resize(144, 144, { fit: "cover", position: "top" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** One line in the image: shortened with an ellipsis (rows have a fixed height). */
function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// ─── render ──────────────────────────────────────────────────────────────

function groupByDay(streams: StreamOccurrence[], label: (d: Date) => string) {
  const days: Array<{ label: string; streams: StreamOccurrence[] }> = [];
  for (const stream of streams) {
    const day = label(stream.start);
    const last = days[days.length - 1];
    if (last?.label === day) last.streams.push(stream);
    else days.push({ label: day, streams: [stream] });
  }
  return days;
}

export async function renderScheduleImage(
  locale: Locale,
  streams: StreamOccurrence[],
  texts: ImageTexts,
): Promise<Uint8Array> {
  const time = (date: Date) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" }).format(date);
  const days = groupByDay(streams, texts.dayLabel);
  const [fonts, avatarFile, covers] = await Promise.all([
    loadBrandFonts(),
    readFile(join(process.cwd(), "public/profile/avatar.png")),
    Promise.all(streams.map((s) => coverDataUrl(s.gameCoverUrl))),
  ]);
  const avatar = await sharp(avatarFile).resize(176, 176).png().toBuffer();
  const coverOf = new Map(streams.map((s, i) => [s.key, covers[i]]));

  const height =
    56 * 2 + 10 + 130 + 40 + 60 +
    (days.length === 0 ? 160 : days.reduce((sum, day) => sum + 64 + day.streams.length * 112, 0));

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: 56,
          background: INK,
          color: "white",
          fontFamily: "Plus Jakarta Sans",
          borderTop: `10px solid ${BRAND}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28, height: 130 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
          <img
            src={`data:image/png;base64,${avatar.toString("base64")}`}
            width={96}
            height={96}
            style={{ borderRadius: 999, border: `3px solid ${BRAND}` }}
            alt=""
          />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 800, letterSpacing: -1.5 }}>AboutSelphy</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: BRAND }}>{texts.heading}</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{texts.zone}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 40, flex: 1 }}>
          {days.length === 0 ? (
            <div style={{ display: "flex", fontSize: 32, color: MUTED, marginTop: 40 }}>{texts.empty}</div>
          ) : (
            days.map((day) => (
              <div key={day.label} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 800, height: 64, alignItems: "center" }}>
                  {day.label}
                </div>
                {day.streams.map((stream) => {
                  const cover = coverOf.get(stream.key);
                  return (
                    <div
                      key={stream.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 24,
                        height: 100,
                        marginBottom: 12,
                        padding: "0 24px",
                        background: CARD,
                        border: `1px solid ${LINE}`,
                        borderRadius: 18,
                        opacity: stream.cancelled ? 0.55 : 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          // Room for 12-hour English times ("11:00 PM–12:00 AM").
                          width: 290,
                          whiteSpace: "nowrap",
                          fontSize: 27,
                          fontWeight: 800,
                          textDecoration: stream.cancelled ? "line-through" : "none",
                        }}
                      >
                        {`${time(stream.start)}–${time(stream.end)}`}
                      </div>
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Satori
                        <img src={cover} width={72} height={72} style={{ borderRadius: 12 }} alt="" />
                      ) : (
                        <div style={{ display: "flex", width: 72, height: 72, borderRadius: 12, background: LINE }} />
                      )}
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                        <div
                          style={{
                            display: "flex",
                            fontSize: 30,
                            fontWeight: 800,
                            textDecoration: stream.cancelled ? "line-through" : "none",
                          }}
                        >
                          {clip((stream.gameName ?? stream.title) || "Live", stream.categories.length ? 20 : 30)}
                        </div>
                        {stream.gameName && stream.title ? (
                          <div style={{ display: "flex", fontSize: 22, color: MUTED, whiteSpace: "nowrap" }}>{clip(stream.title, stream.categories.length ? 24 : 42)}</div>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        {stream.cancelled ? (
                          <div style={{ display: "flex", fontSize: 22, fontWeight: 800, color: RED }}>
                            {stream.note ? `${texts.cancelled}: ${stream.note.slice(0, 40)}` : texts.cancelled}
                          </div>
                        ) : null}
                        <div style={{ display: "flex", gap: 8 }}>
                          {stream.categories.slice(0, 3).map((category) => (
                            <div
                              key={category.id}
                              style={{
                                display: "flex",
                                fontSize: 18,
                                fontWeight: 700,
                                padding: "4px 12px",
                                borderRadius: 8,
                                background: CHIP[category.color].bg,
                                color: CHIP[category.color].fg,
                              }}
                            >
                              {category.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", height: 40, fontSize: 22, color: MUTED }}>
          {texts.footer}
        </div>
      </div>
    ),
    { width: WIDTH, height, fonts },
  );
  return new Uint8Array(await image.arrayBuffer());
}
