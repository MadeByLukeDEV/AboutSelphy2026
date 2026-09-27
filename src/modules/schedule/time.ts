// Calendar/time helpers for the schedule. Everything is planned in
// Europe/Vienna wall-clock time; these turn it into real instants (DST aware)
// without a date library, via Intl.

export const SCHEDULE_TIME_ZONE = "Europe/Vienna";

export type LocalDate = { year: number; month: number; day: number };

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHEDULE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wallClock(instant: number) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Vienna's UTC offset in ms at a given instant (+2h in summer, +1h in winter). */
function offsetAt(instant: number) {
  const w = wallClock(instant);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant of a Vienna wall-clock time ("2026-10-24", "19:00"). */
export function viennaToInstant(date: LocalDate, time: string): Date {
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let instant = guess - offsetAt(guess);
  // Around a DST switch the offset at the result can differ from the guess.
  const corrected = guess - offsetAt(instant);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

/** Today's date in Vienna. */
export function viennaToday(now: Date = new Date()): LocalDate {
  const { year, month, day } = wallClock(now.getTime());
  return { year, month, day };
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: LocalDate) {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/** "2026-10-24" */
export function dateKey(date: LocalDate) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

export function parseDateKey(key: string): LocalDate {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

/** A @db.Date column (midnight UTC) <-> LocalDate. */
export function fromDbDate(value: Date): LocalDate {
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function toDbDate(date: LocalDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}
