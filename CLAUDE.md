@AGENTS.md

# AboutSelphy — Main Website

The main website for **AboutSelphy**, the streamer's online identity, served at
`aboutselphy.com`. It is the hub that the other aboutselphy apps sit around:

- `social.aboutselphy.com`: link tree and subdomain forwards (repo
  `../SocialMedia Tree`, GitHub `MadeByLukeDEV/Linktree`)
- `auth.aboutselphy.com`: central staff login (repo `../Auth`, GitHub
  `MadeByLukeDEV/aboutselphy-auth`)

Build this project the same way as the Social app. When unsure how something
is done, **look at `../SocialMedia Tree` first** (its `CLAUDE.md`,
`src/modules/README.md`, `src/lib/*`, `Dockerfile`) and copy the pattern
instead of inventing a new one.

## What the site does

### Phase A: public identity site (build first)

- **Home / About**: who AboutSelphy is, personality, story. Hero with a strong
  first impression, live status (live / offline / next stream).
- **What I stream**: games and categories, stream formats, highlights, latest
  VODs/clips (Twitch + YouTube).
- **Schedule**: the weekly stream plan, public view.
- **Media kit** (`/mediakit`, for companies and sponsors): audience numbers
  per platform, past partners and brand deals, packages/offers, an inquiry
  form, and a downloadable PDF version. The numbers come **straight from the
  YouTube and Twitch APIs** (see "Media kit data"). Never hardcode them. Each
  figure shows an "as of" date.
- **Admin dashboard** (`/admin`, staff only): edit the About content,
  partners, packages and schedule. Manage the sponsor inquiries sent through
  the media kit form (they are stored here, not emailed). Also shows the
  media kit's API sync status.

### Phase B: viewer dashboard (much later; do not build)

Viewer points, giveaways and similar features come **only after everything
in Phase A is finished**, and the user will start it explicitly. Until then:
- Don't build, scaffold or create placeholder routes, modules, tables or env
  vars for it.
- Don't bend Phase A design around it. The only requirement is to keep the
  module boundaries clean so it can be added later.

For later reference: viewer login is **not** covered by
`auth.aboutselphy.com` (staff-only; `../Auth/claude.md` marks viewer auth as
out of scope).

## Tech stack

Same stack as `social.aboutselphy.com`, apart from the database:

- **Next.js 16** (latest, App Router, Turbopack), TypeScript, React 19
- **Tailwind CSS v4** + **shadcn/ui** (`base-nova` style, **Base UI**
  primitives, not Radix) + **Motion** (`motion` package, `import { motion }
  from "motion/react"`. Social still uses the older `framer-motion` import,
  but new code here uses `motion`)
- **PostgreSQL** + **Prisma 7 ORM** (driver adapter `@prisma/adapter-pg`).
  Unlike Social, which runs on MariaDB, this app uses the shared Postgres
  instance in the AboutSelphy Dokploy namespace, with **its own schema**
  (for example `main`). Don't create a new database.
- **Auth**: staff sessions come from the central BetterAuth service at
  `auth.aboutselphy.com` (Discord login, admin plugin, roles `admin` /
  `moderator`). This app has no auth instance of its own for staff. See "Auth".
- **next-intl** (German/English, locale-prefixed URLs `/de` and `/en`,
  unlike Social; see "i18n") and **next-themes** (dark/light, system
  default)
- react-hook-form + zod, sonner toasts, lucide-react, simple-icons
- Package manager: **pnpm**. Deployment: **Dokploy** (Docker, Traefik,
  Cloudflare in front)

## Next.js 16: do not use stale Next 14/15 knowledge

Read `node_modules/next/dist/docs/` before writing framework code if unsure.
- `middleware.ts` has been replaced by **`src/proxy.ts`**, which exports a
  `proxy` function and always runs on the Node runtime.
- `params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` are
  Promises. Always `await` them.
- `next lint` has been removed, so `pnpm lint` calls ESLint directly.
  `images.domains` is replaced by `images.remotePatterns` (add Twitch/YouTube
  CDN hosts there).

## Prisma 7: do not use stale knowledge

- Pin `prisma` and `@prisma/client` to the **same exact stable version** that
  Social uses (currently `7.10.0`). Check `npm view prisma dist-tags` before
  installing or bumping, because `latest` has pointed at an 8.x RC before.
  Always run `pnpm exec prisma …`, never `pnpm dlx prisma …`.
- Config lives in **`prisma7.config.ts`**. It loads `.env.local`, then
  `.env` (dotenv 18 `path` array), which is the same precedence as Next.js,
  so the CLI and the app see the same `DATABASE_URL`. The generator is
  `provider = "prisma-client"` with output `src/generated/prisma`
  (gitignored).
- **Database facts** (checked 2026-09-26): PostgreSQL 18.6, database
  `aboutselphy` on the shared instance (Tailscale IP in dev). This app
  connects as **`aboutselphy_main`**, which owns schema `main` (with
  search_path `main`) and has **no `CREATEDB`** and no access to `auth`.
- **App schema `main`**:
  - `DATABASE_URL` stays a plain connection string with no `?schema=`.
  - At runtime, `src/lib/prisma.ts` passes `DATABASE_SCHEMA` (default
    `main`) to `new PrismaPg(..., { schema })`.
  - For the CLI, `prisma7.config.ts` appends `?schema=` to the URL.
  - `prisma migrate status` confirms that the CLI targets schema `main`.
- **Migrations: `migrate dev` does not work here** (no `CREATEDB`, so it
  can't create a shadow database; error `P3014`). For every schema change:
  1. Get the previous schema: `git show main:prisma/schema.prisma >
     "$TEMP/schema_prev.prisma"`. For the very first migration, use
     `--from-empty` in step 2 instead.
  2. `pnpm exec prisma migrate diff --from-schema "$TEMP/schema_prev.prisma"
     --to-schema prisma/schema.prisma --script >
     prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`
  3. Review the SQL, then run `pnpm exec prisma migrate deploy`.
     **The SQL must not contain `CREATE SCHEMA`.** `aboutselphy_main` owns
     `main` but has no database-level `CREATE` right, and Postgres checks
     that right even for `IF NOT EXISTS`. The first migration failed with
     `42501 permission denied for database` until that line was removed
     (then `prisma migrate resolve --rolled-back <name>` and deploy again).
     Prisma also can't express `CHECK` constraints; add them to the SQL by
     hand (e.g. the `Profile` singleton check).
  4. Run `pnpm exec prisma generate`.

  `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`) was
  created by hand and is committed.
- **Seed data**: `pnpm db:seed` (`scripts/seed-profile.mts`) inserts the
  initial profile text and games. It's **insert-only**: existing rows are
  never overwritten, so it can't undo admin edits. Dev and prod share the
  database, so it writes real content. It already ran on 2026-09-27.
- **Scripts that import `src/lib/prisma.ts`** (which has
  `import "server-only"`) must run with
  `NODE_OPTIONS=--conditions=react-server pnpm exec tsx <file>.mts`.
- `dotenv` and `tsx` go in `dependencies`, not `devDependencies`, because
  `migrate deploy` and scripts run in production.
- **Local dev and production may share the database.** Delete any test data
  you create.

## Architecture: modular monolith

The same rules apply as in Social (`../SocialMedia Tree/src/modules/README.md`).
Create `src/modules/README.md` here with a module map and keep it up to date.

- Each module has `actions.ts` (Server Actions), `service.ts` (business logic),
  `repository.ts` (Prisma only, **private**), `schema.ts` (zod) and
  `components/`.
- From outside a module, import only its `actions.ts`/`service.ts` (or its
  `index.ts` barrel). Never import another module's `repository.ts`.
- `src/app/**` routes stay thin, with no business logic or Prisma calls.

```
src/
  proxy.ts                 # auth gate for /admin, security headers (CSP nonce)
  app/
    [locale]/(public)/     # home, about, streams, schedule, mediakit
    admin/                 # staff dashboard (central auth, noindex)
    api/                   # webhooks (Twitch EventSub), cron sync, health
  modules/
    auth/ profile/ mediakit/ inquiries/ stats/ schedule/ streams/ twitch/
    youtube/ seo/ i18n/ theme/
  components/ui/           # shadcn primitives
  components/effects/      # global decorative layer (background, cursor)
  lib/                     # prisma client, utils, og-font
prisma/schema.prisma       # one schema, commented section per module
```

## Auth

Copy Social's integration and don't reinvent it. The source of truth is
`../Auth/consumer/validate-session.ts`, which Social keeps a copy of in
`src/modules/auth/session.ts`. Copy it into `src/modules/auth/session.ts` and
keep it in sync with the auth repo.

- The helper verifies the cookie HMAC (`<token>.<base64 HMAC-SHA256>`, keyed
  with the shared `BETTER_AUTH_SECRET`). It then reads `session` and `user`
  from the auth schema with a lazily created `pg` Pool. It **fails closed**:
  if the auth DB can't be reached, the user counts as signed out.
