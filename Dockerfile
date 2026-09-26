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
# NEXT_PUBLIC_* values are inlined into client JS at build time, so they
# must be build args (set them in Dokploy's build args, not only env).
ARG NEXT_PUBLIC_SITE_URL=https://aboutselphy.com
ARG NEXT_PUBLIC_ROOT_DOMAIN=aboutselphy.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN
RUN pnpm exec prisma generate
RUN pnpm build

# ---- runner: production deps + build output, non-root ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Every directory the app reads at runtime needs its own COPY line -- a
# missing one fails silently (lesson from Social's missing public/).
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma7.config.ts /app/next.config.ts ./

# Run as the image's unprivileged `node` user. It owns only .next (Next
# writes its cache there); everything else stays read-only to it.
RUN chown -R node:node /app/.next
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
