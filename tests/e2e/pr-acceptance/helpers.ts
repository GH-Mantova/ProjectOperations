import { existsSync, readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  FIELD_WORKER_STORAGE_STATE,
  VIEWER_STORAGE_STATE
} from "../storage-state";

export const ADMIN = {
  email: "admin@projectops.local",
  password: "Password123!"
};

export const VIEWER = {
  email: "viewer@projectops.local",
  password: "Password123!"
};

/**
 * Seeded Initial Services staff login with id `user-admin`, linked to
 * WorkerProfile `wp-user-admin` (Sean Lattin) — the only seeded login that can
 * use the /field worker surface. ADMIN above has NO worker profile, so it
 * naturally receives the "Mobile access not provisioned" 403 state on /field.
 */
export const FIELD_WORKER = {
  email: "sean@initialservices.net",
  password: "Password123!",
  workerName: "Sean Lattin"
};

/** Seeded tender used across batch specs. */
export const SEED_TENDER_NUMBER = "T260520-ACME-Rev1";

/** Seeded client ID. */
export const SEED_CLIENT_ID = "client-001";

/** Real form login — reserved for auth.setup.ts and specs that test the login flow itself. */
export async function loginViaForm(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Operations Overview" }).waitFor({ state: "visible" });
}

// Injects a session saved by auth.setup.ts instead of re-submitting the login
// form: repeated /auth/login calls trip the per-IP auth rate limit (5/60s)
// and fail every later spec in the run with "Too many requests". Falls back
// to a form login when the state file is missing (standalone helper use).
async function loginWithStoredState(
  page: Page,
  statePath: string,
  fallback: { email: string; password: string }
): Promise<void> {
  if (!existsSync(statePath)) {
    await loginViaForm(page, fallback.email, fallback.password);
    return;
  }
  const state = JSON.parse(readFileSync(statePath, "utf8")) as {
    origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
  };
  const entries = (state.origins ?? []).flatMap((origin) => origin.localStorage ?? []);
  // Reach the app origin first so localStorage is writable; if another session
  // is already stored, /login harmlessly redirects to / on the same origin.
  await page.goto("/login");
  await page.evaluate((items) => {
    window.localStorage.clear();
    for (const { name, value } of items) {
      window.localStorage.setItem(name, value);
    }
  }, entries);
  await page.goto("/");
  await page.getByRole("heading", { name: "Operations Overview" }).waitFor({ state: "visible" });
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithStoredState(page, ADMIN_STORAGE_STATE, ADMIN);
}

// Sean carries the Admin role, so he lands on the same Operations dashboard.
export async function loginAsFieldWorker(page: Page): Promise<void> {
  await loginWithStoredState(page, FIELD_WORKER_STORAGE_STATE, FIELD_WORKER);
}

// Viewer lands on the same Operations dashboard.
export async function loginAsViewer(page: Page): Promise<void> {
  await loginWithStoredState(page, VIEWER_STORAGE_STATE, VIEWER);
}
