import "server-only";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { isTwitchConfigured, searchTwitchCategories } from "@/lib/platforms/twitch";
import type { Locale } from "@/modules/i18n";
import * as repo from "./repository";
import { computeOccurrences } from "./occurrences";
import type { CancelInput, CategoryInput, RestoreInput, StreamGame, StreamInput } from "./schema";
import { buildPlan, SCHEDULE_CACHE_TAG } from "./service";
import { syncDiscordSchedule } from "./discord/service";
import { syncTwitchSchedule } from "./twitch/service";
import { syncDiscordEvents } from "./discord/events-service";
import {
  addDays,
  dateKey,
  fromDbDate,
  isoWeekday,
  parseDateKey,
  toDbDate,
  viennaToday,
} from "./time";

// Admin reads (uncached) and writes. Callers check authorization first.

/** How far ahead the admin's "upcoming streams" list looks. */
const ADMIN_DAYS = 28;

type Row = {
  gameId: string | null;
  game: { name: string } | null;
  twitchCategoryId: string | null;
  twitchCategoryName: string | null;
  twitchBoxArtUrl: string | null;
};

/** The stored game columns as the form's game value. */
function gameValue(row: Row): StreamGame {
  if (row.gameId) return { kind: "game", id: row.gameId };
  if (row.twitchCategoryId && row.twitchCategoryName) {
    return {
      kind: "twitch",
      id: row.twitchCategoryId,
      name: row.twitchCategoryName,
      boxArtUrl: row.twitchBoxArtUrl ?? "",
    };
  }
  return { kind: "none" };
}

export type AdminSchedule = Awaited<ReturnType<typeof getScheduleForEdit>>;

export async function getScheduleForEdit(locale: Locale) {
  const now = new Date();
  const today = viennaToday(now);
  const [slots, exceptions, categories, games] = await Promise.all([
    repo.findSlots(),
    repo.findExceptionsBetween(toDbDate(today), toDbDate(addDays(today, 120))),
    repo.findCategories(),
    repo.findGameOptions(),
  ]);
  const occurrences = computeOccurrences(
    buildPlan(slots, exceptions, categories),
    locale,
    today,
    ADMIN_DAYS,
    now,
  );

  return {
    slots: slots.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      game: gameValue(s),
      gameName: s.game?.name ?? s.twitchCategoryName,
      titleEn: s.titleEn,
      titleDe: s.titleDe,
      active: s.active,
      categoryIds: s.categories.map((c) => c.id),
    })),
    /** One-time streams by id, for the edit dialog. */
    once: Object.fromEntries(
      exceptions
        .filter((e) => e.kind === "extra")
        .map((e) => [
          e.id,
          {
            id: e.id,
            date: dateKey(fromDbDate(e.date)),
            startTime: e.startTime ?? "19:00",
            durationMinutes: e.durationMinutes ?? 180,
            game: gameValue(e),
            titleEn: e.titleEn,
            titleDe: e.titleDe,
            noteEn: e.noteEn,
            noteDe: e.noteDe,
            categoryIds: e.categories.map((c) => c.id),
          },
        ]),
    ),
    upcoming: occurrences.map((o) => ({
      key: o.key,
      source: o.source,
      date: dateKey(o.date),
      start: o.start.toISOString(),
      end: o.end.toISOString(),
      gameName: o.gameName,
      gameCoverUrl: o.gameCoverUrl,
      title: o.title,
      categories: o.categories,
      cancelled: o.cancelled,
      note: o.note,
      extra: o.extra,
    })),
    categories: categories.map((c) => ({ id: c.id, nameEn: c.nameEn, nameDe: c.nameDe, color: c.color })),
    games,
    today: dateKey(today),
    twitchSearch: isTwitchConfigured(),
  };
}

/** Well-formed input that doesn't make sense (shown to the editor). */
export class ScheduleRuleError extends Error {
  constructor(readonly code: "weekdayMismatch" | "unknownStream" | "pastDate") {
    super(code);
  }
}

async function changed(locale: Locale) {
  revalidateTag(SCHEDULE_CACHE_TAG, { expire: 0 });
  // Update the Discord message after the response is sent: an edit in the
  // admin never waits for Discord. Skips itself when not connected, paused
  // or unchanged; the cron retries anything that fails here.
  after(() => syncDiscordSchedule().then(() => undefined));
  // Same for the Twitch schedule (skips itself when not connected/paused).
  after(() => syncTwitchSchedule().then(() => undefined));
  // And the Discord events, one per stream day (same rules).
  after(() => syncDiscordEvents().then(() => undefined));
  return getScheduleForEdit(locale);
}

