import "server-only";
import { unstable_cache } from "next/cache";
import type { Locale } from "@/modules/i18n";
import * as repo from "./repository";

// Read side for the public Impressum, privacy page and footer. Cached under
// the "legal" tag (cleared by the admin save) with the usual fallback.

export const LEGAL_CACHE_TAG = "legal";

const load = unstable_cache(async () => repo.findLegal(), ["legal-settings"], {
  tags: [LEGAL_CACHE_TAG],
  revalidate: 600,
});

export type PublicLegal = {
  operator: {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
    email: string;
    phone: string;
  };
  imprintExtra: string;
  privacy: string;
  updatedAt: Date;
};

/** The published legal content in one language, or null while unpublished. */
export async function getLegal(locale: Locale): Promise<PublicLegal | null> {
  const row = await load();
  if (!row?.published) return null;
  const de = locale === "de";
  return {
    operator: {
      name: row.operatorName,
      street: row.street,
      postalCode: row.postalCode,
      city: row.city,
      country: row.country,
      email: row.email,
      phone: row.phone,
    },
    imprintExtra: de ? row.imprintExtraDe : row.imprintExtraEn,
    privacy: de ? row.privacyDe : row.privacyEn,
    // unstable_cache round-trips through JSON.
    updatedAt: new Date(row.updatedAt),
  };
}

/** Whether the legal pages are live (footer links, form privacy link). */
export async function isLegalPublished() {
  return Boolean((await load())?.published);
}
