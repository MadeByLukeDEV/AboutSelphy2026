import "server-only";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  type AudienceDimension,
  type MediaKind,
  type StatPlatform,
} from "@/generated/prisma/client";

// Prisma-only and private to the stats module.

export function latestSnapshot(platform: StatPlatform, metric: string) {
  return prisma.statSnapshot.findFirst({
    where: { platform, metric },
    orderBy: { capturedAt: "desc" },
  });
}

export function insertSnapshots(
  rows: Array<{ platform: StatPlatform; metric: string; value: number }>,
) {
  return prisma.statSnapshot.createMany({ data: rows });
}

/** Latest snapshot of every (platform, metric) pair. */
export function latestSnapshots() {
  return prisma.statSnapshot.findMany({
    distinct: ["platform", "metric"],
    orderBy: [{ platform: "asc" }, { metric: "asc" }, { capturedAt: "desc" }],
  });
}

export function findSession(id: string) {
  return prisma.streamSession.findUnique({ where: { id } });
}

export function createSession(data: {
  id: string;
  startedAt: Date;
  title: string;
  gameName: string;
  viewers: number;
  now: Date;
}) {
  return prisma.streamSession.create({
    data: {
      id: data.id,
      startedAt: data.startedAt,
      lastSeenAt: data.now,
      title: data.title,
      gameName: data.gameName,
      peakViewers: data.viewers,
      viewerSum: BigInt(data.viewers),
      sampleCount: 1,
    },
  });
}

/**
 * Adds a viewer sample to a session. `countSample: false` only refreshes
 * title/game/peak -- used when the previous sample is too recent, so a
 * manual "Sync now" between cron runs doesn't double-count.
 */
export function updateSession(
  id: string,
  data: { title: string; gameName: string; viewers: number; now: Date; countSample: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.streamSession.findUniqueOrThrow({ where: { id } });
    return tx.streamSession.update({
      where: { id },
      data: {
        title: data.title,
        gameName: data.gameName,
        peakViewers: Math.max(current.peakViewers, data.viewers),
        ...(data.countSample
          ? {
              lastSeenAt: data.now,
              viewerSum: { increment: BigInt(data.viewers) },
              sampleCount: { increment: 1 },
            }
          : {}),
      },
    });
  });
}

/**
 * The newest broadcast, for the live badge. Only these fields: the result
 * goes into unstable_cache, which stores JSON, and the row's BigInt
 * `viewerSum` can't be serialized (every page threw while live, 2026-09-28).
 */
export function latestSession() {
  return prisma.streamSession.findFirst({
    orderBy: { lastSeenAt: "desc" },
    select: { title: true, gameName: true, startedAt: true, lastSeenAt: true },
  });
}

export function sessionsSince(since: Date) {
  return prisma.streamSession.findMany({
    where: { lastSeenAt: { gte: since } },
    orderBy: { startedAt: "desc" },
  });
}

export function startRun(trigger: string) {
  return prisma.syncRun.create({ data: { trigger, summary: "running" } });
}

export function finishRun(id: bigint, ok: boolean, summary: string) {
  return prisma.syncRun.update({
    where: { id },
    data: { ok, summary: summary.slice(0, 1000), finishedAt: new Date() },
  });
}

/** An unfinished run started within `withinMs` (another sync in progress). */
export function runningRun(withinMs: number) {
  return prisma.syncRun.findFirst({
    where: { finishedAt: null, startedAt: { gte: new Date(Date.now() - withinMs) } },
  });
}

export function recentRuns(take: number) {
  return prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take });
}

export type MediaRow = {
  externalId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: Date;
  durationSeconds: number;
  views: number;
};

/**
 * Makes the stored items of one kind match `items` exactly: upserts them and
 * deletes the rest (e.g. VODs that expired on Twitch). One transaction, so a
 * failure leaves the previous list intact.
 */
