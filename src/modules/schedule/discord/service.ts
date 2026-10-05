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
import { addDays, viennaToday, viennaToInstant } from "../time";
import { renderScheduleImage } from "./image";
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
  return syncDiscordSchedule({ force: true });
}

export async function disconnectDiscord() {
  // The message in Discord stays; it just isn't updated any more.
  await prisma.discordSchedule.deleteMany({ where: { id: 1 } });
}

export async function updateDiscordSettings(settings: { locale: Locale; autoUpdate: boolean }) {
  const row = await find();
  if (!row) throw new DiscordSetupError("notConnected");
  await prisma.discordSchedule.update({ where: { id: 1 }, data: settings });
  // A language change rewrites the message right away.
  if (settings.locale !== row.locale) return syncDiscordSchedule({ force: true });
  return null;
}

// ─── sync ────────────────────────────────────────────────────────────────

export type DiscordSyncResult =
  | "notConnected"
  | "paused"
  | "unchanged"
  | "posted"
  | "updated"
  | { error: string };

// One sync at a time (cron + an edit's after() could otherwise both post a
// first message). Single container, so an in-process queue is enough.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Brings the Discord message up to date. Skips when nothing changed (unless
 * forced) or when auto-update is off (unless forced). newMessage posts a
 * fresh message instead of editing the old one.
 */
export function syncDiscordSchedule(
  options: { force?: boolean; newMessage?: boolean } = {},
): Promise<DiscordSyncResult> {
  const run = queue.then(() => syncNow(options));
  queue = run.catch(() => undefined);
  return run;
}

async function syncNow({ force = false, newMessage = false }): Promise<DiscordSyncResult> {
  const row = await find();
  if (!row) return "notConnected";
  if (!row.autoUpdate && !force) return "paused";
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
    if (!force && !newMessage && row.messageId && row.contentHash === hash) return "unchanged";

    const payload = { embeds: [embed] };
    const file = { name: IMAGE_NAME, data: png };
    let messageId = row.messageId;
    let outcome: "posted" | "updated" = "updated";
    if (messageId && !newMessage) {
      try {
        await editWebhookMessage(url, messageId, payload, file);
      } catch (error) {
        // Deleted in Discord: post a new one instead.
        if (!(error instanceof DiscordError && error.code === "messageGone")) throw error;
        messageId = null;
      }
    }
    if (!messageId || newMessage) {
      messageId = await postWebhookMessage(url, payload, file);
      outcome = "posted";
    }
    await prisma.discordSchedule.update({
      where: { id: 1 },
      data: { messageId, contentHash: hash, lastSyncedAt: new Date(), lastError: "" },
    });
    return outcome;
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
