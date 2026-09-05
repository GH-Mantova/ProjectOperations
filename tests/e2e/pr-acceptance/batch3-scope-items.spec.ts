/**
 * Batch 3 — Scope of Works item cards (PRs #43, #44, #60, #72, #175, #176, #180, #241)
 *
 * Covers the scope-item card surface of the Scope of Works tab on the
 * seeded T260520-ACME-Rev1 template tender: discipline card tabs, per-item $ totals
 * and footer consistency (B1.7.x), the B4a dimension-derivation chain
 * (L/H/D/density → sqm/m³/tonnes with explicit overrides), editable
 * classification cells, and plant.
 *
 * SCOPE_PLANT_PERSIST_V1 — the plant coverage moved off the legacy "plant
 * pills" (the PlantCluster inside the Measurement cell, retired in
 * pr-cardpersist-s2) and onto the Plant column group, which is now the only
 * plant UI and the one that persists. See the ported test at the bottom for
 * the control-by-control mapping.
 *
 * SCOPE_WBS_ACTIONS_V1 (PR #1646) — the measurement fields and the item
 * note are no longer painted on every row. They moved into the
 * `WbsMeasurementBlock` / `WbsCommentBlock` expandables, opened from the
 * actions column, and the slice's requirement is that NOTHING opens by
 * default. So each test below now proves a PAIR: the control is absent at
 * rest (toHaveCount(0)), and carries exactly the value it always had once
 * the disclosure is opened. Every expected value is unchanged.
 *
 * Selector note: the dimension inputs for Length/Height/Depth used to have
 * no accessible name and were read through their title attributes. The
 * relocated block gives every measurement control an explicit, row-numbered
 * aria-label (`Measurement 1 sqm`, …), so the constants below are those
 * aria-labels. Same three inputs, same derivation chain — only the name they
 * answer to changed, and it changed in the component, not here.
 *
 * Residue: none — every fixture item is deleted in a finally block, and
 * `pnpm seed` fully resets T260520-ACME-Rev1 scope items regardless.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import {
  apiFetch,
  apiToken,
  createScopeItem,
  deleteScopeItem,
  lastMoney,
  purgeScopeItemsByPrefix,
  TEMPLATE_CARD_DEM,
  TEMPLATE_TENDER_ID
} from "./api-helpers";

// Accessible names of the derived-dimension inputs inside the Measurement
// expandable. Explicit aria-labels on the block's row 1, so they are stable
// and they do not collide with an extra measurement's row 2 controls.
const SQM_NAME = "Measurement 1 sqm";
const M3_NAME = "Measurement 1 m3";
const TONNES_NAME = "Measurement 1 tonnes";

// Accessible names of the classification controls, also inside the
// Measurement expandable. Row 1's ticks and material select carry BARE names
// while rows 2..N carry "Measurement N …", so every assertion on these three
// passes { exact: true } — a substring match would go ambiguous the moment a
// second measurement exists on the item.
//
// SCOPE_WBS_REVEAL_V1 — the helper below no longer appends a row 2, so these
// three are no longer AMBIGUOUS without `exact`. They keep it anyway: the
// names below are what row 1 is actually called, `exact: true` still matches
// exactly that, and dropping it would silently widen every one of these
// assertions to any future control whose name merely contains the string —
// including the row 2 that `+ Add measurement` still appends whenever the
// block is already open. Tightening is safe here; loosening buys nothing.
const MATERIAL_TYPE = "Material type";
const WASTE_FLAG = "Include in waste summary";
const CUTTING_FLAG = "Include in cutting summary";
// These two ARE row-numbered on row 1, so they are already unambiguous.
const WASTE_GROUP = "Measurement 1 waste group";
const WASTE_ITEM = "Measurement 1 waste item";

// The actions-column button that opens the Measurement expandable, matched as
// a substring of its accessible name because a button that has something to
// show appends a "✓ n" count to its own label.
//
// SCOPE_WBS_REVEAL_V1 — the button reads "Show measurements" while the block
// is SHUT and the item already carries one, and "+ Add measurement" only once
// the block is open (where the next click really does add). Every fixture this
// helper is used on is created WITH a measurement and every block starts shut,
// so the opener is always in its reveal state and this is the name to click.
const SHOW_MEASUREMENTS = "Show measurements";

async function openScopeTab(page: Page): Promise<void> {
  await page.goto(`/tenders/${TEMPLATE_TENDER_ID}/scope`);
  await expect(page.getByRole("heading", { name: "Scope of Works" })).toBeVisible();
}

/**
 * Returns the row group for the WBS item whose description is `desc`.
 *
 * SCOPE_WBS_TABLE_V1 replaced the expanding item CARD with a WBS table. An
 * item is now a run of <tr>s tied together by rowspan and wrapped in its own
 * <tbody data-testid="wbs-item">. There is no expand/collapse any more: every
 * control the expanded card used to reveal is rendered on the row group, so
 * this is a pure lookup - no click, and no re-location afterwards.
 *
 * Matched on a SUBSTRING of data-item-description (*=): the seeded rows
 * carry long descriptions ("Internal strip-out - remove partitions, ...")
 * and the card lookup this replaced used filter({ hasText }), which was
 * also a substring match. An exact match here finds nothing.
 * Matched on the attribute rather than hasText because the
 * description renders into an <input>, and an input's value is not text
 * content - a hasText filter would silently match nothing.
 */
