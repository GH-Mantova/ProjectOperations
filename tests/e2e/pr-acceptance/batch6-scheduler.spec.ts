/**
 * Batch 6 — Scheduler workspace (PR #18)
 *
 * Triage (full table in the PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR   | Item (truncated)                                    | Decision
 * -----|-----------------------------------------------------|-----------------
 * #18  | /scheduler manual pass: week/month toggle,          | CONVERT → the three tests below.
 *      | prev/next/Today, shift slide-over, assign + remove  | Worker-availability "overlay" does not
 *      | worker and asset, worker highlight in right rail,   | exist as a toggle — availability renders
 *      | collapse resource panel                             | as an aria-hidden dot on rail cards, out
 *      |                                                     | of reach of the role/label/text selector
 *      |                                                     | rules → that slice SKIPPED (see PR
 *      |                                                     | follow-up); highlight + collapse covered.
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeded shifts live in April 2026 (fixed dates). The scheduler has no date
 * deep-link, so tests switch to Month view and click "Previous" until the
 * "April 2026" range label shows — robust regardless of today's date.
 * Assign/remove flows add and then remove the same worker/asset, restoring
 * the seeded state (no residue).
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const SEED_MONTH_LABEL = "April 2026";
const SEED_SHIFT = "Induction and permit review";

async function goToSeedMonth(page: Page): Promise<void> {
  await page.goto("/scheduler");
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  for (let i = 0; i < 36; i += 1) {
    if (await page.getByText(SEED_MONTH_LABEL, { exact: true }).isVisible()) return;
    await page.getByRole("button", { name: "Previous" }).click();
  }
  await expect(page.getByText(SEED_MONTH_LABEL, { exact: true })).toBeVisible();
}

test.describe("Batch 6 — Scheduler workspace (PR #18)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("week/month toggle, prev/next/Today nav, seeded April shifts, conflict badges", async ({
    page
  }) => {
    await page.goto("/scheduler");

    // Week view is the default; the job rail lists seeded jobs.
    await expect(page.getByRole("tab", { name: "Week", exact: true })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("All jobs", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /J260315-QUEE-001/ })).toBeVisible();

    // Prev / Today round-trip in week view.
    const weekLabel = async () => (await page.getByText(/–.*\d{4}/).first().textContent()) ?? "";
    const startLabel = await weekLabel();
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByText(/–.*\d{4}/).first()).not.toHaveText(startLabel);
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(page.getByText(/–.*\d{4}/).first()).toHaveText(startLabel);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/–.*\d{4}/).first()).not.toHaveText(startLabel);

    // Month view reaches the seeded April 2026 shifts.
    await goToSeedMonth(page);
    await expect(page.getByRole("button", { name: new RegExp(SEED_SHIFT) })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sandgate — Pipe replacement day shift/ }).first()
    ).toBeVisible();

    // The deliberately overlapping seed shift carries conflict markers.
    await page.getByRole("button", { name: /Temporary services install/ }).click();
    const slideOver = page.getByRole("dialog", { name: "Shift detail" });
    await expect(slideOver.getByRole("heading", { name: "Conflicts" })).toBeVisible();
    await expect(
      slideOver.getByText("Mia Turner is already allocated on an overlapping shift.")
    ).toBeVisible();
    await slideOver.getByRole("button", { name: "Close" }).click();
    await expect(slideOver).toBeHidden();
  });

  test("shift slide-over — assign and remove a worker and an asset (state restored)", async ({
    page
  }) => {
    await goToSeedMonth(page);
    await page.getByRole("button", { name: new RegExp(SEED_SHIFT) }).click();

    const slideOver = page.getByRole("dialog", { name: "Shift detail" });
    // Assignment rows = list items with a Remove button; conflict list items
    // mention the same worker/asset names but carry no buttons.
    const assignmentRow = (name: string) =>
      slideOver
        .getByRole("listitem")
        .filter({ hasText: name })
        .filter({ has: page.getByRole("button", { name: "Remove" }) });

    // The slide-over renders the assignment counts from the parent's already-
    // loaded shift list — but on slower runs the parent state can finish
    // hydrating after the dialog mounts. Give the seeded "Workers (N)" /
    // "Assets (N)" headings an explicit bounded timeout instead of the
    // default, and only after the dialog itself is on screen.
    const ASGN_TIMEOUT = 20_000;
    const SHIFT_MUTATION = (r: import("@playwright/test").Response) =>
      /\/scheduler\/shifts\/[^/]+\/(workers|assets)/.test(r.url()) &&
      ["POST", "DELETE"].includes(r.request().method());

    await expect(slideOver).toBeVisible({ timeout: ASGN_TIMEOUT });
    await expect(slideOver.getByRole("heading", { name: SEED_SHIFT })).toBeVisible({
      timeout: ASGN_TIMEOUT
    });

    // Residue-tolerant baseline: a previous aborted run may have left an
    // extra Jack Sorensen / Toyota HiLux assignment on this seeded shift
    // (LL-30 — the shift is seeded but ad-hoc assignments made during the
    // test are not wiped by re-seed). Proactively remove them if present
    // before we lock in the baseline count. The assertion still fails on a
    // real regression because we verify Mia Turner and Excavator 1 (seed)
    // remain, and that the counts return to baseline after add/remove.
    const removeIfPresent = async (name: string) => {
      const row = assignmentRow(name);
      if ((await row.count()) > 0) {
        const resp = page.waitForResponse(SHIFT_MUTATION, { timeout: ASGN_TIMEOUT });
        await row.getByRole("button", { name: "Remove" }).click();
        await resp;
        await expect(row).toHaveCount(0, { timeout: ASGN_TIMEOUT });
      }
    };
    await removeIfPresent("Jack Sorensen");
    await removeIfPresent("Toyota HiLux ute — MCV 123");

    // Baseline: the seed guarantees Mia Turner + Excavator 1. Read the
    // current counts (after residue cleanup) instead of hard-coding "1" so
    // the test tolerates any additional seed-only rows a future seed adds.
    await expect(assignmentRow("Mia Turner")).toHaveCount(1, { timeout: ASGN_TIMEOUT });
    await expect(assignmentRow("Excavator 1")).toHaveCount(1, { timeout: ASGN_TIMEOUT });
    const readCount = async (kind: "Workers" | "Assets"): Promise<number> => {
      const heading = slideOver.getByRole("heading", { name: new RegExp(`^${kind} \\(\\d+\\)$`) });
      await expect(heading).toBeVisible({ timeout: ASGN_TIMEOUT });
      const text = (await heading.textContent()) ?? "";
      const match = text.match(/\((\d+)\)/);
      if (!match) throw new Error(`could not parse ${kind} count from "${text}"`);
      return Number(match[1]);
    };
    const baselineWorkers = await readCount("Workers");
    const baselineAssets = await readCount("Assets");

    // Assign a worker, then remove them again (restores seeded state). Wait
    // on the POST/DELETE response before reading the next heading count so
    // the test never reads stale state from the previous request's render.
    const workerSelect = slideOver.getByRole("combobox").filter({ hasText: "Assign worker…" });
    await workerSelect.selectOption({ label: "Jack Sorensen · Supervisor" });
    const addWorkerResp = page.waitForResponse(SHIFT_MUTATION, { timeout: ASGN_TIMEOUT });
    await slideOver.getByRole("button", { name: "Add", exact: true }).first().click();
    await addWorkerResp;
    await expect(
      slideOver.getByRole("heading", { name: `Workers (${baselineWorkers + 1})` })
    ).toBeVisible({ timeout: ASGN_TIMEOUT });
    await expect(assignmentRow("Jack Sorensen")).toHaveCount(1, { timeout: ASGN_TIMEOUT });
    const removeWorkerResp = page.waitForResponse(SHIFT_MUTATION, { timeout: ASGN_TIMEOUT });
    await assignmentRow("Jack Sorensen").getByRole("button", { name: "Remove" }).click();
    await removeWorkerResp;
    await expect(
      slideOver.getByRole("heading", { name: `Workers (${baselineWorkers})` })
    ).toBeVisible({ timeout: ASGN_TIMEOUT });
    await expect(assignmentRow("Jack Sorensen")).toHaveCount(0, { timeout: ASGN_TIMEOUT });

    // Assign an asset, then remove it again.
    const assetSelect = slideOver.getByRole("combobox").filter({ hasText: "Assign asset…" });
    await assetSelect.selectOption({ label: "Toyota HiLux ute — MCV 123 · IS-A009" });
    const addAssetResp = page.waitForResponse(SHIFT_MUTATION, { timeout: ASGN_TIMEOUT });
    await slideOver.getByRole("button", { name: "Add", exact: true }).last().click();
    await addAssetResp;
    await expect(
      slideOver.getByRole("heading", { name: `Assets (${baselineAssets + 1})` })
    ).toBeVisible({ timeout: ASGN_TIMEOUT });
    const removeAssetResp = page.waitForResponse(SHIFT_MUTATION, { timeout: ASGN_TIMEOUT });
    await assignmentRow("Toyota HiLux ute — MCV 123").getByRole("button", { name: "Remove" }).click();
    await removeAssetResp;
    await expect(
      slideOver.getByRole("heading", { name: `Assets (${baselineAssets})` })
    ).toBeVisible({ timeout: ASGN_TIMEOUT });

    // Seeded notes render.
    await expect(slideOver.getByText("Initial mobilisation shift")).toBeVisible();
  });

  test("resource rail — worker pick highlights only their shifts; assets tab; panel collapse", async ({
    page
  }) => {
    await goToSeedMonth(page);

    // Pick Mia Turner in the rail: her two seeded shifts highlight, others dim.
    await page.getByRole("button", { name: /Mia Turner/ }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(SEED_SHIFT) })
    ).toHaveClass(/sched-pill--highlight/);
    await expect(
      page.getByRole("button", { name: /Temporary services install/ })
    ).toHaveClass(/sched-pill--highlight/);
    await expect(
      page.getByRole("button", { name: /Sandgate — Pipe replacement day shift/ }).first()
    ).toHaveClass(/sched-pill--dim/);

    // Deselect → dimming clears.
    await page.getByRole("button", { name: /Mia Turner/ }).click();
    await expect(
      page.getByRole("button", { name: /Sandgate — Pipe replacement day shift/ }).first()
    ).not.toHaveClass(/sched-pill--dim/);

    // Assets tab lists seeded plant with status badges.
    await page.getByRole("tab", { name: "Assets", exact: true }).click();
    await expect(page.getByRole("button", { name: /CAT 320 Excavator/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /CAT 308 Mini Excavator/ })).toContainText(
      "MAINTENANCE"
    );

    // Collapse the resource panel, then restore it.
    await page.getByRole("button", { name: "Hide resources" }).click();
    await expect(page.getByRole("tab", { name: "Assets", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Show resources" }).click();
    await expect(page.getByRole("tab", { name: "Workers", exact: true })).toBeVisible();
  });
});
