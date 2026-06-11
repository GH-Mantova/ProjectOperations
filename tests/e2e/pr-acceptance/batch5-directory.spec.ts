/**
 * Batch 5 — Subcontractors & suppliers directory + workers legacy page
 * (PRs #19 partial; directory coverage from the batch scope line — the
 * inventory has no UI-MANUAL rows for the directory PRs, so these tests are
 * scope-mandated regression coverage rather than 1:1 conversions.)
 *
 * Triage (full table in the PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR    | Item (truncated)                                   | Decision
 * ------|----------------------------------------------------|-----------------
 * #19   | /resources workers workspace manual pass           | CONVERT (partial) → "workers legacy KPI
 *       |                                                    | strip"; worker-detail 5-tab walk routed to
 *       |                                                    | the resources/field batch (batch 7)
 * scope | Subcontractor prequalification status badges       | CONVERT → "directory list badges"
 * scope | Licence/insurance expiry badges on seeded data     | CONVERT → "expiry badges"
 * scope | Private Person hides ABN + auto primary contact    | CONVERT → "private person lifecycle".
 *       |                                                    | NOTE: the modal's submit currently 400s
 *       |                                                    | (POST /directory requires prequalStatus,
 *       |                                                    | modal omits it) — entity created via the
 *       |                                                    | API instead; bug flagged in PR follow-up
 * scope | Credit application flow as far as UI permits       | CONVERT (partial) → "private person
 *       |                                                    | lifecycle" uploads a Credit application
 *       |                                                    | document record; the draft→submitted→…
 *       |                                                    | status walk is API-only (no UI exists)
 * ─────────────────────────────────────────────────────────────────────────────
 * Residue notes:
 *   • "private person lifecycle" deactivates its created entry via the UI
 *     (soft delete) — the row stays in the DB as isActive=false but is hidden
 *     from the default Active-only directory view.
 *
 * Seed expectations (apps/api/prisma/seed-initial-services.ts):
 *   • Cutrite Concrete Sawing — prequal approved; QBCC licence expires +45d
 *     (active badge), public liability insurance expires +15d (expiring soon
 *     badge → 1 expiring alert).
 *   • Swanbank Waste — licence expired -5d (expired badge → 1 expiring alert).
 *   • Generic Labour Hire Co — prequal pending.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";
import { apiFetch, apiToken } from "./api-helpers";
import { loginAsAdmin } from "./helpers";

async function openDirectory(page: Page) {
  await page.goto("/directory/subcontractors");
  await expect(
    page.getByRole("heading", { name: "Subcontractors & Suppliers" })
  ).toBeVisible();
}

/** The toolbar selects carry no labels — identify each by a distinctive option. */
function selectWithOption(page: Page, optionLabel: string): Locator {
  return page
    .getByRole("combobox")
    .filter({ has: page.getByRole("option", { name: optionLabel, exact: true }) });
}

