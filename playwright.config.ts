import { defineConfig } from "@playwright/test";

// E2E over the real storefront: `npx playwright test` boots the dev server
// itself (or reuses one already listening on the port). Run with DATABASE_URL
// set — the purchase flow writes a real Order; the fixtures-only preview
// rejects checkout by design. CHROMIUM_PATH overrides the browser binary for
// environments with a system Chromium instead of a Playwright download.
//
// E2E_PORT moves the run off 3000. Worth knowing why that matters: the reuse
// below is by port alone, so if anything else already listens on 3000 —
// another container, an unrelated app — Playwright adopts it as the
// storefront and every assertion fails against a service that was never this
// project. `E2E_PORT=3100 npx playwright test` sidesteps it.
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  use: {
    baseURL: BASE_URL,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    // A cold Turbopack start measured 3 minutes on a Windows dev machine, so
    // the old 120s budget failed before the storefront ever answered.
    timeout: 300_000,
  },
});
