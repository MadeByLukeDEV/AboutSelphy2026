import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Document, Font, Image, Link, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import sharp from "sharp";
import { getFormatter, getTranslations } from "next-intl/server";
import { siteUrl } from "@/lib/env";
import { brandFontPath } from "@/lib/og-font";
import { findAsset } from "@/modules/assets";
import type { Locale } from "@/modules/i18n";
import { CHANNELS } from "@/modules/profile";
import { getMediaKit, type MediaKit } from "./service";

// The downloadable media kit: the same live data as /mediakit, laid out
// for print (A4, light background, brand green only as an accent and in
// the header band). Rendered on request by the pdf route and memoized per
// locale until the data changes.

Font.register({
  family: "Plus Jakarta Sans",
  fonts: [
    { src: brandFontPath(400), fontWeight: 400 },
    { src: brandFontPath(700), fontWeight: 700 },
    { src: brandFontPath(800), fontWeight: 800 },
  ],
});
// Words are never hyphenated (German compounds would split oddly).
Font.registerHyphenationCallback((word) => [word]);

const INK = "#0a0a0a";
const MUTED = "#5c5c5c";
const LINE = "#e5e5e5";
const BRAND = "#00ffa8";
const BRAND_TEXT = "#007a50"; // AA on white, as on the site

const s = StyleSheet.create({
  page: { fontFamily: "Plus Jakarta Sans", fontSize: 10, color: INK, paddingBottom: 44 },
  header: { backgroundColor: INK, color: "white", paddingVertical: 22, paddingHorizontal: 32, flexDirection: "row", alignItems: "center", gap: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: BRAND },
  name: { fontSize: 26, fontWeight: 800, letterSpacing: -0.5 },
  tagline: { fontSize: 10, color: "#d4d4d4", marginTop: 2, maxWidth: 300 },
  kitTitle: { fontSize: 14, fontWeight: 700, color: BRAND, textAlign: "right" },
  kitDate: { fontSize: 8, color: "#d4d4d4", textAlign: "right", marginTop: 2, marginBottom: 6 },
  headerLink: { fontSize: 8, color: BRAND, textAlign: "right", textDecoration: "none", marginTop: 2 },
  body: { paddingHorizontal: 32, paddingTop: 16, gap: 13 },
  h2: { fontSize: 13, fontWeight: 800, marginBottom: 6 },
  note: { fontSize: 8, color: MUTED },
  cards: { flexDirection: "row", gap: 12 },
  card: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 12 },
  cardTitle: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 4, borderTopWidth: 1, borderTopColor: LINE, gap: 8 },
  rowLabel: { flex: 1, color: MUTED },
  rowValue: { fontSize: 13, fontWeight: 800 },
  rowEmpty: { fontSize: 8, color: MUTED },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7 },
  item: { flexDirection: "row", gap: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: LINE },
  logo: { width: 70, height: 30, objectFit: "contain" },
  itemTitle: { fontSize: 11, fontWeight: 700 },
  text: { color: MUTED, marginTop: 1, lineHeight: 1.35 },
  link: { color: BRAND_TEXT, fontWeight: 700, textDecoration: "none" },
  price: { fontWeight: 700, width: 110, textAlign: "right" },
  footer: { position: "absolute", bottom: 16, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
});

type Texts = Awaited<ReturnType<typeof loadTexts>>;

async function loadTexts(locale: Locale) {
  const [pdf, platforms, packages, status] = await Promise.all([
    getTranslations({ locale, namespace: "MediaKit.pdf" }),
    getTranslations({ locale, namespace: "MediaKit.platforms" }),
    getTranslations({ locale, namespace: "MediaKit.packages" }),
    getTranslations({ locale, namespace: "Home.gameStatus" }),
  ]);
  return { pdf, platforms, packages, status, format: await getFormatter({ locale }) };
}

async function pngOf(data: Uint8Array, width: number) {
  return sharp(data).resize({ width, withoutEnlargement: true }).png().toBuffer();
}

