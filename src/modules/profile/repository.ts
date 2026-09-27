import "server-only";
import { prisma } from "@/lib/prisma";

// Prisma-only and private to the profile module (see src/modules/README.md).

export function findProfile() {
  return prisma.profile.findUnique({ where: { id: 1 } });
}

export function findGames() {
  return prisma.game.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export function upsertProfile(data: {
  displayName: string;
  taglineEn: string;
  taglineDe: string;
  bioEn: string;
  bioDe: string;
}) {
  return prisma.profile.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
}
