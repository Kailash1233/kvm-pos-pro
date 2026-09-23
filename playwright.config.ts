import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests drive the real production build (the same server the
 * Electron app runs), not the dev server - the build itself is part of
 * what's being verified. Run `npm run build:desktop` first, or just
 * `npm run test:e2e`, which starts it automatically via webServer below.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8099",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },
  webServer: {
    command: "node .output/server/index.mjs",
    url: "http://127.0.0.1:8099",
    reuseExistingServer: true,
    env: { HOST: "127.0.0.1", PORT: "8099", NODE_ENV: "production" },
    timeout: 30_000,
  },
});
