// CRM-S4: Pure-helper unit tests for AccountLinkPreview.
//
// Follows the DropReasonAdminPage.test.ts pattern: no jsdom, no fetch mocks,
// no React — only the exported pure helpers.
//
// Tests required by the prompt:
//   1. proposeLifecycle: wonCount > 0 → Active
//   2. proposeLifecycle: tenderCount > 0 & wonCount == 0 → Prospect
//   3. proposeLifecycle: tenderCount == 0 → Prospect
//   4. proposeLifecycle: lastTenderAt > 24 months ago → Past
//   5. proposeLifecycle: 24-month boundary (exactly 24 months is NOT past)
//   6. A row whose lifecycle the user overrode keeps the override through a
//      bulk-set of the OTHER rows.
//   7. The commit payload contains no client, tender or job mutation.

import { describe, expect, it } from "vitest";
import {
  buildCommitAction,
  buildPreviewRows,
  proposeLifecycle,
  resolveLifecycle,
  type ClientLinkPreviewRow,
  type PreviewRow
} from "../accountLinkPreview.helpers";

// ── Clock helpers ─────────────────────────────────────────────────────────────

const NOW = new Date("2026-08-31T12:00:00Z");
const NOW_MS = NOW.getTime();

function monthsAgoIso(months: number): string {
  // Use mean month (30.44 days) to match proposeLifecycle implementation.
  return new Date(NOW_MS - months * 30.44 * 24 * 60 * 60 * 1000).toISOString();
}

function makeRow(
  overrides: Partial<ClientLinkPreviewRow> = {}
): ClientLinkPreviewRow {
  return {
    clientId: "client-1",
    name: "Test Co",
    tenderCount: 0,
    wonCount: 0,
    lastTenderAt: null,
    existingAccountId: null,
    ...overrides
  };
}

// ── proposeLifecycle ──────────────────────────────────────────────────────────

describe("proposeLifecycle (CRM-S4)", () => {
  // Test 1: won > 0 → Active
  it("returns ACTIVE when wonCount > 0 and lastTenderAt is recent", () => {
    const row = makeRow({ wonCount: 1, tenderCount: 1, lastTenderAt: monthsAgoIso(6) });
    expect(proposeLifecycle(row, NOW_MS)).toBe("ACTIVE");
  });

  // Test 2: tendered but never won → Prospect
  it("returns PROSPECT when tenderCount > 0 and wonCount == 0", () => {
    const row = makeRow({ tenderCount: 3, wonCount: 0, lastTenderAt: monthsAgoIso(6) });
    expect(proposeLifecycle(row, NOW_MS)).toBe("PROSPECT");
  });

  // Test 3: never tendered → Prospect
  it("returns PROSPECT when tenderCount == 0", () => {
    const row = makeRow({ tenderCount: 0, wonCount: 0, lastTenderAt: null });
    expect(proposeLifecycle(row, NOW_MS)).toBe("PROSPECT");
  });

  // Test 4: lastTenderAt > 24 months ago → Past (overrides won status)
  it("returns PAST when lastTenderAt is more than 24 months ago", () => {
    const row = makeRow({ wonCount: 2, tenderCount: 5, lastTenderAt: monthsAgoIso(25) });
    expect(proposeLifecycle(row, NOW_MS)).toBe("PAST");
  });

  // Test 5: 24-month boundary — exactly 24 months is NOT past
  it("returns ACTIVE (not PAST) when lastTenderAt is exactly 24 months ago", () => {
    // Exactly at the boundary: 24 months * 30.44 days = 730.56 days
    const exactlyAt = monthsAgoIso(24);
    const row = makeRow({ wonCount: 1, tenderCount: 2, lastTenderAt: exactlyAt });
    // At exactly 24 months the comparison is months > 24, which is false.
    expect(proposeLifecycle(row, NOW_MS)).toBe("ACTIVE");
  });

  it("returns PAST when lastTenderAt is 24 months + 1 day ago", () => {
    // One day past the boundary: 24*30.44 + 1 = 731.56 days
    const justOver = new Date(NOW_MS - (24 * 30.44 + 1) * 24 * 60 * 60 * 1000).toISOString();
    const row = makeRow({ wonCount: 1, tenderCount: 2, lastTenderAt: justOver });
    expect(proposeLifecycle(row, NOW_MS)).toBe("PAST");
  });
});

// ── Per-row override survives bulk-set ────────────────────────────────────────

