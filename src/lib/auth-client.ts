"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin, so no baseURL: the panel is served from the store's own domain.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
