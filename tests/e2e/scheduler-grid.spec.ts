import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./pr-acceptance/helpers";

/**
 * PR-453 — Scheduler day-grid UI smoke. Read-only: verifies the page mounts,
 * the orientation + view toggles work, headers render the visible window, and
 * the grid table is present. Cell mutation flows are exercised indirectly via
 * the upstream PR-452 service tests; here we only assert the UI surface so
 * the spec stays stable across seed changes (seed currently has no
 * ScheduleAllocation rows, which is the realistic empty-state path).
 */

test.describe("Scheduler grid", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("renders grid with month view + orientation toggles", async ({ page }) => {
    await page.goto("/scheduler/grid");

    // Range label and grid table appear (proves data load + helpers ran).
    await expect(page.getByTestId("grid-range-label")).toBeVisible();
    await expect(page.getByTestId("scheduler-grid")).toBeVisible();

    // Switch to week view — range label re-renders.
    await page.getByRole("tab", { name: "Week" }).click();
    await expect(page.getByTestId("grid-range-label")).toContainText("–");

    // Back to month, switch orientation.
    await page.getByRole("tab", { name: "Month" }).click();
    await page.getByTestId("orient-by-resource").click();
    await expect(page.getByTestId("orient-by-resource")).toHaveAttribute("aria-selected", "true");
    await page.getByTestId("orient-by-job").click();
    await expect(page.getByTestId("orient-by-job")).toHaveAttribute("aria-selected", "true");
  });
});
