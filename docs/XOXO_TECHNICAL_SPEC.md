# SECRETO Ecommerce — Technical Specification

**Client:** XOXO Sex Shop (`@xoxo.sex0`), rebranding to **SECRETO · Boutique Erótica** —
adult products retailer, Medellín, Colombia
**Author:** Brayan Romero
**Version:** 0.4 — Delivery plan, backlog and §6.4 stock flow synced with what shipped
through Bloque F (online payment verified against the Wompi sandbox)
**Status:** Phases 1–3 built (catalog + admin + checkout + payments-in-sandbox);
production payment waits on the merchant account. Living state:
`docs/ESTADO-Y-SIGUIENTE-SESION.md`

> **Scope of this document.** Sections 1–7 and 9–11 are the product and engineering spec.
> **Section 8 is a summary of the design direction, not its source** — the design source
> of truth is the handoff package in `design_handoff_web_secreto/` (README, tokens,
> `GUIA-DE-MARCA.md`). The pre-rebrand design documents live in `docs/archive/` and
> describe a neon direction that no longer applies.

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

### The rebrand

The client approved a new identity: **SECRETO · Boutique Erótica**, slogan *"El placer es
tuyo. El secreto, nuestro."* For a 2–3 month transition the brand signs **"SECRETO · antes
XOXO"** so the Instagram audience follows the name across.

This is not cosmetic for the store. The old identity was a neon script wordmark; SECRETO
is a typographic wordmark on marfil and vino, positioned as a *perfumería*, not a sex shop.
The whole point of the reposition is that the buyer's anxiety in this category is trust and
discretion — and a boutique reads as a business you can give a card to. §8 summarizes the
direction; `design_handoff_web_secreto/` defines it.

The repository, the Prisma models, and the internal vocabulary still say XOXO in places.
That is deliberate churn avoidance, not drift: renaming a database column buys nothing the
customer can see. Anything **customer-facing** says SECRETO.

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
| 18+ age confirmation | Dismissible modal on first visit, driven from `src/proxy.ts` (Next 16 renamed the `middleware.ts` convention). Boolean consent + timestamp cookie. **Do not collect date of birth** — data minimization. See the note below on how hard this should be |
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

> **Superseded by ADR 002 (agosto 2026).** A priced comparison flipped the order
> once more: **Wompi first, PayU the documented fallback.** Card fees tie at exactly
> COP 100.000; what pays is the payment mix (Nequi and PSE — cheaper and more
> discreet — only exist on Wompi's side), D+1 settlement, and integration cost. PayU
> keeps the one decisive card — its public category table lists "Sex shop y
> artículos eróticos" as *Restringido* (allowed with authorization) in Colombia —
> which is why it stays as the documented fallback. The Wompi adapter is written
> and verified against the sandbox (Bloque F, 2026-08-13). Full comparison:
> `docs/decisions/002-pasarela-wompi-vs-payu.md`.

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

**Recommendation: PayU first, Wompi second** *(superseded by ADR 002 — Wompi first,
PayU documented fallback; see the note above)*. PayU is demonstrably processing for this
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
  })
    .format(cents / 100)
    .replace(/\s/g, "");
