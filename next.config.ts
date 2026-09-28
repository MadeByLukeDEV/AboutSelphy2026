import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

// Static security headers for every response. The per-request CSP (nonce)
// is set in src/proxy.ts.
const securityHeaders = [
  // HTTPS only, for 2 years, including every *.aboutselphy.com subdomain.
  // `preload` only allows submitting to hstspreload.org -- don't submit
  // until every subdomain is confirmed HTTPS-only, it's hard to undo.
  // Production only: HSTS on localhost would pin http://localhost too.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Legacy twin of CSP frame-ancestors 'none' for old browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "serial=()",
      "bluetooth=()",
      "browsing-topics=()",
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js" fingerprint.
  poweredByHeader: false,
  images: {
    // AVIF first, WebP fallback: the source PNGs in public/profile are
    // ~0.6-0.9 MB each, the served files a fraction of that.
    formats: ["image/avif", "image/webp"],
    // Only our own image paths may go through the optimizer -- anything
    // else is refused instead of being resized on demand.
    localPatterns: [
      { pathname: "/profile/**", search: "" },
      // Uploaded images (src/modules/assets).
      { pathname: "/api/media/**", search: "" },
    ],
    // Video thumbnails for the Streams page. Loaded through our optimizer,
    // so the browser only ever fetches images from our own origin and the
    // CSP img-src can stay 'self'.
    // Only the path prefixes the sync actually stores (checked 2026-09-29):
    // VOD thumbnails, clip thumbnails, box art. A wildcard let anyone make
    // the server fetch and re-encode arbitrary Twitch CDN images. If Twitch
    // moves its thumbnails, the images 400 -- add the new prefix here.
    remotePatterns: [
      { protocol: "https", hostname: "static-cdn.jtvnw.net", pathname: "/cf_vods/**" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net", pathname: "/twitch-video-assets/**" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net", pathname: "/ttv-boxart/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
    // Bounded work per image: one quality (every <Image> uses the default)
    // and a capped disk cache. The default cache is half the free disk, and
    // the Dokploy host also runs the shared Postgres.
    qualities: [75],
    maximumDiskCacheSize: 200_000_000,
  },
  experimental: {
    // Image uploads in /admin (covers are capped at 4 MB in
    // src/modules/assets; multipart adds a little overhead). Applies to
    // every Server Action.
    serverActions: { bodySizeLimit: "5mb" },
    // app/global-not-found.tsx: there is no single root layout (the
    // [locale] segment is the root layout for public pages).
    globalNotFound: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
