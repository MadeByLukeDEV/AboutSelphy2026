import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import sharp from "sharp";
import { loadBrandFonts } from "@/lib/og-font";
import { routing, type Locale } from "@/modules/i18n";

// Default share card for every public page (the media kit has its own):
// the channel banner, avatar, name and the site description. No database,
// only committed files. Satori: flexbox only, display: flex everywhere.

export const alt = "AboutSelphy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Only committed files, no database: render both languages once at build
// time instead of on every request (the card is ~850 KB).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const BRAND = "#00ffa8";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const requested = (await params).locale;
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const dir = join(process.cwd(), "public/profile");
  const [fonts, banner, avatar] = await Promise.all([
    loadBrandFonts(),
    // The banner PNG is ~850 KB: shrink it before embedding.
    readFile(join(dir, "banner.png")).then((b) => sharp(b).resize(1200, 630, { fit: "cover", position: "top" }).jpeg({ quality: 80 }).toBuffer()),
    readFile(join(dir, "avatar.png")).then((b) => sharp(b).resize(220, 220).png().toBuffer()),
  ]);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", fontFamily: "Plus Jakarta Sans" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
        <img
          src={`data:image/jpeg;base64,${banner.toString("base64")}`}
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, objectFit: "cover" }}
          alt=""
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(10,10,10,0) 20%, rgba(10,10,10,0.92) 72%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 64,
            right: 64,
            bottom: 56,
            alignItems: "center",
            gap: 32,
            color: "white",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori */}
          <img
            src={`data:image/png;base64,${avatar.toString("base64")}`}
            width={150}
            height={150}
            style={{ borderRadius: 999, border: `5px solid ${BRAND}` }}
            alt=""
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>AboutSelphy</div>
            <div style={{ display: "flex", fontSize: 28, color: "#e5e5e5", maxWidth: 820 }}>{t("description")}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
