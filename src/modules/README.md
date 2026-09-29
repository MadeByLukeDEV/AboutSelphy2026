# Modules

This app is a modular monolith: one deployable Next.js app, internally split into
self-contained modules with enforced boundaries (same rules as the Social app).

## Rules

- **Public surface only.** From outside a module's folder, only import its
  `actions.ts` and/or `service.ts` (or an `index.ts` barrel re-exporting those).
  Never import another module's `repository.ts` or internal components.
- **`repository.ts` is Prisma-only and private.** All Prisma queries for a
  module's tables live here. Nothing outside the module imports it.
- **`service.ts` holds business logic** and calls `repository.ts`. Server-only
  (`import "server-only"`).
- **`actions.ts` holds Next.js Server Actions**, thin wrappers around
  `service.ts`. Every action re-checks auth/role and validates its input with
  zod itself: Server Actions are public POST endpoints.
- **`schema.ts`** holds zod schemas for the module's inputs.
- **`components/`** holds the module's own UI. A module may render another
  module's components only if that module exports them from its public surface.
- **`app/` routes stay thin.** Route files call a module's action/service and
  render its components. No business logic or Prisma calls in `app/`.

## Module map

Modules are added here as they are built.

| Module | Owns | Depends on |
|--------|------|------------|
| `theme` | next-themes provider + light/dark/system toggle | `i18n` (labels) |
| `profile` | `Profile` + `Game` tables (Twitch box-art covers), cached home content (`getHomeContent`), channel links, static profile images, home page components, admin editors (`saveProfileAction`, game actions) | `i18n`, `auth` (guards), `lib/platforms` (Twitch lookup) |
| `stats` | `StatSnapshot`, `StreamSession`, `SyncRun`, `MediaItem`, `YoutubeConnection`, `AudienceSnapshot`; sync job (`runSync`, cron + "Sync now"); YouTube Analytics owner connect (`/api/youtube/*`, encrypted refresh token) and daily demographics step; cached read side (`getLiveStatus`, `getStatsOverview`, `getStreamsMedia`, `getAudience`); `Demographics` component; admin status | `auth` (guards), `profile` (`fillMissingGameArt`), `lib/platforms` |
| `streams` | Streams page UI: click-to-load `VideoFacade`, media cards/sections, live section, embed URL builders | `stats` (media, live), `profile` (channels, banner) |
| `schedule` | `ScheduleSlot`, `ScheduleException`; Vienna time helpers; occurrence computation (`getUpcomingStreams`, `getNextStream`); admin schedule editor (staff) | `auth` (guards), `profile` (games via relation) |
| `assets` | `Asset` table; validated, re-encoded image uploads (`storeImage`); served by `/api/media/[id]` | — |
| `mediakit` | the media kit page: audience sentence, per-platform figures with "as of", demographics (when switched on), growth charts (≥ 7 daily points), current games; owns `Partner` + `Package` (admin editors in `/admin/partners`, public sections, cache tag `mediakit`) | `stats` (read side only), `profile`, `assets` (logos), `auth` (guards) |
| `inquiries` | `Inquiry` table; public submit action (honeypot, zod, Redis rate limit, Turnstile siteverify); Turnstile widget + form; staff inbox; GDPR purge | `auth` (guards), `i18n` (routing), `lib/redis` |
| `legal` | `LegalSettings` singleton; Impressum from operator fields, privacy policy as Markdown (sanitizing renderer); publish rules; `/admin/legal` | `auth` (guards), `i18n` |
| `seo` | public page list for the sitemap, JSON-LD component + schema.org builders (Person, WebSite, ProfilePage) | `i18n` (alternates) |
| `i18n` | next-intl routing (`/de`, `/en`), request config, locale-aware navigation, hreflang alternates, message catalogs, locale switcher | — |
