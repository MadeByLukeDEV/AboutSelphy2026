import "server-only";
import { unstable_cache } from "next/cache";
import type { Locale } from "@/modules/i18n";
import { findGames, findProfile } from "./repository";

// Every page renders per request (CSP nonce), so the content is cached
// across requests here instead. `use cache` isn't an option: it needs
// cacheComponents/PPR, which doesn't work with a nonce CSP. Admin edits
// call revalidateTag(PROFILE_CACHE_TAG, { expire: 0 }).
export const PROFILE_CACHE_TAG = "profile";

const loadContent = unstable_cache(
  async () => {
    const [profile, games] = await Promise.all([findProfile(), findGames()]);
    return { profile, games };
  },
  ["profile-content"],
  // Fallback expiry for processes that didn't run the admin save (see
  // stats/service.ts); the save itself clears the tag immediately.
  { tags: [PROFILE_CACHE_TAG], revalidate: 600 },
);

export type GameStatus = "main" | "regular" | "new" | "former";

export type HomeContent = {
  displayName: string;
  tagline: string;
  /** Plain-text paragraphs (the bio is split on blank lines). */
  bio: string[];
  games: Array<{
    slug: string;
    name: string;
    status: GameStatus;
    blurb: string;
    tags: string[];
    boxArtUrl: string | null;
  }>;
  updatedAt: Date | null;
};

function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * The home/about content in one locale. Never throws for missing content:
 * with no Profile row (not seeded yet) it returns empty text, and the page
 * still renders the name.
 */
export async function getHomeContent(locale: Locale): Promise<HomeContent> {
  const { profile, games } = await loadContent();
  const de = locale === "de";

  return {
    displayName: profile?.displayName ?? "AboutSelphy",
    tagline: profile ? (de ? profile.taglineDe : profile.taglineEn) : "",
    bio: profile ? paragraphs(de ? profile.bioDe : profile.bioEn) : [],
    games: games.map((game) => ({
      slug: game.slug,
      name: game.name,
      status: game.status,
      blurb: de ? game.blurbDe : game.blurbEn,
      tags: game.tags,
      boxArtUrl: game.boxArtUrl,
    })),
    // unstable_cache serializes to JSON, so dates come back as strings.
    updatedAt: profile ? new Date(profile.updatedAt) : null,
  };
}
