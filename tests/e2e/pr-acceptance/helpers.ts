import type { Page } from "@playwright/test";

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
export const SEED_TENDER_NUMBER = "IS-T100";

/** Seeded client ID. */
export const SEED_CLIENT_ID = "client-001";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByPlaceholder("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Operations Overview" }).waitFor({ state: "visible" });
}

export async function loginAsFieldWorker(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(FIELD_WORKER.email);
  await page.getByPlaceholder("Password").fill(FIELD_WORKER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Sean carries the Admin role, so he lands on the same Operations dashboard.
  await page.getByRole("heading", { name: "Operations Overview" }).waitFor({ state: "visible" });
}

export async function loginAsViewer(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(VIEWER.email);
  await page.getByPlaceholder("Password").fill(VIEWER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Viewer lands on the same Operations dashboard.
  await page.getByRole("heading", { name: "Operations Overview" }).waitFor({ state: "visible" });
}
