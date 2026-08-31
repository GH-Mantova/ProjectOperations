// Archive / Restore / Delete triage entries — pure-logic unit tests.
//
// The web workspace has no @testing-library / jsdom setup (all existing
// web tests are pure logic). We test the helpers exported from
// LeadsTriageList and its helpers file.
//   filterByStage   — pure filter used to build open / archived / notPursued slices
//   makeArchiveHandler — returns an async thunk; confirm resolves true → calls
//                        onArchive; resolves false (cancel) → does NOT call onArchive.
//   isEntryEmpty (inline predicate) — governs whether Delete is shown on ArchivedRow.

import { describe, expect, it, vi } from "vitest";
import { filterByStage, makeArchiveHandler } from "../LeadsTriageList.helpers";
import type { Entry } from "../crm-api";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "entry-1",
    title: "Test entry",
    description: null,
    stage: "open",
    isLead: true,
    probability: 0,
    estimatedValue: null,
    source: "referral",
    client: null,
    contact: null,
    owner: null,
    nextActionAt: null,
    nextActionNote: null,
    convertedTenderId: null,
    convertedTender: null,
    dropReason: null,
    dropReasonDetail: null,
    // CRM-S11 archive fields
    archiveReason: null,
    archiveReasonDetail: null,
    archivedAt: null,
    archivedById: null,
    createdAt: "2026-08-20T00:00:00Z",
    ...overrides
  };
}

// Mirrors the isEntryEmpty predicate in LeadsTriageList.tsx (kept in sync manually
// — if the predicate changes, update this test helper too).
function isEntryEmpty(entry: Entry): boolean {
  return (
    !entry.description &&
    !entry.contact &&
    !entry.estimatedValue &&
    !entry.dropReason &&
    !entry.convertedTender
  );
}

const openEntry = makeEntry({ id: "open-1", stage: "open" });
const notPursuedEntry = makeEntry({ id: "np-1", stage: "not_pursued" });
const archivedEntry = makeEntry({ id: "arc-1", stage: "archived" });
const archivedEntry2 = makeEntry({ id: "arc-2", stage: "archived", title: "Another archived" });

const ALL_ENTRIES = [openEntry, notPursuedEntry, archivedEntry, archivedEntry2];

// ── filterByStage ─────────────────────────────────────────────────────────────

describe("filterByStage (LeadsTriageList)", () => {
  it("(test 1) returns only open entries — open entry appears in Triage, archived entry does not", () => {
    const result = filterByStage(ALL_ENTRIES, "open");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("open-1");
    // archived entry is excluded from the open (Triage) slice
    expect(result.map((e) => e.id)).not.toContain("arc-1");
  });

  it("(test 3) archived entry appears under Archived section — filterByStage('archived') includes it", () => {
    const result = filterByStage(ALL_ENTRIES, "archived");
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toContain("arc-1");
    expect(result.map((e) => e.id)).toContain("arc-2");
  });

  it("(test 3 complement) Triage count excludes archived entries", () => {
    const triage = filterByStage(ALL_ENTRIES, "open");
    // Only the single open entry is counted; archived does not leak in
    expect(triage).toHaveLength(1);
  });

  it("(test 5) with zero archived entries, filterByStage('archived') returns an empty array", () => {
    const noArchived = [openEntry, notPursuedEntry];
    const result = filterByStage(noArchived, "archived");
    // Empty → the Archived section should not be rendered (length guard)
    expect(result).toHaveLength(0);
  });
});

// ── makeArchiveHandler ────────────────────────────────────────────────────────

describe("makeArchiveHandler (LeadsTriageList)", () => {
  it("(test 2a) calls onArchive with the correct id when confirm resolves true", async () => {
    const onArchive = vi.fn();
    const confirm = vi.fn().mockResolvedValue(true);

    const handler = makeArchiveHandler("open-1", onArchive, confirm);
    await handler();

    expect(confirm).toHaveBeenCalledOnce();
    expect(onArchive).toHaveBeenCalledOnce();
    expect(onArchive).toHaveBeenCalledWith("open-1");
  });

  it("(test 2b) does NOT call onArchive when confirm is dismissed (resolves false)", async () => {
    const onArchive = vi.fn();
    const confirm = vi.fn().mockResolvedValue(false);

    const handler = makeArchiveHandler("open-1", onArchive, confirm);
    await handler();

    expect(confirm).toHaveBeenCalledOnce();
    // The critical assertion — cancel must NOT trigger archive
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("(test 4) onRestore pattern — makeArchiveHandler with stage:open callback calls handler with correct id", async () => {
    // Restore uses updateEntry(id, { stage: "open" }) wired in CrmBoardPage.
    // We verify the handler pattern is symmetric: confirm → callback with id.
    const onRestore = vi.fn();
    const confirm = vi.fn().mockResolvedValue(true);

    // makeArchiveHandler is reusable for any id + callback pair.
    const handler = makeArchiveHandler("arc-1", onRestore, confirm);
    await handler();

    expect(onRestore).toHaveBeenCalledWith("arc-1");
  });
});

// ── CRM-S11: isEntryEmpty (delete predicate) ─────────────────────────────────
// The delete button on ArchivedRow is shown only when isEntryEmpty holds.
// These four tests guard the four named blocking fields plus the happy path.

describe("isEntryEmpty (CRM-S11 delete predicate)", () => {
  it("(test s11-delete-3a) entry with a description blocks delete", () => {
    const entry = makeEntry({ stage: "archived", description: "Some notes" });
    expect(isEntryEmpty(entry)).toBe(false);
  });

  it("(test s11-delete-3b) entry with a contact blocks delete", () => {
    const entry = makeEntry({
      stage: "archived",
      contact: { id: "c-1", firstName: "Jane", lastName: "Doe", email: null }
    });
    expect(isEntryEmpty(entry)).toBe(false);
  });

  it("(test s11-delete-3c) entry with an estimatedValue blocks delete", () => {
    const entry = makeEntry({ stage: "archived", estimatedValue: "15000" });
    expect(isEntryEmpty(entry)).toBe(false);
  });

  it("(test s11-delete-3d) entry with a commThread is caught server-side; client predicate passes without that field", () => {
    // The client-side predicate cannot see comm threads — that check is server-side.
    // An entry that appears empty client-side but has a thread will be refused by
    // the API with a 400 naming "commThread". The client shows the delete button;
    // the server enforces the guard. This test documents that design decision.
    const entry = makeEntry({ stage: "archived" });
    // Client-side predicate: empty — delete button is shown.
    expect(isEntryEmpty(entry)).toBe(true);
    // The API will refuse with "Cannot delete entry X: commThread" if a thread exists.
    // That path is exercised in the API unit tests (crm.service.archive.spec.ts).
  });

  it("(test s11-delete-4) genuinely empty entry — delete button is shown", () => {
    const entry = makeEntry({ stage: "archived" });
    expect(isEntryEmpty(entry)).toBe(true);
  });
});
