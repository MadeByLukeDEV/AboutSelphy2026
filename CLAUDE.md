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
- **next-intl** (German/English, device-default locale, no locale prefix in
  URLs) and **next-themes** (dark/light, system default), set up the same way
  as Social
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
  4. Run `pnpm exec prisma generate`.

  `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`) was
  created by hand and is committed. No migrations exist yet; the first model
  brings the first one.
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
- Use `useSyncExternalStore` for client-only and mounted checks, not
  `useEffect(() => setMounted(true))`, which the React Compiler lint rule
  flags.
- A client state seeded from server props doesn't update on
  `revalidatePath`. Have actions return the changed record and update local
  state through `onSuccess`.
- Give every dnd-kit `DndContext` an `id={useId()}` to avoid hydration
  mismatches.
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
  - `NextIntlClientProvider` currently sends all messages to the client.
    Once the catalogs grow, pass only the namespaces client components need.
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
- **Crawling**: `robots.ts` and `sitemap.ts` (both locales, `lastModified`
  from real data, hreflang alternates). `/admin` and `/api` are disallowed
  and also carry `robots: { index: false }`. Add `manifest.ts` and icons.
- **Core Web Vitals targets**: LCP < 2.5 s, CLS < 0.1, INP < 200 ms, and
  Lighthouse SEO/Performance/Accessibility/Best Practices ≥ 95 on mobile.
  - Use `next/image` with explicit sizes, and a `priority` hero image.
  - Load fonts through `next/font`.
  - Load Motion and embeds lazily (Twitch/YouTube players as click-to-load
    facades, not iframes on first paint).
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
      a comment: Twitch/YouTube players → `frame-src`, their CDNs →
      `img-src`, Turnstile → `script-src`/`frame-src`.
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
  `pnpm audit` before each release, and add no new packages without a reason.
- **Uploads** (if any, e.g. partner logos): check type by magic bytes, cap
  size, re-encode images, and never serve user-uploaded SVG inline.

## Deployment (Dokploy): lessons carried over

- Use a three-stage `Dockerfile` (`deps` → `builder` → `runner`) on
  `node:22-alpine`, copied from Social. The runner runs
  `pnpm exec prisma migrate deploy && pnpm start`.
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

- Use GitHub account `MadeByLukeDEV`. Git has not been initialised here yet.
  Run `git init` and create the repo only when the user asks. **Never add a
  remote, push, or open a PR without asking.**
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

Keep `.env.example` complete and commented, as in Social.
- `DATABASE_URL`: Postgres, a plain connection string. URL-encode special
  characters in the password. `DATABASE_SCHEMA` is the app's schema
  (`main`). Locally these live in `.env.local`.
- `AUTH_URL`, `AUTH_DATABASE_URL`, `AUTH_DATABASE_SCHEMA` (`auth`),
  `BETTER_AUTH_SECRET` (same as the auth service), `AUTH_COOKIE_PREFIX`
- `NEXT_PUBLIC_SITE_URL` (`https://aboutselphy.com`), `NEXT_PUBLIC_ROOT_DOMAIN`
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_LOGIN`,
  `TWITCH_WEBHOOK_SECRET`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` (the
  media kit's data sources. Features render a placeholder when these are
  unset, as with `isTwitchConfigured()` in Social)
- Phase 8: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (YouTube Analytics
  OAuth), `TOKEN_ENCRYPTION_KEY` (32-byte hex)
- `CRON_SECRET` (stats sync), `TURNSTILE_SITE_KEY` (public) /
  `TURNSTILE_SECRET_KEY` (inquiry form)
- `REDIS_URL` (optional, only if caching is added. Reuse the shared instance,
  and every call must fail soft)

## Open decisions

- Phase B questions (viewer auth, points source, dashboard URL) are
  deliberately postponed until Phase A is done.

## Feature status

SEO and security are built into every phase, not saved for the end.

- [ ] Phase 0: git repo, Next.js 16 scaffold, shadcn (`base-nova`), Motion,
      Tailwind tokens (brand color, font, fluid scale), module skeleton,
      locale-prefixed i18n, theme, effects layer, Prisma + Postgres schema,
      security headers + CSP nonce, `env.ts`, root metadata, robots/sitemap
      skeleton, Dockerfile
- [ ] Phase 1: central auth integration + `/admin` shell
- [ ] Phase 2: Home / About (+ `Person`/`WebSite` JSON-LD)
- [ ] Phase 3: `stats` module: YouTube + Twitch sync, `StatSnapshot`, cron
      route, EventSub live status and viewer sampling
- [ ] Phase 4: Streams (live status, latest videos, embed facades)
- [ ] Phase 5: Schedule (admin editable, public view, `Event` JSON-LD)
- [ ] Phase 6: Media kit (API stats, growth charts, partners, packages,
      PDF, OG card) + inquiry form (Turnstile) with `/admin/inquiries`
- [ ] Phase 7: SEO and security audit: Lighthouse, Rich Results,
      securityheaders.com, `security-review` over the whole app
- [ ] Phase 8: YouTube Analytics demographics (owner OAuth connect in
      `/admin`, encrypted token, demographics section in the media kit)
- [ ] Phase B (much later, only when the user starts it): viewer dashboard
