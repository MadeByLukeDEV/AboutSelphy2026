import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Staff area and API routes: nothing to index. The admin pages also
      // carry robots: { index: false } (belt-and-suspenders for crawlers
      // that ignore robots.txt).
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
