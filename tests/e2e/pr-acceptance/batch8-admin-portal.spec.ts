/**
 * Batch 8 — Admin pages + client portal (PRs #219, #26, #29).
 *
 * Inventory conversions: AI Settings render (PR #219), rates-admin tabs +
 * inline click-to-edit (PR #29 — routed onward by batches 1 and 2), and
 * labour-rate inline-edit persistence (PR #26 — routed onward by batch 3).
 * The admin-settings role gate and portal login screen carry no UI-MANUAL
 * inventory rows; they are prompt-directed regression guards.
 *
 * PR #29 drift note: the rates admin grew from 6 tabs (as written in 2026-04)
 * to 9 tabs today — the test asserts the current 9-tab surface.
 *
 * Residue: none. The persistence test reads the current Day rate, bumps it,
 * then restores the value it read — the restore runs in a `finally` block so
 * a mid-test failure still puts the seeded value back (LL-27). After a
 * crashed run `pnpm seed` restores the canonical rates.
 */

import { expect, test } from "@playwright/test";
import { loginAsAdmin, loginAsFieldWorker, loginAsViewer } from "./helpers";

const RATE_TABS = [
  /^Labour \(\d+\)$/,
  /^Plant \(\d+\)$/,
  /^Disposal \(\d+\)$/,
  /^Saw Cutting \(\d+\)$/,
  /^Core holes \(\d+\)$/,
  /^Fuel \(\d+\)$/,
  /^Enclosures \(\d+\)$/,
  /^Other rates \(\d+\)$/,
  /^Densities \(\d+\)$/
];

test.describe("Batch 8 — Admin & portal (PRs #219, #26, #29)", () => {
  test("AI Settings page renders without stale placeholder text (PR #219)", async ({ page }) => {
    // Sean is the only seeded Super User — the Company tab is gated on it.
    await loginAsFieldWorker(page);
    await page.goto("/admin/ai-settings");

    await expect(page.getByRole("heading", { name: "AI Settings" })).toBeVisible();
    await expect(
      page.getByText("Configure AI providers, persona behaviour, and personal preferences.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Company" })).toBeVisible();
    await expect(page.getByRole("button", { name: "My Settings" })).toBeVisible();
  });

  test("rates admin renders 9 tabs with seeded counts; row click-to-edit cancels on Esc (PR #29)", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/estimate-rates");

    await expect(page.getByRole("heading", { name: "Estimate rate library" })).toBeVisible();

    // 9 tabs, every count non-zero (203 entries seeded across the library).
    await expect(page.getByRole("tab")).toHaveCount(9);
    for (const name of RATE_TABS) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }

    // Spot rows: a seeded labour rate on the default tab, and a seeded
    // Other-rates entry after switching tabs.
    const labourRow = page.getByRole("row", { name: /Demolition labourer/ });
    await expect(labourRow).toBeVisible();
    await expect(labourRow).toContainText("$600.00");

    await page.getByRole("tab", { name: /^Other rates/ }).click();
    const otherRow = page.getByRole("row", { name: /Jack hammer labour/ });
    await expect(otherRow).toBeVisible();
    await expect(otherRow).toContainText("$150.00");

    // Click row → whole row becomes inputs; Escape discards the draft.
    // Re-locating by "the row holding inputs" is required: a row's
    // accessible name derives from its cell text, so the name-based
    // locator stops resolving the moment the draft is edited.
    await otherRow.click();
    const editingRow = page.getByRole("row").filter({ has: page.getByRole("textbox") });
    await expect(editingRow).toHaveCount(1);
    const descriptionInput = editingRow.getByRole("textbox").first();
    await descriptionInput.fill("e2e-b8-discarded");
    await descriptionInput.press("Escape");
    await expect(editingRow).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Jack hammer labour/ })).toBeVisible();
  });

  test("labour rate inline edit persists across reload, then restores (PR #26)", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/estimate-rates");

    const row = page.getByRole("row", { name: /Machine operator/ });
    await expect(row).toBeVisible();

    // First $ amount in the row is the Day rate.
    const before = /\$([\d,]+\.\d{2})/.exec((await row.textContent()) ?? "");
    expect(before, "Machine operator row should show a Day rate").toBeTruthy();
    const original = Number(before![1].replace(/,/g, ""));
    const bumped = original + 1;

    const fmt = (n: number) =>
      new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

    // Editing changes the row's accessible name, so the editing row is
    // re-located as "the row holding spinbuttons" (only one row edits at
    // a time; the add-row inputs sit outside the table).
    const editingRow = page.getByRole("row").filter({ has: page.getByRole("spinbutton") });

    const setDayRate = async (target: number) => {
      // Click the Day cell specifically — focus must land in that cell's
      // input (LL-27: the old code focused the Role input regardless).
      await page.getByRole("row", { name: /Machine operator/ }).getByRole("cell").nth(1).click();
      await expect(editingRow).toHaveCount(1);
      await editingRow.getByRole("spinbutton").first().fill(String(target));
      await editingRow.getByRole("spinbutton").first().press("Enter");
      // The row must leave edit mode BEFORE the formatted value is asserted
      // (LL-27: the missing guard in the original failure).
      await expect(editingRow).toHaveCount(0);
      await expect(page.getByRole("row", { name: /Machine operator/ })).toContainText(fmt(target));
    };

    try {
      await setDayRate(bumped);
      await page.reload();
      await expect(page.getByRole("row", { name: /Machine operator/ })).toContainText(fmt(bumped));
    } finally {
      // Restore the value read at the start of the test even if an assertion
      // above failed mid-edit; reload first to clear any wedged edit state.
      await page.reload();
      await setDayRate(original);
    }
  });

  test("admin settings page renders all section tabs for an admin (prompt-directed)", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/settings");

    await expect(page.getByRole("heading", { name: "Admin settings" })).toBeVisible();
    const sections = page.getByRole("navigation", { name: "Settings sections" });
    for (const label of [
      "Notifications",
      "Email",
      "Users",
      "AI & Integrations",
      "Platform",
      "Permissions",
      "Audit log"
    ]) {
      await expect(sections.getByRole("button", { name: label })).toBeVisible();
    }

    // Tab switch renders the section content: the role → permission matrix
    // shipped in PR #429 replaced the prior "Coming soon." placeholder.
    await sections.getByRole("button", { name: "Permissions" }).click();
    await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
    await expect(page.getByTestId("roles-permissions-matrix")).toBeVisible();
  });

  test("viewer sees NoAccess on admin settings, not a silent redirect (#544)", async ({ page }) => {
    await loginAsViewer(page);
    await page.goto("/admin/settings");

    // #544 (failure honesty, sot/01 SECTION 6): non-admins are NOT bounced to the dashboard -
    // that made a permission failure look exactly like a broken page. They stay here and are
    // told which permission they lack.
    await expect(page.getByTestId("no-access")).toBeVisible();
    await expect(page).toHaveURL(/admin\/settings/);
    // NOTE: the "Admin settings" page heading REMAINS. <NoAccess/> renders in place and the
    // ShellLayout chrome is kept deliberately, so the user still knows where they are.
    // Asserting the heading is absent was a leftover from the redirect era.
  });

  test("client portal login screen renders standalone (prompt-directed)", async ({ page }) => {
    // No staff login — the portal is its own auth surface.
    await page.goto("/portal/login");

    await expect(page.getByRole("heading", { name: "Initial Services" })).toBeVisible();
    await expect(page.getByText("Client portal sign-in")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
