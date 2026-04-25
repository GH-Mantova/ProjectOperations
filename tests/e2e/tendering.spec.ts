import { expect, test, type Page } from "@playwright/test";

const credentials = {
  email: "admin@projectops.local",
  password: "Password123!"
};
const apiBaseUrl = "http://127.0.0.1:3000/api/v1";

type TenderListItem = {
  id: string;
  tenderNumber: string;
  title: string;
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  // The Password <label> wraps both the input and a show-password toggle
  // button, so getByLabel('Password') resolves to two elements under strict
  // mode. Target the input by its unique placeholder instead.
  await page.getByPlaceholder("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
}

async function fetchAuthedJson<T>(page: Page, path: string): Promise<T> {
  const token = await page.evaluate(() => window.localStorage.getItem("project-ops.accessToken"));
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.request.get(`${apiBaseUrl}${path}`, { headers });
      if (!response.ok()) {
        throw new Error(`Request failed for ${path}: ${response.status()}`);
      }
      return (await response.json()) as T;
    } catch (err) {
      lastError = err as Error;
      if (attempt < 3) await page.waitForTimeout(500);
    }
  }
  throw lastError ?? new Error(`Request failed for ${path}`);
}

async function loadTenderList(page: Page) {
  await page.goto("/tenders");
  await page.waitForTimeout(500);
  const data = await fetchAuthedJson<{ items: TenderListItem[] }>(page, "/tenders?page=1&pageSize=100");
  return data.items;
}

test.describe("Tendering — redesigned register + pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("/tenders renders the redesigned register page", async ({ page }) => {
    await page.goto("/tenders");
    // Heading + view toggles + new-tender CTA are always rendered, regardless
    // of which view (Pipeline / Register) is currently active.
    await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Pipeline", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Register", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ New tender" })).toBeVisible();
  });

  test("Register view exposes stats bar + search + filter chips", async ({ page }) => {
    await page.goto("/tenders");
    await page.getByRole("tab", { name: "Register", exact: true }).click();
    // Stats bar — only mounted in Register view.
    await expect(page.getByText("Total", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Win rate", { exact: true })).toBeVisible();
    // Search + estimator filter + probability chips.
    await expect(page.getByPlaceholder("Search number, title, or client")).toBeVisible();
    // The estimator filter is a <select>; assert the option exists (it lives
    // in the DOM even when the dropdown is closed) rather than its visibility.
    await expect(page.locator("option", { hasText: "Any estimator" })).toHaveCount(1);
    for (const probability of ["Hot", "Warm", "Cold"]) {
      await expect(page.getByRole("button", { name: probability, exact: true })).toBeVisible();
    }
    // Advanced filters toggle exposes additional fields.
    await page.getByRole("button", { name: "More filters", exact: true }).click();
    await expect(page.getByText("Min $", { exact: true })).toBeVisible();
  });

  test("Pipeline view shows the IS kanban stage columns", async ({ page }) => {
    await page.goto("/tenders");
    await page.getByRole("tab", { name: "Pipeline", exact: true }).click();
    // Each IS pipeline stage label appears at least once on the board.
    for (const stage of ["Draft", "Estimating", "Submitted", "Awarded", "Contract", "Lost", "Withdrawn"]) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();
    }
  });

  test("Tender detail page exposes Overview, Scope of Works, Quote tabs", async ({ page }) => {
    const tenders = await loadTenderList(page);
    expect(tenders.length).toBeGreaterThan(0);
    const tender = tenders[0];
    await page.goto(`/tenders/${tender.id}`);
    for (const tab of ["Overview", "Scope of Works", "Quote"]) {
      await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
    }
    // No 403 banner from any of the per-tab fetches.
    const forbidden = await page
      .locator("text=/Forbidden|403|Missing required permission/i")
      .first()
      .isVisible()
      .catch(() => false);
    expect(forbidden).toBe(false);
  });

  test("legacy /tenders/create + /tenders/workspace return 200 and don't 404", async ({ page }) => {
    // The Codex-era pipeline / workspace / create pages were retired in PR #78.
    // /tenders/create + /tenders/workspace now redirect to the redesigned
    // register; this test guards against a regression where the redirect
    // breaks (e.g. a 404 page or a stuck spinner).
    await page.goto("/tenders/workspace");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();

    await page.goto("/tenders/create");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
  });
});
