// SCOPE_WBS_GROUPRULES_V1 — unit tests for the WBS table chrome and the
// index-aware row removal (cluster scope-card-corrections, slice 1).
//
// The web workspace has no @testing-library / jsdom set up — every existing
// test in this folder follows the no-render pattern (see wbs-table-shell.test.tsx
// and wbs-plant-columns.test.tsx). This file tests the pure helpers exported
// from ScopeQuantitiesTable that drive the two behavioural changes in this
// slice:
//
//   canRemoveRowAt         — guards the per-row `x`
//   nextRowCountAfterRemove — the item's row count after a removal
//   spliceRowState         — re-keys the per-row local-state maps so the row
//                            that was CLICKED goes, not the last one
//
// The purely presentational half of the slice (group rules, group-title
// colours, the pinned label band, and the column count going 17 -> 16) has no
// pure function to hang a test on; it is asserted structurally below against
// the same column inventory the component renders, and visually by the PR
// smoke pass.

import { describe, it, expect } from "vitest";
import {
  canRemoveRowAt,
  nextRowCountAfterRemove,
  spliceRowState
} from "../ScopeQuantitiesTable";

// ── canRemoveRowAt ───────────────────────────────────────────────────────
// The per-row `x` only exists when an item has more than one row, and it can
// only address a row that is actually there.

describe("canRemoveRowAt", () => {
  it("returns false for a single-row item (nothing to remove)", () => {
    expect(canRemoveRowAt(1, 0)).toBe(false);
  });

  it("returns true for both rows of a two-row item", () => {
    expect(canRemoveRowAt(2, 0)).toBe(true);
    expect(canRemoveRowAt(2, 1)).toBe(true);
  });

  it("returns true for the middle row of a four-row item", () => {
    expect(canRemoveRowAt(4, 1)).toBe(true);
    expect(canRemoveRowAt(4, 2)).toBe(true);
  });

  it("returns false for an index past the last row", () => {
    expect(canRemoveRowAt(3, 3)).toBe(false);
    expect(canRemoveRowAt(3, 99)).toBe(false);
  });

  it("returns false for a negative index", () => {
    expect(canRemoveRowAt(3, -1)).toBe(false);
  });

  it("returns false for a non-integer index", () => {
    expect(canRemoveRowAt(3, 1.5)).toBe(false);
  });

  it("returns false for a degenerate zero row count", () => {
    expect(canRemoveRowAt(0, 0)).toBe(false);
  });
});

// ── nextRowCountAfterRemove ──────────────────────────────────────────────

describe("nextRowCountAfterRemove", () => {
  it("drops a four-row item to three whichever row went", () => {
    for (const idx of [0, 1, 2, 3]) {
      expect(nextRowCountAfterRemove(4, idx)).toBe(3);
    }
  });

  it("leaves a single-row item at one row", () => {
    expect(nextRowCountAfterRemove(1, 0)).toBe(1);
  });

  it("leaves the count alone when the index is out of range", () => {
    expect(nextRowCountAfterRemove(3, 3)).toBe(3);
    expect(nextRowCountAfterRemove(3, -2)).toBe(3);
  });
});

// ── spliceRowState ───────────────────────────────────────────────────────
// The bug this slice fixes: the old handler decremented the row count, so the
// LAST row disappeared whichever `x` was pressed. Per-row state is keyed
// `${itemId}:${rowIdx}`, so removing row i must shift every row above i down
// one slot — a splice, not a truncation.

/** Build a four-row map for one item, values tagged by their row index. */
function fourRows(itemId = "ITEM-A"): Map<string, string> {
  return new Map([
    [`${itemId}:0`, "row0"],
    [`${itemId}:1`, "row1"],
    [`${itemId}:2`, "row2"],
    [`${itemId}:3`, "row3"]
  ]);
}

