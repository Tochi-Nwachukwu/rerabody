import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
const e2eDb = process.env.E2E_DATABASE_URL;
if (!e2eDb) throw new Error("E2E_DATABASE_URL must be set to run the Playwright suite.");

/** Environment for the app under test: its own database, emails to the local outbox. */
export const e2eEnv: Record<string, string> = {
  DATABASE_URL: e2eDb,
  DIRECT_URL: e2eDb,
  NEXT_PUBLIC_APP_URL: baseURL,
  EMAIL_TRANSPORT: "log",
  PAYMENT_PROVIDER: "fake",
  STORAGE_DRIVER: "local",
};

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Mobile first: the storefront is built at 375px wide.
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /smoke\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: e2eEnv,
  },
});
