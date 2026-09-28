import { getFormatter, getTranslations } from "next-intl/server";
import type { MediaEntry } from "@/modules/stats";
import { embedUrl, formatDuration } from "../embeds";
import { VideoFacade } from "./video-facade";

const PLATFORM = {
  twitch_vod: "Twitch",
  twitch_clip: "Twitch",
  youtube_video: "YouTube",
  youtube_short: "YouTube",
} as const;

export async function MediaCard({
  item,
  parentHost,
  sizes,
}: {
  item: MediaEntry;
  parentHost: string;
  sizes: string;
}) {
  const t = await getTranslations("Streams");
  const format = await getFormatter();
  const vertical = item.kind === "youtube_short";

  return (
    <article className="reveal flex flex-col gap-2">
      <VideoFacade
        embedSrc={embedUrl(item, parentHost)}
        thumbnailUrl={item.thumbnailUrl}
        title={item.title}
        playLabel={t("play", { title: item.title })}
        vertical={vertical}
        sizes={sizes}
      />
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          <a
            href={item.url}
            className="underline-offset-4 hover:underline"
            title={t("openOn", { platform: PLATFORM[item.kind] })}
          >
            {item.title}
          </a>
        </p>
        <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <time dateTime={item.publishedAt.toISOString()}>
            {format.dateTime(item.publishedAt, { dateStyle: "medium" })}
          </time>
          {!vertical && item.durationSeconds > 0 && (
            <span>{formatDuration(item.durationSeconds)}</span>
          )}
          <span>
            {t("views", { count: item.views })}
          </span>
        </p>
      </div>
    </article>
  );
}
