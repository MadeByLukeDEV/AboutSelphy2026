import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { broadcasterId as configuredBroadcasterId, isTwitchConfigured } from "@/lib/platforms/twitch";
import {
  buildAuthorizationUrl,
  createSegment,
  deleteSegment,
  exchangeCode,
  refreshAccessToken,
  revokeToken,
  SCHEDULE_SCOPE,
  TwitchUserError,
  updateSegment,
  validateToken,
  type SegmentInput,
} from "@/lib/platforms/twitch-user";
import { decryptToken, encryptToken, isTokenCipherConfigured } from "@/lib/security/token-cipher";
import type { Locale } from "@/modules/i18n";
import { getUpcomingStreams } from "../service";
import { scheduleIntegrationsActive } from "../integrations-guard";
import type { StreamOccurrence } from "../occurrences";

// The schedule on Twitch. Every stream of the next 14 days is mirrored as
// its own one-off segment (Twitch can only cancel the *next* date of a
// recurring segment, so recurring segments can't express our cancellations).
// TwitchScheduleSegment remembers each segment id and what was sent, so a
// sync only creates, changes or deletes what differs. Runs after every
// schedule edit (after()) and from the 5-minute cron (rolling window,
// retries).

const TOKEN_PURPOSE = "twitch-schedule-refresh-token";
const WINDOW_DAYS = 14;

export const TWITCH_OAUTH_COOKIE = "tw_oauth";
export const TWITCH_OAUTH_COOKIE_PATH = "/api/twitch";
export const TWITCH_OAUTH_COOKIE_MAX_AGE = 600;

const redirectUri = () => `${siteUrl()}/api/twitch/callback`;
const find = () => prisma.twitchScheduleConnection.findUnique({ where: { id: 1 } });

export function canConnectTwitch() {
  return isTwitchConfigured() && isTokenCipherConfigured();
}

// ─── connect ─────────────────────────────────────────────────────────────

/** The Twitch URL to send the admin to, and the state for the cookie. */
export function startTwitchConnect() {
  const state = randomBytes(32).toString("base64url");
  return { url: buildAuthorizationUrl({ redirectUri: redirectUri(), state }), state };
}

export type TwitchConnectOutcome =
  | "connected"
  | "cancelled"
  | "invalidState"
  | "missingScope"
  | "noRefreshToken"
  | "wrongAccount"
  | "notConfigured"
  | "failed";

function sameString(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Finishes the connect flow. Never throws; the outcome goes to the admin page. */
export async function completeTwitchConnect(input: {
  params: URLSearchParams;
  cookie: string | undefined;
  connectedBy: string;
}): Promise<TwitchConnectOutcome> {
  const state = input.params.get("state");
  if (!input.cookie || !state || !sameString(state, input.cookie)) return "invalidState";
  if (input.params.get("error")) return "cancelled";
  const code = input.params.get("code");
  if (!code || code.length > 512) return "invalidState";
  if (!canConnectTwitch()) return "notConfigured";

  try {
    const token = await exchangeCode(code, redirectUri());
    if (!token.scope?.includes(SCHEDULE_SCOPE)) {
      await revokeToken(token.access_token);
      return "missingScope";
    }
    // Twitch revokes a grant through its *access* token, in every exit below.
    if (!token.refresh_token) {
      await revokeToken(token.access_token);
      return "noRefreshToken";
    }
    // Only the channel this site belongs to may be connected.
    let who: Awaited<ReturnType<typeof validateToken>>;
    let expected: string;
    try {
      [who, expected] = await Promise.all([validateToken(token.access_token), configuredBroadcasterId()]);
    } catch (error) {
      await revokeToken(token.access_token);
      throw error;
    }
    if (who.userId !== expected) {
      await revokeToken(token.access_token);
      console.warn("[schedule/twitch] connect: wrong account", who.login);
      return "wrongAccount";
    }
    const data = {
      refreshTokenEnc: encryptToken(token.refresh_token, TOKEN_PURPOSE),
      broadcasterId: who.userId,
      login: who.login.slice(0, 25),
      lastError: "",
      connectedBy: input.connectedBy.slice(0, 120),
    };
    await queued(() =>
      prisma.twitchScheduleConnection.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data }),
    );
    console.info("[schedule/twitch] connected", who.login, "by", input.connectedBy);
    // Push the schedule right away.
    await syncTwitchSchedule().catch(() => undefined);
    return "connected";
  } catch (error) {
    console.error("[schedule/twitch] connect failed", errorInfo(error));
    return "failed";
  }
}

