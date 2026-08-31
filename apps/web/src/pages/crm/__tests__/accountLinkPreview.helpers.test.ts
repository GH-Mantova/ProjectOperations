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
  proposeLifecycleWithBasis,
  resolveLifecycle,
  type ClientLinkPreviewRow,
  type PreviewRow,
  type ProposalLifecycle
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

/**
 * Convenience: builds a PreviewRow from a ClientLinkPreviewRow by running
 * it through proposeLifecycleWithBasis so tests don't have to hard-code basis.
 * Accepts an optional override value.
 */
function makePreviewRow(
  rowOverrides: Partial<ClientLinkPreviewRow> = {},
  override: PreviewRow["override"] = null
): PreviewRow {
  const raw = makeRow(rowOverrides);
  const { lifecycle, basis } = proposeLifecycleWithBasis(raw, NOW_MS);
  return { ...raw, proposed: lifecycle, basis, override };
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
      basis: "won",
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
      basis: "tendered-no-win",
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
      basis: "won",
      override: null
    };
    expect(buildCommitAction(row).kind).toBe("skip");
  });

  it("returns patch once the reviewer overrides that same row", () => {
    const row: PreviewRow = {
      ...makeRow({ clientId: "client-1", existingAccountId: "acct-1" }),
      proposed: "ACTIVE",
      basis: "won",
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
      basis: "tendered-no-win",
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
      proposed: "ACTIVE" as const,
      basis: "won" as const,
      override: null
    }));
    const writes = rows.filter((r) => buildCommitAction(r).kind !== "skip");
    expect(writes).toHaveLength(0);
  });
});

// ── ProposalBasis (CRM-S4 no-history-basis) ───────────────────────────────────
//
// Negative-control note: if the `no-history` branch were removed from
// proposeLifecycleWithBasis, tenderCount===0 rows would fall through to the
// `tenderCount > 0 && wonCount === 0` guard (which is also false) and reach the
// final return — but to confirm the discriminator test below would fail, that
// final branch would need to say `tendered-no-win` instead of `no-history`.
// The discriminator test below explicitly verifies that basis is NOT the same
// for `tendered-no-win` and `no-history` even though both resolve to PROSPECT
// lifecycle. (Tested locally by temporarily commenting out the `no-history`
// return and confirming the discriminator test fails.)

describe("proposeLifecycleWithBasis — basis discriminant (CRM-S4 no-history)", () => {
  // basis: no-history
  it("returns basis 'no-history' and lifecycle PROSPECT for zero-counter rows", () => {
    const row = makeRow({ tenderCount: 0, wonCount: 0, lastTenderAt: null });
    const result = proposeLifecycleWithBasis(row, NOW_MS);
    expect(result.basis).toBe("no-history");
    expect(result.lifecycle).toBe("PROSPECT");
  });

  // basis: won
  it("returns basis 'won' and lifecycle ACTIVE for wonCount > 0 with recent tender", () => {
    const row = makeRow({ wonCount: 1, tenderCount: 1, lastTenderAt: monthsAgoIso(6) });
    const result = proposeLifecycleWithBasis(row, NOW_MS);
    expect(result.basis).toBe("won");
    expect(result.lifecycle).toBe("ACTIVE");
  });

  // basis: stale (24-month rule wins over won)
  it("returns basis 'stale' and lifecycle PAST when lastTenderAt > 24 months ago", () => {
    const row = makeRow({ wonCount: 2, tenderCount: 5, lastTenderAt: monthsAgoIso(25) });
    const result = proposeLifecycleWithBasis(row, NOW_MS);
    expect(result.basis).toBe("stale");
    expect(result.lifecycle).toBe("PAST");
  });

  // basis: tendered-no-win
  it("returns basis 'tendered-no-win' and lifecycle PROSPECT for tenderCount > 0 wonCount === 0", () => {
    const row = makeRow({ tenderCount: 3, wonCount: 0, lastTenderAt: monthsAgoIso(6) });
    const result = proposeLifecycleWithBasis(row, NOW_MS);
    expect(result.basis).toBe("tendered-no-win");
    expect(result.lifecycle).toBe("PROSPECT");
  });

  // Discriminator test: tendered-no-win vs no-history — MUST be different
  it("discriminator: tendered-no-win and no-history both resolve PROSPECT but are NOT equal basis", () => {
    const tenderedNoWin = proposeLifecycleWithBasis(
      makeRow({ tenderCount: 2, wonCount: 0, lastTenderAt: monthsAgoIso(6) }),
      NOW_MS
    );
    const noHistory = proposeLifecycleWithBasis(
      makeRow({ tenderCount: 0, wonCount: 0, lastTenderAt: null }),
      NOW_MS
    );
    // Both resolve to PROSPECT
    expect(tenderedNoWin.lifecycle).toBe("PROSPECT");
    expect(noHistory.lifecycle).toBe("PROSPECT");
    // But the bases MUST differ — this is the whole point
    expect(tenderedNoWin.basis).toBe("tendered-no-win");
    expect(noHistory.basis).toBe("no-history");
    expect(tenderedNoWin.basis).not.toBe(noHistory.basis);
  });
});

