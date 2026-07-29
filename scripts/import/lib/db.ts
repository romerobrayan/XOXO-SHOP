// Prisma client for the import scripts, plus the database guardrail: the
// import runs against the LOCAL throwaway database. Neon — the database with
// the real deployment behind it — only with an explicit --neon, only once the
// client has approved the staging. Mirrors the SEED_ALLOW_ORDER_WIPE spirit:
// destructive-adjacent tooling never points at shared data by accident.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/** Matches docker-compose.yml — deliberately literal dev credentials. */
const LOCAL_DEFAULT =
  "postgresql://secreto:secreto@localhost:5432/secreto_dev?schema=public";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable)";
  }
}

export function resolveDatabaseUrl(useNeon: boolean): {
  url: string;
  host: string;
} {
  if (useNeon) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("--neon requires DATABASE_URL in .env (the Neon line).");
    }
    return { url, host: hostOf(url) };
  }
  // Local by default. IMPORT_DATABASE_URL exists for a non-default local
  // setup (e.g. port 5433) — never for pointing at Neon quietly.
  const url = process.env.IMPORT_DATABASE_URL ?? LOCAL_DEFAULT;
  const host = hostOf(url);
  if (/neon\.tech/i.test(host)) {
    throw new Error(
      "Refusing to write to Neon without --neon. The import always runs against the local " +
        "Docker database first; promote to Neon only after the client approves the staging " +
        "(docs/IMPORT-PROVEEDORES.md).",
    );
  }
  return { url, host };
}

export function createImportDb(url: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}