const isPast = (key: string) => key < dateKey(viennaToday());

/** Add (id null) or edit a stream; the kind (weekly/once) can't change. */
export async function saveStream(locale: Locale, id: string | null, input: StreamInput) {
  const categoryIds = await repo.existingCategoryIds(input.categoryIds);
  const common = {
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    game: input.game,
    titleEn: input.titleEn,
    titleDe: input.titleDe,
    categoryIds,
  };
  if (input.repeat === "weekly") {
    const data = { ...common, weekday: input.weekday, active: input.active };
    if (id) {
      const before = (await repo.findSlots()).find((s) => s.id === id);
      await repo.updateSlot(id, data);
      // Cancellations sit on the old weekday's dates: drop the future ones,
      // or they'd silently come back if the weekday is changed back later.
      if (before && before.weekday !== input.weekday) {
        await repo.deleteSlotCancellationsFrom(id, toDbDate(viennaToday()));
      }
    } else {
      await repo.createSlot(data);
    }
  } else {
    if (isPast(input.date)) throw new ScheduleRuleError("pastDate");
    const data = {
      ...common,
      date: toDbDate(parseDateKey(input.date)),
      noteEn: input.noteEn,
      noteDe: input.noteDe,
    };
    if (id) await repo.updateOnce(id, data);
    else await repo.createOnce(data);
  }
  return changed(locale);
}

export async function removeSlot(locale: Locale, id: string) {
  await repo.deleteSlot(id);
  return changed(locale);
}

/** Deletes a one-time stream (or a stray exception) for good. */
export async function removeException(locale: Locale, id: string) {
  await repo.deleteException(id);
  return changed(locale);
}

export async function cancelStream(locale: Locale, input: CancelInput) {
  const note = { noteEn: input.noteEn, noteDe: input.noteDe };
  if (input.target === "weekly") {
    if (isPast(input.date)) throw new ScheduleRuleError("pastDate");
    const date = parseDateKey(input.date);
    const slot = (await repo.findSlots()).find((s) => s.id === input.slotId);
    if (!slot) throw new ScheduleRuleError("unknownStream");
    // The date must be one on which this weekly stream actually happens.
    if (isoWeekday(date) !== slot.weekday) throw new ScheduleRuleError("weekdayMismatch");
    await repo.cancelSlotDate({ slotId: slot.id, date: toDbDate(date), ...note });
  } else {
    const once = await repo.findException(input.exceptionId);
    if (!once || once.kind !== "extra") throw new ScheduleRuleError("unknownStream");
    if (isPast(dateKey(fromDbDate(once.date)))) throw new ScheduleRuleError("pastDate");
    // The reason has its own columns: the normal note stays untouched.
    await repo.setOnceCancelled(once.id, true, { en: note.noteEn, de: note.noteDe });
  }
  return changed(locale);
}

export async function restoreStream(locale: Locale, input: RestoreInput) {
  if (input.target === "weekly") {
    if (isPast(input.date)) throw new ScheduleRuleError("pastDate");
    const restored = await repo.restoreSlotDate(input.slotId, toDbDate(parseDateKey(input.date)));
    if (restored === 0) throw new ScheduleRuleError("unknownStream");
  } else {
    const once = await repo.findException(input.exceptionId);
    if (!once || once.kind !== "extra" || !once.cancelled) throw new ScheduleRuleError("unknownStream");
    if (isPast(dateKey(fromDbDate(once.date)))) throw new ScheduleRuleError("pastDate");
    await repo.setOnceCancelled(once.id, false);
  }
  return changed(locale);
}

export async function saveCategory(locale: Locale, id: string | null, input: CategoryInput) {
  if (id) await repo.updateCategory(id, input);
  else await repo.createCategory(input);
  return changed(locale);
}

export async function removeCategory(locale: Locale, id: string) {
  await repo.deleteCategory(id);
  return changed(locale);
}

/** Twitch categories for the game picker; empty when Twitch isn't set up. */
export async function searchCategories(query: string) {
  if (!isTwitchConfigured()) return [];
  return searchTwitchCategories(query);
}
