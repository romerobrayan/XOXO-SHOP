import { headers } from "next/headers";

// The absolute origin of the running deployment, for URLs handed to third
// parties — the gateway's redirect-url has to say where "back to the store"
// is. Resolved per-request from the proxy headers so local dev, every Vercel
// preview and production all point home without per-environment config.
//
// Trusting Host here is deliberate and bounded: the redirect-url only routes
// the buyer who sent this very request, so a forged header misdirects nobody
// but its author. Nothing security-relevant may ever branch on this value —
// payment truth arrives by webhook, which carries its own signature.
export async function requestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (/^(localhost|127\.)/.test(host) ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Outside a request scope — vitest calls the actions directly.
  }
  return "http://localhost:3000";
}
