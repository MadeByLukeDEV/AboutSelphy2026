import "server-only";
import { unstable_cache } from "next/cache";
import { assetUrl } from "@/modules/assets";
import type { Locale } from "@/modules/i18n";
import * as repo from "./repository";
import { computeOccurrences, type StreamOccurrence } from "./occurrences";
import { addDays, dateKey, fromDbDate, parseDateKey, toDbDate, viennaToday } from "./time";

export const SCHEDULE_CACHE_TAG = "schedule";

/** How far ahead the public schedule and JSON-LD look. */
export const SCHEDULE_DAYS = 7;

// Same rule as the profile module: an uploaded cover wins over Twitch art.
function coverUrl(game: { boxArtUrl: string | null; customCoverId: string | null } | null) {
  if (!game) return null;
  return game.customCoverId ? assetUrl(game.customCoverId) : game.boxArtUrl;
}

// Raw plan data, cached (JSON-safe). Occurrences are computed per request
// from it, because "upcoming" depends on the current time. Edits clear the
// tag; the fallback expiry covers other processes (see CLAUDE.md).
const loadPlan = unstable_cache(
  async (fromKey: string, toKey: string) => {
    const [slots, exceptions] = await Promise.all([
      repo.findSlots(),
      repo.findExceptionsBetween(
        toDbDate(parseDateKey(fromKey)),
        toDbDate(parseDateKey(toKey)),
      ),
    ]);
    return {
      slots: slots
        .filter((slot) => slot.active)
        .map((slot) => ({
          id: slot.id,
          weekday: slot.weekday,
          startTime: slot.startTime,
          durationMinutes: slot.durationMinutes,
          gameName: slot.game?.name ?? null,
          gameCoverUrl: coverUrl(slot.game),
          titleEn: slot.titleEn,
          titleDe: slot.titleDe,
        })),
      exceptions: exceptions.map((e) => ({
        id: e.id,
        kind: e.kind,
        dateKey: dateKey(fromDbDate(e.date)),
        slotId: e.slotId,
        startTime: e.startTime,
        durationMinutes: e.durationMinutes,
        gameName: e.game?.name ?? null,
        gameCoverUrl: coverUrl(e.game),
        titleEn: e.titleEn,
        titleDe: e.titleDe,
        noteEn: e.noteEn,
        noteDe: e.noteDe,
      })),
    };
  },
  ["schedule-plan"],
  { tags: [SCHEDULE_CACHE_TAG], revalidate: 600 },
);

export type { StreamOccurrence } from "./occurrences";

/**
 * Streams from today (Vienna) for `days` days: weekly slots minus
 * cancellations, plus extra streams, sorted by start. Streams that already
 * ended are left out; one in progress stays in.
 */
export async function getUpcomingStreams(
  locale: Locale,
  { days = SCHEDULE_DAYS, now = new Date() }: { days?: number; now?: Date } = {},
): Promise<StreamOccurrence[]> {
  const today = viennaToday(now);
  const plan = await loadPlan(dateKey(today), dateKey(addDays(today, days - 1)));
  return computeOccurrences(plan, locale, today, days, now);
}

/** The next stream that isn't cancelled (possibly one in progress). */
export async function getNextStream(locale: Locale, now = new Date()) {
  const upcoming = await getUpcomingStreams(locale, { now });
  return upcoming.find((occurrence) => !occurrence.cancelled) ?? null;
}
