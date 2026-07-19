# XoXo Ecommerce — Technical Specification

**Client:** XOXO Sex Shop (`@xoxo.sex0`) — adult products retailer, Medellín, Colombia
**Author:** Brayan Romero
**Version:** 0.2 — Revised after brand and catalog review
**Status:** Design phase (Phase 0)

---

## 1. Context and Goals

XOXO Sex Shop operates entirely through Instagram and WhatsApp. ~29.4k followers and
~3,770 posts, with prices burned into the post graphics and every order negotiated in a
DM. They ship nationwide and offer cash on delivery in Medellín. Discretion is already
part of their stated promise.

The audience is the asset here. 29.4k followers is not a launch problem — it is a
migration problem. The store's job is to convert an existing, engaged following into
self-service purchases.

**The job of this project:** move the catalog and the transaction out of the DM, and
remove the one thing that suppresses volume most in this category — having to ask a human
for a price and then tell them what you want to buy.

### Catalog

Three product families with genuinely different structures. This drives §6 entirely.

| Family | Options | Notes |
| --- | --- | --- |
| Lencería | Size (S/M/L/XL) + color | Supplier references already exist, e.g. `REF: 11362` |
| Cosmética íntima | Presentation (5 ml / 30 ml / 130 ml) | Lubricants, gels, desensitizers |
| Juguetería y dispositivos | Often none; sometimes color | Lovense, Pretty Love, app-connected devices |

Brands carried include Lovense, Sen Intimo, and Pretty Love. Brand is a first-class
entity and a primary filter facet — buyers in this category search by brand.

Observed price range: COP 45,000–120,000.

### Success criteria for v1

| Criterion | Target |
| --- | --- |
| Customer can complete a purchase without contacting the store | Yes |
| Stock is decremented automatically on paid order | Yes |
| Owner can add a product with its options in under 3 minutes | Yes |
| Age gate enforced before any product is visible | Yes |
| Discreet packaging and neutral billing descriptor | Default on |
| Mobile Lighthouse performance score | ≥ 90 |
| Time to first client-facing design review | Week 1 |

### Non-goals for v1

- Multi-warehouse or multi-location inventory
- Marketplace / multi-vendor support
- Subscriptions or recurring billing
- Native mobile app
- Multi-currency (COP only)

### Constraints

- Solo developer, part-time alongside employment and university
- Client has committed expectations on a first visual deliverable
- Colombian market: mobile-dominant traffic, local payment methods are non-optional
- Tooling: Claude Code for implementation, Claude Design for the visual layer
- **Regulated category.** Adult products carry constraints that are structural, not
  cosmetic: mandatory age verification, restricted payment processing, restricted paid
  advertising, and discretion as a functional requirement. These shape architecture and
  go-to-market, not just the footer.

### Compliance requirements

These are conditions for the store existing, not backlog items.

| Requirement | Implementation |
| --- | --- |
| 18+ age confirmation | Dismissible modal on first visit, `middleware.ts`-driven. Boolean consent + timestamp cookie. **Do not collect date of birth** — data minimization. See the note below on how hard this should be |
| Discreet packaging | `Order.discreetPackaging`, defaults `true` |
| Neutral billing descriptor | Coordinated with the gateway at onboarding |
| Discreet notifications | Neutral email sender and subject, no product names or images in subject lines or previews |
| Guest checkout | Mandatory. Never gate purchase behind registration |
| Clinical copy and imagery | Manufacturer product shots; descriptions cover material, dimensions, function, care |

**On how hard the age gate should be — a correction.** An earlier draft of this document
called a blocking interstitial non-negotiable. Field research does not support that as the
local norm: Tienda Cereza, the scaled competitor in this market, runs no age interstitial
at all and is fully indexed by search engines.

A hard wall in front of the catalog has a real cost — it blocks the Instagram-link traffic
this whole project depends on, and it can hurt indexing. The defensible middle is a
dismissible confirmation on first visit: cheap, honest, appropriate to the products, and
not a conversion wall. Processors sometimes require age verification during onboarding for
this category, so raise it in the gateway conversation and let the answer set the bar.

Confirm local regulatory requirements with a Colombian lawyer before launch. Nothing here
substitutes for legal advice on Colombian consumer and advertising law.

---

## 2. Critical Decision: Payments

**This is the highest-risk item in the project and it is not primarily a technical one.**

### Stripe is out, for two independent reasons

**Geography.** Colombia is not on Stripe's supported list for opening a merchant account.
The documented workaround is registering an entity in a supported country plus a foreign
bank account — disproportionate overhead for this business.

**Category, which is decisive.** Stripe's prohibited and restricted businesses list
explicitly names adult content and sexually oriented items, adult toys included. Stripe's
own position is that this reflects requirements from its financial partners, and the
company has publicly acknowledged the restriction while stating it applies anyway. Solving
the geography problem does nothing about this one.

The same constraint rules out Shopify Payments, because it runs on Stripe. If the client
has been told "just use Shopify," that is the reason it will not work.

### The real risk is not rejection

An account can be approved under a vague merchant category and then restricted, paused, or
terminated after volume grows and underwriting takes a second look — with funds held.
That outcome is far worse for a small merchant than being told no on day one.

**Declare the business category honestly and in writing during onboarding, and get the
approval in writing.** This is the single most important instruction in this document.

### Field evidence — this question is now largely answered

Tienda Cereza (`tiendacereza.com`) is the scaled competitor in this exact market: same
country, same category, 30+ physical boutiques including ten in Medellín, operating as
Cereza Media SAS. Their published payment methods page settles what public gateway
documentation would not.

