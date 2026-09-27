import "server-only";
import { env } from "@/lib/env";
import { PlatformError } from "./errors";

// YouTube Data API v3 with an API key. Quota is 10,000 units/day; the calls
// here cost 1 unit each (channels, playlistItems, videos -- never
// search.list, which costs 100). Errors never include the key.

const TIMEOUT_MS = 10_000;
const API = "https://www.googleapis.com/youtube/v3";

export function isYoutubeConfigured() {
  return Boolean(env().YOUTUBE_API_KEY);
}

async function api<T>(resource: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}/${resource}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("key", env().YOUTUBE_API_KEY!);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new PlatformError("youtube", `${resource} failed (${res.status})`);
  return (await res.json()) as T;
}

export type ChannelStats = {
  subscribers: number | null; // null when the channel hides it
  views: number;
  videos: number;
  uploadsPlaylistId: string;
};

export async function getChannelStats(): Promise<ChannelStats> {
  const body = await api<{
    items?: Array<{
      statistics: {
        viewCount: string;
        subscriberCount?: string;
        hiddenSubscriberCount: boolean;
        videoCount: string;
      };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }>;
  }>("channels", { part: "statistics,contentDetails", id: env().YOUTUBE_CHANNEL_ID });

  const channel = body.items?.[0];
  if (!channel) throw new PlatformError("youtube", "channel not found");
  const { statistics } = channel;
  return {
    subscribers:
      statistics.hiddenSubscriberCount || !statistics.subscriberCount
        ? null
        : Number(statistics.subscriberCount),
    views: Number(statistics.viewCount),
    videos: Number(statistics.videoCount),
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  };
}

/** Average views of the latest `count` uploads (2 quota units). */
export async function getRecentAverageViews(
  uploadsPlaylistId: string,
  count = 10,
): Promise<{ average: number; videos: number }> {
  const playlist = await api<{
    items?: Array<{ contentDetails: { videoId: string } }>;
  }>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(count),
  });
  const ids = (playlist.items ?? []).map((item) => item.contentDetails.videoId);
  if (ids.length === 0) return { average: 0, videos: 0 };

  const videos = await api<{
    items?: Array<{ statistics: { viewCount?: string } }>;
  }>("videos", { part: "statistics", id: ids.join(",") });
  const views = (videos.items ?? []).map((v) => Number(v.statistics.viewCount ?? 0));
  const total = views.reduce((sum, v) => sum + v, 0);
  return { average: views.length ? total / views.length : 0, videos: views.length };
}

export type YoutubeMedia = {
  externalId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: Date;
  durationSeconds: number;
  views: number;
  isShort: boolean;
};

/** ISO 8601 duration ("PT1H2M3S") -> seconds. */
function parseIsoDuration(value: string) {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return 0;
  const [, d = "0", h = "0", m = "0", s = "0"] = match;
  return Number(d) * 86400 + Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Shorts can be up to 3 minutes; the API has no explicit "is short" flag. */
const SHORT_MAX_SECONDS = 180;

/** Latest public, embeddable uploads (2 quota units). */
export async function getLatestUploads(
  uploadsPlaylistId: string,
  count: number,
): Promise<YoutubeMedia[]> {
  const playlist = await api<{
    items?: Array<{ contentDetails: { videoId: string } }>;
  }>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(count),
  });
  const ids = (playlist.items ?? []).map((item) => item.contentDetails.videoId);
  if (ids.length === 0) return [];

  type Thumb = { url: string };
  const videos = await api<{
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        publishedAt: string;
        thumbnails: { maxres?: Thumb; standard?: Thumb; high?: Thumb; medium?: Thumb };
      };
      contentDetails: { duration: string };
      statistics: { viewCount?: string };
      status: { privacyStatus: string; embeddable: boolean };
    }>;
  }>("videos", { part: "snippet,contentDetails,statistics,status", id: ids.join(",") });

  const items = (videos.items ?? [])
    .filter((v) => v.status.privacyStatus === "public" && v.status.embeddable)
    .map((v) => {
      const t = v.snippet.thumbnails;
      const durationSeconds = parseIsoDuration(v.contentDetails.duration);
      return {
        externalId: v.id,
        title: v.snippet.title.slice(0, 200),
        url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnailUrl: (t.maxres ?? t.standard ?? t.high ?? t.medium)?.url ?? "",
        publishedAt: new Date(v.snippet.publishedAt),
        durationSeconds,
        views: Number(v.statistics.viewCount ?? 0),
        isShort: durationSeconds > 0 && durationSeconds <= SHORT_MAX_SECONDS,
      };
    })
    .filter((v) => v.thumbnailUrl);

  // Shorts: prefer the vertical thumbnail (oar2.jpg, 9:16). It's not part of
  // the documented API, so check it exists and keep the 16:9 one otherwise.
  return Promise.all(
    items.map(async (item) => {
      if (!item.isShort) return item;
      const vertical = `https://i.ytimg.com/vi/${item.externalId}/oar2.jpg`;
      try {
        const res = await fetch(vertical, {
          method: "HEAD",
          signal: AbortSignal.timeout(5_000),
          cache: "no-store",
        });
        return res.ok ? { ...item, thumbnailUrl: vertical } : item;
      } catch {
        return item;
      }
    }),
  );
}
