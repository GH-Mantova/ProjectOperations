import { defineConfig, devices } from "@playwright/test";

import { ADMIN_STORAGE_STATE } from "./tests/e2e/storage-state";

const apiPort = 3000;
const webPort = 4173;
const isWindows = process.platform === "win32";
const apiWebServerCommand = isWindows
  ? "pnpm dev:api:e2e"
  : `CORS_ORIGIN=http://127.0.0.1:${webPort} pnpm --filter @project-ops/api exec node dist/src/main.js`;
const webWebServerCommand = isWindows
  ? "pnpm dev:web:e2e"
  : `VITE_API_BASE_URL=http://127.0.0.1:${apiPort}/api/v1 pnpm --filter @project-ops/web dev:e2e`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    // Logs in once per seeded persona and saves storageState — see
    // tests/e2e/auth.setup.ts. Keeps per-test logins off the auth rate limit.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      // The webServer `url` check only proves the dev server has BOUND the port - it answers
      // `/` from memory long before it has transformed the module graph. The FIRST real
      // navigation therefore pays the whole cold-compile cost and blew the global 60s budget,
      // while the 2nd and 3rd logins - same URL, same helper - completed in ~25s each off the
      // warm cache. Because every browser project `dependencies: ["setup"]`, that one timeout
      // took all 139 acceptance tests down with it and the run read as a red BRANCH when
      // nothing about the branch had been exercised. Give the cold path its own budget.
      timeout: 180_000
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: ADMIN_STORAGE_STATE
      }
    },
    {
      name: "firefox",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Firefox"],
        storageState: ADMIN_STORAGE_STATE
      }
    },
    {
      name: "webkit",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Safari"],
        storageState: ADMIN_STORAGE_STATE
      }
    }
  ],
  webServer: [
    {
      command: apiWebServerCommand,
      url: `http://127.0.0.1:${apiPort}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: webWebServerCommand,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
