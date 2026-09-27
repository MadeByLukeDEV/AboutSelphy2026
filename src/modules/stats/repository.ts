import "server-only";
import { prisma } from "@/lib/prisma";
import type { StatPlatform } from "@/generated/prisma/client";

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
