import "dotenv/config";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Query modules mark themselves `server-only`, which throws outside the
      // react-server condition. Vitest is not a browser and not a Client
      // Component — it resolves to the package's own empty stub, the same one
      // Next hands a Server Component, so the guard keeps protecting the app
      // without making its modules untestable.
      "server-only": path.resolve(
        __dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Loads DATABASE_URL from .env so the fixtures ↔ Postgres parity suite can
    // run locally. Without it the suite skips itself — see parity.test.ts.
    // (Also imported above, so the config itself can see the variable.)
    setupFiles: ["dotenv/config"],
    // The database-backed suites (parity, stock, orders) share one Postgres
    // and parity asserts over the WHOLE catalog, so files must not interleave
    // writes. DB-less runs keep full parallelism.
    fileParallelism: !process.env.DATABASE_URL,
  },
});
