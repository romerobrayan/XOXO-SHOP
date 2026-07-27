# Design Brief — Product Detail Page (PDP)

> **SUPERSEDED — historical record, not a source of design truth.**
> This brief describes the XOXO neon direction (magenta on near-black, Instrument Sans +
> IBM Plex Mono). The client approved **SECRETO · Boutique Erótica** instead: marfil and
> vino, Marcellus + Archivo. The design source of truth is `design_handoff_web_secreto/`.
> What survives here is the market research and the PDP behavior reasoning — see
> `docs/archive/README.md`.

Written for a Claude Design session. Companion to the pre-rebrand `§8` of the technical
spec, which has since been rewritten around the SECRETO handoff.

---

## The brief

Design the product detail page for **XOXO Sex Shop**, an adult products retailer in
Medellín, Colombia, moving off Instagram after eight years of selling through DMs. They
have ~29.4k followers and ship nationwide, with cash on delivery in Medellín.

**Audience.** Adults arriving from a link in the Instagram bio, on a phone, on mobile
data. They have usually already seen the product in the feed. They are not browsing — they
are checking three things and then deciding: *is it available, what does it cost, and will
this arrive without announcing itself.*

**The single job of this page:** answer those three questions without the buyer having to
message anyone, and make the business feel unambiguously real.

**What this page is not:** a landing page. It is one screen inside a catalog with three
product families and dozens of SKUs. Depth of information matters more than a scroll
narrative.

---

## The thesis

**Neon signage outside, calm pharmacy inside.**

The buyer's anxiety in this category is not aesthetic — it is trust and discretion. The
brand's neon script wordmark carries all the heat. Everything below it is quiet, spacious,
and clinical: a well-run pharmacy that happens to have a great sign.

Restraint is the conversion strategy, not timidity. Design accordingly.

---

## Tokens

```css
@theme {
  --color-ink:     #0B0A0F;  /* ground */
  --color-surface: #16141C;  /* elevated cards */
  --color-neon:    #FF2BC2;  /* magenta glow — the signature */
  --color-ember:   #F5325B;  /* wordmark red */
  --color-blush:   #F6C9DE;  /* soft pink */
  --color-mist:    #C9B6E4;  /* lavender */
  --color-bone:    #F4F2F6;  /* body text on dark */

  --font-sans: "Instrument Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
}
```

- Display type is **the logo, as an image**. Do not substitute a script webfont.
- Body and UI: Instrument Sans, weights 400/500/600. Never above 600.
- Prices, SKUs, quantities, spec values: IBM Plex Mono with `tabular-nums`.
- Body never below 16px. Add `letter-spacing: 0.01em` at 14px and below.
- **The neon glow appears exactly once on this page: the add-to-cart button.** Nowhere
  else. If it is on two elements it is no longer a signature.

---

## Required structure

Mobile-first at 375px, then 768 and 1280. Design the mobile view first and completely.

1. **Gallery** — 4:5, swipeable, dot indicators. Some products have color-specific images
   that swap when a color is selected. **Real photography does not exist yet — see
   "Image placeholders" below. Design against the placeholder, not against imagined
   photos.**
2. **Identity block** — brand name, product name, supplier reference.
3. **Price** — mono, tabular. Strikethrough compare-at price when present.
4. **Option picker** — see below. The hard part.
5. **Availability** — in stock / low stock / out of stock, per selected combination.
6. **Add to cart** — the one glowing element. Sticky on mobile after scroll.
7. **Discretion block** — see below. Not a footnote.
8. **Specs table** — label/value pairs in mono. Material, contents, connectivity, care.
9. **Shipping and payment** — nationwide shipping, `contra entrega` in Medellín.
10. **Related products** — 4 cards, same category.

---

## The option picker: three states, one component

This is where most designs break. The catalog is heterogeneous and the picker must handle
all three cases without looking like three different components.

