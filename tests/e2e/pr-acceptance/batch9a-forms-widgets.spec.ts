/**
 * Batch 9a — testid-enabled conversions (PRs #32, #33, #43 + batch 1/3/7 follow-ups)
 *
 * This batch consumes the data-testids added by commit 1 of the same PR
 * (widget cards, widget-settings inputs, customise rows, FormFillPage fields).
 * Per the batch 9a prompt, getByTestId is permitted here ONLY for those
 * elements; everything else stays on the approved role/label selectors.
 *
 * Triage table (formerly "needs testid, production change out of scope")
 * ─────────────────────────────────────────────────────────────────────────────
 * PR  | Item (truncated)                                    | Decision
 * ----|-----------------------------------------------------|-----------------
 * #43 | Set ten_active_pipeline_kpi aggregation to Max      | CONVERT → "active pipeline KPI aggregation"
 * #33 | ⚙ on Pipeline-by-estimator → uncheck                | CONVERT → "pipeline-by-estimator filter"
 * #33 | ⚙ on Win-rate chart → period changes title          | CONVERT → "win-rate chart period title"
 * #33 | ⚙ on Follow-up queue → set thresholds               | still-SKIP — PRODUCT BUG: Apply on widgets
 *     |                                                     | with both configSchema and fieldSchema drops
 *     |                                                     | the filter changes (stale-closure last-writer-
 *     |                                                     | wins in DashboardCanvas onApplyFilters/
 *     |                                                     | onApplyFields); found by this batch's first
 *     |                                                     | run; see docs/pr-prompts/needs-marco/
 *     |                                                     | pr-batch9a-widget-settings-stale-closure.md.
 *     |                                                     | Column-toggle half CONVERTed →
 *     |                                                     | "follow-up queue column toggle"
 * #33 | ⚙ on Recent wins → 30 days / maxRows trim           | still-SKIP — same stale-closure bug (Recent
 *     |                                                     | wins also carries fieldSchema). Column-toggle
 *     |                                                     | half CONVERTed → "recent wins column toggle"
 * #32 | Widget row: click period pill → Last 12 months      | CONVERT → "customise period pill"
 * #7b | FormFillPage wizard inputs (batch 7 follow-up)      | still-SKIP — page crashes before any
 *     |                                                     | field renders: GET /forms/submissions/:id
 *     |                                                     | omits templateVersion.sections (API bug,
 *     |                                                     | forms.service.ts submissionInclude); see
 *     |                                                     | docs/pr-prompts/needs-marco/
 *     |                                                     | pr-batch9a-formfill-sections-crash.md.
 *     |                                                     | Testids are in place for the fix PR.
 * #7b | Signature canvas (batch 7 follow-up)                | still-SKIP — same crash blocks the page.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * State discipline: widget-settings changes persist (PATCH /user-dashboards on
 * the admin's system tendering dashboard), so every test reverts to the
 * registry defaults (or a behaviourally-identical explicit value, noted inline)
 * before finishing. The customise-panel test discards its draft (no Save).
 */

import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

async function openTenderDashboard(page: Page): Promise<void> {
  await loginAsAdmin(page);
  await page.goto("/tenders/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Customise" })).toBeVisible();
}

function widgetCard(page: Page, type: string): Locator {
  return page.getByTestId(`widget-${type}`);
}

async function openSettings(page: Page, widget: Locator): Promise<Locator> {
  await widget.getByRole("button", { name: "Widget settings" }).click();
  const popover = page.getByRole("dialog", { name: "Widget settings" });
  await expect(popover).toBeVisible();
  return popover;
}

/** Click Apply and wait for the debounced dashboard PATCH to land. */
async function applyAndSave(page: Page, popover: Locator): Promise<void> {
  const saved = page.waitForResponse(
    (r) => r.url().includes("/user-dashboards") && r.request().method() === "PATCH" && r.ok()
  );
  await popover.getByRole("button", { name: "Apply" }).click();
  await saved;
}

