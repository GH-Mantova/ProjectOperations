import { expect, test } from "@playwright/test";
import { FIELD_WORKER, loginAsAdmin, loginAsFieldWorker, loginAsViewer } from "./helpers";
import {
  B7_PREFIX,
  WP_ADMIN_ID,
  apiToken,
  approveTimesheet,
  createB7FixtureProject,
  createSubmittedTimesheet,
  createWorkerAllocation,
  destroyFixture,
  fieldWorkerToken,
  purgeB7Fixtures,
  type B6Fixture
} from "./api-helpers";

/**
 * Batch 7 — field/mobile experience + timesheet approval workspace.
 *
 * Identity model (two seeded logins):
 *  - FIELD WORKER: sean@initialservices.net (id user-admin) is the only login
 *    linked to a WorkerProfile (wp-user-admin) — he drives the /field surface.
 *  - APPROVER: admin@projectops.local has field.manage but NO worker profile,
 *    so he reviews timesheets and naturally hits the "Mobile access not
 *    provisioned" 403 state on /field.
 *
 * The seed has no allocations, so a tender → project fixture is created via
 * the API and Sean's worker profile is allocated to it. Timesheets and
 * pre-starts cascade-delete with the project on revert-to-tender (afterAll).
 * GPS location consent is toggled back off in the test that enables it.
 */

const PROJECT_NAME = `${B7_PREFIX} fixture — FIELD`;

let fixture: B6Fixture;
let allocationId: string;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

test.beforeAll(async ({ request }) => {
  const token = await apiToken(request);
  await purgeB7Fixtures(request, token);
  fixture = await createB7FixtureProject(request, token, "FIELD");
  // Start the window in the past so API-created timesheets for prior days fit.
  allocationId = await createWorkerAllocation(
    request,
    token,
    fixture.projectId!,
    WP_ADMIN_ID,
    daysAgo(10)
  );
});

test.afterAll(async ({ request }) => {
  const token = await apiToken(request);
  await destroyFixture(request, token, fixture);
});