export function replaceMedia(kind: MediaKind, rows: MediaRow[]) {
  // Only the columns (callers may pass extra fields like isShort).
  const items = rows.map(
    ({ externalId, title, url, thumbnailUrl, publishedAt, durationSeconds, views }) => ({
      externalId, title, url, thumbnailUrl, publishedAt, durationSeconds, views,
    }),
  );
  return prisma.$transaction([
    prisma.mediaItem.deleteMany({
      where: { kind, externalId: { notIn: items.map((i) => i.externalId) } },
    }),
    ...items.map((item) =>
      prisma.mediaItem.upsert({
        where: { kind_externalId: { kind, externalId: item.externalId } },
        create: { kind, ...item },
        update: item,
      }),
    ),
  ]);
}

export function mediaByKind(kind: MediaKind, take: number) {
  return prisma.mediaItem.findMany({
    where: { kind },
    orderBy:
      kind === "twitch_clip"
        ? [{ views: "desc" }, { publishedAt: "desc" }]
        : { publishedAt: "desc" },
    take,
  });
}

/**
 * The last value of each day (Europe/Vienna) per metric since `since`, for
 * growth charts. Snapshots are hourly, so this keeps the query result small.
 */
export function dailyValues(keys: Array<{ platform: StatPlatform; metric: string }>, since: Date) {
  const pairs = Prisma.join(
    keys.map((k) => Prisma.sql`(${k.platform}::"StatPlatform", ${k.metric})`),
  );
  return prisma.$queryRaw<Array<{ platform: StatPlatform; metric: string; day: string; value: number }>>`
    SELECT DISTINCT ON (platform, metric, (("capturedAt" AT TIME ZONE 'Europe/Vienna')::date))
      platform, metric,
      (("capturedAt" AT TIME ZONE 'Europe/Vienna')::date)::text AS day,
      value
    FROM "StatSnapshot"
    WHERE (platform, metric) IN (${pairs}) AND "capturedAt" >= ${since}
    ORDER BY platform, metric, (("capturedAt" AT TIME ZONE 'Europe/Vienna')::date), "capturedAt" DESC
  `;
}

// ─── YouTube Analytics ───────────────────────────────────────────────────

const CONNECTION_ID = 1;

export function findYoutubeConnection() {
  return prisma.youtubeConnection.findUnique({ where: { id: CONNECTION_ID } });
}

export function saveYoutubeConnection(data: {
  channelId: string;
  encryptedRefreshToken: string;
  connectedBy: string;
}) {
  // A reconnect replaces the token but keeps the media kit switch.
  return prisma.youtubeConnection.upsert({
    where: { id: CONNECTION_ID },
    create: { id: CONNECTION_ID, ...data },
    update: { ...data, connectedAt: new Date() },
  });
}

export function deleteYoutubeConnection() {
  return prisma.youtubeConnection.deleteMany({ where: { id: CONNECTION_ID } });
}

export function setShowInMediaKit(show: boolean) {
  return prisma.youtubeConnection.update({
    where: { id: CONNECTION_ID },
    data: { showInMediaKit: show },
  });
}

export function insertAudienceSet(
  rows: Array<{ dimension: AudienceDimension; key: string; share: number }>,
  period: { start: Date; end: Date },
  capturedAt: Date,
) {
  return prisma.audienceSnapshot.createMany({
    data: rows.map((row) => ({
      ...row,
      periodStart: period.start,
      periodEnd: period.end,
      capturedAt,
    })),
  });
}

/** The newest set (every row of one sync shares its capturedAt). */
export async function latestAudienceSet() {
  const newest = await prisma.audienceSnapshot.findFirst({
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true },
  });
  if (!newest) return [];
  return prisma.audienceSnapshot.findMany({
    where: { capturedAt: newest.capturedAt },
    select: {
      dimension: true,
      key: true,
      share: true,
      periodStart: true,
      periodEnd: true,
      capturedAt: true,
    },
    orderBy: { id: "asc" },
  });
}
