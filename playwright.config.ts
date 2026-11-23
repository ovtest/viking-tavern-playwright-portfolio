import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE } from "./src/constants";

// Settings come from .env (copy .env.example). Real environment variables win.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file: use environment variables / defaults
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./specs",
  // All tests share ONE Viking (VIKING_NAME), with one saga, one Loot Sack and one Coin Pouch.
  // Running them in parallel would make them change each other's night, so they run one by one.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  // The scenes animate (the keeper checks windows one by one); a little more time than the default.
  expect: { timeout: 7_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Enters the hall once and saves the session for the other tests.
    { name: "setup", testMatch: /auth\.setup\.ts/, testDir: "./src" },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
  ],
});
