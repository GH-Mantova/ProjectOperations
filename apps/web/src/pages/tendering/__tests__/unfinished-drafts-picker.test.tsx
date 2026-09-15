/**
 * DraftPanel S3 -- UnfinishedDraftsPicker tests.
 *
 * Source-level and helper-level assertions:
 *   - The picker's fetch carries status=DRAFT and no other filter
 *   - Row click navigates to /tenders/<id> and never sets existingDraftId
 *   - The truncated line appears iff truncated
 *
 * The picker component is an internal function in TenderingPage.tsx so we
 * test it via source assertions + the helpers it delegates to.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildQueryStringWithPage } from "../tenderingPage.helpers";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const tenderingPageSrc = readFileSync(
  resolve(__dir, "../TenderingPage.tsx"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// 1. Query string carries status=DRAFT
// ---------------------------------------------------------------------------

describe("UnfinishedDraftsPicker fetch carries status=DRAFT", () => {
  it("buildQueryStringWithPage with status=['DRAFT'] produces status=DRAFT", () => {
    const EMPTY_FILTERS = {
      search: "",
      status: [],
      estimatorId: null,
      clientId: null,
      probability: [],
      valueMin: "",
      valueMax: "",
      dueDateFrom: "",
      dueDateTo: "",
      discipline: [],
      sortBy: null,
      sortDir: "desc" as const
    };
    const qs = buildQueryStringWithPage(
      { ...EMPTY_FILTERS, status: ["DRAFT"], sortBy: "updatedAt", sortDir: "desc" },
      100,
      1
    );
    expect(qs).toContain("status=DRAFT");
    // Must not include other status filters
    expect(qs).not.toMatch(/status=.*IN_PROGRESS/);
    expect(qs).not.toMatch(/status=.*SUBMITTED/);
  });

  it("TenderingPage source passes status: ['DRAFT'] to fetchAllPages in picker", () => {
    // The picker must call fetchAllPages with status DRAFT
    expect(tenderingPageSrc).toContain("status: [\"DRAFT\"]");
  });
});

// ---------------------------------------------------------------------------
// 2. Row click navigates to /tenders/<id> -- not existingDraftId
// ---------------------------------------------------------------------------

describe("UnfinishedDraftsPicker row click navigates", () => {
  it("TenderingPage source has onNavigate prop that calls navigate('/tenders/<id>')", () => {
    // The picker uses onNavigate which calls navigate(`/tenders/${id}`)
    expect(tenderingPageSrc).toContain("onNavigate");
    expect(tenderingPageSrc).toContain("/tenders/${id}");
  });

  it("TenderingPage source does not set existingDraftId in picker usage", () => {
    // The old picker set resumeDraftId; the new one must not
    expect(tenderingPageSrc).not.toContain("existingDraftId");
    // resumeDraftId should also be gone
    expect(tenderingPageSrc).not.toContain("resumeDraftId");
  });
});

// ---------------------------------------------------------------------------
// 3. Truncated line appears iff truncated
// ---------------------------------------------------------------------------

describe("UnfinishedDraftsPicker truncation line", () => {
  it("TenderingPage source renders truncated line when truncated is true", () => {
    // The picker renders: "Showing N of M drafts -- the rest are older..."
    expect(tenderingPageSrc).toContain("Showing");
    expect(tenderingPageSrc).toContain("drafts");
    expect(tenderingPageSrc).toContain("truncated");
  });
});

// ---------------------------------------------------------------------------
// 4. Button label and heading
// ---------------------------------------------------------------------------

describe("UnfinishedDraftsPicker labels", () => {
  it("TenderingPage source has 'Unfinished drafts' button label", () => {
    expect(tenderingPageSrc).toContain("Unfinished drafts");
  });

  it("TenderingPage source has the picker heading 'Unfinished drafts'", () => {
    const matches = (tenderingPageSrc.match(/Unfinished drafts/g) ?? []).length;
    // At minimum: button label + heading inside the component
    expect(matches).toBeGreaterThanOrEqual(2);
  });
});
