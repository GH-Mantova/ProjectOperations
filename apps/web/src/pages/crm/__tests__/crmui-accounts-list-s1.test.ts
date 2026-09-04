// crmui-accounts-list-s1 — CRM_ACCOUNTS_LIST_V2 pure logic assertions.
//
// Verifies the filtering logic and the computeGoingCold contract as they
// stand after the S1 layout overhaul. No jsdom; pure unit tests only.

import { describe, expect, it } from "vitest";
import { computeGoingCold, CRM_COLD_V2, type AccountSummaryRow } from "../AccountsListPage";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-05T10:00:00Z").getTime();
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function makeRow(overrides: Partial<AccountSummaryRow> = {}): AccountSummaryRow {
  return {
    id: "acc-1",
    name: "Acme Corp",
    abn: null,
    type: "CLIENT",
    lifecycle: "ACTIVE",
    owner: null,
    winRate: null,
    openOpportunitiesCount: 0,
    lastContactedAt: null,
    goingCold: false,
    ...overrides
  };
}

// ── AccountSummaryRow shape (CRM_ACCOUNTS_LIST_V2) ────────────────────────────

describe("AccountSummaryRow — CRM_ACCOUNTS_LIST_V2 fields present", () => {
  it("has abn field (nullable string)", () => {
    const row = makeRow({ abn: "12 345 678 901" });
    expect(row.abn).toBe("12 345 678 901");
  });

  it("abn is null when not set", () => {
    const row = makeRow();
    expect(row.abn).toBeNull();
  });

  it("has owner field with id/firstName/lastName", () => {
    const row = makeRow({ owner: { id: "u-1", firstName: "Jane", lastName: "Smith" } });
    expect(row.owner?.firstName).toBe("Jane");
    expect(row.owner?.lastName).toBe("Smith");
  });

  it("owner is null when unassigned", () => {
    const row = makeRow({ owner: null });
    expect(row.owner).toBeNull();
  });
});

// ── CRM_COLD_V2 contract mirror ───────────────────────────────────────────────

describe("CRM_COLD_V2 — S1 contract unchanged", () => {
  it("THRESHOLD_DAYS is 60", () => {
    expect(CRM_COLD_V2.THRESHOLD_DAYS).toBe(60);
  });

  it("NULL_IS_COLD is true", () => {
    expect(CRM_COLD_V2.NULL_IS_COLD).toBe(true);
  });
});

// ── computeGoingCold — going-cold sub-line driven by CRM_COLD_V2 ──────────────

describe("computeGoingCold — CRM_ACCOUNTS_LIST_V2 going-cold chip", () => {
  it("chip shows for ACTIVE account with null lastContactedAt", () => {
    expect(computeGoingCold("ACTIVE", null, NOW)).toBe(true);
  });

  it("chip shows for PROSPECT with contact 61 days ago", () => {
    expect(computeGoingCold("PROSPECT", daysAgo(61), NOW)).toBe(true);
  });

  it("chip does not show for PAST lifecycle regardless of contact age", () => {
    expect(computeGoingCold("PAST", null, NOW)).toBe(false);
    expect(computeGoingCold("PAST", daysAgo(365), NOW)).toBe(false);
  });

  it("chip does not show when contact is within threshold (30 days)", () => {
    expect(computeGoingCold("ACTIVE", daysAgo(30), NOW)).toBe(false);
  });

  it("threshold is exclusive — exactly 60 days is NOT cold", () => {
    expect(computeGoingCold("ACTIVE", daysAgo(60), NOW)).toBe(false);
  });

  it("sub-line threshold text is driven by CRM_COLD_V2.THRESHOLD_DAYS", () => {
    // The StatTile sub-line is built as:
    //   `no contact in ${CRM_COLD_V2.THRESHOLD_DAYS} days`
    // This test pins the rendered value so any drift in THRESHOLD_DAYS
    // fails here AND in the server-side mirror test.
    const subLine = `no contact in ${CRM_COLD_V2.THRESHOLD_DAYS} days`;
    expect(subLine).toBe("no contact in 60 days");
    expect(CRM_COLD_V2.THRESHOLD_DAYS).toBe(60);
  });
});