```

The trailing `replace` is not incidental: `Intl` emits `$ 120.000` with a non-breaking
space, and the brand guide fixes the Colombian compact form `$120.000`. One function, so
the rule holds everywhere.

**The catalog reads from Postgres or from fixtures, decided by `DATABASE_URL`.**
The Phase 0 preview has no database, and the design review could not wait on one. Rather
than hardcoding arrays into pages, `features/catalog/queries.ts` answers from
`fixtures.ts` when `DATABASE_URL` is absent — typed as the same Prisma payloads, mapped
through the same DTOs, so no page component knows which source it got. Both sources read
one declaration in `demo-catalog.ts`, and `parity.test.ts` compares them against a seeded
database whenever one is configured.

This is scaffolding with an expiry date, not architecture: it comes out when the client's
real catalog is loaded and the store always has a database. Until then it is what lets a
preview URL exist at all.

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

| Package | Purpose | Installed |
| --- | --- | --- |
| `nanoid` | Human-readable order numbers | Yes |
| `date-fns` | Dates with `es` locale | Yes |
| `better-auth` | Admin authentication. Lighter than Auth.js for a single-role panel | Yes — live in production (Bloque D); sign-up disabled, accounts via `admin:create` |
| `resend` + `react-email` | Order confirmation emails | No — the one open piece of Sprint 4 |
| `next-cloudinary` | Product image hosting, transformation, and optimization | Cloudinary is live via the import pipeline (`scripts/import/`), which re-hosts supplier photos; the component library itself is still unused |

The three unchecked rows are decisions, not dependencies. Nothing imports them yet, so
they are not in `package.json`; add each in the commit that first uses it, along with its
entry in `.env.example`.

### Dev

`eslint`, `prettier`, `prettier-plugin-tailwindcss`, `vitest`, `@playwright/test`, `tsx`,
`dotenv`

Fonts are self-hosted through `next/font/google` (Marcellus, Archivo) — no external font
request at runtime.

### Infrastructure choices

- **Hosting:** Vercel. Zero-config for Next.js, and the free tier covers a v1 store.
- **Database:** **Neon** (chosen and live — `docs/NEON-CLOUD.md`), with the local Docker
  Postgres kept for offline work and for generating migrations
  (`docs/POSTGRES-DOCKER.md`).
- **Images:** Cloudinary free tier. Do not commit product photography to the repo.

---

## 5. Folder Structure

What exists today, with the directories Phases 1–4 will fill marked `(planned)`.

```
XOXO-SHOP/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                  # init · order_idempotency_key · guest_address ·
│   │                                # admin_auth · payment_method_nullable
│   └── seed.ts                      # writes the demo catalog to Postgres
├── prisma.config.ts                 # Prisma 7 config: schema path, migrations, seed command
├── src/
│   ├── app/
│   │   ├── (storefront)/            # public pages, age gate applies
│   │   │   ├── layout.tsx           # announcement bar, header, footer
│   │   │   ├── page.tsx             # Home
│   │   │   ├── tienda/
│   │   │   │   ├── page.tsx         # Catalog (PLP)
│   │   │   │   └── [slug]/page.tsx  # Product detail (PDP)
│   │   │   ├── carrito/page.tsx
│   │   │   └── legal/               # privacidad · términos · envíos · devoluciones
│   │   ├── (checkout)/checkout/     # own layout; gracias/ = gateway return page
│   │   ├── (admin)/admin/           # auth-gated panel — orders + products (Bloque D)
│   │   ├── api/webhooks/[provider]/route.ts
│   │   ├── layout.tsx               # fonts, metadata
│   │   └── globals.css              # Tailwind v4 @theme — the SECRETO tokens
│   │
│   ├── components/
│   │   ├── ui/                      # shadcn primitives: badge, button, dialog, input, select
│   │   ├── commerce/                # ProductImagePlaceholder, WhatsAppCta
│   │   └── site/                    # AnnouncementBar, SiteHeader, SiteFooter, Breadcrumb, nav
│   │
│   ├── features/
│   │   ├── age-gate/                # AgeGate modal + consent cookie name
│   │   ├── catalog/
│   │   │   ├── queries.ts           # getProducts, getProductBySlug — DB or fixtures
│   │   │   ├── demo-catalog.ts      # the demo products, declared once
│   │   │   ├── fixtures.ts          # demo-catalog as Prisma payloads (no DATABASE_URL)
│   │   │   ├── shapes.ts            # the canonical Prisma include shapes
│   │   │   ├── dto.ts               # the boundary that keeps stock columns off the client
│   │   │   ├── optionKey.ts         # the ONLY place optionKey is computed
│   │   │   ├── pickerState.ts       # pure option-selection logic
│   │   │   ├── availability.ts      # available = onHand - reserved, banded for display
│   │   │   ├── sort.ts · schemas.ts
│   │   │   └── components/          # ProductCard, OptionPicker, Gallery, FilterSidebar, …
│   │   ├── cart/                    # Zustand store + header link
│   │   ├── checkout/                # createOrder · stock primitives · expiry sweep ·
│   │   │                            # payment initiation · CheckoutFlow · return-page query
│   │   ├── home/                    # NewsletterForm
│   │   ├── admin/                   # requireStaff session gate (better-auth)
│   │   ├── products/                # admin CRUD + two-tap stock adjustment
│   │   └── orders/                  # transitions (the state machine) · shared executor ·
│   │                                # payment-events (webhook semantics) · panel queries
│   │
│   ├── payments/
│   │   ├── payment-provider.ts      # the port
│   │   ├── types.ts
│   │   ├── providers/               # mock.ts · wompi.ts (sandbox-verified 2026-08-13);
│   │   │                            # payu.ts only if Wompi's onboarding falls through
│   │   └── index.ts                 # factory, reads PAYMENT_PROVIDER
│   │
│   ├── lib/                         # db.ts (Prisma singleton), money.ts, slug.ts,
│   │                                # contact.ts (the WhatsApp number), utils.ts
│   ├── generated/prisma/            # generated client — git-ignored, postinstall
│   └── proxy.ts                     # age gate — Next 16's middleware convention
│
├── design_handoff_web_secreto/      # DESIGN SOURCE OF TRUTH — tokens, brand guide, pages
├── docs/
│   ├── XOXO_TECHNICAL_SPEC.md       # this file
│   ├── ESTADO-Y-SIGUIENTE-SESION.md # current state, open debt, next blocks
│   ├── decisions/                   # ADRs — 001 payment provider · 002 Wompi vs PayU
│   └── archive/                     # pre-rebrand design docs (neon direction)
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

