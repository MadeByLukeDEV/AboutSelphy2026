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
    localPatterns: [{ pathname: "/profile/**", search: "" }],
  },
  experimental: {
    // app/global-not-found.tsx: there is no single root layout (the
    // [locale] segment is the root layout for public pages).
    globalNotFound: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
