/**
 * Batch 3 — Concrete cutting sheet (PRs #37, #44, #60)
 *
 * Covers the per-card cutting subtable on the CIV card of the seeded
 * T260520-ACME-Rev1 template tender (CIV is used instead of DEM so this file can't
 * contend with the waste/items spec files running against DEM):
 *   • saw cuts — equipment gates elevation/method (Roadsaw Floor-only,
 *     Inverted never offered for saws), Cutrite rate resolution, the
 *     High-Freq/Low-emission 1.25× method multiplier;
 *   • core holes — diameter library lookup, Inverted offered HERE with
 *     2.0× (Wall 1.1×), >650 mm POA;
 *   • per-discipline scoping of cutting lines and the ASB exclusion;
 *   • the rates-admin Cutrite libraries that back all of the above.
 *
 * Selector note: table selects carry no accessible names — they are
 * disambiguated by options only they contain. Numeric inputs (depth/lm/
 * qty) are unlabeled, so priced fixture rows are created via the cutting
 * REST API and the multiplier behaviour is asserted as a line-total RATIO
 * (never a hardcoded $ amount — rates are seed-dependent).
 *
 * Residue: none — cutting rows are purged via API before and after tests.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import {
  apiToken,
  createCuttingItem,
  lastMoney,
  listCuttingItems,
  purgeCuttingItems,
  TEMPLATE_CARD_CIV,
  TEMPLATE_TENDER_ID
} from "./api-helpers";

async function openCivCuttingSheet(page: Page): Promise<void> {
  await page.goto(`/tenders/${TEMPLATE_TENDER_ID}/scope`);
  await expect(page.getByRole("heading", { name: "Scope of Works" })).toBeVisible();
  await page.getByText("Civil works", { exact: true }).first().click();
  await expect(page.getByText("Concrete cutting")).toBeVisible();
}

test.describe("Batch 3 — Concrete cutting sheet (PRs #37, #44, #60)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("saw cut: equipment gates elevation and method — Roadsaw is Floor-only, Inverted is never offered", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeCuttingItems(request, token, TEMPLATE_CARD_CIV);
    page.on("dialog", (dialog) => void dialog.accept());

    await openCivCuttingSheet(page);
    await page.getByRole("button", { name: /^\+ Add saw cut/ }).click();

    // The saw row is the one whose Equipment select lists Tracksaw.
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("option", { name: "Tracksaw" }) });
    await expect(row).toBeVisible();
    const equipment = row
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: "Tracksaw" }) });

    // Demosaw: Wall and Floor are SEPARATE schedule elevations — both
    // offered; Inverted is core-holes-only and must not appear.
    await equipment.selectOption({ label: "Demosaw" });
    const elevation = row
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: "Wall" }) });
    await expect(elevation.getByRole("option", { name: "Floor" })).toHaveCount(1);
    await expect(elevation.getByRole("option", { name: "Inverted" })).toHaveCount(0);
    const method = row
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: "N/A" }) });
    await expect(method.getByRole("option", { name: "High-Freq" })).toHaveCount(1);

    // Roadsaw: elevation collapses to static "Floor" (no select at all);
    // methods are Fuel/Low-emission only.
    await equipment.selectOption({ label: "Roadsaw" });
    await expect(row.getByText("Floor", { exact: true })).toBeVisible();
    await expect(
      row.getByRole("combobox").filter({ has: page.getByRole("option", { name: "Wall" }) })
    ).toHaveCount(0);
    await expect(method.getByRole("option", { name: "Low-emission" })).toHaveCount(1);
    await expect(method.getByRole("option", { name: "High-Freq" })).toHaveCount(0);

    // Cleanup via the row's delete control (confirm auto-accepted).
    await row.getByRole("button", { name: "×" }).click();
    await expect(row).toHaveCount(0);
  });

  test("saw rate resolves from the Cutrite schedule; Low-emission multiplies the line total by 1.25", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeCuttingItems(request, token, TEMPLATE_CARD_CIV);
    try {
      await createCuttingItem(request, token, {
        wbsRef: "CIV1.1",
        itemType: "saw-cut",
        cardId: TEMPLATE_CARD_CIV,
        equipment: "Roadsaw",
        elevation: "Floor",
        material: "Concrete",
        depthMm: 150,
        quantityLm: 20,
        shift: "Day"
      });
      await openCivCuttingSheet(page);
      const row = page
        .getByRole("row")
        .filter({ has: page.getByRole("option", { name: "Tracksaw" }) });
      // Rate + line total resolved from the seeded schedule (structure
      // only — amounts are seed-dependent and never hardcoded).
      await expect(row).toContainText(/\$[\d,]+/);
      const baseline = lastMoney(await row.textContent());
      expect(baseline).toBeGreaterThan(0);

      const method = row
        .getByRole("combobox")
        .filter({ has: page.getByRole("option", { name: "N/A" }) });
      await method.selectOption({ label: "Low-emission" });
      await expect
        .poll(async () => lastMoney(await row.textContent()) / baseline)
        .toBeCloseTo(1.25, 2);
    } finally {
      await purgeCuttingItems(request, token, TEMPLATE_CARD_CIV);
    }
  });

  test("core hole: diameter library lookup; Wall 1.1× and Inverted 2.0× apply HERE; >650 mm is POA", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeCuttingItems(request, token, TEMPLATE_CARD_CIV);
    try {
      await createCuttingItem(request, token, {
        wbsRef: "CIV1.1",
        itemType: "core-hole",
        cardId: TEMPLATE_CARD_CIV,
        diameterMm: 150,
        quantityEach: 4,
        depthMm: 100,
        elevation: "Floor",
        shift: "Day"
      });
      await createCuttingItem(request, token, {
        wbsRef: "CIV1.1",
        itemType: "core-hole",
        cardId: TEMPLATE_CARD_CIV,
        diameterMm: 700,
        quantityEach: 1,
        depthMm: 100,
        elevation: "Floor",
        shift: "Day"
      });
      // Verify both fixtures are queryable through the card-scoped endpoint
      // before driving the UI (separates server state from render state).
      await expect
        .poll(async () => (await listCuttingItems(request, token, TEMPLATE_CARD_CIV)).length)
        .toBe(2);
      await openCivCuttingSheet(page);
      // One reload fallback — under parallel-worker load the dev server has
      // been seen serving a transiently stale (empty) cutting list even
      // though the rows are committed (verified by the poll above).
      try {
        await expect(page.getByRole("button", { name: "Core holes (2)" })).toBeVisible({
          timeout: 5000
        });
      } catch {
        await page.reload();
        await expect(page.getByText("Concrete cutting")).toBeVisible();
        await expect(page.getByRole("button", { name: "Core holes (2)" })).toBeVisible();
      }
      await page.getByRole("button", { name: "Core holes (2)" }).click();

      // The 150 mm row uses the diameter library dropdown ("Custom…"
      // option present); the 700 mm row renders a free input instead.
      const stdRow = page
        .getByRole("row")
        .filter({ has: page.getByRole("option", { name: "Custom…" }) });
      await expect(stdRow).toHaveCount(1);
      await expect(stdRow).toContainText(/\$[\d,]+/);
      const floorTotal = lastMoney(await stdRow.textContent());
      expect(floorTotal).toBeGreaterThan(0);

      // Inverted IS offered for core holes — the saw-cut spec asserts it
      // is absent there.
      const elevation = stdRow
        .getByRole("combobox")
        .filter({ has: page.getByRole("option", { name: "Inverted" }) });
      await expect(elevation).toHaveCount(1);

      await elevation.selectOption({ label: "Wall" });
      await expect
        .poll(async () => lastMoney(await stdRow.textContent()) / floorTotal)
        .toBeCloseTo(1.1, 2);
      await elevation.selectOption({ label: "Inverted" });
      await expect
        .poll(async () => lastMoney(await stdRow.textContent()) / floorTotal)
        .toBeCloseTo(2.0, 2);

      // >650 mm: manual pricing — POA flag, no line total.
      await expect(page.getByRole("row").filter({ hasText: "POA" })).toBeVisible();
    } finally {
      await purgeCuttingItems(request, token, TEMPLATE_CARD_CIV);
    }
  });

  test("cutting lines are scoped to the active discipline card; ASB card has no cutting sheet", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeCuttingItems(request, token, TEMPLATE_CARD_CIV);
    try {
      await createCuttingItem(request, token, {
        wbsRef: "CIV1.1",
        itemType: "saw-cut",
        cardId: TEMPLATE_CARD_CIV,
        equipment: "Roadsaw",
        elevation: "Floor",
        material: "Concrete",
        depthMm: 50,
        quantityLm: 5,
        shift: "Day"
      });
      // Confirm the fixture is queryable through the card-scoped endpoint
      // before asserting the UI — separates a server-side issue from a
      // stale render if the count below ever mismatches.
      await expect
        .poll(async () => (await listCuttingItems(request, token, TEMPLATE_CARD_CIV)).length)
        .toBe(1);
      await openCivCuttingSheet(page);
      await expect(page.getByText(/Showing items linked to CIV scope/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Saw cuts (1)" })).toBeVisible();

      // DEM card: the CIV row is filtered out.
      await page.getByText("Demolition", { exact: true }).first().click();
      await expect(page.getByText(/Showing items linked to DEM scope/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Saw cuts (0)" })).toBeVisible();

      // ASB card: no cutting sheet at all (asbestos work is never priced
      // through the cutting schedule).
      await page.getByText("Asbestos removal", { exact: true }).first().click();
      await expect(page.getByText(/ASB — Waste disposal/)).toBeVisible();
      await expect(page.getByText("Concrete cutting")).toHaveCount(0);
    } finally {
      await purgeCuttingItems(request, token, TEMPLATE_CARD_CIV);
    }
  });

  test("rates admin exposes the Cutrite Saw Cutting and Core holes libraries (PR #37, read-only)", async ({
    page
  }) => {
    await page.goto("/admin/estimate-rates");
    // Non-zero row counts in the tab labels prove the libraries seeded.
    await page.getByText(/Saw Cutting \([1-9]\d*\)/).click();
    await expect(page.getByText("Roadsaw").first()).toBeVisible();
    await page.getByText(/Core holes \([1-9]\d*\)/).click();
    await expect(page.getByText("650", { exact: true }).first()).toBeVisible();
    // Inline click-edit is intentionally NOT exercised — mutating shared
    // rate-library rows would skew every other pricing assertion.
  });
});