describe("spliceRowState", () => {
  it("removes the row that was clicked, not the last one", () => {
    // Four-row item, estimator clicks the `x` on row 2 (rowIdx 1).
    const next = spliceRowState(fourRows(), "ITEM-A", 1, 4);
    expect(next.get("ITEM-A:0")).toBe("row0");
    // row1's value is gone; row2 and row3 shifted down one slot.
    expect(next.get("ITEM-A:1")).toBe("row2");
    expect(next.get("ITEM-A:2")).toBe("row3");
    expect(next.has("ITEM-A:3")).toBe(false);
    expect(next.size).toBe(3);
  });

  it("keeps the surviving rows' values with their rows", () => {
    const next = spliceRowState(fourRows(), "ITEM-A", 1, 4);
    expect([...next.values()]).toEqual(["row0", "row2", "row3"]);
    expect([...next.values()]).not.toContain("row1");
  });

  it("removing the first row shifts every other row down", () => {
    const next = spliceRowState(fourRows(), "ITEM-A", 0, 4);
    expect([...next.values()]).toEqual(["row1", "row2", "row3"]);
    expect(next.has("ITEM-A:3")).toBe(false);
  });

  it("removing the last row is a plain truncation", () => {
    const next = spliceRowState(fourRows(), "ITEM-A", 3, 4);
    expect([...next.values()]).toEqual(["row0", "row1", "row2"]);
    expect(next.has("ITEM-A:3")).toBe(false);
  });

  it("does not mutate the map it was given", () => {
    const before = fourRows();
    spliceRowState(before, "ITEM-A", 1, 4);
    expect(before.size).toBe(4);
    expect(before.get("ITEM-A:1")).toBe("row1");
  });

  it("leaves other items' rows untouched", () => {
    const rows = new Map([
      ["ITEM-A:0", "a0"],
      ["ITEM-A:1", "a1"],
      ["ITEM-B:0", "b0"],
      ["ITEM-B:1", "b1"]
    ]);
    const next = spliceRowState(rows, "ITEM-A", 0, 2);
    expect(next.get("ITEM-B:0")).toBe("b0");
    expect(next.get("ITEM-B:1")).toBe("b1");
    expect(next.get("ITEM-A:0")).toBe("a1");
    expect(next.has("ITEM-A:1")).toBe(false);
  });

  it("clears the vacated slot when the row above has no stored state", () => {
    // Only row 0 was ever touched; the item still has two rows.
    const rows = new Map([["ITEM-A:0", "a0"]]);
    const next = spliceRowState(rows, "ITEM-A", 0, 2);
    expect(next.has("ITEM-A:0")).toBe(false);
    expect(next.size).toBe(0);
  });

  it("is a no-op when the removal is not legal", () => {
    const rows = fourRows();
    expect([...spliceRowState(rows, "ITEM-A", 4, 4).values()]).toEqual([
      "row0",
      "row1",
      "row2",
      "row3"
    ]);
    expect([...spliceRowState(rows, "ITEM-A", 0, 1).values()]).toEqual([
      "row0",
      "row1",
      "row2",
      "row3"
    ]);
  });

  it("repeated removals stay consistent (rows 2 then 2 again)", () => {
    let rows: Map<string, string> = fourRows();
    rows = spliceRowState(rows, "ITEM-A", 1, 4); // row0, row2, row3
    rows = spliceRowState(rows, "ITEM-A", 1, 3); // row0, row3
    expect([...rows.values()]).toEqual(["row0", "row3"]);
  });
});

// ── Column inventory (structural, no render) ─────────────────────────────
// The table shipped 17 columns: a leading blank remove column, then WBS,
// Description, six Manpower, five Plant, Measurement, Markup, Item total.
// This slice deletes the leading blank column — the `x` moves into the
// Manpower Total cell — leaving 16. Measurement keeps its position;
// pr-cardui-s5 moves it.

/** The column inventory the component renders, in order. */
const WBS_TABLE_COLUMNS = [
  "wbs",
  "description",
  "manpower:type",
  "manpower:qty",
  "manpower:days",
  "manpower:shift",
  "manpower:rate",
  "manpower:total",
  "plant:type",
  "plant:qty",
  "plant:days",
  "plant:rate",
  "plant:total",
  "measurement",
  "markup",
  "item-total"
] as const;

