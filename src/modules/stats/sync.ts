import "server-only";
import { revalidateTag } from "next/cache";
import { PlatformError } from "@/lib/platforms/errors";
import {
  getFollowerTotal,
  getLiveStream,
  getRecentVods,
  getTopClips,
  isTwitchConfigured,
} from "@/lib/platforms/twitch";
import {
  getChannelStats,
  getLatestUploads,
  getRecentAverageViews,
  isYoutubeConfigured,
} from "@/lib/platforms/youtube";
import { env } from "@/lib/env";
import { fillMissingGameArt } from "@/modules/profile";
import * as repo from "./repository";

// The sync job behind POST /api/cron/stats (Dokploy schedule, every 5
// minutes) and the "Sync now" button in /admin/stats. Each step fails on its
// own -- one API being down doesn't stop the others -- and the run's outcome
// is stored in SyncRun for the admin status view.

export const STATS_CACHE_TAG = "stats";

const MINUTE = 60_000;
/** Snapshots of slow-moving numbers (followers, subscribers) at most hourly. */
const HOURLY = 55 * MINUTE;
/** Recent-video averages daily (2 YouTube quota units). */
const DAILY = 23 * 60 * MINUTE;
/** A live sample counts only if the previous one is at least this old. */
const MIN_SAMPLE_GAP = 4 * MINUTE;

export type SyncTrigger = "cron" | "manual";

export type SyncResult = {
  ok: boolean;
  skipped?: "already-running";
  steps: string[];
};

async function isDue(platform: "twitch" | "youtube", metric: string, every: number) {
  const last = await repo.latestSnapshot(platform, metric);
  return !last || Date.now() - last.capturedAt.getTime() >= every;
}

async function sampleTwitchLive(now: Date): Promise<string> {
  const stream = await getLiveStream();
  if (!stream) return "twitch: offline";

  const existing = await repo.findSession(stream.id);
  if (!existing) {
    await repo.createSession({ ...stream, viewers: stream.viewerCount, now });
    return `twitch: live, new session (${stream.viewerCount} viewers)`;
  }
  const countSample =
    now.getTime() - existing.lastSeenAt.getTime() >= MIN_SAMPLE_GAP;
  await repo.updateSession(stream.id, {
    title: stream.title,
    gameName: stream.gameName,
    viewers: stream.viewerCount,
    now,
    countSample,
  });
  return `twitch: live (${stream.viewerCount} viewers${countSample ? "" : ", sample skipped: too soon"})`;
}

async function snapshotTwitch(): Promise<string> {
  if (!(await isDue("twitch", "followers", HOURLY))) return "twitch followers: fresh";
  const followers = await getFollowerTotal();
  await repo.insertSnapshots([{ platform: "twitch", metric: "followers", value: followers }]);
  return `twitch followers: ${followers}`;
}

async function snapshotYoutube(): Promise<string> {
  const channelDue = await isDue("youtube", "subscribers", HOURLY);
  const averageDue = await isDue("youtube", "recentAverageViews", DAILY);
  if (!channelDue && !averageDue) return "youtube: fresh";

  const channel = await getChannelStats();
  const rows: Array<{ platform: "youtube"; metric: string; value: number }> = [];
  if (channelDue) {
    rows.push({ platform: "youtube", metric: "views", value: channel.views });
    rows.push({ platform: "youtube", metric: "videos", value: channel.videos });
    if (channel.subscribers !== null) {
      rows.push({ platform: "youtube", metric: "subscribers", value: channel.subscribers });
    }
  }
  if (averageDue) {
    const recent = await getRecentAverageViews(channel.uploadsPlaylistId, 10);
    rows.push({ platform: "youtube", metric: "recentAverageViews", value: recent.average });
  }
  await repo.insertSnapshots(rows);
  return `youtube: ${rows.map((r) => `${r.metric}=${Math.round(r.value)}`).join(", ")}`;
}

// Videos for the Streams page, hourly. The "mediaItems" snapshot (value =
// item count) doubles as the "last synced" marker.
async function syncTwitchMedia(): Promise<string> {
  if (!(await isDue("twitch", "mediaItems", HOURLY))) return "twitch media: fresh";
  const [vods, clips] = await Promise.all([getRecentVods(12), getTopClips(12)]);
  await repo.replaceMedia("twitch_vod", vods);
  await repo.replaceMedia("twitch_clip", clips);
  await repo.insertSnapshots([
    { platform: "twitch", metric: "mediaItems", value: vods.length + clips.length },
  ]);
  return `twitch media: ${vods.length} VODs, ${clips.length} clips`;
}

async function syncYoutubeMedia(): Promise<string> {
  if (!(await isDue("youtube", "mediaItems", HOURLY))) return "youtube media: fresh";
  // A channel's uploads playlist is its id with "UC" replaced by "UU" --
  // saves a channels.list call.
  const uploads = `UU${env().YOUTUBE_CHANNEL_ID.slice(2)}`;
  const items = await getLatestUploads(uploads, 30);
  const videos = items.filter((i) => !i.isShort);
  const shorts = items.filter((i) => i.isShort);
  await repo.replaceMedia("youtube_video", videos);
  await repo.replaceMedia("youtube_short", shorts);
  await repo.insertSnapshots([
    { platform: "youtube", metric: "mediaItems", value: items.length },
  ]);
  return `youtube media: ${videos.length} videos, ${shorts.length} shorts`;
}

async function step(name: string, run: () => Promise<string>, steps: string[]) {
  try {
    steps.push(await run());
    return true;
  } catch (error) {
    // PlatformError messages are safe to store; anything else is logged in
    // full server-side and stored generically.
    if (error instanceof PlatformError) {
      steps.push(`${name} failed: ${error.message}`);
    } else {
      console.error(`[stats] ${name} failed`, error);
      steps.push(`${name} failed: unexpected error (see server log)`);
    }
    return false;
  }
}

export async function runSync(trigger: SyncTrigger): Promise<SyncResult> {
  // Two overlapping runs could double-count a live sample; the running-run
  // check plus MIN_SAMPLE_GAP keeps that from happening.
  if (await repo.runningRun(2 * MINUTE)) {
    return { ok: true, skipped: "already-running", steps: [] };
  }

  const run = await repo.startRun(trigger);
  const now = new Date();
  const steps: string[] = [];
  let ok = true;

  if (isTwitchConfigured()) {
    ok = (await step("twitch live", () => sampleTwitchLive(now), steps)) && ok;
    ok = (await step("twitch snapshot", snapshotTwitch, steps)) && ok;
    ok = (await step("twitch media", syncTwitchMedia, steps)) && ok;
    ok = (await step("game covers", fillMissingGameArt, steps)) && ok;
  } else {
    steps.push("twitch: not configured");
  }

  if (isYoutubeConfigured()) {
    ok = (await step("youtube snapshot", snapshotYoutube, steps)) && ok;
    ok = (await step("youtube media", syncYoutubeMedia, steps)) && ok;
  } else {
    steps.push("youtube: not configured");
  }

  await repo.finishRun(run.id, ok, steps.join("; "));
  revalidateTag(STATS_CACHE_TAG, { expire: 0 });
  return { ok, steps };
}
