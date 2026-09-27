import "server-only";
import { prisma } from "@/lib/prisma";

// Prisma-only and private to the schedule module.

const gameName = { select: { name: true } } as const;

export function findSlots() {
  return prisma.scheduleSlot.findMany({
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    include: { game: gameName },
  });
}

export function findExceptionsBetween(from: Date, to: Date) {
  return prisma.scheduleException.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { game: gameName },
  });
}

export function findGameOptions() {
  return prisma.game.findMany({
    where: { status: { not: "former" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

type SlotData = {
  weekday: number;
  startTime: string;
  durationMinutes: number;
  gameId: string | null;
  titleEn: string;
  titleDe: string;
  active: boolean;
};

export const createSlot = (data: SlotData) => prisma.scheduleSlot.create({ data });
export const updateSlot = (id: string, data: SlotData) =>
  prisma.scheduleSlot.update({ where: { id }, data });
export const deleteSlot = (id: string) => prisma.scheduleSlot.delete({ where: { id } });

export function createCancellation(data: {
  slotId: string;
  date: Date;
  noteEn: string;
  noteDe: string;
}) {
  return prisma.scheduleException.upsert({
    where: { slotId_date: { slotId: data.slotId, date: data.date } },
    create: { kind: "cancelled", ...data },
    update: { noteEn: data.noteEn, noteDe: data.noteDe },
  });
}

export function createExtra(data: {
  date: Date;
  startTime: string;
  durationMinutes: number;
  gameId: string | null;
  titleEn: string;
  titleDe: string;
  noteEn: string;
  noteDe: string;
}) {
  return prisma.scheduleException.create({ data: { kind: "extra", ...data } });
}

export const deleteException = (id: string) =>
  prisma.scheduleException.delete({ where: { id } });
