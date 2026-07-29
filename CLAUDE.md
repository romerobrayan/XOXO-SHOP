# CLAUDE.md — SECRETO (antes XoXo Store)

Guidance for Claude Code when working in this repository.

- Full specification: `docs/XOXO_TECHNICAL_SPEC.md`
- Current state, open debt, and what to do next: `docs/ESTADO-Y-SIGUIENTE-SESION.md`
- Supplier catalog import (staging → curation → promote): `docs/IMPORT-PROVEEDORES.md`
- Design source of truth: `design_handoff_web_secreto/`
- `docs/archive/` holds the **pre-rebrand** design docs (neon direction). They are
  historical — never take design direction from them.

## What this is

Ecommerce storefront for **XOXO Sex Shop** (`@xoxo.sex0`), an adult products retailer
based in Medellín, Colombia, migrating off Instagram + WhatsApp DMs. ~29.4k followers,
~3,770 posts. Today every single sale is a manual conversation.

**Rebrand:** the client approved direction B — **SECRETO · Boutique Erótica**, slogan
"El placer es tuyo. El secreto, nuestro." During the 2–3 month transition the brand
signs "SECRETO · antes XOXO". The design source of truth is
`design_handoff_web_secreto/` (README, `design_system/tokens/*.css`, and
`GUIA-DE-MARCA.md` — read the brand guide before writing any customer-facing copy).

Current operation: nationwide shipping within Colombia, cash on delivery in Medellín,
discretion advertised in the bio, orders coordinated over WhatsApp (`+57 316 866 7068`).

**This is a regulated, payment-restricted retail category.** The compliance rules below
are not features to be prioritized — they are the conditions under which the store can
legally and practically exist. Treat them as load-bearing.

## Catalog shape

Three product families with genuinely different structures. This drives the data model:

| Family | Options | Notes |
| --- | --- | --- |
| Lencería | Size (S/M/L/XL) + color | Supplier refs already exist, e.g. `REF: 11362` |
| Cosmética íntima | Presentation (5 ml / 30 ml / 130 ml) | Lubricants, gels, desensitizers |
| Juguetería y dispositivos | Often none; sometimes color | Lovense, Pretty Love, app-connected devices |

Brands carried: Lovense, Sen Intimo, Pretty Love. `Brand` is a first-class entity and a
primary filter facet — customers search by brand in this category.

Observed price range: COP 45,000–120,000.

## Compliance rules — do not negotiate these away