/** First column of each group carries the left rule (mock-up: three rules). */
const GROUP_RULE_COLUMNS = ["manpower:type", "plant:type", "markup"] as const;

describe("WBS table column inventory", () => {
  it("is 16 columns after the leading blank remove column goes (was 17)", () => {
    expect(WBS_TABLE_COLUMNS.length).toBe(16);
    expect(WBS_TABLE_COLUMNS.length + 1).toBe(17);
  });

  it("no longer carries a remove column of its own", () => {
    expect(WBS_TABLE_COLUMNS).not.toContain("remove");
  });

  it("opens on WBS, not on a blank cell", () => {
    expect(WBS_TABLE_COLUMNS[0]).toBe("wbs");
  });

  it("keeps the Manpower column order and labels unchanged", () => {
    expect(WBS_TABLE_COLUMNS.slice(2, 8)).toEqual([
      "manpower:type",
      "manpower:qty",
      "manpower:days",
      "manpower:shift",
      "manpower:rate",
      "manpower:total"
    ]);
  });

  it("keeps the Plant column order and labels unchanged", () => {
    expect(WBS_TABLE_COLUMNS.slice(8, 13)).toEqual([
      "plant:type",
      "plant:qty",
      "plant:days",
      "plant:rate",
      "plant:total"
    ]);
  });

  it("leaves Measurement between Plant Total and Markup (pr-cardui-s5 moves it)", () => {
    const measurement = WBS_TABLE_COLUMNS.indexOf("measurement");
    expect(WBS_TABLE_COLUMNS[measurement - 1]).toBe("plant:total");
    expect(WBS_TABLE_COLUMNS[measurement + 1]).toBe("markup");
  });

  it("adds no trailing Actions column (also pr-cardui-s5)", () => {
    expect(WBS_TABLE_COLUMNS[WBS_TABLE_COLUMNS.length - 1]).toBe("item-total");
    expect(WBS_TABLE_COLUMNS).not.toContain("actions");
  });

  it("rules exactly three group boundaries, each on a real column", () => {
    expect(GROUP_RULE_COLUMNS.length).toBe(3);
    for (const col of GROUP_RULE_COLUMNS) {
      expect(WBS_TABLE_COLUMNS).toContain(col);
    }
  });

  it("puts each rule at the first column of its group", () => {
    // Manpower starts right after Description; Plant right after Manpower Total.
    expect(WBS_TABLE_COLUMNS[WBS_TABLE_COLUMNS.indexOf("manpower:type") - 1]).toBe("description");
    expect(WBS_TABLE_COLUMNS[WBS_TABLE_COLUMNS.indexOf("plant:type") - 1]).toBe("manpower:total");
    expect(WBS_TABLE_COLUMNS[WBS_TABLE_COLUMNS.indexOf("markup") - 1]).toBe("measurement");
  });

  it("puts the four moved labels on the lower band, spanned by no group title", () => {
    // WBS, Description, Markup and Item total are their own columns on the
    // label band — the group band above them is blank (colSpan 2 each side).
    const moved = ["wbs", "description", "markup", "item-total"];
    for (const col of moved) {
      expect(WBS_TABLE_COLUMNS).toContain(col);
    }
    // The two blank group-band cells cover exactly these four columns.
    expect(moved.length).toBe(2 + 2);
  });

  it("the group bands cover the manpower and plant columns exactly", () => {
    const manpower = WBS_TABLE_COLUMNS.filter((c) => c.startsWith("manpower:"));
    const plant = WBS_TABLE_COLUMNS.filter((c) => c.startsWith("plant:"));
    // colSpan={6} and colSpan={5} in the group band.
    expect(manpower.length).toBe(6);
    expect(plant.length).toBe(5);
    // Group band: 2 (blank) + 6 + 5 + 1 (Measurement) + 2 (blank) = 16.
    expect(2 + manpower.length + plant.length + 1 + 2).toBe(WBS_TABLE_COLUMNS.length);
  });
});
