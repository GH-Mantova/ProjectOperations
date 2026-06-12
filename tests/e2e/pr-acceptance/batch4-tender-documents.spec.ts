/**
 * Batch 4 — Tender documents (PRs #22, #341)
 *
 * Triage table (full table also in the PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR   | Item (truncated)                                    | Decision
 * -----|-----------------------------------------------------|-----------------
 * #341 | /documents rows under Jobs/Tendering/Assets show    | CONVERT → "documents workspace rail shows
 *      | specific code + name, not generic placeholders      | specific code + name per context"
 * #22  | /documents drill into Job, drag a PDF onto the      | SKIP — pixel-level drag-and-drop assertion
 *      | right pane, slide-over prefills, submit, then       | (flaky per conventions) + SharePoint upload
 *      | "New version" upload                                | round-trip; the deterministic halves (upload
 *      |                                                     | area renders, mock-mode messaging) are
 *      |                                                     | converted below against the tender Documents
 *      |                                                     | panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Extra conversions mandated by the batch prompt (§6 seed coverage):
 *   • The T260520-ACME-Rev1 Overview Documents panel lists the 3 seeded reference
 *     documents (TenderDocumentLink rows from apps/api/prisma/seed.ts).
 *   • Upload area + category selector render for managers.
 *   • SHAREPOINT_MODE=mock: "Open" on a doc without a live webUrl shows the
 *     deterministic "requires SharePoint connection" toast (no Graph call).
 *
 * No residue: every test here is read-only (category select is local state).
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const SEEDED_TENDER_DOCS = [
  "Demolition Plan — Ground Floor (DA-100 Rev C)",
  "Services Layout — Hydraulic + Electrical (ME-200 Rev B)",
  "Asbestos Register / Hazmat Survey — Building A (Rev 2, March 2026)"
];

/** Opens T260520-ACME-Rev1's Overview tab (the Documents panel host) via the register. */
async function openTemplateTenderOverview(page: Page) {
  await page.goto("/tenders");
  await page.getByRole("tab", { name: "Register", exact: true }).click();
  await page.getByPlaceholder("Search number, title, or client").fill("T260520-ACME-Rev1");
  await page.getByText("T260520-ACME-Rev1", { exact: true }).click();
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
}

test.describe("Batch 4 — Tender documents (PRs #22, #341)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("T260520-ACME-Rev1 Overview lists the 3 seeded reference documents with Open buttons", async ({
    page
  }) => {
    await openTemplateTenderOverview(page);
    await expect(page.getByText(/\d+ uploaded/)).toBeVisible();
    for (const title of SEEDED_TENDER_DOCS) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    expect(
      await page.getByRole("button", { name: "Open", exact: true }).count()
    ).toBeGreaterThanOrEqual(SEEDED_TENDER_DOCS.length);
  });

  test("upload area renders with drag & drop hint, accepted types, and category selector", async ({
    page
  }) => {
    await openTemplateTenderOverview(page);
    await expect(page.getByText("Drag & drop files here, or browse")).toBeVisible();
    await expect(page.getByText("PDF, Word, Excel, DWG, PNG, JPG · up to 100 MB")).toBeVisible();

    // PR #64-era category routing selector — switching is local state only.
    const category = page.getByLabel("Document category");
    await expect(category).toBeVisible();
    await category.selectOption({ label: "Drawings" });
    await expect(category).toHaveValue("Drawings");
    await category.selectOption({ label: "Other" });
  });

  test("mock SharePoint mode: Open shows the connection-required toast instead of navigating", async ({
    page
  }) => {
    await openTemplateTenderOverview(page);
    await page.getByRole("button", { name: "Open", exact: true }).first().click();
    await expect(
      page.getByText(
        "Document preview requires SharePoint connection. Contact your administrator to configure SharePoint."
      )
    ).toBeVisible();
  });

  test("documents workspace rail shows specific code + name per context (PR #341)", async ({
    page
  }) => {
    await page.goto("/documents");

    // Groups render expanded by default; rail items resolve entitySummary
    // titles into code + name instead of generic "Jobs (1)" placeholders.
    await expect(page.getByText("Jobs", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Tenders", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Assets", { exact: true }).first()).toBeVisible();

    // Tender context: code + tender name (seeded doc-t002-submission).
    await expect(page.getByText("T260317-SUNC-Rev1", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Maroochydore Precinct — Civil Works", { exact: true }).first()
    ).toBeVisible();

    // Job context: code from doc-j001-* seeds.
    await expect(page.getByText("J260315-QUEE-001", { exact: true }).first()).toBeVisible();
  });
});
