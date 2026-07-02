import { test as setup } from "@playwright/test";

import { ADMIN, FIELD_WORKER, VIEWER, loginViaForm } from "./pr-acceptance/helpers";
import {
  ADMIN_STORAGE_STATE,
  FIELD_WORKER_STORAGE_STATE,
  VIEWER_STORAGE_STATE
} from "./storage-state";

// Logs in once per seeded persona and saves the resulting localStorage-backed
// session as Playwright storageState. Test projects reuse these states instead
// of re-hitting /auth/login per test, which trips the per-IP auth rate limit
// (5 logins / 60s) and poisons whole runs with "Too many requests".

setup("authenticate admin", async ({ page }) => {
  await loginViaForm(page, ADMIN.email, ADMIN.password);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});

setup("authenticate field worker", async ({ page }) => {
  await loginViaForm(page, FIELD_WORKER.email, FIELD_WORKER.password);
  await page.context().storageState({ path: FIELD_WORKER_STORAGE_STATE });
});

setup("authenticate viewer", async ({ page }) => {
  await loginViaForm(page, VIEWER.email, VIEWER.password);
  await page.context().storageState({ path: VIEWER_STORAGE_STATE });
});
