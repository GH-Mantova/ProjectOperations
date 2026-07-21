/**
 * Batch 5 — Clients & master-data workspace (PRs #23, #335, #337)
 *
 * Triage (full table in the PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR   | Item (truncated)                                    | Decision
 * -----|-----------------------------------------------------|-----------------
 * #337 | ?tab=workers → /resources, replace, back ≠ workers  | CONVERT → "workers tab redirects"
 * #337 | ?tab=workers&search=jane → /resources?search=jane   | CONVERT → "redirect preserves query params"
 * #337 | ?tab=sites still shows Sites tab                    | CONVERT → "tab param resolution"
 * #337 | ?tab=mystery falls back to Clients                  | CONVERT → "tab param resolution"
 * #337 | Workers → strip navigates to /resources             | CONVERT → "Workers strip navigates"
 * #335 | Open client with long-email contact                 | CONVERT → "contacts email title tooltip"
 * #335 | Open Contacts tab in client drawer                  | CONVERT → same test
 * #335 | Long emails truncate with ellipsis at ~220px        | CONVERT (title-attr assertion per batch
 *      |                                                     | prompt; pixel ellipsis not asserted — flaky)
 * #335 | Hover shows full address in browser tooltip         | CONVERT → title attribute equals full email
 * #335 | Short emails render as before                       | CONVERT → second contact renders full text
 * #23  | Master-data manual pass (tabs, search, filter,      | CONVERT → "clients list search/filter/views"
 *      | cards/table, create client, validation, Workers →)  |   + "create client" + redirect tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Residue notes (conventions: no UI delete exists → documented):
 *   • "create client" + "contact add and delete" leave one e2e-b5-client-* row
 *     per run (clients have no UI delete — only status archive). Contact
 *     delete is a soft delete by design (DELETE /contacts/:id flips
 *     isActive=false, row preserved for historical references) — the dimmed
 *     row remains visible, so one inactive e2e contact also persists per run.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const LONG_EMAIL = "daniel.reilly@brisbane.qld.gov.au";
const SHORT_EMAIL = "sienna.howard@brisbane.qld.gov.au";

async function openClientsTab(page: Page) {
  await page.goto("/master-data");
  await expect(page.getByPlaceholder("Search name, code, email")).toBeVisible();
}

/** Opens the slide-over drawer for a seeded client by its card heading. */
async function openClientDrawer(page: Page, clientName: string) {
  await openClientsTab(page);
  await page.getByRole("button", { name: clientName }).click();
  await expect(page.getByRole("heading", { name: `Edit · ${clientName}` })).toBeVisible();
}

/** Creates a client through the slide-over and waits for the drawer to close. */
async function createClient(page: Page, name: string) {
  await page.getByRole("button", { name: "+ New client" }).first().click();
  await expect(page.getByRole("heading", { name: "New client", exact: true })).toBeVisible();
  await page.getByLabel("Name *").fill(name);
  await page.getByRole("button", { name: "Create client" }).click();
  await expect(page.getByRole("heading", { name: "New client", exact: true })).toBeHidden();
}

