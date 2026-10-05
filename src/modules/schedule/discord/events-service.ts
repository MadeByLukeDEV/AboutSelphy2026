import "server-only";
import { getTranslations } from "next-intl/server";
import { siteUrl } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import {
  cancelEvent,
  checkBot,
  createEvent,
  deleteEvent,
  DiscordBotError,
  isBotTokenShape,
  isSnowflake,
  updateEvent,
  type ExternalEvent,
} from "@/lib/platforms/discord-bot";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken, isTokenCipherConfigured } from "@/lib/security/token-cipher";
import type { Locale } from "@/modules/i18n";
import { CHANNELS } from "@/modules/profile";
import { scheduleIntegrationsActive } from "../integrations-guard";
import { getUpcomingStreams, SCHEDULE_DAYS } from "../service";
import { buildDayEvents, planEventSync, type DayEvent } from "./events";
import { renderEventImage } from "./event-image";

// One Discord scheduled event per stream day (Vienna date) of the next 7
// days: "Stream – <day>", at the Twitch channel, from the day's first
// stream to its last, the streams in the description, a generated cover.
// Mirrored like the Twitch segments: created, edited when the day changes,
// cancelled when every stream of the day is, deleted when the day has no
// streams any more. Started events are left alone (Discord starts and ends
// external events itself). Needs a bot (a webhook can't create events);
// its token is set in the admin and stored encrypted.

const CIPHER_PURPOSE = "discord-bot-token";
const ZONE = "Europe/Vienna";

const find = () => prisma.discordEventConnection.findUnique({ where: { id: 1 } });

// One sync at a time (an edit's after() and the cron could otherwise both
// create the same day's event). Single container: an in-process queue.
let queue: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

// ─── status and settings ─────────────────────────────────────────────────

export type DiscordEventsStatus = {
  /** TOKEN_ENCRYPTION_KEY is set (needed to store the bot token). */
  ready: boolean;
  connected: boolean;
  botName: string;
  guildId: string;
  guildName: string;
  /** The webhook's server, offered as the default when connecting. */
  suggestedGuildId: string;
  locale: Locale;
  enabled: boolean;
  events: Array<{ dayKey: string; url: string; cancelled: boolean }>;
  lastSyncedAt: string | null;
  lastError: string;
};

export async function getDiscordEventsStatus(): Promise<DiscordEventsStatus> {
  const [row, webhook, events] = await Promise.all([
    find(),
    prisma.discordSchedule.findUnique({ where: { id: 1 }, select: { guildId: true } }),
    prisma.discordScheduleEvent.findMany({ orderBy: { dayKey: "asc" } }),
  ]);
  return {
    ready: isTokenCipherConfigured(),
    connected: Boolean(row),
    botName: row?.botName ?? "",
    guildId: row?.guildId ?? "",
    guildName: row?.guildName ?? "",
    suggestedGuildId: webhook?.guildId ?? "",
    locale: (row?.locale === "en" ? "en" : "de") as Locale,
    enabled: row?.enabled ?? true,
    events: row
      ? events.map((e) => ({
          dayKey: e.dayKey,
          url: `https://discord.com/events/${row.guildId}/${e.eventId}`,
          cancelled: e.cancelled,
        }))
      : [],
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    lastError: row?.lastError ?? "",
  };
}

export class DiscordEventsSetupError extends Error {
  constructor(
    readonly code: "invalid" | "invalidToken" | "notReady" | "notConnected" | "botNotInServer" | "missingPermission",
    /** For botNotInServer / missingPermission: the bot, for an invite link. */
    readonly botId?: string,
  ) {
    super(code);
  }
}

