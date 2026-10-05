import { createHash } from "node:crypto";
import type { StreamOccurrence } from "../occurrences";
import { dateKey } from "../time";
import { escapeMarkdown, withMentions } from "./message";

// Pure: the upcoming streams -> one Discord event per stream day (Vienna
// date): first stream's start to last stream's end, the day's streams in
// the description with Discord timestamps (each viewer sees their own time).

export type EventTexts = {
  /** "Stream – Monday, 6 October" for a day's first stream. */
  name: (start: Date) => string;
  cancelled: string;
  /** The schedule page, last line of every description. */
  pageUrl: string;
};

export type DayEvent = {
  dayKey: string;
  name: string;
  description: string;
  start: Date;
  end: Date;
  /** Every stream of the day is cancelled. */
  cancelled: boolean;
  streams: StreamOccurrence[];
  /** What decides the event's look (text, times, covers): unchanged = not re-sent. */
  hash: string;
};

const DESCRIPTION_LIMIT = 1000;

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

function streamLine(stream: StreamOccurrence, texts: EventTexts) {
  const what =
    [
      stream.gameName ? `**${escapeMarkdown(stream.gameName)}**` : "",
      stream.title ? withMentions(stream.title) : "",
    ]
      .filter(Boolean)
      .join(" – ") || "**Live**";
  const main = `<t:${unix(stream.start)}:t>–<t:${unix(stream.end)}:t> · ${what}`;
  if (stream.cancelled) {
    return `~~${main}~~ (${texts.cancelled}${stream.note ? `: ${withMentions(stream.note)}` : ""})`;
  }
  return stream.note ? `${main}\n*${withMentions(stream.note)}*` : main;
}

function description(streams: StreamOccurrence[], texts: EventTexts) {
  const footer = `\n\n${texts.pageUrl}`;
  let body = streams.map((stream) => streamLine(stream, texts)).join("\n");
  const room = DESCRIPTION_LIMIT - footer.length;
  if (body.length > room) {
    // Cut at a line break so no markdown is left half open.
    const cut = body.lastIndexOf("\n", room - 2);
    body = `${body.slice(0, cut > 0 ? cut : room - 2)}\n…`;
  }
  return body + footer;
}

export function buildDayEvents(streams: StreamOccurrence[], texts: EventTexts): DayEvent[] {
  const days = new Map<string, StreamOccurrence[]>();
  for (const stream of streams) {
    const key = dateKey(stream.date);
    days.set(key, [...(days.get(key) ?? []), stream]);
  }
  return [...days].map(([dayKey, dayStreams]) => {
    const live = dayStreams.filter((stream) => !stream.cancelled);
    // A fully cancelled day keeps its planned times (the event is cancelled).
    const span = live.length ? live : dayStreams;
    const start = new Date(Math.min(...span.map((s) => s.start.getTime())));
    const end = new Date(Math.max(...span.map((s) => s.end.getTime())));
    const event = {
      dayKey,
      name: texts.name(start).slice(0, 100),
      description: description(dayStreams, texts),
      start,
      end,
      cancelled: live.length === 0,
      streams: dayStreams,
    };
    const hash = createHash("sha256")
      .update(
        JSON.stringify([
          event.name,
          event.description,
          start.toISOString(),
          end.toISOString(),
          event.cancelled,
          // The cover shows these too.
          dayStreams.map((s) => [s.gameCoverUrl, s.categories.map((c) => [c.name, c.color])]),
        ]),
      )
      .digest("hex");
    return { ...event, hash };
  });
}

// ─── sync plan ───────────────────────────────────────────────────────────

/** What the site remembers about an event it created (one per day). */
export type StoredEvent = {
  id: string;
  dayKey: string;
  eventId: string;
  contentHash: string;
  startAt: Date;
  cancelled: boolean;
};

export type EventAction =
  /** A day with streams and no event yet. */
  | { kind: "create"; day: DayEvent }
  /** The day changed: new name, times, description, cover. */
  | { kind: "update"; day: DayEvent; stored: StoredEvent }
  /** Every stream of the day is cancelled: cancel in Discord (once). */
  | { kind: "cancel"; day: DayEvent; stored: StoredEvent }
  /** A cancelled day has a stream again: Discord can't reopen, so replace it. */
  | { kind: "reopen"; day: DayEvent; stored: StoredEvent }
  /** The day has no streams any more and hasn't begun: delete the event. */
  | { kind: "delete"; stored: StoredEvent }
  /** Begun or over, and no longer listed: just stop tracking it. */
  | { kind: "forget"; stored: StoredEvent };

/**
 * Pure: what to do in Discord so it matches `days`. A day that has begun is
 * left alone (Discord can't move an event into the past, and it starts and
 * ends external events by itself); unchanged days do nothing.
 */
export function planEventSync(days: DayEvent[], stored: StoredEvent[], now: Date): EventAction[] {
  const byDay = new Map(stored.map((event) => [event.dayKey, event]));
  const actions: EventAction[] = [];
  for (const day of days) {
    const existing = byDay.get(day.dayKey);
    if (!existing) {
      if (!day.cancelled && day.start > now) actions.push({ kind: "create", day });
      continue;
    }
    if (existing.startAt <= now || existing.contentHash === day.hash) continue;
    if (day.cancelled) actions.push({ kind: "cancel", day, stored: existing });
    else if (existing.cancelled) actions.push({ kind: "reopen", day, stored: existing });
    else actions.push({ kind: "update", day, stored: existing });
  }
  const listed = new Set(days.map((day) => day.dayKey));
  for (const event of stored) {
    if (listed.has(event.dayKey)) continue;
    actions.push(event.startAt > now ? { kind: "delete", stored: event } : { kind: "forget", stored: event });
  }
  return actions;
}
