/**
 * Batch 7 — Universal activity Timeline (PR #672)
 *
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * #672 shipped the D365-style Timeline control with a seven-item manual test
 * plan and NO automated coverage. The only mention of "Timeline" anywhere in
 * tests/e2e was a comment in batch6 explaining how to work AROUND it (its
 * filter tabs render outside the tab conditionals, so a page-wide exact-text
 * match for "Progress" became a strict-mode violation). That is a spec
 * accommodating the feature, not verifying it.
 *
 * Ticking a manual checklist off a green run that never exercised the feature
 * is precisely the "wrote done — verified while the diff did not contain it"
 * failure (#476, #478) this suite exists to prevent.
 *
 * Test plan item → test
 * ─────────────────────────────────────────────────────────────────────────────
 *  3. Timeline renders above Correspondence       → "panel renders above Correspondence"
 *  4. Add a note → top of stream, author name     → "add a note"
 *  5. Files chip → attachments only; All restores → "filter chips"
 *  6. Raise an issue → System entry               → "raising an issue writes a system entry"
 *  7. Change status → Status entry                → "status change writes a status entry"
 *
 * Items 1 and 2 (`pnpm build`, `pnpm lint`) are CI's job, not this file's.
 *
 * SELECTORS
 * The component ships its own hooks — no CSS-class or text archaeology:
 *   timeline-panel · timeline-list · timeline-item[data-kind] · timeline-note-composer
 *   timeline-note-input · timeline-note-save · timeline-filter-<all|note|status|
 *   attachment|correspondence|progress|system>
 *
 * FIXTURES + RESIDUE (read before adding to this file)
 * Jobs and job issues expose no delete endpoint — batch6 excluded job creation
 * for exactly this reason — so these run against the seed job J260315-QUEE-001
 * and leave, per run:
 *   • one timeline note   (body tagged E2E-TL-<runId>)
 *   • one job issue       (titled "E2E-TL issue <runId>")
 *   • two JobStatusHistory rows — the status test moves the job and moves it
 *     BACK, so the job's own status is unchanged; only the audit trail grows.
 * All residue is greppable by the E2E-TL prefix. No test depends on residue
 * left by a previous run, and nothing here mutates another record.
 */

import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import { apiFetch, apiToken } from "./api-helpers";

const SEED_JOB_NUMBER = "J260315-QUEE-001";
const SEED_JOB_NAME = "Ipswich Motorway Stage 4 — Earthworks";

/** Distinguishes this run's residue from every previous run's. */
const runId = () => Date.now().toString(36);

async function openSeedJob(page: Page): Promise<string> {
  await page.goto("/jobs");
  await page.getByText(SEED_JOB_NAME, { exact: true }).first().click();
  await expect(page.getByText(SEED_JOB_NUMBER, { exact: true })).toBeVisible();
  await expect(page.getByTestId("timeline-panel")).toBeVisible({ timeout: 15_000 });

  // Route is /jobs/:id — take the id from the URL rather than hardcoding a
  // seed cuid, which is regenerated on every reseed.
  const jobId = new URL(page.url()).pathname.split("/").filter(Boolean).pop();
  expect(jobId, "could not resolve job id from the URL").toBeTruthy();
  return jobId as string;
}

/** The panel renders its list only once the GET /timeline round-trip settles. */
async function timelineSettled(page: Page): Promise<void> {
  await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 15_000 });
}

