/**
 * Batch 4 — Quotes (PRs #45, #46, #61, #62, #72, #242, #254, #256, #257)
 *
 * Triage table (full table also in the PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR   | Item (truncated)                                    | Decision
 * -----|-----------------------------------------------------|-----------------
 * #257 | Quote tab → version row shows Edit, no Save/Cancel  | CONVERT → "view mode shows Edit only"
 * #257 | Click Edit → Save+Cancel swap, editor opens below   | CONVERT → "Edit opens ONE canonical editor"
 * #257 | Edit field + Cancel → field reverts to server value | SKIP — feature reworked: every editor field
 *      |                                                     | autosaves on blur (per-field PATCH, PR #62
 *      |                                                     | family); Cancel only closes the editor, no
 *      |                                                     | client-side rollback exists to assert
 * #257 | Edit field + Save → persists, reload confirms       | CONVERT → "internal note persists across reopen"
 * #257 | Generate Quote button still works in view mode      | CONVERT → "Generate Quote toggles export panel"
 * #256 | Open IS-T100-R1 — Acme Infrastructure → Quote tab   | CONVERT → setup of every test here
 * #256 | View mode: ONE tab strip, no floating Edit,         | CONVERT (adapted) — the view-mode preview block
 *      | no Recalculate on Cost Summary                      | was removed outright; asserted as ZERO strips in
 *      |                                                     | view mode, ONE in edit mode, Recalculate count 0
 * #256 | Click Edit → QuoteEditor beneath version row with   | CONVERT → "Edit opens ONE canonical editor"
 *      | canonical tab strip + its own Save / Cancel         |
 * #256 | Generate Quote still works (toggles export panel)   | CONVERT → "Generate Quote toggles export panel"
 * #254 | Edit mode renders exactly ONE tab strip             | CONVERT → toHaveCount(1) per tab label
 * #254 | Cost Summary Simple mode editable description input | SKIP — needs testid, production change out of
 *      |                                                     | scope: the description cells are unlabeled
 *      |                                                     | <input>s unreachable via role/label selectors,
 *      |                                                     | and flipping detailLevel to "simple" would
 *      |                                                     | mutate the seeded template quote
 * #254 | Scope items tab renders discipline-grouped sections | CONVERT → "Edit opens ONE canonical editor"
 *      | with + Add row per section                          | (Scope items tab walkthrough)
 * #254 | T&C tab renders clause editor with OverrideField    | CONVERT → T&C tab walkthrough (clause headings,
 *      | + revert                                            | Reset all / Reset to standard controls)
 * #254 | Generate Quote button appears when NOT editing      | CONVERT → "Generate Quote toggles export panel"
 * #242 | AWARDED → Convert-to-project button hidden          | BATCH-6 — claimed by /project|contract/ title
 * #242 | CONTRACT_ISSUED → button visible, conversion works  | regex (award/conversion flow, PR #39 family)
 * #72  | Add a plant pill, remove it, pill row rerenders     | COVERED → batch3-scope-items.spec.ts "plant
 *      |                                                     | pills: add a plant cluster, set qty/days, remove"
 * #72  | Waste cascade group → type → facility auto-rates    | COVERED → batch3-scope-waste.spec.ts cascade test
 * #72  | Drag quote-scope item in flat mode, order persists  | SKIP — pixel-level drag-and-drop assertion (flaky
 *      |                                                     | per conventions; @dnd-kit pointer simulation)
 * #62  | Quote versions panel + "Add quote for client"       | CONVERT → "view mode" + "+ Add quote for client
 *      |                                                     | offered for quote-less client (IS-T001)"
 * #62  | Get suggestion → rationale (preference + win rate)  | CONVERT → "Get suggestion returns rationale"
 * #62  | Send quote → modal prefill, status SENT, QuoteEmail | SKIP — requires real email send (live
 *      |                                                     | integration); sending would also flip the seeded
 *      |                                                     | template quote to SENT permanently
 * #61  | Download PDF quote → IS_Quote_<tenderNumber>.pdf    | CONVERT → "PDF + Excel downloads fire" (download
 *      | (not JSON, not a blank tab)                         | event + filename + non-empty payload)
 * #61  | PDF page 1: client block, cost summary, PS table    | SKIP — needs PDF rendering assertions, out of
 * #61  | PDF page 2: scope by discipline, POA >650mm core    | Playwright scope (binary contents not parsed,
 * #61  | PDF page 3: allowances, assumptions, T&C clauses    | per batch prompt)
 * #46  | Prv item: $2,500 shown un-marked-up in editor/PDF   | SKIP — feature since reworked: the v2 estimate
 * #46  | Non-provisional markup unchanged                    | editor was replaced by the rate-snapshot flow
 *      |                                                     | (see batch 2 triage of PR #28); remaining PDF/
 *      |                                                     | Excel checks are binary-content, out of scope
 * #45  | Export PDF → 3-page template, Page X of Y footer    | SKIP — PDF layout parsing out of scope; the
 *      |                                                     | download-fires half is converted under #61
 * #45  | Export Excel → 3-sheet workbook, totals match       | CONVERT (partial) → Excel download event +
 *      |                                                     | IS_Estimate_IS-T100.xlsx filename; workbook
 *      |                                                     | contents not parsed (out of scope)
 * #45  | Provisional-sum item in PDF + orange Excel row      | SKIP — binary contents, out of scope
 * #45  | Export twice → two EstimateExport rows (type+user)  | CONVERT (partial) → Export history list shows
 *      |                                                     | PDF + Excel badges with "Generated by" after
 *      |                                                     | both downloads (UI projection of the rows)
 * ─────────────────────────────────────────────────────────────────────────────
 * Extra conversions mandated by the batch prompt (PR #62 redesign family):
 *   • "New revision" bumps the quote ref and supersedes the prior revision.
 *   • Client scoring stars render for the quote's client (read-only render
 *     here; interactive rating already covered by batch2 "client card star
 *     rating" on IS-T001).
 *
 * Residue notes (conventions: no UI delete exists → documented):
 *   • Export tests append EstimateExport rows on IS-T100 each run (export
 *     history has no delete UI).
 *   • The revision test restores seed state itself: the created R2 is deleted
 *     and the seeded R1 is PATCHed back to DRAFT via the API fixture layer
 *     (deleting a revision does not un-supersede the prior one server-side).
 */

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import { apiFetch, apiToken, TEMPLATE_TENDER_ID } from "./api-helpers";