test.describe("Batch 9a — testid-enabled widget settings & period pills (PRs #32, #33, #43)", () => {
  test("active pipeline KPI: ⚙ aggregation set to Max relabels the KPI and persists (PR #43)", async ({
    page
  }) => {
    await openTenderDashboard(page);
    const widget = widgetCard(page, "ten-active-pipeline-kpi");
    await expect(widget).toBeVisible();

    let popover = await openSettings(page, widget);
    await popover.getByTestId("widget-setting-aggregation").selectOption("Max");
    await applyAndSave(page, popover);

    // labelForAggregation renders "<currency> max" for the Max op.
    await expect(widget.getByText(/ max$/)).toBeVisible();

    // Persisted: reopening the popover shows Max selected.
    popover = await openSettings(page, widget);
    await expect(popover.getByTestId("widget-setting-aggregation")).toHaveValue("Max");

    // Revert to the registry default (Sum).
    await popover.getByTestId("widget-setting-aggregation").selectOption("Sum");
    await applyAndSave(page, popover);
    await expect(widget.getByText(/ max$/)).toHaveCount(0);
  });

  test("win-rate chart: ⚙ period drives the card title (PR #33)", async ({ page }) => {
    await openTenderDashboard(page);
    const widget = widgetCard(page, "ten-win-rate-chart");
    await expect(widget.getByText("Win rate — last 6 months")).toBeVisible();

    let popover = await openSettings(page, widget);
    await popover.getByTestId("widget-setting-period").selectOption("12m");
    await applyAndSave(page, popover);
    await expect(widget.getByText("Win rate — last 12 months")).toBeVisible();

    // Revert: explicit "6m" is behaviourally identical to the unset default.
    popover = await openSettings(page, widget);
    await popover.getByTestId("widget-setting-period").selectOption("6m");
    await applyAndSave(page, popover);
    await expect(widget.getByText("Win rate — last 6 months")).toBeVisible();
  });

  // NOTE: the thresholds half of PR #33's follow-up-queue item is still-SKIP —
  // Apply drops filter changes on widgets that also carry a fieldSchema (see
  // the triage table / needs-marco escalation). Column toggles DO persist.
  test("follow-up queue: ⚙ estimator column toggle persists (PRs #33, #43)", async ({ page }) => {
    await openTenderDashboard(page);
    const widget = widgetCard(page, "ten-follow-up-queue");
    await expect(widget).toBeVisible();

    let popover = await openSettings(page, widget);
    // The thresholds inputs are at least reachable and editable in the draft.
    await popover.getByTestId("widget-setting-days-threshold").fill("1");
    await expect(popover.getByTestId("widget-setting-days-threshold")).toHaveValue("1");

    // Estimator column defaults to hidden — switch it on. Self-heal first in
    // case a previously failed run left it visible.
    const estimatorToggle = popover.getByTestId("widget-field-toggle-estimator");
    if ((await estimatorToggle.getAttribute("aria-checked")) === "true") {
      await estimatorToggle.click();
    }
    await expect(estimatorToggle).toHaveAttribute("aria-checked", "false");
    await estimatorToggle.click();
    await applyAndSave(page, popover);

    // Persisted: reopening shows the toggled column.
    popover = await openSettings(page, widget);
    await expect(popover.getByTestId("widget-field-toggle-estimator")).toHaveAttribute(
      "aria-checked",
      "true"
    );

    // Revert to the registry default (estimator hidden).
    await popover.getByTestId("widget-field-toggle-estimator").click();
    await applyAndSave(page, popover);
  });

  test("pipeline-by-estimator: ⚙ estimator filter checks persist and uncheck cleanly (PR #33)", async ({
    page
  }) => {
    await openTenderDashboard(page);
    const widget = widgetCard(page, "ten-pipeline-by-estimator");
    await expect(widget).toBeVisible();

    let popover = await openSettings(page, widget);
    // Estimator options are derived from seeded tenders, so at least one exists.
    // Self-heal in case a previously failed run left the filter selected.
    const firstEstimator = popover.getByRole("checkbox").first();
    await expect(firstEstimator).toBeVisible();
    if (await firstEstimator.isChecked()) {
      await firstEstimator.uncheck();
    }
    await firstEstimator.check();
    await applyAndSave(page, popover);

    // Persisted: reopening shows the estimator still selected.
    popover = await openSettings(page, widget);
    await expect(popover.getByRole("checkbox").first()).toBeChecked();

    // Uncheck (the original PR #33 step) and save — back to "all estimators".
    await popover.getByRole("checkbox").first().uncheck();
    await applyAndSave(page, popover);

    popover = await openSettings(page, widget);
    await expect(popover.getByRole("checkbox").first()).not.toBeChecked();
  });

  // NOTE: the "30 days / maxRows trim" half of PR #33's recent-wins item is
  // still-SKIP — same stale-closure Apply bug (Recent wins carries a
  // fieldSchema too). Column toggles DO persist.
  test("recent wins: ⚙ tender-number column toggle persists (PR #33)", async ({ page }) => {
    await openTenderDashboard(page);
    const widget = widgetCard(page, "ten-recent-wins");
    await expect(widget).toBeVisible();

    let popover = await openSettings(page, widget);
    // Period / max-rows inputs are reachable and editable in the draft.
    await popover.getByTestId("widget-setting-period").selectOption("30d");
    await popover.getByTestId("widget-setting-max-rows").fill("1");
    await expect(popover.getByTestId("widget-setting-max-rows")).toHaveValue("1");

    // Tender # column defaults to hidden — switch it on. Self-heal first in
    // case a previously failed run left it visible.
    const tenderNumberToggle = popover.getByTestId("widget-field-toggle-tender-number");
    if ((await tenderNumberToggle.getAttribute("aria-checked")) === "true") {
      await tenderNumberToggle.click();
    }
    await expect(tenderNumberToggle).toHaveAttribute("aria-checked", "false");
    await tenderNumberToggle.click();
    await applyAndSave(page, popover);

    // Persisted: reopening shows the toggled column.
    popover = await openSettings(page, widget);
    await expect(popover.getByTestId("widget-field-toggle-tender-number")).toHaveAttribute(
      "aria-checked",
      "true"
    );

    // Revert to the registry default (tender # hidden).
    await popover.getByTestId("widget-field-toggle-tender-number").click();
    await applyAndSave(page, popover);
  });

  test("customise panel: widget-row period pill picks Last 12 months, draft discarded on close (PR #32)", async ({
    page
  }) => {
    await openTenderDashboard(page);
    await page.getByRole("button", { name: "Customise" }).click();
    const panel = page.getByRole("dialog", { name: "Customise dashboard" });
    await expect(panel).toBeVisible();

    const row = panel.getByTestId("customise-row-ten-recent-wins");
    const pill = row.getByRole("button", { name: /^Period:/ });
    const initialPill = (await pill.textContent())!.trim();

    await pill.click();
    await row.getByRole("menuitem", { name: "Last 12 months" }).click();
    await expect(pill).toHaveText(/Period: 12m/);

    // Pick "Use global" — the pill returns to the dashboard-inherited period.
    await pill.click();
    await row.getByRole("menuitem", { name: /^Use global/ }).click();
    await expect(pill).toHaveText(initialPill);

    // Close WITHOUT saving — the panel draft is discarded, nothing persists.
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).not.toBeVisible();
  });
});