/** Checks the bot with Discord, stores its token encrypted, then syncs. */
export async function connectDiscordEvents(input: {
  token: string;
  guildId: string;
  locale: Locale;
  connectedBy: string;
}) {
  if (!isTokenCipherConfigured()) throw new DiscordEventsSetupError("notReady");
  const token = input.token.trim().replace(/^Bot\s+/i, "");
  if (!isBotTokenShape(token)) throw new DiscordEventsSetupError("invalidToken");
  if (!isSnowflake(input.guildId)) throw new DiscordEventsSetupError("invalid");
  let bot;
  try {
    bot = await checkBot(token, input.guildId);
  } catch (error) {
    if (
      error instanceof DiscordBotError &&
      (error.code === "invalidToken" || error.code === "botNotInServer" || error.code === "missingPermission")
    ) {
      throw new DiscordEventsSetupError(error.code, error.botId);
    }
    throw error;
  }
  const data = {
    botTokenEnc: encryptToken(token, CIPHER_PURPOSE),
    botId: bot.botId,
    botName: bot.botName,
    guildId: input.guildId,
    guildName: bot.guildName,
    locale: input.locale,
    lastError: "",
    connectedBy: input.connectedBy.slice(0, 120),
  };
  await queued(async () => {
    const previous = await find();
    // Another server: the stored events belong to the old one.
    if (previous && previous.guildId !== input.guildId) await prisma.discordScheduleEvent.deleteMany();
    await prisma.discordEventConnection.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  });
  console.info("[schedule/discord-events] connected", bot.botName, "by", input.connectedBy);
  return syncDiscordEvents();
}

export async function updateDiscordEventsSettings(settings: { locale: Locale; enabled: boolean }) {
  const row = await find();
  if (!row) throw new DiscordEventsSetupError("notConnected");
  await prisma.discordEventConnection.update({ where: { id: 1 }, data: settings });
  // A language change rewrites the events (the hash covers the texts).
  return settings.enabled ? syncDiscordEvents() : "paused";
}

/** Deletes the events that haven't started yet, then forgets the bot. */
export async function disconnectDiscordEvents() {
  return queued(async () => {
    const row = await find();
    if (!row) return;
    try {
      const token = decryptToken(row.botTokenEnc, CIPHER_PURPOSE);
      const upcoming = await prisma.discordScheduleEvent.findMany({ where: { startAt: { gt: new Date() } } });
      for (const event of upcoming) await deleteEvent(token, row.guildId, event.eventId);
    } catch (error) {
      // Best effort: the bot may already be gone (token reset, kicked).
      console.warn("[schedule/discord-events] cleanup on disconnect failed", errorInfo(error));
    }
    await prisma.discordScheduleEvent.deleteMany();
    await prisma.discordEventConnection.deleteMany({ where: { id: 1 } });
  });
}

// ─── sync ────────────────────────────────────────────────────────────────

export type DiscordEventsSyncResult =
  | "notConnected"
  | "devSkipped"
  | "paused"
  | { created: number; updated: number; cancelled: number; deleted: number; error?: string };

export function syncDiscordEvents(): Promise<DiscordEventsSyncResult> {
  return queued(syncNow);
}

