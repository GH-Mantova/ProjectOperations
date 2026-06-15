/**
 * Batch 6 — Projects + Jobs delivery (PRs #17, #39, #40, #242, #250, #267, #339)
 *
 * Triage (full table in the PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR   | Item (truncated)                                    | Decision
 * -----|-----------------------------------------------------|-----------------
 * #339 | /jobs shows zero JOB- prefixed rows                 | CONVERT → "jobs register canonical ids"
 * #242 | AWARDED tender — Convert button hidden              | CONVERT → "convert button visibility"
 * #242 | CONTRACT_ISSUED — button visible, conversion works  | CONVERT (adapted) — button IS visible,
 *      |                                                     | but POST /tenders/:id/convert rejects
 *      |                                                     | every status except AWARDED, so the only
 *      |                                                     | status where the UI offers conversion is
 *      |                                                     | the only one the API refuses. Asserting
 *      |                                                     | actual behaviour (error alert). DRIFT →
 *      |                                                     | PR follow-up.
 * #250 | wrong project number → Revert stays disabled        | CONVERT → "revert gate"
 * #250 | correct number → project gone, tender CONTRACT_…    | CONVERT → "revert gate"
 * #39  | convert AWARDED → IS-P###, scope+docs carry, PM…    | CONVERT (adapted) — conversion executed
 *      |                                                     | through the API (UI path blocked by the
 *      |                                                     | #242 drift); UI asserts project number,
 *      |                                                     | frozen-scope banner, source-tender link.
 *      |                                                     | PM notification not asserted (no PM set
 *      |                                                     | on fixture tender).
 * #39  | re-convert → 409 with existing project link        | CONVERT (adapted) — API 409 body + UI
 *      |                                                     | button hidden at CONVERTED status.
 * #39  | status walk MOBILISING→…→CLOSED, dates enforced     | CONVERT → "status walk"
 * #40  | create worker via Add modal → appears in list       | CONVERT → "worker register lifecycle"
 * #40  | overlapping allocation → warning + allocate anyway  | CONVERT → "allocations" (UI rows in both
 *      |                                                     | projects stand in for "both rows in DB")
 * #40  | allocate asset → Plant & Equipment section          | CONVERT → "allocations"
 * #40  | deactivate worker → hidden from Active tab,         | CONVERT → "worker register lifecycle"
 *      |   allocations untouched                             |
 * #40  | internalUserId=null worker → no crash, allocation   | CONVERT → "worker register lifecycle"
 *      |   created                                           | (modal-created workers have no linked
 *      |                                                     | user, exactly this case)
 * #40  | Activity tab lists WORKER_ALLOCATED/ASSET_ALLOCATED | CONVERT → "allocations"
 * #17  | /jobs manual pass (cards/table, filters, create,    | CONVERT (partial) → register + detail
 *      |   detail 7 tabs, activity toggle, progress KPI)     | tests. Create-job-via-slide-over excluded:
 *      |                                                     | jobs expose no UI delete, residue would
 *      |                                                     | accumulate on every run.
 * #267 | Open the +Add entry modal on a real tender          | CONVERT (adapted) → "add entry modal".
 *      |                                                     | The literal messages "Tasks must be
 *      |                                                     | assigned to a user" / "This entry type
 *      |                                                     | needs a due date" are now unreachable —
 *      |                                                     | Save is disabled while invalid — so the
 *      |                                                     | test asserts the disabled-gate. Field
 *      |                                                     | visibility matrix COVERED by
 *      |                                                     | addEntryFieldVisibility.test.ts (22/22).
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixtures: no projects exist in seed (conversion is their only source), so
 * tests mint tender→project fixtures via the API (prefix E2E-B6) and destroy
 * them in finally blocks (revert-to-tender cascade + tender hard-delete).
 * Residue: one deactivated worker profile per run ("E2E B6W…") — workers have
 * no delete endpoint; they land on the Inactive tab only.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import {
  B6_PREFIX,
  allocateWorkerToProject,
  apiToken,
  createFixtureProject,
  createFixtureTender,
  destroyFixture,
  findTenderId,
  purgeB6Fixtures
} from "./api-helpers";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

test.describe("Batch 6 — Projects + Jobs (PRs #17, #39, #40, #242, #250, #267, #339)", () => {
  test.beforeAll(async ({ request }) => {
    // Clear fixtures orphaned by a previous crashed run.
    const token = await apiToken(request);
    await purgeB6Fixtures(request, token);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("jobs register shows only canonical J- ids; cards/table views and search filter (PRs #339, #17)", async ({
    page
  }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { name: "Delivery workspace" })).toBeVisible();

    // Cards view (default) renders canonical job numbers.
    await expect(page.getByText("J260315-QUEE-001", { exact: true })).toBeVisible();
    await expect(page.getByText("J260328-BRIS-001", { exact: true })).toBeVisible();
    // CP-21 UI twin: zero legacy JOB- prefixed ids anywhere on the register.
    await expect(page.getByText(/JOB-\d/)).toHaveCount(0);

    // Table view toggle.
    await page.getByRole("tab", { name: "Table", exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "Job #" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "J260315-QUEE-001", exact: true })).toBeVisible();
    await expect(page.getByText(/JOB-\d/)).toHaveCount(0);

    // Search filter narrows.
    await page.getByPlaceholder("Search by number, name, client, site").fill("Sandgate");
    await expect(page.getByRole("cell", { name: "J260328-BRIS-001", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "J260315-QUEE-001", exact: true })).toBeHidden();
  });

  test("job detail — 7 tabs, overview KPIs, activity completion toggle round-trip (PR #17)", async ({
    page
  }) => {
    await page.goto("/jobs");
    await page.getByText("Ipswich Motorway Stage 4 — Earthworks", { exact: true }).first().click();
    await expect(page.getByText("J260315-QUEE-001", { exact: true })).toBeVisible();

    for (const tab of [
      /^Overview$/,
      /^Stages & Activities \(\d+\)$/,
      /^Issues \(\d+\)$/,
      /^Variations \(\d+\)$/,
      /^Progress \(\d+\)$/,
      /^Documents$/,
      /^History \(\d+\)$/
    ]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }

    // Overview KPI strip.
    for (const label of ["Total activities", "Open issues", "Variations value", "Progress"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Toggle one activity's completion and cycle it back to its original
    // status (NOT_STARTED → IN_PROGRESS → COMPLETE → NOT_STARTED). The toggle
    // is optimistic but the test waits for each PATCH response to land before
    // reading the next aria-label snapshot — otherwise a fast second click can
    // race the first request's confirmation and the loop captures stale state.
    await page.getByRole("tab", { name: /^Stages & Activities/ }).click();
    let toggle = page.getByRole("button", { name: /^Toggle activity status/ }).first();
    if ((await toggle.count()) === 0 || !(await toggle.isVisible())) {
      await page.getByRole("button", { expanded: false }).first().click();
      toggle = page.getByRole("button", { name: /^Toggle activity status/ }).first();
    }
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await expect(toggle).toBeEnabled();
    const TOGGLE_TIMEOUT = 15_000;
    const isActivityPatch = (r: import("@playwright/test").Response) =>
      /\/jobs\/[^/]+\/activities\/[^/]+/.test(r.url()) && r.request().method() === "PATCH";

    const clickAndAwaitPatch = async () => {
      const responsePromise = page.waitForResponse(isActivityPatch, { timeout: TOGGLE_TIMEOUT });
      await toggle.click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
    };

    const original = (await toggle.getAttribute("aria-label")) ?? "";
    await clickAndAwaitPatch();
    await expect(toggle).not.toHaveAttribute("aria-label", original, { timeout: TOGGLE_TIMEOUT });
    // Cycle back to the original status (at most two more advances).
    for (let i = 0; i < 2; i += 1) {
      const current = (await toggle.getAttribute("aria-label")) ?? "";
      if (current === original) break;
      await clickAndAwaitPatch();
      await expect(toggle).not.toHaveAttribute("aria-label", current, { timeout: TOGGLE_TIMEOUT });
    }
    await expect(toggle).toHaveAttribute("aria-label", original, { timeout: TOGGLE_TIMEOUT });
  });

  test("convert button hidden at AWARDED, visible at CONTRACT_ISSUED — where the API refuses it (PR #242, drift)", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);

    // AWARDED (seeded T260310-QUEE-Rev1): button hidden.
    const awardedId = await findTenderId(request, token, "T260310-QUEE-Rev1");
    await page.goto(`/tenders/${awardedId}`);
    await expect(page.getByText("T260310-QUEE-Rev1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Convert to project →" })).toHaveCount(0);

    // CONTRACT_ISSUED fixture: button visible, modal opens, but the convert
    // API only accepts AWARDED — assert the surfaced error (drift, see PR).
    const fixture = await createFixtureTender(request, token, "CONTRACT_ISSUED", "convert-ui");
    try {
      await page.goto(`/tenders/${fixture.tenderId}`);
      await page.getByRole("button", { name: "Convert to project →" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Convert to project" })).toBeVisible();
      await expect(dialog.getByText(fixture.tenderNumber)).toBeVisible();
      await expect(dialog.getByText(/^IS-P\d+$/)).toBeVisible(); // next-number preview
      await dialog.getByRole("button", { name: "Convert to project", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText(
        "Tender status must be AWARDED to convert"
      );
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    } finally {
      await destroyFixture(request, token, fixture);
    }
  });

  test("converted project — IS-P number, frozen scope, Gantt task add + dialog reschedule, 409 re-convert (PR #39)", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    const fixture = await createFixtureProject(request, token, "convert");
    try {
      // Register lists the new project.
      await page.goto("/projects");
      await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: fixture.projectNumber!, exact: true })).toBeVisible();
      expect(fixture.projectNumber).toMatch(/^IS-P\d+$/);

      // Detail header: number, name, source-tender link.
      await page.getByRole("link", { name: fixture.projectNumber!, exact: true }).click();
      await expect(page.getByText(fixture.projectNumber!, { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: `From ${fixture.tenderNumber}` })).toBeVisible();

      // Scope carried across as a frozen snapshot (fixture has no line items,
      // so the banner + empty state are the observable carriers).
      await page.getByRole("tab", { name: "Scope", exact: true }).click();
      await expect(page.getByText(/Scope and rates are frozen at conversion/)).toBeVisible();
      await expect(page.getByText("No scope items", { exact: true })).toBeVisible();

      // Schedule tab renders the Gantt (empty state → add a task → bar).
      await page.getByRole("tab", { name: "Schedule", exact: true }).click();
      await expect(page.getByRole("tab", { name: "Gantt", exact: true })).toBeVisible();
      await expect(
        page.getByText(/No tasks yet\. Use "Generate from scope" or "\+ Add task"/)
      ).toBeVisible();
      await page.getByRole("button", { name: "+ Add task" }).click();
      await page.getByLabel("Title *").fill("e2e-b6-gantt-task");
      await page.getByRole("button", { name: "Add task", exact: true }).click();
      const bar = page.getByRole("button", { name: "Edit e2e-b6-gantt-task" });
      await expect(bar).toBeVisible();

      // Drag-to-reschedule has no pixel DnD here — the bar opens an edit
      // dialog with Start/End dates (the non-DnD affordance). Push the end
      // date out a week and save.
      await bar.click();
      const editDialog = page.getByRole("dialog");
      const end = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await editDialog.getByLabel("End", { exact: true }).fill(end);
      await editDialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(editDialog).toBeHidden();
      await expect(page.getByRole("button", { name: "Edit e2e-b6-gantt-task" })).toBeVisible();

      // Milestones section renders alongside the Gantt.
      await expect(page.getByText("No milestones yet")).toBeVisible();

      // Re-convert → 409. (The global exception filter reshapes the body to
      // {statusCode, error, message…}, so the existingProjectId pointer the
      // controller attaches is not observable here — see PR follow-up.)
      const res = await request.post(
        `http://127.0.0.1:3000/api/v1/tenders/${fixture.tenderId}/convert`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(res.status()).toBe(409);

      // And the tender (now CONVERTED) no longer offers the Convert button.
      await page.goto(`/tenders/${fixture.tenderId}`);
      await expect(page.getByText(fixture.tenderNumber).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Convert to project →" })).toHaveCount(0);
    } finally {
      await destroyFixture(request, token, fixture);
    }
  });

  test("status walk MOBILISING → ACTIVE → PRACTICAL_COMPLETION → DEFECTS → CLOSED with required dates (PR #39)", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    const fixture = await createFixtureProject(request, token, "status");
    try {
      await page.goto(`/projects/${fixture.projectId}`);
      await expect(page.getByText("Mobilising", { exact: true })).toBeVisible();

      // MOBILISING → ACTIVE requires the actual start date: clearing the
      // pre-filled date blocks submission (required field), the modal stays.
      await page.getByRole("button", { name: "Advance status →" }).click();
      const modal = page.getByRole("dialog");
      await expect(modal.getByText(`${fixture.projectNumber} is currently Mobilising.`)).toBeVisible();
      await modal.getByLabel("Actual start date").fill("");
      await modal.getByRole("button", { name: "Move to Active" }).click();
      await expect(modal).toBeVisible(); // blocked — date is required
      await modal.getByLabel("Actual start date").fill(todayIso());
      await modal.getByRole("button", { name: "Move to Active" }).click();
      await expect(modal).toBeHidden();
      await expect(page.getByText("Active", { exact: true })).toBeVisible();

      // ACTIVE → PRACTICAL_COMPLETION (practical completion date).
      await page.getByRole("button", { name: "Advance status →" }).click();
      await modal.getByLabel("Practical completion date").fill(todayIso());
      await modal.getByRole("button", { name: "Move to Practical Completion" }).click();
      await expect(modal).toBeHidden();
      // .first(): the status badge; the Key dates <dt> reuses the same text.
      await expect(page.getByText("Practical Completion", { exact: true }).first()).toBeVisible();

      // PRACTICAL_COMPLETION → DEFECTS (no date payload on this hop).
      await page.getByRole("button", { name: "Advance status →" }).click();
      await expect(modal.getByText("Move status to")).toBeVisible();
      await expect(modal.getByLabel(/date/i)).toHaveCount(0);
      await modal.getByRole("button", { name: "Move to Defects" }).click();
      await expect(modal).toBeHidden();
      await expect(page.getByText("Defects", { exact: true }).first()).toBeVisible();

      // DEFECTS → CLOSED (closed date), then no further transitions offered.
      await page.getByRole("button", { name: "Advance status →" }).click();
      await modal.getByLabel("Closed date").fill(todayIso());
      await modal.getByRole("button", { name: "Move to Closed" }).click();
      await expect(modal).toBeHidden();
      await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Advance status →" })).toHaveCount(0);

      // Key dates recorded along the walk.
      await expect(page.getByText("Actual Start", { exact: true })).toBeVisible();
    } finally {
      await destroyFixture(request, token, fixture);
    }
  });

  test("revert gate — wrong number keeps Revert disabled; correct number destroys project and resets tender (PR #250)", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    const fixture = await createFixtureProject(request, token, "revert");
    let reverted = false;
    try {
      await page.goto(`/projects/${fixture.projectId}`);
      await page.getByRole("button", { name: "Revert to Tender" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Revert project to tender?" })).toBeVisible();
      const confirmButton = dialog.getByRole("button", { name: "Revert to Tender" });

      // Wrong project number → stays disabled.
      await dialog.getByRole("textbox").fill("IS-P000");
      await expect(confirmButton).toBeDisabled();

      // Correct number → enabled; executing lands on the source tender.
      await dialog.getByRole("textbox").fill(fixture.projectNumber!);
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();
      await page.waitForURL(`**/tenders/${fixture.tenderId}`);
      reverted = true;

      // Tender is back at CONTRACT_ISSUED (rendered as "Contract").
      await expect(page.getByText(fixture.tenderNumber).first()).toBeVisible();
      await expect(page.getByText("Contract", { exact: true }).first()).toBeVisible();

      // Project gone from the register.
      await page.goto("/projects");
      await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
      await expect(page.getByText(fixture.projectNumber!, { exact: true })).toHaveCount(0);
    } finally {
      await destroyFixture(request, token, {
        tenderId: fixture.tenderId,
        projectId: reverted ? null : fixture.projectId
      });
    }
  });

  test("allocations — overlap warning + allocate anyway, asset → Plant & equipment, activity log entries (PR #40)", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    const projectA = await createFixtureProject(request, token, "alloc-a");
    const projectB = await createFixtureProject(request, token, "alloc-b");
    try {
      // Seed the conflict: Raj is already on project A from today, ongoing.
      await allocateWorkerToProject(request, token, projectA.projectId!, "wp-user-estimator", todayIso());

      await page.goto(`/projects/${projectB.projectId}`);
      await page.getByRole("tab", { name: "Team", exact: true }).click();
      await expect(page.getByText("No workers allocated")).toBeVisible();

      // Allocate the same worker with overlapping dates → warning banner.
      // NOTE (drift, see PR follow-up): the POST persists the allocation
      // BEFORE the warning renders — "Allocate anyway" would issue a second
      // POST and duplicate the row. The test therefore asserts the warning +
      // the single created row and dismisses the modal instead of re-posting.
      await page.getByRole("button", { name: "Add worker", exact: true }).click();
      const workerModal = page.getByRole("dialog");
      await workerModal.getByPlaceholder("Type to search…").fill("Raj");
      await workerModal.getByRole("button", { name: /Raj Pudasaini/ }).click();
      await workerModal.getByRole("button", { name: "Allocate", exact: true }).click();
      const warning = workerModal.getByRole("alert");
      await expect(warning).toContainText("Raj Pudasaini is already allocated to:");
      await expect(warning).toContainText(projectA.projectNumber!);
      await expect(workerModal.getByRole("button", { name: "Allocate anyway" })).toBeVisible();
      await workerModal.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(workerModal).toBeHidden();

      // The overlapping allocation exists in BOTH projects ("both rows") —
      // the cancel path does not refresh the tab, so reload to observe it.
      await page.goto(`/projects/${projectB.projectId}`);
      await page.getByRole("tab", { name: "Team", exact: true }).click();
      await expect(page.getByRole("row").filter({ hasText: "Raj Pudasaini" })).toHaveCount(1);
      await page.goto(`/projects/${projectA.projectId}`);
      await page.getByRole("tab", { name: "Team", exact: true }).click();
      await expect(page.getByRole("row").filter({ hasText: "Raj Pudasaini" })).toHaveCount(1);
      await page.goto(`/projects/${projectB.projectId}`);
      await page.getByRole("tab", { name: "Team", exact: true }).click();

      // Allocate an asset → shows in the Plant & equipment section.
      await expect(page.getByRole("heading", { name: "Plant & equipment" })).toBeVisible();
      await page.getByRole("button", { name: "Add asset", exact: true }).click();
      const assetModal = page.getByRole("dialog");
      await assetModal.getByPlaceholder("Type to search…").fill("CAT 320");
      await assetModal.getByRole("button", { name: /CAT 320 Excavator/ }).click();
      await assetModal.getByRole("button", { name: "Allocate", exact: true }).click();
      await expect(assetModal).toBeHidden();
      await expect(page.getByRole("row").filter({ hasText: "CAT 320 Excavator" })).toHaveCount(1);

      // Activity tab logs both allocations.
      await page.getByRole("tab", { name: "Activity", exact: true }).click();
      await expect(page.getByText("Worker allocated", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Asset allocated", { exact: true }).first()).toBeVisible();
    } finally {
      await destroyFixture(request, token, projectB);
      await destroyFixture(request, token, projectA);
    }
  });

  test("worker register — Add modal, allocate user-less profile, deactivate keeps allocations (PR #40)", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    const fixture = await createFixtureProject(request, token, "worker");
    const lastName = `B6W${Date.now()}`;
    const fullName = `E2E ${lastName}`;
    try {
      // Create via the Add modal — modal-created profiles have no linked
      // internal user (the internalUserId=null case from PR #40).
      await page.goto("/workers");
      await expect(page.getByRole("heading", { name: "Workers", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Add worker", exact: true }).click();
      const addModal = page.getByRole("dialog");
      await addModal.getByLabel("First name*").fill("E2E");
      await addModal.getByLabel("Last name*").fill(lastName);
      await addModal.getByLabel("Role*").fill("Labourer");
      await addModal.getByRole("button", { name: "Create worker", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("Worker profile created");
      await page.getByPlaceholder("Search name or role…").fill(lastName);
      await expect(page.getByRole("link", { name: fullName })).toBeVisible();

      // Allocate the user-less profile to a project — no crash, row created.
      await page.goto(`/projects/${fixture.projectId}`);
      await page.getByRole("tab", { name: "Team", exact: true }).click();
      await page.getByRole("button", { name: "Add worker", exact: true }).click();
      const allocModal = page.getByRole("dialog");
      await allocModal.getByPlaceholder("Type to search…").fill(lastName);
      await allocModal.getByRole("button", { name: new RegExp(fullName) }).click();
      await allocModal.getByRole("button", { name: "Allocate", exact: true }).click();
      await expect(allocModal).toBeHidden();
      await expect(page.getByRole("row").filter({ hasText: fullName })).toHaveCount(1);

      // Deactivate from the worker detail page (confirm dialog) — the page
      // navigates back to the /workers register on success.
      await page.getByRole("link", { name: fullName }).click();
      await expect(page.getByRole("heading", { name: fullName })).toBeVisible();
      page.once("dialog", (d) => void d.accept());
      await page.getByRole("button", { name: "Deactivate worker" }).click();
      await page.waitForURL(/\/workers$/);

      // Hidden from the Active tab, present on Inactive.
      await page.getByPlaceholder("Search name or role…").fill(lastName);
      await expect(page.getByRole("link", { name: fullName })).toHaveCount(0);
      await page.getByRole("tab", { name: "Inactive", exact: true }).click();
      await expect(page.getByRole("link", { name: fullName })).toBeVisible();

      // Allocations untouched — the project row still lists on the profile.
      await page.getByRole("link", { name: fullName }).click();
      await page.waitForURL(/\/workers\/.+/);
      await expect(page.getByRole("heading", { name: fullName })).toBeVisible();
      await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: fixture.projectNumber!, exact: true })).toBeVisible();
      // Residue note: the deactivated profile remains (no delete endpoint).
    } finally {
      await destroyFixture(request, token, fixture);
    }
  });

  test("add entry modal — Task needs an assignee, Follow-up needs a due date (PR #267, adapted)", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    const tenderId = await findTenderId(request, token, "T260310-QUEE-Rev1");
    await page.goto(`/tenders/${tenderId}`);
    await page.getByRole("button", { name: "+ Add entry" }).click();

    const modal = page.getByRole("dialog");
    await expect(modal.getByRole("heading", { name: "New entry" })).toBeVisible();
    const save = modal.getByRole("button", { name: "Save", exact: true });

    // Task → both Due date and Assignee render; Save stays disabled until an
    // assignee is picked (the disabled gate replaced the literal "Tasks must
    // be assigned to a user" message — see PR follow-up).
    await modal.getByLabel("Type").selectOption("task");
    await modal.getByLabel("Body").fill("e2e-b6 validation probe — never saved");
    await expect(modal.getByLabel("Due date")).toBeVisible();
    await expect(modal.getByLabel("Assignee")).toBeVisible();
    await modal.getByLabel("Due date").fill(todayIso());
    await expect(save).toBeDisabled();
    await modal.getByLabel("Assignee").selectOption({ index: 1 });
    await expect(save).toBeEnabled();

    // Follow-up → Due date required, Assignee not rendered. (The due date
    // survives the task→follow_up switch — both types need one — so clear it
    // to exercise the requirement.)
    await modal.getByLabel("Type").selectOption("follow_up");
    await expect(modal.getByLabel("Assignee")).toHaveCount(0);
    await modal.getByLabel("Due date").fill("");
    await expect(save).toBeDisabled();
    await modal.getByLabel("Due date").fill(todayIso());
    await expect(save).toBeEnabled();

    // Note → neither conditional field; body alone enables Save.
    await modal.getByLabel("Type").selectOption("note");
    await expect(modal.getByLabel("Due date")).toHaveCount(0);
    await expect(modal.getByLabel("Assignee")).toHaveCount(0);
    await expect(save).toBeEnabled();

    // Never saved — no residue.
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(modal).toBeHidden();
  });
});
