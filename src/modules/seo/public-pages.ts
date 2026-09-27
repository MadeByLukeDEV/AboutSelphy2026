import type { MetadataRoute } from "next";

type SitemapEntry = MetadataRoute.Sitemap[number];

// Every public, indexable page (unprefixed path; each exists as /de/... and
// /en/...). Add a page here when it ships -- sitemap.ts is built from this
// list. No lastModified yet: it must come from real data (e.g. the page's
// content updatedAt), never from `new Date()`, which tells crawlers
// everything changed on every build.
export const PUBLIC_PAGES: Array<{
  path: "/";
  changeFrequency: SitemapEntry["changeFrequency"];
  priority: number;
}> = [{ path: "/", changeFrequency: "weekly", priority: 1 }];
