/**
 * Batch 9b — global search index / command palette (PR #14; index seeded by PR #383).
 *
 * Closes batch 8's parked "command palette Enter-routing" follow-up: PR #383's
 * production-seed split now registers SearchEntry rows for the Initial Services
 * dataset (tenders, clients, workers, assets, 4 form templates, jobs), so the
 * routing contract is finally assertable. Batch 8's batch8-misc.spec.ts already
 * pins open / focus / empty-query race / Escape — not repeated here.
 *
 * Index registration map (apps/api/prisma):
 *   • seed-initial-services.ts `searchSeeds` — IS dataset entities ARE indexed.
 *   • seed.ts — registers only 2 Dashboards + 1 converted Job; its OWN demo
 *     entities (the T260520-ACME-Rev1 template tender — legacy IS-T100 —, the
 *     Acme Infrastructure / Northside Civil clients, the archived job) are
 *     NEVER registered. Runtime registration exists only in jobs.service
 *     (tender→job conversion) and documents.service — tenders/clients created
 *     through the UI never enter the index. Pinned below as QUIRK tests.
 *
 * Residue: none — every test is read-only against seed data.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginAsAdmin, SEED_TENDER_NUMBER } from "./helpers";

/** Indexed seed tender (tender-001, seed-initial-services.ts searchSeeds). */
const INDEXED_TENDER_NUMBER = "T260310-QUEE-Rev1";
const INDEXED_TENDER_ID = "tender-001";
/** Indexed seed client (client-001, same searchSeeds block). */
const INDEXED_CLIENT_NAME = "Queensland Transport Infrastructure";

async function openPalette(page: Page): Promise<Locator> {
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Global search" });
  await expect(palette).toBeVisible();
  await expect(palette.getByLabel("Search")).toBeFocused();
  return palette;
}

test.describe("Batch 9b — global search / command palette (PR #14)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("palette finds an indexed tender by number and Enter routes to it", async ({ page }) => {
    const palette = await openPalette(page);
    await palette.getByLabel("Search").fill(INDEXED_TENDER_NUMBER);

    // Seed registers the entry as "{tenderNumber} — {title}" under the Tenders group.
    const hit = palette.getByRole("button", { name: new RegExp(INDEXED_TENDER_NUMBER) });
    await expect(hit).toBeVisible();
    await expect(hit).toContainText("Ipswich Motorway Stage 4");
    await expect(palette.getByText("Tenders", { exact: true })).toBeVisible();
    // Exactly one hit — guards the Enter target below (keyboard selection
    // defaults to the first result).
    await expect(palette.getByRole("button")).toHaveCount(1);

    // The parked batch-8 follow-up: Enter routes via the entry's seeded URL.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/tenders\\?highlight=${INDEXED_TENDER_ID}`));
    await expect(palette).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Register", exact: true })).toBeVisible();
  });

  test("palette finds an indexed client by name under the Clients group", async ({ page }) => {
    const palette = await openPalette(page);
    await palette.getByLabel("Search").fill("Queensland Transport");

    const hit = palette.getByRole("button", { name: new RegExp(INDEXED_CLIENT_NAME) });
    await expect(hit).toBeVisible();
    // Seeded subtitle "{type} · {industry}" renders inside the result row.
    await expect(hit).toContainText("Government");
    await expect(palette.getByText("Clients", { exact: true })).toBeVisible();
  });

  test("nonsense query settles into the no-results state", async ({ page }) => {
    const palette = await openPalette(page);
    await palette.getByLabel("Search").fill("zzz-e2e-b9b-no-such-entity");

    // Durable outcome: zero result rows. The copy assertion is a tolerant set
    // (conventions: never pin one exact piece of transient empty-state copy).
    await expect(
      palette.getByText("No matches.").or(palette.getByText("Start typing to search."))
    ).toBeVisible();
    await expect(palette.getByRole("button")).toHaveCount(0);
  });

  test("empty query returns the registered index as suggestions", async ({ page }) => {
    const palette = await openPalette(page);
    // QUIRK (2026-06-12 palette-deflake finding): the palette fetches /search on
    // open, and SearchService.search treats an empty query as match-all (capped
    // at 25, ordered module→title). With the index seeded by PR #383 the panel
    // therefore settles into suggestion rows, not the "Start typing" hint. This
    // pins that contract; if search ever becomes opt-in on empty input, this
    // test should flip to asserting the hint.
    await expect(palette.getByRole("button").first()).toBeVisible();
  });

  test("demo template tender (legacy IS-T100) is absent from the index", async ({ page }) => {
    const palette = await openPalette(page);
    await palette.getByLabel("Search").fill(SEED_TENDER_NUMBER);

    // QUIRK: seed.ts registers SearchEntry rows only for 2 dashboards and the
    // converted demo job — its own demo tenders/clients (T260520-ACME-Rev1 =
    // legacy IS-T100, Acme Infrastructure, Northside Civil) are never indexed,
    // and tendering.service has no runtime registration either. The template
    // tender is visible in the /tenders register but invisible to Ctrl+K.
    // Asserting CURRENT behaviour per batch-9b prompt — do not "fix" this test
    // before the seed/production gap is closed; see the PR findings section.
    await expect(
      palette.getByText("No matches.").or(palette.getByText("Start typing to search."))
    ).toBeVisible();
    await expect(palette.getByRole("button")).toHaveCount(0);
  });
});
