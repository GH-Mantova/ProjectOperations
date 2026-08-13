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
import { loginAsAdmin, loginAsFieldWorker, loginAsScopedAdmin, loginAsViewer } from "./helpers";


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

  // SLICE 11b: /admin/estimate-rates now redirects to /settings/reference-data.
  // The old page (EstimateRatesAdminPage) has been deleted. The two tests
  // below that previously exercised the legacy page now assert the redirect;
  // inline-edit coverage for the canonical reference-data screen lives in its
  // own spec suite (rates-lists-admin.spec.ts added in SLICE 11b).
  test("rates admin redirect — /admin/estimate-rates → /settings/reference-data (PR #29, SLICE 11b)", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/estimate-rates");
    await expect(page).toHaveURL(/\/settings\/reference-data$/);
  });

  test("labour rate redirect — /admin/estimate-rates → /settings/reference-data (PR #26, SLICE 11b)", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/estimate-rates");
    await expect(page).toHaveURL(/\/settings\/reference-data$/);
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
      "AI & Integrations"
    ]) {
      await expect(sections.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("Roles & Permissions renders at /settings/administration/roles (SLICE 8)", async ({
    page
  }) => {
    // SLICE 8: Roles and Permissions were two separate Settings pages; they
    // now render as one editable surface (AdminRolesPermissionsTab) hosted
    // at /settings/administration/roles. The old /permissions URL redirects
    // here so bookmarks keep working.
    await loginAsAdmin(page);
    await page.goto("/settings/administration/roles");
    await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
    await expect(page.getByTestId("roles-permissions-matrix")).toBeVisible();

    await page.goto("/settings/administration/permissions");
    await expect(page).toHaveURL(/\/settings\/administration\/roles$/);
    await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
  });

  test("Administration landing hub renders at /settings/administration (SLICE 16)", async ({
    page
  }) => {
    // SLICE 16: a direct visit to /settings/administration used to 404 because
    // only administration/* children were registered. AdministrationLandingPage
    // is now mounted at the bare path and lists the accessible sub-pages.
    await loginAsAdmin(page);
    await page.goto("/settings/administration");
    await expect(page).toHaveURL(/\/settings\/administration$/);
    const hub = page.getByTestId("administration-landing");
    await expect(hub).toBeVisible();
    for (const label of ["Admin settings", "Users", "Roles & Permissions", "Audit", "Platform", "Automations", "Client versions", "Map locations"]) {
      await expect(hub.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("Users admin surface renders at /settings/administration/users (SLICE 7)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/settings/administration/users");
    // AdminUsersTab renders the admin users table with an Add button.
    await expect(page.getByRole("button", { name: /Add user/i })).toBeVisible();
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

  // SLICE 17 — per-screen permission guard tests.
  test("SLICE 17: scoped user (users.view, no roles.view) reaches /administration/users, blocked at /administration/roles", async ({
    page
  }) => {
    await loginAsScopedAdmin(page);

    // Can reach the Users admin screen (has users.view).
    await page.goto("/settings/administration/users");
    await expect(page.getByTestId("no-access")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Add user/i })).toBeVisible();

    // Blocked at the Roles & Permissions screen (lacks roles.view).
    await page.goto("/settings/administration/roles");
    await expect(page.getByTestId("no-access")).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/administration\/roles$/);
  });

  test("SLICE 17: admin (all codes) reaches all seven Administration screens", async ({ page }) => {
    await loginAsAdmin(page);

    // All seven screens from the SLICE 17 mapping.
    const routes = [
      "/settings/administration/system",
      "/settings/administration/users",
      "/settings/administration/roles",
      "/settings/administration/audit",
      "/settings/administration/platform",
      "/settings/administration/automations"
    ];

    for (const route of routes) {
      await page.goto(route);
      // Fail-closed: if RequirePermissions blocks, no-access is shown.
      // Admin must see NO no-access on any of these routes.
      await expect(page.getByTestId("no-access")).not.toBeVisible({ timeout: 5000 });
    }

    // Landing hub also reachable (no outer guard after SLICE 17).
    await page.goto("/settings/administration");
    await expect(page.getByTestId("administration-landing")).toBeVisible();
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
