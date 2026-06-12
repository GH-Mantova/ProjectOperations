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
    await page.getByRole("button", { name: "+ Add waste row" }).click();

    // The new row is the one whose Group select lists every waste group.
    const row = page
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

    // Cleanup through the UI delete control (confirm auto-accepted).
    await row.getByLabel("Delete waste row").click();
    await expect(page.getByLabel("Delete waste row")).toHaveCount(0);
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
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.accept();
    });

    try {
      await openDemCard(page);
      await page.getByRole("button", { name: "Sum from above" }).click();

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
      expect(Number(auto[0].wasteTonnes)).toBeCloseTo(12);
      expect(Number(auto[0].m3)).toBeCloseTo(5);
      expect(auto[0].wasteFacility).toBeTruthy();
      // Line total bills against the facility rate's unit (t or m³).
      expect(Number(auto[0].lineTotal)).toBeGreaterThan(0);

      // Add a manual row, regenerate — confirm dialog fires, AUTO rows are
      // rebuilt, the manual row survives (PR #179).
      const firstAutoId = auto[0].id;
      await page.getByRole("button", { name: "+ Add waste row" }).click();
      await expect
        .poll(async () =>
          (await listWasteRows(request, token, TEMPLATE_CARD_DEM)).filter((r) => !r.autoSummed)
            .length
        )
        .toBe(1);
      await page.getByRole("button", { name: "Sum from above" }).click();
      await expect
        .poll(() => dialogs.some((m) => m.includes("auto-summed waste row")))
        .toBe(true);
      // window.confirm resolves BEFORE the regeneration POST lands — wait
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
    } finally {
      await purgeWasteRows(request, token, TEMPLATE_CARD_DEM);
      await deleteScopeItem(request, token, itemA);
      await deleteScopeItem(request, token, itemB);
    }
  });
});
