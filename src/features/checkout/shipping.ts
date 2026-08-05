// Flat shipping fee from the handoff ($12.000) — a design assumption the
// client still has to confirm (flat vs. per-city vs. free above a threshold,
// ESTADO §6). Lives here, server-side with the order math, so the action and
// the cart summary can never disagree; the cart store re-exports it for the
// client bundle. Minor units, like all money (CLAUDE.md rule 1).
export const SHIPPING_CENTS = 12_000_00;
