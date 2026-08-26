// CRM comms-inbox helpers — vitest unit tests.
//
// These tests exercise the pure functions in comms-inbox.helpers.ts with no
// React, no jsdom, and no fetch (matching the pattern in AccountsListPage.test.ts
// and DropReasonAdminPage.test.ts).
//
// The critical fixture is the UNRESOLVABLE ANCHOR case: entityId maps to a
// deleted record (no resolved name). The test asserts the row is still returned
// and still carries an explicit "deleted" label. This is the acceptance
// criterion — a resolver that assumes every id resolves will crash or silently
// drop rows on exactly the orphaned data the inbox exists to surface.

import { describe, expect, it } from "vitest";
import {
  entityLabel,
  groupThreadsByEntityType,
  hasNextPage,
  hasPrevPage,
  sortThreadsByActivity,
  totalPages,
  type InboxThread
} from "../comms-inbox.helpers";

// ── entityLabel ───────────────────────────────────────────────────────────────

describe("entityLabel (comms-inbox.helpers)", () => {
  it("returns resolved name with type qualifier when name is available", () => {
    expect(entityLabel("ACCOUNT", "abc-123", "Northshore Demolition")).toBe(
      "Northshore Demolition (Account)"
    );
  });

  it("returns resolved name with type qualifier for TENDER", () => {
    expect(entityLabel("TENDER", "def-456", "City Rail Upgrade")).toBe(
      "City Rail Upgrade (Tender)"
    );
  });

  it("returns explicit deleted label when resolvedName is undefined — UNRESOLVABLE ANCHOR", () => {
    // This is the acceptance criterion fixture. The record entityId "gone-789"
    // could not be found (it was deleted). The label must be explicit and must
    // contain "deleted" so the row is visible and diagnosable.
    const label = entityLabel("ACCOUNT", "gone-789", undefined);
    expect(label).toContain("deleted");
    expect(label).toContain("gone-789");
    // Must not be blank.
    expect(label.trim()).not.toBe("");
  });

  it("returns explicit deleted label when resolvedName is null", () => {
    const label = entityLabel("JOB", "null-id-000", null);
    expect(label).toContain("deleted");
    expect(label).toContain("null-id-000");
    expect(label.trim()).not.toBe("");
  });

  it("returns explicit deleted label when resolvedName is an empty string", () => {
    const label = entityLabel("CONTRACT", "empty-111", "");
    expect(label).toContain("deleted");
    expect(label).toContain("empty-111");
  });

  it("labels an unknown entityType as Unknown type rather than throwing", () => {
    // entityType is a free String in the schema — do not assume it is one of
    // the four known values. Unknown types must still produce a visible label.
    const label = entityLabel("INVOICE", "unknown-222", undefined);
    expect(label).toContain("Unknown type");
    expect(label).toContain("INVOICE");
    expect(label).toContain("deleted");
    expect(label.trim()).not.toBe("");
  });

  it("labels an unknown entityType with resolved name correctly", () => {
    const label = entityLabel("INVOICE", "unknown-333", "INV-2026-001");
    expect(label).toContain("INV-2026-001");
    expect(label).toContain("Unknown type");
    // Should not say deleted when a name was resolved.
    expect(label).not.toContain("deleted");
  });

  it("trims whitespace-only resolvedName and treats it as unresolvable", () => {
    const label = entityLabel("ACCOUNT", "ws-444", "   ");
    expect(label).toContain("deleted");
    expect(label).toContain("ws-444");
  });
});

// ── sortThreadsByActivity ─────────────────────────────────────────────────────

function makeThread(
  id: string,
  updatedAt: string,
  entityType = "ACCOUNT",
  entityId = "eid-1"
): InboxThread {
  return {
    id,
    entityType,
    entityId,
    subject: `Thread ${id}`,
    updatedAt,
    createdAt: updatedAt,
    archivedAt: null,
    entityDisplay: entityLabel(entityType, entityId)
  };
}

describe("sortThreadsByActivity (comms-inbox.helpers)", () => {
  it("sorts threads newest-updatedAt first", () => {
    const threads = [
      makeThread("a", "2026-08-01T10:00:00Z"),
      makeThread("c", "2026-08-03T10:00:00Z"),
      makeThread("b", "2026-08-02T10:00:00Z")
    ];
    const sorted = sortThreadsByActivity(threads);
    expect(sorted.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input array", () => {
    const threads = [
      makeThread("a", "2026-08-01T10:00:00Z"),
      makeThread("b", "2026-08-02T10:00:00Z")
    ];
    const original = [...threads];
    sortThreadsByActivity(threads);
    expect(threads[0].id).toBe(original[0].id);
  });

  it("handles an empty array", () => {
    expect(sortThreadsByActivity([])).toEqual([]);
  });

  it("handles a single thread", () => {
    const threads = [makeThread("only", "2026-08-01T10:00:00Z")];
    const sorted = sortThreadsByActivity(threads);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("only");
  });
});

// ── groupThreadsByEntityType ──────────────────────────────────────────────────

describe("groupThreadsByEntityType (comms-inbox.helpers)", () => {
  it("groups threads by entityType", () => {
    const threads = [
      makeThread("a", "2026-08-01T10:00:00Z", "ACCOUNT", "acc-1"),
      makeThread("b", "2026-08-02T10:00:00Z", "TENDER", "ten-1"),
      makeThread("c", "2026-08-03T10:00:00Z", "ACCOUNT", "acc-2")
    ];
    const groups = groupThreadsByEntityType(threads);
    expect(groups.get("ACCOUNT")).toHaveLength(2);
    expect(groups.get("TENDER")).toHaveLength(1);
    expect(groups.get("JOB")).toBeUndefined();
  });

  it("returns an empty map for an empty array", () => {
    const groups = groupThreadsByEntityType([]);
    expect(groups.size).toBe(0);
  });

  it("groups an unknown entityType without throwing", () => {
    const threads = [makeThread("x", "2026-08-01T10:00:00Z", "INVOICE", "inv-1")];
    const groups = groupThreadsByEntityType(threads);
    expect(groups.get("INVOICE")).toHaveLength(1);
  });
});

// ── totalPages / hasNextPage / hasPrevPage ────────────────────────────────────

describe("totalPages (comms-inbox.helpers)", () => {
  it("returns correct page count", () => {
    expect(totalPages({ page: 1, limit: 25, total: 100 })).toBe(4);
    expect(totalPages({ page: 1, limit: 25, total: 101 })).toBe(5);
    expect(totalPages({ page: 1, limit: 25, total: 0 })).toBe(0);
  });

  it("returns 0 for zero limit (no divide-by-zero throw)", () => {
    expect(totalPages({ page: 1, limit: 0, total: 100 })).toBe(0);
  });
});

describe("hasNextPage (comms-inbox.helpers)", () => {
  it("returns true when on page 1 of 4", () => {
    expect(hasNextPage({ page: 1, limit: 25, total: 100 })).toBe(true);
  });

  it("returns false when on the last page", () => {
    expect(hasNextPage({ page: 4, limit: 25, total: 100 })).toBe(false);
  });
});

describe("hasPrevPage (comms-inbox.helpers)", () => {
  it("returns false on page 1", () => {
    expect(hasPrevPage({ page: 1, limit: 25, total: 100 })).toBe(false);
  });

  it("returns true on page 2", () => {
    expect(hasPrevPage({ page: 2, limit: 25, total: 100 })).toBe(true);
  });
});
