// Boolean consent + timestamp in a cookie. No date of birth, no database row —
// data minimization matters more here than anywhere else. See spec §6.3.
export const AGE_CONSENT_COOKIE = "xoxo-mayor-de-edad";
export const AGE_CONSENT_TIMESTAMP_COOKIE = "xoxo-mayor-de-edad-ts";

// Re-confirm after a year.
export const AGE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Dismissing the gate (ESC / overlay) is NOT age confirmation — but it must
// not re-trap focus on every navigation either. A session cookie (no max-age,
// no timestamp) suppresses reopening until the browser closes. Only the
// confirm button writes the consent cookies above.
export const AGE_DISMISS_COOKIE = "xoxo-gate-descartado";