**The schema lives in `prisma/schema.prisma`, and that file is the only copy.** It was
inlined here while it was a proposal; it is now applied code with a migration behind it,
and a second copy in a document nobody runs is a copy that goes stale. (It already had:
this section still described a `ProductImage` model that shipped as `ProductMedia`.)

Read it there. What follows is what the file cannot tell you — the decisions behind it.

**Media, not images.** `ProductMedia` carries a `type` of `IMAGE` or `VIDEO` with a
`posterUrl` cover frame, because a third of what this client posts is video and a picker
that can only hold stills would have forced a schema change on first upload. Video is
tap-to-play and muted: a product page that starts playing this category's video on scroll
is a discretion failure, not a feature.

`ProductMedia.optionValueId` is nullable — `null` applies to the whole product, set means
"show this only while that value is selected." That is how color-specific photography
attaches without a second table.

**Money is `Int`, in cents.** COP has no decimal in practice, but the rule is about
representation, not the currency: `Float` accumulates error the moment a total is summed.
Format at render time only, with `formatCOP()` in `src/lib/money.ts`.

**`optionKey` on the variant.** The denormalized, sorted, joined list of option value IDs
backing `@@unique([productId, optionKey])` — see §6.1. `""` for option-less products, which
is why they collapse to exactly one row without a special case.

**Stock is two columns and a ledger.** `stockOnHand` and `stockReserved` are the running
balance; `InventoryMovement` is the append-only explanation of how they got there. Every
mutation writes a row, seeding included. Available stock is `stockOnHand - stockReserved`
and is never exposed raw to the storefront — the DTO layer in
`src/features/catalog/dto.ts` bands it before it reaches a page prop.

**`OrderItem` is a snapshot.** Product name, brand, SKU, option labels, and unit price are
copied at purchase time. A historical order resolved through a join to the live catalog
would silently rewrite itself when the client edits a price. `variantId` stays as a
nullable reference for reporting, with `onDelete: SetNull`.

