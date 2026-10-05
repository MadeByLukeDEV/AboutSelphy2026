import "server-only";
import { prisma } from "@/lib/prisma";
import type { CategoryInput, StreamGame } from "./schema";

// Prisma-only and private to the schedule module.

const include = {
  game: { select: { name: true, boxArtUrl: true, customCoverId: true, twitchGameId: true } },
  categories: { select: { id: true }, orderBy: { sortOrder: "asc" as const } },
} as const;

export function findSlots() {
  return prisma.scheduleSlot.findMany({
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    include,
  });
}

export function findExceptionsBetween(from: Date, to: Date) {
  return prisma.scheduleException.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include,
  });
}

export function findException(id: string) {
  return prisma.scheduleException.findUnique({ where: { id } });
}

export function findGameOptions() {
  return prisma.game.findMany({
    where: { status: { not: "former" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

/** The game columns for a stream: a Game, a Twitch category, or neither. */
function gameColumns(game: StreamGame) {
  return {
    gameId: game.kind === "game" ? game.id : null,
    twitchCategoryId: game.kind === "twitch" ? game.id : null,
    twitchCategoryName: game.kind === "twitch" ? game.name : null,
    twitchBoxArtUrl: game.kind === "twitch" && game.boxArtUrl ? game.boxArtUrl : null,
  };
}

type StreamData = {
  startTime: string;
  durationMinutes: number;
  game: StreamGame;
  titleEn: string;
  titleDe: string;
  categoryIds: string[];
};

// ─── weekly ──────────────────────────────────────────────────────────────

export function createSlot(data: StreamData & { weekday: number; active: boolean }) {
  const { game, categoryIds, ...rest } = data;
  return prisma.scheduleSlot.create({
    data: {
      ...rest,
      ...gameColumns(game),
      categories: { connect: categoryIds.map((id) => ({ id })) },
    },
  });
}

export function updateSlot(id: string, data: StreamData & { weekday: number; active: boolean }) {
  const { game, categoryIds, ...rest } = data;
  return prisma.scheduleSlot.update({
    where: { id },
    data: {
      ...rest,
      ...gameColumns(game),
      categories: { set: categoryIds.map((cid) => ({ id: cid })) },
    },
  });
}

export const deleteSlot = (id: string) => prisma.scheduleSlot.delete({ where: { id } });

/** Cancel one date of a weekly stream (or update the note if already cancelled). */
export function cancelSlotDate(data: { slotId: string; date: Date; noteEn: string; noteDe: string }) {
  return prisma.scheduleException.upsert({
    where: { slotId_date: { slotId: data.slotId, date: data.date } },
    create: { kind: "cancelled", ...data },
    update: { noteEn: data.noteEn, noteDe: data.noteDe },
  });
}

/** Number of cancellations removed (0 = it wasn't cancelled). */
export async function restoreSlotDate(slotId: string, date: Date) {
  const { count } = await prisma.scheduleException.deleteMany({ where: { kind: "cancelled", slotId, date } });
  return count;
}

/** Cancellations of a slot from a date on (used when its weekday changes). */
export function deleteSlotCancellationsFrom(slotId: string, from: Date) {
  return prisma.scheduleException.deleteMany({ where: { kind: "cancelled", slotId, date: { gte: from } } });
}

// ─── once ────────────────────────────────────────────────────────────────

type OnceData = StreamData & { date: Date; noteEn: string; noteDe: string };

export function createOnce(data: OnceData) {
  const { game, categoryIds, ...rest } = data;
  return prisma.scheduleException.create({
    data: {
      kind: "extra",
      ...rest,
      ...gameColumns(game),
      categories: { connect: categoryIds.map((id) => ({ id })) },
    },
  });
}

export function updateOnce(id: string, data: OnceData) {
  const { game, categoryIds, ...rest } = data;
  return prisma.scheduleException.update({
    where: { id, kind: "extra" },
    data: {
      ...rest,
      ...gameColumns(game),
      categories: { set: categoryIds.map((cid) => ({ id: cid })) },
    },
  });
}

/** Cancel (with an optional reason) or restore (which clears the reason). */
export function setOnceCancelled(id: string, cancelled: boolean, reason = { en: "", de: "" }) {
  return prisma.scheduleException.update({
    where: { id, kind: "extra" },
    data: { cancelled, cancelReasonEn: reason.en, cancelReasonDe: reason.de },
  });
}

export const deleteException = (id: string) =>
  prisma.scheduleException.delete({ where: { id } });

// ─── categories ──────────────────────────────────────────────────────────

export function findCategories() {
  return prisma.streamCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function createCategory(data: CategoryInput) {
  const last = await prisma.streamCategory.aggregate({ _max: { sortOrder: true } });
  return prisma.streamCategory.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
}

export const updateCategory = (id: string, data: CategoryInput) =>
  prisma.streamCategory.update({ where: { id }, data });

export const deleteCategory = (id: string) => prisma.streamCategory.delete({ where: { id } });

/** Only ids that exist (stale ones from an open form are dropped). */
export async function existingCategoryIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await prisma.streamCategory.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return rows.map((row) => row.id);
}