test.describe("Batch 5 — Directory & workers legacy (PR #19 + batch scope)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("directory list — prequal badges, expiry alerts, prequal filter, search", async ({
    page
  }) => {
    await openDirectory(page);

    const cutrite = page.getByRole("row", { name: /Cutrite Concrete Sawing/ });
    await expect(cutrite.getByText("approved", { exact: true })).toBeVisible();
    // Only the +15d insurance falls inside the 30-day alert window (the +45d
    // licence does not), so Cutrite shows exactly one alert.
    await expect(cutrite.getByText("1 expiring", { exact: true })).toBeVisible();

    const swanbank = page.getByRole("row", { name: /Swanbank Waste/ });
    await expect(swanbank.getByText("1 expiring", { exact: true })).toBeVisible();

    const labourHire = page.getByRole("row", { name: /Generic Labour Hire/ });
    await expect(labourHire.getByText("pending", { exact: true })).toBeVisible();

    // Prequal filter narrows to the pending entry.
    await selectWithOption(page, "All prequal").selectOption("pending");
    await expect(page.getByRole("row", { name: /Generic Labour Hire/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Cutrite Concrete Sawing/ })).toBeHidden();
    await selectWithOption(page, "All prequal").selectOption("");

    // Search by name.
    await page.getByPlaceholder("Search name / ABN…").fill("Cutrite");
    await expect(page.getByRole("row", { name: /Cutrite Concrete Sawing/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Generic Labour Hire/ })).toBeHidden();
  });

  test("licence and insurance expiry badges on seeded subcontractors", async ({ page }) => {
    await openDirectory(page);

    await page.getByRole("row", { name: /Cutrite Concrete Sawing/ }).click();
    await expect(page.getByRole("heading", { name: "Cutrite Concrete Sawing" })).toBeVisible();
    await expect(page.getByText("Prequalified supplier")).toBeVisible();
    // QBCC licence +45d → active; QBE public liability +15d → expiring soon.
    await expect(page.getByText("QBCC-12345")).toBeVisible();
    await expect(page.getByText("active", { exact: true })).toBeVisible();
    await expect(page.getByText("QBE Insurance")).toBeVisible();
    await expect(page.getByText("expiring soon", { exact: true })).toBeVisible();

    await page.getByRole("row", { name: /Swanbank Waste/ }).click();
    await expect(page.getByRole("heading", { name: "Swanbank Waste" })).toBeVisible();
    await expect(page.getByText("EPA-WT-5678")).toBeVisible();
    await expect(page.getByText("expired", { exact: true })).toBeVisible();
  });

  test("private person lifecycle — ABN hidden, auto contact, prequal walk, credit doc, deactivate", async ({
    page,
    request
  }) => {
    // updatePrequal uses window.confirm + window.prompt; softDelete uses
    // window.confirm — accept everything, supplying text for prompts.
    page.on("dialog", (dialog) =>
      void dialog.accept(dialog.type() === "prompt" ? "e2e-b5 prequal note" : undefined)
    );

    await openDirectory(page);
    await page.getByRole("button", { name: "+ New entry" }).click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByText("Legal name *")).toBeVisible();
    await expect(modal.getByText("ABN", { exact: true })).toBeVisible();
    await expect(modal.getByText("Trading name", { exact: true })).toBeVisible();

    // Switching to Private Person relabels the name field and removes the
    // company-only fields (ABN, trading name).
    await modal.getByLabel("Business type").selectOption("private_person");
    await expect(modal.getByText("Full name *")).toBeVisible();
    await expect(modal.getByText("ABN", { exact: true })).toBeHidden();
    await expect(modal.getByText("Trading name", { exact: true })).toBeHidden();
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();

    // Submitting this modal currently 400s: POST /directory requires
    // prequalStatus and CreateSubcontractorModal never sends it (bug —
    // flagged in the PR follow-up section). Create the entity through the
    // same REST API instead (api-helpers pattern from batch 3); the
    // private_person auto-contact is API behaviour, so it still exercises
    // the real code path.
    const personName = `E2e Person${Date.now()}`;
    const token = await apiToken(request);
    await apiFetch(request, token, "POST", "/directory", {
      name: personName,
      businessType: "private_person",
      entityType: "subcontractor",
      prequalStatus: "pending",
      // Scalar list has no DB default — omitting it is a null violation (500).
      categories: []
    });

    // Detail panel opens on the new entry, pending prequal.
    await page.getByPlaceholder("Search name / ABN…").fill(personName);
    await page.getByRole("row", { name: new RegExp(personName) }).click();
    await expect(page.getByRole("heading", { name: personName })).toBeVisible();
    await expect(page.getByText("Prequalification pending — review required")).toBeVisible();

    // The API auto-created a primary contact from the split name. The tab
    // label above already pins the count to exactly 1; assert the row itself
    // scoped by its Primary badge — page-wide getByText counts also match
    // the register row behind the panel and are order-dependent.
    await page.getByRole("tab", { name: "Contacts (1)", exact: true }).click();
    const contactRow = page
      .getByRole("row", { name: new RegExp(personName) })
      .filter({ has: page.getByText("Primary", { exact: true }) });
    await expect(contactRow).toHaveCount(1);
    await expect(contactRow).toBeVisible();
    await page.getByRole("tab", { name: "Overview", exact: true }).click();

    // Credit application — as far as the UI permits: a document record of
    // type "Credit application". No status-walk UI exists (API-only).
    await page.getByRole("tab", { name: "Documents (0)", exact: true }).click();
    await page.getByRole("button", { name: "+ Upload document" }).click();
    await page.getByLabel("Type *").selectOption("credit_application");
    await page.getByLabel("File name *").fill("e2e-b5-credit-application.pdf");
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("cell", { name: "Credit application" })).toBeVisible();

    // Prequal walk: pending → approved (confirm fires for the missing
    // compliance records, prompt for notes) → suspended.
    await page.getByRole("button", { name: "Approve prequal" }).click();
    await expect(page.getByText("Prequalified supplier")).toBeVisible();
    await page.getByRole("button", { name: "Suspend", exact: true }).click();
    await expect(page.getByText("SUSPENDED — do not engage without approval")).toBeVisible();

    // Cleanup via UI soft delete — hidden from the Active-only default view.
    await page.getByRole("button", { name: "Deactivate", exact: true }).click();
    await expect(page.getByRole("heading", { name: personName })).toBeHidden();
    await expect(page.getByRole("row", { name: personName })).toBeHidden();
  });

  test("workers legacy page renders KPI strip and search", async ({ page }) => {
    await page.goto("/resources");
    for (const label of [
      "Workers in scope",
      "Unavailable right now",
      "Coverage risks to review",
      "Workers with competencies"
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByPlaceholder("Name or employee code")).toBeVisible();
    // Seeded workers render in the grouped rail (the name also appears in
    // form selects, so scope to the rail card button).
    await expect(page.getByRole("button", { name: "Ryan O'Brien" })).toBeVisible();
  });
});
