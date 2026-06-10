import type { Page } from "@playwright/test";

export const ADMIN = {
  email: "admin@projectops.local",
  password: "Password123!"
};

export const VIEWER = {
  email: "viewer@projectops.local",
  password: "Password123!"
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

export async function loginAsViewer(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(VIEWER.email);
  await page.getByPlaceholder("Password").fill(VIEWER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Viewer lands on the same Operations dashboard.
  await page.getByRole("heading", { name: "Operations Overview" }).waitFor({ state: "visible" });
}
