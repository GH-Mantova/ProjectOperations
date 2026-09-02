/**
 * Batch 8 — Shell & tendering long tail (PRs #219, #248, #172, #182, #178, #177, #27, #14).
 *
 * One-off leftovers no earlier batch claimed: tender-detail tab routing
 * (PR #219), the card-creation discipline picker (PR #248), collapsed item
 * cards + the notes expand modal (PR #172), the removed chargeBy field
 * (PR #182), per-card markup overrides and Reset this card / Reset all
 * (PRs #177, #178), brand fonts (PR #27), and the notifications bell +
 * Cmd/Ctrl+K command palette (PR #14).
 *
 * Residue: none. The discipline-picker test deletes the card it creates;
 * the markup tests clear every override they set (and self-heal a leftover
 * override from a crashed previous run before asserting); the notes-modal
 * test only exercises the Escape-cancel path, which never saves.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import { TEMPLATE_TENDER_ID } from "./api-helpers";

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
 * Matched on data-item-description rather than hasText because the
 * description renders into an <input>, and an input's value is not text
 * content - a hasText filter would silently match nothing.
 */
function itemGroup(page: Page, desc: string) {
  return page.locator(`[data-testid="wbs-item"][data-item-description="${desc}"]`);
}

test.describe("Batch 8 — Shell & tendering long tail (PRs #219, #248, #172, #182, #178, #177, #27, #14)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("tender detail tabs navigate and reflect the active tab (PR #219)", async ({ page }) => {
    await page.goto(`/tenders/${TEMPLATE_TENDER_ID}`);
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByRole("tab", { name: "Scope of Works" }).click();
    await expect(page).toHaveURL(new RegExp(`/tenders/${TEMPLATE_TENDER_ID}/scope`));
    await expect(page.getByRole("tab", { name: "Scope of Works" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByRole("heading", { name: "Scope of Works" })).toBeVisible();

    await page.getByRole("tab", { name: "Quote" }).click();
    await expect(page).toHaveURL(new RegExp(`/tenders/${TEMPLATE_TENDER_ID}/quote`));
    await expect(page.getByRole("tab", { name: "Quote" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("direct navigation and browser back/forward keep the active tab in sync (PR #219)", async ({
    page
  }) => {
    // Direct-load the Scope sub-route — the Scope tab must be active on load.
    await openScopeTab(page);
    await expect(page.getByRole("tab", { name: "Scope of Works" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByRole("tab", { name: "Quote" }).click();
    await expect(page).toHaveURL(/\/quote$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/scope$/);
    await expect(page.getByRole("tab", { name: "Scope of Works" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.goForward();
    await expect(page).toHaveURL(/\/quote$/);
    await expect(page.getByRole("tab", { name: "Quote" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("WBS items render as one addressable row group each; chargeBy is gone (PRs #172, #182)", async ({
    page
  }) => {
    await openScopeTab(page);

    // SCOPE_WBS_TABLE_V1 - the expanding item card is gone. The original
    // assertion here ("every card starts collapsed, Expand affordances only")
    // tested a concept the redesign deliberately removed, so it is replaced
    // rather than repaired: what must now be true is that items render as a
    // WBS table, one addressable row group per item, with no expand/collapse
    // left behind.
    await expect(page.getByRole("table", { name: "WBS items" })).toBeVisible();
    await expect(page.getByTestId("wbs-item").first()).toBeVisible();
    await expect(page.getByLabel("Expand item")).toHaveCount(0);
    await expect(page.getByLabel("Collapse item")).toHaveCount(0);

    // PR #182 removed the chargeBy field. That still has teeth: the table
    // rewrite must not reintroduce it.
    const article = itemGroup(page, "Internal strip-out");
    await expect(article.getByText(/charge ?by/i)).toHaveCount(0);
  });

  test("item notes expand modal cancels via Escape without saving (PR #172)", async ({ page }) => {
    await openScopeTab(page);
    const article = itemGroup(page, "Internal strip-out");

    const inlineNotes = article.getByPlaceholder("Notes for this item…");
    await expect(inlineNotes).toBeVisible();
    const original = await inlineNotes.inputValue();

    await article.getByLabel("Expand notes").click();
    const modal = page.getByRole("dialog", { name: "Notes" });
    await expect(modal.getByRole("heading", { name: "Notes" })).toBeVisible();
    await expect(modal.getByText("⌘/Ctrl + Enter to save · Esc to cancel")).toBeVisible();

    // Modal opens pre-filled with the inline text; Esc discards the edit.
    const modalNotes = modal.getByPlaceholder("Notes for this item…");
    await expect(modalNotes).toHaveValue(original);
    await modalNotes.fill(`${original} e2e-b8-discarded`);
    await modalNotes.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(inlineNotes).toHaveValue(original);
  });

  test("card creation discipline picker gates Create until a discipline is chosen (PR #248)", async ({
    page
  }) => {
    await openScopeTab(page);

    // Self-heal an orphan empty ASB2 card left by a crashed previous run.
    const orphan = page.getByText("ASB2", { exact: true });
    if (await orphan.isVisible()) {
      await orphan.hover();
      await page.getByLabel("Delete card Asbestos removal").click();
      await expect(orphan).toHaveCount(0);
    }

    await page.getByRole("button", { name: "Add card" }).click();
    // NewCardModal carries no aria-label — scope by its heading text.
    const modal = page.getByRole("dialog").filter({ hasText: "Add scope card" });
    await expect(modal.getByRole("heading", { name: "Add scope card" })).toBeVisible();

    const create = modal.getByRole("button", { name: "Create card" });
    await expect(create).toBeDisabled();
    await modal.getByRole("radio", { name: "Asbestos removal (ASB)" }).check();
    await expect(create).toBeEnabled();
    await create.click();
    await expect(modal).toHaveCount(0);

    // The new empty card is created with the chosen discipline (code ASB2 —
    // the seed owns ASB1) and becomes the active card.
    // SCOPE_DISCBAR_V1 (#1473) renders the card code in the discipline summary
    // bar as well as on the tab, so a bare getByText("ASB2") now resolves to two
    // elements and fails Playwright strict mode. This test means the TAB - it
    // hovers it below to reveal the tab's own delete affordance - so scope it
    // there rather than loosening the assertion with .first().
    const newCardCode = page
      .getByTestId("scope-card-tab")
      .getByText("ASB2", { exact: true });
    await expect(newCardCode).toBeVisible();
    await expect(page.getByRole("heading", { name: "Asbestos removal" })).toBeVisible();
    await expect(page.getByLabel(/Discipline:/)).toHaveValue("ASB");

    // Clean up: empty cards expose a delete affordance on hover.
    await newCardCode.hover();
    await page.getByLabel("Delete card Asbestos removal").click();
    await expect(page.getByText("Card deleted")).toBeVisible();
    await expect(newCardCode).toHaveCount(0);
  });

  test("per-card markup override: set, recompute, clear via × and Reset this card (PRs #177, #178)", async ({
    page
  }) => {
    await openScopeTab(page);

    const cardInput = page.getByLabel("Card markup override percent");
    const resetCard = page.getByRole("button", { name: "Reset this card" });
    const clearX = page.getByLabel("Clear card markup override");

    // Self-heal a leftover override from a crashed previous run.
    if (await resetCard.isVisible()) {
      await resetCard.click();
      await expect(resetCard).toBeHidden();
    }

    // PR #177 — header strip shows the tender-level markup input + Reset all;
    // the card strip shows the override input with the tender markup as
    // placeholder while inheriting.
    const tenderMarkup = (await cardInput.getAttribute("placeholder")) ?? "";
    expect(Number(tenderMarkup)).toBeGreaterThan(0);
    await expect(page.getByLabel("Tender markup percent")).toHaveValue(tenderMarkup);
    await expect(page.getByRole("button", { name: "Reset all" })).toBeVisible();

    // PR #178 — no override → input only, no Reset button, no ×.
    await expect(cardInput).toHaveValue("");
    await expect(resetCard).toHaveCount(0);
    await expect(clearX).toHaveCount(0);

    const footer = page.getByText(/Subtotal: .*with markup:/).first();
    const withMarkupOf = (text: string | null) =>
      Number(/with markup:\s*\$([\d,]+(?:\.\d+)?)/.exec(text ?? "")?.[1]?.replace(/,/g, "") ?? 0);
    const before = withMarkupOf(await footer.textContent());
    expect(before).toBeGreaterThan(0);

    // Type an override → blur: Reset this card + × appear and the card's
    // with-markup figure recomputes from the override.
    await cardInput.fill(String(Number(tenderMarkup) + 15));
    await cardInput.blur();
    await expect(resetCard).toBeVisible();
    await expect(clearX).toBeVisible();
    await expect.poll(async () => withMarkupOf(await footer.textContent())).not.toBe(before);

    // × clears the override back to inherit.
    await clearX.click();
    await expect(resetCard).toHaveCount(0);
    await expect(cardInput).toHaveValue("");
    await expect.poll(async () => withMarkupOf(await footer.textContent())).toBe(before);

    // Set again and clear via "Reset this card" — same end state.
    await cardInput.fill(String(Number(tenderMarkup) + 15));
    await cardInput.blur();
    await expect(resetCard).toBeVisible();
    await resetCard.click();
    await expect(resetCard).toHaveCount(0);
    await expect(cardInput).toHaveValue("");
    await expect(cardInput).toHaveAttribute("placeholder", tenderMarkup);
  });

  test("Reset all confirms when overrides exist, then is silent at zero (PR #177)", async ({
    page
  }) => {
    await openScopeTab(page);

    // Seed one override so Reset all has something to clear.
    const cardInput = page.getByLabel("Card markup override percent");
    await cardInput.fill("42");
    await cardInput.blur();
    await expect(page.getByRole("button", { name: "Reset this card" })).toBeVisible();

    // The reset confirm is now the in-app ConfirmDialog (useConfirm).
    await page.getByRole("button", { name: "Reset all" }).click();
    const resetDialog = page.getByTestId("confirm-dialog");
    await expect(resetDialog).toContainText(
      "Reset every markup override back to the tender default"
    );
    await page.getByTestId("confirm-dialog-confirm").click();
    await expect(page.getByText(/Cleared: [1-9]\d* scope,/)).toBeVisible();
    await expect(cardInput).toHaveValue("");

    // With no overrides left the second click skips the confirm dialog
    // entirely and reports cardsReset: 0.
    await page.getByRole("button", { name: "Reset all" }).click();
    await expect(page.getByText("Cleared: 0 scope, 0 waste, 0 cutting")).toBeVisible();
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
  });

  test("brand fonts: Outfit body text, Syne headings (PR #27)", async ({ page }) => {
    await page.goto("/archive");
    await expect(page.getByRole("heading", { name: "Archive", exact: true })).toHaveCSS(
      "font-family",
      /Syne/
    );
    await expect(
      page.getByText("Read-only register of closed and archived jobs")
    ).toHaveCSS("font-family", /Outfit/);
  });

  test("notifications bell opens the dropdown with mark-all-read (PR #14)", async ({ page }) => {
    const bell = page.getByRole("button", { name: /^Notifications/ });
    await bell.click();

    const dropdown = page.getByRole("dialog", { name: "Notifications" });
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByRole("button", { name: "Mark all read" })).toBeVisible();
    await expect(
      dropdown.getByRole("button", { name: "See all notifications →" })
    ).toBeVisible();

    // Bell toggles the dropdown closed again.
    await bell.click();
    await expect(dropdown).toHaveCount(0);
  });

  test("Cmd/Ctrl+K command palette opens, searches, and closes on Escape (PR #14)", async ({
    page
  }) => {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Global search" });
    await expect(palette).toBeVisible();

    const input = palette.getByLabel("Search");
    await expect(input).toBeFocused();

    // The palette fetches /search on open even with an empty query, and an empty
    // query returns ALL registered search entries — entries other tests create at
    // runtime. So "Start typing to search." only survives if the index happens to
    // be empty (LL-23-class transient state). Assert the durable contract instead:
    // the results region settles into one of its legitimate empty-query states
    // (hint, in-flight "Searching…", or suggestion rows).
    await expect(
      palette
        .getByText("Start typing to search.")
        .or(palette.getByText("Searching…"))
        .or(palette.getByRole("button").first())
    ).toBeVisible();

    // Deterministic no-match query: asserts the search lifecycle without
    // depending on what the search index contains.
    await input.fill("e2e-b8-no-such-entry");
    await expect(palette.getByText("No matches.")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
  });
});