test.describe("Batch 7 — Field mobile experience (PRs #41, #42, #338)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    permissions: ["geolocation"],
    geolocation: { latitude: -27.4698, longitude: 153.0251 } // Brisbane CBD
  });

  test("FieldLayout at 390px — bottom nav with 5 items, 64px bar, 44px+ touch targets", async ({
    page
  }) => {
    await loginAsFieldWorker(page);
    await page.goto("/field");
    await expect(page).toHaveURL(/\/field\/allocations$/);

    const nav = page.getByRole("navigation", { name: "Field navigation" });
    await expect(nav).toBeVisible();
    for (const label of ["Home", "Pre-Start", "Timesheet", "Documents", "Safety"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    const navBox = await nav.boundingBox();
    expect(navBox?.height).toBe(64);
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box !== null && box.height >= 44).toBe(true);
    }
  });

  test("allocations list shows the fixture job card with Pre-Start and Timesheet CTAs", async ({
    page
  }) => {
    await loginAsFieldWorker(page);
    await page.goto("/field/allocations");
    await expect(page.getByRole("heading", { name: PROJECT_NAME })).toBeVisible();
    await expect(page.getByText(fixture.projectNumber!)).toBeVisible();
    const card = page.getByRole("article").filter({ hasText: PROJECT_NAME });
    await expect(card.getByRole("link", { name: "Pre-Start" })).toBeVisible();
    await expect(card.getByRole("link", { name: "Timesheet" })).toBeVisible();
  });

  test("unprovisioned admin on /field gets the Mobile access empty state; Back to web view exits (PR #338 / F3-01)", async ({
    page
  }) => {
    // admin@projectops.local has no worker profile → natural 403, no mocking.
    await loginAsAdmin(page);
    await page.goto("/field/allocations");
    await expect(page.getByText("Mobile access not provisioned")).toBeVisible();
    await expect(
      page.getByText("No worker profile is linked to your account", { exact: false })
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to web view" }).click();
    await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  });

  test("forced 500 renders the generic Couldn't load allocations empty state (PR #338)", async ({
    page
  }) => {
    await loginAsFieldWorker(page);
    await page.route("**/field/my-allocations", (route) =>
      route.fulfill({ status: 500, contentType: "text/plain", body: "boom" })
    );
    await page.goto("/field/allocations");
    await expect(page.getByText("Couldn't load allocations")).toBeVisible();
  });

  test("timesheet entry form renders; GPS consent reveals pin buttons and captures a reading", async ({
    page
  }) => {
    await loginAsFieldWorker(page);
    await page.goto("/field/allocations");
    await page
      .getByRole("article")
      .filter({ hasText: PROJECT_NAME })
      .getByRole("link", { name: "Timesheet" })
      .click();
    await expect(page.getByRole("heading", { name: "New timesheet" })).toBeVisible();

    for (const label of ["Job", "Date", "Hours worked", "Break", "Clock on", "Clock off"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("What did you work on today?")).toBeVisible();
    await expect(page.getByRole("spinbutton")).toHaveValue("8");

    // GPS clock-on consent (PR #85): opt in → pin buttons appear → capture.
    const consent = page.getByRole("checkbox");
    await expect(page.getByText("GPS clock-on")).toBeVisible();
    await consent.click();
    await expect(consent).toBeChecked();
    const pinOn = page.getByRole("button", { name: "Pin clock-on" });
    await expect(pinOn).toBeVisible();
    await expect(page.getByRole("button", { name: "Pin clock-off" })).toBeVisible();
    await pinOn.click();
    await expect(page.getByRole("button", { name: /Clock-on pinned ±\d+m/ })).toBeVisible();

    // Opt back out — consent persists on the shared worker profile.
    await consent.click();
    await expect(consent).not.toBeChecked();
    await expect(page.getByRole("button", { name: /Pin clock-on/ })).toHaveCount(0);
  });

  test("timesheet submits for today; duplicate attempt shows the friendly 409 message", async ({
    page
  }) => {
    await loginAsFieldWorker(page);
    await page.goto("/field/allocations");
    await page
      .getByRole("article")
      .filter({ hasText: PROJECT_NAME })
      .getByRole("link", { name: "Timesheet" })
      .click();
    await expect(page.getByRole("heading", { name: "New timesheet" })).toBeVisible();

    // Description is optional — submit with the defaults (job preselected via
    // the allocation link, date = today, 8 hrs).
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText(/Timesheet submitted — 8 hours/)).toBeVisible();
    await page.getByRole("button", { name: "Back to timesheets" }).click();
    await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();

    // Duplicate: same job, same (default today) date → friendly 409.
    await page.getByRole("button", { name: "+ New" }).click();
    const jobSelect = page
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: /Select a job/ }) });
    const optionValue = await jobSelect
      .getByRole("option", { name: new RegExp(B7_PREFIX) })
      .getAttribute("value");
    await jobSelect.selectOption(optionValue!);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      page.getByText("You already have a timesheet for this job today.")
    ).toBeVisible();
  });

  test("pre-start opens from the allocation; fit-for-work inline error; duplicate 409", async ({
    page
  }) => {
    await loginAsFieldWorker(page);
    await page.goto("/field/allocations");
    await page
      .getByRole("article")
      .filter({ hasText: PROJECT_NAME })
      .getByRole("link", { name: "Pre-Start" })
      .click();
    await expect(page.getByRole("heading", { name: "New pre-start" })).toBeVisible();
    await page.getByRole("button", { name: "Start", exact: true }).click();

    // Checklist opens — generic sections render (fixture project carries no
    // Asb/Civ scope, so the conditional discipline sections stay hidden).
    await expect(page.getByText("Site details")).toBeVisible();
    await expect(page.getByText("Fit for work declaration")).toBeVisible();
    await expect(page.getByText("PPE confirmed")).toBeVisible();

    // Submit without the declaration or signature → inline error blocks it.
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      page.getByText("You must confirm the fit-for-work declaration.")
    ).toBeVisible();

    // Duplicate (allocation, today) → friendly 409 on a second Start.
    await page.goto("/field/pre-start");
    await page.getByRole("button", { name: "+ New" }).click();
    const jobSelect = page
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: /Select a job/ }) });
    const optionValue = await jobSelect
      .getByRole("option", { name: new RegExp(B7_PREFIX) })
      .getAttribute("value");
    await jobSelect.selectOption(optionValue!);
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(
      page.getByText("You already have a pre-start for this job today.")
    ).toBeVisible();
  });

  test("/field/documents groups documents by project allocation", async ({ page }) => {
    await loginAsFieldWorker(page);
    await page.goto("/field/documents");
    await expect(page.getByRole("heading", { name: new RegExp(PROJECT_NAME) })).toBeVisible();
    await expect(page.getByText("No documents uploaded for this project yet.")).toBeVisible();
  });
});

