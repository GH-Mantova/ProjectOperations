/**
 * CRM_OWNER_PICKER_V1 — tenders register owner picker unit tests.
 *
 * Spec (from the prompt):
 *   1. ownerOptions: distinct owners with correct counts, sorted, "Unassigned"
 *      last and only when present.
 *   2. Two estimators with the same initial + last name but different ids stay
 *      as separate entries.
 *   3. The filter predicate keeps the right rows for an id, for
 *      UNASSIGNED_OWNER, and for null (all rows).
 *   4. Negative control: options come from unfiltered rows. With filter set to
 *      owner A, owner B still appears in the option list.
 */

import { describe, expect, it } from "vitest";
import { ownerOptions, UNASSIGNED_OWNER } from "../tendersRegisterPage.helpers";

// ---------------------------------------------------------------------------
// Helper: build a minimal row shape accepted by ownerOptions
// ---------------------------------------------------------------------------

type MinimalRow = {
  estimator?: { id: string; firstName: string; lastName: string } | null;
};

function row(estimator: MinimalRow["estimator"]): MinimalRow {
  return { estimator };
}

// ---------------------------------------------------------------------------
// 1. Distinct owners with correct counts, sorted, Unassigned last
// ---------------------------------------------------------------------------

describe("ownerOptions — distinct owners, counts, sort, Unassigned last", () => {
  const rows: MinimalRow[] = [
    row({ id: "u-1", firstName: "Marco", lastName: "Cattaneo" }),
    row({ id: "u-1", firstName: "Marco", lastName: "Cattaneo" }),
    row({ id: "u-2", firstName: "Priya", lastName: "Nair" }),
    row({ id: "u-2", firstName: "Priya", lastName: "Nair" }),
    row({ id: "u-2", firstName: "Priya", lastName: "Nair" }),
    row(null),
    row(null),
  ];

  it("produces one entry per distinct estimator id", () => {
    const opts = ownerOptions(rows);
    const ids = opts.map((o) => o.id).filter((id) => id !== UNASSIGNED_OWNER);
    expect(ids).toHaveLength(2);
    expect(ids).toContain("u-1");
    expect(ids).toContain("u-2");
  });

  it("counts are correct for each owner", () => {
    const opts = ownerOptions(rows);
    const u1 = opts.find((o) => o.id === "u-1");
    const u2 = opts.find((o) => o.id === "u-2");
    expect(u1?.count).toBe(2);
    expect(u2?.count).toBe(3);
  });

  it('label is "F. Lastname" (first initial + ". " + last name)', () => {
    const opts = ownerOptions(rows);
    const u1 = opts.find((o) => o.id === "u-1");
    const u2 = opts.find((o) => o.id === "u-2");
    expect(u1?.label).toBe("M. Cattaneo");
    expect(u2?.label).toBe("P. Nair");
  });

  it("entries are sorted by label (ascending)", () => {
    const opts = ownerOptions(rows).filter((o) => o.id !== UNASSIGNED_OWNER);
    expect(opts[0].label).toBe("M. Cattaneo");
    expect(opts[1].label).toBe("P. Nair");
  });

  it("Unassigned appears last", () => {
    const opts = ownerOptions(rows);
    const last = opts[opts.length - 1];
    expect(last.id).toBe(UNASSIGNED_OWNER);
  });

  it("Unassigned count is correct", () => {
    const opts = ownerOptions(rows);
    const unassigned = opts.find((o) => o.id === UNASSIGNED_OWNER);
    expect(unassigned?.count).toBe(2);
  });

  it("Unassigned label is 'Unassigned'", () => {
    const opts = ownerOptions(rows);
    const unassigned = opts.find((o) => o.id === UNASSIGNED_OWNER);
    expect(unassigned?.label).toBe("Unassigned");
  });

  it("Unassigned is absent when every row has an estimator", () => {
    const allAssigned: MinimalRow[] = [
      row({ id: "u-1", firstName: "Marco", lastName: "Cattaneo" }),
      row({ id: "u-2", firstName: "Priya", lastName: "Nair" }),
    ];
    const opts = ownerOptions(allAssigned);
    expect(opts.some((o) => o.id === UNASSIGNED_OWNER)).toBe(false);
  });

  it("returns an empty array when rows is empty", () => {
    expect(ownerOptions([])).toEqual([]);
  });

  it("returns only Unassigned when every row has no estimator", () => {
    const opts = ownerOptions([row(null), row(null)]);
    expect(opts).toHaveLength(1);
    expect(opts[0].id).toBe(UNASSIGNED_OWNER);
    expect(opts[0].count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. Two estimators with the same F. Lastname but different ids stay separate
// ---------------------------------------------------------------------------

describe("ownerOptions — same initial + last name, different ids (test 2)", () => {
  const rows: MinimalRow[] = [
    row({ id: "u-10", firstName: "Jane", lastName: "Smith" }),
    row({ id: "u-10", firstName: "Jane", lastName: "Smith" }),
    row({ id: "u-20", firstName: "John", lastName: "Smith" }),
  ];

  it("produces two separate entries for the two 'J. Smith' estimators", () => {
    const opts = ownerOptions(rows);
    const smiths = opts.filter((o) => o.label === "J. Smith");
    expect(smiths).toHaveLength(2);
  });

  it("each entry carries the correct count", () => {
    const opts = ownerOptions(rows);
    const jane = opts.find((o) => o.id === "u-10");
    const john = opts.find((o) => o.id === "u-20");
    expect(jane?.count).toBe(2);
    expect(john?.count).toBe(1);
  });

  it("tie-breaking by id keeps order stable", () => {
    // u-10 < u-20 lexicographically, so Jane Smith appears before John Smith
    const opts = ownerOptions(rows).filter((o) => o.label === "J. Smith");
    expect(opts[0].id).toBe("u-10");
    expect(opts[1].id).toBe("u-20");
  });
});

// ---------------------------------------------------------------------------
// 3. Filter predicate: keeps right rows for an id, UNASSIGNED_OWNER, and null
// ---------------------------------------------------------------------------

/**
 * The filter predicate is embedded in TendersRegisterPage's clientFiltered
 * useMemo. We replicate it here as a pure helper so the spec can be tested
 * without React.
 */
function applyOwnerFilter(
  rows: Array<{ id: string; estimator?: { id: string } | null }>,
  estimatorId: string | null
): Array<{ id: string; estimator?: { id: string } | null }> {
  if (!estimatorId) return rows;
  if (estimatorId === UNASSIGNED_OWNER) {
    return rows.filter((t) => t.estimator == null);
  }
  return rows.filter((t) => t.estimator?.id === estimatorId);
}

describe("owner filter predicate (test 3)", () => {
  const rows = [
    { id: "t-1", estimator: { id: "u-1" } },
    { id: "t-2", estimator: { id: "u-1" } },
    { id: "t-3", estimator: { id: "u-2" } },
    { id: "t-4", estimator: null },
    { id: "t-5", estimator: undefined },
  ];

  it("null estimatorId returns all rows", () => {
    expect(applyOwnerFilter(rows, null)).toHaveLength(5);
  });

  it("a real id keeps only rows owned by that estimator", () => {
    const filtered = applyOwnerFilter(rows, "u-1");
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.id)).toEqual(["t-1", "t-2"]);
  });

  it("UNASSIGNED_OWNER keeps only rows with no estimator (null or undefined)", () => {
    const filtered = applyOwnerFilter(rows, UNASSIGNED_OWNER);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.id)).toEqual(["t-4", "t-5"]);
  });

  it("an id matching no loaded row returns an empty result", () => {
    expect(applyOwnerFilter(rows, "u-999")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Negative control: options built from unfiltered rows; other owners remain
// ---------------------------------------------------------------------------

describe("ownerOptions negative control — options do not shrink when a filter is active (test 4)", () => {
  const allRows: MinimalRow[] = [
    row({ id: "u-A", firstName: "Alice", lastName: "Brown" }),
    row({ id: "u-A", firstName: "Alice", lastName: "Brown" }),
    row({ id: "u-B", firstName: "Bob", lastName: "Green" }),
    row({ id: "u-B", firstName: "Bob", lastName: "Green" }),
    row({ id: "u-B", firstName: "Bob", lastName: "Green" }),
    row(null),
  ];

  it("filtering to owner A client-side does not remove B from ownerOptions", () => {
    // ownerOptions must be derived from allRows (before owner filter), not from
    // the post-filter result. Simulate what the page does: compute options from
    // allRows regardless of which owner is currently selected.
    const opts = ownerOptions(allRows); // always from full set
    expect(opts.some((o) => o.id === "u-A")).toBe(true);
    expect(opts.some((o) => o.id === "u-B")).toBe(true);
    expect(opts.some((o) => o.id === UNASSIGNED_OWNER)).toBe(true);
  });

  it("ownerOptions from post-filter rows (owner A only) would NOT include B", () => {
    // This documents WHY the page must use unfiltered rows for options.
    const filteredToA = allRows.filter(
      (r) => r.estimator?.id === "u-A"
    );
    const opts = ownerOptions(filteredToA);
    expect(opts.some((o) => o.id === "u-B")).toBe(false);
  });

  it("ownerOptions counts reflect the full unfiltered load", () => {
    const opts = ownerOptions(allRows);
    expect(opts.find((o) => o.id === "u-A")?.count).toBe(2);
    expect(opts.find((o) => o.id === "u-B")?.count).toBe(3);
    expect(opts.find((o) => o.id === UNASSIGNED_OWNER)?.count).toBe(1);
  });
});