function MediaKitDocument({
  kit,
  texts,
  avatar,
  logos,
  locale,
}: {
  kit: MediaKit;
  texts: Texts;
  avatar: Buffer;
  logos: Map<string, Buffer>;
  locale: Locale;
}) {
  const { pdf, platforms, packages, status, format } = texts;
  const latest = kit.stats.latest;
  const count = (value: number) =>
    format.number(value, value >= 10_000 ? { notation: "compact", maximumFractionDigits: 1 } : {});
  const metric = (label: string, key: string) => ({
    label,
    value: latest[key] ? count(Math.round(latest[key].value)) : null,
  });
  const twitch = kit.stats.twitch30d;
  const measured = twitch.streams > 0;
  const live = (label: string, value: number | null) => ({
    label,
    value: measured && value !== null ? format.number(value, { maximumFractionDigits: 1 }) : null,
  });
  const dates = Object.values(latest).map((m) => m.capturedAt.getTime());
  const asOf = dates.length
    ? format.dateTime(new Date(Math.min(...dates)), { day: "numeric", month: "long", year: "numeric" })
    : "";
  const pageUrl = `${siteUrl()}/${locale}/mediakit`;

  const cards = [
    {
      title: "Twitch",
      rows: [
        metric(platforms("followers"), "twitch/followers"),
        live(platforms("averageViewers"), twitch.averageViewers),
        live(platforms("peakViewers"), twitch.peakViewers),
        live(platforms("hoursStreamed"), measured ? twitch.hoursStreamed : null),
      ],
    },
    {
      title: "YouTube",
      rows: [
        metric(platforms("subscribers"), "youtube/subscribers"),
        metric(platforms("recentAverageViews"), "youtube/recentAverageViews"),
        metric(platforms("totalViews"), "youtube/views"),
        metric(platforms("videos"), "youtube/videos"),
      ],
    },
  ];

  return (
    <Document title={`${kit.displayName} – ${pdf("title")}`} author={kit.displayName} language={locale}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          <Image src={{ data: avatar, format: "png" }} style={s.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{kit.displayName}</Text>
            {kit.tagline ? <Text style={s.tagline}>{kit.tagline}</Text> : null}
          </View>
          <View>
            <Text style={s.kitTitle}>{pdf("title")}</Text>
            {asOf ? <Text style={s.kitDate}>{pdf("asOf", { date: asOf })}</Text> : null}
            {/* Contact lives in the header: it's where a sponsor looks, and
                it keeps the body to one page. */}
            <Link src={`${pageUrl}#inquiry`} style={s.headerLink}>
              {pdf("inquiryLink")}
            </Link>
            <Link src={CHANNELS.twitch} style={s.headerLink}>
              twitch.tv/aboutselphy
            </Link>
            <Link src={CHANNELS.youtube} style={s.headerLink}>
              {pdf("youtube")}
            </Link>
          </View>
        </View>

        <View style={s.body}>
          <View>
            <Text style={s.h2}>{pdf("audience")}</Text>
            <View style={s.cards}>
              {cards.map((card) => (
                <View key={card.title} style={s.card}>
                  <Text style={s.cardTitle}>{card.title}</Text>
                  {card.rows.map((row) => (
                    <View key={row.label} style={s.row}>
                      <Text style={s.rowLabel}>{row.label}</Text>
                      {row.value ? (
                        <Text style={s.rowValue}>{row.value}</Text>
                      ) : (
                        <Text style={s.rowEmpty}>{platforms("notMeasured")}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
            </View>
            <Text style={[s.note, { marginTop: 6 }]}>{pdf("source")}</Text>
          </View>

          {kit.games.length > 0 && (
            <View>
              <Text style={s.h2}>{pdf("games")}</Text>
              <View style={s.chips}>
                {kit.games.map((game) => (
                  <Text key={game.slug} style={s.chip}>
                    <Text style={{ fontWeight: 700 }}>{game.name}</Text>
                    <Text style={{ color: MUTED }}>{`  ${status(game.status)}`}</Text>
                  </Text>
                ))}
              </View>
            </View>
          )}

          {kit.partners.length > 0 && (
            <View>
              <Text style={s.h2}>{pdf("partners")}</Text>
              {kit.partners.map((partner) => {
                const logo = partner.logoId ? logos.get(partner.logoId) : undefined;
                return (
                  <View key={partner.id} style={s.item} wrap={false}>
                    {logo ? (
                      // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
                      <Image src={{ data: logo, format: "png" }} style={s.logo} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemTitle}>{partner.name}</Text>
                      <Text style={s.text}>{partner.description}</Text>
                      <Text style={{ marginTop: 3 }}>
                        {partner.code ? `${pdf("code")}: ${partner.code}   ` : ""}
                        <Link src={partner.url} style={s.link}>
                          {new URL(partner.url).hostname.replace(/^www\./, "")}
                        </Link>
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {kit.packages.length > 0 && (
            <View>
              <Text style={s.h2}>{pdf("packages")}</Text>
              {kit.packages.map((pkg) => (
                <View key={pkg.id} style={s.item} wrap={false}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemTitle}>{pkg.title}</Text>
                    <Text style={s.text}>{pkg.description}</Text>
                  </View>
                  <Text style={s.price}>
                    {pkg.priceFrom === null
                      ? packages("onRequest")
                      : packages("from", {
                          price: format.number(pkg.priceFrom, {
                            style: "currency",
                            currency: "EUR",
                            maximumFractionDigits: 0,
                          }),
                        })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text>{`${kit.displayName} – ${pdf("title")}`}</Text>
          <Text render={({ pageNumber, totalPages }) => pdf("page", { page: pageNumber, total: totalPages })} />
        </View>
      </Page>
    </Document>
  );
}

// Memo per locale: the PDF only changes when the data does.
const memo = new Map<Locale, { key: string; pdf: Buffer }>();

/** The media kit as a PDF in one language. */
export async function renderMediaKitPdf(locale: Locale): Promise<Buffer> {
  const kit = await getMediaKit(locale);
  const key = JSON.stringify([kit.displayName, kit.tagline, kit.stats, kit.games, kit.partners, kit.packages]);
  const cached = memo.get(locale);
  if (cached?.key === key) return cached.pdf;

  const [texts, avatarFile] = await Promise.all([
    loadTexts(locale),
    readFile(join(process.cwd(), "public/profile/avatar.png")),
  ]);
  const avatar = await pngOf(avatarFile, 200);
  const logos = new Map<string, Buffer>();
  for (const partner of kit.partners) {
    if (!partner.logoId) continue;
    const asset = await findAsset(partner.logoId);
    // WebP isn't supported by react-pdf: re-encode the stored logo as PNG.
    if (asset) logos.set(partner.logoId, await pngOf(asset.data, 280));
  }

  const pdf = await renderToBuffer(
    <MediaKitDocument kit={kit} texts={texts} avatar={avatar} logos={logos} locale={locale} />,
  );
  memo.set(locale, { key, pdf });
  return pdf;
}
