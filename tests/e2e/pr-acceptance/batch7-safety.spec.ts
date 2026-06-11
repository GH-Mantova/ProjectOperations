import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Batch 7 — safety reporting (PRs #81, #99).
 *
 * The structured field forms at /field/safety post straight to
 * POST /safety/incidents | /safety/hazards, which allocate the row-locked
 * IS-INC-#### / IS-HAZ-#### sequence numbers. The desktop /safety register
 * lists both. (The desktop "+ Report Incident" CTA routes into the
 * forms-engine wizard instead — that wizard's inputs have no programmatic
 * label association, so it is exercised render-only in batch7-compliance-forms.)
 *
 * Residue: incidents/hazards have no UI delete — each run leaves one IS-INC
 * and one IS-HAZ row per submitting test, e2e-b7 prefixed for traceability.
 */

async function submitIncident(page: Page, description: string): Promise<string> {
  await page.goto("/field/safety");
  await page.getByRole("button", { name: /Report Incident/ }).click();
  await expect(page.getByRole("heading", { name: "Report incident" })).toBeVisible();
  await page.getByLabel("Location *", { exact: true }).fill("E2E loading bay");
  // Wrapping-label text includes the select's option text, so getByLabel with
  // exact matching cannot reach the selects — target their accessible name.
  await page.getByRole("combobox", { name: "Type" }).selectOption("first_aid");
  await page.getByRole("combobox", { name: "Severity" }).selectOption("medium");
  await page.getByLabel("What happened *", { exact: true }).fill(description);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  // SafetyService numbers render as IS-INC### (no second hyphen).
  const toast = page.getByRole("status").filter({ hasText: /Incident IS-INC/ });
  await expect(toast).toBeVisible();
  const number = /IS-INC-?\d+/.exec((await toast.textContent()) ?? "")?.[0];
  expect(number, "incident number missing from toast").toBeTruthy();
  return number!;
}

async function submitHazard(page: Page, description: string): Promise<string> {
  await page.goto("/field/safety");
  await page.getByRole("button", { name: /Report Hazard/ }).click();
  await expect(page.getByRole("heading", { name: "Report hazard" })).toBeVisible();
  await page.getByLabel("Location *", { exact: true }).fill("E2E scaffold zone");
  await page.getByRole("combobox", { name: "Hazard type" }).selectOption("electrical");
  await page.getByRole("combobox", { name: "Risk level" }).selectOption("high");
  await page.getByLabel("What's the hazard *", { exact: true }).fill(description);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const toast = page.getByRole("status").filter({ hasText: /Hazard IS-HAZ/ });
  await expect(toast).toBeVisible();
  const number = /IS-HAZ-?\d+/.exec((await toast.textContent()) ?? "")?.[0];
  expect(number, "hazard number missing from toast").toBeTruthy();
  return number!;
}

test.describe("Batch 7 — Safety field reporting, mobile (PR #81)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("incident form submits with a unique title → IS-INC toast + My recent reports entry", async ({
    page
  }) => {
    await loginAsAdmin(page);
    const description = `e2e-b7 mobile incident ${Date.now()}`;
    const number = await submitIncident(page, description);
    expect(number).toMatch(/^IS-INC-?\d{3,}$/);

    // Back on the safety home, the new report tops "My recent reports".
    // (Scope to the list item — the toast may still display the same number.)
    await expect(page.getByText("My recent reports")).toBeVisible();
    const entry = page.getByRole("listitem").filter({ hasText: number });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText(description);
  });

  test("hazard form submits with a unique title → IS-HAZ toast + My recent reports entry", async ({
    page
  }) => {
    await loginAsAdmin(page);
    const description = `e2e-b7 mobile hazard ${Date.now()}`;
    const number = await submitHazard(page, description);
    expect(number).toMatch(/^IS-HAZ-?\d{3,}$/);

    await expect(page.getByText("My recent reports")).toBeVisible();
    const entry = page.getByRole("listitem").filter({ hasText: number });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText(description);
  });
});

test.describe("Batch 7 — Safety register, desktop (PRs #81, #99)", () => {
  test("desktop-submitted incident lands in the /safety register with its IS-INC number", async ({
    page
  }) => {
    await loginAsAdmin(page);
    const description = `e2e-b7 desktop incident ${Date.now()}`;
    const number = await submitIncident(page, description);

    await page.goto("/safety");
    await expect(page.getByRole("heading", { name: "Safety" })).toBeVisible();
    // Incidents tab is the default; the new row carries the allocated number.
    await expect(page.getByRole("tab", { name: /Incidents \(\d+\)/ })).toBeVisible();
    await expect(page.getByText(number)).toBeVisible();
    await expect(page.getByText(description)).toBeVisible();
  });

  test("hazard register tab lists the submitted IS-HAZ row; dashboard cards + report CTAs render", async ({
    page
  }) => {
    await loginAsAdmin(page);
    const description = `e2e-b7 desktop hazard ${Date.now()}`;
    const number = await submitHazard(page, description);

    await page.goto("/safety");
    for (const label of ["Open incidents", "Open hazards", "Overdue hazards"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    // Quick actions route into the structured IS-INC / IS-HAZ form flow.
    await expect(page.getByRole("link", { name: "+ Report Incident" })).toBeVisible();
    await expect(page.getByRole("link", { name: "+ Log Hazard" })).toBeVisible();

    await page.getByRole("tab", { name: /Hazards \(\d+\)/ }).click();
    await expect(page.getByText(number)).toBeVisible();
    await expect(page.getByText(description)).toBeVisible();
  });
});