**`Order.customerId` is nullable.** Guest checkout is mandatory in this category, so the
customer row is optional and `guestEmail` / `guestPhone` carry the contact. The order
number is what the buyer quotes on WhatsApp — a short human-readable code, not the cuid.

**`Order.discreetPackaging` defaults to `true`.** A default, not a checkbox to be
remembered.

**Payment carries the manual-transfer flow.** `proofOfPaymentUrl`, `verifiedAt`, and
`verifiedBy` exist because bank transfer with an advisor approving a receipt is a real
payment method here, not a fallback — see §2. `rawPayload` keeps the full provider
response for reconciliation and disputes.

**Colombian address fields.** `department`, `city`, `documentType`, `documentId` are
required for invoicing, and `documentType` is an enum (`CC` / `CE` / `NIT` / `PP`) rather
than a string so the admin panel can render it as a select.

**Changing the schema:** edit `prisma/schema.prisma`, run `npx prisma migrate dev`, commit
the generated migration with the change. Never hand-edit an applied migration.

### 6.3 What is deliberately not in the database

**Age verification.** The gate stores a boolean consent and a timestamp in a cookie,
checked in `src/proxy.ts`. No date of birth, no identity document, no database row. In a
category this sensitive, the safest personal data is the data you never collect. If a
regulator later requires stronger verification, that becomes a third-party integration —
not a column.

### 6.4 Inventory reservation

Overselling is the failure mode that damages trust fastest, and it is exactly what the
current DM process gets wrong. The rule:

```
available(variant) = stockOnHand - stockReserved
```

Flow — as built in Bloques C, D and F (the state machine in
`src/features/orders/transitions.ts` is the authority on which move touches stock):

1. **Checkout starts** → in a single transaction, increment `stockReserved` for each
   item and set `Order.reservationExpiresAt` — **30 minutes** for online payment
   through a real gateway (the signed payment link carries the same expiry, so the
   gateway refuses money for released stock), **72 hours** for contra entrega and for
   the mock. Write a `RESERVATION` movement.