- **Roles are per session** (auth service, 2026-09-29): Twitch/YouTube
  sign-ins exist for viewers, and only a Discord sign-in gets a staff role.
  The query checks `coalesce(s.role, u.role)`, never `u.role` alone, or a
  mod's Twitch session would open `/admin`. The fallback only covers old
  (all-Discord) sessions without `s.role`.
- `src/modules/auth/roles.ts` provides `isAdmin` and `canAccessDashboard`.
  Every authorization check goes through these helpers, never an inline role
  string comparison. Enforce them in `proxy.ts` **and** in every Server
  Action (`requireAdmin()` / `requireStaff()`). Hiding a UI element is only
  a convenience, not protection.
- Sign-in redirects to
  `${AUTH_URL}/login?redirect=<url>`. Build the return URL from
  `NEXT_PUBLIC_SITE_URL`, not `request.url`, which holds the container's
  address behind Traefik.
- Sign-out is a **form POST** to `${AUTH_URL}/api/sign-out` with a
  `redirect` field. Add this app's origins (prod and `http://localhost:300x`)
  to the auth service's `TRUSTED_ORIGINS`.
- In local dev, run the auth service on one port and this app on another
  (`pnpm dev -p 3002`). Cookies aren't port-scoped, so both apps see the
  session.
- In the admin header, show `session.user.name`, not the public display name.

## Frontend conventions

Use the same visual identity as the Social app, so the sites feel like one
brand.

- **Brand color `#00FFA8`** as `--primary`/`--ring` in both `:root` and
  `.dark`, with a near-black `--primary-foreground`. **Font**: Plus Jakarta
  Sans through `next/font/google`, registered as `--font-sans`.
- Global `AnimatedBackground` and `CustomCursor`: port them from Social's
  `src/components/effects/`. The cursor only activates on `(pointer: fine)`
  devices.
- **Units: always `rem`, never `px`**, including inside `clamp()`. Use fluid
  sizing with `clamp()` through a small reusable scale instead of stacking
  many breakpoint variants. Design **mobile-first**, because much of the
  audience arrives from a phone.
- **Skeleton loading** for everything async (`loading.tsx` / `<Suspense>`,
  shadcn `Skeleton` sized to match the real content). A slow or failing
  Twitch/YouTube API must never block the rest of the page.
- shadcn `base-nova` / Base UI: forms use `Field`/`FieldGroup`/`FieldLabel`/
  `FieldError` + react-hook-form + zod (there is no `Form` component). Custom
  triggers use the `render` prop, not `asChild`.
- **Dropdowns in forms**: use `FormSelect` (`src/components/form/form-select.tsx`,
  Base UI Select + react-hook-form `Controller`), **never a native `<select>`**:
  its option list is drawn by the OS and ignores the dark theme (white popup,
  pale text). Options are `{ value: string; label }`, and `""` works as a
  "none" value. Numbers come back as strings, so schemas use `z.coerce`.
- Use `useSyncExternalStore` for client-only and mounted checks, not
  `useEffect(() => setMounted(true))`, which the React Compiler lint rule
  flags.
- A client state seeded from server props doesn't update on
  `revalidatePath`. Have actions return the changed record and update local
  state through `onSuccess`.
- Give every dnd-kit `DndContext` an `id={useId()}` to avoid hydration
  mismatches.
- **Motion system** (2026-09-28, the user asked for more in/out animation;
  CSS only, no JS needed, all off for `prefers-reduced-motion`, CSS in
  the "motion" section of `globals.css`):
  - `<main data-enter>`: direct children rise in, staggered. The first
    child only moves, never fades (the home banner is the LCP image).
  - `.reveal` on repeated items (game rows, schedule days, media cards,
    media kit cards): fade up on scroll via `animation-timeline: view()`
    inside `@supports`; unsupported browsers just show them.
  - Page transitions: `PageTransition` (`src/components/motion/`, React
    `<ViewTransition>`) wraps each public page's `<main>` (not the
    layout: layouts persist, so enter/exit never fire). The root crossfade
    is off, so only the page region fades; the header's active pill is a
    named transition (`nav-pill`) that glides between items.
  - **No directional slides**: `Link` `transitionTypes` rarely survive
    in production here (dynamic pages commit in a later transition
    without the types; checked on a prod build), so direction was random.
  - `CountUp` (`src/components/motion/count-up.tsx`, media kit numbers):
    the server renders the final formatted value (HTML, crawlers, link
    previews and screen readers get the real number); in the browser it
    counts from 0 when scrolled into view, width locked first (no layout
    shift), whole numbers stay whole. CSS hides it only under
    `@media (scripting: enabled)` until the count starts, with a 2.5 s
    fallback; no-JS and reduced motion show the value at once (tested).
  - New public pages: wrap `<main data-enter>` in `<PageTransition>`;
    give repeated items `reveal`.
- Motion: respect `prefers-reduced-motion` (`useReducedMotion`). Don't put a
  continuously active transform prop (`whileHover={{ scale }}`) on elements
  that dnd-kit also transforms.
- **i18n** (`src/modules/i18n`, next-intl 4):
  - Routing is `localePrefix: "always"`, locales `de` and `en`, default `en`.
    Public pages live under `src/app/[locale]/`, which is also their root
    layout (`<html lang>`). There is no `generateStaticParams`, because
    pages render per request for the CSP nonce (see Security). Unknown
    locales 404 through the `hasLocale` check.
  - Every `[locale]` page and layout calls `setRequestLocale(locale)` before
    using translations, or it silently turns dynamic.
  - `src/proxy.ts` runs next-intl's middleware. `/` redirects by the
    `NEXT_LOCALE` cookie, then `Accept-Language`, then `en`. It also sends
    hreflang `Link` headers.
  - Every public page's `generateMetadata` returns
    `alternates: localeAlternates(locale, "/path")` (canonical + `de`/`en` +
    `x-default` → the unprefixed URL).
  - Internal links use `Link`/`useRouter` from `@/modules/i18n`, not
    `next/*`.
  - Routes outside `[locale]` (the future `/admin`) have no locale segment.
    `request.ts` falls back to the cookie, then `Accept-Language`.
  - `timeZone` is fixed to `Europe/Vienna` in `request.ts`. Without it,
    next-intl uses the server's zone, which is UTC in Docker.
  - 404s: `[locale]/[...rest]` catches unknown paths so they get the
    localized `[locale]/not-found.tsx`. URLs that match no route at all get
    the bilingual `app/global-not-found.tsx`
    (`experimental.globalNotFound`), because there is no single root layout.
  - Message keys are typed (`src/global.d.ts`, with `en.json` as the
    reference), so a wrong key is a type error. `de.json` must still be kept
    in sync by hand.
  - Long-form prose (About text, media kit copy) belongs in the DB as
    per-locale fields, not in the JSON catalogs.
  - `NextIntlClientProvider` gets only the namespaces its layout's client
    components use, via `clientMessages([...])`
    (`src/modules/i18n/client-messages.ts`). Public: `LocaleSwitcher`,
    `ThemeToggle`. Admin: `Admin`, `ThemeToggle`. **A new client component
    using `useTranslations("X")` needs "X" added there**, or it renders the
    raw keys. Before this, every public page shipped the admin texts too.
- Accessibility: semantic landmarks, visible focus rings, alt text,
  AA contrast (bright `#00FFA8` on white fails, so use it for accents and
  surfaces, not body text on light backgrounds; use the `text-brand-text`
  token for green text instead).

## Media kit data (YouTube + Twitch APIs)

For now, every media kit number comes directly from the platform APIs. The
`stats` module owns fetching and storing them. `mediakit` only reads from
`stats`' service.

- **YouTube Data API v3** (`YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`):
  `channels.list?part=statistics,snippet` gives subscribers, total views and
  video count. Recent-video averages (views per video over the last N uploads)
  come from `search`/`playlistItems` + `videos.list`. Watch the quota
  (10,000 units/day, `search.list` costs 100), so prefer the uploads playlist.
- **Twitch Helix** (app access token from `TWITCH_CLIENT_ID`/`_SECRET`,
  cached until expiry): `users` gives the profile, and
  `channels/followers?broadcaster_id=…` gives the follower `total`.
  **Twitch has no endpoint for average or peak viewers.** Build those from
  `streams` `viewer_count` samples taken while live. A scheduled job polls
  every few minutes during a stream, started by the EventSub
  `stream.online`/`offline` webhook, and stores each sample.
- **Store snapshots, don't fetch per request.** A scheduled sync
  (`/api/cron/stats`, protected by a `CRON_SECRET` bearer header, triggered
  by a Dokploy schedule) writes `StatSnapshot` rows (platform, metric, value,
  capturedAt). The page reads the latest snapshot. That gives the "as of"
  date, growth charts over time, and a working media kit when an API is down
  or out of quota.
