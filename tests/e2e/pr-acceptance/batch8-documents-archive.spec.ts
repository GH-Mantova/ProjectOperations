/**
 * Batch 8 — Archive (§16) — long-tail sweep.
 *
 * The 2026-06-10 inventory carries NO UI-MANUAL rows for the archive
 * surface (PR #9's archive verification items were classified LOG-CHECK),
 * but the batch 8 prompt names "archive route renders standalone" as a
 * known cluster, so these tests are prompt-directed regression guards
 * rather than inventory conversions. Read-only — no residue.
 */

import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Batch 8 — Archive route (prompt-directed; no inventory rows)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("archive register renders standalone at /archive with filters and seeded rows", async ({
    page
  }) => {
    await page.goto("/archive");

    await expect(page.getByRole("heading", { name: "Archive" })).toBeVisible();
    await expect(
      page.getByText("Read-only register of closed and archived jobs")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

    // Filter strip: search + three dropdowns, all label-wrapped.
    await expect(page.getByPlaceholder("Job #, name, or client")).toBeVisible();
    for (const label of ["Client", "Year", "Status"]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }

    // Register table with the seeded archived/closed jobs (seed produces 2).
    for (const header of ["Job #", "Name", "Client", "Closed", "Status"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "View", exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^(ARCHIVED|CLOSED)$/).first()).toBeVisible();
  });

  test("archive detail opens read-only from the register's View link", async ({ page }) => {
    await page.goto("/archive");
    // Wait for the register to settle before clicking — otherwise `.first()`
    // can resolve against a stale placeholder row and the SPA transition
    // never lands on the detail URL (see flaky-batch5-sites-post-delete-race).
    const viewLink = page.getByRole("link", { name: "View", exact: true }).first();
    await expect(viewLink).toBeVisible();
    await page.waitForLoadState("networkidle");
    await viewLink.click();

    await page.waitForURL(/\/archive\/.+/);
    // Detail header is "{jobNumber} — {name}" with the read-only subtitle.
    await expect(page.getByText(/Read-only archive record/)).toBeVisible();
    // Collapsible panels render as toggle buttons ("▾ {title}").
    for (const panel of [/Job summary/, /Closeout & checklist/]) {
      await expect(page.getByRole("button", { name: panel })).toBeVisible();
    }
  });
});
