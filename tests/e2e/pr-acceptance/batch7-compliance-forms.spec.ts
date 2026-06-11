import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Batch 7 — compliance dashboard + badge parity (PRs #79, #340) and the
 * forms workspace (PRs #21, #97, #100).
 *
 * Forms note: end-to-end submission through the fill wizard is NOT covered
 * here for two reasons, both listed in the PR body follow-up section:
 *  1. BUG — opening a fresh draft at /forms/fill/:id crashes FormFillPage
 *     ("submission.templateVersion.sections is not iterable", blank page),
 *     reproducible through the real "Fill out" CTA.
 *  2. The wizard's inputs render without programmatic label association, so
 *     they are unreachable with the approved selector set.
 * Structured safety submissions are covered end-to-end in
 * batch7-safety.spec.ts via the labelled /field/safety forms instead.
 */

test.describe("Batch 7 — Compliance dashboard & badge (PRs #79, #340)", () => {
  test("compliance dashboard renders summary cards, look-ahead filters, and entity chips", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/compliance");
    await expect(page.getByRole("heading", { name: "Compliance" })).toBeVisible();
    for (const label of [
      "Expired now",
      "Expiring within 7 days",
      "Expiring within 30 days",
      "Compliance blocked"
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Days ahead")).toBeVisible();
    await expect(page.getByRole("button", { name: "Licences" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Subcontractors" })).toBeVisible();
  });

  test("sidebar Compliance badge count matches the page header alerts pill (PR #340 / F3-02)", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/compliance");
    await expect(page.getByRole("heading", { name: "Compliance" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const link = nav.getByRole("link", { name: /Compliance/ });
    await expect(link).toBeVisible();

    const pill = page.getByText(/^\d+ alerts?$/);
    if ((await pill.count()) > 0) {
      const count = parseInt((await pill.first().textContent())!, 10);
      expect(Number.isFinite(count)).toBe(true);
      // Sidebar pill renders the bare number next to the nav label.
      await expect(link.getByText(String(count), { exact: true })).toBeVisible();
    } else {
      // Zero alerts: neither the header pill nor the sidebar badge renders.
      await expect(link.getByText(/^\d+$/)).toHaveCount(0);
    }
  });
});

test.describe("Batch 7 — Forms workspace (PRs #21, #97, #100)", () => {
  test("seeded IS system templates render as cards; category chips and search narrow the grid", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/forms");
    await expect(page.getByRole("heading", { name: "Forms", exact: true })).toBeVisible();

    for (const name of [
      "Incident Report",
      "Near Miss Report",
      "Daily Pre-Start Safety Meeting",
      "Take 5 — Stop Think Act",
      "Site Induction"
    ]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }

    // Category chip narrows to safety templates only.
    await page.getByRole("button", { name: "Safety", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Incident Report", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Site Induction", exact: true })).toHaveCount(0);

    // Search (back on All) narrows by name.
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByPlaceholder("Search forms…").fill("induction");
    await expect(page.getByRole("heading", { name: "Site Induction", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Incident Report", exact: true })
    ).toHaveCount(0);
  });

  test("My submissions tab renders (table of past submissions or the empty state)", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await page.goto("/forms");
    await page.getByRole("tab", { name: /My submissions/ }).click();
    await expect(
      page
        .getByText("No submissions yet")
        .or(page.getByRole("columnheader", { name: "Form", exact: true }))
        .first()
    ).toBeVisible();
  });

  test("Analytics tab (forms.manage) shows submission stat cards", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/forms");
    await page.getByRole("tab", { name: "Analytics" }).click();
    for (const label of ["Total submissions", "Drafts", "Approved", "Overdue approvals"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });
});
