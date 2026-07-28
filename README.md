# SECRETO · Boutique Erótica (antes XOXO Store)

Ecommerce storefront for **XOXO Sex Shop**, an adult products retailer in
Medellín, Colombia, migrating off Instagram + WhatsApp DMs — now rebranding to
**SECRETO** ("El placer es tuyo. El secreto, nuestro."). Nationwide shipping,
cash on delivery in Medellín, discretion as a functional requirement.

**Read `CLAUDE.md` first** — it is the operating manual for this repo.

| Where to look | For |
| --- | --- |
| `CLAUDE.md` | Operating manual: compliance rules, engineering rules, conventions |
| `docs/ESTADO-Y-SIGUIENTE-SESION.md` | Current state, open debt, what to pick up next |
| `docs/NEON-CLOUD.md` | **The primary database** — Neon setup, the two endpoints, migration workflow, Vercel |
| `docs/POSTGRES-DOCKER.md` | Optional local database with Docker — offline work and generating migrations |
| `docs/XOXO_TECHNICAL_SPEC.md` | Full technical specification |
| `design_handoff_web_secreto/` | **Design source of truth** — tokens, brand guide, four hifi reference pages |
| `docs/decisions/` | ADRs, starting with the payment provider |
| `docs/archive/` | Pre-rebrand design docs (neon direction) — historical only |

## Stack

Next.js 16 (App Router, RSC) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Prisma 7 · PostgreSQL · Zod · next-safe-action · Zustand

## Getting started

```bash
npm install                  # postinstall runs `prisma generate`
npm run dev                  # http://localhost:3000
```

That works with **no database**: every catalog query falls back to
`src/features/catalog/fixtures.ts`, which serves the demo products through the
same DTOs the live queries return. It is how the Phase 0 preview is deployed.

With the database — the primary one is **Neon**, managed, always up:

```bash
cp .env.example .env         # DATABASE_URL = the Neon string, ?sslmode=require
npx prisma migrate deploy    # apply prisma/migrations — NOT migrate dev
npx prisma db seed           # demo catalog: 6 products, 14 variants
npm run dev
```

`docs/NEON-CLOUD.md` covers the two endpoints (direct vs pooled), the Vercel
variables, and why migrations are `deploy` here and `dev` locally.

A local Postgres is still available and still useful — it works offline, it is
much faster to iterate against, and `prisma migrate dev` needs a throwaway
database in order to *generate* a migration:

```bash
docker compose up -d --wait  # postgres on :5432, data in a named volume
```

`docs/POSTGRES-DOCKER.md` walks through it step by step, including reset,
backups, and the errors worth recognizing.

**When you change `prisma/schema.prisma`:** `npx prisma migrate dev` against the
local database to generate the migration and commit it, then
`npx prisma migrate deploy` against Neon to apply it. Never `migrate dev`,
`migrate reset`, or `db push` against Neon.

Both data sources read one declaration,
`src/features/catalog/demo-catalog.ts` — add demo products there, not in the
seed and not in the fixtures. `src/features/catalog/parity.test.ts` compares the
two through the real mappers whenever `DATABASE_URL` is set, so they cannot
drift apart silently.

## Commands

```bash
npm run dev                  # Turbopack dev server
npm run build
npm run test                 # vitest — the DB parity suite runs when DATABASE_URL is set
npm run lint
npm run format
npx prisma migrate dev       # generate a migration — LOCAL database only
npx prisma migrate deploy    # apply existing migrations — Neon
npx prisma studio
npx prisma db seed
docker compose start         # local database on / off
docker compose stop
```

## Current phase

**Phase 0 — Design, implemented.** Age gate, Home, Catálogo, Producto, and
Checkout (3 pasos, client-side bag) implementing the SECRETO handoff with demo
data, deployed to a Vercel preview. `PAYMENT_PROVIDER=mock` until a merchant
account is approved (PayU first — see
`docs/decisions/001-payment-provider.md`).

**Phase 1 — Catalog, in progress.** Schema, first migration, and seed are in.
Admin CRUD is the open half.

Product photography does not exist yet: every image slot renders a placeholder,
by design. See `CLAUDE.md`, "Images".
