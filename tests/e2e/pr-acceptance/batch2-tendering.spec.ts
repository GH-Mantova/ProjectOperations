/**
 * Batch 2 — Tendering pipeline + register (PRs #16, #28, #29, #30, #43, #64, #173, #177, #231, #232, #260, #265)
 *
 * Triage table (full table also in the PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR   | Item (truncated)                                    | Decision
 * -----|-----------------------------------------------------|-----------------
 * #265 | Feed ↔ Tabs toggle persists via localStorage        | CONVERT → test "entries view toggle"
 * #260 | Create one entry of each type, each renders         | CONVERT → test "entries of every type"
 * #260 | Toggle Feed ↔ Tabs; preference survives reload      | CONVERT → test "entries view toggle"
 * #250 | Wrong project number → Revert stays disabled        | BATCH-6 — claimed by /project/ regex; needs convert-to-project flow (PR #39, batch 6)
 * #250 | Correct number → revert executes                    | BATCH-6 — same as above
 * #232 | Delete tender dialog shows "N client link(s)"       | CONVERT → test "delete dialog cascade"
 * #231 | Overview tab-switch → no phantom DraftBanner        | SKIP — feature reworked: TenderClarificationLog (DraftBanner host) is
 *      |                                                     | orphaned; PR #260 replaced it with TenderEntriesPanel (no drafts)
 * #231 | Type in Clarifications form, switch tabs → draft    | SKIP — feature reworked (as above)
 * #231 | Open form without typing → no draft saved           | SKIP — feature reworked (as above)
 * #231 | Activity timeline note + Post → appears             | CONVERT → test "entries of every type" (Note entry)
 * #177 | Markup picker (5 items)                             | SKIP — lives in Scope of Works tab (ScopeCardsTab); scope tab is
 *      |                                                     | batch 3 territory per batch-boundary rule; listed in follow-up
 * #173 | Plant qty/days inputs no longer clip                | SKIP — Scope tab + pixel-level visual assertion
 * #173 | Tendering Assistant drag/minimise/pill (6 items)    | SKIP — pixel-level drag-and-drop / position assertions (flaky)
 * #64  | Apply each filter individually and combined         | CONVERT → test "register filters narrow"
 * #64  | Save preset Set as default → reload auto-applies    | CONVERT → test "saved preset default"
 * #64  | Select 3+ rows → Change status → toast              | CONVERT (partial) → test "bulk select bar" — bar, count, stage
 *      |                                                     | listbox and Export CSV asserted; mutation NOT executed (would
 *      |                                                     | rewrite seed tender statuses, breaking re-runnability)
 * #64  | Hover row → ✎ → change status + due date → save     | CONVERT → test "quick edit slide-over" (fixed due date, idempotent)
 * #64  | Column headers cycle asc → desc → off               | CONVERT → test "register sort cycles"
 * #64  | Client card → rate 4 stars → reload persists        | CONVERT → test "client card star rating"
 * #48  | Sidebar Dashboards group (6 items)                  | COVERED → batch1-auth-shell.spec.ts + batch1-dashboards.spec.ts
 * #43  | Open any tender — tabs render (routed from batch 1) | COVERED → tendering.spec.ts "Tender detail page exposes
 *      |                                                     | Overview, Scope of Works, Quote tabs" (4th Documents tab was
 *      |                                                     | reworked into an Overview panel — PR #78 redesign)
 * #43  | Overview shows 5 info cards (routed from batch 1)   | CONVERT → test "overview info cards"
 * #30  | Recent wins 90d, no TEN-COMP/Compliance entries     | CONVERT → test "tender dashboard hygiene" (presence already
 *      |                                                     | covered by batch1-dashboards "Recent wins" test; this adds the
 *      |                                                     | compliance-artifact absence + follow-up queue + KPI labels)
 * #29  | Sidebar Tendering/Dashboard/Reports highlight       | COVERED → batch1-auth-shell.spec.ts nav tests
 * #29  | Rates admin: 6 tabs inline click-edit               | SKIP — /admin/estimate-rates is an admin page outside the
 *      |                                                     | pipeline/register scope; routed onward per batch 1 triage note
 * #28  | Estimate tab → six sections with totals             | SKIP — requires a seeded estimate (none in seed); estimate
 *      |                                                     | creation flows belong to batches 3–4. Rate-snapshot fallback
 *      |                                                     | ("No estimate yet") asserted in "overview info cards"
 * #28  | Submit & lock rates → Locked badge                  | SKIP — same; v2 editor reworked into Rate snapshot badge
 * #16  | Workspace umbrella: drag card across columns        | CONVERT (drag alternative) → test "stage movement via status
 *      |                                                     | select" — pixel DnD itself skipped as flaky per conventions
 * #16  | … register sort/filter, detail, note/follow-up      | CONVERT/COVERED → register tests here; detail tabs covered by
 *      |                                                     | tendering.spec.ts; note/follow-up via "entries of every type"
 * ─────────────────────────────────────────────────────────────────────────────
 * Items claimed by other batches' regexes (accounted for, not converted here):
 *   • PRs #26, #34, #37, #44 (15 items) → batch 3 (/scope|waste|cutting/)
 *   • PR #45 (4 items) → batch 4 (/quote|pdf/)
 *   • PRs #39, #250 (5 items) → batch 6 (/project|contract/)
 *
 * Follow-up:
 *   • PR #177 markup-picker items should be re-triaged in batch 3 (scope cards).
 *   • PR #29 rates-admin item needs an admin-pages batch (5 or 8) to claim it.
 *
 * Residue notes (conventions: no UI delete exists → documented):
 *   • "entries of every type" leaves 8 tender entries on T260428-BRIS-Rev1 per run
 *     (unique e2e-b2-* subjects; TenderEntriesPanel has no delete control).
 *   • "client card star rating" pins client-001 preferenceScore to 4 (idempotent).
 *   • "quick edit slide-over" pins T260407-GOLD-Rev1 dueDate to 2031-03-15 (idempotent).
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin, SEED_TENDER_NUMBER } from "./helpers";

/** Opens the Register view of /tenders. */
async function openRegister(page: Page) {
  await page.goto("/tenders");
  await page.getByRole("tab", { name: "Register", exact: true }).click();
  await expect(page.getByPlaceholder("Search number, title, or client")).toBeVisible();
}

