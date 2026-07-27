import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Loads DATABASE_URL from .env so the fixtures ↔ Postgres parity suite can
    // run locally. Without it the suite skips itself — see parity.test.ts.
    setupFiles: ["dotenv/config"],
  },
});
