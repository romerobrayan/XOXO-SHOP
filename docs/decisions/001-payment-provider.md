# ADR 001 — Payment provider: port + adapters, PayU first, never Stripe

**Status:** Accepted · 2026-07 · **§3 amended by ADR 002 (2026-08)**

> **Amendment.** `docs/decisions/002-pasarela-wompi-vs-payu.md` compares the two
> gateways on price, settlement, payment-method mix and integration cost, and
> **flips the ordering in §3 below: Wompi is now the primary target, PayU the
> documented fallback.** Everything else in this ADR — the port, never Stripe,
> mock until approval, honest category declaration, cash on delivery and manual
> transfer as first-class methods — stands unchanged.

## Context

Adult products are a payment-restricted category, and Colombia is not a
supported Stripe merchant country. Stripe is ruled out on two independent
grounds: geography, and its prohibited-businesses list, which explicitly names
sexually oriented items including adult toys. Shopify Payments runs on Stripe
and is out for the same reason.

Field evidence settles the biggest unknown: Tienda Cereza, the scaled
competitor in this exact market (same country, same category, 30+ boutiques),
publicly processes cards through **PayU** — so at least one Colombian gateway
demonstrably underwrites this category at scale.

## Decision

1. **No gateway SDK outside `src/payments/providers/`.** Checkout talks only to
   the `PaymentProvider` interface (`src/payments/payment-provider.ts`).
2. **`PAYMENT_PROVIDER=mock` until a merchant account is approved.** The
   `MockProvider` unblocks Phase 0–3 development and client demos.
3. **PayU is the primary onboarding target, Wompi the second conversation.**
   Approval risk dominates API quality when the alternative is no card payments
   at all. Both conversations open in week 1; the adapter is written against
   whichever confirms first.
4. **The category is declared honestly, in writing, at onboarding.** The
   failure mode is not rejection on day one — it is approval under a vague
   merchant category followed by frozen funds after a later review.
5. **Cash on delivery and manual bank transfer are first-class payment
   methods**, not fallbacks. They are the client's working channels today and
   the launch contingency if no gateway approves the category.

## Consequences

- Swapping or adding a gateway is a new file in `src/payments/providers/`, not
  a refactor of the order domain.
- The store can launch on `contra entrega` + WhatsApp handoff alone if gateway
  onboarding stalls.
- `Order` and `Payment` never know provider-specific concepts; raw provider
  payloads are archived in `Payment.rawPayload` for reconciliation.

Full analysis: `docs/XOXO_TECHNICAL_SPEC.md` §2.
