import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// better-auth's own transport, not a domain API. CLAUDE.md rules out a REST
// layer for catalog and orders — Server Actions cover those — but sign-in has
// to be an endpoint the library controls: it sets the session cookie itself.
export const { GET, POST } = toNextJsHandler(auth);
