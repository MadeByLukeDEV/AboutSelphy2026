import "server-only";
import { createHash } from "node:crypto";
import { siteUrl } from "@/lib/env";
import type { Locale } from "@/modules/i18n";
import { PROFILE_IMAGES } from "@/modules/profile";
import { getUpcomingStreams, SCHEDULE_DAYS } from "./service";
import { dateKey, SCHEDULE_TIME_ZONE } from "./time";

/**
 * The public schedule as JSON (GET /api/schedule), for the Twitch panel
 * extension (../extension). The same streams the schedule page shows, with
 * only public fields: no admin ids, no Twitch category id, no "extra" flag
 * (the page doesn't label one-time streams either, the user's call).
 * Bump `version` when a field changes meaning or goes away.
 */
export type PublicSchedule = {
  version: 1;
  locale: Locale;
  timeZone: string;
  generatedAt: string;
  /** The schedule page in this language. */
  url: string;
  avatarUrl: string;
  streams: Array<{
    /** Stable per stream (a hash, so no database ids leave the site). */
    key: string;
    /** Vienna calendar date (YYYY-MM-DD), the page's day headings. */
    date: string;
    start: string;
    end: string;
    gameName: string | null;
    /** A 128 px wide cover through our image optimizer, or null. */
    coverUrl: string | null;
    /** May contain @twitchname mentions (plain text; render as text). */
    title: string;
    categories: Array<{ name: string; color: string }>;
    cancelled: boolean;
    /** Public note, or the cancel reason for a cancelled stream. */
    note: string;
  }>;
};

// Images go through next/image's optimizer, so a client on another origin
// (the extension) only loads from this domain, small and as AVIF/WebP. The
// sources are the ones images.localPatterns/remotePatterns already allow.
function optimized(src: string, width: number) {
  return `${siteUrl()}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

export async function getPublicSchedule(locale: Locale, now = new Date()): Promise<PublicSchedule> {
  const streams = await getUpcomingStreams(locale, { days: SCHEDULE_DAYS, now });
  return {
    version: 1,
    locale,
    timeZone: SCHEDULE_TIME_ZONE,
    generatedAt: now.toISOString(),
    url: `${siteUrl()}/${locale}/schedule`,
    avatarUrl: optimized(PROFILE_IMAGES.avatar.src, 96),
    streams: streams.map((stream) => ({
      key: createHash("sha256").update(stream.key).digest("base64url").slice(0, 16),
      date: dateKey(stream.date),
      start: stream.start.toISOString(),
      end: stream.end.toISOString(),
      gameName: stream.gameName,
      coverUrl: stream.gameCoverUrl ? optimized(stream.gameCoverUrl, 128) : null,
      title: stream.title,
      categories: stream.categories.map(({ name, color }) => ({ name, color })),
      cancelled: stream.cancelled,
      note: stream.note,
    })),
  };
}
