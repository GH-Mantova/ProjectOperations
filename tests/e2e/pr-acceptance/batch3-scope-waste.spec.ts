/**
 * Batch 3 — Scope of Works waste subtable (PRs #72, #176, #179, #180)
 *
 * Covers the per-card waste disposal subtable on the DEM card of the
 * seeded T260520-ACME-Rev1 template tender: the manual-row disposal cascade
 * (Group → Type → Facility narrowing with rate/unit auto-fill) and the
 * "Sum from above" aggregator (AUTO rows, one per (group, item),
 * regeneration confirm dialog, manual-row preservation).
 *
 * Selector note: the subtable's selects carry no accessible names, so they
 * are disambiguated by the options only they contain (role=combobox
 * filtered by a role=option locator). Numeric cells (tonnes/m³/loads/$)
 * are unlabeled inputs; quantities and rates are asserted through the
 * waste REST endpoint the UI itself writes to.
 *
 * SCOPE_WASTE_SECTION_V1 (slice 8) — the section was rebuilt in the visual
 * language of the sections either side of it: it is now collapsible, with a
 * summary that stays readable while shut (line count in words, subtotal, and
 * the "+ N% markup" figure). The two action buttons were renamed to
 * "+ add a waste line" and "⇩ Sum from items above", and are addressed here
 * by data-testid rather than by label, so a future copy change cannot break
 * the suite the way a renamed label just did.
 *
 * What the slice deliberately did NOT change: the money. Waste is priced as
 * its OWN independently marked-up cost stream on the server
 * (scope-redesign.service.ts summary(): tenderPrice = scopeWithMarkupTotal +
 * cuttingWithMarkup + wasteWithMarkup), and is never folded into the scope
 * discipline total or the card subtotal. No assertion in this file about a
 * waste figure changed, because no waste figure changed.
 *
 * Residue: none — waste rows are purged via API before and after each
 * test, fixture scope items are deleted in finally blocks.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import {
  apiToken,
  createScopeItem,
  deleteScopeItem,
  listWasteRows,
  purgeScopeItemsByPrefix,
  purgeWasteRows,
  TEMPLATE_CARD_DEM,
  TEMPLATE_TENDER_ID
} from "./api-helpers";

async function openDemCard(page: Page): Promise<void> {
  await page.goto(`/tenders/${TEMPLATE_TENDER_ID}/scope`);
  await expect(page.getByRole("heading", { name: "Scope of Works" })).toBeVisible();
  // DEM ("Demolition") is the first card and active by default.
  await expect(page.getByText(/DEM — Waste disposal/)).toBeVisible();
}

test.describe("Batch 3 — Scope of Works waste subtable (PRs #72, #176, #179, #180)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("manual waste row: Group → Type → Facility cascade narrows options and auto-fills the rate/unit", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeWasteRows(request, token, TEMPLATE_CARD_DEM);
    page.on("dialog", (dialog) => void dialog.accept());

    await openDemCard(page);
    await page.getByTestId("waste-add-line").click();

    // The new row is the one whose Group select lists every waste group.
    // SCOPE_WBS_TABLE_V1: the WBS item table now renders a per-item
    // "Waste group" select from the same wasteGroupOptions, so a page-wide
    // getByRole("row") matches scope-item rows as well as waste rows.
    // Scope to the waste subtable - the table that is not "WBS items".
    const wasteTable = page.locator('table:not([aria-label="WBS items"])');
    const row = wasteTable
      .getByRole("row")
      .filter({ has: page.getByRole("option", { name: "Vegetation" }) });
    await expect(row).toBeVisible();

    const group = row
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: "Vegetation" }) });
    await group.selectOption({ label: "Rubble" });

    // Type select narrows to the Rubble types — other groups' types are gone.
    const type = row
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: "Concrete/Brick — mixed" }) });
    await expect(type.getByRole("option", { name: "Concrete — clean" })).toHaveCount(1);
    await expect(type.getByRole("option", { name: "Green waste" })).toHaveCount(0);
    await type.selectOption({ label: "Concrete/Brick — mixed" });

    // Facility narrows to the (group, type) pair — Alex Fraser only.
    const facility = row
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: "Alex Fraser" }) });
    await expect(facility.getByRole("option", { name: "BMI Acacia Ridge" })).toHaveCount(0);
    await facility.selectOption({ label: "Alex Fraser" });

    // "Billed by" badge carries the facility rate's unit forward (m³ here).
    await expect(row.getByText("m³", { exact: true })).toBeVisible();

    // PR #72 — the rate auto-populates from the rate card. The $/unit cell
    // is an unlabeled input, so assert the persisted row server-side.
    await expect
      .poll(async () => {
        const rows = await listWasteRows(request, token, TEMPLATE_CARD_DEM);
        const saved = rows.find((r) => r.wasteFacility === "Alex Fraser");
        return saved ? { unit: saved.unit, rate: Number(saved.ratePerTonne) > 0 } : null;
      })
      .toEqual({ unit: "m³", rate: true });

    // Cleanup through the UI delete control — the delete confirm is now the
    // in-app ConfirmDialog (useConfirm), not window.confirm.
    await row.getByLabel("Delete waste row").click();
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByLabel("Delete waste row")).toHaveCount(0);
  });

  // SCOPE_WASTE_SECTION_V1 — the section is now collapsible, and the summary
  // has to stay readable while it is shut. A card that disposes of nothing
  // should be one folded line, not a screenful of empty fields.
  test("the waste section folds, and the collapsed summary still carries the line count and both money figures", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeWasteRows(request, token, TEMPLATE_CARD_DEM);

    await openDemCard(page);

    const summary = page.getByTestId("waste-section-summary");
    const caret = page.getByTestId("waste-section-caret");
    const body = page.locator("#waste-section-body");

    // Opens expanded: the body is there and the caret says so.
    await expect(summary).toBeVisible();
    await expect(body).toBeVisible();
    await expect(caret).toHaveAttribute("aria-expanded", "true");

    // With no lines, the count reads in words rather than "(0 rows)".
    await expect(page.getByTestId("waste-section-line-count")).toContainText("no lines");

    // Both money figures are present before the fold...
    const subtotal = page.getByTestId("waste-section-subtotal");
    const withMarkup = page.getByTestId("waste-section-with-markup");
    const markupLabel = page.getByTestId("waste-section-markup-label");
    await expect(subtotal).toBeVisible();
    await expect(withMarkup).toBeVisible();
    await expect(markupLabel).toContainText(/^\+ [\d.]+% markup$/);
    const subtotalText = await subtotal.textContent();
    const withMarkupText = await withMarkup.textContent();

    // Fold it.
    await caret.click();
    await expect(caret).toHaveAttribute("aria-expanded", "false");
    await expect(body).toHaveCount(0);

    // ...and unchanged after it. This is the whole point of the summary.
    await expect(summary).toBeVisible();
    await expect(page.getByTestId("waste-section-line-count")).toContainText("no lines");
    await expect(subtotal).toHaveText(subtotalText ?? "");
    await expect(withMarkup).toHaveText(withMarkupText ?? "");
    await expect(markupLabel).toContainText(/^\+ [\d.]+% markup$/);

    // Unfold restores the body.
    await caret.click();
    await expect(caret).toHaveAttribute("aria-expanded", "true");
    await expect(body).toBeVisible();
  });

  test("Sum from above aggregates flagged items into one AUTO row per (group, item); regeneration preserves manual rows", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    // Clear residue from a previously CRASHED run — orphan flagged items
    // would otherwise inflate the aggregated tonnes below.
    await purgeScopeItemsByPrefix(request, token, "e2e-b3-waste-");
    await purgeWasteRows(request, token, TEMPLATE_CARD_DEM);
    const run = Date.now();
    // Two flagged items sharing (Rubble, Concrete — clean) must collapse
    // into a single auto-summed row with tonnes 5+7=12 and m³ 2+3=5.
    const itemA = await createScopeItem(request, token, TEMPLATE_CARD_DEM, `e2e-b3-waste-a-${run}`, {
      wasteIncluded: true,
      wasteGroup: "Rubble",
      wasteItem: "Concrete — clean",
      tonnes: 5,
      m3: 2
    });
    const itemB = await createScopeItem(request, token, TEMPLATE_CARD_DEM, `e2e-b3-waste-b-${run}`, {
      wasteIncluded: true,
      wasteGroup: "Rubble",
      wasteItem: "Concrete — clean",
      tonnes: 7,
      m3: 3
    });
    try {
      await openDemCard(page);
      await page.getByTestId("waste-sum-from-above").click();

      // One AUTO row per (group, item), facility + rate filled, total billed.
      // API assertions filter to THIS test's (Rubble) aggregation so another
      // spec file's transiently flagged items can never skew them.
      const rubbleAuto = async () =>
        (await listWasteRows(request, token, TEMPLATE_CARD_DEM)).filter(
          (r) => r.autoSummed && r.wasteGroup === "Rubble"
        );
      await expect(page.getByText("AUTO", { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: "AUTO" }).first()).toContainText(
        /\$[\d,]+/
      );
      const auto = await rubbleAuto();
      expect(auto).toHaveLength(1);
      expect(Number(auto[0].qty)).toBeCloseTo(12);
      expect(Number(auto[0].m3)).toBeCloseTo(5);
      expect(auto[0].wasteFacility).toBeTruthy();
      // Line total bills against the facility rate's unit (t or m³).
      expect(Number(auto[0].lineTotal)).toBeGreaterThan(0);

      // Add a manual row, regenerate — confirm dialog fires, AUTO rows are
      // rebuilt, the manual row survives (PR #179).
      const firstAutoId = auto[0].id;
      await page.getByTestId("waste-add-line").click();
      await expect
        .poll(async () =>
          (await listWasteRows(request, token, TEMPLATE_CARD_DEM)).filter((r) => !r.autoSummed)
            .length
        )
        .toBe(1);
      await page.getByTestId("waste-sum-from-above").click();
      // The regeneration confirm is now the in-app ConfirmDialog (useConfirm).
      const regenDialog = page.getByTestId("confirm-dialog");
      await expect(regenDialog).toContainText("auto-summed waste line");
      await page.getByTestId("confirm-dialog-confirm").click();
      // The confirm resolves BEFORE the regeneration POST lands — wait
      // for the rebuilt AUTO row (new id) so assertions and cleanup can't
      // race the server-side deleteMany/create transaction.
      await expect
        .poll(async () => {
          const regen = await rubbleAuto();
          return regen.length === 1 && regen[0].id !== firstAutoId;
        })
        .toBe(true);
      // Manual row survived the regeneration.
      expect(
        (await listWasteRows(request, token, TEMPLATE_CARD_DEM)).filter((r) => !r.autoSummed)
      ).toHaveLength(1);
      await expect(page.getByText("AUTO", { exact: true }).first()).toBeVisible();

      // SCOPE_WASTE_SECTION_V1 — the second press must not DOUBLE the
      // tonnage. The aggregator replaces its own rows (deleteMany where
      // autoSummed=true, then create) rather than appending to them, so
      // after a regeneration the card still holds ONE Rubble row carrying
      // 5+7=12 t and 2+3=5 m3 — not two rows, and not 24 t.
      const afterRegen = await rubbleAuto();
      expect(afterRegen).toHaveLength(1);
      expect(Number(afterRegen[0].qty)).toBeCloseTo(12);
      expect(Number(afterRegen[0].m3)).toBeCloseTo(5);
    } finally {
      await purgeWasteRows(request, token, TEMPLATE_CARD_DEM);
      await deleteScopeItem(request, token, itemA);
      await deleteScopeItem(request, token, itemB);
    }
  });
});
