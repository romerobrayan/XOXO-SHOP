// Creates or updates a staff account for the admin panel.
//
//   npm run admin:create -- --email ana@secreto.co --name "Ana"
//
// The password is read from the ADMIN_PASSWORD environment variable, never
// from argv: arguments land in shell history and in the process list, where
// anyone on the machine can read them.
//
// This script exists because sign-up is disabled in src/lib/auth.ts — see the
// comment there. Creating an account therefore requires the database URL,
// which is the point.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const email = arg("--email")?.trim().toLowerCase();
  const name = arg("--name")?.trim() ?? "Equipo SECRETO";
  const password = process.env.ADMIN_PASSWORD;

  if (!email) throw new Error("Missing --email.");
  if (!password) {
    throw new Error(
      "Missing ADMIN_PASSWORD. Run: ADMIN_PASSWORD='…' npm run admin:create -- --email you@example.com",
    );
  }
  if (password.length < 12) {
    // This account can read every customer's name, phone, address and
    // document number. A short password is not a private risk here.
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const hash = await hashPassword(password);

  const user = await db.user.upsert({
    where: { email },
    update: { name },
    create: {
      id: crypto.randomUUID(),
      email,
      name,
      emailVerified: true,
    },
  });

  // better-auth stores credentials on an Account row with providerId
  // "credential" — the same table it uses for OAuth, so the password column
  // is nullable there and set only for this provider.
  const existing = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (existing) {
    await db.account.update({
      where: { id: existing.id },
      data: { password: hash },
    });
  } else {
    await db.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hash,
      },
    });
  }

  console.log(
    `${existing ? "Password updated" : "Account created"} for ${email}.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
