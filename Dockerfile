# syntax=docker/dockerfile:1

# Same three-stage layout as the Social app. Deliberately NOT
# `output: "standalone"`: the runner needs the full prisma CLI to run
# `migrate deploy` on start, and standalone only traces what app code
# imports.

# ---- deps: all dependencies (incl. devDependencies, needed to build) ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: Prisma client + Next.js build (no runtime env here) ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The only build input. It's baked into robots.txt, sitemap.xml and
# client JS at build time, and the runner below reuses the same value, so
# it's defined once. The default is production; override it only for
# another domain (Dokploy: Build-time Arguments). The build needs no
# secrets and no database.
ARG NEXT_PUBLIC_SITE_URL=https://aboutselphy.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm exec prisma generate
RUN pnpm build

# ---- runner: production deps + build output, non-root ----
FROM node:22-alpine AS runner
WORKDIR /app
# Same value as the build (see builder): server code reads it at runtime
# too, so it must match what was baked into robots/sitemap/JS.
ARG NEXT_PUBLIC_SITE_URL=https://aboutselphy.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# In the same layer, delete pnpm's package store (node_modules holds hard
# links, so the files survive) and root's caches (pnpm metadata,
# corepack's pnpm, prisma). Nothing runs as root at runtime, so nothing
# could use them. Saves ~600 MB.
#
# Then remove the package managers the base image ships (npm, npx, yarn,
# corepack): the app never uses them at runtime, and Docker Scout flags
# high CVEs in npm's bundled dependencies (brace-expansion, ip-address,
# pacote, picomatch, sigstore). Deleting them removes that code entirely.
#
# Prisma's schema engine (needed by `migrate deploy` at startup) is
# downloaded by @prisma/engines' postinstall, which does NOT fail the
# install when the download fails -- a slow network once produced an image
# that built fine and then crashed on start, unable to download it as the
# unprivileged node user. `prisma version` (still root here) fetches a
# missing engine, and the `ls` fails the build if it's still not there.
RUN pnpm install --prod --frozen-lockfile \
 && node_modules/.bin/prisma version >/dev/null \
 && ls node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines/schema-engine-* \
 && rm -rf "$(pnpm store path)" /root/.cache /root/.local/share/pnpm \
 && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg \
      /usr/local/bin/pnpm /usr/local/bin/pnpx

# Every directory the app reads at runtime needs its own COPY line -- a
# missing one fails silently (lesson from Social's missing public/).
# Only .next is owned by the unprivileged `node` user (Next writes its
# cache there); everything else stays read-only to it. COPY --chown, not
# a later `RUN chown -R`, which would store .next a second time.
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts /app/next.config.ts ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Applies pending migrations (idempotent: only unapplied ones run), then
# starts the server. DATABASE_URL is the aboutselphy_main role, which owns
# schema "main". Binaries are called directly, not through pnpm: corepack
# cached pnpm in root's home, so `pnpm` as the node user would try to
# download it again at startup.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node_modules/.bin/next start"]
