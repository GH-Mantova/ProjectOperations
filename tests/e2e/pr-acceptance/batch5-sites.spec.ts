/**
 * Batch 5 — Sites register + detail (PRs #23, #288, #344; F2-01 delete guard)
 *
 * Triage (full table in the PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR   | Item (truncated)                                    | Decision
 * -----|-----------------------------------------------------|-----------------
 * #288 | /sites → click site → header name/client/address    | CONVERT → "site detail header + KPIs"
 * #288 | Linked tenders table renders + row navigates        | SKIP — unreachable with seed data: getSite
 *      |                                                     | links tenders via Tender.siteId (or a
 *      |                                                     | notes/suburb match) and the seed never
 *      |                                                     | writes either; every seeded site shows
 *      |                                                     | Tenders (0). Seed gap → PR follow-up.
 * #288 | Linked projects table renders + row navigates       | SKIP — same root cause (projects derive
 *      |                                                     | from the linked tenders' jobs)
 * #288 | Site with no tenders/projects → empty states        | CONVERT → "fresh site lifecycle"
 * #288 | Edit site → SiteFormModal saves in place            | CONVERT → "fresh site lifecycle"
 * #288 | /sites/does-not-exist → 404 panel + back link       | CONVERT (adapted) → "unknown site id" —
 *      |                                                     | getSite returns null → API sends 200 with
 *      |                                                     | an empty body, so the designed 404 panel
 *      |                                                     | is unreachable; the error recovery panel
 *      |                                                     | renders instead. Drift → PR follow-up.
 * #288 | Throttle/block request → skeleton, error, Retry     | CONVERT → "skeleton, error banner, Retry"
 * #288 | Branch: feat/sites-detail-page, single commit       | SKIP — process/branch instruction, not a
 *      |                                                     | UI behaviour
 * #23  | Sites tab search + invalid-postcode validation      | CONVERT → "register search/filter" +
 *      |                                                     | postcode check via master-data SiteSlideOver
 * F2-01| Delete site with form submissions → blocked         | CONVERT → "delete guard" (site-001 carries
 *      |                                                     | seeded pre-start + incident submissions)
 * ─────────────────────────────────────────────────────────────────────────────
 * Residue notes: none — the created site is deleted through the UI (which also
 * exercises the happy-path delete the guard test cannot).
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const SITE_001_NAME = "Ipswich Motorway Corridor — Stage 4";
const SITE_001_CLIENT = "Queensland Transport Infrastructure";

async function openSitesRegister(page: Page) {
  await page.goto("/sites");
  await expect(page.getByRole("heading", { name: "Sites", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Search by name or address…")).toBeVisible();
}

test.describe("Batch 5 — Sites register + detail (PRs #23, #288, #344)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("register lists seeded sites; search and client filter narrow", async ({ page }) => {
    await openSitesRegister(page);
    await expect(page.getByRole("cell", { name: SITE_001_NAME })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Sandgate Stormwater Upgrade" })).toBeVisible();

    // Server-side q search.
    await page.getByPlaceholder("Search by name or address…").fill("Sandgate");
    await expect(page.getByRole("cell", { name: "Sandgate Stormwater Upgrade" })).toBeVisible();
    await expect(page.getByRole("cell", { name: SITE_001_NAME })).toBeHidden();
    await page.getByPlaceholder("Search by name or address…").fill("");

    // Client filter narrows client-side.
    await page.getByRole("combobox").selectOption({ label: "Brisbane City Council" });
    await expect(page.getByRole("cell", { name: "Sandgate Stormwater Upgrade" })).toBeVisible();
    await expect(page.getByRole("cell", { name: SITE_001_NAME })).toBeHidden();
  });

  test("site detail header, KPI strip, and tabs (site-001)", async ({ page }) => {
    await openSitesRegister(page);
    await page.getByRole("cell", { name: SITE_001_NAME }).click();
    await expect(page).toHaveURL(/\/sites\/site-001/);

    await expect(page.getByRole("heading", { name: SITE_001_NAME })).toBeVisible();
    await expect(page.getByText(SITE_001_CLIENT, { exact: true })).toBeVisible();
    // Formatted address (street, suburb, state, postcode from seed).
    await expect(page.getByText("Ipswich Motorway, Darra, QLD, 4076", { exact: true })).toBeVisible();

    // KPI strip from PR #344 (scoped — "Documents" also names a nav link).
    const kpis = page.getByLabel("Site KPIs");
    for (const label of ["Linked tenders", "Linked projects", "Documents", "Created"]) {
      await expect(kpis.getByText(label, { exact: true })).toBeVisible();
    }

    // Tab strip with live counts.
    await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Tenders \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Projects \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Documents/ })).toBeVisible();
  });

  test("fresh site lifecycle — empty states, edit in place, delete", async ({ page }) => {
    const name = `e2e-b5-site-${Date.now()}`;
    await openSitesRegister(page);
    await page.getByRole("button", { name: "+ New site" }).click();
    await expect(page.getByRole("heading", { name: "New site", exact: true })).toBeVisible();
    await page.getByLabel("Site name *").fill(name);
    await page.getByLabel("Suburb").fill("Darra");
    await page.getByLabel("Postcode").fill("4076");
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page.getByRole("heading", { name: "New site", exact: true })).toBeHidden();

    await page.getByPlaceholder("Search by name or address…").fill(name);
    await page.getByRole("cell", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    // No client assigned + both empty states (every seeded site has a tender,
    // so the empty-state item runs against this created site).
    await expect(page.getByText("No client", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Tenders (0)", exact: true }).click();
    await expect(page.getByText("No tenders linked to this site yet.")).toBeVisible();
    await page.getByRole("tab", { name: "Projects (0)", exact: true }).click();
    await expect(page.getByText("No projects linked to this site yet.")).toBeVisible();

    // Edit site → SiteFormModal saves and the page refreshes in place.
    await page.getByRole("button", { name: "Edit site", exact: true }).click();
    await expect(page.getByRole("heading", { name: `Edit site · ${name}` })).toBeVisible();
    await page.getByLabel("Access notes / known hazards").fill("e2e-b5 access note");
    await page.getByRole("button", { name: "Save changes" }).click();
    // Notes render on the Overview tab only.
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await expect(page.getByText("Access notes / hazards")).toBeVisible();
    await expect(page.getByText("e2e-b5 access note")).toBeVisible();

    // Delete (happy path — nothing linked) cleans up the run.
    await page.getByRole("button", { name: "Delete site", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete site", exact: true }).click();
    await expect(page).toHaveURL(/\/sites$/);
    // Wait for the register's post-delete fetch to settle before filtering. toHaveURL
    // resolves the instant the URL changes, but the SitesListPage's load effect is
    // still in flight; a seeded row appearing proves the initial fetch resolved and
    // the list re-rendered, so the fill() below won't race the re-render and get
    // clobbered.
    await expect(page.getByRole("cell", { name: SITE_001_NAME })).toBeVisible();
    await page.getByPlaceholder("Search by name or address…").fill(name);
    await expect(page.getByText("No sites match the current filters.")).toBeVisible();
  });

  test("delete guard — site with form submissions is blocked (F2-01)", async ({ page }) => {
    // site-001 carries seeded pre-start + incident form submissions (plus a
    // tender and a job). The 409 must name the form-submission blocker — the
    // F2-01 regression was deleting submission-bearing sites silently.
    await page.goto("/sites/site-001");
    await expect(page.getByRole("heading", { name: SITE_001_NAME })).toBeVisible();
    await page.getByRole("button", { name: "Delete site", exact: true }).first().click();

    const modal = page.getByRole("dialog");
    await expect(modal.getByText("Delete site?")).toBeVisible();
    await modal.getByRole("button", { name: "Delete site", exact: true }).click();

    await expect(modal.getByText(/Cannot delete site/)).toBeVisible();
    await expect(modal.getByText(/linked form submission\(s\)/)).toBeVisible();
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();

    // No mutation — the site is still reachable.
    await page.goto("/sites/site-001");
    await expect(page.getByRole("heading", { name: SITE_001_NAME })).toBeVisible();
  });

  test("unknown site id shows a recovery panel with a back link", async ({ page }) => {
    // PR #288 designed a "Site not found" panel, but getSite returns null for
    // missing ids and Nest serialises that as 200 with an empty body — the
    // frontend's JSON parse fails and the error recovery panel renders
    // instead. Asserting the recovery UI keeps the route covered; the drift
    // is flagged in the PR follow-up section.
    await page.goto("/sites/does-not-exist");
    await expect(page.getByRole("heading", { name: /Couldn.t load site/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "← Back to sites" }).click();
    await expect(page).toHaveURL(/\/sites$/);
  });

  test("blocked request — error banner, then working Retry", async ({ page }) => {
    // The transient loading skeleton is deliberately NOT asserted: under CI
    // timing the aborted request can settle into the error banner before the
    // skeleton is observable (racy transient state — incident-ledger
    // LL-23/LL-24 class). The durable, regression-relevant states are the
    // error banner and the post-Retry content.
    let first = true;
    await page.route("**/master-data/sites/site-002", async (route) => {
      if (first) {
        first = false;
        await route.abort();
      } else {
        await route.continue();
      }
    });

    await page.goto("/sites/site-002");
    await expect(page.getByRole("heading", { name: /Couldn.t load site/ })).toBeVisible();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Maroochydore Mixed-Use Precinct" })
    ).toBeVisible();
  });

  test("master-data sites slide-over rejects an invalid postcode", async ({ page }) => {
    // PR #23 validation item — the master-data SiteSlideOver enforces the
    // 4-digit AU postcode (the /sites SiteFormModal intentionally does not).
    await page.goto("/master-data?tab=sites");
    await page.getByRole("button", { name: "+ New site" }).click();
    await expect(page.getByRole("heading", { name: "New site", exact: true })).toBeVisible();
    await page.getByLabel("Name *").fill("e2e-b5-never-created");
    await page.getByLabel("Postcode").fill("12345");
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page.getByText("4-digit AU postcode")).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  });
});
