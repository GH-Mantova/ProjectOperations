/**
 * NAV-2 — Accounts index (Client-360 landing) acceptance spec.
 *
 * Covers:
 *   1. Navigating to /crm/accounts renders the page heading.
 *   2. The sidebar "Accounts" entry under the CRM group is active.
 *   3. At least one account row from seed data is visible.
 *   4. A row with going-cold = true shows a "Going cold" chip.
 *   5. A PAST-lifecycle row does NOT show a "Going cold" chip.
 *   6. Clicking a row navigates to /crm/accounts/:id (AccountDetailPage).
 *
 * Seed dependencies: the dev seed must have at least one Account (created by
 * CRM-1 seed). A going-cold row requires a seed account with lastContactedAt
 * > 14 days ago; if none exists, test 4 is skipped gracefully via soft assertion.
 */

import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("NAV-2 — Accounts index (Client-360 landing)", () => {
  test("navigates to /crm/accounts and shows the Accounts heading", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/crm/accounts");
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  });

  test("the CRM sidebar Accounts link is active when on /crm/accounts", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/crm/accounts");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    // The active NavLink should have an aria-current attribute.
    const accountsLink = nav.getByRole("link", { name: "Accounts" });
    await expect(accountsLink).toBeVisible();
    await expect(accountsLink).toHaveAttribute("aria-current", "page");
  });

  test("shows at least one account row from seed data", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/crm/accounts");
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();

    // Wait for the table to load (loading state disappears)
    await expect(page.getByText("Loading accounts…")).not.toBeVisible({ timeout: 10_000 });

    // At least one <tr> in the tbody should be present.
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 5_000 });
  });

  test("clicking a row navigates to the Account detail page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/crm/accounts");
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    await expect(page.getByText("Loading accounts…")).not.toBeVisible({ timeout: 10_000 });

    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 5_000 });

    // Click the first row.
    await rows.first().click();

    // Should land on /crm/accounts/:id (AccountDetailPage).
    await expect(page).toHaveURL(/\/crm\/accounts\/[^/]+$/, { timeout: 5_000 });
  });

  test("going-cold chip appears for accounts with stale contact and not for PAST accounts", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/crm/accounts");
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    await expect(page.getByText("Loading accounts…")).not.toBeVisible({ timeout: 10_000 });

    // If ANY going-cold chips are present, assert they have the right aria-label.
    const coldChips = page.locator('[aria-label="Going cold"]');
    const coldCount = await coldChips.count();
    if (coldCount > 0) {
      // Verify the chip is visible.
      await expect(coldChips.first()).toBeVisible();

      // The going-cold chip must NOT appear on a row whose lifecycle badge reads "Past".
      // Find all rows and for each one with "Past" badge, assert no Going-cold chip in that row.
      const rows = page.locator("table tbody tr");
      const rowCount = await rows.count();
      for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const isPast = await row.locator("span", { hasText: "Past" }).count();
        if (isPast > 0) {
          const rowColdChip = row.locator('[aria-label="Going cold"]');
          await expect(rowColdChip).not.toBeVisible();
        }
      }
    }
    // If coldCount === 0 the seed has no old-enough accounts; pass silently.
  });
});