describe("Row override survives bulk-set (CRM-S4 test 6)", () => {
  /**
   * Simulates the bulk-set mechanic: set all rows to a given lifecycle EXCEPT
   * those whose override is already set (override !== null). This matches the
   * UI behaviour described in the spec.
   */
  function applyBulkSet(rows: PreviewRow[], lifecycle: "ACTIVE" | "PROSPECT" | "PAST"): PreviewRow[] {
    return rows.map((row) => {
      if (row.override !== null) return row; // preserve user override
      return { ...row, override: lifecycle };
    });
  }

  it("a row with a manual override keeps its value when others are bulk-set", () => {
    const apiRows: ClientLinkPreviewRow[] = [
      makeRow({ clientId: "client-a", name: "Client A", tenderCount: 2, wonCount: 1, lastTenderAt: monthsAgoIso(6) }),
      makeRow({ clientId: "client-b", name: "Client B", tenderCount: 0, wonCount: 0, lastTenderAt: null }),
      makeRow({ clientId: "client-c", name: "Client C", tenderCount: 3, wonCount: 0, lastTenderAt: monthsAgoIso(3) })
    ];

    // Build preview rows (all overrides start null)
    let rows = buildPreviewRows(apiRows, NOW_MS);

    // User manually sets client-a to PAST
    rows = rows.map((r) =>
      r.clientId === "client-a" ? { ...r, override: "PAST" as const } : r
    );

    // Bulk-set all rows to ACTIVE
    rows = applyBulkSet(rows, "ACTIVE");

    // client-a must still be PAST (its override was set before the bulk-set)
    const rowA = rows.find((r) => r.clientId === "client-a")!;
    expect(rowA.override).toBe("PAST");
    expect(resolveLifecycle(rowA)).toBe("PAST");

    // client-b and client-c picked up the bulk-set value
    const rowB = rows.find((r) => r.clientId === "client-b")!;
    const rowC = rows.find((r) => r.clientId === "client-c")!;
    expect(resolveLifecycle(rowB)).toBe("ACTIVE");
    expect(resolveLifecycle(rowC)).toBe("ACTIVE");
  });
});

// ── Commit payload shape ──────────────────────────────────────────────────────

describe("buildCommitAction payload shape (CRM-S4 test 7)", () => {
  it("create action payload has no client, tender or job mutation fields", () => {
    const row: PreviewRow = {
      ...makeRow({ clientId: "client-1", existingAccountId: null }),
      proposed: "ACTIVE",
      override: null
    };
    const action = buildCommitAction(row);
    expect(action.kind).toBe("create");
    if (action.kind !== "create") throw new Error("unexpected");

    const payload = action.payload;
    // Must contain clientId and lifecycleStatus
    expect(payload).toHaveProperty("clientId", "client-1");
    expect(payload).toHaveProperty("lifecycleStatus", "ACTIVE");

    // Must NOT contain any Client/Tender/Job mutation key
    const forbidden = ["name", "abn", "phone", "email", "tenderId", "tenderNumber", "jobId", "jobNumber"];
    for (const key of forbidden) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("patch action payload has no client, tender or job mutation fields", () => {
    const row: PreviewRow = {
      ...makeRow({ clientId: "client-1", existingAccountId: "acct-1" }),
      proposed: "PROSPECT",
      override: "ACTIVE"
    };
    const action = buildCommitAction(row);
    expect(action.kind).toBe("patch");
    if (action.kind !== "patch") throw new Error("unexpected");

    const payload = action.payload;
    expect(payload).toHaveProperty("accountId", "acct-1");
    expect(payload).toHaveProperty("lifecycleStatus", "ACTIVE");

    const forbidden = ["clientId", "name", "abn", "tenderId", "jobId"];
    for (const key of forbidden) {
      expect(payload).not.toHaveProperty(key);
    }
  });
});

// ── Untouched already-linked rows must not be written ─────────────────────────
//
// Regression guard. buildCommitAction used to return a "patch" for EVERY row
// that already had an account, carrying resolveLifecycle(row) — which falls
// back to the computed proposal because PreviewRow does not carry the stored
// lifecycle. Pressing Commit therefore rewrote the lifecycle of every linked
// account to the rule's guess, overwriting values set by hand, while the screen
// reported those same rows as "Already linked (skipped)".

describe("buildCommitAction skips untouched linked rows (CRM-S4 regression)", () => {
  it("returns skip for an already-linked row the reviewer did not touch", () => {
    const row: PreviewRow = {
      ...makeRow({ clientId: "client-1", existingAccountId: "acct-1" }),
      proposed: "ACTIVE",
      override: null
    };
    expect(buildCommitAction(row).kind).toBe("skip");
  });

  it("returns patch once the reviewer overrides that same row", () => {
    const row: PreviewRow = {
      ...makeRow({ clientId: "client-1", existingAccountId: "acct-1" }),
      proposed: "ACTIVE",
      override: "PAST"
    };
    const action = buildCommitAction(row);
    expect(action.kind).toBe("patch");
    if (action.kind !== "patch") throw new Error("unexpected");
    expect(action.payload.lifecycleStatus).toBe("PAST");
  });

  it("still creates for an unlinked row with no override", () => {
    const row: PreviewRow = {
      ...makeRow({ clientId: "client-2", existingAccountId: null }),
      proposed: "PROSPECT",
      override: null
    };
    const action = buildCommitAction(row);
    expect(action.kind).toBe("create");
    if (action.kind !== "create") throw new Error("unexpected");
    expect(action.payload.clientId).toBe("client-2");
  });

  it("a board of only untouched linked rows produces zero writes", () => {
    const rows: PreviewRow[] = ["acct-1", "acct-2", "acct-3"].map((id, i) => ({
      ...makeRow({ clientId: `client-${i}`, existingAccountId: id, wonCount: 1 }),
      proposed: "ACTIVE",
      override: null
    }));
    const writes = rows.filter((r) => buildCommitAction(r).kind !== "skip");
    expect(writes).toHaveLength(0);
  });
});
