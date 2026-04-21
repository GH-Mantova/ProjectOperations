import { expect, test, type Page } from "@playwright/test";

const credentials = {
  email: "admin@projectops.local",
  password: "Password123!"
};
const apiBaseUrl = "http://127.0.0.1:3000/api/v1";

type TenderListItem = {
  id: string;
  tenderNumber: string;
  title: string;
};

type TenderActivityItem = {
  id: string;
  activityType: string;
  title: string;
  status: string;
  dueAt?: string | null;
  assignedUser?: { firstName: string; lastName: string } | null;
};

type ExpectedCommunicationQueueItem = {
  id: string;
  title: string;
  owner: string;
  activityType: string;
  timingPrefix: string;
  isOverdue: boolean;
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  // The Password <label> wraps both the input and a show-password toggle
  // button, so getByLabel('Password') resolves to two elements under strict
  // mode. Target the input by its unique placeholder instead.
  await page.getByPlaceholder("Password").fill(credentials.password);
  // Login button was renamed to "Sign in" and the dashboard heading is now
  // driven by the DashboardCanvas title ("Operations Overview") — both
  // changed in the S7 login/dashboard redesigns.
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
}

async function fetchAuthedJson<T>(page: Page, path: string): Promise<T> {
  // Retry transient network failures — Firefox in CI occasionally sees
  // ECONNRESET when the API closes the connection before the request
  // completes. Three tries with a 500ms backoff is enough in practice.
  const token = await page.evaluate(() => window.localStorage.getItem("project-ops.accessToken"));
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.request.get(`${apiBaseUrl}${path}`, { headers });
      if (!response.ok()) {
        throw new Error(`Request failed for ${path}: ${response.status()}`);
      }
      return (await response.json()) as T;
    } catch (err) {
      lastError = err as Error;
      if (attempt < 3) await page.waitForTimeout(500);
    }
  }
  throw lastError ?? new Error(`Request failed for ${path}`);
}

async function loadTenderIndex(page: Page) {
  // Previously this intercepted page traffic with waitForResponse, but that
  // matched any /api/v1/tenders* request (including /tenders/:id/activities)
  // and hit "No resource with given identifier found" when the body had been
  // consumed. Fetch directly with the stored access token instead.
  await page.goto("/tenders/pipeline");
  // Firefox sends the first API request slightly later than Chromium/WebKit —
  // a brief settle prevents an early ECONNRESET race.
  await page.waitForTimeout(500);
  const data = await fetchAuthedJson<{ items: TenderListItem[] }>(page, "/tenders?page=1&pageSize=100");
  return data.items;
}

function buildExpectedCommunicationQueue(activities: TenderActivityItem[]) {
  return activities
    .filter((item) => item.status !== "DONE" && item.status !== "CLOSED" && item.status !== "RECORDED")
    .map((item) => {
      const dueTime = item.dueAt ? new Date(item.dueAt).getTime() : null;
      const isOverdue = dueTime !== null && dueTime < Date.now();
      const activityType = item.activityType.replaceAll("_", " ");

      return {
        id: item.id,
        title: item.title,
        owner: item.assignedUser ? `${item.assignedUser.firstName} ${item.assignedUser.lastName}` : "Unassigned",
        activityType,
        timingPrefix: `${activityType} | ${isOverdue ? "Overdue" : "Due"}`,
        isOverdue,
        dueTime
      };
    })
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1;
      if (left.dueTime === null && right.dueTime !== null) return 1;
      if (right.dueTime === null && left.dueTime !== null) return -1;
      if (left.dueTime !== null && right.dueTime !== null && left.dueTime !== right.dueTime) {
        return left.dueTime - right.dueTime;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, 4)
    .map(({ dueTime: _dueTime, ...item }) => item);
}

async function findTenderWithCommunicationQueue(page: Page, tenders: TenderListItem[]) {
  for (const tender of tenders) {
    const activities = await fetchAuthedJson<TenderActivityItem[]>(page, `/tenders/${tender.id}/activities`);
    const queue = buildExpectedCommunicationQueue(activities);
    if (queue.length > 0) {
      return { tender, queue };
    }
  }

  throw new Error("Expected at least one tender with open communication queue items.");
}

