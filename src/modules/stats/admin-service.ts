import "server-only";
import { env } from "@/lib/env";
import { isTwitchConfigured } from "@/lib/platforms/twitch";
import { isYoutubeConfigured } from "@/lib/platforms/youtube";
import { recentRuns } from "./repository";

// Uncached: the status view must show the current state of the sync.
export async function getSyncStatus() {
  const runs = await recentRuns(10);
  return {
    configured: {
      cron: Boolean(env().CRON_SECRET),
      twitch: isTwitchConfigured(),
      youtube: isYoutubeConfigured(),
    },
    runs: runs.map((run) => ({
      id: String(run.id),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      ok: run.ok,
      summary: run.summary,
      trigger: run.trigger,
    })),
  };
}