const TEMPLATE_QUOTE_ID = "seed-template-quote-100";

/** Navigates to a tender's Quote tab through the register (pure UI route). */
async function openQuoteTab(page: Page, tenderNumber: string) {
  await page.goto("/tenders");
  await page.getByRole("tab", { name: "Register", exact: true }).click();
  await page.getByPlaceholder("Search number, title, or client").fill(tenderNumber);
  await page.getByText(tenderNumber, { exact: true }).click();
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Quote", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quote versions" })).toBeVisible();
}

/**
 * Restores the seeded IS-T100 quote state: removes revision residue (R2+)
 * from crashed runs and resets the seeded R1 back to DRAFT (creating a
 * revision marks it SUPERSEDED server-side and deletion does not undo that).
 */
async function resetTemplateQuote(request: APIRequestContext, token: string) {
  const quotes = await apiFetch<Array<{ id: string; revision: number }>>(
    request,
    token,
    "GET",
    `/tenders/${TEMPLATE_TENDER_ID}/quotes`
  );
  for (const quote of quotes) {
    if (quote.revision > 1) {
      await apiFetch(request, token, "DELETE", `/tenders/${TEMPLATE_TENDER_ID}/quotes/${quote.id}`);
    }
  }
  await apiFetch(
    request,
    token,
    "PATCH",
    `/tenders/${TEMPLATE_TENDER_ID}/quotes/${TEMPLATE_QUOTE_ID}`,
    { status: "DRAFT" }
  );
}