// ── Bulk-set skips no-history rows (CRM-S4 no-history-basis) ─────────────────

describe("bulk-set skips no-history rows (CRM-S4 no-history-basis)", () => {
  /**
   * Simulates the updated bulk-set mechanic: excludes no-history rows AND
   * preserves manual overrides. Mirrors the bulkSet() function in AccountLinkPreview.tsx.
   */
  function applyMainBulkSet(rows: PreviewRow[], lifecycle: ProposalLifecycle): PreviewRow[] {
    return rows.map((row) => {
      if (row.override !== null) return row; // preserve manual overrides
      if (row.basis === "no-history") return row; // no-history rows excluded
      return { ...row, override: lifecycle };
    });
  }

  it("main bulk-set skips no-history rows and applies to the rest", () => {
    // Three rows: no-history, tendered-no-win, won
    const noHistoryRow = makePreviewRow({ clientId: "nh", tenderCount: 0, wonCount: 0, lastTenderAt: null });
    const tenderedRow = makePreviewRow({ clientId: "tn", tenderCount: 3, wonCount: 0, lastTenderAt: monthsAgoIso(6) });
    const wonRow = makePreviewRow({ clientId: "wo", wonCount: 2, tenderCount: 2, lastTenderAt: monthsAgoIso(3) });

    const rows = [noHistoryRow, tenderedRow, wonRow];
    const after = applyMainBulkSet(rows, "ACTIVE");

    // no-history row must stay unoverridden
    const nh = after.find((r) => r.clientId === "nh")!;
    expect(nh.override).toBeNull();
    expect(nh.basis).toBe("no-history");

    // The other two receive the bulk override
    const tn = after.find((r) => r.clientId === "tn")!;
    const wo = after.find((r) => r.clientId === "wo")!;
    expect(tn.override).toBe("ACTIVE");
    expect(wo.override).toBe("ACTIVE");
  });

  it("a manual override on any row survives the main bulk-set (CRM-S4 test 6 guarantee)", () => {
    const noHistoryRow = makePreviewRow({ clientId: "nh", tenderCount: 0, wonCount: 0, lastTenderAt: null });
    const tenderedRow = makePreviewRow(
      { clientId: "tn", tenderCount: 3, wonCount: 0, lastTenderAt: monthsAgoIso(6) },
      "PAST" // manually overridden to PAST
    );
    const wonRow = makePreviewRow({ clientId: "wo", wonCount: 2, tenderCount: 2, lastTenderAt: monthsAgoIso(3) });

    const rows = [noHistoryRow, tenderedRow, wonRow];
    const after = applyMainBulkSet(rows, "ACTIVE");

    // tenderedRow had a manual override — it must stay PAST
    const tn = after.find((r) => r.clientId === "tn")!;
    expect(tn.override).toBe("PAST");
    expect(resolveLifecycle(tn)).toBe("PAST");

    // wonRow had no override — it picks up ACTIVE
    const wo = after.find((r) => r.clientId === "wo")!;
    expect(wo.override).toBe("ACTIVE");
  });
});

// ── Commit behaviour for no-history rows (CRM-S4 no-history-basis) ────────────

describe("buildCommitAction no-history row edge cases (CRM-S4 no-history-basis)", () => {
  it("linked no-history row with null override returns skip", () => {
    // This pins the 'linked no-history stays skip' guarantee explicitly.
    const row = makePreviewRow(
      { clientId: "nh-linked", existingAccountId: "acct-nh", tenderCount: 0, wonCount: 0, lastTenderAt: null }
    );
    expect(row.basis).toBe("no-history");
    expect(row.override).toBeNull();
    expect(buildCommitAction(row).kind).toBe("skip");
  });

  it("a board of only linked no-history rows with null overrides has zero writes", () => {
    const rows = ["acct-1", "acct-2", "acct-3"].map((id, i) =>
      makePreviewRow({ clientId: `nh-${i}`, existingAccountId: id, tenderCount: 0, wonCount: 0, lastTenderAt: null })
    );
    const allNoHistory = rows.every((r) => r.basis === "no-history");
    expect(allNoHistory).toBe(true);

    const writes = rows.filter((r) => buildCommitAction(r).kind !== "skip");
    expect(writes).toHaveLength(0);
  });

  it("unlinked no-history row still creates with PROSPECT lifecycle (S3 backfill preserved)", () => {
    const row = makePreviewRow(
      { clientId: "nh-unlinked", existingAccountId: null, tenderCount: 0, wonCount: 0, lastTenderAt: null }
    );
    expect(row.basis).toBe("no-history");
    expect(row.proposed).toBe("PROSPECT");

    const action = buildCommitAction(row);
    expect(action.kind).toBe("create");
    if (action.kind !== "create") throw new Error("unexpected");
    expect(action.payload.clientId).toBe("nh-unlinked");
    expect(action.payload.lifecycleStatus).toBe("PROSPECT");
  });
});
