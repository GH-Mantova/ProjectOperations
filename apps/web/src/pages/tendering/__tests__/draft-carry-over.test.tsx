/**
 * DraftPanel S3 -- DraftCarryOverStrip + selectCarryOverRows tests.
 *
 * Follows the pattern from draft-progress-panel.test.tsx:
 *   - renderToStaticMarkup for strip rendering (no jsdom)
 *   - pure logic assertions for selectCarryOverRows
 *   - source-level assertions for TenderDetailPage behaviour claims
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  selectCarryOverRows,
  deriveDraftCompleteness,
  type BuilderDraft,
  type PackageRef,
  type MatrixCell
} from "../newTenderWizard.helpers";
import { DraftCarryOverStrip, type DraftCarryOverStripProps } from "../DraftCarryOverStrip";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

// ---------------------------------------------------------------------------
// Fixtures -- a "state-4a" snapshot: packages + builders + documents outstanding
// ---------------------------------------------------------------------------

const builder: BuilderDraft = {
  clientId: "c1",
  clientName: "Acme",
  contactId: null, // missing contact -> partial
  submissionDate: null // missing submission date
};

const pkg: PackageRef = {
  id: "p1",
  disciplineItemId: "d1",
  value: "EARTHWORKS",
  label: "Earthworks",
  sortOrder: 1
};

const cell: MatrixCell = { tenderClientId: "tc1", tenderPackageId: "p1" };

// No packages selected -> packages outstanding; no builders fixed; no docs
const noPackageTender = { title: "Test", siteId: "s1", estimatorUserId: "u1" };

const state4aCompleteness = deriveDraftCompleteness(
  noPackageTender,
  [builder],
  [], // no packages -> outstanding
  [],
  [], // no docs -> outstanding
  null // no rate set
);

// ---------------------------------------------------------------------------
// 1. selectCarryOverRows -- "full" mode
// ---------------------------------------------------------------------------

describe("selectCarryOverRows -- full mode", () => {
  it("returns packages, builders, documents but never rates/ai/review", () => {
    const rows = selectCarryOverRows(state4aCompleteness, "full");
    const steps = rows.map((r) => r.step);
    expect(steps).toContain("builders");
    expect(steps).toContain("packages");
    expect(steps).toContain("documents");
    expect(steps).not.toContain("rates");
    expect(steps).not.toContain("ai");
    expect(steps).not.toContain("review");
  });

  it("does not include project when it is ready", () => {
    // project is ready in state4aCompleteness (title+site+estimator all set)
    const rows = selectCarryOverRows(state4aCompleteness, "full");
    const steps = rows.map((r) => r.step);
    expect(steps).not.toContain("project");
  });

  it("includes project when it is outstanding", () => {
    const noProjectTender = { title: "", siteId: null, estimatorUserId: null };
    const comp = deriveDraftCompleteness(noProjectTender, [], [], [], [], null);
    const rows = selectCarryOverRows(comp, "full");
    const steps = rows.map((r) => r.step);
    expect(steps).toContain("project");
  });
});

// ---------------------------------------------------------------------------
// 2. selectCarryOverRows -- "light" mode
// ---------------------------------------------------------------------------

describe("selectCarryOverRows -- light mode", () => {
  it("returns only builders and documents (when outstanding)", () => {
    const rows = selectCarryOverRows(state4aCompleteness, "light");
    const steps = rows.map((r) => r.step);
    expect(steps).toContain("builders");
    expect(steps).toContain("documents");
    expect(steps).not.toContain("packages");
    expect(steps).not.toContain("project");
    expect(steps).not.toContain("rates");
  });

  it("excludes documents when partial (files > 0)", () => {
    // Documents partial (some files) -> light should not include it
    const comp = deriveDraftCompleteness(
      noPackageTender,
      [builder],
      [],
      [],
      [{ id: "doc-1" }], // partial -> state is "partial" not "outstanding"
      null
    );
    const rows = selectCarryOverRows(comp, "light");
    const steps = rows.map((r) => r.step);
    expect(steps).not.toContain("documents");
  });

  it("excludes builders when ready", () => {
    const fullBuilder: BuilderDraft = {
      clientId: "c1",
      clientName: "Acme",
      contactId: "contact-1",
      submissionDate: "2026-10-01"
    };
    const comp = deriveDraftCompleteness(noPackageTender, [fullBuilder], [], [], [], null);
    const rows = selectCarryOverRows(comp, "light");
    const steps = rows.map((r) => r.step);
    expect(steps).not.toContain("builders");
  });
});

// ---------------------------------------------------------------------------
// 3. Snapshot row for builders disappears once live payload shows it fixed
// ---------------------------------------------------------------------------

describe("DraftCarryOverStrip -- snapshot row removal when live data shows fixed", () => {
  it("drops a builders row from snapshot when live tenderClients are now complete", () => {
    const tender = {
      id: "t-1",
      status: "IN_PROGRESS",
      draftCarryOver: {
        capturedAt: "2026-09-15T10:00:00.000Z",
        rows: [
          { step: "builders", text: "Acme: no contact selected." },
          { step: "packages", text: "No packages selected." }
        ]
      }
    };
    // Live tenderClients: now complete (has contact and submission date)
    const tenderClients = [
      {
        id: "tc1",
        client: { id: "c1", name: "Acme" },
        contact: { id: "contact-1" },
        primaryContactId: "contact-1",
        submissionDate: "2026-10-01"
      }
    ];
    const html = renderToStaticMarkup(
      React.createElement(DraftCarryOverStrip, {
        tender,
        tenderClients,
        tenderDocuments: [{ id: "doc-1" }],
        authFetch: vi.fn() as DraftCarryOverStripProps["authFetch"],
        onDismissed: vi.fn()
      })
    );
    // builders fixed -> only packages row remains (plain text, no link)
    expect(html).not.toContain("draft-carry-over-row-builders");
    expect(html).toContain("draft-carry-over-row-packages");
  });
});

// ---------------------------------------------------------------------------
// 4. Strip renders nothing when dismissedAt is set
// ---------------------------------------------------------------------------

describe("DraftCarryOverStrip -- dismissedAt suppresses rendering", () => {
  it("renders nothing when draftCarryOver.dismissedAt is present", () => {
    const tender = {
      id: "t-1",
      status: "IN_PROGRESS",
      draftCarryOver: {
        capturedAt: "2026-09-15T10:00:00.000Z",
        rows: [{ step: "builders", text: "Acme: no contact selected." }],
        dismissedAt: "2026-09-16T10:00:00.000Z"
      }
    };
    const html = renderToStaticMarkup(
      React.createElement(DraftCarryOverStrip, {
        tender,
        tenderClients: [],
        tenderDocuments: [],
        authFetch: vi.fn() as DraftCarryOverStripProps["authFetch"],
        onDismissed: vi.fn()
      })
    );
    expect(html).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 5. Strip renders nothing when row set is empty
// ---------------------------------------------------------------------------

describe("DraftCarryOverStrip -- empty row set suppresses rendering", () => {
  it("renders nothing when snapshot has zero rows and live is also empty", () => {
    const tender = {
      id: "t-1",
      status: "IN_PROGRESS",
      draftCarryOver: {
        capturedAt: "2026-09-15T10:00:00.000Z",
        rows: [] // empty snapshot
      }
    };
    // Live: everything fixed
    const tenderClients = [
      {
        id: "tc1",
        client: { id: "c1", name: "Acme" },
        contact: { id: "contact-1" },
        primaryContactId: "contact-1",
        submissionDate: "2026-10-01"
      }
    ];
    const html = renderToStaticMarkup(
      React.createElement(DraftCarryOverStrip, {
        tender,
        tenderClients,
        tenderDocuments: [{ id: "doc-1" }],
        authFetch: vi.fn() as DraftCarryOverStripProps["authFetch"],
        onDismissed: vi.fn()
      })
    );
    expect(html).toBe("");
  });

  it("renders nothing when status is DRAFT (not IN_PROGRESS)", () => {
    const tender = {
      id: "t-1",
      status: "DRAFT",
      draftCarryOver: {
        rows: [{ step: "builders", text: "Acme: no contact." }]
      }
    };
    const html = renderToStaticMarkup(
      React.createElement(DraftCarryOverStrip, {
        tender,
        tenderClients: [],
        tenderDocuments: [],
        authFetch: vi.fn() as DraftCarryOverStripProps["authFetch"],
        onDismissed: vi.fn()
      })
    );
    expect(html).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 6. Source assertions -- TenderDetailPage
// ---------------------------------------------------------------------------

describe("TenderDetailPage source assertions (DraftPanel S3)", () => {
  const src = readFileSync(
    resolve(__dir, "../TenderDetailPage.tsx"),
    "utf-8"
  );

  it("does not contain 'submissionDate: null' (must use tc.submissionDate ?? null)", () => {
    expect(src).not.toMatch(/submissionDate:\s*null/);
  });

  it("contains DraftCarryOverStrip import and mount (at least 2 occurrences)", () => {
    const matches = (src.match(/DraftCarryOverStrip/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });

  it("changeStatus sends draftCarryOver only from DRAFT", () => {
    // Must reference tender.status === "DRAFT" guard before sending draftCarryOver
    expect(src).toContain('tender.status === "DRAFT"');
    expect(src).toContain("draftCarryOver");
  });
});
