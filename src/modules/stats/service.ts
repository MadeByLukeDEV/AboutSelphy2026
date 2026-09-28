import "server-only";
import { unstable_cache } from "next/cache";
import * as repo from "./repository";
import { STATS_CACHE_TAG } from "./sync";

// Read side for pages. Cached under the "stats" tag, which every sync run
// clears -- so the data is at most one sync (5 min) old. "Now"-relative
// values (is it live?) are computed outside the cache.

/**
 * Fallback expiry. revalidateTag only clears the cache in the process that
 * ran the sync -- fine in production (the Dokploy job calls the same
 * container), but any other process (a dev server, a second replica) would
 * otherwise keep its first copy forever.
 */
const CACHE_SECONDS = 300;

/** A session whose last sample is at most this old counts as live. */
const LIVE_WINDOW_MS = 11 * 60_000;

const loadLatestSession = unstable_cache(
  async () => repo.latestSession(),
  ["stats-latest-session"],
  { tags: [STATS_CACHE_TAG], revalidate: CACHE_SECONDS },
);

export type LiveStatus =
  | { live: false }
  | { live: true; title: string; gameName: string; since: Date };

export async function getLiveStatus(): Promise<LiveStatus> {
  const session = await loadLatestSession();
  if (!session) return { live: false };
  // unstable_cache round-trips through JSON: dates come back as strings.
  const lastSeenAt = new Date(session.lastSeenAt);
  if (Date.now() - lastSeenAt.getTime() > LIVE_WINDOW_MS) return { live: false };
  return {
    live: true,
    title: session.title,
    gameName: session.gameName,
    since: new Date(session.startedAt),
  };
}

export type MetricValue = { value: number; capturedAt: Date };

export type StatsOverview = {
  /** Latest value per "platform/metric", e.g. "twitch/followers". */
  latest: Record<string, MetricValue>;
  /** Twitch broadcasts in the last 30 days, from our own viewer samples. */
  twitch30d: {
    streams: number;
    hoursStreamed: number;
    averageViewers: number | null;
    peakViewers: number | null;
    /** Earliest session in the window: the numbers only cover sampling since then. */
    since: Date | null;
  };
};

const loadOverview = unstable_cache(
  async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const [snapshots, sessions] = await Promise.all([
      repo.latestSnapshots(),
      repo.sessionsSince(since),
    ]);
    return {
      snapshots: snapshots.map((s) => ({
        key: `${s.platform}/${s.metric}`,
        value: s.value,
        capturedAt: s.capturedAt.toISOString(),
      })),
      sessions: sessions.map((s) => ({
        startedAt: s.startedAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        peakViewers: s.peakViewers,
        // BigInt isn't JSON-serializable; viewer sums fit a double easily.
        viewerSum: Number(s.viewerSum),
        sampleCount: s.sampleCount,
      })),
    };
  },
  ["stats-overview"],
  { tags: [STATS_CACHE_TAG], revalidate: CACHE_SECONDS },
);

export async function getStatsOverview(): Promise<StatsOverview> {
  const { snapshots, sessions } = await loadOverview();

  const latest: Record<string, MetricValue> = {};
  for (const s of snapshots) {
    latest[s.key] = { value: s.value, capturedAt: new Date(s.capturedAt) };
  }

  const samples = sessions.reduce((sum, s) => sum + s.sampleCount, 0);
  const viewerSum = sessions.reduce((sum, s) => sum + s.viewerSum, 0);
  // Each sample stands for ~5 minutes of broadcast; a session spans from its
  // start to its last sample.
  const hours = sessions.reduce(
    (sum, s) =>
      sum + (new Date(s.lastSeenAt).getTime() - new Date(s.startedAt).getTime()) / 3_600_000,
    0,
  );

  return {
    latest,
    twitch30d: {
      streams: sessions.length,
      hoursStreamed: Math.round(hours * 10) / 10,
      // Time-weighted: every 5-minute sample counts equally.
      averageViewers: samples ? Math.round((viewerSum / samples) * 10) / 10 : null,
      peakViewers: sessions.length ? Math.max(...sessions.map((s) => s.peakViewers)) : null,
      since: sessions.length
        ? new Date(sessions[sessions.length - 1].startedAt)
        : null,
    },
  };
}

export type MediaEntry = {
  kind: "twitch_vod" | "twitch_clip" | "youtube_video" | "youtube_short";
  externalId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: Date;
  durationSeconds: number;
  views: number;
};

const loadMedia = unstable_cache(
  async () => {
    const [vods, clips, videos, shorts] = await Promise.all([
      repo.mediaByKind("twitch_vod", 6),
      repo.mediaByKind("twitch_clip", 6),
      repo.mediaByKind("youtube_video", 6),
      repo.mediaByKind("youtube_short", 8),
    ]);
    const plain = (items: typeof vods) =>
      items.map((item) => ({
        kind: item.kind,
        externalId: item.externalId,
        title: item.title,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        publishedAt: item.publishedAt.toISOString(),
        durationSeconds: item.durationSeconds,
        views: item.views,
      }));
    return {
      vods: plain(vods),
      clips: plain(clips),
      videos: plain(videos),
      shorts: plain(shorts),
    };
  },
  ["stats-media"],
  { tags: [STATS_CACHE_TAG], revalidate: CACHE_SECONDS },
);

/** Videos for the Streams page, from the DB (synced hourly). */
export async function getStreamsMedia() {
  const media = await loadMedia();
  const revive = (items: (typeof media)["vods"]): MediaEntry[] =>
    items.map((item) => ({ ...item, publishedAt: new Date(item.publishedAt) }));
  return {
    vods: revive(media.vods),
    clips: revive(media.clips),
    videos: revive(media.videos),
    shorts: revive(media.shorts),
  };
}

/** Metrics with a growth chart (cumulative audience counts). */
const GROWTH_METRICS = [
  { platform: "twitch", metric: "followers" },
  { platform: "youtube", metric: "subscribers" },
] as const;

export type GrowthKey = `${(typeof GROWTH_METRICS)[number]["platform"]}/${(typeof GROWTH_METRICS)[number]["metric"]}`;

/** Daily points ("YYYY-MM-DD" in Vienna, last value of that day). */
export type GrowthSeries = Record<GrowthKey, Array<{ day: string; value: number }>>;

const loadGrowth = unstable_cache(
  async (days: number) => {
    const since = new Date(Date.now() - days * 24 * 60 * 60_000);
    const rows = await repo.dailyValues([...GROWTH_METRICS], since);
    return rows.map((r) => ({ key: `${r.platform}/${r.metric}`, day: r.day, value: r.value }));
  },
  ["stats-growth"],
  { tags: [STATS_CACHE_TAG], revalidate: CACHE_SECONDS },
);

/** Growth over the last `days` days, one point per day, oldest first. */
export async function getGrowthSeries(days = 90): Promise<GrowthSeries> {
  const series = Object.fromEntries(
    GROWTH_METRICS.map((m) => [`${m.platform}/${m.metric}`, []]),
  ) as unknown as GrowthSeries;
  for (const row of await loadGrowth(days)) {
    series[row.key as GrowthKey]?.push({ day: row.day, value: row.value });
  }
  return series;
}
