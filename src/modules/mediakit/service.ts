import "server-only";
import { unstable_cache } from "next/cache";
import { assetUrl } from "@/modules/assets";
import type { Locale } from "@/modules/i18n";
import { getHomeContent } from "@/modules/profile";
import {
  getGrowthSeries,
  getStatsOverview,
  type GrowthSeries,
  type StatsOverview,
} from "@/modules/stats";
import { MEDIAKIT_CACHE_TAG } from "./cache";
import * as repo from "./repository";

// Composes the media kit from other modules' read sides: numbers from
// `stats` (never fetched here, never typed in by hand), name, tagline and
// games from `profile`; partners and packages are this module's own tables
// (cached under the "mediakit" tag, cleared by every admin change).

/** A growth chart needs this many daily points before it's shown. */
export const MIN_GROWTH_DAYS = 7;

/** Categories a sponsor should see: what's streamed now or soon-ish. */
const CURRENT_GAME_STATUSES = new Set(["main", "regular", "occasional", "new"]);

const loadOffers = unstable_cache(
  async () => {
    const [partners, packages] = await Promise.all([repo.findPartners(true), repo.findPackages(true)]);
    return { partners, packages };
  },
  ["mediakit-offers"],
  // Fallback expiry for processes that didn't run the admin change.
  { tags: [MEDIAKIT_CACHE_TAG], revalidate: 600 },
);

export type PublicPartner = {
  id: string;
  name: string;
  url: string;
  code: string;
  description: string;
  logoUrl: string | null;
};

export type PublicPackage = {
  id: string;
  title: string;
  description: string;
  priceFrom: number | null;
};

export type MediaKit = {
  displayName: string;
  tagline: string;
  stats: StatsOverview;
  growth: GrowthSeries;
  games: Awaited<ReturnType<typeof getHomeContent>>["games"];
  partners: PublicPartner[];
  packages: PublicPackage[];
};

export async function getMediaKit(locale: Locale): Promise<MediaKit> {
  const de = locale === "de";
  const [content, stats, growth, offers] = await Promise.all([
    getHomeContent(locale),
    getStatsOverview(),
    getGrowthSeries(90),
    loadOffers(),
  ]);
  return {
    displayName: content.displayName,
    tagline: content.tagline,
    stats,
    growth,
    games: content.games.filter((game) => CURRENT_GAME_STATUSES.has(game.status)),
    partners: offers.partners.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      code: p.code,
      description: de ? p.descriptionDe : p.descriptionEn,
      logoUrl: p.logoId ? assetUrl(p.logoId) : null,
    })),
    packages: offers.packages.map((p) => ({
      id: p.id,
      title: de ? p.titleDe : p.titleEn,
      description: de ? p.descriptionDe : p.descriptionEn,
      priceFrom: p.priceFrom,
    })),
  };
}
