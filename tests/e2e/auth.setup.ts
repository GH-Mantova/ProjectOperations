import { expect, test as setup, type APIRequestContext } from "@playwright/test";

import { ADMIN, FIELD_WORKER, VIEWER, SCOPED_ADMIN, loginViaForm } from "./pr-acceptance/helpers";
import { API_BASE } from "./pr-acceptance/api-helpers";
import {
  ADMIN_STORAGE_STATE,
  FIELD_WORKER_STORAGE_STATE,
  VIEWER_STORAGE_STATE,
  SCOPED_ADMIN_STORAGE_STATE
} from "./storage-state";
import {
  accessTokenFromStorageState,
  clearSharedApiTokens,
  tokenIsFresh,
  writeSharedApiTokens,
  type ApiTokenBundle
} from "./api-tokens";

// Logs in once per seeded persona and saves the resulting localStorage-backed
// session as Playwright storageState. Test projects reuse these states instead
// of re-hitting /auth/login per test, which trips the per-IP auth rate limit
// (5 logins / 60s) and poisons whole runs with "Too many requests".
//
// The last step publishes the API access tokens those logins already produced
// to playwright/.auth/api-tokens.json, so the pr-acceptance API fixtures do
// not have to log in AGAIN — once per worker process — to get one. See
// tests/e2e/api-tokens.ts for the full rationale.

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

// SLICE 17: scoped admin — users.view only, no roles.view.
setup("authenticate scoped admin", async ({ page }) => {
  await loginViaForm(page, SCOPED_ADMIN.email, SCOPED_ADMIN.password);
  await page.context().storageState({ path: SCOPED_ADMIN_STORAGE_STATE });
});

/**
 * Prefers the token the persona's form login already minted (it is sitting in
 * that persona's storageState) and only spends a /auth/login when there is no
 * usable one — i.e. when this step somehow ran before the login above, or the
 * web app stopped persisting its token where we look for it.
 */
async function mintOrHarvestToken(
  request: APIRequestContext,
  persona: { email: string; password: string },
  statePath: string
): Promise<string> {
  const harvested = accessTokenFromStorageState(statePath);
  if (tokenIsFresh(harvested, persona.email)) {
    return harvested;
  }
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: persona.email, password: persona.password }
  });
  expect(res.ok(), `POST /auth/login (${persona.email}) → ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}

// Publishes ONE token per persona for the whole run. Declared last so the four
// logins above have already written their storageState — but it does not rely
// on that: if a state file is missing or stale it mints instead, so this step
// is correct in any order, it is just cheaper in this one.
setup("publish shared api tokens", async ({ request }) => {
  // Drop any bundle from a previous run first: if this step then fails, workers
  // find no file and log in themselves rather than trusting stale tokens.
  clearSharedApiTokens();

  const personas: Array<[{ email: string; password: string }, string]> = [
    [ADMIN, ADMIN_STORAGE_STATE],
    [FIELD_WORKER, FIELD_WORKER_STORAGE_STATE],
    [VIEWER, VIEWER_STORAGE_STATE],
    [SCOPED_ADMIN, SCOPED_ADMIN_STORAGE_STATE]
  ];

  const bundle: ApiTokenBundle = {};
  for (const [persona, statePath] of personas) {
    bundle[persona.email] = await mintOrHarvestToken(request, persona, statePath);
  }

  writeSharedApiTokens(bundle);
});
