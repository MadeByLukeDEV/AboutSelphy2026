import "server-only";
import { unstable_cache } from "next/cache";
import { assetUrl } from "@/modules/assets";
import type { Locale } from "@/modules/i18n";
import * as repo from "./repository";
import { computeOccurrences, type Plan, type StreamOccurrence } from "./occurrences";
import { addDays, dateKey, fromDbDate, parseDateKey, toDbDate, viennaToday } from "./time";

export const SCHEDULE_CACHE_TAG = "schedule";

/** How far ahead the public schedule and JSON-LD look. */
export const SCHEDULE_DAYS = 7;

type StreamRow = Awaited<ReturnType<typeof repo.findSlots>>[number];
type ExceptionRow = Awaited<ReturnType<typeof repo.findExceptionsBetween>>[number];

// A Game wins (uploaded cover over Twitch art, as in the profile module);
// otherwise the Twitch category picked by search.
function gameOf(row: StreamRow | ExceptionRow) {
  if (row.game) {
    return {
      gameName: row.game.name,
      gameCoverUrl: row.game.customCoverId ? assetUrl(row.game.customCoverId) : row.game.boxArtUrl,
    };
  }
  return { gameName: row.twitchCategoryName, gameCoverUrl: row.twitchBoxArtUrl };
}

/** DB rows -> the JSON-safe plan computeOccurrences works on. */
export function buildPlan(
  slots: StreamRow[],
  exceptions: ExceptionRow[],
  categories: Awaited<ReturnType<typeof repo.findCategories>>,
  { includeInactive = false } = {},
): Plan {
  return {
    slots: slots
      .filter((slot) => includeInactive || slot.active)
      .map((slot) => ({
        id: slot.id,
        weekday: slot.weekday,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        ...gameOf(slot),
        titleEn: slot.titleEn,
        titleDe: slot.titleDe,
        categoryIds: slot.categories.map((c) => c.id),
      })),
    exceptions: exceptions.map((e) => ({
      id: e.id,
      kind: e.kind,
      dateKey: dateKey(fromDbDate(e.date)),
      slotId: e.slotId,
      startTime: e.startTime,
      durationMinutes: e.durationMinutes,
      ...gameOf(e),
      titleEn: e.titleEn,
      titleDe: e.titleDe,
      noteEn: e.noteEn,
      noteDe: e.noteDe,
      cancelled: e.cancelled,
      cancelReasonEn: e.cancelReasonEn,
      cancelReasonDe: e.cancelReasonDe,
      categoryIds: e.categories.map((c) => c.id),
    })),
    categories: categories.map((c) => ({ id: c.id, nameEn: c.nameEn, nameDe: c.nameDe, color: c.color })),
  };
}

// Raw plan data, cached (JSON-safe). Occurrences are computed per request
// from it, because "upcoming" depends on the current time. Edits clear the
// tag; the fallback expiry covers other processes (see CLAUDE.md).
const loadPlan = unstable_cache(
  async (fromKey: string, toKey: string): Promise<Plan> => {
    const [slots, exceptions, categories] = await Promise.all([
      repo.findSlots(),
      repo.findExceptionsBetween(toDbDate(parseDateKey(fromKey)), toDbDate(parseDateKey(toKey))),
      repo.findCategories(),
    ]);
    return buildPlan(slots, exceptions, categories);
  },
  ["schedule-plan-v2"],
  { tags: [SCHEDULE_CACHE_TAG], revalidate: 600 },
);

export type { StreamOccurrence } from "./occurrences";

/**
 * Streams from today (Vienna) for `days` days: weekly streams (cancelled
 * ones marked) plus one-time streams, sorted by start. Streams that already
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
