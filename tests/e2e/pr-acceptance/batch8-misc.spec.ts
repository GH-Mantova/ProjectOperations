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

/** Expands the item card matching `desc` (batch 3 pattern — re-locating is
 * required because expansion moves the description into an input). */
async function expandItem(page: Page, desc: string) {
  await page.getByRole("article").filter({ hasText: desc }).getByLabel("Expand item").click();
  const expanded = page.getByRole("article").filter({ has: page.getByLabel("Collapse item") });
  await expect(expanded).toHaveCount(1);
  return expanded;
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

  test("item cards render collapsed by default; chargeBy is gone from the card UI (PRs #172, #182)", async ({
    page
  }) => {
    await openScopeTab(page);

    // Every card starts collapsed — Expand affordances only.
    await expect(page.getByLabel("Collapse item")).toHaveCount(0);
    await expect(page.getByLabel("Expand item").first()).toBeVisible();

    // PR #182 removed the chargeBy field — it must not return when expanded.
    const article = await expandItem(page, "Internal strip-out");
    await expect(article.getByText(/charge ?by/i)).toHaveCount(0);
  });

  test("item notes expand modal cancels via Escape without saving (PR #172)", async ({ page }) => {
    await openScopeTab(page);
    const article = await expandItem(page, "Internal strip-out");

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
    const newCardCode = page.getByText("ASB2", { exact: true });
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

    const dialogMessages: string[] = [];
    page.on("dialog", (dialog) => {
      dialogMessages.push(dialog.message());
      void dialog.accept();
    });

    // Seed one override so Reset all has something to clear.
    const cardInput = page.getByLabel("Card markup override percent");
    await cardInput.fill("42");
    await cardInput.blur();
    await expect(page.getByRole("button", { name: "Reset this card" })).toBeVisible();

    await page.getByRole("button", { name: "Reset all" }).click();
    await expect(page.getByText(/[1-9]\d* card override(s)? cleared/)).toBeVisible();
    expect(dialogMessages.length).toBe(1);
    expect(dialogMessages[0]).toContain("Reset every markup override back to the tender default");
    await expect(cardInput).toHaveValue("");

    // With no overrides left the second click skips the confirm dialog
    // entirely and reports cardsReset: 0.
    await page.getByRole("button", { name: "Reset all" }).click();
    await expect(page.getByText("0 card overrides cleared")).toBeVisible();
    expect(dialogMessages.length).toBe(1);
  });

  test("brand fonts: Outfit body text, Syne headings (PR #27)", async ({ page }) => {
    await page.goto("/archive");
    await expect(page.getByRole("heading", { name: "Archive" })).toHaveCSS(
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
