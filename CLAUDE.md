# CLAUDE.md — XoXo Store

Guidance for Claude Code when working in this repository.
Full specification: `docs/XOXO_TECHNICAL_SPEC.md`

## What this is

Ecommerce storefront for **XOXO Sex Shop** (`@xoxo.sex0`), an adult products retailer
based in Medellín, Colombia, migrating off Instagram + WhatsApp DMs. ~29.4k followers,
~3,770 posts. Today every single sale is a manual conversation.

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
   `middleware.ts`. Store only a boolean consent + timestamp in a cookie. Do **not**
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
npx prisma migrate dev       # after any schema change
npx prisma studio
npx prisma db seed
npm run test                 # vitest
npx playwright test
```

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
middleware.ts          age gate
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
- `ProductImage.optionValueId` is nullable: null applies to the whole product, set means
  show it when that value is selected (color-specific photography).
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

## Design tokens

Derived from the existing brand: neon script wordmark, magenta-to-red glow, near-black
ground. Story highlight covers use a soft pink-lavender wash.

```css
@theme {
  --color-ink:          #0B0A0F;  /* ground */
  --color-surface:      #16141C;  /* elevated cards */
  --color-neon:         #FF2BC2;  /* magenta glow — the signature */
  --color-ember:        #F5325B;  /* wordmark red */
  --color-blush:        #F6C9DE;  /* soft pink, from highlight covers */
  --color-mist:         #C9B6E4;  /* lavender, from highlight covers */
  --color-bone:         #F4F2F6;  /* body text on dark */

  --font-sans: "Instrument Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
}
```

**Type roles.** Three roles, and one of them is not a webfont.

| Role | Face | Used for |
| --- | --- | --- |
| Display | **The logo itself**, as an image | Wordmark only |
| Body / UI | **Instrument Sans** 400 / 500 / 600 | Everything readable |
| Utility | **IBM Plex Mono**, tabular figures | Prices, SKUs, quantities, spec values |

- Do **not** substitute a script webfont for the logo. Matching a neon script with a
  Google Font reads as costume. The mark is an asset, not a text style.
- Never go above weight 600. The wordmark already carries all the weight this brand needs.
- Prices always use `font-variant-numeric: tabular-nums`. This aligns the price column
  down the catalog grid and makes the number read as a price list rather than an Instagram
  offer — which is the thesis, applied to type.

**Scale** (mobile-first, 375px base):

| Token | Size / line-height | Face |
| --- | --- | --- |
| `text-display` | 32 / 36 | sans 600 |
| `text-title` | 24 / 30 | sans 600 |
| `text-heading` | 20 / 26 | sans 500 |
| `text-body` | 16 / 26 | sans 400 |
| `text-small` | 14 / 20 | sans 400 |
| `text-micro` | 12 / 16 | sans 500, uppercase |
| `text-price` | 28 / 32 | mono 500, tabular |
| `text-price-sm` | 16 / 20 | mono 400, tabular |

Body never drops below 16px — smaller triggers input zoom on iOS and reads as fine print
in a category where fine print costs trust.

**Dark-ground tracking.** Light text on near-black blooms optically and looks tighter than
it is. Add `letter-spacing: 0.01em` at 14px and below, and `0.08em` on uppercase micro
labels. Leave 16px body untracked.

**Design thesis: neon signage outside, calm pharmacy inside.** The wordmark and a single
accent carry all the brand heat. Product pages, cart, and checkout are quiet, spacious,
and clinical — because the buyer's anxiety here is about trust and discretion, not
excitement. Spend the boldness in one place; keep everything around it disciplined.

Do not apply the neon glow to body copy, cards, or multiple CTAs at once. One glowing
element per view.

## Conventions

- Route slugs in Spanish (`/tienda`, `/carrito`, `/checkout`), code and comments in
  English.
- Customer-facing copy in Spanish, `es-CO`. Active voice, sentence case, plain verbs.
  Product names exactly as the manufacturer names them.
- Colombian addresses need `department`, `city`, `documentType`, `documentId` — required
  for invoicing.
- Cash on delivery is `contra entrega` in the UI. Keep the client's existing vocabulary.

## Current phase

**Phase 0 — Design.** Home, catalog, and product detail with seeded mock data, deployed to
a Vercel preview. `PAYMENT_PROVIDER=mock`. The age gate ships in Phase 0 — it is part of
what the client is approving, not a later addition.

**Images.** Real product photography does not exist yet. Use
`ProductImagePlaceholder` (4:5, tint derived from the product slug, visible "Imagen
pendiente" label). Never substitute stock photography — a placeholder prettier than the
real asset means the client approves a design that cannot ship.

The client's existing assets are mostly product-on-white packaging shots. v1 treatment is
a deliberate light tile with rounded corners, so the white reads as framing rather than as
a bright rectangle fighting the dark ground. Background removal and compositing onto
`--color-surface` is the eventual target, done in batches as products are re-shot.

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