**PayU processes card payments for them.** Visa, Mastercard, Amex, Diners, and debit.
Stated openly on their own site. That moves this project's biggest unknown from
"plausible" to "demonstrated": at least one Colombian gateway underwrites this merchant
category at scale.

This flips the recommendation. **PayU becomes the primary target, Wompi the second
conversation** — not because PayU's API is better (Wompi's is), but because approval risk
dominates API quality when the alternative is no card payments at all. Approach both, lead
with PayU, and still declare the category honestly. One merchant's approval is evidence
about the category, not a guarantee about this client.

**They also run manual bank transfer as a first-class method**, not a fallback: transfers
and over-the-counter deposits to named Bancolombia and Davivienda accounts, with the
customer sending proof to WhatsApp and an advisor confirming before the order ships.
Nothing dispatches without that human confirmation.

That is worth absorbing rather than dismissing. The market leader, with a card gateway
already integrated, still runs a manual verification loop — because in this category some
buyers will not put these products on a card statement at all. For XoXo, whose whole
operation is already WhatsApp-based, this is close to free: it is what they do today,
formalized. See `PaymentMethod.BANK_TRANSFER_MANUAL` and
`PaymentStatus.AWAITING_VERIFICATION` in §6.2.

**Also observed:** they publish their NIT and legal name on the payment page. That is
normal trust-building for Colombian ecommerce and worth replicating once the client's
entity is settled.

### Local payment methods are not optional either

Even if Stripe onboarding were possible, card coverage alone leaves money on the table in
this market. Colombian online shoppers rely heavily on PSE (instant bank transfer), Nequi
and Daviplata (digital wallets), and cash networks like Efecty and Baloto. A checkout that
only accepts cards will lose conversions on a mid-ticket apparel purchase.

### Recommended providers

| Provider | Card fee (approx.) | PSE | Nequi | Notes |
| --- | --- | --- | --- | --- |
| **Wompi** (Bancolombia) | ~2.99% + IVA + COP 600 | ~1.49% + COP 1,200 | ~1.79% | Best API of the local market, native Nequi, fast settlement to Bancolombia |
| **Bold** | ~2.80% + IVA + COP 500 | ~1.79% | ~1.79% | Strong if the client also sells in person (POS) |
| **Mercado Pago** | Competitive | Yes | — | Installments, large existing user base |

Fees change frequently and depend on plan and volume. Confirm current rates on each
provider's official site before quoting the client.

**Recommendation: PayU first, Wompi second.** PayU is demonstrably processing for this
category in Colombia at scale (see field evidence above), which outweighs Wompi's better
API. Approval risk dominates developer experience when the downside is having no card
payments at all. Open both conversations in the same week; the adapter is written against
whichever confirms first, and the port makes that a one-file decision.

**Cash on delivery is a first-class method, not a fallback.** The client already runs
`contra entrega` in Medellín and it may be carrying meaningful volume precisely because
card processing is hard in this category. Model it as a real `PaymentMethod`, with the
caveat that it reserves stock against an unconfirmed payment — see §6.4.

### The architectural answer

Do not couple the checkout to any gateway. Define a **port** and write **adapters**:

```
Checkout flow  ──►  PaymentProvider (interface)
                          ▲
        ┌─────────────────┼─────────────────┐
   WompiProvider     PayUProvider      MockProvider
   (primary)         (fallback)        (local dev / design demo)
```

This buys three things:

1. **Phase 0 is unblocked.** `MockProvider` lets the whole checkout flow be built and
   demoed to the client before the merchant account even exists.
2. **The gateway decision becomes reversible.** If Wompi's onboarding stalls, swapping to
   Bold is a new file in `src/payments/providers/`, not a refactor of the order domain.
3. **The domain stays clean.** `Order` knows about money and state transitions. It does
   not know what a Wompi integrity signature is.

The interface is small on purpose:

```ts
// src/payments/payment-provider.ts
export interface PaymentProvider {
  readonly name: string;

  /** Creates a payment intent/transaction and returns where to send the customer. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /** Verifies webhook authenticity. Every gateway signs differently. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;

  /** Normalizes a provider status into our own PaymentStatus enum. */
  mapStatus(providerStatus: string): PaymentStatus;
}
```

**Open item for the client:** confirm the legal entity (persona natural vs. SAS), the RUT,
and which bank the payouts should land in. Wompi onboarding requires this and it is
usually the slowest part of the project. Start it in week 1, in parallel with design.

---

## 3. Architecture

### 3.1 High-level

```
┌──────────────────────────────────────────────────────────┐
│                      Next.js 16 (App Router)             │
│                                                          │
│  ┌────────────────┐        ┌──────────────────────────┐  │
│  │  Storefront    │        │  Admin panel             │  │
│  │  (public, RSC) │        │  (auth-gated)            │  │
│  └───────┬────────┘        └───────────┬──────────────┘  │
│          │                             │                 │
│  ┌───────▼─────────────────────────────▼──────────────┐  │
│  │  Server Actions + Route Handlers                   │  │
│  │  (validation with Zod at the boundary)             │  │
│  └───────┬─────────────────────────┬──────────────────┘  │
│          │                         │                     │
│  ┌───────▼────────┐       ┌────────▼───────────────────┐ │
│  │  features/*    │       │  payments/ (port+adapters) │ │
│  │  domain logic  │       └────────┬───────────────────┘ │
│  └───────┬────────┘                │                     │
│  ┌───────▼──────────────┐          │                     │
│  │  Prisma Client       │          │                     │
│  └───────┬──────────────┘          │                     │
└──────────┼──────────────────────────┼─────────────────────┘
           │                          │
    ┌──────▼──────┐          ┌────────▼─────────┐
    │ PostgreSQL  │          │   Wompi / PayU   │
    └─────────────┘          └────────┬─────────┘
                                      │ webhook
                             ┌────────▼──────────────────┐
                             │ /api/webhooks/[provider]  │
                             └───────────────────────────┘
```