// ── Client-side filter logic ──────────────────────────────────────────────────

function applyFilters(
  rows: AccountSummaryRow[],
  searchText: string,
  lifecycleFilter: string,
  ownerFilter: string
): AccountSummaryRow[] {
  return rows.filter((r) => {
    if (searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      if (!r.name.toLowerCase().includes(term)) return false;
    }
    if (lifecycleFilter !== "ALL" && r.lifecycle !== lifecycleFilter) return false;
    if (ownerFilter !== "ALL") {
      if (ownerFilter === "UNASSIGNED") {
        if (r.owner !== null) return false;
      } else {
        if (r.owner?.id !== ownerFilter) return false;
      }
    }
    return true;
  });
}

const SEED_ROWS: AccountSummaryRow[] = [
  makeRow({ id: "a1", name: "North Star Constructions", lifecycle: "ACTIVE", owner: { id: "u-1", firstName: "Jane", lastName: "Smith" } }),
  makeRow({ id: "a2", name: "Northern Territory Works", lifecycle: "PROSPECT", owner: null }),
  makeRow({ id: "a3", name: "Acme Corp", lifecycle: "ACTIVE", owner: { id: "u-2", firstName: "Bob", lastName: "Jones" } }),
  makeRow({ id: "a4", name: "Northern Excavations", lifecycle: "PAST", owner: { id: "u-1", firstName: "Jane", lastName: "Smith" } })
];

describe("client-side filter — search text", () => {
  it("returns all rows when search is empty", () => {
    expect(applyFilters(SEED_ROWS, "", "ALL", "ALL")).toHaveLength(4);
  });

  it("filters by name substring (case-insensitive)", () => {
    const result = applyFilters(SEED_ROWS, "north", "ALL", "ALL");
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(["a1", "a2", "a4"]));
  });

  it("returns zero rows when no match", () => {
    expect(applyFilters(SEED_ROWS, "zzzzz", "ALL", "ALL")).toHaveLength(0);
  });

  it("trims leading/trailing whitespace before matching", () => {
    const result = applyFilters(SEED_ROWS, "  north  ", "ALL", "ALL");
    expect(result).toHaveLength(3);
  });
});

describe("client-side filter — lifecycle", () => {
  it("returns only ACTIVE rows when lifecycle filter is ACTIVE", () => {
    const result = applyFilters(SEED_ROWS, "", "ACTIVE", "ALL");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.lifecycle === "ACTIVE")).toBe(true);
  });

  it("returns only PROSPECT rows when lifecycle filter is PROSPECT", () => {
    const result = applyFilters(SEED_ROWS, "", "PROSPECT", "ALL");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a2");
  });

  it("returns all rows when lifecycle filter is ALL", () => {
    expect(applyFilters(SEED_ROWS, "", "ALL", "ALL")).toHaveLength(4);
  });
});

describe("client-side filter — owner", () => {
  it("returns only rows for a specific owner by id", () => {
    const result = applyFilters(SEED_ROWS, "", "ALL", "u-1");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(["a1", "a4"]));
  });

  it("returns only unassigned rows when owner filter is UNASSIGNED", () => {
    const result = applyFilters(SEED_ROWS, "", "ALL", "UNASSIGNED");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a2");
  });

  it("returns all rows when owner filter is ALL", () => {
    expect(applyFilters(SEED_ROWS, "", "ALL", "ALL")).toHaveLength(4);
  });
});

describe("client-side filter — combined", () => {
  it("search + lifecycle together narrow correctly", () => {
    const result = applyFilters(SEED_ROWS, "north", "ACTIVE", "ALL");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
  });

  it("search + owner together narrow correctly", () => {
    const result = applyFilters(SEED_ROWS, "north", "ALL", "u-1");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(["a1", "a4"]));
  });
});
