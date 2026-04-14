import { defineConfig, devices } from "@playwright/test";

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
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"]
      }
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"]
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