### 3.2 Key decisions and why

**Next.js App Router with React Server Components as the default.**
Product pages need to be indexable — this is the store's replacement for a social feed, so
organic search matters. RSC lets catalog queries run on the server and ship zero client JS
for the parts of the page that are just content. Client components are opt-in, for the
variant picker and the cart drawer only.

**Server Actions instead of a separate REST API.**
There is one consumer of this data: this app. Building a REST layer would mean writing and
maintaining a contract for a client that doesn't exist. Server Actions remove that layer
entirely. *Revisit if:* the client ever wants a native app or a third-party integration —
at that point extract a `/api/v1` layer over the same `features/*` functions, which is why
domain logic lives in `features/` and not inline in the action.

**Feature-based structure, not layer-based.**
`features/catalog/` holds the queries, actions, schemas, and components for the catalog.
A change to how variants are selected touches one directory. The alternative — grouping
all actions together, all components together — means every feature change is a shotgun
edit across four folders.

This is a deliberately lighter structure than the Clean Architecture + MVVM layering used
on the Flutter side. Rationale: RSC already enforces the server/client boundary that
UseCases would otherwise formalize, and a solo-developer v1 does not pay back four layers
of indirection. The one place a formal port earns its keep is payments, where the external
dependency is genuinely volatile — hence section 2.

**Prices as integers in minor units.**
Never floating point for money. `priceCents: Int`. Colombian pesos are quoted without
decimals in practice, but Wompi's API expects `amount_in_cents`, so storing minor units
means no conversion at the boundary and no rounding drift in cart totals. Formatting is a
presentation concern:

```ts
// src/lib/money.ts
export const formatCOP = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
```

**Order line items store snapshots, not just foreign keys.**
`OrderItem` copies the product name, SKU, size, color, and unit price at the moment of
purchase. If the owner renames a product or raises a price next month, historical orders
must not silently change. An invoice is a record of what happened, not a live join.

---

## 4. Tech Stack and Dependencies

Versions current as of July 2026. Verify with `npm outdated` before locking.

### Core

```bash
npx create-next-app@latest xoxo-store --typescript --tailwind --app --src-dir
```

| Package | Version | Purpose |
| --- | --- | --- |
| `next` | ^16.2 | Framework. Turbopack is the default bundler in 16 |
| `react` / `react-dom` | ^19 | — |
| `typescript` | ^5.7 | — |

### Database

| Package | Purpose |
| --- | --- |
| `prisma` (dev) | CLI, migrations, Studio |
| `@prisma/client` | Query client. v7 is Rust-free, meaningfully faster cold start |
| `@prisma/adapter-pg` | Driver adapter — required in v7 |
| `pg` | Postgres driver |

Note: Prisma 7 changed the setup. Config lives in `prisma.config.ts`, the generator is
`prisma-client` (not `prisma-client-js`), and it needs an explicit `output` path. Older
tutorials will not match.

### UI

| Package | Purpose |
| --- | --- |
| `tailwindcss` ^4 + `@tailwindcss/postcss` | Styling. v4 config is CSS-first via `@theme` |
| `shadcn/ui` | Component base — copied into the repo, not a dependency |
| `lucide-react` | Icons |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Variant handling |
| `embla-carousel-react` | Product image gallery |

### Forms, validation, state

| Package | Purpose |
| --- | --- |
| `zod` | Schema validation at every boundary |
| `react-hook-form` + `@hookform/resolvers` | Checkout forms |
| `next-safe-action` | Typed Server Actions with Zod validation and error handling |
| `zustand` | Cart state, persisted to `localStorage` |

### Infrastructure

| Package | Purpose |
| --- | --- |
| `better-auth` | Admin authentication. Lighter than Auth.js for a single-role panel |
| `resend` + `react-email` | Order confirmation emails |
| `next-cloudinary` | Product image hosting, transformation, and optimization |
| `nanoid` | Human-readable order numbers |
| `date-fns` | Dates with `es` locale |

### Dev

`eslint`, `prettier`, `prettier-plugin-tailwindcss`, `vitest`, `@playwright/test`, `tsx`

### Infrastructure choices

- **Hosting:** Vercel. Zero-config for Next.js, and the free tier covers a v1 store.
- **Database:** Neon or Supabase (both managed Postgres, both have a usable free tier).
  Neon's branching is convenient for testing migrations.
- **Images:** Cloudinary free tier. Do not commit product photography to the repo.

---

## 5. Folder Structure

