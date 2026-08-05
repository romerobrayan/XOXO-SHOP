import { defineConfig } from "@playwright/test";

// E2E over the real storefront: `npx playwright test` boots the dev server
// itself (or reuses one already listening on :3000). Run with DATABASE_URL
// set — the purchase flow writes a real Order; the fixtures-only preview
// rejects checkout by design. CHROMIUM_PATH overrides the browser binary for
// environments with a system Chromium instead of a Playwright download.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
