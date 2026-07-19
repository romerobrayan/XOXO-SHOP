import { NextResponse, type NextRequest } from "next/server";

import { AGE_CONSENT_COOKIE } from "@/features/age-gate/consent";

// Age gate — compliance rule 1 in CLAUDE.md. A dismissible confirmation, not a
// hard wall: the storefront still renders, and the AgeGate modal opens when the
// consent cookie is absent. We forward the state as a request header so server
// components can read it without touching cookies() (which would opt every
// page out of static rendering).
// Next 16 renamed the middleware.ts convention to proxy.ts — same mechanism.
export function proxy(request: NextRequest) {
  const consent = request.cookies.get(AGE_CONSENT_COOKIE)?.value;

  const headers = new Headers(request.headers);
  headers.set("x-age-gate", consent === "1" ? "confirmed" : "required");

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Storefront routes only — skip static assets, images, and the admin panel.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|admin|api).*)"],
};
