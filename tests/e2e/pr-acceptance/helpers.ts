import { existsSync, readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  FIELD_WORKER_STORAGE_STATE,
  VIEWER_STORAGE_STATE,
  SCOPED_ADMIN_STORAGE_STATE
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
 * SLICE 17: scoped admin (id `scoped-admin@projectops.local`).
 * Holds users.view + dashboards.view but NOT roles.view — used to assert
 * that /settings/administration/users is reachable while
 * /settings/administration/roles renders <NoAccess/>.
 */
export const SCOPED_ADMIN = {
  email: "scoped-admin@projectops.local",
  password: "Password123!"
};

/**
 * Synthetic e2e login (id `user-field-e2e`) attached to WorkerProfile
 * `wp-user-admin` (worker: Sean Lattin) — the only seeded login that can use
 * the /field worker surface. Real staff logins (including Sean's own) are
 * SSO-only with no usable local password; this dev-marker-domain account
 * exists purely for the acceptance suite. ADMIN above has NO worker profile,
 * so it naturally receives the "Mobile access not provisioned" 403 on /field.
 */
export const FIELD_WORKER = {
  email: "field.e2e@projectops.local",
  password: "E2eField2026!",
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
  await page.getByRole("heading", { name: "Home" }).waitFor({ state: "visible" });
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
  // WEBKIT_LOGIN_READY_PROBE_V1
  //
  // The original sequence was:
  //   goto("/login")  →  evaluate (seed localStorage)  →  goto("/")
  //
  // Under WebKit, goto("/login") follows the client-side redirect to "/" before
  // Playwright resolves the promise, so the page is already at "/" when evaluate
  // runs. The subsequent goto("/") is then a same-URL navigation that does NOT
  // remount React. AuthProvider has already captured its in-memory state from
  // readStoredState() at mount, so the localStorage seed is invisible to React,
  // and the app sits on the login screen waiting for auth that never arrives.
  //
  // Fix: use waitUntil:"commit" so goto("/login") resolves as soon as the HTTP
  // response headers are committed — before JavaScript runs and before any
  // client-side redirect fires. localStorage.setItem() at this point writes into
  // the /login document's origin storage BEFORE AuthProvider mounts, so the
  // subsequent goto("/") is a true cross-URL navigation that boots React fresh
  // and readStoredState() finds the correct tokens on first call.
  await page.goto("/login", { waitUntil: "commit" });
  await page.evaluate((items) => {
    window.localStorage.clear();
    for (const { name, value } of items) {
      window.localStorage.setItem(name, value);
    }
  }, entries);
  await page.goto("/");
  // Bounded timeout with a diagnostic message: a silent 60 s burn is not
  // acceptable in a shared helper. 20 s is generous for a warm dev server.
  const homeHeading = page.getByRole("heading", { name: "Home" });
  await homeHeading.waitFor({ state: "visible", timeout: 20_000 }).catch(async (err: unknown) => {
    const url = page.url();
    const headings = await page.getByRole("heading").allTextContents().catch(() => [] as string[]);
    throw new Error(
      `loginWithStoredState: "Home" heading not visible after 20 s.\n` +
        `  page.url()  = ${url}\n` +
        `  headings    = ${JSON.stringify(headings)}\n` +
        `  original    = ${String(err)}`
    );
  });
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

// SLICE 17: scoped admin — users.view only, no roles.view.
export async function loginAsScopedAdmin(page: Page): Promise<void> {
  await loginWithStoredState(page, SCOPED_ADMIN_STORAGE_STATE, SCOPED_ADMIN);
}