async function dragTenderCardToColumn(page: Page, sourceSelector: string, targetSelector: string) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.locator(sourceSelector).dispatchEvent("dragstart", { dataTransfer });
  await page.locator(targetSelector).dispatchEvent("dragenter", { dataTransfer });
  await page.locator(targetSelector).dispatchEvent("dragover", { dataTransfer });
  await page.locator(targetSelector).dispatchEvent("drop", { dataTransfer });
  await page.locator(sourceSelector).dispatchEvent("dragend", { dataTransfer });
}

function requireTenderByTitle(items: TenderListItem[], title: string) {
  const tender = items.find((item) => item.title.toLowerCase() === title.toLowerCase());
  expect(tender, `Expected seeded tender titled "${title}" to exist`).toBeTruthy();
  return tender!;
}

test.describe("Tendering browser verification", () => {
  test("loads dashboard and core tendering routes", async ({ page }) => {
    await login(page);

    await page.goto("/tenders");
    // Old subtitle ("Where the pipeline needs attention this week") is gone;
    // the landing page now shows the "Tendering / Pipeline" header.
    await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();

    await page.goto("/tenders/pipeline");
    await expect(page.getByRole("heading", { name: "Tender Pipeline" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Forecast" })).toBeVisible();

    await page.goto("/tenders/create");
    await expect(page.getByText("Capture the tender before work starts scattering.")).toBeVisible();
    await expect(page.getByText("Relationship data")).toBeVisible();

    await page.goto("/tenders/workspace");
    await expect(page.getByText("No tender selected.")).toBeVisible();
  });

  test("verifies tendering register interactions and workspace activity context", async ({ page }) => {
    await login(page);
    await page.goto("/tenders/pipeline");

    await page.getByRole("button", { name: "List" }).click();
    await expect(page.getByText("Add activity").first()).toBeVisible();

    const probabilityFilter = page.locator("select").filter({ has: page.locator("option[value=\"OVER_70\"]") }).first();
    await probabilityFilter.selectOption("OVER_70");
    await expect(page.getByText("pipeline total")).toBeVisible();

    await page.getByRole("button", { name: "Forecast" }).click();
    await expect(page.getByText("Forecast window")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add activity" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Pipeline" }).click();
    await page.getByRole("heading", { name: /western corridor traffic switch/i }).dblclick();
    await expect(page.getByText("Deal sidebar", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Activity", exact: true }).click();
    await expect(page.getByText("Activity Focus", { exact: true })).toBeVisible();
    await expect(page.getByText("Communication View", { exact: true })).toBeVisible();
    await expect(page.getByText("Relationship Map", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "By owner" })).toBeVisible();

    await page.getByRole("button", { name: "Overdue" }).click();
    await expect(page.getByText("Activity Feed", { exact: true })).toBeVisible();
  });

  test("supports board drag prompts and modal workspace close or reopen behavior", async ({ page }) => {
    await login(page);
    await loadTenderIndex(page);

    const boardCard = page.locator(".tendering-board-card__open").filter({ hasText: "Western corridor traffic switch" }).first();
    const convertedColumn = page.locator(".tendering-board__column").filter({ has: page.getByText("Converted", { exact: true }) }).first();
    const boardDialog = page.getByRole("dialog");

    await expect(boardCard).toBeVisible();
    await dragTenderCardToColumn(
      page,
      ".tendering-board-card__open:has-text('Western corridor traffic switch')",
      ".tendering-board__column:has-text('Converted')"
    );

    await expect(boardDialog.getByRole("heading", { name: "Create a live job from this tender?" })).toBeVisible();
    await expect(boardDialog.getByText("Board stage move", { exact: true })).toBeVisible();
    await boardDialog.getByRole("button", { name: "No" }).click();
    await expect(boardDialog).not.toBeVisible();

    await page.getByRole("heading", { name: /western corridor traffic switch/i }).dblclick();
    const workspaceScroll = page.locator(".tendering-workspace-scroll").first();
    await expect(page.getByText("Deal sidebar", { exact: true })).toBeVisible();
    await expect(workspaceScroll).toBeVisible();

    const scrollTop = await workspaceScroll.evaluate((element) => {
      element.scrollTop = 160;
      return element.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText("Deal sidebar", { exact: true })).not.toBeVisible();

    await page
      .locator(".tendering-board-card")
      .filter({ hasText: "Western corridor traffic switch" })
      .first()
      .getByRole("button", { name: "Add activity", exact: true })
      .click();
    await expect(page.getByText("Activity Focus", { exact: true })).toBeVisible();
    await expect(page.getByText("Deal sidebar", { exact: true })).toBeVisible();
  });

  test("loads dedicated workspace from tender id links and supports stakeholder save or revert", async ({ page }) => {
    await login(page);
    const tenders = await loadTenderIndex(page);
    const linkedTender = requireTenderByTitle(tenders, "Western corridor traffic switch");

    await page.goto(`/tenders/workspace?tenderId=${linkedTender.id}`);
    await expect(page.getByRole("heading", { name: `${linkedTender.tenderNumber} - ${linkedTender.title}` })).toBeVisible();
    await expect(page.getByText("No tender selected.", { exact: true })).not.toBeVisible();
    await expect(page.getByText("Relationship Map", { exact: true })).toBeVisible();

    const stakeholderCard = page.locator(".tendering-feed-item").filter({ has: page.getByText("Role and notes save when you leave the field.") }).first();
    const notesField = stakeholderCard.getByLabel("Relationship notes");
    const roleField = stakeholderCard.getByLabel("Stakeholder role");
    const saveButton = stakeholderCard.getByRole("button", { name: "Save stakeholder" });
    const revertButton = stakeholderCard.getByRole("button", { name: "Revert" });
    const originalNotes = await notesField.inputValue();
    const originalRole = await roleField.inputValue();
    const revertedNotes = `${Date.now()} pending revert`;
    const candidateRoles = ["Primary client", "Procurement contact", "Approver", "Reviewer", "Awarded party", "Delivery stakeholder", ""];
    const savedRole = candidateRoles.find((value) => value !== originalRole) ?? "Reviewer";

    await notesField.fill(revertedNotes);
    await expect(revertButton).toBeEnabled();
    await revertButton.click();
    await expect(notesField).toHaveValue(originalNotes);
    await expect(saveButton).toBeDisabled();

    await roleField.selectOption(savedRole);
    await expect(saveButton).toBeEnabled();
    const saveResponsePromise = page.waitForResponse(
      (response) => response.url().includes(`/api/v1/tenders/${linkedTender.id}`) && response.request().method() === "PATCH"
    );
    await saveButton.click();
    expect((await saveResponsePromise).ok()).toBeTruthy();
    await expect(saveButton).toBeDisabled();
    await expect(roleField).toHaveValue(savedRole);
  });

  test("keeps the communication queue ordered by live due priority and marks overdue items", async ({ page }) => {
    await login(page);
    const tenders = await loadTenderIndex(page);
    const { tender, queue } = await findTenderWithCommunicationQueue(page, tenders);

    await page.goto(`/tenders/workspace?tenderId=${tender.id}`);
    await page.getByRole("button", { name: "Activity", exact: true }).click();

    const queueSection = page.locator(".tendering-communication-queue");
    await expect(queueSection.getByText("Communication queue", { exact: true })).toBeVisible();
    await expect(queueSection.getByText(queue.some((item) => item.isOverdue) ? "Overdue inside queue" : "Next 4 open items", { exact: true })).toBeVisible();

    const queueItems = queueSection.locator(".tendering-focus-list__item");
    await expect(queueItems).toHaveCount(queue.length);

    for (const [index, item] of queue.entries()) {
      const queueItem = queueItems.nth(index);
      await expect(queueItem.locator("strong")).toHaveText(item.title);
      await expect(queueItem.getByText(item.owner, { exact: true })).toBeVisible();
      await expect(queueItem.getByText(new RegExp(`^${item.timingPrefix.replace("|", "\\|")}`))).toBeVisible();
    }
  });

  test("switches dedicated workspace tenders cleanly when direct links change", async ({ page }) => {
    await login(page);
    const tenders = await loadTenderIndex(page);
    expect(tenders.length).toBeGreaterThan(1);

    const [firstTender, secondTender] = tenders;

    await page.goto(`/tenders/workspace?tenderId=${firstTender.id}`);
    await expect(page.getByRole("heading", { name: `${firstTender.tenderNumber} - ${firstTender.title}` })).toBeVisible();

    await page.getByRole("button", { name: "Activity", exact: true }).click();
    await expect(page.getByText("Communication View", { exact: true })).toBeVisible();

    await page.goto(`/tenders/workspace?tenderId=${secondTender.id}`);
    await expect(page.getByRole("heading", { name: `${secondTender.tenderNumber} - ${secondTender.title}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: `${firstTender.tenderNumber} - ${firstTender.title}` })).not.toBeVisible();
    await expect(page.getByText("Relationship Map", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Overview", exact: true })).toHaveClass(/tab-button--active/);
  });
});
