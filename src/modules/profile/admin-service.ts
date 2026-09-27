import "server-only";
import { revalidateTag } from "next/cache";
import { findProfile, upsertProfile } from "./repository";
import type { ProfileInput } from "./schema";
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