function itemGroup(page: Page, desc: string) {
  return page.locator(`[data-testid="wbs-item"][data-item-description*="${desc}"]`);
}

/**
 * Opens the Measurement expandable on `article` and waits until it has settled.
 *
 * SCOPE_WBS_ACTIONS_V1 — this button is the ONLY opener for this block:
 * ScopeQuantitiesTable calls openItemBlock(item.id, "measurement") from it and
 * from nowhere else.
 *
 * SCOPE_WBS_REVEAL_V1 — and it no longer WRITES while opening. Clicking a shut
 * block reveals it and PATCHes nothing; only a click on an already-open block
 * appends. This helper used to settle on the appended row 2's sqm input,
 * because that row rendered from refetched data and its arrival proved the
 * append round-trip had finished. There is no round-trip left to wait for and
 * no row 2 to wait on, so the settle point is now the block itself plus row
 * 1's own sqm input — the controls the callers go on to read and type into.
 * Row 1 is the item's own flat columns and is always rendered, measured or
 * not, so this wait is satisfied by a pure reveal.
 *
 * Waiting on a CONTROL rather than only on the container still matters: the
 * block's dimension inputs are controlled state re-seeded from the item, and
 * returning before they exist would let a caller type into nothing.
 */
async function openMeasurementBlock(article: ReturnType<typeof itemGroup>): Promise<void> {
  await article.getByRole("button", { name: SHOW_MEASUREMENTS }).click();
  await expect(article.getByTestId("wbs-measurement-block")).toBeVisible();
  await expect(article.getByRole("spinbutton", { name: SQM_NAME })).toBeVisible();
}

