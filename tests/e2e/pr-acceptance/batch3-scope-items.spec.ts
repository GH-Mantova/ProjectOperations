/**
 * Batch 3 — Scope of Works item cards (PRs #43, #44, #60, #72, #175, #176, #180, #241)
 *
 * Covers the scope-item card surface of the Scope of Works tab on the
 * seeded T260520-ACME-Rev1 template tender: discipline card tabs, per-item $ totals
 * and footer consistency (B1.7.x), the B4a dimension-derivation chain
 * (L/H/D/density → sqm/m³/tonnes with explicit overrides), editable
 * classification cells, and plant pills.
 *
 * Selector note: the dimension inputs for Length/Height/Depth have no
 * accessible name (span labels, no title) — fixtures set them via the API
 * and the UI assertions read the derived Sqm/M³/Tonnes inputs, which ARE
 * reachable through their title-derived accessible names. Direct UI typing
 * into L/H/D is listed in the PR follow-up as testid-blocked.
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

// Accessible names of the derived-dimension inputs fall back to their
// title attributes (no label/aria-label on these cells).
const SQM_NAME = "Auto = length × height. Type to override.";
const M3_NAME = "Auto = sqm × depth. Type to override.";
const TONNES_NAME = "Auto = m³ × density or sqm × density / 1000. Type to override.";

async function openScopeTab(page: Page): Promise<void> {
  await page.goto(`/tenders/${TEMPLATE_TENDER_ID}/scope`);
  await expect(page.getByRole("heading", { name: "Scope of Works" })).toBeVisible();
}

/**
 * Expands the item card matching `desc` and returns a locator for the
 * EXPANDED card. Re-locating is required: an expanded card moves its
 * description into an <input>, so `filter({ hasText: desc })` stops
 * matching the article the moment it expands. Tests expand exactly one
 * card at a time, so "the article holding the Collapse button" is unique.
 */
async function expandItem(page: Page, desc: string) {
  await page.getByRole("article").filter({ hasText: desc }).getByLabel("Expand item").click();
  const expanded = page
    .getByRole("article")
    .filter({ has: page.getByLabel("Collapse item") });
  await expect(expanded).toHaveCount(1);
  return expanded;
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
      const article = page.getByRole("article").filter({ hasText: desc }).first();
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
        for (const article of await page.getByRole("article").all()) {
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
      .getByRole("article")
      .filter({ hasText: "Provisional sum" })
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
      const article = await expandItem(page, desc);

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
      const reloaded = await expandItem(page, desc);
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
      const article = await expandItem(page, desc);

      // PR #60 — quantification/classification cells render editable.
      await expect(article.getByLabel("Material type")).toBeEnabled();
      await expect(article.getByLabel("Waste group")).toBeEnabled();
      await expect(article.getByLabel("Include in waste summary")).toBeEnabled();
      await expect(article.getByLabel("Include in cutting summary")).toBeEnabled();

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
      await article.getByLabel("Include in waste summary").click();
      await expect(article.getByLabel("Include in waste summary")).toBeChecked();
      await article.getByLabel("Waste group").selectOption({ label: "Soil" });
      await article.getByLabel("Waste item").selectOption({ label: "Fill — clean" });
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
      await expect(page.getByRole("article").filter({ hasText: `${desc}-edited` })).toBeVisible();
    } finally {
      await deleteScopeItem(request, token, itemId);
    }
  });

  test("plant pills: add a plant cluster, set qty/days, remove it (PRs #241, #72)", async ({
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
      const article = await expandItem(page, desc);

      await article.getByRole("button", { name: "+ Plant" }).click();
      const plantSelect = article.getByLabel("Plant 1 rate");
      await expect(plantSelect).toBeVisible();
      // First real option (index 0 is the "—" placeholder) — seeded plant
      // rate names embed seed-dependent labels, so select by position.
      await plantSelect.selectOption({ index: 1 });
      await article.getByPlaceholder("qty").fill("2");
      await article.getByPlaceholder("days").fill("1.5");
      await article.getByPlaceholder("days").blur();

      // Pill row re-renders cleanly after removal (PR #241 state isolation).
      await article.getByRole("button", { name: "Remove Plant 1" }).click();
      await expect(article.getByLabel("Plant 1 rate")).toHaveCount(0);
      await expect(article.getByRole("button", { name: "+ Plant" })).toBeVisible();
    } finally {
      await deleteScopeItem(request, token, itemId);
    }
  });
});
