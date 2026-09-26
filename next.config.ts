import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // app/global-not-found.tsx: there is no single root layout (the
    // [locale] segment is the root layout for public pages).
    globalNotFound: true,
  },
};

export default withNextIntl(nextConfig);
