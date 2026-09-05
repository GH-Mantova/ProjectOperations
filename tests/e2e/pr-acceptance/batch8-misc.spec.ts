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
 * SCOPE_WBS_ACTIONS_V1 (PR #1646) — the per-row notes textarea was relocated
 * into the `WbsCommentBlock` expandable, opened from the actions column with
 * `+ Add comment`, and the slice requires that NOTHING opens by default. The
 * notes-modal test below therefore proves a PAIR: the textarea is absent at
 * rest, and behaves exactly as it always did once the disclosure is opened.
 * The field is the same one (ScopeOfWorksItem.notes through the same PATCH)
 * and the same shared NotesField; only its placeholder and its modal title
 * changed, because the block labels it as the item's comment.
 *
 * Residue: none. The discipline-picker test deletes the card it creates;
 * the markup tests clear every override they set (and self-heal a leftover
 * override from a crashed previous run before asserting); the notes-modal
 * test only exercises the Escape-cancel path, which never saves — and
 * `+ Add comment` is pure view state, it writes nothing.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import { TEMPLATE_TENDER_ID } from "./api-helpers";

/**
 * The placeholder WbsCommentBlock passes to the shared NotesField.
 *
 * Kept as a literal rather than imported from the app: these specs are
 * black-box and never link app source. Mirrors WBS_COMMENT_PLACEHOLDER in
 * apps/web/src/pages/tendering/scope-cards/WbsCommentBlock.tsx.
 */
const WBS_COMMENT_PLACEHOLDER =
  "Note against this WBS item — rolls into the card summary, and can be ticked through to the quote or the handover.";

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
 * Returns the tab for discipline `code` in the scope tab strip.
 *
 * SCOPE_DISCIPLINE_STACK_V1 made the strip one tab per DISCIPLINE instead of
 * one tab per card, so a tab is addressed by its discipline code and never by
 * a card code. `data-discipline` is the attribute the component exposes for
 * exactly this; selection state is on `aria-pressed`.
 */
function disciplineTab(page: Page, code: string) {
  return page.locator(`[data-testid="scope-discipline-tab"][data-discipline="${code}"]`);
}

/**
 * Returns the stack entry for the card whose code is `code` (e.g. "ASB2").
 *
 * SCOPE_DISCIPLINE_STACK_V1 stacks every card of the selected discipline down
 * the page, each in its own <section data-testid="scope-card-stack-entry">, so
 * per-card controls that used to be unique on screen (the card name heading,
 * the Discipline select, the markup input) now repeat once per card and must
 * be scoped to one entry.
 *
 * Keyed off the collapse toggle's accessible name rather than `data-card-id`,
 * because the card id is a cuid the test cannot know, while the code is
 * derived from (discipline, cardNumber) and is what the test already reasons
 * about. Anchored ^...$ so "ASB1" cannot match "ASB10".
 */
function cardEntry(page: Page, code: string) {
  return page
    .getByTestId("scope-card-stack-entry")
    .filter({ has: page.getByLabel(new RegExp(`^(Collapse|Expand) card ${code}$`)) });
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

    // SCOPE_WBS_ACTIONS_V1 — at rest the item shows `+ Add comment` and NO
    // note box. Asserted before opening anything: this is the slice's "do not
    // make any block open by default" requirement, and it is the half of the
    // pair a test that only opened the disclosure would never catch. The
    // seeded "Internal strip-out" is the dangerous case — an item that may
    // already carry a note, and so the one a regression would auto-open.
    await expect(article.getByTestId("wbs-comment-block")).toHaveCount(0);
    await expect(article.getByPlaceholder(WBS_COMMENT_PLACEHOLDER)).toHaveCount(0);
    await expect(article.getByLabel("Expand notes")).toHaveCount(0);

    // `+ Add comment` only reveals — it writes nothing, so this test still
    // leaves no residue.
    await article.getByRole("button", { name: "+ Add comment" }).click();
    await expect(article.getByTestId("wbs-comment-block")).toBeVisible();

    const inlineNotes = article.getByPlaceholder(WBS_COMMENT_PLACEHOLDER);
    await expect(inlineNotes).toBeVisible();
    const original = await inlineNotes.inputValue();

    // The block labels the field per item ("Comment on <wbs code>"), and
    // NotesField passes its label straight through as the modal's title, so
    // the dialog is named from the row group's own data-wbs-code rather than
    // from a hard-coded code the seed is free to renumber.
    const wbsCode = await article.getAttribute("data-wbs-code");
    expect(wbsCode).toBeTruthy();
    const modalTitle = `Comment on ${wbsCode}`;

    await article.getByLabel("Expand notes").click();
    const modal = page.getByRole("dialog", { name: modalTitle });
    await expect(modal.getByRole("heading", { name: modalTitle })).toBeVisible();
    await expect(modal.getByText("⌘/Ctrl + Enter to save · Esc to cancel")).toBeVisible();

    // Modal opens pre-filled with the inline text; Esc discards the edit.
    const modalNotes = modal.getByPlaceholder(WBS_COMMENT_PLACEHOLDER);
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

    // SCOPE_DISCIPLINE_STACK_V1 — only the SELECTED discipline's cards are
    // mounted, so an ASB card is not on the page at all until the ASB tab is
    // open. The seed owns ASB1, so that tab always exists.
    await disciplineTab(page, "ASB").click();

    // Self-heal an orphan empty ASB2 card left by a crashed previous run. The
    // delete affordance moved from the card tab to the card's own header in
    // the stack and is mounted unconditionally there, so the hover step the
    // old tab required is gone.
    const orphan = cardEntry(page, "ASB2");
    if (await orphan.isVisible()) {
      await orphan.getByLabel("Delete card Asbestos removal").click();
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
    // the seed owns ASB1) and its DISCIPLINE becomes the selected tab.
    //
    // Before SCOPE_DISCIPLINE_STACK_V1 a card had a tab of its own and was the
    // only card on screen, so "ASB2 is on the tab strip" was how this test said
    // "the card exists and is showing". Cards have no tabs any more: the same
    // claim is now that the ASB tab is selected and ASB2 is in its stack —
    // next to ASB1, which is the whole point of stacking.
    await expect(disciplineTab(page, "ASB")).toHaveAttribute("aria-pressed", "true");
    const asb2 = cardEntry(page, "ASB2");
    await expect(asb2).toBeVisible();
    await expect(cardEntry(page, "ASB1")).toBeVisible();

    // Same two assertions as before, now scoped to the new card's own entry:
    // NewCardModal names a card after its discipline label, so ASB1 and ASB2
    // BOTH render an "Asbestos removal" heading and BOTH render a Discipline
    // select. Unscoped, either lookup would match two elements and fail
    // Playwright strict mode.
    await expect(asb2.getByRole("heading", { name: "Asbestos removal" })).toBeVisible();
    await expect(asb2.getByLabel(/Discipline:/)).toHaveValue("ASB");

    // The seeded ASB1 has items, so it exposes no delete control — the
    // empty-card-only rule the cleanup below depends on. Only assertable now
    // that a populated and an empty card are on screen together.
    await expect(cardEntry(page, "ASB1").getByLabel(/^Delete card /)).toHaveCount(0);

    // Clean up: an empty card's delete control sits in its own stack header.
    await asb2.getByLabel("Delete card Asbestos removal").click();
    await expect(page.getByText("Card deleted")).toBeVisible();
    await expect(asb2).toHaveCount(0);
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