2. **Payment approved (webhook)** → set order to `PAID` **through the state machine**,
   whose `PENDING→PAID` stock effect is `none`: the units stay reserved for the order.
   The sale commits **exactly once, at `PROCESSING→SHIPPED`** from the panel —
   `RESERVATION_RELEASE` + `SALE` movements, both balances drop.
   `transitions.test.ts` pins that invariant ("consumes the reservation only when
   shipping"); a webhook that committed here would double-commit at shipping.
3. **Reservation expires** (abandoned, or declined and never retried) → the sweep
   cancels `PENDING` orders and releases: decrement `stockReserved`, write
   `RESERVATION_RELEASE`. A declined payment alone releases nothing — the buyer can
   retry the same signed link while the reservation holds.

Every stock mutation runs inside `prisma.$transaction` with the variant row locked. Use
conditional updates so a concurrent request cannot drive availability negative:

```ts
const updated = await tx.productVariant.updateMany({
  where: { id: variantId, stockOnHand: { gte: qty + reservedDelta } },
  data:  { stockReserved: { increment: qty } },
});
if (updated.count === 0) throw new OutOfStockError(variantId);
```

(As built, the guard is a raw conditional `UPDATE` in
`src/features/checkout/stock.ts` — Prisma cannot compare a column against another
column plus a parameter — but the shape and the failure mode are exactly these.)

Expiry sweeping runs on a Vercel Cron hitting a protected route handler (daily on the
Hobby tier), plus an opportunistic sweep at the top of every `createOrder`.

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

| Phase | Output | Blocks on | Status |
| --- | --- | --- | --- |
| **0 — Design** | Age gate, Home, Catálogo, Producto, Checkout. Demo data, deployed to a Vercel preview URL | Nothing | **Implemented** — SECRETO handoff built, awaiting client sign-off |
| **1 — Catalog** | Prisma schema and first migration, seed script, admin product CRUD | Phase 0 approval | **Mostly done** — schema, migrations, seed, supplier import pipeline (Cloudinary) and admin product CRUD shipped; open: the client's real curation and per-category margins |
| **2 — Cart & Checkout** | Server-side cart, address form, order creation, checkout against `MockProvider` | Phase 1 | **Implemented (Bloque C, agosto 2026)** — `createOrder` writes `Order` + snapshots, guest address, per-line conflicts, atomic reservation with expiry |
| **3 — Payments** | Gateway adapter (Wompi per ADR 002, PayU fallback), webhooks, reservation logic, confirmation email | Merchant account approved | **Implemented and sandbox-verified (Bloque F, 2026-08-13)** — signed initiation, idempotent webhook through the state machine, return page. Production stays on `mock` until the merchant account is approved; confirmation email still open |
| **4 — Admin & launch** | Inventory screen, order management, analytics, domain | Phase 3 | **Admin shipped (Bloque D)** — orders with the state machine and product CRUD with two-tap stock adjustment, live in production; open: analytics, domain, launch checklist |

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

## 8. Phase 0 — Design

> **Summary, not source.** The design is specified by the handoff package in
> `design_handoff_web_secreto/`: its `README.md` (screen-by-screen), the tokens in
> `design_system/tokens/*.css`, and `design_system/GUIA-DE-MARCA.md` (tone of voice —
> read it before writing any customer-facing copy). Where this section and that package
> disagree, the package wins. The pre-rebrand brief in `docs/archive/` is superseded in
> full.

### The strategic problem the design has to solve

The buyer's anxiety in this category is not "is this cute." It is **trust and
discretion**: is this a real business, will the package be discreet, will this show up on
a card statement, does anyone see what I bought. The current Instagram profile answers
that with a sentence in the bio. The site has to answer it structurally.

The design thesis: **boutique outside, pharmacy inside.** The wordmark, the vino, and the
oro carry all the brand. Catalog, product page, bag, and checkout are quiet, spacious, and
clinical. Restraint here is not timidity — it is the thing that converts.

The rebrand sharpens this rather than changing it. A neon sign says *sex shop*; a
perfumería says *business you can hand your card to*. Same thesis, a positioning that
carries it further.

### Brand tokens

SECRETO is warm, light, and typographic — *perfumería premium, no sex shop de neón*. At
most two backgrounds per view (marfil for the page, crema for cards). The values below
mirror `design_system/tokens/colors.css`; they live in the codebase as Tailwind v4
`@theme` variables in `src/app/globals.css`.

```css
@theme {
  --color-marfil:        #F7F1E8;  /* página */
  --color-crema:         #FFFDF9;  /* tarjetas */
  --color-arena:         #F1E7D8;  /* fondos suaves, hover */
  --color-linea:         #E2D5C2;  /* bordes */
  --color-vino:          #5C1A2E;  /* marca / CTA */
  --color-vino-claro:    #71243C;  /* hover */
  --color-vino-profundo: #451423;  /* pressed */
  --color-oro:           #C9A96E;  /* acento */
  --color-cobre:         #8C5A3C;  /* kickers */
  --color-tinta:         #2B1B20;  /* titulares */
  --color-exito:         #587A4F;
  --color-error:         #A33D3D;
}
```

**Type.** Two faces, and the display one is the logo.

| Role | Face | Used for |
| --- | --- | --- |
| Display | **Marcellus**, weight 400 only | Wordmark, h1–h3, product names, quotes |
| Interface | **Archivo** 300–600 | Everything else, including prices |

Scale: 12 / 13.5 / 15 / 18 / 24 / 32 / 44 / 64. Kickers are Archivo 12px uppercase with
3px tracking in cobre; buttons uppercase with 1.5px tracking, medium. Prices are Archivo
semibold in vino, Colombian format `$120.000` through `formatCOP()`, always
`tabular-nums` so the column aligns down the catalog grid.

The logo is **typographic** — Marcellus uppercase at 0.25em tracking, rendered as text via
`.logo-wordmark`. The PNGs in `design_handoff_web_secreto/logos/` are for print and social,
never for the web wordmark. Never go above weight 600 in Archivo.

This replaces the earlier Instrument Sans + IBM Plex Mono pairing. The mono is gone on
purpose: SECRETO's authority comes from the serif and the whitespace, and a monospace price
next to a Marcellus product name reads as two unrelated brands. `tabular-nums` gets the
column alignment that was the actual argument for the mono, without the second voice.

**Geometry and motion.** Radii are nearly square — 2px buttons, 4px cards and inputs, 6px
modals and images. Pills (999px) appear **only** on chips, badges, and the WhatsApp CTA.
Exactly two shadows exist: `--shadow-card` on card hover, `--shadow-pop` on modals. Hover
lightens the vino, cards lift 2px, links go vino → cobre; transitions 150–200ms ease, no
bounces.

**Signature.** The brand motif is the `divisor` — a thin rule, centered text, a thin rule.
It is what separates the sections instead of a heading shouting.

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

### Screens in the review

| Screen | Its single job |
| --- | --- |
| **Age gate** | Establish this is a legitimate, compliant business — in one screen, without friction theater |
| **Home** | Prove this is SECRETO, and put products one tap away |
| **Catálogo (PLP)** | Filter by category and brand down to what is actually in stock |
| **Producto (PDP)** | Answer options, price, specs, discretion, and shipping — then add to the bag |
| **Checkout** | Three steps, guest by default, `contra entrega` as a first-class method |

The age gate is part of the review, not a later addition. It is the first thing every
visitor sees, so it is part of what the client is approving.

### Copy rules

Words carry more weight than usual here. The register is a warm sommelier who recommends
without judging: direct, elegant, unembarrassed. Spanish de "tú", `es-CO`.

- Product names exactly as the manufacturer names them
- Descriptions cover material, dimensions, function, care, compatibility
- Everything named naturally — never euphemistic, never crude, never explicit
- **No emojis.** `→` and `↓` are the only ornaments
- Say "envío discreto" and describe what that concretely means — unbranded outer
  packaging, neutral sender name, a neutral descriptor on the statement
- The discretion promise repeats at every touchpoint: beside the price, as an "empaque
  neutro" badge, in the announcement bar, in the checkout note
- Errors explain what happened and how to fix it, in the interface's voice

Full tone-of-voice guidance, with worked examples, is in
`design_handoff_web_secreto/design_system/GUIA-DE-MARCA.md`.

### Images

Real product photography does not exist yet. Every image slot renders
`ProductImagePlaceholder` — 4:5, diagonal arena stripes, a visible "Imagen pendiente"
label in monospace. Never substitute stock photography: a placeholder prettier than the
real asset means the client approves a design that cannot ship. Label the preview for her
so this is explicit.

The target is a photo session on the arena `#F1E7D8` background with warm, clean light.
Until then the stripes stay, and the layout is built at 4:5 so real photos drop in without
a reflow.

### Deliverable

Next.js pages rendering the demo catalog — the client's actual products at her actual
prices, not lorem ipsum — deployed to a Vercel preview. Send the client a link, not
screenshots. A link on her own phone, with her own products in it, is the difference
between "looks nice" and a decision.

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

### Sprint 1 — Design (Phase 0) — **done**

| # | Story | Acceptance criteria | Status |
| --- | --- | --- | --- |
| 0 | As a visitor, I confirm I'm over 18 before seeing any product | Age gate driven from `src/proxy.ts` on every storefront route; consent stored as boolean + timestamp cookie, no date of birth collected | Done |
| 1 | As a buyer, I see SECRETO products as soon as the page loads, so I know I'm in the right place | Featured products above the fold on a 375px viewport; LCP < 2.5s on 4G | Done — LCP unmeasured until real photography lands |
| 2 | As a buyer, I browse the catalog and see prices and availability | Grid renders demo products from all three families; out-of-stock visibly distinct | Done |
| 3 | As a buyer, I open a product and choose its options | Option picker updates price and images; unavailable combinations disabled, not hidden; products with zero options render with no picker at all | Done |
| 4 | As Brayan, I have a token system so screens stay visually consistent | Colors, type scale, and spacing defined in `globals.css` `@theme`, mirroring the handoff tokens | Done |

**Definition of done for Sprint 1:** deployed to a preview URL, responsive from 375px,
keyboard focus visible, reduced motion respected, client link sent.

### Sprint 2 — Catalog — **done except client decisions**

Prisma schema and first migration · seed script with the client's real products · admin
product CRUD · Cloudinary image upload · catalog filters by category and brand

Schema, migrations, seed, filters, the admin product CRUD (Bloque D) and the supplier
import pipeline with Cloudinary re-hosting (Bloque H) are in. **Open:** the client's
real curation over `revision.html` and the per-category margins — decisions, not code.

### Sprint 3 — Cart and checkout — **done (Bloque C)**

Zustand cart with persistence · cart drawer · address form with Colombian
department/city and document fields · checkout against `MockProvider` · order creation
and reservation logic

`createOrder` writes `Order` + `OrderItem` snapshots with a guest address, prices from
the database, per-line conflicts, idempotency key, atomic reservation and the expiry
sweep. The Playwright e2e buys end to end against a real Postgres.

### Sprint 4 — Payments — **done against the sandbox (Bloque F, 2026-08-13)**

`PaymentProvider` port · Wompi adapter first (ADR 002; PayU the documented fallback) ·
webhook handler with signature verification and idempotency · reservation expiry cron ·
confirmation email

All in except the confirmation email (Resend, Fase 2). The integrity signature is
confirmed with real sandbox transactions; the webhook settles orders through the state
machine and survives duplicated, concurrent and out-of-order deliveries. Production
waits on the merchant account: test keys in Vercel Preview only, events URL in Wompi's
panel, `PAYMENT_PROVIDER=mock` in Production until then.

### Prioritization note

Payment integration is last in build order but its *onboarding* is first in calendar
order. These are different things and conflating them is how this project slips.

---

## 10. Getting Started

The project is scaffolded; this is how you run it, not how it was built.

```bash
npm install                   # postinstall runs `prisma generate`
cp .env.example .env          # then fill in DATABASE_URL

npx prisma migrate dev        # applies prisma/migrations
npx prisma db seed            # demo catalog: 6 products, 14 variants
npm run dev                   # http://localhost:3000
```

Verify with `npx prisma studio`, `npm run test`, and `npm run build`.

**Running without a database.** Leave `DATABASE_URL` unset and every catalog query falls
back to `src/features/catalog/fixtures.ts`, which serves the same products through the
same DTOs. That is how the Phase 0 Vercel preview is deployed, and
`src/features/catalog/parity.test.ts` is what keeps the two sources honest — it compares
them through the real mappers whenever `DATABASE_URL` is set, and skips otherwise.

Both sources read `src/features/catalog/demo-catalog.ts`. **Add demo products there**, not
in the seed and not in the fixtures.

A local Postgres, if you need one:

```bash
createdb secreto_dev
# DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/secreto_dev?schema=public"
```

Environment variables are documented in `.env.example`, which is the authoritative list —
including the ones not wired up yet. Add a variable there in the same commit that first
reads it.

### Order of work — how it actually went

1. Scaffold and commit
2. Write `CLAUDE.md` before writing features — it is what keeps Claude Code consistent
   across sessions
3. Write the Prisma schema **before** the design screens, so Phase 0 renders real shapes
   of data instead of hardcoded arrays
4. Build the screens against fixtures typed as Prisma payloads
5. Deploy the preview and send the link
6. Then the database: migration, seed, and a parity check against the fixtures

Steps 3 and 4 were worth the extra hour. Design screens built against the real data shape
did not need rebuilding when the database arrived — enabling Postgres changed no page
component at all.

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