- **Demographics (decided)**: leave them out of the media kit for now. They
  will come **later from the YouTube Analytics API** (age, gender, country,
  device). That API needs the channel owner's OAuth, so the plan is:
  - A one-time "Connect YouTube" button in `/admin` (admin only).
  - The refresh token is stored encrypted in the DB (AES-256-GCM, key in
    `TOKEN_ENCRYPTION_KEY`) and is never sent to the client.
  - Scope is `yt-analytics.readonly` only.
  - The stats sync stores the results as snapshots, like the other figures.

  Twitch has no demographics API. Never enter numbers by hand or invent them.
- Stat tiles and charts follow the `dataviz` skill. Numbers are formatted per
  locale (`Intl.NumberFormat`, compact notation like "12.3K" / "12,3 Tsd.").

## SEO (high priority)

SEO is a core requirement, not polish. Every public page must pass these
checks before it's considered done.

- **Rendering**: public pages are Server Components with no client-only
  content that crawlers can't see. **Every page renders per request.** The
  user chose the strict nonce CSP over static pages on 2026-09-26 (see
  Security). Speed therefore comes from **caching the data, not the HTML**:
  - DB reads and API results are cached (Next's data cache / `use cache`
    with tags, invalidated by admin edits and the stats sync).
  - A page render must never wait on Twitch or YouTube.
  - Keep server render time low and check TTFB in Lighthouse.
  - Every `unstable_cache` has a **fallback `revalidate`** (stats 300 s,
    profile 600 s) as well as its tag. `revalidateTag` only clears the cache
    in the process that ran it. In production that's fine, because the
    Dokploy job calls the same container. A local dev server, or a second
    replica, would otherwise keep its first copy forever. This was hit on
    2026-09-28: a dev server kept showing old Streams data.
- **i18n routing differs from Social**: public pages use **locale-prefixed
  URLs** (`/de/…`, `/en/…`, next-intl routing with `localePrefix`). With
  Social's cookie/Accept-Language approach, Google only ever indexes one
  language. Each page emits `alternates.canonical` plus `alternates.languages`
  (hreflang `de`, `en`, `x-default`), and `/` redirects by
  Accept-Language. `/admin` stays unprefixed.
- **Metadata**: set `metadataBase`, the title template `"%s — AboutSelphy"`
  and `openGraph`/`twitter` defaults (`summary_large_image`) in the root
  layout. Every public page gets its own `generateMetadata` with a unique
  title, a description of 150–160 characters, the canonical URL and the
  localized OG `locale`.
  - Metadata **does not deep-merge** `openGraph`/`twitter` from layout to
    page, so page overrides must repeat every field.
  - Titles that already contain the site name need `title: { absolute }`.
- **Structured data (JSON-LD)** from the `seo` module: `Person` (with
  `sameAs` → every social profile), `WebSite`, `ProfilePage` on About,
  `VideoObject` for embedded videos, `Event` for schedule entries, and
  `BreadcrumbList`. Render it as `<script type="application/ld+json">` with
  `<` escaped (see Security). Validate with Google's Rich Results Test.
- **OG images**: `opengraph-image.tsx` with `next/og` per page. Give
  `/mediakit` its own card showing live headline numbers, since sponsors share
  that link. Satori gotchas: flexbox only, every element needs
  `display: "flex"`, fonts are passed as bytes, and symbols must be inline
  SVG.
- **Crawling** (done):
  - `src/app/robots.ts` disallows `/admin` and `/api/`. The admin pages
    must also carry `robots: { index: false }`.
  - `src/app/sitemap.ts` is built from `PUBLIC_PAGES` in
    `src/modules/seo/public-pages.ts`, with one entry per page and locale.
    Each entry has hreflang alternates from the same `localeAlternates()`
    as the page heads. **Add every new public page to `PUBLIC_PAGES`.**
    `lastModified` only from real data (content `updatedAt`), never
    `new Date()`.
  - Both files, plus metadata, use `siteUrl()` from `src/lib/env.ts`, not
    `env()`: they're prerendered at build time, where only the
    `NEXT_PUBLIC_SITE_URL` build arg exists.
  - `src/app/manifest.ts` is a plain manifest (`display: "browser"`, not a
    PWA).
  - **Icons** are placeholders: an "AS" monogram (`BrandMark`,
    `src/components/brand/`) generated by `src/app/icon.tsx`
    (`/icon/32`, `/icon/192`, `/icon/512` via `generateImageMetadata`) and
    `apple-icon.tsx`. Replace them with the real logo when it exists.
    `/icon` and `/apple-icon` are excluded from the proxy matcher (no file
    extension, so next-intl would redirect them).
  - **Brand font for `next/og`**:
    `src/assets/fonts/PlusJakartaSans-ExtraBold.ttf` (static TTF, OFL) is
    committed and loaded by `loadBrandFont()` in `src/lib/og-font.ts`, so
    builds never fetch Google Fonts. Icons render at build time; the
    request-time media kit card and the PDF read the fonts at runtime,
    which is why the Dockerfile runner has `COPY src/assets`.
- **Core Web Vitals targets**: LCP < 2.5 s, CLS < 0.1, INP < 200 ms, and
  Lighthouse SEO/Performance/Accessibility/Best Practices ≥ 95 on mobile.
  - Use `next/image` with explicit sizes, and a `priority` hero image.
  - Load fonts through `next/font`.
  - Load Motion and embeds lazily (Twitch/YouTube players as click-to-load
    facades, not iframes on first paint). Motion is only in the lazily
    loaded cursor; keep it out of anything every page renders.
  - Keep the hero readable without JS.
- **Content structure**: one `<h1>` per page, a logical heading order,
  semantic HTML, descriptive link text and alt text, and internal links
  between About, Streams and Media kit.
- **Verify** with `curl | grep` on the rendered `<title>`, `<meta>`,
  `<link rel="alternate">` and JSON-LD, not only by looking at the page.
  Run Lighthouse on the production build (`pnpm build && pnpm start`), not
  on dev.

## Security (high priority)

Treat every change as security-relevant. Run the `security-review` skill
before merging anything that touches auth, the admin area, forms, webhooks,
cron routes, env handling or headers.

