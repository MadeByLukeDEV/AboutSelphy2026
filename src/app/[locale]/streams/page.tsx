import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { env, siteUrl } from "@/lib/env";
import { localeAlternates, type Locale } from "@/modules/i18n";
import { getLiveStatus, getStreamsMedia } from "@/modules/stats";
import { CHANNELS } from "@/modules/profile";
import { LiveSection } from "@/modules/streams/components/live-section";
import { MediaSection } from "@/modules/streams/components/media-section";
import { embedUrl } from "@/modules/streams/embeds";
import { JsonLd, videoSchema } from "@/modules/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/streams">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "Streams" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(locale, "/streams"),
    openGraph: {
      title: `${t("metaTitle")} — AboutSelphy`,
      description: t("metaDescription"),
      siteName: "AboutSelphy",
      type: "website",
      locale: locale === "de" ? "de_DE" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

// Live status + the latest videos, all from the DB (synced by the stats job
// every 5 min / hourly) -- rendering never waits on Twitch or YouTube.
export default async function StreamsPage({
  params,
}: PageProps<"/[locale]/streams">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("Streams");
  const [live, media] = await Promise.all([getLiveStatus(), getStreamsMedia()]);
  const base = siteUrl();
  // Twitch embeds must name the embedding page's hostname.
  const parentHost = new URL(base).hostname;
  const channel = env().TWITCH_BROADCASTER_LOGIN;
  const youtubeChannel = CHANNELS.youtube;

  return (
    <>
      <JsonLd
        data={[...media.videos, ...media.shorts].map((video) =>
          videoSchema({
            name: video.title,
            url: video.url,
            embedUrl: embedUrl(video, parentHost),
            thumbnailUrl: video.thumbnailUrl,
            uploadDate: video.publishedAt,
            durationSeconds: video.durationSeconds,
            views: video.views,
            siteUrl: base,
          }),
        )}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-section px-gutter pt-fluid pb-section">
        <header className="flex flex-col gap-3">
          <h1 className="text-fluid-4xl font-extrabold tracking-tight">
            {t("title")}
          </h1>
          <p className="max-w-prose text-fluid-lg text-muted-foreground">
            {t("intro")}
          </p>
        </header>

        <LiveSection live={live} parentHost={parentHost} channel={channel} />

        <MediaSection
          id="vods-heading"
          title={t("vodsHeading")}
          note={t("vodsNote")}
          items={media.vods}
          parentHost={parentHost}
          moreHref={`${CHANNELS.twitch}/videos?filter=archives`}
          platform="Twitch"
        />

        <MediaSection
          id="clips-heading"
          title={t("clipsHeading")}
          items={media.clips}
          parentHost={parentHost}
          moreHref={`${CHANNELS.twitch}/clips?range=all`}
          platform="Twitch"
        />

        {(media.videos.length > 0 || media.shorts.length > 0) && (
          <section aria-labelledby="youtube-heading" className="flex flex-col gap-8">
            <h2 id="youtube-heading" className="text-fluid-2xl font-bold tracking-tight">
              {t("youtubeHeading")}
            </h2>
            <MediaSection
              id="videos-heading"
              title={t("videosHeading")}
              headingLevel={3}
              items={media.videos}
              parentHost={parentHost}
              moreHref={`${youtubeChannel}/videos`}
              platform="YouTube"
            />
            <MediaSection
              id="shorts-heading"
              title={t("shortsHeading")}
              headingLevel={3}
              items={media.shorts}
              parentHost={parentHost}
              moreHref={`${youtubeChannel}/shorts`}
              platform="YouTube"
              vertical
            />
          </section>
        )}
      </main>
    </>
  );
}