test.describe("Batch 7 — Universal activity Timeline (PR #672)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("panel renders above Correspondence on job detail (test plan 3)", async ({ page }) => {
    await openSeedJob(page);
    await timelineSettled(page);

    const timeline = page.getByTestId("timeline-panel");
    const correspondence = page.getByRole("heading", { name: "Correspondence", exact: true });

    await expect(timeline).toBeVisible();
    await expect(timeline.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible();
    await expect(correspondence).toBeVisible();

    // "Above" asserted geometrically, not by DOM order — DOM order can be
    // correct while CSS puts the panel somewhere else entirely, and the test
    // plan item is about what the user SEES.
    const timelineBox = await timeline.boundingBox();
    const correspondenceBox = await correspondence.boundingBox();
    expect(timelineBox, "timeline panel has no layout box").not.toBeNull();
    expect(correspondenceBox, "correspondence heading has no layout box").not.toBeNull();
    expect(timelineBox!.y).toBeLessThan(correspondenceBox!.y);

    // #672 MERGES correspondence into the timeline rather than replacing the
    // existing panel. Both must survive.
    await expect(page.getByTestId("timeline-filter-correspondence")).toBeVisible();
  });

  test("add a note — lands at the top of the stream with its author (test plan 4)", async ({
    page
  }) => {
    const body = `E2E-TL-${runId()} timeline note`;

    await openSeedJob(page);
    await timelineSettled(page);

    // Save is gated on non-empty input. Assert the gate first — otherwise a
    // broken button and a correctly-disabled button look identical.
    const save = page.getByTestId("timeline-note-save");
    await expect(save).toBeDisabled();

    await page.getByTestId("timeline-note-input").fill(body);
    await expect(save).toBeEnabled();

    const posted = page.waitForResponse(
      (r) =>
        r.url().includes("/timeline/Job/") &&
        r.url().endsWith("/notes") &&
        r.request().method() === "POST"
    );
    await save.click();
    const res = await posted;
    expect(res.status(), "POST /timeline/Job/:id/notes").toBeLessThan(400);

    // The composer clears and the list reloads only after the POST resolves.
    await expect(page.getByTestId("timeline-note-input")).toHaveValue("");
    await timelineSettled(page);

    const first = page.getByTestId("timeline-item").first();
    await expect(first).toContainText(body);
    await expect(first).toHaveAttribute("data-kind", "note");
    // authorName() falls back to "System" when author is null — a note posted
    // by the admin persona must carry a real name.
    await expect(first).not.toContainText("System");
  });

  test("filter chips — Files narrows to attachments, All restores (test plan 5)", async ({
    page
  }) => {
    await openSeedJob(page);
    await timelineSettled(page);

    const items = page.getByTestId("timeline-item");
    const totalAll = await items.count();
    expect(totalAll, "seed job has no timeline entries — fixture drift").toBeGreaterThan(0);

    await page.getByTestId("timeline-filter-attachment").click();
    await expect(page.getByTestId("timeline-filter-attachment")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Assert the KIND of every surviving row, not just that the count shrank:
    // a filter that returns nothing would also "narrow" the list.
    const filtered = await items.count();
    for (let i = 0; i < filtered; i++) {
      await expect(items.nth(i)).toHaveAttribute("data-kind", "attachment");
    }
    expect(filtered).toBeLessThanOrEqual(totalAll);

    await page.getByTestId("timeline-filter-all").click();
    await expect(page.getByTestId("timeline-filter-all")).toHaveAttribute("aria-selected", "true");
    await expect(items).toHaveCount(totalAll);
  });

  test("raising an issue writes a system entry (test plan 6)", async ({ page, request }) => {
    const title = `E2E-TL issue ${runId()}`;

    const jobId = await openSeedJob(page);
    await timelineSettled(page);
    const before = await page.getByTestId("timeline-item").count();

    const token = await apiToken(request);
    await apiFetch(request, token, "POST", `/jobs/${jobId}/issues`, {
      title,
      description: "Raised by the batch7 timeline acceptance run."
    });

    await page.reload();
    await expect(page.getByTestId("timeline-panel")).toBeVisible({ timeout: 15_000 });
    await timelineSettled(page);

    // Greater-than rather than exactly before+1: the projection may emit more
    // than one row for a single issue, and this test is about the system entry
    // appearing, not about the projection's cardinality.
    expect(await page.getByTestId("timeline-item").count()).toBeGreaterThan(before);

    await page.getByTestId("timeline-filter-system").click();
    const systemItems = page.getByTestId("timeline-item");
    await expect(systemItems.first()).toHaveAttribute("data-kind", "system");
    await expect(systemItems.filter({ hasText: title }).first()).toBeVisible();
  });

  test("status change writes a status entry (test plan 7)", async ({ page, request }) => {
    const jobId = await openSeedJob(page);
    await timelineSettled(page);

    const token = await apiToken(request);
    const detail = await apiFetch<{ status: string }>(request, token, "GET", `/jobs/${jobId}`);
    const originalStatus = detail.status;
    expect(originalStatus, "job detail carried no status").toBeTruthy();

    const nextStatus = originalStatus === "IN_PROGRESS" ? "ON_HOLD" : "IN_PROGRESS";

    try {
      await apiFetch(request, token, "PATCH", `/jobs/${jobId}/status`, { status: nextStatus });

      await page.reload();
      await expect(page.getByTestId("timeline-panel")).toBeVisible({ timeout: 15_000 });
      await timelineSettled(page);

      await page.getByTestId("timeline-filter-status").click();
      const statusItems = page.getByTestId("timeline-item");
      await expect(statusItems.first()).toHaveAttribute("data-kind", "status");
      // The entry is projected from JobStatusHistory, so it must name the
      // status the job actually moved to.
      await expect(statusItems.first()).toContainText(new RegExp(nextStatus, "i"));
    } finally {
      // Put the job back. The history rows remain — that is what an audit
      // trail is for — but this run does not change the job's own status.
      await apiFetch(request, token, "PATCH", `/jobs/${jobId}/status`, { status: originalStatus });
    }
  });
});
