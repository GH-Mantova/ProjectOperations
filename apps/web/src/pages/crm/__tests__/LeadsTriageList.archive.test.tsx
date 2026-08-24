// Archive / Restore triage entries — pure-logic unit tests.
//
// The web workspace has no @testing-library / jsdom setup (all existing
// web tests are pure logic). We test the two helpers exported from
// LeadsTriageList:
//   filterByStage   — pure filter used to build open / archived / notPursued slices
//   makeArchiveHandler — returns an async thunk; confirm resolves true → calls
//                        onArchive; resolves false (cancel) → does NOT call onArchive.

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
    createdAt: "2026-08-20T00:00:00Z",
    ...overrides
  };
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
