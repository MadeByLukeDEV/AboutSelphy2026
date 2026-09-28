import "server-only";
import type { Locale } from "@/modules/i18n";
import { getHomeContent } from "@/modules/profile";
import {
  getGrowthSeries,
  getStatsOverview,
  type GrowthSeries,
  type StatsOverview,
} from "@/modules/stats";

// Composes the media kit from other modules' read sides: numbers from
// `stats` (never fetched here, never typed in by hand), name, tagline and
// games from `profile`. Everything underneath is cached by those modules.

/** A growth chart needs this many daily points before it's shown. */
export const MIN_GROWTH_DAYS = 7;

/** Categories a sponsor should see: what's streamed now or soon-ish. */
const CURRENT_GAME_STATUSES = new Set(["main", "regular", "occasional", "new"]);

export type MediaKit = {
  displayName: string;
  tagline: string;
  stats: StatsOverview;
  growth: GrowthSeries;
  games: Awaited<ReturnType<typeof getHomeContent>>["games"];
};

export async function getMediaKit(locale: Locale): Promise<MediaKit> {
  const [content, stats, growth] = await Promise.all([
    getHomeContent(locale),
    getStatsOverview(),
    getGrowthSeries(90),
  ]);
  return {
    displayName: content.displayName,
    tagline: content.tagline,
    stats,
    growth,
    games: content.games.filter((game) => CURRENT_GAME_STATUSES.has(game.status)),
  };
}
