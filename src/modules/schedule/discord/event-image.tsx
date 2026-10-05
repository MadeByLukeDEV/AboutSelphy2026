import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadBrandFonts } from "@/lib/og-font";
import type { Locale } from "@/modules/i18n";
import type { StreamOccurrence } from "../occurrences";
import { BRAND, CARD, CHIP, clip, coverDataUrl, INK, LINE, MUTED, RED } from "./image";

// The cover of one stream day's Discord event: 1200x480, Discord's 2.5:1
// event cover. A header with the avatar, the day and its time span (Vienna,
// zone named), then up to three streams as cards. Same look as the week
// image. Satori: flexbox only, every element needs display: flex.

const WIDTH = 1200;
const HEIGHT = 480;
const MAX_CARDS = 3;

export type EventImageTexts = {
  /** "Monday, 6 October". */
  day: string;
  /** "Vienna time (CEST)". */
  zone: string;
  cancelled: string;
  /** "+2 more". */
  more: (count: number) => string;
};

export async function renderEventImage(
  locale: Locale,
  streams: StreamOccurrence[],
  span: { start: Date; end: Date; cancelled: boolean },
  texts: EventImageTexts,
): Promise<Uint8Array> {
  const time = (date: Date) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" }).format(date);
  const shown = streams.slice(0, MAX_CARDS);
  const [fonts, avatarFile, covers] = await Promise.all([
    loadBrandFonts(),
    readFile(join(process.cwd(), "public/profile/avatar.png")),
    Promise.all(shown.map((s) => coverDataUrl(s.gameCoverUrl))),
  ]);
  const avatar = await sharp(avatarFile).resize(176, 176).png().toBuffer();
  // Characters per line: the cards get narrower with more streams.
  const room = shown.length === 1 ? 44 : shown.length === 2 ? 19 : 11;
  const hidden = streams.length - shown.length;

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "40px 48px 44px",
          background: INK,
          color: "white",
          fontFamily: "Plus Jakarta Sans",
          borderTop: `10px solid ${BRAND}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
          <img
            src={`data:image/png;base64,${avatar.toString("base64")}`}
            width={96}
            height={96}
            style={{ borderRadius: 999, border: `3px solid ${BRAND}` }}
            alt=""
          />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>AboutSelphy</div>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: BRAND, letterSpacing: -1 }}>
              {clip(texts.day, 30)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            {span.cancelled ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  fontWeight: 800,
                  color: RED,
                  padding: "6px 18px",
                  borderRadius: 12,
                  border: `2px solid ${RED}`,
                }}
              >
                {texts.cancelled}
              </div>
            ) : (
              <div style={{ display: "flex", fontSize: 38, fontWeight: 800, whiteSpace: "nowrap" }}>
                {`${time(span.start)}–${time(span.end)}`}
              </div>
            )}
            <div style={{ display: "flex", fontSize: 20, color: MUTED }}>{texts.zone}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {shown.map((stream, i) => {
            const cover = covers[i];
            const category = stream.categories[0];
            return (
              <div
                key={stream.key}
                style={{
                  display: "flex",
                  flex: 1,
                  alignItems: "center",
                  gap: 18,
                  height: 200,
                  padding: "0 22px",
                  background: CARD,
                  border: `1px solid ${LINE}`,
                  borderRadius: 20,
                  opacity: stream.cancelled ? 0.55 : 1,
                  overflow: "hidden",
                }}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Satori
                  <img src={cover} width={128} height={128} style={{ borderRadius: 16 }} alt="" />
                ) : (
                  <div style={{ display: "flex", width: 128, height: 128, borderRadius: 16, background: LINE }} />
                )}
                <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 22,
                      fontWeight: 800,
                      color: stream.cancelled ? RED : BRAND,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stream.cancelled ? texts.cancelled : `${time(stream.start)}–${time(stream.end)}`}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 30,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      textDecoration: stream.cancelled ? "line-through" : "none",
                    }}
                  >
                    {clip((stream.gameName ?? stream.title) || "Live", room)}
                  </div>
                  {stream.gameName && stream.title ? (
                    <div style={{ display: "flex", fontSize: 22, color: MUTED, whiteSpace: "nowrap" }}>
                      {clip(stream.title, room + 6)}
                    </div>
                  ) : null}
                  {category ? (
                    <div style={{ display: "flex" }}>
                      <div
                        style={{
                          display: "flex",
                          fontSize: 16,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 8,
                          background: CHIP[category.color].bg,
                          color: CHIP[category.color].fg,
                        }}
                      >
                        {clip(category.name, room)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {hidden > 0 ? (
            <div style={{ display: "flex", alignItems: "center", padding: "0 18px", fontSize: 24, fontWeight: 800, color: MUTED }}>
              {texts.more(hidden)}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, fonts },
  );
  return new Uint8Array(await image.arrayBuffer());
}
