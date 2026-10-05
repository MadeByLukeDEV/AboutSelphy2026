import "server-only";
import { createHash } from "node:crypto";
import { getFormatter, getTranslations } from "next-intl/server";
import { siteUrl } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import {
  DiscordError,
  editWebhookMessage,
  getWebhookInfo,
  parseWebhookUrl,
  postWebhookMessage,
} from "@/lib/platforms/discord";
import { decryptToken, encryptToken, isTokenCipherConfigured } from "@/lib/security/token-cipher";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/modules/i18n";
import { getUpcomingStreams, SCHEDULE_DAYS } from "../service";
import { addDays, dateKey, isoWeekday, viennaToday, viennaToInstant } from "../time";
import { renderScheduleImage } from "./image";
import { scheduleIntegrationsActive } from "../integrations-guard";
import { buildScheduleEmbed } from "./message";

// The schedule in Discord: one message (embed + image) that is edited
// whenever the week changes -- after every schedule edit, and from the cron
// (which also catches the daily roll-over). Admin settings live in
// DiscordSchedule; the webhook URL is encrypted and never leaves the server.

const CIPHER_PURPOSE = "discord-webhook";
const IMAGE_NAME = "schedule.png";

// ─── content ─────────────────────────────────────────────────────────────

async function weekContent(locale: Locale) {
  const [t, format, streams] = await Promise.all([
    getTranslations({ locale, namespace: "ScheduleDiscord" }),
    getFormatter({ locale }),
    getUpcomingStreams(locale, { days: SCHEDULE_DAYS }),
  ]);
  const today = viennaToday();
  const range = format.dateTimeRange(
    viennaToInstant(today, "12:00"),
    viennaToInstant(addDays(today, SCHEDULE_DAYS - 1), "12:00"),
    { day: "numeric", month: "long" },
  );
  const dayLabel = (start: Date) => format.dateTime(start, { weekday: "long", day: "numeric", month: "long" });
  // CET/CEST (MEZ/MESZ) from the current offset: the image shows Vienna time.
  const offset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Vienna", timeZoneName: "shortOffset" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value;
  const summer = offset === "GMT+2";
  const pageUrl = `${siteUrl()}/${locale}/schedule`;

  const { embed, hash } = buildScheduleEmbed(
    streams,
    {
      title: t("title", { range }),
      empty: t("empty"),
      cancelled: t("cancelled"),
      footer: pageUrl.replace(/^https?:\/\//, ""),
      dayLabel,
    },
    pageUrl,
  );
  return {
    embed,
    hash: createHash("sha256").update(`${locale}|${hash}`).digest("hex"),
    image: () =>
      renderScheduleImage(locale, streams, {
        heading: t("heading", { range }),
        zone: t("zone", { zone: t(summer ? "summerTime" : "winterTime") }),
        cancelled: t("cancelled"),
        empty: t("empty"),
        footer: pageUrl.replace(/^https?:\/\//, ""),
        dayLabel,
      }),
  };
}

// Rendered images per locale + content, shared by the public route, the
// admin preview and the sync (in-flight renders are shared too).
const imageMemo = new Map<string, Promise<Uint8Array>>();

/** The current week as a PNG (memoized until the week changes). */
export async function getScheduleImage(locale: Locale) {
  const content = await weekContent(locale);
  let png = imageMemo.get(content.hash);
  if (!png) {
    if (imageMemo.size > 6) imageMemo.clear();
    png = content.image();
    imageMemo.set(content.hash, png);
    png.catch(() => imageMemo.delete(content.hash));
  }
  return { png: await png, hash: content.hash, embed: content.embed };
}

// ─── settings ────────────────────────────────────────────────────────────

const find = () => prisma.discordSchedule.findUnique({ where: { id: 1 } });

export type DiscordStatus = {
  /** TOKEN_ENCRYPTION_KEY is set (needed to store the webhook). */
  ready: boolean;
  connected: boolean;
  webhookName: string;
  channelId: string;
  guildId: string;
  locale: Locale;
  autoUpdate: boolean;
  weeklyPost: boolean;
  pingRoleId: string;
  /** When the next weekly post goes out (ISO), while it's switched on. */
  nextWeeklyPost: string | null;
  /** Link to the posted message in Discord, once there is one. */
  messageUrl: string | null;
  lastSyncedAt: string | null;
  lastError: string;
};

export async function getDiscordStatus(): Promise<DiscordStatus> {
  const row = await find();
  return {
    ready: isTokenCipherConfigured(),
    connected: Boolean(row),
    webhookName: row?.webhookName ?? "",
    channelId: row?.channelId ?? "",
    guildId: row?.guildId ?? "",
    locale: (row?.locale === "en" ? "en" : "de") as Locale,
    autoUpdate: row?.autoUpdate ?? true,
    weeklyPost: row?.weeklyPost ?? false,
    pingRoleId: row?.pingRoleId ?? "",
    nextWeeklyPost: row?.weeklyPost ? nextWeeklyPost(row.weeklyPostWeek).toISOString() : null,
    messageUrl:
      row?.messageId && row.guildId && row.channelId
        ? `https://discord.com/channels/${row.guildId}/${row.channelId}/${row.messageId}`
        : null,
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    lastError: row?.lastError ?? "",
  };
}

export class DiscordSetupError extends Error {
  constructor(readonly code: "invalid" | "invalidUrl" | "invalidWebhook" | "notReady" | "notConnected") {
    super(code);
  }
}

/** Checks the webhook with Discord, stores it encrypted, and posts once. */
export async function connectDiscord(url: string, locale: Locale, connectedBy: string) {
  if (!isTokenCipherConfigured()) throw new DiscordSetupError("notReady");
  const parsed = parseWebhookUrl(url);
  if (!parsed) throw new DiscordSetupError("invalidUrl");
  let info;
  try {
    info = await getWebhookInfo(parsed.url);
  } catch (error) {
    if (error instanceof DiscordError && error.code === "invalidWebhook") throw new DiscordSetupError("invalidWebhook");
    throw error;
  }
  if (info.id !== parsed.id) throw new DiscordSetupError("invalidWebhook");
  const data = {
    webhookUrlEnc: encryptToken(parsed.url, CIPHER_PURPOSE),
    webhookId: info.id,
    webhookName: info.name,
    channelId: info.channelId,
    guildId: info.guildId,
    locale,
    // A new webhook (maybe another channel): start a fresh message.
    messageId: null,
    contentHash: null,
    lastError: "",
    connectedBy: connectedBy.slice(0, 120),
  };
  // Through the sync queue: a sync already running could otherwise write
  // the old webhook's message id onto the new row.
  const save = queue.then(() =>
    prisma.discordSchedule.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data }),
  );
  queue = save.catch(() => undefined);
  await save;
  // No post on connect (the user's rule): the first message comes from
  // "Post new message" or the Monday post.
  return "noMessage" as const;
}

