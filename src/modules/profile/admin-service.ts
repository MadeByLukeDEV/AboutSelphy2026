import "server-only";
import { revalidateTag } from "next/cache";
import {
  createGame,
  deleteGame,
  findGameBySlug,
  findGames,
  findProfile,
  moveGame,
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

export type AdminGame = GameInput & { id: string; slug: string };

function toAdminGame(game: {
  id: string;
  slug: string;
  name: string;
  status: GameInput["status"];
  blurbEn: string;
  blurbDe: string;
  tags: string[];
}): AdminGame {
  const { id, slug, name, status, blurbEn, blurbDe, tags } = game;
  return { id, slug, name, status, blurbEn, blurbDe, tags };
}

export async function getGamesForEdit(): Promise<AdminGame[]> {
  return (await findGames()).map(toAdminGame);
}

/** "Hunt: Showdown" -> "hunt-showdown"; unique (adds -2, -3, ... on clashes). */
async function uniqueSlug(name: string) {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "game";
  let slug = base;
  for (let n = 2; await findGameBySlug(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export async function addGame(input: GameInput): Promise<AdminGame[]> {
  await createGame({ ...input, slug: await uniqueSlug(input.name) });
  revalidateTag(PROFILE_CACHE_TAG, { expire: 0 });
  return getGamesForEdit();
}

export async function editGame(id: string, input: GameInput): Promise<AdminGame[]> {
  await updateGame(id, input);
  revalidateTag(PROFILE_CACHE_TAG, { expire: 0 });
  return getGamesForEdit();
}

export async function removeGame(id: string): Promise<AdminGame[]> {
  await deleteGame(id);
  revalidateTag(PROFILE_CACHE_TAG, { expire: 0 });
  return getGamesForEdit();
}

export async function reorderGame(id: string, direction: "up" | "down"): Promise<AdminGame[]> {
  await moveGame(id, direction);
  revalidateTag(PROFILE_CACHE_TAG, { expire: 0 });
  return getGamesForEdit();
}
