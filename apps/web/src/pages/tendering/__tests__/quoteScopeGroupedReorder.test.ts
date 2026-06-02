import { describe, it, expect } from "vitest";
import {
  disciplineForItem,
  groupByDiscipline,
  recomputeSortOrderWithinGroup,
  type QuoteScopeItemForGrouping
} from "../quoteScopeGroupedReorder";

const item = (
  id: string,
  label: string | null,
  quoteDiscipline: string | null = null
): QuoteScopeItemForGrouping => ({ id, label, quoteDiscipline });

describe("disciplineForItem", () => {
  it("prefers an explicit quoteDiscipline over the label prefix", () => {
    expect(disciplineForItem(item("1", "DEM3", "CIV"))).toBe("CIV");
  });

  it("derives DEM/CIV/ASB from the label prefix when no quoteDiscipline", () => {
    expect(disciplineForItem(item("1", "DEM1"))).toBe("DEM");
    expect(disciplineForItem(item("2", "CIV4"))).toBe("CIV");
    expect(disciplineForItem(item("3", "ASB2"))).toBe("ASB");
  });

  it("is case-insensitive on the label prefix", () => {
    expect(disciplineForItem(item("1", "dem5"))).toBe("DEM");
  });

  it("falls back to Other for unknown prefixes or missing labels", () => {
    expect(disciplineForItem(item("1", "XYZ1"))).toBe("Other");
    expect(disciplineForItem(item("2", null))).toBe("Other");
    expect(disciplineForItem(item("3", "Oth7"))).toBe("Other");
  });
});

describe("groupByDiscipline", () => {
  it("partitions rows by discipline and sorts groups alphabetically", () => {
    const rows = [item("a", "DEM1"), item("b", "CIV1"), item("c", "DEM2")];
    const groups = groupByDiscipline(rows);
    expect(groups.map(([k]) => k)).toEqual(["CIV", "DEM"]);
    expect(groups[0]![1].map((r) => r.id)).toEqual(["b"]);
    expect(groups[1]![1].map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("includes empty groups passed in", () => {
    const rows = [item("a", "DEM1")];
    const groups = groupByDiscipline(rows, ["ASB"]);
    expect(groups.map(([k]) => k)).toEqual(["ASB", "DEM"]);
    expect(groups[0]![1]).toEqual([]);
  });

  it("does not duplicate an empty group that already has items", () => {
    const rows = [item("a", "DEM1")];
    const groups = groupByDiscipline(rows, ["DEM"]);
    expect(groups.length).toBe(1);
    expect(groups[0]![1].map((r) => r.id)).toEqual(["a"]);
  });
});

describe("recomputeSortOrderWithinGroup", () => {
  const rows = [
    item("d1", "DEM1"),
    item("c1", "CIV1"),
    item("d2", "DEM2"),
    item("c2", "CIV2"),
    item("d3", "DEM3")
  ];

  it("reorders within the same discipline, preserving other items' absolute positions", () => {
    const result = recomputeSortOrderWithinGroup(rows, "d1", "d3");
    expect(result).not.toBeNull();
    expect(result!.map((r) => r.id)).toEqual(["d2", "c1", "d3", "c2", "d1"]);
  });

  it("returns null when the drop crosses disciplines", () => {
    expect(recomputeSortOrderWithinGroup(rows, "d1", "c1")).toBeNull();
    expect(recomputeSortOrderWithinGroup(rows, "c2", "d3")).toBeNull();
  });

  it("returns null when active and over are the same id", () => {
    expect(recomputeSortOrderWithinGroup(rows, "d1", "d1")).toBeNull();
  });

  it("returns null when either id is not in the rows", () => {
    expect(recomputeSortOrderWithinGroup(rows, "d1", "missing")).toBeNull();
    expect(recomputeSortOrderWithinGroup(rows, "missing", "d1")).toBeNull();
  });

  it("respects explicit quoteDiscipline over label prefix when classifying cross-group", () => {
    // d1's label says DEM but its quoteDiscipline says CIV → cross-group with d2 (DEM).
    const overridden = [
      item("d1", "DEM1", "CIV"),
      item("d2", "DEM2")
    ];
    expect(recomputeSortOrderWithinGroup(overridden, "d1", "d2")).toBeNull();
  });

  it("does not reassign discipline on a within-group move", () => {
    const result = recomputeSortOrderWithinGroup(rows, "d1", "d2");
    expect(result).not.toBeNull();
    const moved = result!.find((r) => r.id === "d1")!;
    expect(moved.quoteDiscipline).toBe(rows.find((r) => r.id === "d1")!.quoteDiscipline);
    expect(moved.label).toBe("DEM1");
  });
});