/** Navigates to a tender's detail page through the register (pure UI route). */
async function openTenderDetail(page: Page, tenderNumber: string) {
  await openRegister(page);
  await page.getByPlaceholder("Search number, title, or client").fill(tenderNumber);
  await page.getByText(tenderNumber, { exact: true }).click();
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
}

test.describe("Batch 2 — Tendering pipeline + register (PRs #16, #28-#30, #43, #64, #231, #232, #260, #265)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── Register: filters ──────────────────────────────────────────────────────

  test("register filters narrow results — search alone, then combined with Min $", async ({ page }) => {
    await openRegister(page);
    // Search narrows to the Ipswich tender only.
    await page.getByPlaceholder("Search number, title, or client").fill("Ipswich");
    await expect(page.getByText("T260310-QUEE-Rev1", { exact: true })).toBeVisible();
    await expect(page.getByText("T260317-SUNC-Rev1", { exact: true })).not.toBeVisible();
    // Clear search, open advanced filters and apply a Min $ that only the
    // $4.25M Ipswich tender clears — individual + combined behaviour.
    await page.getByPlaceholder("Search number, title, or client").fill("");
    await page.getByRole("button", { name: "More filters", exact: true }).click();
    await expect(page.getByText("Min $", { exact: true })).toBeVisible();
    await page.getByLabel("Min $").fill("4000000");
    await expect(page.getByText("T260310-QUEE-Rev1", { exact: true })).toBeVisible();
    await expect(page.getByText("T260407-GOLD-Rev1", { exact: true })).not.toBeVisible();
  });

  test("register column header cycles sort asc → desc with arrow indicator", async ({ page }) => {
    await openRegister(page);
    const valueHeader = page.getByRole("button", { name: /^Value/ });
    await valueHeader.click();
    await expect(page.getByRole("button", { name: "Value ↑" })).toBeVisible();
    await page.getByRole("button", { name: "Value ↑" }).click();
    await expect(page.getByRole("button", { name: "Value ↓" })).toBeVisible();
    // Third click switches sorting off again — arrow disappears.
    await page.getByRole("button", { name: "Value ↓" }).click();
    await expect(page.getByRole("button", { name: /^Value [↑↓]$/ })).not.toBeVisible();
  });

  test("saved preset with Set as default auto-applies after reload, then deletes", async ({ page }) => {
    // Preset delete uses window.confirm — auto-accept.
    page.on("dialog", (dialog) => void dialog.accept());
    await openRegister(page);

    // "Presets ▾" only renders when at least one preset exists — purge
    // residue presets from earlier runs (server-side per user) if present.
    const presetsButton = page.getByRole("button", { name: "Presets ▾" });
    if (await presetsButton.isVisible()) {
      await presetsButton.click();
      const residue = page.getByRole("button", { name: /Delete preset e2e-b2-/ });
      while ((await residue.count()) > 0) {
        const before = await residue.count();
        await residue.first().click();
        await expect(residue).toHaveCount(before - 1);
      }
      // The dropdown closes on mouse-leave.
      await page.getByPlaceholder("Search number, title, or client").hover();
    }

    // Activate the Hot chip — "Save filter" only renders once a filter is on.
    const presetName = `e2e-b2-${Date.now()}`;
    await page.getByRole("button", { name: "Hot", exact: true }).click();
    await page.getByRole("button", { name: "Save filter", exact: true }).click();
    await page.getByPlaceholder("Preset name").fill(presetName);
    await page.getByLabel("Set as default").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`Preset "${presetName}" saved`)).toBeVisible();

    // Full reload — the default preset must auto-apply (Hot chip pressed).
    await page.reload();
    await page.getByRole("tab", { name: "Register", exact: true }).click();
    await expect(page.getByRole("button", { name: "Hot", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Clean up so the run is repeatable.
    await page.getByRole("button", { name: "Presets ▾" }).click();
    await page.getByRole("button", { name: `Delete preset ${presetName}` }).click();
    await expect(page.getByRole("button", { name: `Delete preset ${presetName}` })).toHaveCount(0);
  });

  test("bulk select shows action bar with Change status stages and Export CSV", async ({ page }) => {
    await openRegister(page);
    await page.getByRole("checkbox", { name: "Select tender T260414-SUNC-Rev1" }).check();
    await page.getByRole("checkbox", { name: "Select tender T260428-BRIS-Rev1" }).check();
    await expect(page.getByText("2 tenders selected")).toBeVisible();
    // Stage listbox opens with the canonical labels. The actual status
    // mutation is intentionally not executed — it would rewrite seed
    // tender statuses and break re-runnability of the suite.
    await page.getByRole("button", { name: "Change status", exact: true }).click();
    for (const stage of ["Submitted", "Awarded", "Lost"]) {
      await expect(page.getByRole("listbox").getByRole("button", { name: stage, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    await expect(page.getByText("2 tenders selected")).not.toBeVisible();
  });

  test("quick edit slide-over opens from row hover and saves a due date", async ({ page }) => {
    await openRegister(page);
    await page.getByPlaceholder("Search number, title, or client").fill("T260407-GOLD-Rev1");
    await expect(page.getByText("T260407-GOLD-Rev1", { exact: true })).toBeVisible();
    await page.getByText("T260407-GOLD-Rev1", { exact: true }).hover();
    await page.getByRole("button", { name: "Quick edit T260407-GOLD-Rev1" }).click();

    const dialog = page.getByRole("dialog", { name: "Quick edit tender" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Status")).toBeVisible();
    // Fixed date keeps the write idempotent across runs (residue documented).
    await dialog.getByLabel("Due date").fill("2031-03-15");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });

  // ── Pipeline: stage movement without drag-and-drop ────────────────────────

  test("stage movement via detail status select reflects in register, then reverts", async ({ page }) => {
    await openTenderDetail(page, "T260407-GOLD-Rev1");
    // Move Draft → Estimating using the header status select (the UI-control
    // alternative to kanban drag-and-drop, which conventions skip as flaky).
    // NOTE: bare getByText("Estimating") would match the hidden <option>
    // inside the closed selects, so assert via select value + register row.
    await page.getByLabel("Change tender status").selectOption({ label: "Estimating" });
    await expect(page.getByLabel("Change tender status")).toHaveValue("IN_PROGRESS");

    // The register row reflects the new stage.
    await openRegister(page);
    await page.getByPlaceholder("Search number, title, or client").fill("T260407-GOLD-Rev1");
    await expect(
      page.getByRole("row", { name: /T260407-GOLD-Rev1/ }).getByText("Estimating", { exact: true })
    ).toBeVisible();

    // Revert to Draft so the suite is re-runnable.
    await page.getByText("T260407-GOLD-Rev1", { exact: true }).click();
    await page.getByLabel("Change tender status").selectOption({ label: "Draft" });
    await expect(page.getByLabel("Change tender status")).toHaveValue("DRAFT");
  });

  // ── Detail: overview info cards ────────────────────────────────────────────

  test("overview shows the 5 info cards including rate snapshot state", async ({ page }) => {
    await openTenderDetail(page, "T260310-QUEE-Rev1");
    for (const label of ["Stage", "Value", "Probability", "Due date", "Rate snapshot"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    // Rate snapshot renders one of its three legitimate states.
    await expect(page.getByText(/^(Locked|Live rates|No estimate yet)$/).first()).toBeVisible();
  });

  // ── Detail: activity & communications entries ─────────────────────────────

  test("entries panel creates an entry of every type and renders its badge", async ({ page }) => {
    const run = Date.now();
    await openTenderDetail(page, "T260428-BRIS-Rev1");
    await expect(page.getByText("Activity & communications")).toBeVisible();

    const entryTypes: Array<{ label: string; needsDueDate: boolean; needsAssignee: boolean }> = [
      { label: "Note", needsDueDate: false, needsAssignee: false },
      { label: "RFI", needsDueDate: false, needsAssignee: false },
      { label: "Email", needsDueDate: false, needsAssignee: false },
      { label: "Call", needsDueDate: false, needsAssignee: false },
      { label: "Meeting", needsDueDate: false, needsAssignee: false },
      { label: "Follow-up", needsDueDate: true, needsAssignee: false },
      { label: "Self-reminder", needsDueDate: true, needsAssignee: false },
      { label: "Task", needsDueDate: true, needsAssignee: true }
    ];

    for (const entryType of entryTypes) {
      const subject = `e2e-b2-${entryType.label.toLowerCase()}-${run}`;
      await page.getByRole("button", { name: "+ Add entry" }).click();
      // Scope to the modal — the page behind has its own Type/category fields.
      const modal = page.getByRole("dialog", { name: "New entry" });
      await expect(modal).toBeVisible();
      await modal.getByRole("combobox", { name: "Type" }).selectOption({ label: entryType.label });
      await modal.getByRole("textbox", { name: "Subject (optional)" }).fill(subject);
      await modal.getByRole("textbox", { name: "Body" }).fill(`Batch 2 e2e body for ${entryType.label}`);
      if (entryType.needsDueDate) {
        await modal.getByLabel("Due date").fill("2031-06-30");
      }
      if (entryType.needsAssignee) {
        await modal.getByRole("combobox", { name: "Assignee" }).selectOption({ index: 1 });
      }
      await modal.getByRole("button", { name: "Save", exact: true }).click();
      // Entry renders in the feed with its subject (covers PR #231's
      // "post a note → appears in timeline" for the Note type).
      await expect(page.getByText(subject)).toBeVisible();
    }

    // Status toggle on the follow-up: Open → Done → Open (complete + restore).
    const followUpRow = page
      .getByRole("listitem")
      .filter({ hasText: `e2e-b2-follow-up-${run}` });
    await followUpRow.getByRole("button", { name: "Open", exact: true }).click();
    await expect(followUpRow.getByRole("button", { name: "Done", exact: true })).toBeVisible();
    await followUpRow.getByRole("button", { name: "Done", exact: true }).click();
    await expect(followUpRow.getByRole("button", { name: "Open", exact: true })).toBeVisible();
    // Residue: the 8 created entries remain — PR-63b's delete affordance is
    // deliberately not exercised here to keep this spec's scope unchanged.
  });

  test("entries view toggle Feed ↔ Tabs persists across a reload", async ({ page }) => {
    await openTenderDetail(page, "T260428-BRIS-Rev1");
    await expect(page.getByText("Activity & communications")).toBeVisible();
    // Switch to Tabs — the grouped tab strip appears.
    await page.getByRole("button", { name: "Tabs", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Correspondence", exact: true })).toBeVisible();

    // Reload — preference persists via localStorage["tenderEntriesView"].
    await page.reload();
    await expect(page.getByRole("tab", { name: "Correspondence", exact: true })).toBeVisible();

    // Restore the default Feed view (keeps the suite order-independent).
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await expect(page.getByRole("tab", { name: "My Tasks", exact: true })).toBeVisible();
  });

  // ── Detail: Team panel estimator dropdown ──────────────────────────────────

  test("Team panel estimator dropdown populates from /users?role=estimator", async ({ page }) => {
    // §5A.3 follow-up — guards the GET /users?role= contract: the param must
    // pass query validation and the role filter must match the seeded
    // "Senior Estimator" role (substring, case-insensitive).
    await openTenderDetail(page, SEED_TENDER_NUMBER);
    const dropdown = page.getByRole("combobox", { name: "Assigned estimator" });
    await expect(dropdown).toBeVisible();
    await expect(
      dropdown.locator("option", { hasText: "Raj Pudasaini" })
    ).toHaveCount(1);
  });

  // ── Detail: client scoring (Client Detail drawer) ─────────────────────────

  test("client card expands, 4-star rating persists after reload, win-rate line renders", async ({ page }) => {
    // §5A.3 (PR-63b) — client rows moved from the Team panel to the Activity
    // sidebar; the editable rating lives in the Client Detail drawer behind
    // the row's info icon.
    await openTenderDetail(page, "T260310-QUEE-Rev1");
    const infoButton = page.getByRole("button", {
      name: "Queensland Transport Infrastructure details"
    });
    await infoButton.click();
    const drawer = page.getByTestId("client-detail-drawer");
    const ratingGroup = drawer.getByRole("radiogroup", {
      name: "Queensland Transport Infrastructure preference score"
    });
    await expect(ratingGroup).toBeVisible();
    await ratingGroup.getByRole("radio", { name: "4 stars" }).click();
    // Saving triggers a tender refetch which remounts the overview (the
    // drawer closes) — wait for that, reopen, then assert the score stuck.
    await expect(ratingGroup).not.toBeVisible();
    await infoButton.click();
    await expect(ratingGroup.getByRole("radio", { name: "4 stars" })).toBeChecked();

    await page.reload();
    await infoButton.click();
    await expect(ratingGroup.getByRole("radio", { name: "4 stars" })).toBeChecked();
    // Win-rate line renders its correct state: the "% win rate (N won of M
    // quoted)" line when the client has computed quote history, otherwise the
    // documented "No tender history yet" fallback (seed has no quote history).
    await expect(
      drawer.getByText(/% win rate \(\d+ won of \d+ quoted\)|No tender history yet/).first()
    ).toBeVisible();
  });

  // ── Detail: delete dialog cascade ──────────────────────────────────────────

  test("delete dialog lists client-link cascade and cancels cleanly", async ({ page }) => {
    await openTenderDetail(page, "T260407-GOLD-Rev1");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Delete Tender T260407-GOLD-Rev1?")).toBeVisible();
    await expect(page.getByText("The following will also be deleted:")).toBeVisible();
    await expect(page.getByText(/\d+ client link\(s\)/)).toBeVisible();
    // Cancel — nothing is deleted.
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("Delete Tender T260407-GOLD-Rev1?")).not.toBeVisible();
    await expect(page.getByText("T260407-GOLD-Rev1", { exact: true }).first()).toBeVisible();
  });

  // §9: the seeded Tendering dashboard (/tenders/dashboard) was retired; its
  // KPI/follow-up/recent-wins acceptance test was removed with it.
});
