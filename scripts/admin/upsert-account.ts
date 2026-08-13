import { hashPassword } from "better-auth/crypto";

import type { PrismaClient } from "../../src/generated/prisma/client";

// Shared by create-user.ts (real staff accounts) and create-dev-user.ts (the
// local-only default): the hash and the User + credential-Account rows must
// be written exactly one way, or the two scripts drift and one of them mints
// logins better-auth cannot verify.
//
// better-auth stores credentials on an Account row with providerId
// "credential" — the same table it uses for OAuth, so the password column is
// nullable there and set only for this provider.
export async function upsertCredentialAccount(
  db: PrismaClient,
  input: { email: string; name: string; password: string },
): Promise<"created" | "updated"> {
  const hash = await hashPassword(input.password);

  const user = await db.user.upsert({
    where: { email: input.email },
    update: { name: input.name },
    create: {
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name,
      emailVerified: true,
    },
  });

  const existing = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (existing) {
    await db.account.update({
      where: { id: existing.id },
      data: { password: hash },
    });
    return "updated";
  }

  await db.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hash,
    },
  });
  return "created";
}