test.describe("Batch 3 — Scope of Works items (PRs #43, #44, #60, #72, #175, #176, #180, #241)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("discipline card tabs render; seeded items and footer show real $ totals that agree", async ({ page }) => {
    await openScopeTab(page);

    // PR #43 (reworked by PR A1/B1.5): the SO/Str/Asb/Civ/Prv groups became
    // DEM/CIV/ASB/Other discipline cards rendered as tabs.
    for (const name of ["Demolition", "Civil works", "Asbestos removal", "Other"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }

    // DEM card is active by default — all four seeded items render a real $
    // line total instead of "—" (PR #175).
    for (const desc of [
      "Internal strip-out",
      "Structural demolition",
      "Slab removal",
      "Masonry demolition"
    ]) {
      const article = itemGroup(page, desc);
      await expect(article).toContainText(/\$[\d,]+(?:\.\d{2})?/);
    }

    // PR #175/#176 — the card footer's "with markup" figure equals the sum
    // of the visible per-item totals (each item's total is the last $ in
    // its card). Polled so a concurrent spec file adding/removing its own
    // fixture rows between reads can't produce a transient mismatch.
    await expect
      .poll(async () => {
        const footerText =
          (await page.getByText(/Subtotal: .*with markup:/).first().textContent()) ?? "";
        const m = /Subtotal:\s*\$([\d,]+(?:\.\d+)?)\s*·\s*with markup:\s*\$([\d,]+(?:\.\d+)?)/.exec(
          footerText
        );
        if (!m) return "footer not parsed";
        const withMarkup = Number(m[2].replace(/,/g, ""));
        if (withMarkup <= 0) return "footer is zero";
        let sum = 0;
        for (const article of await page.getByTestId("wbs-item").all()) {
          const text = (await article.textContent()) ?? "";
          const amounts = [...text.matchAll(/\$([\d,]+(?:\.\d+)?)/g)];
          if (amounts.length > 0) {
            sum += Number(amounts[amounts.length - 1][1].replace(/,/g, ""));
          }
        }
        return Math.abs(sum - withMarkup) < 0.05 ? "match" : `sum=${sum} footer=${withMarkup}`;
      })
      .toBe("match");

    // PR #175 — Other-discipline provisional rows render their
    // provisionalAmount as the row total (seeded "Provisional sum" items).
    await page.getByText("Other", { exact: true }).first().click();
    const provisional = page
      .locator('[data-testid="wbs-item"][data-item-description*="Provisional sum"]')
      .first();
    await expect(provisional).toContainText(/\$[\d,]+/);
  });

  test("B4a dimensions derive sqm/m³/tonnes; explicit sqm override recomputes downstream, persists, and reverts", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeScopeItemsByPrefix(request, token, "e2e-b3-dims-");
    const desc = `e2e-b3-dims-${Date.now()}`;
    // L=4, H=2.5, D=0.5, density=2.4 → sqm=10, m³=5, tonnes=12 (PR #180).
    const itemId = await createScopeItem(request, token, TEMPLATE_CARD_DEM, desc, {
      length: 4,
      height: 2.5,
      depth: 0.5,
      density: 2.4
    });
    try {
      await openScopeTab(page);
      const article = itemGroup(page, desc);

      // SCOPE_WBS_ACTIONS_V1 — at rest the row shows the action buttons and
      // NO measurement boxes. Asserted before opening anything: this is the
      // slice's "do not make any block open by default" requirement, and it
      // is the half of the pair that a test which only opened the disclosure
      // would never catch. An item seeded with L/H/D/density is exactly the
      // item most likely to be auto-opened by a well-meaning regression.
      await expect(article.getByTestId("wbs-measurement-block")).toHaveCount(0);
      await expect(article.getByRole("spinbutton", { name: SQM_NAME })).toHaveCount(0);
      await expect(article.getByRole("spinbutton", { name: M3_NAME })).toHaveCount(0);
      await expect(article.getByRole("spinbutton", { name: TONNES_NAME })).toHaveCount(0);

      await openMeasurementBlock(article);

      const sqm = article.getByRole("spinbutton", { name: SQM_NAME });
      const m3 = article.getByRole("spinbutton", { name: M3_NAME });
      const tonnes = article.getByRole("spinbutton", { name: TONNES_NAME });
      await expect(sqm).toHaveValue("10");
      await expect(m3).toHaveValue("5");
      await expect(tonnes).toHaveValue("12");

      // Explicit sqm override — m³ and tonnes recompute live from the
      // override (10→8 ⇒ m³ 5→4, tonnes 12→9.6), then persist on blur.
      await sqm.fill("8");
      await expect(m3).toHaveValue("4");
      await expect(tonnes).toHaveValue("9.6");
      await sqm.blur();

      // Blur fires the persisting PATCH asynchronously — reloading straight
      // away can abort the in-flight request. Wait for the saved value.
      await expect
        .poll(async () => {
          const body = await apiFetch<{ items: Array<{ id: string; sqm: string | null }> }>(
            request,
            token,
            "GET",
            `/tenders/${TEMPLATE_TENDER_ID}/scope/items`
          );
          const saved = body.items.find((i) => i.id === itemId);
          return saved?.sqm == null ? null : Number(saved.sqm);
        })
        .toBe(8);

      await page.reload();
      const reloaded = itemGroup(page, desc);
      // A reload closes every block again — the open state is view state and
      // is deliberately not persisted. Same pair as above, re-proved on an
      // item that now genuinely HAS a stored override to show.
      await expect(reloaded.getByTestId("wbs-measurement-block")).toHaveCount(0);
      await expect(reloaded.getByRole("spinbutton", { name: SQM_NAME })).toHaveCount(0);
      await openMeasurementBlock(reloaded);
      const sqmAfter = reloaded.getByRole("spinbutton", { name: SQM_NAME });
      await expect(sqmAfter).toHaveValue("8");
      await expect(reloaded.getByRole("spinbutton", { name: M3_NAME })).toHaveValue("4");

      // The override affordance reverts sqm to the auto-derived value.
      await sqmAfter.hover();
      await reloaded.getByRole("button", { name: "Revert to auto-derived value" }).first().click();
      await expect(reloaded.getByRole("spinbutton", { name: SQM_NAME })).toHaveValue("10");
    } finally {
      await deleteScopeItem(request, token, itemId);
    }
  });

  test("classification cells are editable; description edit persists on blur; waste flag leaves the row total unchanged", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeScopeItemsByPrefix(request, token, "e2e-b3-edit-");
    const desc = `e2e-b3-edit-${Date.now()}`;
    // men/days give the row a labour-driven line total to guard (PR #176).
    const itemId = await createScopeItem(request, token, TEMPLATE_CARD_DEM, desc, {
      men: 2,
      days: 1,
      tonnes: 5
    });
    try {
      await openScopeTab(page);
      const article = itemGroup(page, desc);

      // SCOPE_WBS_ACTIONS_V1 — the classification controls moved into the
      // Measurement expandable, so at rest NONE of them is on the row. Same
      // pair as the dimensions test: absent first, then editable once opened.
      await expect(article.getByTestId("wbs-measurement-block")).toHaveCount(0);
      await expect(article.getByLabel(MATERIAL_TYPE, { exact: true })).toHaveCount(0);
      await expect(article.getByLabel(WASTE_GROUP)).toHaveCount(0);
      await expect(article.getByLabel(WASTE_FLAG, { exact: true })).toHaveCount(0);
      await expect(article.getByLabel(CUTTING_FLAG, { exact: true })).toHaveCount(0);

      await openMeasurementBlock(article);

      // PR #60 — quantification/classification cells render editable.
      // `exact` on the two ticks and on Material type: the block numbers its
      // extra rows ("Measurement 2 include in waste summary"), and the
      // default substring match would make these ambiguous the moment a
      // second measurement exists.
      await expect(article.getByLabel(MATERIAL_TYPE, { exact: true })).toBeEnabled();
      await expect(article.getByLabel(WASTE_GROUP)).toBeEnabled();
      await expect(article.getByLabel(WASTE_FLAG, { exact: true })).toBeEnabled();
      await expect(article.getByLabel(CUTTING_FLAG, { exact: true })).toBeEnabled();

      await expect(article).toContainText(/\$[\d,]+/);
      const totalBefore = lastMoney(await article.textContent());
      expect(totalBefore).toBeGreaterThan(0);

      // PR #176 — flagging the row for waste (with a rated group/item) must
      // NOT add waste $ to the row total; waste bills in the subtable only.
      // Controlled checkbox — its state flips only after the PATCH
      // round-trip refetches the items, so click + polled assertion
      // (check() would fail its immediate post-click verification).
      // Group is Soil (not Rubble) so this transiently flagged fixture can
      // never leak into the waste spec's Rubble aggregation on this card.
      await article.getByLabel(WASTE_FLAG, { exact: true }).click();
      await expect(article.getByLabel(WASTE_FLAG, { exact: true })).toBeChecked();
      await article.getByLabel(WASTE_GROUP).selectOption({ label: "Soil" });
      await article.getByLabel(WASTE_ITEM).selectOption({ label: "Fill — clean" });
      await expect.poll(async () => lastMoney(await article.textContent())).toBe(totalBefore);

      // PR #44 — cell edits auto-save on blur and survive a reload.
      await article.getByLabel("Description").fill(`${desc}-edited`);
      await article.getByLabel("Description").blur();
      // Wait for the blur-triggered PATCH to land before navigating.
      await expect
        .poll(async () => {
          const body = await apiFetch<{ items: Array<{ id: string; description: string }> }>(
            request,
            token,
            "GET",
            `/tenders/${TEMPLATE_TENDER_ID}/scope/items`
          );
          return body.items.find((i) => i.id === itemId)?.description;
        })
        .toBe(`${desc}-edited`);
      await page.reload();
      await expect(itemGroup(page, `${desc}-edited`)).toBeVisible();
    } finally {
      await deleteScopeItem(request, token, itemId);
    }
  });

  // De-quarantined 2026-08-03 — flake root cause was two racing PATCHes on the
  // same scope-item: the qty/days blur PATCH and the "Remove Plant" PATCH could
  // arrive at the server in either order, and if the qty/days PATCH landed
  // second the removed plant was resurrected. Each mutating step still waits on
  // its scope-item PATCH response before dispatching the next, which serialises
  // the client and eliminates the race.
  //
  // SCOPE_PLANT_PERSIST_V1 (pr-cardpersist-s2) — PORTED from the legacy plant
  // pills onto the Plant COLUMN GROUP, in the same PR that retired the pills.
  // What moved, control by control:
  //
  //   "+ Plant" button            -> gone. Every row of the item already has a
  //                                  plant Type cell; there is nothing to add.
  //   getByLabel("Plant 1 rate")  -> getByLabel("Plant type for row 1")
  //   getByPlaceholder("qty")     -> getByLabel("Plant qty for row 1")
  //   getByPlaceholder("days")    -> getByLabel("Plant days for row 1")
  //   "Remove Plant 1" button     -> gone. Clearing the Type empties the row,
  //                                  which is the same statement the pill's
  //                                  removal made (an entry with no rate id and
  //                                  no override prices $0 and is skipped by
  //                                  getCardSummary for want of a description).
  //
  // The reload assertion in the middle is NEW and is the point of the slice:
  // before it, every one of these fields died in local state.
  test("plant columns: pick a machine, set qty/days, survive a reload, clear it (PRs #241, #72)", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    await purgeScopeItemsByPrefix(request, token, "e2e-b3-plant-");
    const desc = `e2e-b3-plant-${Date.now()}`;
    const itemId = await createScopeItem(request, token, TEMPLATE_CARD_DEM, desc, {
      men: 1,
      days: 1
    });
    try {
      await openScopeTab(page);
      const article = itemGroup(page, desc);

      const isScopeItemPatch = (r: import("@playwright/test").Response) =>
        r.request().method() === "PATCH" &&
        /\/tenders\/[^/]+\/scope\/items\/[^/]+(?:\?|$)/.test(r.url());

      // The Measurement cell no longer renders any plant control at all.
      await expect(article.getByRole("button", { name: "+ Plant" })).toHaveCount(0);
      await expect(article.getByLabel("Plant 1 rate")).toHaveCount(0);

      const plantSelect = article.getByLabel("Plant type for row 1");
      await expect(plantSelect).toBeVisible();
      // First real option (index 0 is the blank "- none -" option) — seeded
      // plant rate names embed seed-dependent labels, so select by position.
      const ratePatch = page.waitForResponse(isScopeItemPatch);
      await plantSelect.selectOption({ index: 1 });
      expect((await ratePatch).ok()).toBeTruthy();

      await article.getByLabel("Plant qty for row 1").fill("2");

      // Focusing days blurs qty, firing the qty-persist PATCH. Wait for it
      // before triggering the days PATCH so patchItem's refetch has landed
      // and item.plantItems includes qty=2 when the days-blur handler runs.
      const qtyPatch = page.waitForResponse(isScopeItemPatch);
      await article.getByLabel("Plant days for row 1").fill("1.5");
      expect((await qtyPatch).ok()).toBeTruthy();

      const daysPatch = page.waitForResponse(isScopeItemPatch);
      await article.getByLabel("Plant days for row 1").blur();
      expect((await daysPatch).ok()).toBeTruthy();

      // The whole point of SCOPE_PLANT_PERSIST_V1: the array actually reached
      // the database, carries the machine's NAME (not just its rate id — the
      // card summary skips an entry without one), and the qty/days the
      // estimator typed.
      await expect
        .poll(async () => {
          const body = await apiFetch<{
            items: Array<{
              id: string;
              plantItems: Array<{
                plantRateId?: string | null;
                description?: string | null;
                qty?: number | null;
                days?: number | null;
              }> | null;
            }>;
          }>(request, token, "GET", `/tenders/${TEMPLATE_TENDER_ID}/scope/items`);
          const saved = body.items.find((i) => i.id === itemId);
          const first = saved?.plantItems?.[0];
          if (!first) return "no plant entry stored";
          return [
            first.plantRateId ? "has-rate-id" : "no-rate-id",
            first.description ? "has-description" : "no-description",
            `qty=${first.qty}`,
            `days=${first.days}`
          ].join(" ");
        })
        .toBe("has-rate-id has-description qty=2 days=1.5");

      // ...and it comes back on the row after a reload, which is what it never
      // did before this slice.
      await page.reload();
      const reloaded = itemGroup(page, desc);
      await expect(reloaded.getByLabel("Plant qty for row 1")).toHaveValue("2");
      await expect(reloaded.getByLabel("Plant days for row 1")).toHaveValue("1.5");
      await expect(reloaded.getByLabel("Plant type for row 1")).not.toHaveValue("");

      // Clearing the Type empties the row — the port of "Remove Plant 1".
      // The clear PATCH must not fire until the days PATCH above has resolved,
      // or a late-arriving days PATCH will resurrect the machine.
      const clearPatch = page.waitForResponse(isScopeItemPatch);
      await reloaded.getByLabel("Plant type for row 1").selectOption({ index: 0 });
      expect((await clearPatch).ok()).toBeTruthy();
      await expect(reloaded.getByLabel("Plant type for row 1")).toHaveValue("");
      // Qty / Days disable themselves again once the row has no Type.
      await expect(reloaded.getByLabel("Plant qty for row 1")).toBeDisabled();
    } finally {
      await deleteScopeItem(request, token, itemId);
    }
  });
});