async function eventTexts(locale: Locale) {
  const [t, tw] = await Promise.all([
    getTranslations({ locale, namespace: "ScheduleDiscord" }),
    getTranslations({ locale, namespace: "ScheduleDiscord.event" }),
  ]);
  const dayLabel = (date: Date) =>
    new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: ZONE }).format(date);
  // CET/CEST (MEZ/MESZ) for that day: the cover shows Vienna time.
  const zone = (date: Date) => {
    const offset = new Intl.DateTimeFormat("en", { timeZone: ZONE, timeZoneName: "shortOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    return t("zone", { zone: t(offset === "GMT+2" ? "summerTime" : "winterTime") });
  };
  return {
    build: {
      name: (start: Date) => tw("name", { day: dayLabel(start) }),
      cancelled: t("cancelled"),
      pageUrl: `${siteUrl()}/${locale}/schedule`,
    },
    image: (day: DayEvent) => ({
      day: dayLabel(day.start),
      zone: zone(day.start),
      cancelled: t("cancelled"),
      more: (count: number) => tw("more", { count }),
    }),
  };
}

async function syncNow(): Promise<DiscordEventsSyncResult> {
  if (!scheduleIntegrationsActive()) return "devSkipped";
  const row = await find();
  if (!row) return "notConnected";
  if (!row.enabled) return "paused";
  const counts = { created: 0, updated: 0, cancelled: 0, deleted: 0 };

  let token: string;
  try {
    token = decryptToken(row.botTokenEnc, CIPHER_PURPOSE);
  } catch {
    // TOKEN_ENCRYPTION_KEY changed or is missing: the token must be re-entered.
    await prisma.discordEventConnection.update({ where: { id: 1 }, data: { lastError: "cantDecrypt" } });
    return { ...counts, error: "cantDecrypt" };
  }

  let firstError: string | undefined;
  const fail = (error: unknown) => {
    const code = error instanceof DiscordBotError ? error.code : "failed";
    firstError ??= code;
    console.error("[schedule/discord-events] event sync failed", code, errorInfo(error));
  };

  const now = new Date();
  const locale: Locale = row.locale === "en" ? "en" : "de";
  const texts = await eventTexts(locale);
  // Straight from the DB: a sync writing to Discord must see the latest edit.
  const streams = await getUpcomingStreams(locale, { days: SCHEDULE_DAYS, now, fresh: true });
  const days = buildDayEvents(streams, texts.build);
  const actions = planEventSync(days, await prisma.discordScheduleEvent.findMany(), now);

  const toEvent = async (day: DayEvent): Promise<ExternalEvent> => ({
    name: day.name,
    description: day.description,
    location: CHANNELS.twitch,
    start: day.start,
    end: day.end,
    image: await renderEventImage(locale, day.streams, day, texts.image(day)).catch((error) => {
      // An event without a cover beats no event.
      console.error("[schedule/discord-events] cover failed", errorInfo(error));
      return undefined;
    }),
  });
  const create = async (day: DayEvent) => {
    const eventId = await createEvent(token, row.guildId, await toEvent(day));
    const data = { eventId, contentHash: day.hash, startAt: day.start, cancelled: false };
    try {
      await prisma.discordScheduleEvent.upsert({
        where: { dayKey: day.dayKey },
        create: { dayKey: day.dayKey, ...data },
        update: data,
      });
    } catch (error) {
      // Not stored = never updated: take it back out of Discord.
      await deleteEvent(token, row.guildId, eventId).catch(() => undefined);
      throw error;
    }
    counts.created++;
  };
  const isGone = (error: unknown) => error instanceof DiscordBotError && error.code === "eventGone";

  for (const action of actions) {
    try {
      switch (action.kind) {
        case "create":
          await create(action.day);
          break;
        case "update":
          try {
            await updateEvent(token, row.guildId, action.stored.eventId, await toEvent(action.day));
          } catch (error) {
            // Deleted in Discord by hand: create it again.
            if (!isGone(error)) throw error;
            await create(action.day);
            break;
          }
          await prisma.discordScheduleEvent.update({
            where: { id: action.stored.id },
            data: { contentHash: action.day.hash, startAt: action.day.start },
          });
          counts.updated++;
          break;
        case "cancel":
          if (!action.stored.cancelled) {
            await cancelEvent(token, row.guildId, action.stored.eventId).catch((error) => {
              if (!isGone(error)) throw error;
            });
            counts.cancelled++;
          }
          await prisma.discordScheduleEvent.update({
            where: { id: action.stored.id },
            data: { contentHash: action.day.hash, cancelled: true },
          });
          break;
        case "reopen":
          await deleteEvent(token, row.guildId, action.stored.eventId);
          await create(action.day);
          break;
        case "delete":
          await deleteEvent(token, row.guildId, action.stored.eventId);
          await prisma.discordScheduleEvent.delete({ where: { id: action.stored.id } });
          counts.deleted++;
          break;
        case "forget":
          await prisma.discordScheduleEvent.delete({ where: { id: action.stored.id } });
          break;
      }
    } catch (error) {
      fail(error);
    }
  }

  await prisma.discordEventConnection.update({
    where: { id: 1 },
    data: { lastSyncedAt: new Date(), lastError: firstError ?? "" },
  });
  return { ...counts, ...(firstError ? { error: firstError } : {}) };
}
