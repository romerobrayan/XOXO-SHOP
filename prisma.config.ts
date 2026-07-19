import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 config: the connection URL lives here (for the CLI — migrate,
// studio, seed) and in src/lib/db.ts via the pg driver adapter (for runtime).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
