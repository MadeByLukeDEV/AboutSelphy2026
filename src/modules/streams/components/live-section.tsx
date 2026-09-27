import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import type { LiveStatus } from "@/modules/stats";
import { PROFILE_IMAGES, CHANNELS } from "@/modules/profile";
import { channelEmbedUrl } from "../embeds";
import { VideoFacade } from "./video-facade";

// Live: a click-to-load player for the channel (poster = the banner, since
// the live thumbnail isn't stored). Offline: a short note and a follow link.
export async function LiveSection({
  live,
  parentHost,
  channel,
}: {
  live: LiveStatus;
  parentHost: string;
  channel: string;
}) {
  const t = await getTranslations("Streams");

  if (!live.live) {
    return (
      <section
        aria-labelledby="live-heading"
        className="flex flex-col gap-3 rounded-2xl border bg-background/60 p-fluid sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col gap-1">
          <h2 id="live-heading" className="text-fluid-xl font-bold">
            {t("offlineHeading")}
          </h2>
          <p className="text-muted-foreground">{t("offlineText")}</p>
        </div>
        <a href={CHANNELS.twitch} className={buttonVariants({ size: "lg" })}>
          {t("followOnTwitch")}
        </a>
      </section>
    );
  }

  return (
    <section aria-labelledby="live-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="live-heading" className="flex items-center gap-2 text-fluid-2xl font-bold">
          <span className="size-3 rounded-full bg-red-500" aria-hidden />
          {t("liveHeading")}
        </h2>
        <p className="text-muted-foreground">
          {live.gameName}: {live.title}
        </p>
      </div>
      <VideoFacade
        embedSrc={channelEmbedUrl(channel, parentHost)}
        thumbnailUrl={PROFILE_IMAGES.banner.src}
        title={live.title}
        playLabel={t("playLive")}
        sizes="(min-width: 72rem) 72rem, 100vw"
        preload
      />
    </section>
  );
}