export async function disconnectDiscord() {
  // The message in Discord stays; it just isn't updated any more.
  await prisma.discordSchedule.deleteMany({ where: { id: 1 } });
}

/** This week's post if it's still to come, else next Monday 14:00. */
function nextWeeklyPost(postedWeek: string | null) {
  const week = currentWeek();
  if (postedWeek !== week.mondayKey && new Date() < week.postAt) return week.postAt;
  if (postedWeek !== week.mondayKey) return new Date(); // due now (next cron run)
  return new Date(week.postAt.getTime() + 7 * 24 * 60 * 60_000);
}

export async function updateDiscordSettings(settings: {
  locale: Locale;
  autoUpdate: boolean;
  weeklyPost: boolean;
  pingRoleId: string | null;
}) {
  const row = await find();
  if (!row) throw new DiscordSetupError("notConnected");
  const week = currentWeek();
  // Switching the weekly post on after this week's Monday 14:00 must not
  // post (and ping) right away: mark this week as done, start next Monday.
  const turningOn = settings.weeklyPost && !row.weeklyPost;
  await prisma.discordSchedule.update({
    where: { id: 1 },
    data: {
      ...settings,
      ...(turningOn && new Date() >= week.postAt ? { weeklyPostWeek: week.mondayKey } : {}),
    },
  });
  // A language change rewrites the message right away.
  if (settings.locale !== row.locale) return syncDiscordSchedule({ mode: "edit" });
  return null;
}

// ─── sync ────────────────────────────────────────────────────────────────

export type DiscordSyncResult =
  | "notConnected"
  | "devSkipped"
  | "paused"
  | "unchanged"
  | "noMessage"
  | "posted"
  | "weeklyPosted"
  | "updated"
  | { error: string };

/**
 * auto: after edits and from the cron -- the Monday post when due, otherwise
 *       only *edits* an existing message (never posts one: the user's rule).
 * edit: "Update now" / a language change -- edit even if unchanged.
 * post: "Post new message" -- a fresh message, pinging the role if asked.
 */
export type DiscordSyncMode = { mode: "auto" } | { mode: "edit" } | { mode: "post"; ping: boolean };

