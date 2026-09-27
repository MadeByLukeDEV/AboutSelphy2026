import type { MediaEntry } from "@/modules/stats";

// Player URLs for the click-to-load facades. Twitch requires `parent` = the
// embedding page's hostname. YouTube uses the no-cookie domain. These three
// origins are the only ones the CSP allows in frame-src.

export function embedUrl(item: Pick<MediaEntry, "kind" | "externalId">, parentHost: string) {
  const parent = encodeURIComponent(parentHost);
  switch (item.kind) {
    case "twitch_vod":
      return `https://player.twitch.tv/?video=v${encodeURIComponent(item.externalId)}&parent=${parent}&autoplay=true`;
    case "twitch_clip":
      return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(item.externalId)}&parent=${parent}&autoplay=true`;
    case "youtube_video":
    case "youtube_short":
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.externalId)}?autoplay=1&rel=0`;
  }
}

export function channelEmbedUrl(channel: string, parentHost: string) {
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parentHost)}&autoplay=true`;
}

/** 5:08:28 / 0:47 */
export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
