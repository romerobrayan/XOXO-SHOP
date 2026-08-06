import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { db } from "./db";

// Staff authentication, and only that. Customers never authenticate here:
// guest checkout is mandatory (CLAUDE.md rule 3), so the only accounts that
// exist belong to the owner and her advisors, and the only surface this
// guards is /admin.
//
// Sign-up is disabled deliberately. better-auth mounts a sign-up endpoint by
// default, and on a deployed store that endpoint lets anyone mint themselves
// a panel account — which, given the panel lists customer names, phones and
// document IDs, is the worst door in the project to leave open. Accounts are
// created with `npm run admin:create`, which needs the database URL and so
// can only be run by someone who already has it.
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  session: {
    // A week, refreshed once a day. She uses this standing in a stockroom;
    // re-typing a password on a phone every few hours is how a shared
    // "easier" password gets invented.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
});

export type Session = typeof auth.$Infer.Session;