```
xoxo-store/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                      # demo catalog for the design review
├── prisma.config.ts                 # Prisma 7 config
├── public/
├── src/
│   ├── app/
│   │   ├── (storefront)/
│   │   │   ├── layout.tsx           # header, nav, cart drawer, footer
│   │   │   ├── page.tsx             # Home
│   │   │   ├── tienda/
│   │   │   │   ├── page.tsx         # Catalog (PLP)
│   │   │   │   └── [slug]/page.tsx  # Product detail (PDP)
│   │   │   ├── carrito/page.tsx
│   │   │   └── checkout/
│   │   │       ├── page.tsx
│   │   │       └── confirmacion/[orderNumber]/page.tsx
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── productos/
│   │   │       ├── inventario/
│   │   │       └── pedidos/
│   │   ├── api/
│   │   │   └── webhooks/[provider]/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css              # Tailwind v4 @theme tokens
│   │
│   ├── components/
│   │   ├── ui/                      # shadcn primitives
│   │   └── commerce/                # ProductCard, VariantPicker, PriceTag, CartDrawer
│   │
│   ├── features/
│   │   ├── age-gate/
│   │   ├── catalog/
│   │   │   ├── queries.ts           # getProducts, getProductBySlug
│   │   │   ├── optionKey.ts         # the ONLY place optionKey is computed
│   │   │   ├── schemas.ts
│   │   │   └── components/
│   │   ├── cart/
│   │   ├── checkout/
│   │   │   ├── actions.ts
│   │   │   └── schemas.ts
│   │   ├── inventory/
│   │   │   ├── reserve.ts           # reservation + release logic
│   │   │   └── movements.ts
│   │   └── orders/
│   │
│   ├── payments/
│   │   ├── payment-provider.ts      # the port
│   │   ├── types.ts
│   │   ├── providers/
│   │   │   ├── wompi.ts
│   │   │   ├── payu.ts
│   │   │   └── mock.ts              # Phase 0 / local dev
│   │   └── index.ts                 # factory, reads PAYMENT_PROVIDER env
│   │
│   ├── lib/
│   │   ├── db.ts                    # Prisma singleton
│   │   ├── money.ts
│   │   ├── slug.ts
│   │   └── utils.ts
│   └── types/
│
├── docs/
│   ├── design-brief.md
│   └── decisions/                   # ADRs — start with 001-payment-provider.md
├── middleware.ts                    # age gate — runs before every catalog route
├── .env.example
└── CLAUDE.md
```

Convention inside each `features/*` directory:

- `queries.ts` — read paths, server-only, called directly from RSC
- `actions.ts` — write paths, `"use server"`, wrapped in `next-safe-action`
- `schemas.ts` — Zod schemas, the single source of truth for input types
- `components/` — feature-specific UI

---

## 6. Data Model

### 6.1 Modeling a heterogeneous catalog

This is the part of the spec the real catalog changed most.

A two-axis `size × color` model works for lingerie and breaks immediately on everything
else. Lubricants vary by presentation, not size. A Lovense device usually has no options
at all. A vibrating egg may come in two colors and nothing else. Hardcoding `sizeId` and
`colorId` as columns would mean nullable foreign keys everywhere and a query layer full of
special cases.

The model has to be **polymorphic**: options are data, not schema.

```
Product ──< ProductOption ──< ProductOptionValue
   │                                  │
   └──< ProductVariant ──< VariantOptionValue ──┘
```

- `ProductOption` — an axis of choice for this product: "Talla", "Color", "Presentación"
- `ProductOptionValue` — the choices on that axis: "S", "Negro" (+ hex), "30 ml"
- `ProductVariant` — the sellable SKU. Holds price and stock
- `VariantOptionValue` — which values this variant represents

**Options versus specs.** The distinction most catalogs get wrong: if choosing it produces
a different SKU, it is an *option*. If it is identical for every unit of the product, it is
a *spec* — display metadata. Volume is an option for a gel sold in 30 ml and 130 ml; it is
a spec for a device with a single presentation. Material, connectivity, battery type, and
water resistance are always specs. They belong in `ProductSpec`, not in the variant space.

**Every product has at least one variant — including products with no options.**

This is not a workaround, and the reason is worth stating precisely. The variant space is
a subset of the Cartesian product of the option value sets:

```
V ⊆ V₁ × V₂ × … × Vₙ
```

For lingerie with S = {S, M, L, XL} and C = {negro, rojo}, the full space has
|S| · |C| = 8 elements, but the store may only stock 5 of them — so V is a proper subset,
and variants are created explicitly rather than generated.

For n = 0 the empty product is the singleton set containing the empty tuple, so |V| = 1.
A product with no options therefore has exactly one variant *by construction*, not by
convention. That is the load-bearing consequence: cart, inventory, pricing, and order code
never branch on "does this product have options." They always operate on variants. One
code path for lingerie, gels, and devices alike.

**Enforcing combination uniqueness.** Prisma cannot express "unique set of related rows."
Denormalize: store an `optionKey` on the variant — the option value IDs, sorted and
joined — with `@@unique([productId, optionKey])`. Compute it in one place, in
`features/catalog/optionKey.ts`, and never build it inline.

**Cost of this choice.** Rendering a product page needs `Product → options → values` and
`variants → optionValues`, which is more joins than two columns would be. That is the
price of a catalog that does not need a migration every time the client adds a product
family. Given they already sell across three unrelated families, it is worth paying now.

### 6.2 Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Catalog ────────────────────────────────────────────────

model Brand {
  id       String    @id @default(cuid())
  name     String    @unique   // "Lovense", "Sen Intimo", "Pretty Love"
  slug     String    @unique
  logoUrl  String?
  products Product[]
}

