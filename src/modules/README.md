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
| `seo` | public page list for the sitemap (JSON-LD helpers come in Phase 2) | `i18n` (alternates) |
| `i18n` | next-intl routing (`/de`, `/en`), request config, locale-aware navigation, hreflang alternates, message catalogs, locale switcher | — |
