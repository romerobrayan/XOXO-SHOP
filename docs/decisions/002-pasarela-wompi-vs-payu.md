# ADR 002 — Gateway selection: Wompi first, PayU as the documented fallback

**Status:** Proposed · 2026-08 · amends ADR 001 §3
**Blocked on:** the client's answer to §6 of `docs/ESTADO-Y-SIGUIENTE-SESION.md`

## Context

ADR 001 fixed the architecture (port + adapters, never Stripe) and named **PayU
first, Wompi second**. That ordering was set on a single piece of field
evidence — Tienda Cereza processing cards through PayU — before anyone had
compared the two on price, settlement, payment-method mix, or integration cost.

This ADR does that comparison. The architecture in ADR 001 is unchanged and
still correct: whichever gateway approves, the adapter is one file under
`src/payments/providers/`.

### A caveat on sourcing

This session could not reach `legal.payulatam.com`, `wompi.com` or `docs.wompi.co`
directly — outbound network egress is allowlisted in the environment. Every
figure below comes from search-surfaced excerpts of those documents plus
third-party 2026 comparisons. **Published aggregator list rates are the floor of
a negotiation, not a quote.** Confirm every number in writing during onboarding
before it drives a pricing decision. This ADR also does not re-verify Tienda
Cereza's current gateway; ADR 001's claim is carried forward, not re-proven.

## The price question is a wash — the mix question is not

Published rates, aggregator/self-serve tier, Colombia, 2026:

| Method | PayU (now Rapyd) | Wompi (Bancolombia) |
| --- | --- | --- |
| Card | 3.29 % + $300 (3.49 % for recurring) | 2.99 % + $600 |
| PSE | ~1.3 – 2 % (not published precisely) | 1.49 % + $1.200 |
| Nequi | — | 1.79 % |
| Daviplata / Bancolombia button / cash | via partners | included |
| Setup / monthly | none | none (Básico plan) |
| Payout | 3 business days; 3 free withdrawals/month, then $6.500 + IVA | next business day (Bancolombia); 2–3 days other banks |

Applying IVA to the full commission (the conservative reading — Wompi publishes
its card rate as "2,99 % + IVA + $600", which may mean IVA on the percentage
only), against this client's real ticket range of COP 45.000–120.000:

| Ticket | PayU card | Wompi card |
| --- | --- | --- |
| $45.000 | $2.119 — **4,71 %** | $2.315 — 5,15 % |
| $80.000 | $3.489 — **4,36 %** | $3.560 — 4,45 % |
| $120.000 | $5.055 — 4,21 % | $4.984 — **4,15 %** |

The two curves cross at **exactly COP 100.000** (0,30 % spread against a $300
difference in the fixed leg). This client's catalog straddles that point. At 100
orders/month of COP 80.000 the entire gateway choice is worth **~COP 7.000 a
month**. Card pricing is not a decision input.

What *is* worth real money is the method mix. Same 100 orders on Wompi:

- 100 % card → COP 356.000/month
- 40 % card / 40 % PSE / 20 % Nequi → COP 290.000/month — **~18 % cheaper**

Nequi at 1,79 % is both the cheapest rail and the most discreet one (no card
statement line, no bank descriptor). It is a compliance feature and a margin
feature at the same time, and it exists only on the Wompi side.

## The decision input that actually matters: category acceptance

This is the one place the two gateways are genuinely, structurally different.

**PayU publishes a per-rubro table.** Its LatAm "Actividades Restringidas y
Prohibidas" document lists **"Sex shop y artículos eróticos" as *Restringido* in
Colombia** — permitted with PayU's express prior authorization — while adult
*content* businesses are *Prohibido* across every country. The line PayU draws is
between physical erotic goods and adult content, and this store sits on the
permitted side of it. PayU's merchant T&C confirm what "Restringido" means: the
merchant may not operate the rubro "sin autorización expresa de PayU", and
account activation includes a risk and banking score review.

That is a **documented, nameable path**. It is the single most valuable fact in
this analysis: the store's category has a published status, not a hope.

**Wompi publishes no equivalent table.** Its Reglamento de Comercios (V3-2025)
§8 speaks only of generic "Actividades Ilícitas o Restringidas" and reserves the
right to reject, cancel or suspend an account immediately. Silence is not
acceptance — it means the category gets decided by a human at underwriting with
no published precedent to point at. And the counterparty is Bancolombia: the
aggregator model requires a **Bancolombia (or Nequi) deposit account in the
registered owner's name**, so a category review that goes badly touches the
banking relationship, not just a gateway integration.

This cuts both ways, and it is why the recommendation below is not "PayU,
obviously."

## Integration cost

Wompi is the cleaner adapter, by a clear margin:

