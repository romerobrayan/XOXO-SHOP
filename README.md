# SECRETO · Boutique Erótica (antes XOXO Store)

Ecommerce storefront for **XOXO Sex Shop**, an adult products retailer in
Medellín, Colombia, migrating off Instagram + WhatsApp DMs — now rebranding to
**SECRETO** ("El placer es tuyo. El secreto, nuestro."). Nationwide shipping,
cash on delivery in Medellín, discretion as a functional requirement.

**Read `CLAUDE.md` first** — it is the operating manual for this repo. The full
technical specification lives in `docs/XOXO_TECHNICAL_SPEC.md`, and the design
source of truth in `design_handoff_web_secreto/` (design system, brand guide,
and the four hifi reference pages).

## Stack

Next.js 16 (App Router, RSC) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Prisma 7 · PostgreSQL · Zod · next-safe-action · Zustand

## Getting started

```bash
npm install
cp .env.example .env         # fill in DATABASE_URL
npx prisma migrate dev       # first migration
npx prisma db seed           # demo catalog (real products, real prices)
npm run dev
```

## Commands

```bash
npm run dev                  # Turbopack dev server
npm run build
npm run test                 # vitest
npm run lint
npm run format
npx prisma migrate dev       # after any schema change
npx prisma studio
npx prisma db seed
```

## Current phase

**Phase 0 — Design.** Age gate, Home, Catálogo, Producto, and Checkout (3
pasos, client-side bag) implementing the SECRETO handoff with seeded mock
data, deployed to a Vercel preview. `PAYMENT_PROVIDER=mock` until a merchant
account is approved (PayU first — see
`docs/decisions/001-payment-provider.md`).
