import "server-only";
import { revalidateTag } from "next/cache";
import { findTwitchGame, isTwitchConfigured } from "@/lib/platforms/twitch";
import { assetUrl, COVER_PRESET, deleteAsset, storeImage } from "@/modules/assets";
import {
  createGame,
  deleteGame,
  findGame,
  findGameBySlug,
  findGames,
  findGamesWithoutArt,
  findProfile,
  moveGame,
  setCustomCover,
  setGameArt,
  updateGame,
  upsertProfile,
} from "./repository";
import type { GameInput, ProfileInput } from "./schema";
import { PROFILE_CACHE_TAG } from "./service";

// Admin-side reads/writes. Uncached on purpose: the editor must show what's
// in the DB right now. Callers check authorization first (actions.ts).

export async function getProfileForEdit(): Promise<ProfileInput> {
  const profile = await findProfile();
  return {
    displayName: profile?.displayName ?? "AboutSelphy",
    taglineEn: profile?.taglineEn ?? "",
    taglineDe: profile?.taglineDe ?? "",
    bioEn: profile?.bioEn ?? "",
    bioDe: profile?.bioDe ?? "",
  };
}

export async function saveProfile(input: ProfileInput): Promise<ProfileInput> {
  const saved = await upsertProfile(input);
  // expire: 0 -> the next page view loads fresh content instead of serving
  // the stale copy while revalidating (the admin wants to see the edit).
  revalidateTag(PROFILE_CACHE_TAG, { expire: 0 });
  return {
    displayName: saved.displayName,
    taglineEn: saved.taglineEn,
    taglineDe: saved.taglineDe,
    bioEn: saved.bioEn,
    bioDe: saved.bioDe,
  };
}

// ─── games ───────────────────────────────────────────────────────────────

export type AdminGame = GameInput & {
  id: string;
  slug: string;
  boxArtUrl: string | null;
  /** What the site shows: the uploaded cover, else the Twitch art. */
  coverUrl: string | null;
  hasCustomCover: boolean;
};

function toAdminGame(game: {
  id: string;
  slug: string;
  name: string;
  status: GameInput["status"];
  blurbEn: string;
  blurbDe: string;
  tags: string[];
  twitchCategory: string;
  boxArtUrl: string | null;
  customCoverId: string | null;
}): AdminGame {
  const { id, slug, name, status, blurbEn, blurbDe, tags, twitchCategory, boxArtUrl } = game;
  return {
    id,
    slug,
    name,
    status,
    blurbEn,
    blurbDe,
    tags,
    twitchCategory,
    boxArtUrl,
    coverUrl: game.customCoverId ? assetUrl(game.customCoverId) : boxArtUrl,
    hasCustomCover: Boolean(game.customCoverId),
  };
}

export async function getGamesForEdit(): Promise<AdminGame[]> {
  return (await findGames()).map(toAdminGame);
}

/** "Hunt: Showdown" -> "hunt-showdown"; unique (adds -2, -3, ... on clashes). */
async function uniqueSlug(name: string) {
  const base =
    name
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "game";
  let slug = base;
  for (let n = 2; await findGameBySlug(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/**
 * Looks up the game's Twitch cover (by twitchCategory, else name) and stores
 * it. Never fails the save: without Twitch credentials, or when Twitch is
 * down, the game keeps what it had; the hourly sync fills gaps later.
 */
async function resolveArt(game: { id: string; name: string; twitchCategory: string }) {
  if (!isTwitchConfigured()) return;
  try {
    const found = await findTwitchGame(game.twitchCategory || game.name);
    await setGameArt(game.id, {
      twitchGameId: found?.id ?? null,
      boxArtUrl: found?.boxArtUrl ?? null,
    });
  } catch (error) {
    console.error(`[profile] cover lookup for "${game.name}" failed`, error);
  }
}

async function changedGames() {
  revalidateTag(PROFILE_CACHE_TAG, { expire: 0 });
  return getGamesForEdit();
}

export async function addGame(input: GameInput): Promise<AdminGame[]> {
  const game = await createGame({ ...input, slug: await uniqueSlug(input.name) });
  await resolveArt(game);
  return changedGames();
}

export async function editGame(id: string, input: GameInput): Promise<AdminGame[]> {
  const before = await findGame(id);
  const game = await updateGame(id, input);
  // Only look the cover up again when it could have changed.
  if (
    !before?.boxArtUrl ||
    before.name !== game.name ||
    before.twitchCategory !== game.twitchCategory
  ) {
    await resolveArt(game);
  }
  return changedGames();
}

export async function removeGame(id: string): Promise<AdminGame[]> {
  const game = await findGame(id);
  await deleteGame(id);
  if (game?.customCoverId) await deleteAsset(game.customCoverId);
  return changedGames();
}

/** Stores an uploaded cover (validated + re-encoded) and drops the old one. */
export async function uploadCover(id: string, file: unknown): Promise<AdminGame[]> {
  const game = await findGame(id);
  if (!game) throw new Error("game not found");
  const asset = await storeImage(file, COVER_PRESET);
  await setCustomCover(id, asset.id);
  if (game.customCoverId) await deleteAsset(game.customCoverId);
  return changedGames();
}

/** Back to the Twitch box art. */
export async function removeCover(id: string): Promise<AdminGame[]> {
  const game = await findGame(id);
  if (game?.customCoverId) {
    await setCustomCover(id, null);
    await deleteAsset(game.customCoverId);
  }
  return changedGames();
}

export async function reorderGame(id: string, direction: "up" | "down"): Promise<AdminGame[]> {
  await moveGame(id, direction);
  return changedGames();
}

/**
 * For the stats sync (hourly): look up covers for games that have none yet,
 * e.g. saved while Twitch was unreachable. Returns a short summary.
 */
export async function fillMissingGameArt(): Promise<string> {
  const games = await findGamesWithoutArt(10);
  if (games.length === 0) return "game covers: complete";
  for (const game of games) await resolveArt(game);
  const stillMissing = (await findGamesWithoutArt(10)).length;
  if (stillMissing < games.length) revalidateTag(PROFILE_CACHE_TAG, { expire: 0 });
  return `game covers: ${games.length - stillMissing} found, ${stillMissing} without a Twitch match`;
}
