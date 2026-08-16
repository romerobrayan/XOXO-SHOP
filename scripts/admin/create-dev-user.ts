// The default panel account for LOCAL DEVELOPMENT — and nowhere else.
//
//   npm run admin:dev
//   → admin@secreto.local / Admin123 en /admin/login
//
// (El login pide un correo, así que el clásico "Admin" vive como
// admin@secreto.local.)
//
// This is deliberately weaker than admin:create's 12-character floor because
// it guards a local database holding demo data. Three refusals keep it
// there: a Neon URL, a Vercel environment, or NODE_ENV=production each abort
// before touching anything — same guardrail idiom as import:promote. The
// panel behind this login shows customer names, phones and document IDs in
// any real deployment; that is why the floor exists in create-user.ts, and
// why this script must never learn to skip its guards.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";
import { upsertCredentialAccount } from "./upsert-account";

const DEV_EMAIL = "admin@secreto.local";
const DEV_PASSWORD = "Admin123";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — start the local Postgres first (docs/POSTGRES-DOCKER.md).",
    );
  }
  if (url.includes("neon.tech")) {
    throw new Error(
      "Refusing: DATABASE_URL points at Neon. The dev account exists for the " +
        "LOCAL database only — real accounts go through `npm run admin:create` " +
        "with a real password.",
    );
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing: this looks like a deployed environment, and Admin123 must " +
        "never guard one.",
    );
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const outcome = await upsertCredentialAccount(db, {
      email: DEV_EMAIL,
      name: "Admin (desarrollo)",
      password: DEV_PASSWORD,
    });
    console.log(
      `${outcome === "created" ? "Cuenta creada" : "Contraseña restablecida"}: ${DEV_EMAIL} / ${DEV_PASSWORD}`,
    );
    console.log("Entra por /admin/login. Solo existe en tu Postgres local.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
