import "server-only";
import { prisma } from "@/lib/prisma";

// Prisma-only and private to the profile module (see src/modules/README.md).

export function findProfile() {
  return prisma.profile.findUnique({ where: { id: 1 } });
}

export function findGames() {
  return prisma.game.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}