- **Security headers** (done, `feature_security-headers`):
  - **CSP with a per-request nonce, on every page** (decided 2026-09-26),
    built in `src/lib/security/csp.ts`:
    - `script-src 'self' 'nonce-…' 'strict-dynamic'`, plus
      `'unsafe-eval'` in dev only.
    - `style-src 'self' 'unsafe-inline'`, because React/Motion `style`
      attributes and sonner's injected `<style>` need it. Never add a nonce
      to `style-src`: browsers then ignore `'unsafe-inline'`.
    - `frame-src 'none'`, `frame-ancestors 'none'`, `object-src 'none'`,
      and `upgrade-insecure-requests` in production.
    - **Add origins only together with the feature that needs them**, with
      a comment. Currently `frame-src` = `player.twitch.tv`,
      `clips.twitch.tv`, `www.youtube-nocookie.com` (Streams page players).
      Video thumbnails do **not** need `img-src`: they load through our
      image optimizer (`images.remotePatterns`: `static-cdn.jtvnw.net`,
      `i.ytimg.com/vi/**`), so the browser only fetches same-origin
      images. `challenges.cloudflare.com` is in `script-src` (for pre-CSP3
      browsers; CSP3 ignores hosts next to `'strict-dynamic'`) and
      `frame-src` (Turnstile, inquiry form).
  - **How the nonce flows**:
    - `src/proxy.ts` sets the `Content-Security-Policy` **request** header
      (Next reads the nonce from it and applies it to its own scripts), the
      `x-nonce` request header, and the CSP response header.
    - next-intl's middleware gets a `new NextRequest(request, { headers })`
      and copies those headers into its rewrite/next response.
    - Layouts read `x-nonce` and pass it to `ThemeProvider`, because
      next-themes has an inline pre-paint script. **Any new inline script**
      (JSON-LD, analytics) needs `nonce={nonce}` too, or it's blocked.
    - Because the layout reads `headers()`, every page is dynamic. Don't add
      `generateStaticParams`, because static HTML can't carry a nonce and
      its scripts would be blocked.
  - **Static headers** are set in `next.config.ts` `headers()`: HSTS
    (production only, 2 years, `includeSubDomains; preload`; don't submit to
    hstspreload.org until every subdomain is HTTPS-only),
    `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`,
    `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, and
    a deny-all `Permissions-Policy`. `poweredByHeader: false`.
  - **Verification** (repeat after header changes): the curl header list;
    every `<script>` carrying the header's nonce; a Playwright run that
    listens for `securitypolicyviolation` events and console errors on
    `/en`, `/de` and both 404s, in prod **and** dev. Check
    securityheaders.com after deploy.
  - **Proxy matcher**: no backslashes in `config.matcher` source strings.
    The production build turned `\.` into `.`, so `.*\..*` excluded every
    path but `/` and the CSP silently vanished from all pages (dev was
    fine). Use `[.]`. After **any** matcher change, check the CSP header
    on a production build (`pnpm build && pnpm start`), not in dev.
- **Authorization everywhere**: every Server Action and route handler
  re-checks the session and role itself (`requireAdmin()`/`requireStaff()`).
  `proxy.ts` is only the first gate. Server Actions are public POST endpoints,
  so treat them that way.
- **Validate all input with zod** on the server, including action arguments,
  query params, webhook payloads and env vars. Env vars are validated once in
  `src/lib/env.ts`: `env()` is lazy (so the Docker build still works) and
  server-only, and its errors name the variables without echoing their
  values. Every new server env var goes into its zod schema. Read it with
  `env()`, never `process.env` directly (except `prisma7.config.ts` and
  scripts).
- **Secrets**: never in `NEXT_PUBLIC_*`. Server-only modules
  `import "server-only"`. Never commit `.env`. Error responses and toasts
  never leak stack traces, SQL or env values (log details server-side,
  return generic messages).
- **Sponsor inquiry form** (decided: inquiries are **stored in the DB and
  managed in `/admin`**, not sent by email):
  - The `inquiries` module owns the `Inquiry` table (company, contact name,
    email, budget range, message, status `new`/`in_progress`/`done`/`spam`,
    timestamps).
  - `/admin/inquiries` has a list with status filter, a detail view, status
    changes and delete, all gated by `requireStaff()`.
  - Inquiries contain personal data (GDPR): collect only the fields needed,
    add a privacy notice next to the form, and delete inquiries that are
    done or spam after a fixed period (for example 12 months).
  - Use Cloudflare Turnstile (verified server-side) plus a honeypot field.
  - Rate-limit per IP (use `CF-Connecting-IP` behind Cloudflare, not
    `X-Forwarded-For` alone).
  - Enforce length limits, and escape all output. Never render inquiry text
    as HTML.
- **XSS**: no `dangerouslySetInnerHTML` except JSON-LD, which is serialized
  with `JSON.stringify(...).replace(/</g, "\\u003c")`. Admin-edited rich text
  is stored as Markdown/plain text and rendered through a sanitizing renderer.
- **Webhooks and cron**: verify the HMAC over the raw `request.text()` body
  with `timingSafeEqual`, and reject stale timestamps and replayed message IDs.
  Cron routes need a `CRON_SECRET` bearer token (compared in constant time).
  Use plain-hex secrets.
- **Least privilege** (set up 2026-09-26 with `pnpm db:setup-roles`,
  `scripts/setup-db-roles.ts`):

  | Role | Rights | Used as |
  | --- | --- | --- |
  | `aboutselphy_main` | owns schema `main` only | `DATABASE_URL` |
  | `aboutselphy_auth_reader` | read-only `SELECT` on `auth.session` and `auth."user"` (not `account`), 5 s statement timeout | `AUTH_DATABASE_URL` here and in Social |
  | `aboutselphy` | owns `public` and `auth` | auth service only, never this app |

  `PUBLIC` has no `CONNECT` on the database any more. To rotate passwords,
  run `pnpm db:setup-roles --rotate` as the postgres superuser
  (`ADMIN_DATABASE_URL`). API keys are restricted (the YouTube key is
  limited to the Data API).
- **Dependencies**: pin exact versions for framework and auth packages, run
  `pnpm audit --prod` before each release, and add no new packages without
  a reason. Known state (2026-09-27):
  - `pnpm-workspace.yaml` overrides `mysql2` to `^3.24.4`. prisma@7.10.0
    pins 3.15.3 (high CVE), which is used only by Prisma Studio for MySQL.
    Remove the override once a Prisma release ships a fixed version.
  - **Accepted**: `deepmerge-ts` < 8 (stack exhaustion on recursive
    objects) inside `@prisma/config`. It only merges this project's own
    Prisma config, never untrusted input. The fix is a major bump inside
    Prisma, so wait for Prisma to take it.
- **Uploads** (if any, e.g. partner logos): check type by magic bytes, cap
  size, re-encode images, and never serve user-uploaded SVG inline.

## Deployment (Dokploy)

- **`Dockerfile`** (done, tested locally 2026-09-27): three stages
  (`deps` → `builder` → `runner`) on `node:22-alpine`, like Social, and not
  `standalone`, because the runner needs the prisma CLI.
  - The runner starts with
    `node_modules/.bin/prisma migrate deploy && exec node_modules/.bin/next start`.
    The binaries are called directly, not through `pnpm`: pnpm and the other
    package managers are deleted from the runner, and corepack cached pnpm
    in root's home anyway.
  - It runs as the unprivileged **`node`** user. Only `.next` is owned by
    `node` (`COPY --chown`, never `RUN chown -R`, which stores the files
    twice).
  - The runner's install layer deletes the pnpm store, root's caches, and
    npm/npx/yarn/corepack/pnpm. That brings the image from 2.09 GB to
    1.43 GB and removes npm's bundled high CVEs. Docker Scout shows **no
    high/critical vulnerabilities** in the image.
  - `NEXT_PUBLIC_SITE_URL` is the only build arg (default production URL),
    and the Dockerfile carries it into the runtime stage. See "Environment
    variables" for what goes into which Dokploy field.
  - `HEALTHCHECK` calls `/api/health` (`SELECT 1` with a 3 s timeout,
    200/503, no error details). The first check during the 30 s start period
    fails while `migrate deploy` runs, which is expected. Use
    `/api/health` as Dokploy's health check path too.
  - `shadcn` is a devDependency: it's only needed at build time for
    `@import "shadcn/tailwind.css"`, and it pulls in TypeScript/ts-morph.
- **Test the image locally** before merging Dockerfile changes (Docker
  Desktop is installed per-user at
  `%LOCALAPPDATA%\Programs\DockerDesktop`):
  1. Build from a **fresh clone of the pushed branch** (`git clone --depth 1
     -b <branch> …` into the scratchpad), **never from the working tree**.
     Dokploy builds from a clone, and the working tree hides problems: an
     empty `public/` existed locally but not in git, so the first Dokploy
     build failed on `COPY /app/public` (fixed with `public/.gitkeep`;
     delete it once real assets exist). Build with no env set, which also
     proves the lazy clients.
  2. Run it with `--env-file`, using an **unquoted** copy of `.env.local`
     (docker keeps the quotes) that is deleted after the run.
  3. Check the logs (`migrate deploy`), `/api/health`, `docker inspect`
     health, a page load, and the Playwright CSP check against the
     container.
  4. Scan with `docker scout cves <image> --only-severity critical,high`.
  5. Remove the container and image.
- **Every runtime directory needs an explicit `COPY`** in the runner stage
  (`public/`, `src/generated`, `prisma/`, `prisma7.config.ts`,
  `next.config.ts`). A missing copy fails silently.
- **Lazy clients**: any `src/lib/*` singleton that reads env vars (Prisma,
  pg Pool, Redis) must be built on first use (the `Proxy` pattern in Social's
  `src/lib/prisma.ts`). `docker build` has no runtime env, so eager
  construction crashes `next build`. Pages that read the DB use
  `export const dynamic = "force-dynamic"`.
- **Webhooks behind Cloudflare** (Twitch EventSub and anything later): add a
  path-scoped WAF rule that skips Bot Fight Mode **up front**. Otherwise
  deliveries get challenged silently. Verify webhook signatures against the
  raw `request.text()` body with `timingSafeEqual`. Use plain-hex secrets.
- Log every webhook branch. Silent success paths made the Social Twitch
  webhook impossible to debug.
- Images and assets in `public/` must be committed, because Dokploy builds
  from the repo.

## Git and GitHub (same pattern as Social)

- The repo is `git@github.com:MadeByLukeDEV/AboutSelphy2026.git`, with
  commit author `madebyluke <aboutselphy@gmail.com>` (set in the repo's
  git config). History is linear like Social's: push the branch, then
  `git merge --ff-only` it into `main` and push `main`. Don't merge a branch
  whose verification hasn't run yet. **Never open a PR without asking.**
- Put every feature or fix on its own branch off `main`: `feature_<name>`,
  `fix_<name>`, `chore_<name>`, `content_<name>`, `docs_<name>` (snake prefix
  + kebab name, e.g. `feature_mediakit-page`, `fix_docker-build-lazy-clients`).
  Work on the same module or component stays on one branch. A different
  module gets a new branch.
- Use Conventional Commits with the module as scope:
  `feat(mediakit): …`, `fix(auth): …`, `docs: …`, `chore: …`, `content(about): …`.
  Keep each commit small and to one logical change, with a detailed body. Don't
  make one giant commit per branch.
- Update this CLAUDE.md (feature status plus any hard-won lessons) in the same
  branch as the feature.
- `AGENTS.md` is regenerated by `next dev`. Commit it and don't fight it.

## Claude skills and plugins to use

Use these and don't skip them:

| When | Skill / plugin |
| --- | --- |
| Any new page, section or visual direction | `frontend-design:frontend-design` |
| Layout, UX, palettes, font pairing, component UX review | `ui-ux-pro-max:ui-ux-pro-max` |
| shadcn/Tailwind components, theming, dark mode | `ui-ux-pro-max:ui-styling` |
| Design tokens / fluid scale in `globals.css` | `ui-ux-pro-max:design-system` |
| Brand voice, About copy, media kit wording | `ui-ux-pro-max:brand` |
| Hero, banner, social and OG visuals | `ui-ux-pro-max:banner-design`, `ui-ux-pro-max:design` |
| Media kit stats, dashboard charts, stat tiles | `dataviz` |
| Media kit PDF export | `anthropic-skills:pdf` |
| Design critique before shipping a page | `claude-mem:design-is` |
| Prisma schema, client, migrations, adapter | project skills in `.claude/skills/` (`prisma-cli`, `prisma-client-api`, `prisma-database-setup`, `prisma-driver-adapter-implementation`, `prisma-upgrade-v7`) |
| Multi-step features | `claude-mem:make-plan` → `claude-mem:do` |
| Before merging | `code-review`, `security-review` (auth, webhooks, forms), `simplify` |
| Seeing the running app / screenshots | `run` |
| Figma designs | Figma MCP (`/figma-use` before `use_figma`) |
| Past decisions from Social or Auth sessions | `claude-mem:mem-search` |

## Commands

```
pnpm dev -p 3002                   # dev server (auth service runs on another port)
pnpm build / pnpm start
pnpm lint
pnpm exec prisma migrate deploy    # apply migrations
pnpm exec prisma generate          # regenerate client
pnpm exec prisma studio
```

## Environment variables

Keep `.env.example` complete and commented, as in Social. Locally
everything lives in `.env.local`. Every server variable is validated in
`src/lib/env.ts`, and **defaults are the production values**, so Dokploy
only needs what has no safe default.

**Dokploy** (verified 2026-09-27 with a fresh-clone image and only these
three variables set):

| Dokploy field | Variables |
| --- | --- |
| Build-time Arguments | none. `NEXT_PUBLIC_SITE_URL` defaults to `https://aboutselphy.com` in the Dockerfile; set it only for another domain. |
| Build-time Secrets | none. The build needs no secrets and no database (lazy clients). |
| Environment (runtime) | `DATABASE_URL` (`aboutselphy_main`, internal host), `AUTH_DATABASE_URL` (`aboutselphy_auth_reader`, internal host), `BETTER_AUTH_SECRET` (same as the auth service). For the stats sync also: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `YOUTUBE_API_KEY` (same as the Social app), `CRON_SECRET` (new plain hex). For YouTube Analytics: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` |
| Schedules (Dokploy "Schedules" tab, runs inside the container) | every 5 minutes (`*/5 * * * *`): `wget -qO- --post-data="" --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/stats` |

Optional runtime variables that default to production: `DATABASE_SCHEMA`
(`main`), `AUTH_URL` (`https://auth.aboutselphy.com`),
`AUTH_DATABASE_SCHEMA` (`auth`), `AUTH_COOKIE_PREFIX` (`better-auth`).
`NEXT_PUBLIC_SITE_URL` is carried from the build into the runtime stage
by the Dockerfile. **Never set it as a runtime variable in Dokploy**: a
value that differs from the build's would disagree with the
robots/sitemap/client JS baked at build time. `NEXT_PUBLIC_ROOT_DOMAIN`
was removed because this app has no subdomain logic.