| Case | Example | What renders |
| --- | --- | --- |
| **Two axes** | *Conjunto Tiras*, `REF 11362`, $45.000 — Talla: S/M/L/XL · Color: Negro | Two labelled groups |
| **One axis** | *Sen Intimo Desensibilizante*, $80.000 — Presentación: 130 ml (and other volumes) | One labelled group |
| **Zero axes** | *Lovense Lush* — a single-SKU device | **No picker at all.** Not an empty state, not a disabled control — the section simply does not exist |

Rules:

- Sizes and volumes render as text chips. Colors render as swatches with the color name
  visible — never a swatch alone; color names carry meaning in this catalog.
- Unavailable combinations are **disabled and visible**, never hidden. A buyer needs to
  see that her size exists and is sold out; hiding it reads as the product not existing.
- The layout must not shift when the picker is absent. A zero-option product should look
  intentional, not like something failed to load.

---

## The discretion block

This is the differentiating element of the page and it needs to be designed, not written
into a policy link. It is what turns a stranger's site into a purchase.

It has to answer, concretely and without euphemism:

- What the outer package looks like and what sender name appears on the label
- What appears on the card statement
- That no product name or image appears in email or notifications

Design it as a small, confident, factual block near the add-to-cart — not a badge row,
not three icons with two words each. Icons-plus-adjectives is the template answer and it
reads as marketing. Plain sentences read as a promise.

---

## Image placeholders

Product photography is not available yet. The client's existing assets are mostly
**product-on-white packaging shots**, which is the constraint that matters: a white 4:5
image on a near-black ground becomes a bright rectangle that dominates every card and
works against the calm the rest of the page is building.

**Decision for v1:** images sit inside a deliberate light tile with rounded corners. The
white becomes intentional framing rather than an accident of the source photo. Design
around that, and make the placeholder look like it — because whatever the placeholder
looks like is what the client approves.

Rules for the placeholder:

- **It must not be prettier than the real thing.** No stock photography, no decorative
  gradients. It reproduces the constraints of the real image — aspect ratio, ground tone,
  density — it does not improve on them.
- **It must vary.** Nine identical tiles in a grid read as a broken loading state, and the
  reviewer starts evaluating "is this finished" instead of "does this structure work."
  Derive a subtle tint from the product slug.
- **It must be honest.** A small label saying the image is pending. The client should never
  mistake it for a design choice.