// One sync at a time (cron + an edit's after() could otherwise both act on
// the message). Single container, so an in-process queue is enough.
let queue: Promise<unknown> = Promise.resolve();

export function syncDiscordSchedule(options: DiscordSyncMode = { mode: "auto" }): Promise<DiscordSyncResult> {
  const run = queue.then(() => syncNow(options));
  queue = run.catch(() => undefined);
  return run;
}

/** When the weekly post is due: Monday 14:00 Vienna of the current week. */
const WEEKLY_POST_TIME = "14:00";

/** The current Vienna week: its Monday's key and the weekly post's time. */
export function currentWeek(now = new Date()) {
  const today = viennaToday(now);
  const monday = addDays(today, 1 - isoWeekday(today));
  return { mondayKey: dateKey(monday), postAt: viennaToInstant(monday, WEEKLY_POST_TIME) };
}

async function syncNow(options: DiscordSyncMode): Promise<DiscordSyncResult> {
  if (!scheduleIntegrationsActive()) return "devSkipped";
  const row = await find();
  if (!row) return "notConnected";

  // The weekly post (a fresh message with the role ping) is independent of
  // auto-update. Missed (server down at 14:00)? It goes out later that week.
  const week = currentWeek();
  const weeklyDue =
    options.mode === "auto" &&
    row.weeklyPost &&
    new Date() >= week.postAt &&
    row.weeklyPostWeek !== week.mondayKey;
  const posting = weeklyDue || options.mode === "post";
  const ping = weeklyDue || (options.mode === "post" && options.ping);

  if (!posting) {
    if (options.mode === "auto" && !row.autoUpdate) return "paused";
    // Automatic syncs and "Update now" only edit: no message, nothing to do.
    if (!row.messageId) return "noMessage";
  }
  const locale: Locale = row.locale === "en" ? "en" : "de";

  let url: string;
  try {
    url = decryptToken(row.webhookUrlEnc, CIPHER_PURPOSE);
  } catch {
    // TOKEN_ENCRYPTION_KEY changed or is missing: the webhook must be re-entered.
    await prisma.discordSchedule.update({ where: { id: 1 }, data: { lastError: "cantDecrypt" } });
    return { error: "cantDecrypt" };
  }

  try {
    const { png, hash, embed } = await getScheduleImage(locale);
    if (options.mode === "auto" && !posting && row.contentHash === hash) return "unchanged";

    const payload = { embeds: [embed] };
    const file = { name: IMAGE_NAME, data: png };

    if (!posting) {
      try {
        await editWebhookMessage(url, row.messageId!, payload, file);
      } catch (error) {
        // Deleted in Discord: forget it. No automatic new post -- the next
        // one comes from "Post new message" or the Monday post.
        if (!(error instanceof DiscordError && error.code === "messageGone")) throw error;
        await prisma.discordSchedule.update({
          where: { id: 1 },
          data: { messageId: null, contentHash: null, lastError: "messageGone" },
        });
        return "noMessage";
      }
      await prisma.discordSchedule.update({
        where: { id: 1 },
        data: { contentHash: hash, lastSyncedAt: new Date(), lastError: "" },
      });
      return "updated";
    }

    // A new message. Only the configured role is ever pinged, and only here.
    const role = ping && row.pingRoleId ? row.pingRoleId : null;
    const t = await getTranslations({ locale, namespace: "ScheduleDiscord" });
    const messageId = await postWebhookMessage(
      url,
      {
        ...payload,
        content: role ? t("weeklyContentPing", { role: `<@&${role}>` }) : t("weeklyContent"),
        pingRoleIds: role ? [role] : [],
      },
      file,
    );
    await prisma.discordSchedule.update({
      where: { id: 1 },
      data: {
        messageId,
        contentHash: hash,
        lastSyncedAt: new Date(),
        lastError: "",
        // A pinged manual post counts as this week's post (weeks start on
        // Monday), so Monday 14:00 doesn't ping a second time.
        ...(ping ? { weeklyPostWeek: week.mondayKey } : {}),
      },
    });
    return weeklyDue ? "weeklyPosted" : "posted";
  } catch (error) {
    // 401/404 on the webhook itself: it was deleted or its token reset.
    const code =
      error instanceof DiscordError
        ? error.status === 401 || error.status === 404
          ? "invalidWebhook"
          : error.code
        : "failed";
    console.error("[schedule/discord] sync failed", code, errorInfo(error));
    await prisma.discordSchedule
      .update({ where: { id: 1 }, data: { lastError: code } })
      .catch(() => undefined);
    return { error: code };
  }
}