1. **18+ age confirmation on first visit.** A dismissible modal, driven from
   `src/proxy.ts` (Next 16's rename of the `middleware.ts` convention — same mechanism).
   Store only a boolean consent + timestamp in a cookie. Do **not**
   collect or persist date of birth — data minimization matters more here than anywhere
   else. Not a hard wall: the scaled competitor in this market runs no interstitial, and a
   blocking gate costs the Instagram traffic the project depends on.
2. **Discretion is a product requirement, not a checkbox.**
   - `Order.discreetPackaging` defaults to `true`
   - Transactional emails: neutral sender name and subject, no product images, no explicit
     product names in the subject line
   - Payment descriptor must be neutral — coordinate the exact string with the gateway
   - Never render product imagery in an email preview or push notification
3. **Guest checkout is mandatory.** A large share of buyers in this category will not
   create an account. Never gate purchase behind registration.
4. **Copy and imagery stay clinical.** Product photography is manufacturer packaging and
   product shots. Descriptions cover material, dimensions, function, care, and
   compatibility. Never euphemistic, never crude, never explicit.
5. **Payments: Stripe is prohibited for this category.** See "Payments" below. Do not add
   `stripe` to `package.json`.
6. **Manual bank transfer is a real payment method**, not a hack — customer uploads a
   receipt, an advisor verifies in the admin panel, nothing ships until approved. The
   market leader runs this alongside a card gateway.

## Stack

Next.js 16 (App Router, RSC) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Prisma 7 · PostgreSQL · Zod · next-safe-action · Zustand

## Commands

```bash
npm run dev                  # Turbopack dev server
npm run build
npm run test                 # vitest
npm run lint
npx prisma migrate dev       # generate a migration — LOCAL database only
npx prisma migrate deploy    # apply existing migrations — Neon
npx prisma db seed           # demo catalog into Postgres
npx prisma studio
npx playwright test
docker compose start         # local database on / off
docker compose stop
npm run import:check         # Cloudinary preflight (real test upload)
npm run import:distrisex     # supplier → data/import/staging (git-ignored)
npm run import:climax
npm run import:revision      # local curation page over the staging
npm run import:promote       # approved subset → Cloudinary + LOCAL db
                             # (--neon only after client sign-off; it refuses
                             #  Neon otherwise — docs/IMPORT-PROVEEDORES.md)
```

The storefront runs **with or without a database**: leave `DATABASE_URL` unset and the
catalog queries answer from fixtures instead (see "Demo data" below).

## Database — two of them, on purpose

**Neon is the primary database** (managed Postgres, `us-east-2`). It is up whether or
not this machine is, and it is the same data the Vercel deployment reads. The local
Docker Postgres stays for two jobs it alone can do: working offline, and being a
throwaway database for generating migrations. `docs/NEON-CLOUD.md` and
`docs/POSTGRES-DOCKER.md`. Switch by moving a `#` in `.env`.

**The migration workflow is split, and getting it wrong is destructive:**

1. `npx prisma migrate dev --name <what_changed>` against **local** — generates
   `prisma/migrations/<timestamp>_<name>/`, which you commit.
2. `npx prisma migrate deploy` against **Neon** — applies it. No shadow database, no
   comparison, no data loss.

**Never run `migrate dev`, `migrate reset`, or `db push` against Neon.** `reset` drops
every row; `db push` applies changes without recording them in `_prisma_migrations`,
which desynchronizes the history for everyone else.

`prisma/seed.ts` opens with `deleteMany`. That is safe against a demo catalog and stops
being safe the moment Neon holds a real order.

## Non-negotiable engineering rules

1. **Money is always `Int` in minor units (cents).** Never `Float`. Format only at render
   time with `formatCOP()` from `src/lib/money.ts`.
2. **Stock mutations run inside `prisma.$transaction`** with a conditional `updateMany`
   guard. Never read-then-write stock. See spec §6.4.
3. **Every stock change writes an `InventoryMovement` row.** The ledger is the audit
   trail; the columns on the variant are just the running balance.
4. **`OrderItem` stores snapshots** — product name, SKU, option labels, unit price, copied
   at purchase time. Never resolve historical orders through a join to the live catalog.
5. **No gateway SDK outside `src/payments/providers/`.** Everything else talks to the
   `PaymentProvider` interface.
6. **Server Components by default.** `"use client"` only for real interactivity — option
   picker, cart drawer, forms, age gate.
7. **Zod validates at every boundary.** Server Actions wrap in `next-safe-action` with a
   schema from the feature's `schemas.ts`. No unvalidated `FormData`.

## Structure

```
src/app/(storefront)   public pages, behind the age gate
src/app/(admin)        auth-gated panel
src/features/*         domain logic — queries.ts, actions.ts, schemas.ts, components/
src/payments/          port + adapters, the only place gateway SDKs appear
src/components/ui      shadcn primitives
src/lib                db singleton, money, slug, utils
src/components/site    header, footer, announcement bar, breadcrumb
src/proxy.ts           age gate (Next 16 renamed middleware.ts → proxy.ts)
prisma/migrations      applied migrations — never hand-edit one
```

A change to one feature should touch one directory under `src/features/`.

## Data model — polymorphic options

The catalog is heterogeneous, so **do not** hardcode size and color as columns. Use the
generic option system:

```
Product ──< ProductOption ──< ProductOptionValue
   │                                 │
   └──< ProductVariant ──< VariantOptionValue ──┘
```

- `ProductOption` — what the customer chooses ("Talla", "Color", "Presentación")
- `ProductOptionValue` — the choices ("S", "Negro" + hex, "30 ml")
- `ProductVariant` — the actual sellable SKU, holds price and stock
- `ProductSpec` — display-only attributes that do **not** vary within a product
  ("Material: silicona médica", "Conectividad: Bluetooth", "Resistente al agua: sí")

**The distinction that matters:** if choosing it changes the SKU, it's an option. If it's
the same for every unit of the product, it's a spec. Volume is an option for a gel sold in
30 ml and 130 ml; it's a spec for a device with one presentation.

**Every product has at least one variant, including products with zero options.** This is
not a workaround. The variant space is a subset of the Cartesian product of the option
value sets:

```
V ⊆ V₁ × V₂ × … × Vₙ
```

For n = 0 the empty product is the singleton, so |V| = 1. A Lovense device with no
options has exactly one variant, by construction. Because of this, cart, inventory, and
order code never branch on "does this product have options" — they always operate on
variants.

Other model notes:

- Uniqueness of an option combination cannot be expressed directly in Prisma. Store a
  denormalized `optionKey` on the variant (sorted, joined option value IDs) with
  `@@unique([productId, optionKey])`.
- `ProductOptionValue.hex` is nullable — set for colors, null for sizes and volumes.
- `ProductMedia.optionValueId` is nullable: null applies to the whole product, set means
  show it when that value is selected (color-specific photography). `ProductMedia` holds
  images *and* video (`type`, `posterUrl`) — a third of what this client posts is video.
- Available stock is always `stockOnHand - stockReserved`. Never expose `stockOnHand` to
  the storefront.

## Payments

**Stripe is out — twice over.** Colombia is not a supported merchant country, and more
decisively, Stripe's prohibited business list explicitly names sexually oriented items
including adult toys. Shopify Payments is out for the same reason: it runs on Stripe.

**PayU is the primary target.** Tienda Cereza, the scaled competitor in this market,
publicly processes cards through PayU — so the category is demonstrably underwritten in
Colombia. Wompi is the second conversation. Either way the category gets declared honestly
at onboarding: the failure mode is not rejection, it's approval under a vague merchant
category followed by frozen funds after a later review.

Until a merchant account is confirmed, `PAYMENT_PROVIDER=mock`. Cash on delivery is
already the client's working channel in Medellín and is a first-class payment method here,
not a fallback — see `PaymentMethod.CASH_ON_DELIVERY`.

## Design tokens — SECRETO

Vibe: perfumería premium, no sex shop de neón. Máx. 2 fondos por vista (marfil + crema).
Tokens live in `src/app/globals.css` as Tailwind `@theme`, mirroring
`design_handoff_web_secreto/design_system/tokens/*.css` — that package is the source of
truth; do not invent values.

```css
--marfil  #F7F1E8  /* página */          --vino          #5C1A2E  /* marca / CTA */
--crema   #FFFDF9  /* tarjetas */        --vino-claro    #71243C  /* hover */
--arena   #F1E7D8  /* suave, hover */    --vino-profundo #451423  /* pressed */
--linea   #E2D5C2  /* bordes */          --oro           #C9A96E  /* acento */
--tinta   #2B1B20  /* titulares */       --cobre         #8C5A3C  /* kickers */
--exito   #587A4F                        --error         #A33D3D
```

**Type roles.** Marcellus (weight 400 only) for logo, h1–h3, product names, and quotes;
Archivo (300–600) for interface and body. Scale: 12 / 13.5 / 15 / 18 / 24 / 32 / 44 / 64.
Kickers: Archivo 12px uppercase, tracking 3px, cobre. Buttons: uppercase, tracking 1.5px,
medium. Prices: Archivo semibold vino, Colombian format `$120.000` via `formatCOP()`,
always `tabular-nums`.

- The logo is **typographic**: `.logo-wordmark` (Marcellus uppercase, tracking 0.25em).
  Never use the PNG logos for the web wordmark; never go above weight 600 in Archivo.
- Radii nearly square: 2px buttons · 4px cards/inputs · 6px modals/images. Pills
  (999px) ONLY on chips, badges, and the WhatsApp CTA.
- Exactly two shadows: `--shadow-card` (card hover) and `--shadow-pop` (modals).
- Brand motif: the divider line—text—line (`.divisor`).
- Hover: buttons lighten the vino; cards lift `translateY(-2px)` + shadow; links
  vino → cobre. Transitions 150–200ms ease, no bounces.
- Copy: Spanish de "tú", warm and direct, everything named naturally, **no emojis**
  (`→` and `↓` are the only ornaments). Read
  `design_handoff_web_secreto/design_system/GUIA-DE-MARCA.md` before writing copy.
- Placeholder photography: diagonal arena stripes + monospace label — never drawn
  products, never stock photos. Real photos: 4:5 on arena background, warm light.

**Design thesis: boutique outside, pharmacy inside.** Vino and oro carry the brand;
product pages, bag, and checkout stay quiet, spacious, and clinical — the buyer's
anxiety here is trust and discretion, not excitement. The discretion promise appears at
every touchpoint ("Envío discreto" by the price, "Empaque neutro" badges, the
announcement bar).

## Conventions

- Route slugs in Spanish (`/tienda`, `/carrito`, `/checkout`), code and comments in
  English.
- Customer-facing copy in Spanish, `es-CO`. Active voice, sentence case, plain verbs.
  Product names exactly as the manufacturer names them.
- Colombian addresses need `department`, `city`, `documentType`, `documentId` — required
  for invoicing.
- Cash on delivery is `contra entrega` in the UI. Keep the client's existing vocabulary.

## Demo data

The demo catalog is declared **once**, in `src/features/catalog/demo-catalog.ts`, and
consumed twice:

- `prisma/seed.ts` writes it to Postgres, IDs included
- `src/features/catalog/fixtures.ts` shapes it as Prisma payloads for the database-less
  preview (`DATABASE_URL` unset)

`src/features/catalog/parity.test.ts` proves the two sources serve identical DTOs. It
compares them against a seeded database when `DATABASE_URL` is set, and skips otherwise.

**Add or change demo products in `demo-catalog.ts` only** — never in the seed, never in
the fixtures. Then re-run `npx prisma db seed` and `npm run test`.

## Current phase

**Phase 0 implemented, awaiting client sign-off.** Age gate, home, catálogo, producto, and
a 3-step checkout (client-side bag, no `Order` written yet), deployed to a Vercel preview.
`PAYMENT_PROVIDER=mock`. The age gate is part of what the client is approving, not a later
addition.

**Phase 1 in progress.** Schema, first migration, and seed are in; admin CRUD is the open
half. `docs/ESTADO-Y-SIGUIENTE-SESION.md` tracks what is done, what is open debt, and what
comes next — update it at the end of a working session.

**Images.** Real product photography does not exist yet. Use
`ProductImagePlaceholder` (4:5, diagonal arena stripes, visible "Imagen pendiente"
monospace label — the brand guide's placeholder). Never substitute stock photography — a
placeholder prettier than the real asset means the client approves a design that cannot
ship.

The eventual target is a photo session on the arena `#F1E7D8` background with warm,
clean light (see handoff "Assets"); until then the stripes stay.

Label the preview for the client: the images are placeholders and the design adjusts when
supplier photography arrives.

## Don't

- Add `stripe` to the project. Prohibited category.
- Hardcode size or color as columns on `ProductVariant`.
- Gate purchase behind account registration.
- Put product names or images in transactional email subjects or previews.
- Collect date of birth for the age gate.
- Add a REST API layer. Server Actions are the interface until an external consumer exists.
- Commit product photography to the repo — Cloudinary.
