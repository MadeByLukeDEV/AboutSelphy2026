import "server-only";
import type { GameStatus } from "@/generated/prisma/client";
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

export function findGameBySlug(slug: string) {
  return prisma.game.findUnique({ where: { slug } });
}

export async function createGame(data: {
  slug: string;
  name: string;
  status: GameStatus;
  blurbEn: string;
  blurbDe: string;
  tags: string[];
  twitchCategory: string;
  showOnHome: boolean;
}) {
  const last = await prisma.game.aggregate({ _max: { sortOrder: true } });
  return prisma.game.create({
    data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
}

export function updateGame(
  id: string,
  data: {
    name: string;
    status: GameStatus;
    blurbEn: string;
    blurbDe: string;
    tags: string[];
    twitchCategory: string;
    showOnHome: boolean;
  },
) {
  return prisma.game.update({ where: { id }, data });
}

export function findGame(id: string) {
  return prisma.game.findUnique({ where: { id } });
}

export function setGameArt(
  id: string,
  art: { twitchGameId: string | null; boxArtUrl: string | null },
) {
  return prisma.game.update({ where: { id }, data: art });
}

/** Games with neither Twitch art nor an uploaded cover. */
export function findGamesWithoutArt(take: number) {
  return prisma.game.findMany({ where: { boxArtUrl: null, customCoverId: null }, take });
}

export function setCustomCover(id: string, customCoverId: string | null) {
  return prisma.game.update({ where: { id }, data: { customCoverId } });
}

export function deleteGame(id: string) {
  return prisma.game.delete({ where: { id } });
}

/** Swaps sortOrder with the neighbour above/below (no-op at the ends). */
export async function moveGame(id: string, direction: "up" | "down") {
  return prisma.$transaction(async (tx) => {
    const games = await tx.game.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    const index = games.findIndex((g) => g.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= games.length) return;
    [games[index], games[target]] = [games[target], games[index]];
    // Rewrite a clean 0..n order (also repairs duplicates).
    for (const [order, game] of games.entries()) {
      await tx.game.update({ where: { id: game.id }, data: { sortOrder: order } });
    }
  });
}
