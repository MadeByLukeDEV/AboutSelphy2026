import "server-only";
import { prisma } from "@/lib/prisma";
import type { TourId } from "./tours";

// Private to the guide module: Prisma only.

export async function findSeenTours(userId: string) {
  const rows = await prisma.guideTourSeen.findMany({ where: { userId }, select: { tourId: true } });
  return rows.map((row) => row.tourId);
}

export async function markSeen(userId: string, tourId: TourId) {
  await prisma.guideTourSeen.upsert({
    where: { userId_tourId: { userId, tourId } },
    create: { userId, tourId },
    update: {},
  });
}

export async function clearSeen(userId: string) {
  await prisma.guideTourSeen.deleteMany({ where: { userId } });
}