test.describe("Batch 7 — Timesheet approval workspace (PR #42)", () => {
  test("submitted timesheet appears in Pending approval; Approve removes the row with a toast", async ({
    page,
    request
  }) => {
    const token = await fieldWorkerToken(request);
    const desc = `e2e-b7-approve-${Date.now()}`;
    await createSubmittedTimesheet(request, token, allocationId, daysAgo(1), desc);

    await loginAsAdmin(page);
    await page.goto("/timesheets/approval");
    await expect(page.getByRole("heading", { name: "Timesheets" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: desc });
    await expect(row).toBeVisible();
    await expect(row).toContainText(FIELD_WORKER.workerName);
    await expect(row).toContainText(fixture.projectNumber!);

    await row.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("status")).toHaveText("Timesheet approved");
    await expect(row).toHaveCount(0);
  });

  test("Return flow — sub-10-char reason keeps the button disabled; valid reason returns to DRAFT with worker-visible pill + reason", async ({
    page,
    request
  }) => {
    const token = await fieldWorkerToken(request);
    const desc = `e2e-b7-return-${Date.now()}`;
    await createSubmittedTimesheet(request, token, allocationId, daysAgo(2), desc);

    await loginAsAdmin(page);
    await page.goto("/timesheets/approval");
    const row = page.getByRole("row").filter({ hasText: desc });
    await row.getByRole("button", { name: "Return", exact: true }).click();

    const reason = page.getByLabel(/Reason for returning/);
    const confirm = page.getByRole("button", { name: "Return to worker" });
    await reason.fill("short");
    await expect(confirm).toBeDisabled(); // min-10-chars guard
    await reason.fill("Hours look wrong — please fix and resubmit.");
    await confirm.click();
    await expect(page.getByRole("status")).toContainText("Timesheet returned to Sean Lattin");

    // Worker side: switch sessions to Sean — his card shows the Returned pill
    // (DRAFT + rejectedReason) and the reason line.
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await loginAsFieldWorker(page);
    await page.goto("/field/timesheet");
    await expect(page.getByText("Returned", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Returned: Hours look wrong/)).toBeVisible();
  });

  test("bulk approve — select 3 pending rows, Approve selected, single combined toast", async ({
    page,
    request
  }) => {
    const token = await fieldWorkerToken(request);
    const stamp = Date.now();
    const descs = [0, 1, 2].map((n) => `e2e-b7-bulk${n}-${stamp}`);
    for (const [i, desc] of descs.entries()) {
      await createSubmittedTimesheet(request, token, allocationId, daysAgo(3 + i), desc);
    }

    await loginAsAdmin(page);
    await page.goto("/timesheets/approval");
    for (const desc of descs) {
      await page.getByRole("row").filter({ hasText: desc }).getByRole("checkbox").check();
    }
    await expect(page.getByText("3 selected")).toBeVisible();
    await page.getByRole("button", { name: "Approve selected" }).click();
    await expect(page.getByRole("status")).toHaveText("3 timesheets approved");
    for (const desc of descs) {
      await expect(page.getByRole("row").filter({ hasText: desc })).toHaveCount(0);
    }
  });

  test("All timesheets — APPROVED drawer hides actions; SUBMITTED drawer shows Approve/Return", async ({
    page,
    request
  }) => {
    const workerToken = await fieldWorkerToken(request);
    const adminToken = await apiToken(request);
    const stamp = Date.now();
    // Keep descriptions under the All-tab 40-char truncation.
    const approvedDesc = `e2e-b7-all-app-${stamp}`;
    const submittedDesc = `e2e-b7-all-sub-${stamp}`;
    const approvedId = await createSubmittedTimesheet(
      request,
      workerToken,
      allocationId,
      daysAgo(6),
      approvedDesc
    );
    await approveTimesheet(request, adminToken, approvedId);
    await createSubmittedTimesheet(request, workerToken, allocationId, daysAgo(7), submittedDesc);

    await loginAsAdmin(page);
    await page.goto("/timesheets/approval");
    await page.getByRole("tab", { name: "All timesheets" }).click();

    await page.getByRole("combobox", { name: "Status" }).selectOption("APPROVED");
    await page.getByRole("row").filter({ hasText: approvedDesc }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Approved", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Return", exact: true })).toHaveCount(0);
    await drawer.getByRole("button", { name: "✕" }).click();

    await page.getByRole("combobox", { name: "Status" }).selectOption("SUBMITTED");
    await page.getByRole("row").filter({ hasText: submittedDesc }).click();
    await expect(drawer.getByRole("button", { name: "Approve" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Return", exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "✕" }).click();
  });

  test("user without field.manage is redirected from /timesheets/approval to /", async ({
    page
  }) => {
    await loginAsViewer(page);
    await page.goto("/timesheets/approval");
    await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