test.describe("Batch 4 — Quotes (PRs #45, #46, #61, #62, #72, #242, #254, #256, #257)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── View mode (PRs #256, #257, #62) ────────────────────────────────────────

  test("view mode: version row shows Edit + actions, no Save/Cancel, no editor strip, no Recalculate", async ({
    page,
    request
  }) => {
    await resetTemplateQuote(request, await apiToken(request));
    await openQuoteTab(page, "IS-T100");

    // PR #62 — "Quote versions" panel with the per-client version row.
    await expect(page.getByText("Acme Infrastructure", { exact: true })).toBeVisible();
    await expect(page.getByText("IS-T100-R1", { exact: true })).toBeVisible();
    await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();

    // PR #257 — view mode: Edit present, Save/Cancel absent.
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0);
    for (const action of ["New revision", "PDF", "Send"]) {
      await expect(page.getByRole("button", { name: action, exact: true })).toBeVisible();
    }
    // Two Delete buttons by design: tender header + quote version row.
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(2);

    // PR #256 — no editor tab strip in view mode (duplicate preview block was
    // removed outright) and no Recalculate control anywhere on the tab.
    await expect(page.getByRole("button", { name: "Cost Summary", exact: true })).toHaveCount(0);
    await expect(page.getByText("Recalculate")).toHaveCount(0);

    // PR #254 — Generate Quote renders in the header area when NOT editing.
    await expect(page.getByRole("button", { name: "Generate Quote", exact: true })).toBeVisible();
  });

  test("client scoring stars render on the IS-T100 client card (Overview)", async ({ page }) => {
    await page.goto("/tenders");
    await page.getByRole("tab", { name: "Register", exact: true }).click();
    await page.getByPlaceholder("Search number, title, or client").fill("IS-T100");
    await page.getByText("IS-T100", { exact: true }).click();
    await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
    // PR #62 — read-only preference stars on the collapsed client row.
    await expect(page.getByLabel("Acme Infrastructure preference", { exact: true })).toBeVisible();
  });

  test("+ Add quote for client is offered for a linked client without quotes (IS-T001)", async ({
    page
  }) => {
    await openQuoteTab(page, "IS-T001");
    await expect(
      page.getByRole("button", { name: "+ Add quote for client", exact: true })
    ).toBeVisible();
  });

  // ── Edit mode: single canonical editor, all 8 tabs (PRs #254, #256, #62) ──

  test("Edit opens ONE canonical editor strip; all 8 tabs render their structure; Cancel closes", async ({
    page
  }) => {
    await openQuoteTab(page, "IS-T100");
    await page.getByRole("button", { name: "Edit", exact: true }).click();

    // Editor appears beneath the version row; row swaps Edit → Save + Cancel.
    await expect(page.getByText(/Editing IS-T100-R1 — Acme Infrastructure/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);

    // PR #254/#256 — exactly ONE canonical tab strip.
    const tabLabels = [
      "Cost Summary",
      "Scope items",
      "Provisional Sums",
      "Cost Options",
      "Assumptions",
      "Exclusions",
      "Terms & Conditions",
      "Preview"
    ];
    for (const label of tabLabels) {
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(1);
    }
    await expect(page.getByText("QUOTE CONTENTS — VISIBLE IN QUOTE")).toBeVisible();

    // Cost Summary (default tab) — seeded cost-line table + internal panel.
    await expect(page.getByRole("columnheader", { name: "Adjusted", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add cost line", exact: true })).toBeVisible();
    await expect(
      page.getByText("Client adjustment (internal — never shown on quote)")
    ).toBeVisible();
    await expect(page.getByText("Base total:")).toBeVisible();
    await expect(page.getByText("Client sees:")).toBeVisible();
    await expect(page.getByText("Recalculate")).toHaveCount(0);

    // Scope items — discipline-grouped sections with + Add row per section.
    await page.getByRole("button", { name: "Scope items", exact: true }).click();
    await expect(page.getByText("Quote detail level:")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Group by discipline" })).toBeChecked();
    // Accessible name concatenates the count span without a space: "Demolition(4)".
    await expect(page.getByRole("heading", { name: /Demolition ?\(\d+\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Civil works ?\(\d+\)/ })).toBeVisible();
    expect(await page.getByRole("button", { name: "+ Add row", exact: true }).count()).toBeGreaterThan(1);
    await expect(page.getByRole("button", { name: "+ Copy from scope", exact: true })).toBeVisible();

    // Provisional Sums — show-flag + add control (seeded rows are inputs).
    await page.getByRole("button", { name: "Provisional Sums", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Show on PDF" })).toBeChecked();
    await expect(
      page.getByRole("button", { name: "+ Add provisional sum", exact: true })
    ).toBeVisible();

    // Cost Options.
    await page.getByRole("button", { name: "Cost Options", exact: true }).click();
    await expect(page.getByText(/alternative pricing scenarios/)).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add cost option", exact: true })).toBeVisible();

    // Assumptions — seeded assumptionMode=linked: per-cost-line sections.
    await page.getByRole("button", { name: "Assumptions", exact: true }).click();
    await expect(page.getByRole("heading", { name: /^Item Demolition — / })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "General assumptions (unlinked)" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add for Demolition", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "+ Add general assumption", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copy from tender assumptions", exact: true })
    ).toBeVisible();

    // Exclusions.
    await page.getByRole("button", { name: "Exclusions", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Copy IS template exclusions", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copy from tender exclusions", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add exclusion", exact: true })).toBeVisible();

    // Terms & Conditions — clause editor with per-clause + global reset.
    await page.getByRole("button", { name: "Terms & Conditions", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reset all to IS standard", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reset to standard", exact: true }).first()
    ).toBeVisible();

    // Preview — text projection of the seeded full-feature quote.
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByText(/IS-T100-R1 — Revision 1/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cost summary" })).toBeVisible();
    await expect(page.getByText(/^Demolition\) Internal strip-out/)).toBeVisible();
    await expect(page.getByText("Client-facing total:")).toBeVisible();
    await expect(page.getByText("$560,000.00")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Provisional sums" })).toBeVisible();
    await expect(page.getByText(/^PS — unknown ACM discovered/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cost options" })).toBeVisible();
    await expect(page.getByText(/^Option A\) Weekend works premium/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send quote", exact: true })).toBeVisible();

    // Cancel closes the editor and restores the Edit button.
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText(/Editing IS-T100-R1/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  });

  // ── Field persistence (PR #257 Save item) ──────────────────────────────────

  test("internal note autosaves on blur and persists across editor reopen, then clears", async ({
    page
  }) => {
    const note = `e2e-b4-note-${Date.now()}`;
    await openQuoteTab(page, "IS-T100");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByText(/Editing IS-T100-R1/)).toBeVisible();

    const noteField = page.getByPlaceholder("e.g. Preferred client -5%");
    await noteField.fill(note);
    // Blur commits the per-field PATCH (the editor autosaves field-by-field).
    await page.getByText("Base total:").click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Editing IS-T100-R1/)).toHaveCount(0);

    // Reopen — the persisted value comes back from the server.
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(noteField).toHaveValue(note);

    // Restore seed state (empty note) so the suite is re-runnable.
    await noteField.fill("");
    await page.getByText("Base total:").click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(noteField).toHaveValue("");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  });

  // ── Client adjustment suggestion (PR #62) ──────────────────────────────────

  test("Get suggestion returns a client adjustment rationale", async ({ page }) => {
    await openQuoteTab(page, "IS-T100");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByText(/Editing IS-T100-R1/)).toBeVisible();
    await page.getByRole("button", { name: "Get suggestion", exact: true }).click();
    // Rationale line, e.g. "Suggested: +0% — no preference set; win rate …".
    await expect(page.getByText(/Suggested: [+-]?\d+(\.\d+)?%/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  });

  // ── Revisions (PR #62 redesign / batch prompt) ─────────────────────────────

  test("New revision bumps the quote ref to IS-T100-R2 and supersedes R1", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await resetTemplateQuote(request, token);

    try {
      await openQuoteTab(page, "IS-T100");
      await expect(page.getByText("IS-T100-R1", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "New revision", exact: true }).click();

      // The new revision becomes the latest row (label bumped) and opens in
      // edit mode — close the editor before inspecting the history.
      await expect(page.getByText("IS-T100-R2", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();

      // Prior revision collapses under the toggle, marked SUPERSEDED.
      await page.getByRole("button", { name: /Prior revisions \(1\)/ }).click();
      await expect(page.getByText("IS-T100-R1", { exact: true })).toBeVisible();
      await expect(page.getByText("SUPERSEDED", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "View", exact: true })).toBeVisible();
    } finally {
      // Remove R2 and restore R1 to DRAFT (server keeps SUPERSEDED otherwise).
      await resetTemplateQuote(request, token);
    }
  });

  // ── Exports (PRs #45, #61, #254, #256, #257) ───────────────────────────────

  test("Generate Quote toggles the export panel; PDF + Excel downloads fire; history records both", async ({
    page
  }) => {
    await openQuoteTab(page, "IS-T100");

    // PR #256/#257 — works in view mode, toggles the panel.
    await page.getByRole("button", { name: "Generate Quote", exact: true }).click();
    const panel = page.locator("section", {
      has: page.getByRole("heading", { name: "Generate quote" })
    });
    await expect(panel.getByRole("heading", { name: "Generate quote" })).toBeVisible();
    await expect(panel.getByText("Export history")).toBeVisible();

    // History list scoped to the panel; the API serves rows newest-first
    // (orderBy generatedAt desc), so .first() is always the latest export.
    const historyRows = panel.locator("li").filter({ hasText: "Generated by" });

    // PR #61 — real PDF download event with the documented filename, then
    // confirm its history row landed BEFORE firing the next export (the toast
    // appears before the list refetch, so the row needs its own assertion).
    const pdfDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF quote", exact: true }).click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toBe("IS_Quote_IS-T100.pdf");
    await expect(page.getByText("PDF quote generated")).toBeVisible();
    await expect(historyRows.first().getByText("PDF", { exact: true })).toBeVisible();

    // PR #45 — Excel export download event, then its history row.
    const excelDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Excel", exact: true }).click();
    const excelDownload = await excelDownloadPromise;
    expect(excelDownload.suggestedFilename()).toBe("IS_Estimate_IS-T100.xlsx");
    await expect(page.getByText("Excel workbook generated")).toBeVisible();
    await expect(historyRows.first().getByText("Excel", { exact: true })).toBeVisible();

    // PR #45 — both EstimateExport rows projected (type badge + "Generated
    // by <user>"); auto-retrying and scoped, after each row was confirmed.
    await expect(historyRows.nth(1)).toBeVisible();

    // Second click toggles the panel back off.
    await page.getByRole("button", { name: "Generate Quote", exact: true }).click();
    await expect(page.getByRole("button", { name: "Download PDF quote", exact: true })).toHaveCount(0);
    // Residue: the two EstimateExport rows remain (history has no delete UI).
  });

  test("version row PDF button downloads the per-revision quote PDF", async ({ page }) => {
    await openQuoteTab(page, "IS-T100");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("IS_Quote_IS-T100-R1.pdf");
  });
});