// ─── status & settings ───────────────────────────────────────────────────

export type TwitchStatus = {
  /** Twitch app credentials + TOKEN_ENCRYPTION_KEY are set. */
  ready: boolean;
  connected: boolean;
  login: string;
  enabled: boolean;
  titleLocale: Locale;
  /** Streams currently mirrored as segments on Twitch. */
  segments: number;
  lastSyncedAt: string | null;
  lastError: string;
};

export async function getTwitchStatus(): Promise<TwitchStatus> {
  const [row, segments] = await Promise.all([
    find(),
    prisma.twitchScheduleSegment.count({ where: { startAt: { gt: new Date() } } }),
  ]);
  return {
    ready: canConnectTwitch(),
    connected: Boolean(row),
    login: row?.login ?? "",
    enabled: row?.enabled ?? true,
    titleLocale: (row?.titleLocale === "en" ? "en" : "de") as Locale,
    segments: row ? segments : 0,
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    lastError: row?.lastError ?? "",
  };
}

export async function updateTwitchSettings(settings: { enabled: boolean; titleLocale: Locale }) {
  const row = await find();
  if (!row) return "notConnected" as const;
  await prisma.twitchScheduleConnection.update({ where: { id: 1 }, data: settings });
  // Turning it on or changing the title language: push right away.
  return syncTwitchSchedule();
}

/** Removes our future segments from Twitch, revokes the login, forgets it. */
export async function disconnectTwitch() {
  return queued(async () => {
    const row = await find();
    if (!row) return;
    try {
      const token = await accessToken(row);
      const future = await prisma.twitchScheduleSegment.findMany({ where: { startAt: { gt: new Date() } } });
      for (const segment of future) {
        await deleteSegment(token.access, row.broadcasterId, segment.segmentId).catch(() => undefined);
      }
      await revokeToken(token.access);
    } catch (error) {
      console.warn("[schedule/twitch] disconnect: cleanup on Twitch failed", errorInfo(error));
    }
    await prisma.twitchScheduleSegment.deleteMany({});
    await prisma.twitchScheduleConnection.deleteMany({ where: { id: 1 } });
  });
}

// ─── sync ────────────────────────────────────────────────────────────────

// One sync (or connect/disconnect) at a time; single container.
let queue: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

async function accessToken(row: NonNullable<Awaited<ReturnType<typeof find>>>) {
  let refresh: string;
  try {
    refresh = decryptToken(row.refreshTokenEnc, TOKEN_PURPOSE);
  } catch {
    throw new TwitchUserError("invalidGrant");
  }
  const token = await refreshAccessToken(refresh);
  // Twitch may rotate the refresh token: keep the newest one.
  if (token.refresh_token && token.refresh_token !== refresh) {
    await prisma.twitchScheduleConnection.update({
      where: { id: 1 },
      data: { refreshTokenEnc: encryptToken(token.refresh_token, TOKEN_PURPOSE) },
    });
    refresh = token.refresh_token;
  }
  return { access: token.access_token, refresh };
}

function segmentFor(stream: StreamOccurrence): SegmentInput & { cancelled: boolean } {
  return {
    startTime: stream.start.toISOString(),
    duration: Math.round((stream.end.getTime() - stream.start.getTime()) / 60_000),
    categoryId: stream.twitchCategoryId ?? "",
    title: stream.title || stream.gameName || "Live",
    cancelled: stream.cancelled,
  };
}

/**
 * Creates the segment on Twitch and remembers it. If remembering fails, the
 * new segment is deleted again: an untracked segment would be duplicated by
 * the next sync and never cleaned up.
 */
