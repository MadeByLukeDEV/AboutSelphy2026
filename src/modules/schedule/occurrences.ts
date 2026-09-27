import type { Locale } from "@/modules/i18n";
import {
  addDays,
  dateKey,
  isoWeekday,
  viennaToInstant,
  type LocalDate,
} from "./time";

// Pure: a plan (weekly slots + exceptions) -> concrete streams. Kept free of
// I/O so it can be tested directly.

export type Plan = {
  slots: Array<{
    id: string;
    weekday: number;
    startTime: string;
    durationMinutes: number;
    gameName: string | null;
    titleEn: string;
    titleDe: string;
  }>;
  exceptions: Array<{
    id: string;
    kind: "cancelled" | "extra";
    dateKey: string;
    slotId: string | null;
    startTime: string | null;
    durationMinutes: number | null;
    gameName: string | null;
    titleEn: string;
    titleDe: string;
    noteEn: string;
    noteDe: string;
  }>;
};

export type StreamOccurrence = {
  /** Stable per occurrence: slot id or exception id + date. */
  key: string;
  date: LocalDate;
  start: Date;
  end: Date;
  gameName: string | null;
  title: string;
  cancelled: boolean;
  note: string;
  extra: boolean;
};

/**
 * Streams from today (Vienna) for `days` days: weekly slots minus
 * cancellations, plus extra streams, sorted by start. Streams that already
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
        date,
        start,
        end: new Date(start.getTime() + slot.durationMinutes * 60_000),
        gameName: slot.gameName,
        title: text(slot.titleEn, slot.titleDe),
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
        date,
        start,
        end: new Date(start.getTime() + extra.durationMinutes! * 60_000),
        gameName: extra.gameName,
        title: text(extra.titleEn, extra.titleDe),
        cancelled: false,
        note: text(extra.noteEn, extra.noteDe),
        extra: true,
      });
    }
  }

  return result
    .filter((occurrence) => occurrence.end > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