test.describe("Batch 5 — Clients & master-data workspace (PRs #23, #335, #337)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("workers tab redirects to /resources with URL replace", async ({ page }) => {
    // Land on master-data first so goBack() has a real history entry to test
    // the replace semantics against (no /master-data?tab=workers in history).
    await openClientsTab(page);
    await page.goto("/master-data?tab=workers");
    await expect(page).toHaveURL(/\/resources$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/tab=workers/);
  });

  test("redirect preserves query params (search passthrough)", async ({ page }) => {
    await page.goto("/master-data?tab=workers&search=jane");
    await expect(page).toHaveURL(/\/resources\?search=jane$/);
  });

  test("tab param resolution — sites honoured, unknown falls back to Clients", async ({ page }) => {
    await page.goto("/master-data?tab=sites");
    await expect(page.getByRole("tab", { name: "Sites", exact: true })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByPlaceholder("Search name, code, address, suburb")).toBeVisible();

    await page.goto("/master-data?tab=mystery");
    await expect(page.getByRole("tab", { name: "Clients", exact: true })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByPlaceholder("Search name, code, email")).toBeVisible();
  });

  test("Workers → strip navigates to /resources", async ({ page }) => {
    await openClientsTab(page);
    await page.getByRole("tab", { name: "Workers" }).click();
    // §9 fold: Resources is absorbed into Workers — the tab now lands on /workers.
    await expect(page).toHaveURL(/\/workers/);
    await expect(page.getByText("Workers in scope")).toBeVisible();
  });

  test("clients list — seeded data, search, status filter, cards/table toggle", async ({ page }) => {
    await openClientsTab(page);

    // Seeded clients render as cards.
    await expect(
      page.getByRole("heading", { name: "Queensland Transport Infrastructure" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Brisbane City Council" })).toBeVisible();

    // Search narrows client-side.
    await page.getByPlaceholder("Search name, code, email").fill("Brisbane");
    await expect(page.getByRole("heading", { name: "Brisbane City Council" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Queensland Transport Infrastructure" })
    ).toBeHidden();
    await page.getByPlaceholder("Search name, code, email").fill("");

    // Status filter: no seeded INACTIVE clients → empty state with CTA.
    await page.getByRole("combobox").selectOption("INACTIVE");
    await expect(page.getByText("No clients match your filters")).toBeVisible();
    await page.getByRole("combobox").selectOption("");

    // Table view renders the column set.
    await page.getByRole("tab", { name: "Table", exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "Email" })).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Queensland Transport Infrastructure" })
    ).toBeVisible();
  });

  test("client drawer Contacts tab — truncated email exposes full address via title attribute", async ({
    page
  }) => {
    await openClientDrawer(page, "Brisbane City Council");
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();

    // Seeded BCC contacts render with flags.
    await expect(page.getByText("Daniel Reilly")).toBeVisible();
    await expect(page.getByText("Primary", { exact: true })).toBeVisible();

    // PR #335 — the email cell carries a title attribute equal to the full
    // address (the browser-native tooltip mechanism). Hover rendering itself
    // is not assertable; per batch prompt we assert the attribute.
    const longEmailCell = page.getByTitle(LONG_EMAIL);
    await expect(longEmailCell).toBeVisible();
    await expect(longEmailCell).toHaveText(LONG_EMAIL);

    // Second contact renders its email unchanged (no tooltip artefact beyond
    // the standard title attribute the component sets for every email).
    await expect(page.getByTitle(SHORT_EMAIL)).toHaveText(SHORT_EMAIL);
  });

  test("create client — validation fires, then unique client appears in list", async ({ page }) => {
    await openClientsTab(page);
    await page.getByRole("button", { name: "+ New client" }).first().click();
    await expect(page.getByRole("heading", { name: "New client", exact: true })).toBeVisible();

    // Empty name blocks submit.
    await page.getByRole("button", { name: "Create client" }).click();
    await expect(page.getByText("Required", { exact: true })).toBeVisible();

    // Email that passes native type=email checks but fails the app regex
    // (needs a dot in the domain) surfaces the custom validation message.
    const name = `e2e-b5-client-${Date.now()}`;
    await page.getByLabel("Name *").fill(name);
    await page.getByLabel("Email").fill("a@b");
    await page.getByRole("button", { name: "Create client" }).click();
    await expect(page.getByText("Invalid email", { exact: true })).toBeVisible();

    await page.getByLabel("Email").fill("qa@example.com.au");
    await page.getByRole("button", { name: "Create client" }).click();
    await expect(page.getByRole("heading", { name: "New client", exact: true })).toBeHidden();

    // Residue: clients have no UI delete — row stays (unique name, documented).
    await page.getByPlaceholder("Search name, code, email").fill(name);
    await expect(page.getByRole("heading", { name })).toBeVisible();
  });

  test("contact add and delete on an e2e-created client", async ({ page }) => {
    // Accept the contact-delete window.confirm.
    page.on("dialog", (dialog) => void dialog.accept());

    await openClientsTab(page);
    const clientName = `e2e-b5-client-${Date.now()}`;
    await createClient(page, clientName);

    await page.getByPlaceholder("Search name, code, email").fill(clientName);
    await page.getByRole("button", { name: clientName }).click();
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    await expect(page.getByText("No contacts yet")).toBeVisible();

    // Add a contact. Saving fires onChanged → the parent closes the drawer,
    // so re-open it to verify the row, then again after the delete.
    await page.getByRole("button", { name: "+ Add contact" }).click();
    await expect(page.getByRole("heading", { name: "Add contact", exact: true })).toBeVisible();
    await page.getByLabel("First name *").fill("E2e");
    await page.getByLabel("Last name *").fill("Batch5");
    await page.getByRole("dialog").getByRole("button", { name: "Add contact", exact: true }).click();

    await page.getByRole("button", { name: clientName }).click();
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    await expect(page.getByText("E2e Batch5")).toBeVisible();

    // Delete the contact via the row action (confirm dialog auto-accepted).
    // The API soft-deletes (isActive=false, row preserved for history), so
    // the row stays listed; the drawer closing confirms the mutation landed.
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: `Edit · ${clientName}` })).toBeHidden();

    await page.getByRole("button", { name: clientName }).click();
    await page.getByRole("tab", { name: "Contacts", exact: true }).click();
    await expect(page.getByText("E2e Batch5")).toBeVisible();
    await expect(page.getByText("1 contact", { exact: true })).toBeVisible();
  });
});
