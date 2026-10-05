import type { Locale } from "@/modules/i18n";
import type { CategoryColor } from "./schema";
import {
  addDays,
  dateKey,
  isoWeekday,
  viennaToInstant,
  type LocalDate,
} from "./time";

// Pure: a plan (weekly slots + exceptions) -> concrete streams. Kept free of
// I/O so it can be tested directly.

type Stream = {
  startTime: string;
  durationMinutes: number;
  /** A Game's name, else the Twitch category's, else null. */
  gameName: string | null;
  gameCoverUrl: string | null;
  /** For the Twitch schedule: the Game's Twitch id or the searched category. */
  twitchCategoryId: string | null;
  titleEn: string;
  titleDe: string;
  categoryIds: string[];
};

export type Plan = {
  slots: Array<Stream & { id: string; weekday: number }>;
  exceptions: Array<
    Omit<Stream, "startTime" | "durationMinutes"> & {
      id: string;
      kind: "cancelled" | "extra";
      dateKey: string;
      slotId: string | null;
      startTime: string | null;
      durationMinutes: number | null;
      noteEn: string;
      noteDe: string;
      /** extra only: cancelled but still listed, with an optional reason. */
      cancelled: boolean;
      cancelReasonEn: string;
      cancelReasonDe: string;
    }
  >;
  categories: Array<{ id: string; nameEn: string; nameDe: string; color: CategoryColor }>;
};

export type StreamOccurrence = {
  /** Stable per occurrence: slot id or exception id + date. */
  key: string;
  /** Where it comes from, so the admin can cancel or edit exactly this one. */
  source: { kind: "weekly"; slotId: string } | { kind: "once"; exceptionId: string };
  date: LocalDate;
  start: Date;
  end: Date;
  gameName: string | null;
  gameCoverUrl: string | null;
  twitchCategoryId: string | null;
  title: string;
  categories: Array<{ id: string; name: string; color: CategoryColor }>;
  cancelled: boolean;
  note: string;
  /** A one-time stream (not from the weekly plan). */
  extra: boolean;
};

/**
 * Streams from today (Vienna) for `days` days: weekly slots (cancelled ones
 * marked) plus one-time streams, sorted by start. Streams that already
 * ended are left out; one in progress stays in.
 */
export function computeOccurrences(
  plan: Plan,
  locale: Locale,
  today: LocalDate,
  days: number,
  now: Date,
): StreamOccurrence[] {
  const de = locale === "de";
  const text = (en: string, deText: string) => (de ? deText || en : en || deText);
  // Keeps the admin's category order, drops ids that no longer exist.
  const categories = (ids: string[]) =>
    plan.categories
      .filter((c) => ids.includes(c.id))
      .map((c) => ({ id: c.id, name: text(c.nameEn, c.nameDe), color: c.color }));

  const cancelled = new Map(
    plan.exceptions
      .filter((e) => e.kind === "cancelled" && e.slotId)
      .map((e) => [`${e.slotId}|${e.dateKey}`, e]),
  );

  const result: StreamOccurrence[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const key = dateKey(date);

    for (const slot of plan.slots.filter((s) => s.weekday === isoWeekday(date))) {
      const start = viennaToInstant(date, slot.startTime);
      const cancellation = cancelled.get(`${slot.id}|${key}`);
      result.push({
        key: `${slot.id}|${key}`,
        source: { kind: "weekly", slotId: slot.id },
        date,
        start,
        end: new Date(start.getTime() + slot.durationMinutes * 60_000),
        gameName: slot.gameName,
        gameCoverUrl: slot.gameCoverUrl,
        twitchCategoryId: slot.twitchCategoryId,
        title: text(slot.titleEn, slot.titleDe),
        categories: categories(slot.categoryIds),
        cancelled: Boolean(cancellation),
        note: cancellation ? text(cancellation.noteEn, cancellation.noteDe) : "",
        extra: false,
      });
    }

    for (const extra of plan.exceptions.filter(
      (e) => e.kind === "extra" && e.dateKey === key && e.startTime && e.durationMinutes,
    )) {
      const start = viennaToInstant(date, extra.startTime!);
      result.push({
        key: `${extra.id}|${key}`,
        source: { kind: "once", exceptionId: extra.id },
        date,
        start,
        end: new Date(start.getTime() + extra.durationMinutes! * 60_000),
        gameName: extra.gameName,
        gameCoverUrl: extra.gameCoverUrl,
        twitchCategoryId: extra.twitchCategoryId,
        title: text(extra.titleEn, extra.titleDe),
        categories: categories(extra.categoryIds),
        cancelled: extra.cancelled,
        // A cancelled stream shows why (if a reason was given), else its note.
        note:
          (extra.cancelled && text(extra.cancelReasonEn, extra.cancelReasonDe)) ||
          text(extra.noteEn, extra.noteDe),
        extra: true,
      });
    }
  }

  return result
    .filter((occurrence) => occurrence.end > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