- Modern REST/JSON API, public/private key pair, Widget · Web Checkout · direct API.
- Integrity signature is plain `SHA-256(reference + amount + currency + secret)`.
- Webhooks arrive with a `wompi_hash` header — HMAC-SHA256 of the raw body keyed
  on the API secret. That maps one-to-one onto `verifyWebhook(rawBody, headers)`
  in `src/payments/payment-provider.ts`; the port needs no change.
- The docs state explicitly that redirect must **not** be used to validate a
  transaction — only the event. That is exactly the shape
  `src/app/api/webhooks/[provider]/route.ts` is already built for.

PayU LatAm's WebCheckout is older (MD5-family signatures, a heavier API surface)
and, since March 2025, the LatAm payments business belongs to **Rapyd** and the
brand is mid-migration. An integration target that is being re-platformed is a
moving target. Neither is hard; Wompi is maybe a day cheaper and ages better.

## Decision

1. **Open both conversations in the same week, declaring the category honestly
   and in writing** — this part of ADR 001 stands and is not negotiable. The
   failure mode was never rejection on day one; it is approval under a vague
   merchant category followed by frozen funds after a later review.
2. **Flip the priority: Wompi is the primary target, PayU the fallback.**
   Wompi wins settlement (D+1 vs 3 days, no withdrawal fees), the payment-method
   mix (Nequi and the Bancolombia button, ~18 % cheaper on a realistic mix),
   and integration cost. Card pricing is a rounding error either way.
   The approval risk that argues for PayU is real but **bounded and already
   covered**: PayU's published *Restringido* status means the fallback costs
   weeks, not the project. Committing to PayU first would give up D+1 settlement
   and Nequi *permanently* to hedge a risk that is hedged anyway.
3. **Write the Wompi adapter first**, against the sandbox, before either account
   is approved. It costs a day, it is independently useful (`PAYMENT_PROVIDER=wompi`
   can be exercised in CI against sandbox keys), and it removes the gateway from
   the launch critical path. If PayU confirms first, the port makes that a
   second file, not a rewrite.
4. **Nequi and PSE ship as first-class methods, not extras.** They are cheaper
   and more discreet than cards, and discretion is a product requirement here.
5. **`PAYMENT_PROVIDER=mock` stays in production until a real merchant account is
   approved and its descriptor is confirmed.** Cash on delivery and manual bank
   transfer remain first-class and remain the launch contingency.

## What the client has to do before either application can be filed

None of this is code, and all of it is on the critical path. Gateway onboarding
asks for it directly:

- **RUT**, current cédula, proof of address (utility bill ≤ 3 months), and 3
  months of bank statements (PayU's stated document set).
- **A Bancolombia or Nequi account in the registering owner's name** if Wompi.
  If she registers as *persona natural*, the account must be **more than 30 days
  old** and the **first payout lands 30 days after the first transaction** —
  that is a launch-cashflow fact, not a footnote. Registering as *persona
  jurídica* avoids it.
- **The legal pages have to exist and be reachable on the live site.** This is
  the finding this ADR most wants on the record: `docs/ESTADO-Y-SIGUIENTE-SESION.md`
  files the footer's dead links ("Envíos y garantía", "Privacidad") under
  cosmetic debt. They are not cosmetic — they are an **onboarding blocker**.
  Underwriting reviews the live storefront. Needed: política de tratamiento de
  datos (Ley 1581/2012, Habeas Data), términos y condiciones, política de envíos,
  and política de devoluciones. Note for the returns page: the Estatuto del
  Consumidor's 5-day *derecho de retracto* generally excludes personal-hygiene
  and intimate products — say so explicitly and accurately rather than promising
  a right that does not apply, and rather than staying silent about it.
- **The payment descriptor.** `SECRETO BTQ` is the handoff's proposal. Confirm the
  exact string with whichever gateway approves — the discretion promise the site
  makes in writing depends on it.
- **The 18+ age gate stays.** It is evidence of good faith at underwriting for a
  restricted rubro, which is a second reason to keep it beyond the compliance one.

## Consequences

- `src/payments/providers/wompi.ts` becomes the first real adapter; the factory in
  `src/payments/index.ts` gains a `case "wompi"`. Nothing outside
  `src/payments/` changes.
- `Payment.method` already carries `NEQUI`, `PSE`, `BANCOLOMBIA_TRANSFER` and
  `CASH_ON_DELIVERY`, and `Payment.rawPayload` already exists for reconciliation.
  The schema needs no migration for this decision.
- The adapter cannot be finished without Bloque C — no `Order` row means nothing
  to attach a `Payment` to. Bloque C is the real next unit of work, gateway or
  no gateway.
- If Wompi declines the category, the fallback is PayU under its published
  *Restringido* status; if both decline, the store launches on contra entrega +
  manual transfer, which is what the client already runs today.

Supersedes ADR 001 §3 only. ADR 001 §1, §2, §4 and §5 stand unchanged.