async function createTracked(
  access: string,
  broadcaster: string,
  stream: StreamOccurrence,
  input: SegmentInput,
  hash: string,
) {
  const segmentId = await createSegment(access, broadcaster, input);
  try {
    await prisma.twitchScheduleSegment.create({
      data: { occurrenceKey: stream.key, segmentId, contentHash: hash, startAt: stream.start },
    });
  } catch (error) {
    await deleteSegment(access, broadcaster, segmentId).catch(() => undefined);
    throw error;
  }
}

const hashOf = (input: SegmentInput & { cancelled: boolean }) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");

export type TwitchSyncResult =
  | "notConnected"
  | "devSkipped"
  | "paused"
  | { created: number; updated: number; deleted: number; error?: string };

export function syncTwitchSchedule(): Promise<TwitchSyncResult> {
  return queued(syncNow);
}

async function syncNow(): Promise<TwitchSyncResult> {
  if (!scheduleIntegrationsActive()) return "devSkipped";
  const row = await find();
  if (!row) return "notConnected";
  if (!row.enabled) return "paused";
  const now = new Date();
  const counts = { created: 0, updated: 0, deleted: 0 };
  let firstError: string | undefined;
  const fail = (error: unknown) => {
    const code = error instanceof TwitchUserError ? error.code : "failed";
    firstError ??= code;
    console.error("[schedule/twitch] segment sync failed", code, errorInfo(error));
  };

  let token: { access: string };
  try {
    token = await accessToken(row);
  } catch (error) {
    const code = error instanceof TwitchUserError ? error.code : "failed";
    await prisma.twitchScheduleConnection.update({ where: { id: 1 }, data: { lastError: code } });
    console.error("[schedule/twitch] token refresh failed", code);
    return { ...counts, error: code };
  }

  const locale: Locale = row.titleLocale === "en" ? "en" : "de";
  // Straight from the DB: a sync writing to Twitch must see the latest edit.
  const streams = await getUpcomingStreams(locale, { days: WINDOW_DAYS, now, fresh: true });
  const stored = new Map(
    (await prisma.twitchScheduleSegment.findMany()).map((segment) => [segment.occurrenceKey, segment]),
  );
  const wanted = new Set<string>();

  for (const stream of streams) {
    wanted.add(stream.key);
    const input = segmentFor(stream);
    const hash = hashOf(input);
    const existing = stored.get(stream.key);
    // Twitch can't take segments that already started.
    if (stream.start <= now) continue;
    try {
      if (!existing) {
        if (stream.cancelled) continue; // nothing to cancel on Twitch
        await createTracked(token.access, row.broadcasterId, stream, input, hash);
        counts.created++;
      } else if (existing.contentHash !== hash) {
        try {
          await updateSegment(token.access, row.broadcasterId, existing.segmentId, input);
          await prisma.twitchScheduleSegment.update({
            where: { id: existing.id },
            data: { contentHash: hash, startAt: stream.start },
          });
        } catch (error) {
          // Deleted on Twitch by hand: create it again (unless cancelled).
          if (!(error instanceof TwitchUserError && error.code === "segmentGone")) throw error;
          await prisma.twitchScheduleSegment.delete({ where: { id: existing.id } });
          if (!stream.cancelled) {
            await createTracked(token.access, row.broadcasterId, stream, input, hash);
          }
        }
        counts.updated++;
      }
    } catch (error) {
      fail(error);
    }
  }

  // Streams that no longer exist here (deleted, moved to another day,
  // paused): remove their future segments; forget past ones.
  for (const segment of stored.values()) {
    if (wanted.has(segment.occurrenceKey)) continue;
    try {
      if (segment.startAt > now) {
        await deleteSegment(token.access, row.broadcasterId, segment.segmentId);
        counts.deleted++;
      }
      await prisma.twitchScheduleSegment.delete({ where: { id: segment.id } });
    } catch (error) {
      fail(error);
    }
  }

  await prisma.twitchScheduleConnection.update({
    where: { id: 1 },
    data: { lastSyncedAt: new Date(), lastError: firstError ?? "" },
  });
  return { ...counts, ...(firstError ? { error: firstError } : {}) };
}