When a feature adds variables, add them to `env.ts` (with a production
default where one is safe), `.env.example`, and this table.

Variables planned for later phases:
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_LOGIN`,
  `TWITCH_WEBHOOK_SECRET`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` (the
  media kit's data sources. Features render a placeholder when these are
  unset, as with `isTwitchConfigured()` in Social)
- Phase 8 (in `env.ts` since 2026-09-29, all optional): `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET` (YouTube Analytics OAuth, own client, redirect URI
  `<site>/api/youtube/callback` for prod and localhost:3002),
  `TOKEN_ENCRYPTION_KEY` (64 hex). The consent screen must be **"In
  production"**: in "Testing", Google expires refresh tokens after 7 days.
- `CRON_SECRET` (stats sync)
- `TURNSTILE_SITE_KEY` (public, rendered by the server) and
  `TURNSTILE_SECRET_KEY` (inquiry form, in use since 2026-09-28). Optional
  `TURNSTILE_HOSTNAMES`. In Dokploy, set only the production hostname,
  never localhost.
- `REDIS_URL`: used for the inquiry rate limit (optional, fails open).
  Later it could back a shared Next cache handler, if the app ever runs
  more than one container.

  Reuse the shared instance, and every call must fail soft (Social's
  lessons: ACL `NOPERM` flakiness, `enableReadyCheck: false`). Add it to
  `env.ts` together with its first use.

## Open decisions

- Phase B questions (viewer auth, points source, dashboard URL) are
  deliberately postponed until Phase A is done.

## Feature status

SEO and security are built into every phase, not saved for the end.

- [x] Phase 0 (done 2026-09-27): git repo, Next.js 16 scaffold, shadcn
      (`base-nova`), Motion, Tailwind tokens (brand color, font, fluid
      scale), module skeleton, locale-prefixed i18n, theme, effects layer,
      Prisma + Postgres (schema `main`, least-privilege roles), security
      headers + CSP nonce, `env.ts`, root metadata, robots/sitemap/manifest,
      placeholder icons, Dockerfile (tested, builds on Dokploy)
- [x] Phase 1 (done 2026-09-27): central auth (`modules/auth`, proxy gate +
      `requireStaffPage`/`requireStaff`/`requireAdmin`), `/admin` shell
      (full width, sidebar, overview), sign-out via the auth service
- [ ] Phase 2: Home / About
  - [x] `profile` module: `Profile` (singleton, de/en tagline + bio) and
        `Game` (status main/regular/new/former, de/en blurb, tags) tables,
        seeded; `getHomeContent(locale)` cached with `unstable_cache`, tag
        `profile` (not `use cache`: it needs PPR, which breaks the nonce
        CSP). Admin saves must call
        `revalidateTag(PROFILE_CACHE_TAG, { expire: 0 })`.
  - [x] Home page: hero (monogram avatar, name, tagline, Twitch/YouTube/
        link-tree links with `rel="me"`), About, "What I play"; shared
        `SiteHeader`; `WebSite` + `Person` (`sameAs` = `CHANNELS`) +
        `ProfilePage` JSON-LD via the `JsonLd` component (nonce, `<`
        escaped). Production server response ~15 ms.
  - [x] Avatar + banner (2026-09-27): committed static files in
        `public/profile/` (avatar 800x800, banner 1640x664 PNG), not
        uploads -- the user chose to drop them into the repo. Replace a file
        (same name) and deploy to change it. Paths in
        `modules/profile/images.ts`. Served via next/image: AVIF/WebP,
        banner 857 KB -> 6 KB (phone) / 22 KB (desktop); banner `preload`
        (Next 16 replaced `priority`); `images.localPatterns` limits the
        optimizer to `/profile/**`. Channel-page hero: banner with the
        avatar overlapping its edge (`relative z-10`, or the banner paints
        over it). Avatar is the Person JSON-LD `image`.
  - [x] Admin "About" editor (`/admin/about`): display name, tagline and bio
        in en/de side by side, react-hook-form + zod (`modules/profile/
        schema.ts`, error messages are i18n keys), live character counts.
        `saveProfileAction` re-checks `requireAdmin()` and re-validates,
        returns error codes only, and clears the cache via
        `revalidateTag(PROFILE_CACHE_TAG, { expire: 0 })`. Moderators see the
        page read-only.
  - [ ] Games editing in admin (or with Phase 4)
