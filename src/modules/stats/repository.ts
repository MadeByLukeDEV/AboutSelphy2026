import "server-only";
import { prisma } from "@/lib/prisma";
import type { MediaKind, StatPlatform } from "@/generated/prisma/client";

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

export function latestSession() {
  return prisma.streamSession.findFirst({ orderBy: { lastSeenAt: "desc" } });
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
