import { createSafeActionClient } from "next-safe-action";

// Shared next-safe-action client — every Server Action wraps in this so Zod
// validates at the boundary (CLAUDE.md rule 7). Unexpected errors surface as
// the generic serverError message; expected outcomes travel in the action's
// typed result instead.
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    console.error("[action]", e);
    return "Algo salió mal. Intenta de nuevo o escríbenos por WhatsApp.";
  },
});