- [x] Phase 3 (done 2026-09-27): `stats` module
  - Tables: `StatSnapshot` (platform/metric/value/capturedAt),
    `StreamSession` (one Twitch broadcast with running viewer aggregates:
    average = viewerSum / sampleCount, peak, start to last sample), `SyncRun`
    (every run's outcome, for the admin view).
  - `runSync()` (`modules/stats/sync.ts`), each step failing on its own:
    - **every run**: Twitch `streams`. If live, add a viewer sample (skipped
      if the last one is < 4 min old, so "Sync now" can't double-count).
    - **hourly**: Twitch follower total and YouTube subscribers/views/videos.
    - **daily**: YouTube average views of the last 10 uploads.
    - It clears the `stats` cache tag.
  - Triggers:
    - `POST /api/cron/stats`: bearer `CRON_SECRET`, constant-time compare,
      POST only, 503 without a secret. Called every 5 min by a **Dokploy
      schedule inside the container** via `http://127.0.0.1:3000`, so no
      Cloudflare and no public webhook.
    - The staff-only "Sync now" button in `/admin/stats`.
  - **No Twitch EventSub**: polling every 5 minutes is enough for averages
    and the live badge. Add EventSub only if instant live detection
    matters (it needs a public callback plus the Cloudflare Bot Fight Mode
    skip rule, see Social).
  - Checked facts: the follower total works with an **app** token.
    `channels.list` costs 1 quota unit. The Twitch schedule
    (`/helix/schedule`) is empty, so Phase 5 uses our own schedule.
  - **`unstable_cache` stores JSON**: never cache a raw Prisma row with a
    `BigInt` (or `Bytes`) column. `latestSession()` returned the whole
    `StreamSession` (BigInt `viewerSum`), and while live every page threw
    `Do not know how to serialize a BigInt` in production (2026-09-28, the
    first sampled stream). Select or map to plain fields first.
  - Read side: `getLiveStatus()` (a session sampled in the last 11 min =
    live, computed outside the cache) and `getStatsOverview()` (latest per
    metric + 30-day Twitch aggregates), both cached under tag `stats`.
  - UI:
    - `/admin/stats`: live status, latest numbers with "as of", Twitch 30
      days, the last 10 runs, and the setup checklist.
    - Home hero: "Live now" badge (game + title, links to Twitch).
- [x] Phase 4 (done 2026-09-28): Streams page `/[locale]/streams`
  - `MediaItem` (kind twitch_vod/twitch_clip/youtube_video/youtube_short),
    written by two hourly sync steps. Each kind is replaced in one
    transaction, so expired VODs disappear, and a failed fetch keeps the
    old list. The "mediaItems" snapshot is the freshness marker.
  - What's fetched:
    - Twitch: 12 latest VODs (processing ones skipped) and the top 12
      clips of all time (Helix sorts clips by views).
    - YouTube: the latest 30 uploads via the uploads playlist (`UU` +
      channel id minus `UC`), public and embeddable only. Up to 180 s
      counts as a Short.
    - Shorts use the vertical `oar2.jpg` thumbnail (undocumented, so
      HEAD-checked with a fallback to 16:9).
    - The channel is mostly Shorts (29 of 30 uploads).
  - UI (`modules/streams`):
    - A click-to-load `VideoFacade`: an optimized thumbnail plus a play
      button, and the iframe only after a click. Labels are passed as
      props, so there's no client message namespace.
    - Twitch embeds need `parent` = the site's hostname (from `siteUrl()`).
    - Sections: live (channel player) or offline note, past broadcasts,
      top clips, YouTube videos and Shorts (9:16 grid).
    - `VideoObject` JSON-LD for YouTube items; header nav (`SiteNav`) with
      active state; `/streams` in `PUBLIC_PAGES`.
  - **YouTube API key restriction**: it must be "IP addresses" (the server
    IP) or none. **"HTTP referrers" breaks every server call** (403
    `API_KEY_HTTP_REFERRER_BLOCKED`: server requests have no referrer).
- [x] Games editing (`/admin/games`, admin only):
  - List with up/down reorder (the repository rewrites a clean 0..n
    `sortOrder`), add/edit dialog (name, status, en/de blurb, tags
    comma-separated, max 6 × 30 chars), and delete with confirmation.
  - Slugs are generated from the name and made unique with a -2/-3
    suffix.
  - Categories (2026-09-28): main, regular ("Also playing"), occasional
    ("Sometimes"), new, planned ("Coming soon"), former. Separately, a
    **"Show on home page"** switch per game (`showOnHome`, default on;
    toggle directly in the list or in the dialog). Hidden games stay
    available to the schedule. `GameStatus` is derived from
    `GAME_STATUSES` in `schema.ts`.
  - `src/components/ui/switch.tsx` came from `shadcn add switch` with a
    broken `import { cn } from "cn"` and px sizes; fixed to `@/lib/utils`
    and rem. Check that import after adding any shadcn component.
  - Actions check **auth before validation**, return the fresh list for
    client state, and clear the `profile` cache tag.
  - Status uses `FormSelect` (see Frontend conventions).
  - **Covers** come from Twitch box art, not uploads:
    - On save, `findTwitchGame()` (`src/lib/platforms/twitch.ts`) looks the
      game up by `twitchCategory` or else `name`, storing `twitchGameId` and a
      285x380 `boxArtUrl` (only from `static-cdn.jtvnw.net`). Twitch's own
      names can differ, e.g. "Hunt: Showdown 1896" and "WARDOGS"; exact
      name lookup still matched all four games.
    - A failed lookup never blocks the save. The sync's "game covers" step
      fills missing ones hourly.
    - **Custom upload** (2026-09-28) takes priority over the Twitch art:
      "Upload cover" / "Replace cover" / "Use Twitch cover" per game in
      `/admin/games` (admin only).
    - All covers are **square (1:1)** and one size per place (`w-20` home,
      `w-12` admin and schedule). The main game is marked only by the brand
      rule. Twitch box art (3:4) is cropped to the centre. `GameCover` needs
      `self-start` in its base class: in a flex row it otherwise stretches
      to the row height and stops being square.
    - The public schedule shows each stream's game cover too (the schedule
      repository selects `boxArtUrl`/`customCoverId`; uploaded cover wins).
    - `GameCover` gets `src` (the uploaded cover, else the Twitch art),
      and shows initials when there's neither.
  - **Uploads** (`modules/assets`, reused for partner logos later):
    - Stored as `Asset` rows in the DB (bytea; the container has no
      persistent disk) and served by `/api/media/[id]` (immutable cache,
      `nosniff`, cuid-checked id).
    - `storeImage()` rejects anything over 4 MB or not decodable as
      JPEG/PNG/WebP/AVIF/GIF. The format is detected from the bytes, so SVG
      and disguised files are rejected; `limitInputPixels` guards against
      decompression bombs.
    - It re-encodes to WebP (EXIF stripped, 400x400 for covers). Replaced
      or removed covers delete their asset.
    - `experimental.serverActions.bodySizeLimit: "5mb"`, and
      `/api/media/**` is in `images.localPatterns`.
    - `sharp` is a direct dependency (0.35.4, prebuilt, no install
      script). **pnpm glitch**: it wrote the project entry as `0.35.4`
      although only the `0.35.4(@types/node@…)` snapshot exists (optional
      peer), so `node_modules/sharp` pointed nowhere. Fixed by hand in
      `pnpm-lock.yaml`; check `require("sharp")` after touching it.
  - Platform clients live in **`src/lib/platforms/`** (moved from
    `modules/stats`), so `profile` and `stats` can both use them without a
    module cycle. `stats` depends on `profile` only for
    `fillMissingGameArt()`.
  - Slugs strip accents with `p{Diacritic}/gu`. The file tools turn
    `̀` escapes into literal characters, so avoid those escapes.
- [x] Phase 5 (done 2026-09-28): schedule (`modules/schedule`), a weekly
      plan plus exceptions (the user's choice)
  - Tables:
    - `ScheduleSlot`: weekday 1–7, `startTime` "HH:mm" and duration in
      Europe/Vienna, optional game (SetNull) and en/de title, active.
    - `ScheduleException`: `cancelled` (slot + date, unique, cascade on
      slot delete) or `extra` (date, time, duration, game, title). Both
      have an optional public en/de note. Moving a stream = cancel + extra.
    - Hand-added CHECK constraints for weekday, time format, duration and
      the shape of each exception kind.
  - Time zones:
    - `time.ts` converts Vienna wall-clock time to instants without a
      library, via `Intl`. DST verified in both directions and around
      midnight.
    - `@db.Date` values are Vienna calendar dates stored as midnight UTC.
  - `occurrences.ts` (`computeOccurrences`, pure and tested) builds the
    next 7 days (`SCHEDULE_DAYS`, the user's choice) from the cached plan (tag `schedule`, fallback 600 s).
    Ended streams drop out, one in progress stays, and a missing title
    falls back to the other language.
  - Public:
    - Times on `/[locale]/schedule` are shown in the **visitor's time zone**
      (`StreamTime`, a client component: Vienna on the server and the first
      render, then the browser zone via `useSyncExternalStore`, with the
      zone name). Day headings stay Vienna dates.
    - "Next stream" (home hero, Streams page) also uses the visitor's zone
      plus a live **countdown** (`src/components/time/`: `LocalDateTime`,
      `Countdown`, shared `useBrowserZone`/`useNow` ticker). The countdown
      renders nothing on the server (it depends on the current second) and
      appears after hydration; its texts are the `Countdown` namespace in
      the public `clientMessages`.
    - **@mentions** in titles and notes (`mentions.ts`, pure): `@name`
      (4–25 of `[A-Za-z0-9_]`, not after a word char or `@`, so e-mails
      are skipped) links to `twitch.tv/name` via `WithMentions` (React
      text + anchors, never HTML). The admin title hint explains it.
    - `/[locale]/schedule`: days with Today/Tomorrow, "On now", "Cancelled"
      (struck through, with note) and "Extra stream".
    - `Event` JSON-LD per stream (`EventCancelled` for cancelled ones,
      `VirtualLocation` = Twitch). Nav entry and sitemap.
    - "Next stream" in the home hero (only while offline) and on the Streams
      page.
  - Admin `/admin/schedule`: **staff (moderators too)** can edit.
    - Weekly slot dialog (weekday, time, minutes with the end time shown,
      game, titles, active).
    - Cancel dialog: pick a date, then only slots on that weekday are
      offered. The server rechecks the weekday and rejects past dates.
    - Extra-stream dialog, and a list of upcoming changes with delete.
    - Starts empty: the user enters the real plan.
- [x] Phase 6 (done 2026-09-28): Media kit (API stats, growth charts,
      partners, packages, PDF, OG card) + inquiry form (Turnstile) with
      `/admin/inquiries`
  - [x] Page, step 1 (2026-09-28, `modules/mediakit`): audience + growth.
    - Opens with a **sentence built from the live numbers** (Twitch
      followers, YouTube subscribers, average views of the last 10
      uploads) instead of big-number tiles; left out if one is missing.
    - Twitch and YouTube cards list each figure with its own "as of" time.
      Twitch 30-day viewer figures say "Not measured yet" until a stream
      has been sampled (never 0). Counts are exact below 10,000, compact
      above (German CLDR has no short thousands form, so de shows 86.095).
    - Growth: `getGrowthSeries()` in `stats` (raw SQL, last value per
      Vienna day, 90 days, cached under `stats`). One chart per metric
      (Twitch followers, YouTube subscribers), shown only from 7 daily
      points (`MIN_GROWTH_DAYS`). `GrowthChart` is a small SVG client
      component: crosshair tooltip on hover and arrow keys, "Show as
      table", colour token `--chart-line` (#007a50 light, #00b07a dark,
      both validated with the dataviz script; the pure brand green fails
      its dark lightness band). Date labels are HTML, not SVG text, which
      would shrink with the chart on phones.
    - Current games (main/regular/occasional/new, home-page switch on).
    - Still `noindex`, not in nav/sitemap until the PDF and the OG card
      exist (step 3).
  - [x] Step 2 (2026-09-28): partners and packages.
    - Tables `Partner` (name, https link, optional referral code, en/de
      description, logo asset, `visible`, order) and `Package` (en/de title
      and description, `priceFrom` in whole euros or null = "price on
      request", `visible`, order). Hand-added CHECKs: partner url starts
      with `https://`, price 0–1,000,000.
    - `/admin/partners` ("Partners & packages", admin only): list with
      reorder, "Show in media kit" switch, add/edit dialog, delete, logo
      upload. Hidden entries can be prepared (the user is still testing
      Dubby Energy). Real partners so far: Exitlag and Dixper (referral
      codes), entered by the user.
    - Partner url: trimmed, must start with lowercase `https://` (the DB
      CHECK is case-sensitive), `z.url` https, no username/password.
      Codes `[\w-]`.
    - Logos: `LOGO_PRESET` (`fit: "inside"` 400x200, never cropped,
      transparency kept); `storeImage` now stores the real output size.
      A logo that can't be attached is deleted again.
    - Public: "Partners" cards (logo, description, code with a copy
      button, link with `rel="sponsored noopener noreferrer"`, new tab)
      and "Packages" (price "from €150" / "Price on request", link to the
      form). Each section is left out while it has nothing visible.
    - Security review: nothing significant; its two hardening notes
      (credentials in URLs, orphaned logo) are applied.
  - [x] Step 3 (2026-09-28): count-up, share cards, PDF, going public.
    - Numbers count up (`CountUp`, see Frontend conventions).
    - Share cards (next/og, Plus Jakarta Sans 400/700/800 via
      `loadBrandFonts()`):
      - `[locale]/opengraph-image.tsx`: default card for every public page
        (banner, avatar, name, site description). Only committed files, so
        `generateStaticParams` prerenders it per locale at build (it's
        ~850 KB; pages themselves still have no generateStaticParams).
      - `[locale]/mediakit/opengraph-image.tsx`: live headline numbers
        and "as of", `force-dynamic` (reads the DB, never at build).
    - PDF: `GET /{locale}/mediakit/pdf` (`modules/mediakit/pdf.tsx`,
      `@react-pdf/renderer` 4.9.0 pinned; chosen over pdf-lib for flexbox
      layout). A4, one page with the current data in both languages;
      contact links sit in the dark header band. WebP logos and the avatar
      are re-encoded to PNG with sharp (react-pdf can't read WebP).
      Memoized per locale until the data changes; `attachment`
      download, `X-Robots-Tag: noindex` (the page is canonical), generic
      503 on failure. The page has a "Download PDF" button (plain `<a
      download>`, not a Link).
    - Fonts: static Regular and Bold TTFs added next to ExtraBold (from
      tokotype/PlusJakartaSans, OFL). The Dockerfile runner now has
      `COPY src/assets` (request-time cards and the PDF read them).
    - Public: `noindex` removed, "Media kit" in the nav, `/mediakit` in
      `PUBLIC_PAGES`, full `openGraph` in its metadata, 159/160-char
      descriptions. Verified on a prod build: robots/og tags, sitemap,
      both cards, both PDFs, download, no console/CSP errors.
    - Checking PDFs locally: `python -m pip install --user pypdfium2`,
      render pages to raw pixels and encode with sharp (no Pillow here).
  - **Shared DB + migrations**: `migrate deploy` from a dev machine changes
    the production database before production runs the new code. Adding
    enum values broke reads in any process with an older Prisma client
    (`P2023 Value occasional not found in enum`), including a dev server
    started before `prisma generate`. Deploy right after merging a
    migration, and restart the dev server after `generate`.
  - [x] Inquiry form + inbox (2026-09-28, `modules/inquiries`):
    - Budget ranges are small-creator sized (under €100, €100–250,
      €250–500, over €500, product or game key only, unsure; changed
      2026-09-28, migration `smaller_inquiry_budgets`).
    - `Inquiry` table: company, name, email, budget enum, message ≤ 3000,
      locale, status new/in_progress/done/spam. No IP address stored.
    - `submitInquiryAction` (public) checks in this order: honeypot
      (`website` field, filled = fake success, nothing stored), zod, a
      per-IP rate limit (5/h in Redis, key = sha256 of the IP, fails
      **open**), Turnstile siteverify, then store. Errors are codes only.
    - **Turnstile** (`turnstile.ts`, Cloudflare's canonical siteverify):
      it requires `success`, action `inquiry` and a hostname from
      `TURNSTILE_HOSTNAMES` (default: the host of `NEXT_PUBLIC_SITE_URL`),
      with a 10 s timeout and tokens ≤ 2048 chars. Verified with
      Cloudflare's test secret: a `success: true` token for example.com is
      still rejected (wrong hostname, and without an action).
    - Widget (`turnstile-widget.tsx`): explicit render, **`api.js` gets the
      request's CSP nonce** (Cloudflare's recommended CSP setup; without it
      the widget didn't work), theme auto, visitor language, and a reset
      after every attempt (tokens are single-use). An error callback shows
      "Try again". The widget's own `eval` probe is blocked by our CSP,
      which is harmless (Cloudflare lists no `unsafe-eval` requirement).
    - **Automated browsers can't pass Turnstile** (headless and headed
      Playwright both get "verification failed" or an interactive check
      that detaches). The real-token end-to-end test must be done by hand
      in a normal browser.
    - `/[locale]/mediakit` holds only the form so far: **`noindex`, not in
      the nav or the sitemap** until the full media kit exists. The form
      texts come from a nested `NextIntlClientProvider` (`Inquiry`) on this
      page only.
    - `/admin/inquiries` (staff): status filter with counts, full text
      (`whitespace-pre-wrap`, never HTML), a mailto reply, status select
      and delete.
    - GDPR retention: `purgeOldInquiries()` runs with every cron call and
      deletes done/spam inquiries whose last change is > 12 months old
      (tested).
    - `src/lib/redis.ts`: a lazy ioredis client (Social's settings, no ready
      check), prefix `aboutselphy:main:`. The ACL user has
      SET/GET/INCR/EXPIRE/DEL on it (checked).
    - Legal pages: see "Legal pages" below. The form's privacy note links
      to the policy once it's published.
- [ ] Legal pages (built 2026-09-29, **not published yet**: the user must
      enter the operator details and replace the draft's TODO: markers)
  - `modules/legal`, table `LegalSettings` (singleton, CHECK id = 1):
    operator name/street/postal code/city/country/email/phone, optional
    extra Impressum text (Markdown, en/de), privacy policy (Markdown,
    en/de, up to 30,000 chars), `published`.
  - `/admin/legal` (admin only). The zod schema's `superRefine` blocks
    publishing while an operator field is empty or any text still contains
    `TODO:`; the server action re-runs it.
  - Public `/[locale]/imprint` (built from the operator fields: § 5 ECG /
    § 25 MedienG) and `/[locale]/privacy` (controller block + Markdown).
    Both `notFound()` until published; not in the sitemap (it's built at
    build time, without the DB).
  - `SiteFooter` (new, in the `[locale]` layout): copyright, plus the two
    links once published. The inquiry form links to the policy then too.
  - Markdown: `react-markdown` 10.1.0 (pinned) with `skipHtml`, an element
    allowlist (h2/h3/p/lists/a/strong/em/br/hr) and its default URL
    transform (only http(s)/mailto/relative survive). Tested: script, img,
    onerror and `javascript:` links are removed.
  - Privacy draft: `scripts/legal-drafts/privacy.{en,de}.md`, written from
    what the site actually does (Cloudflare, Turnstile, inquiry retention,
    hashed-IP rate limit, the one `NEXT_LOCALE` session cookie, theme in
    localStorage, self-hosted fonts, click-to-load Twitch/YouTube, no
    tracking). TODO: markers for the hosting provider and log retention.
    `pnpm db:seed-legal` inserts it (insert-only, never publishes); it ran
    on 2026-09-28. **Update the draft when the site starts processing data
    differently** (analytics, new embeds, new forms).
  - Security review: nothing significant.
  - **Dev data cache** lives in `.next/dev/cache/fetch-cache` (Next 16 dev
    builds into `.next/dev`). A direct DB edit doesn't clear a tag, so
    delete that folder and restart the dev server to see it.
- [x] Phase 7 (2026-09-29): SEO and security audit
  - **Lighthouse mobile** (prod build, 2 runs each), before -> after:
    performance 61-89 -> 87-93, accessibility 96-100, best practices
    96-100 -> 100, SEO 92 -> 100, CLS 0 everywhere. Locally the observed
    LCP is ~0.9 s; the simulated 3.0-3.4 s is Lighthouse's slow-4G model,
    where the remaining cost is React's own hydration (~570 ms throttled
    CPU). Performance stays just under the 95 target; re-measure on the
    live site (Cloudflare, brotli) after deploy.
  - What moved the numbers: Motion + effects out of the public bundle
    (CSS-only background, cursor code only for fine pointers), no sonner
    on public pages, one font subset, `fetchPriority` on the banner, the
    inquiry form and Turnstile loaded only near the form, and a static
    (not counting) media kit headline, which is its LCP element.
  - **Measuring locally**: build and start with
    `NEXT_PUBLIC_SITE_URL=http://localhost:3005`, or the SEO "canonical"
    audit fails (canonical from the env, hreflang Link header from the
    request host). Chromium from Playwright via `CHROME_PATH`, then
    `npx -y lighthouse@13.5.0 ... --output=json`.
  - Streams accessibility 96: axe measures `.reveal` cards that are
    mid-fade at the bottom edge. Real visitors see them opaque in view.
  - **Structured data**: `BreadcrumbList` added (`PageBreadcrumbs`, before
    `<main data-enter>`, never inside). Every JSON-LD block on the public
    pages parses and has Google's required fields (checked by script).
    Google's Rich Results Test itself needs the live URL: run it by hand.
  - **Security headers**: production sends CSP (nonce), HSTS (preload),
    X-Frame-Options, X-Content-Type-Options, Referrer-Policy and
    Permissions-Policy, which securityheaders.com rates A+ (it blocks
    automated requests; check by hand). Expected warning: style-src
    'unsafe-inline' (see Security).
  - **Whole-app security review**: nothing critical or high. Fixed:
    image optimizer bounded (prefixes, `qualities`, 200 MB cache),
    share card + PDF rendered once per data change (shared in-flight
    promise, cache headers), rate-limit expiry self-heals, `errorInfo()`
    logging (`src/lib/log.ts`), FormData check on the cover upload.
    **Open**: (L2) the origin should only accept Cloudflare (firewall
    allowlist / Authenticated Origin Pulls / Tunnel), otherwise
    `CF-Connecting-IP` can be spoofed past the rate limit (Turnstile
    still applies); (L4) the 5 MB server-action body limit also applies
    to the public inquiry action, fix by moving admin uploads to route
    handlers if it ever matters; `auth/session.ts` logs whole errors
    (fix in the auth repo's consumer file first).
  - Build gotcha: stopping the dev server mid-write can truncate
    `.next/dev/types`, and `next build` then fails type-checking those
    files. Delete `.next/dev/types` and rebuild.
- [ ] Phase 8: YouTube Analytics demographics (built 2026-09-29 on
      `feature_youtube-analytics`; migration applied and connected locally
      2026-09-29; **waiting on** the Dokploy env vars and a live check)
  - Decisions (the user's): its **own OAuth client** ("Web application") in
    the auth service's Google Cloud project, **90-day** window, and a
    **"Show in media kit" switch, off by default**.
  - Tables (stats section): `YoutubeConnection` (singleton, CHECK id = 1:
    channel id, encrypted refresh token, who connected, `showInMediaKit`)
    and `AudienceSnapshot` (dimension age/gender/country/device, key, share
    in percent with a 0-100 CHECK, period, capturedAt; one set per sync).
  - Connect flow (admin only, both routes call `requireAdmin()` because
    `/api` is outside the proxy):
    - `GET /api/youtube/connect` is a **plain link**, not a form: the CSP's
      `form-action` doesn't allow Google, and a navigation needs no
      exception. It sets a `yt_oauth` cookie (state + PKCE verifier,
      httpOnly, SameSite=Lax, path `/api/youtube`, 10 min) and redirects to
      Google with `access_type=offline`, `prompt=consent select_account`.
    - `GET /api/youtube/callback` checks the state (constant time), trades
      the code, requires the `yt-analytics.readonly` scope and a refresh
      token, and **proves ownership** with an Analytics query on
      `ids=channel==YOUTUBE_CHANNEL_ID` (403 unless the account owns that
      channel; `channels.list mine=true` would need a second scope). A
      failed check revokes the token. The outcome goes back as a code
      (`/admin/stats?youtube=<code>`), never Google's text.
    - Disconnect revokes the grant at Google (best effort) and deletes the
      row; the switch lives on the row, so it resets too.
  - Token storage: `src/lib/security/token-cipher.ts`, AES-256-GCM,
    `v1.<iv>.<tag>.<ciphertext>` (base64url), a purpose string as AAD, and
    `authTagLength: 16` (Node otherwise accepts truncated tags). Key
    `TOKEN_ENCRYPTION_KEY` (64 hex); a changed key makes the token
    unreadable and the sync step says "connect again".
  - Data (`src/lib/platforms/youtube-analytics.ts`, 3 report calls): age
    and gender from `viewerPercentage` by `ageGroup,gender` (**signed-in
    viewers only**, said under the charts), country and device as shares
    of `views`. Top 8 countries, the rest folded into "other". The window
    ends 3 days ago (Analytics data lags). Small channels can get empty
    reports (privacy thresholds): "no data", retried daily.
  - Sync: a daily step in `runSync`, only when configured and connected; the
    `youtube/demographics` snapshot (value = rows stored) is the "last
    synced" marker. Connecting also runs it once, so the admin preview
    fills right away.
  - UI: `Demographics` (stats component, server-rendered): four bar lists,
    one hue (`--chart-line`), label and value as text in each row (that's
    the table view, so no tooltip layer), bars scaled to the list's largest
    share. Country names via `Intl.DisplayNames`. Texts in the
    `Demographics` namespace (server only, so not in `clientMessages`).
    `/admin/stats` has the connect/reconnect link, status, switch,
    disconnect dialog and a preview; moderators see the status read-only.
    The media kit shows the section after the audience figures only when
    connected, with data, and switched on.
  - Checked with a throwaway script: cipher round trip, wrong purpose,
    tampered and truncated tags; the 90-day window; parsing and folding
    with a mocked API; 403 and `invalid_grant` messages (no secret echoed);
    the authorization URL; every state/cancel branch of the callback.
    **Real connect** (2026-09-29, local): the owner account passed the
    channel check, the token was stored as `v1.` ciphertext, and the first
    sync stored age 5, gender 2, countries 8 + other, devices 4 (each set
    sums to 100 %). Media kit stays without the section while the switch is
    off. Google shows only the ages/genders that clear its thresholds.
  - **Shared DB**: the connection row is shared by dev and production, so
    production uses the same grant. Dokploy's `TOKEN_ENCRYPTION_KEY` must be
    the **same value** as locally, or production can't read the token.
  - The dev server logs the callback URL with Google's code (Next's request
    log). The code is single-use, already spent and bound to PKCE;
    `next start` doesn't log requests.
  - **PDF** (2026-09-29): a "Who watches" block after the audience cards
    (four columns, thin bars in `BRAND_TEXT`, `wrap={false}`), countries cut
    to the top 5 + other so it stays one page; `kit.audience` is part of the
    memo key. Labels and percent text come from `audienceLabeller(locale)` /
    `shareText()` in `stats/demographic-labels.ts`, shared with the page.
    Checked: en and de both render as one page.
- [ ] Phase B (much later, only when the user starts it): viewer dashboard