model Category {
  id       String     @id @default(cuid())
  name     String                // "Lencería", "Cosmética íntima", "Juguetería"
  slug     String     @unique
  position Int        @default(0)
  parentId String?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children Category[] @relation("CategoryTree")
  products Product[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
}

model Product {
  id          String        @id @default(cuid())
  slug        String        @unique
  name        String
  description String?       @db.Text
  status      ProductStatus @default(DRAFT)

  supplierRef String?       // supplier reference, e.g. "11362" — already in use

  brandId    String?
  brand      Brand?    @relation(fields: [brandId], references: [id], onDelete: SetNull)
  categoryId String?
  category   Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  options  ProductOption[]
  variants ProductVariant[]
  specs    ProductSpec[]
  images   ProductImage[]

  // Denormalized for catalog cards — avoids an aggregate per render.
  // Recalculated whenever a variant price changes.
  minPriceCents Int @default(0)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  publishedAt DateTime?

  @@index([status, publishedAt])
  @@index([categoryId])
  @@index([brandId])
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

// An axis of choice. Zero rows is valid and common.
model ProductOption {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  name     String   // "Talla" | "Color" | "Presentación"
  position Int      @default(0)

  values ProductOptionValue[]

  @@unique([productId, name])
  @@index([productId])
}

model ProductOptionValue {
  id       String        @id @default(cuid())
  optionId String
  option   ProductOption @relation(fields: [optionId], references: [id], onDelete: Cascade)

  value    String   // "S" | "Negro" | "30 ml"
  hex      String?  // set for colors, null otherwise — drives UI swatches
  position Int      @default(0)

  variantValues VariantOptionValue[]
  images        ProductImage[]

  @@unique([optionId, value])
  @@index([optionId])
}

// The sellable unit. Always at least one per product.
model ProductVariant {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  sku            String  @unique
  priceCents     Int
  compareAtCents Int?    // strikethrough price for promotions
  barcode        String?

  // Sorted, joined option value IDs. Enforces combination uniqueness,
  // which Prisma cannot express over a relation. "" for option-less products.
  optionKey String @default("")

  // Inventory. available = stockOnHand - stockReserved
  stockOnHand   Int @default(0)
  stockReserved Int @default(0)
  lowStockAt    Int @default(3)

  isActive     Boolean              @default(true)
  optionValues VariantOptionValue[]
  movements    InventoryMovement[]
  orderItems   OrderItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([productId, optionKey])
  @@index([productId])
  @@index([sku])
}

model VariantOptionValue {
  variantId     String
  variant       ProductVariant     @relation(fields: [variantId], references: [id], onDelete: Cascade)
  optionValueId String
  optionValue   ProductOptionValue @relation(fields: [optionValueId], references: [id], onDelete: Cascade)

  @@id([variantId, optionValueId])
  @@index([optionValueId])
}

// Display-only attributes that do NOT vary within a product.
// "Material: silicona médica" · "Conectividad: Bluetooth" · "Contenido: 130 ml"
model ProductSpec {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  label    String
  value    String
  position Int    @default(0)

  @@index([productId, position])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  // Nullable: null = applies to the whole product.
  // Set = show when that option value is selected (color-specific photography).
  optionValueId String?
  optionValue   ProductOptionValue? @relation(fields: [optionValueId], references: [id], onDelete: SetNull)

  url      String
  alt      String
  position Int    @default(0)

  @@index([productId, position])
}

// ─── Inventory ──────────────────────────────────────────────

// Append-only ledger. The stock columns on ProductVariant are the running
// balance; this explains how it got there. Essential for a store migrating
// off manual DM-based tracking.
model InventoryMovement {
  id        String         @id @default(cuid())
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  delta  Int            // negative = stock leaving
  reason MovementReason
  note   String?

  orderId String?
  order   Order?  @relation(fields: [orderId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@index([variantId, createdAt])
}

enum MovementReason {
  PURCHASE        // restocked from supplier
  SALE
  RETURN
  MANUAL_ADJUST   // physical count correction
  DAMAGE
  RESERVATION
  RESERVATION_RELEASE
}

// ─── Orders ─────────────────────────────────────────────────

model Customer {
  id        String    @id @default(cuid())
  email     String    @unique
  fullName  String
  phone     String
  orders    Order[]
  addresses Address[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Address {
  id         String   @id @default(cuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  fullName     String
  phone        String
  documentType DocumentType  // required for Colombian invoicing
  documentId   String
  department   String        // Antioquia
  city         String        // Medellín
  line1        String
  neighborhood String?
  notes        String?

  isDefault Boolean @default(false)
  orders    Order[]

  @@index([customerId])
}

enum DocumentType {
  CC   // cédula de ciudadanía
  CE   // cédula de extranjería
  NIT
  PP   // pasaporte
}

model Order {
  id          String @id @default(cuid())
  orderNumber String @unique  // "XOXO-7F3K2M" — what the customer quotes on WhatsApp

  // Nullable: guest checkout is mandatory in this category.
  customerId String?
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  addressId  String?
  address    Address?  @relation(fields: [addressId], references: [id], onDelete: SetNull)

  guestEmail String?
  guestPhone String?

  status   OrderStatus @default(PENDING)
  currency String      @default("COP")

  subtotalCents Int
  shippingCents Int @default(0)
  discountCents Int @default(0)
  totalCents    Int

  // Discretion is a functional requirement, not a preference.
  discreetPackaging Boolean @default(true)

  items     OrderItem[]
  payments  Payment[]
  movements InventoryMovement[]

  // Reservations expire so abandoned carts release stock.
  reservationExpiresAt DateTime?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  paidAt    DateTime?
  shippedAt DateTime?

  @@index([status, createdAt])
  @@index([customerId])
}

enum OrderStatus {
  PENDING     // created, awaiting payment
  PAID
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

// Snapshot of the purchase. Catalog data is copied, not joined,
// so later edits never rewrite history.
model OrderItem {
  id      String @id @default(cuid())
  orderId String
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  variantId String?
  variant   ProductVariant? @relation(fields: [variantId], references: [id], onDelete: SetNull)

  productName String
  brandName   String?
  variantSku  String
  // Human-readable at purchase time, e.g. "Talla: S · Color: Negro".
  // Empty string for option-less products.
  variantLabel    String
  optionsSnapshot Json?
  imageUrl        String?

  unitPriceCents Int
  quantity       Int
  totalCents     Int

  @@index([orderId])
}

// ─── Payments ───────────────────────────────────────────────

model Payment {
  id      String @id @default(cuid())
  orderId String
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)

  provider          String         // "wompi" | "mock" — never "stripe", see §2
  providerReference String?        @unique
  method            PaymentMethod
  status            PaymentStatus  @default(PENDING)
  amountCents       Int

  rawPayload Json?  // full provider response, for reconciliation and disputes

  // Manual transfer flow: customer uploads a receipt, an advisor approves in the
  // admin panel. Nothing ships until status is APPROVED.
  proofOfPaymentUrl String?
  verifiedAt        DateTime?
  verifiedBy        String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orderId])
  @@index([status])
}

enum PaymentMethod {
  CARD
  PSE
  NEQUI
  DAVIPLATA
  BANCOLOMBIA_TRANSFER
  CASH_ON_DELIVERY       // contra entrega — already the client's working channel
  BANK_TRANSFER_MANUAL   // customer transfers, uploads proof, an advisor verifies
}

enum PaymentStatus {
  PENDING
  AWAITING_VERIFICATION  // proof uploaded, waiting on a human to confirm
  APPROVED
  DECLINED
  VOIDED
  ERROR
  REFUNDED
}
```

### 6.3 What is deliberately not in the database

**Age verification.** The gate stores a boolean consent and a timestamp in a cookie,
checked in `middleware.ts`. No date of birth, no identity document, no database row. In a
category this sensitive, the safest personal data is the data you never collect. If a
regulator later requires stronger verification, that becomes a third-party integration —
not a column.

### 6.4 Inventory reservation

Overselling is the failure mode that damages trust fastest, and it is exactly what the
current DM process gets wrong. The rule:

```
available(variant) = stockOnHand - stockReserved
```

Flow:

1. **Checkout starts** → in a single transaction, increment `stockReserved` for each item
   and set `Order.reservationExpiresAt = now + 30 min`. Write a `RESERVATION` movement.
2. **Payment approved (webhook)** → decrement `stockOnHand`, decrement `stockReserved`,
   write a `SALE` movement, set order to `PAID`.
3. **Payment declined or reservation expires** → decrement `stockReserved`, write
   `RESERVATION_RELEASE`.

Every stock mutation runs inside `prisma.$transaction` with the variant row locked. Use
conditional updates so a concurrent request cannot drive availability negative:

```ts
const updated = await tx.productVariant.updateMany({
  where: { id: variantId, stockOnHand: { gte: qty + reservedDelta } },
  data:  { stockReserved: { increment: qty } },
});
if (updated.count === 0) throw new OutOfStockError(variantId);
```

Expiry sweeping runs on a Vercel Cron hitting a protected route handler every 10 minutes.

**Cash on delivery breaks this model and needs its own rule.** A `contra entrega` order
reserves stock against a payment that may never happen, and a 30-minute expiry is
meaningless when the money arrives at the door two days later. Options, in increasing
order of friction:

1. Reserve indefinitely and let the owner cancel manually from the admin panel — simplest,
   but stock silently disappears on no-shows
2. Reserve with a long expiry (e.g. 72h) and auto-release, requiring the owner to mark
   delivery before the window closes
3. Require WhatsApp confirmation before the reservation is created — closest to how the
   business already works

Recommend option 2, with the no-show rate reviewed after a month. Ask the client what
their current no-show rate on `contra entrega` is; they will know, and it decides this.

---

## 7. Delivery Plan

Design first, because that is what was committed to the client — and because a visual
approval de-risks everything downstream.

| Phase | Output | Blocks on |
| --- | --- | --- |
| **0 — Design** | Age gate, Home, Catalog, Product detail. Static, seeded mock data, deployed to a Vercel preview URL | Nothing |
| **1 — Catalog** | Real Prisma schema, seed script, admin product CRUD | Phase 0 approval |
| **2 — Cart & Checkout** | Cart, address form, checkout with `MockProvider` | Phase 1 |
| **3 — Payments** | Wompi adapter, webhooks, reservation logic, confirmation email | Merchant account approved |
| **4 — Admin & launch** | Inventory screen, order management, analytics, domain | Phase 3 |

Phase 3 depends on an external approval process outside your control, and in this category
that approval is genuinely uncertain rather than merely slow. Starting the gateway
conversation in week 1 — not week 6 — is the single highest-leverage scheduling decision in
this project.

**Contingency if no gateway approves the category:** the store still works. Cash on
delivery in Medellín plus a WhatsApp handoff for the rest of the country is exactly the
client's current operation, and even that version replaces price-hunting DMs with a real
catalog. Ship it that way rather than blocking launch on payments — then add card and PSE
when a gateway clears. The `PaymentProvider` port is what makes this a configuration
change instead of a rebuild.

---

## 8. Phase 0 — Design Brief

### The strategic problem the design has to solve

The buyer's anxiety in this category is not "is this cute." It is **trust and
discretion**: is this a real business, will the package be discreet, will this show up on
a card statement, does anyone see what I bought. The current Instagram profile answers
that with a sentence in the bio. The site has to answer it structurally.

That is the design thesis: **neon signage outside, calm pharmacy inside.** The wordmark
and one accent carry all the brand heat. Catalog, product page, and checkout are quiet,
spacious, and clinical. Restraint here is not timidity — it is the thing that converts.

### Brand tokens

Derived from the existing assets: neon script wordmark in magenta-to-red glow on
near-black, with story highlight covers in a soft pink-lavender wash.

```css
@theme {
  --color-ink:     #0B0A0F;  /* ground */
  --color-surface: #16141C;  /* elevated cards */
  --color-neon:    #FF2BC2;  /* magenta glow — the signature */
  --color-ember:   #F5325B;  /* wordmark red */
  --color-blush:   #F6C9DE;  /* soft pink, from highlight covers */
  --color-mist:    #C9B6E4;  /* lavender, from highlight covers */
  --color-bone:    #F4F2F6;  /* body text on dark */
}
```

**Type.** Three roles, and the most important one is not a webfont.

| Role | Face | Used for |
| --- | --- | --- |
| Display | **The logo itself**, as an image | Wordmark only |
| Body / UI | **Instrument Sans** 400 / 500 / 600 | Everything readable |
| Utility | **IBM Plex Mono**, tabular figures | Prices, SKUs, quantities, spec values |

The logo is already a neon script. Do not try to match it with a script webfont — that
reads as costume, and it competes with the one thing that is genuinely theirs. Treat the
mark as an asset and let a disciplined body face do everything else. **The contrast
between the script mark and the quiet face is the identity**; matching them collapses it.

Instrument Sans over Inter: Inter is the reflex, and the reflex is what makes a design
look generated. Instrument Sans keeps enough personality in the letterforms to feel chosen
without raising its voice. Full Spanish diacritic coverage, free, weight range that stops
where it should.

The mono is the argument worth defending. Prices, SKUs, and spec values in IBM Plex Mono
with `font-variant-numeric: tabular-nums` do three things: the price column aligns down
the catalog grid, the specs table reads as a datasheet, and the number stops looking like
an Instagram promo and starts looking like a price list. In a category where the buyer's
question is "is this a real business," a price that behaves like a catalogue entry answers
it before any copy does. Plex Mono specifically over JetBrains or Geist Mono — those read
as code editor, and this needs to read as institution.

Never above weight 600; the wordmark carries the weight. Body never below 16px — smaller
triggers input zoom on iOS and reads as fine print, which costs trust here.

**Dark-ground tracking.** Light text on near-black blooms optically. Add
`letter-spacing: 0.01em` at 14px and below, `0.08em` on uppercase micro labels, and leave
16px body untracked. This is the detail that separates a considered dark UI from a
default one.

**Signature.** The neon glow, used exactly once per view — the selected option state, or
the add-to-cart. Never on body copy, never on multiple CTAs simultaneously. If the glow
is everywhere it stops being a signature and becomes a nightclub.

**Directions to avoid**, because they are what generative tools default to regardless of
brief:

- Cream background (`#F4F1EA`) + high-contrast serif + terracotta accent (`#D97757`)
- Near-black background with a single acid-green accent
- Broadsheet layout with hairline rules and zero border radius

Near-black is right here — but it has to arrive from the logo, with magenta, not from
default #2.

### Personas

**The buyer.** Arrives from a link in the Instagram bio or a story, on a phone, on mobile
data. She has usually already seen the product in the feed; she is not browsing, she is
checking three things: *is it available, how much, and will this be discreet.* She may be
buying somewhere she would rather not have the screen seen.

- Home shows real products above the fold, not a hero slogan
- Availability is a primary signal, not revealed at checkout
- Prices in clear COP formatting — `$45.000`, not `45000.00`
- Discretion stated plainly and early, not buried in a policy page
- Guest checkout obvious from the start
- Every tap target thumb-reachable

**The owner.** Runs the account herself, photographs products herself, currently tracks
stock in her head and a notebook, answers every DM personally. She will use the admin
panel on a phone, in a stockroom, one-handed.

- Adding a product must not feel like filling a tax form — especially when a product has
  no options at all, which is most of the catalog
- Stock adjustment must be two taps
- Low stock visible without searching for it

### Screens for the first review

| Screen | Its single job |
| --- | --- |
| **Age gate** | Establish this is a legitimate, compliant business — in one screen, without friction theater |
| **Home** | Prove this is XOXO, and put products one tap away |
| **Catalog (PLP)** | Filter by category and brand down to what is actually in stock |
| **Product detail (PDP)** | Answer options, price, specs, discretion, and shipping — then add to cart |

The age gate is part of the first review, not a later addition. It is the first thing
every visitor sees, so it is part of what the client is approving.

### Copy rules

Words carry more weight than usual here. The register is a well-run pharmacy: plain,
factual, unembarrassed.

- Product names exactly as the manufacturer names them
- Descriptions cover material, dimensions, function, care, compatibility
- Never euphemistic, never crude, never explicit
- Say "envío discreto" and describe what that concretely means — unbranded outer
  packaging, neutral sender name
- Errors explain what happened and how to fix it, in the interface's voice

### Deliverable

Static Next.js pages with seeded mock products from the real catalog — use their actual
products and real prices, not lorem ipsum. Deploy to a Vercel preview and send the client
a link, not screenshots. A link on her own phone, with her own products in it, is the
difference between "looks nice" and a decision.

---

## 9. Backlog

### Story map

```
Discover ──────► Choose ──────► Buy ──────► Receive
   │               │              │             │
 Home            Catalog        Cart        Confirmation
 Search          Filters        Checkout    Email
 Categories      PDP            Payment     Tracking
```

### Sprint 1 — Design (Phase 0)

| # | Story | Acceptance criteria |
| --- | --- | --- |
| 0 | As a visitor, I confirm I'm over 18 before seeing any product | Age gate enforced in middleware on every catalog route; consent stored as boolean + timestamp cookie, no date of birth collected |
| 1 | As a buyer, I see XOXO products as soon as the page loads, so I know I'm in the right place | Featured products above the fold on a 375px viewport; LCP < 2.5s on 4G |
| 2 | As a buyer, I browse the catalog and see prices and availability | Grid renders seeded products from all three families; out-of-stock visibly distinct |
| 3 | As a buyer, I open a product and choose its options | Option picker updates price and images; unavailable combinations disabled, not hidden; products with zero options render with no picker at all |
| 4 | As Brayan, I have a token system so screens stay visually consistent | Colors, type scale, and spacing defined in `globals.css` `@theme` |

**Definition of done for Sprint 1:** deployed to a preview URL, responsive from 375px,
keyboard focus visible, reduced motion respected, client link sent.

### Sprint 2 — Catalog

Prisma schema and first migration · seed script with real XoXo products · admin
product CRUD · Cloudinary image upload · catalog filters by category, size, color

### Sprint 3 — Cart and checkout

Zustand cart with persistence · cart drawer · address form with Colombian
department/city and document fields · checkout against `MockProvider` · order creation
and reservation logic

### Sprint 4 — Payments

`PaymentProvider` port · Wompi adapter with integrity signature · webhook handler with
signature verification and idempotency · reservation expiry cron · confirmation email

### Prioritization note

Payment integration is last in build order but its *onboarding* is first in calendar
order. These are different things and conflating them is how this project slips.

---

## 10. Getting Started

```bash
# 1. Scaffold
npx create-next-app@latest xoxo-store --typescript --tailwind --app --src-dir
cd xoxo-store

# 2. Database
npm install prisma --save-dev
npm install @prisma/client @prisma/adapter-pg pg
npx prisma init --datasource-provider postgresql

# 3. UI
npx shadcn@latest init
npx shadcn@latest add button card dialog input select sheet badge separator

# 4. Domain dependencies
npm install zod react-hook-form @hookform/resolvers next-safe-action zustand
npm install lucide-react class-variance-authority clsx tailwind-merge date-fns nanoid

# 5. Paste the schema from section 6.2, then
npx prisma migrate dev --name init
npx prisma db seed

# 6. Verify
npx prisma studio
npm run dev
```

`.env.example`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/xoxo?sslmode=require"

PAYMENT_PROVIDER="mock"          # mock | wompi | payu  — never stripe, see §2

WOMPI_PUBLIC_KEY=""
WOMPI_PRIVATE_KEY=""
WOMPI_EVENTS_SECRET=""
WOMPI_INTEGRITY_SECRET=""

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

RESEND_API_KEY=""
BETTER_AUTH_SECRET=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Order of work

1. Scaffold and commit
2. Write `CLAUDE.md` before writing features — it is what keeps Claude Code consistent
   across sessions
3. Write the Prisma schema and seed script **before** the design screens, so Phase 0 can
   render real shapes of data instead of hardcoded arrays
4. Build the three screens
5. Deploy the preview and send the link

Step 3 is worth the extra hour. Design screens built against the real data shape do not
need rebuilding when the database arrives.

---

## 11. Open Questions for the Client

Resolve these alongside the design review — they all affect scope.

1. **Payment category approval** — has any gateway been approached, and was the catalog
   described accurately? *Highest risk item in the project. Start week 1.*
2. **Legal entity and bank** — persona natural or SAS? RUT? Which bank for payouts?
3. **Cash-on-delivery no-show rate** — they will know this number, and it decides the
   reservation policy in §6.4.
4. **Shipping** — flat rate, by city, or free above a threshold? Which carrier, and does
   that carrier have restrictions on this category?
5. **Discreet packaging, concretely** — what does the outer package currently look like,
   and what sender name appears on the label? This is a promise the site will make in
   writing, so it has to be accurate.
6. **Catalog size** — how many products and variants at launch? Their Instagram suggests a
   wide catalog, which may justify bulk import in v1 rather than v2.
7. **Product photography** — most current posts have prices and a WhatsApp number burned
   into the image. Are clean source images available from suppliers? *This blocks the
   design phase more often than anything technical.*
8. **Age gate and legal review** — has a Colombian lawyer reviewed the store's obligations
   for this category? Terms, returns policy, and advertising claims all need it.
9. **Advertising** — Meta and Google both restrict paid promotion of adult products. Given
   29.4k existing followers, the launch plan is probably organic migration plus SEO. Is the
   client expecting paid ads? Set that expectation now.
10. **Returns policy** — hygiene-sensitive products usually cannot be returned once opened.
    This needs to be published before launch and shapes the `REFUNDED` flow.
11. **Domain** — registered already?

---

## Appendix — Decisions to Record as ADRs

Create `docs/decisions/` and write these up as they are settled:

- `001-payment-provider.md` — why Stripe is impossible here, on two independent grounds
- `002-variant-modeling.md` — polymorphic options over hardcoded size/color columns
- `003-server-actions.md` — no REST layer in v1, and the condition for extracting one
- `004-money-representation.md` — integer minor units
- `005-age-verification.md` — cookie consent over stored identity, and the data-minimization
  argument behind it
- `006-cod-reservations.md` — how cash on delivery holds stock, once the no-show rate is known
