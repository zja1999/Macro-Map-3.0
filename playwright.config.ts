import { defineConfig } from "@playwright/test";

// E2E on the critical flows (see docs/testing.md). Uses the installed Chrome
// (channel) — no browser download needed. PGlite allows ONE process on the data
// dir, so tests reuse a running dev server rather than spawning their own;
// start one with `npm run dev` first (or let webServer do it if none is up).
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  retries: 0,
  workers: 1, // serial: flows share the demo account's diary
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
