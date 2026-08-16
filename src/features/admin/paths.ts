// Shared between server gate and client sign-out button, which is why it does
// not live in session.ts: that module is server-only and importing it from a
// client component fails the build.
export const LOGIN_PATH = "/admin/login";
// The dashboard: sales, low stock, and recent orders at a glance (Bloque I).
export const PANEL_HOME = "/admin";
