/**
 * Batch 6 — Contracts module (PRs #58, #59 — prompt-scope conversion)
 *
 * The PR test-plan inventory carries ZERO UI-MANUAL items for the contract
 * PRs (#58/#59/#78 all have empty item lists), so this file converts the
 * batch prompt's scope line directly: contracts list + contract detail with
 * variations, progress claims, and retention figures.
 *
 * No contracts (and no projects) exist in seed data — a contract needs a
 * project and projects are only born by tender conversion. The lifecycle test
 * therefore mints its own tender → project fixture via the API, drives the
 * whole contract lifecycle through the UI, and tears everything down with the
 * revert-to-tender cascade (which cascade-deletes the contract).
 *
 * Variation pricing/approval and claim creation use window.prompt/confirm —
 * handled with one-shot dialog handlers registered before each click.
 */

import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import { apiToken, createFixtureProject, destroyFixture } from "./api-helpers";

test.describe("Batch 6 — Contracts (PRs #58, #59)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("contracts list page renders heading, status filters, and create affordance", async ({
    page
  }) => {
    await page.goto("/contracts");
    await expect(page.getByRole("heading", { name: "Contracts", exact: true })).toBeVisible();
    await expect(
      page.getByText("One contract per project. Tracks variations, progress claims, retention,")
    ).toBeVisible();
    for (const chip of ["All", "Active", "Practical completion", "Defects liability", "Closed"]) {
      await expect(page.getByRole("button", { name: chip, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "+ New contract" })).toBeVisible();
  });

  test("contract lifecycle — create, variation walk, progress claim, retention figures", async ({
    page,
    request
  }) => {
    const token = await apiToken(request);
    const fixture = await createFixtureProject(request, token, "contract");
    try {
      // Create the contract through the UI modal.
      await page.goto("/contracts");
      await page.getByRole("button", { name: "+ New contract" }).click();
      const modal = page.getByRole("dialog");
      await expect(modal.getByRole("heading", { name: "New contract" })).toBeVisible();
      await modal.getByLabel("Project").selectOption(fixture.projectId!);
      await modal.getByLabel("Contract value (ex GST)").fill("100000");
      await modal.getByLabel("Retention %").fill("5");
      await modal.getByRole("button", { name: "Create contract" }).click();

      // Lands on the contract detail page.
      await page.waitForURL(/\/contracts\/[^/]+$/);
      await expect(page.getByRole("link", { name: "← Back to contracts" })).toBeVisible();
      await expect(page.getByText("ACTIVE", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("link", { name: new RegExp(`${fixture.projectNumber!} — `) })
      ).toBeVisible();

      // Overview: contract details + financial summary with retention figures.
      await expect(page.getByRole("heading", { name: "Contract details" })).toBeVisible();
      await expect(page.getByText("Retention %", { exact: true })).toBeVisible();
      await expect(page.getByText("5.00%", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Financial summary" })).toBeVisible();
      for (const label of [
        "Original value",
        "Approved variations",
        "Revised value",
        "Total claimed",
        "Outstanding",
        "Retention held"
      ]) {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
      }

      // Variations: add one, walk RECEIVED → PRICED → SUBMITTED → APPROVED.
      // Each transition issues an API call; the test waits on the matching
      // response before asserting the next status badge so the bounded timeout
      // doesn't expire while the request is still in flight.
      const VAR_TIMEOUT = 20_000;
      const isVariationsCall = (r: import("@playwright/test").Response) =>
        /\/variations(?:\/[^/]+(?:\/[a-z]+)?)?$/.test(r.url()) &&
        ["POST", "PATCH", "PUT"].includes(r.request().method());

      await page.getByRole("button", { name: /^Variations \(0\)$/ }).click();
      await expect(page.getByText("No variations yet.")).toBeVisible();
      await page.getByRole("button", { name: "+ Add variation" }).click();
      await page.getByPlaceholder("Variation description").fill("e2e-b6 extra rock excavation");
      const createResponse = page.waitForResponse(isVariationsCall, { timeout: VAR_TIMEOUT });
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await createResponse;
      // Scope the row assertion to the row containing the description — the
      // variations table renders description + status badge in the same row,
      // so anchoring both checks to the same row avoids racing a re-render
      // that would move the RECEIVED badge into a fresh DOM node before the
      // second global text-lookup runs.
      const variationRow = page
        .getByRole("row")
        .filter({ hasText: "e2e-b6 extra rock excavation" });
      await expect(variationRow).toHaveCount(1, { timeout: VAR_TIMEOUT });
      await expect(variationRow).toContainText("RECEIVED", { timeout: VAR_TIMEOUT });

      page.once("dialog", (d) => void d.accept("5000")); // Priced amount $
      const pricedResponse = page.waitForResponse(isVariationsCall, { timeout: VAR_TIMEOUT });
      await page.getByRole("button", { name: "Mark priced" }).click();
      await pricedResponse;
      await expect(variationRow).toContainText("PRICED", { timeout: VAR_TIMEOUT });

      const submittedResponse = page.waitForResponse(isVariationsCall, { timeout: VAR_TIMEOUT });
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await submittedResponse;
      await expect(variationRow).toContainText("SUBMITTED", { timeout: VAR_TIMEOUT });

      page.once("dialog", (d) => void d.accept("5000")); // Approved amount $
      const approvedResponse = page.waitForResponse(isVariationsCall, { timeout: VAR_TIMEOUT });
      await page.getByRole("button", { name: "Mark approved" }).click();
      await approvedResponse;
      await expect(variationRow).toContainText("APPROVED", { timeout: VAR_TIMEOUT });

      // Approved variation feeds the revised contract value on Overview.
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await expect(page.getByText("$105,000.00", { exact: true })).toBeVisible();

      // Progress claims: create (prompt for month), open the claim editor,
      // check the retention line, then submit the claim.
      await page.getByRole("button", { name: /^Progress claims \(0\)$/ }).click();
      await expect(page.getByText("No progress claims yet.")).toBeVisible();
      // dialog.accept() with no argument submits an empty string (not the
      // prompt's default), which aborts claim creation — pass the month.
      const claimMonth = new Date().toISOString().slice(0, 7);
      page.once("dialog", (d) => void d.accept(claimMonth));
      await page.getByRole("button", { name: "+ New claim" }).click();
      await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();

      await page.getByText("DRAFT", { exact: true }).click(); // select the claim row
      await expect(page.getByRole("heading", { name: "Claim line items" })).toBeVisible();
      await expect(page.getByText("Retention (5.00%)")).toBeVisible();
      await expect(page.getByText("Net this claim")).toBeVisible();

      page.once("dialog", (d) => void d.accept()); // "Submit this claim?"
      await page.getByRole("button", { name: "Submit claim" }).click();
      await expect(page.getByText("SUBMITTED", { exact: true })).toBeVisible();

      // Register row: contract listed with project pointer and retention %.
      await page.getByRole("link", { name: "← Back to contracts" }).click();
      await expect(page.getByRole("link", { name: fixture.projectNumber!, exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: "5.0%", exact: true })).toBeVisible();
    } finally {
      // Revert-to-tender cascade deletes the contract with the project.
      await destroyFixture(request, token, fixture);
    }
  });
});