```tsx
// src/components/commerce/ProductImagePlaceholder.tsx
const TINTS = ["#F6C9DE", "#C9B6E4", "#FF2BC2", "#F5325B"] as const;

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export function ProductImagePlaceholder({
  name,
  seed,
}: {
  name: string;
  seed: string;
}) {
  const tint = tintFor(seed);
  return (
    <div
      role="img"
      aria-label={`Imagen pendiente: ${name}`}
      className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-surface"
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          background: `radial-gradient(120% 90% at 50% 15%, ${tint}, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone/40">
          Imagen pendiente
        </span>
        <span className="font-sans text-sm text-bone/70">{name}</span>
      </div>
    </div>
  );
}
```

**Open item, resolve before locking the grid:** 4:5 is an assumption. Confirm it against
one real supplier asset. If their source images are 1:1, the rhythm of the catalog grid
changes and it is much cheaper to know now.

---

## Field research — patterns worth taking

Drawn from Tienda Cereza (`tiendacereza.com`), the scaled competitor in this exact market.
Their visual style is not the reference — it's a busy, discount-led Shopify theme. Their
**information architecture and trust mechanics** are, because they've been tested against
this audience at volume.

**Discretion is repeated at every payment branch, not stated once.** Their payments page
restates the sealed, unmarked-packaging promise after each individual method. That's not
redundancy — anxiety about discretion spikes exactly at the moment of paying, and it spikes
again at each branch of the decision. Take this into checkout: the promise appears next to
the payment selection, not only in a policy page.

**Trust lives in two places, doing two different jobs.** They run a persistent four-item
footer bar — advisors, secure payment, discreet shipping, guarantees — as global
reassurance, and a fuller confidentiality page behind it. Warranty and confidentiality are
merged into one page, which frames discretion as a guarantee rather than a marketing claim.
This does not contradict the rule against icon-and-two-words rows in the PDP discretion
block: a global footer bar is a different job from the specific promise on the product.

**Product cards carry two different CTAs.** Products with options say *Elegir opciones* and
route to the PDP; products without options say *Añadir al carrito* and add directly. This
is the polymorphic option model surfacing in the UI, and it's better than a single generic
label. Build the catalog card to branch on option count.

**Brand is a primary navigation axis, not a filter buried in a sidebar.** They give brands
their own collection pages and a dedicated recommended-brands row on the home page. In this
category buyers arrive knowing the brand. Give Lovense, Sen Intimo, and Pretty Love real
surface area.

**Discounting is the core merchandising motion.** Percentage badges and struck-through
original prices are everywhere, and the home page is organized around weekly offers and
per-brand outlet collections. Design the card and PDP price treatment for the discounted
state as the *normal* state, not an exception. `compareAtCents` covers it.

**Category depth hides behind a shallow top level.** They have well over a hundred leaf
categories but only five top-level entries, with an alphabetical full list as an escape
hatch. XoXo has three families — keep three or four top-level entries and let depth arrive
through progressive disclosure.

**WhatsApp stays.** Even with 30+ physical stores and a card gateway, they keep a
persistent WhatsApp advisor button on every page. Read this correctly: the goal is not to
eliminate WhatsApp, it's to eliminate the *price-hunting* DM. The advisory conversation is
an asset and belongs in the design.

**Prices in this market commonly end in `.900`.** XoXo's current prices are round
(`$45.000`, `$80.000`). Whichever convention the client lands on, the tabular figures in
the mono face are what keep the column aligned when both appear in one grid.

---

## Copy

Spanish, `es-CO`. The register is a well-run pharmacy: plain, factual, unembarrassed.

- Product names exactly as the manufacturer names them
- Descriptions cover material, dimensions, function, care, compatibility
- **Never euphemistic, never crude, never explicit**
- Active voice, sentence case. A control says what happens: "Agregar al carrito"
- Out of stock is an invitation, not a dead end: offer notification when restocked
- Write real Spanish copy for every element. Placeholder text will hide whether the
  layout works

Prices format as `$45.000` — Colombian pesos, no decimals, period as thousands separator.

---

## Avoid

These are what generative tools produce by default regardless of brief:

- Cream background + high-contrast serif + terracotta accent
- Near-black with a single acid-green accent — near-black is right here, but it has to
  arrive from the logo with magenta, not from the default
- Broadsheet layout, hairline rules, zero border radius
- Numbered section markers (01 / 02 / 03) — nothing on this page is a sequence
- Badge rows of icon + two words for trust signals
- Gradient hero with a big number and a small label

Also avoid, specific to this category: anything suggestive in layout, imagery treatment,
or copy. The design's job is to make this feel ordinary and trustworthy.

---

## Quality floor

Responsive from 375px. Visible keyboard focus. Reduced motion respected. Contrast that
passes on a near-black ground — check the mist and blush tones against `--color-ink`
before committing to them for body text. No `localStorage`.

---

## Process

Work in two passes.

**First, a plan.** Before writing any code, produce a compact design plan: the palette as
named values, the type roles and scale, a layout concept with an ASCII wireframe for the
375px view, and the one signature element the page will be remembered by.

Then review that plan against this brief. If any part of it is what you would have
produced for any other product page, revise it and say what you changed and why.

**Then build**, following the revised plan exactly.

Deliver a single React component styled with Tailwind v4 tokens, rendering the two-axis
case (*Conjunto Tiras*) by default, with the zero-axis case reachable so both states can
be reviewed side by side.
