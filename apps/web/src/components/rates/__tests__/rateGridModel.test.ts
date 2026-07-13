import { describe, expect, it } from "vitest";
import {
  compareRows,
  distinctValues,
  groupRows,
  matchesQuery,
  passesColumnFilters,
  passesNumberRange,
  type RateGridColumn,
  type RateGridRow
} from "../rateGridModel";

const cols: RateGridColumn[] = [
  { key: "equipment", label: "Equipment", kind: "text", filterable: true, sortable: true, groupable: true },
  { key: "depth", label: "Depth", kind: "number", unit: "mm", filterable: true, sortable: true },
  { key: "rate", label: "Rate", kind: "currency", unit: "m", filterable: false, sortable: true }
];

function row(id: string, values: Record<string, string | number | null>): RateGridRow {
  return { id, values };
}

const rows: RateGridRow[] = [
  row("1", { equipment: "Concrete saw", depth: 100, rate: 55 }),
  row("2", { equipment: "Concrete saw", depth: 200, rate: 78 }),
  row("3", { equipment: "Wire saw", depth: 100, rate: 90 }),
  row("4", { equipment: "Wire saw", depth: null, rate: 120 })
];

describe("matchesQuery", () => {
  it("returns true for empty query", () => {
    expect(matchesQuery(rows[0], cols, "")).toBe(true);
    expect(matchesQuery(rows[0], cols, "   ")).toBe(true);
  });

  it("requires every whitespace-separated token to match (case-insensitive)", () => {
    expect(matchesQuery(rows[0], cols, "concrete 100")).toBe(true);
    expect(matchesQuery(rows[0], cols, "CONCRETE 100")).toBe(true);
    expect(matchesQuery(rows[0], cols, "concrete 200")).toBe(false);
  });

  it("searches numeric values by their string projection", () => {
    expect(matchesQuery(rows[1], cols, "78")).toBe(true);
    expect(matchesQuery(rows[1], cols, "999")).toBe(false);
  });
});

describe("passesColumnFilters", () => {
  it("passes when no filter is set for a column", () => {
    expect(passesColumnFilters(rows[0], {})).toBe(true);
  });

  it("blocks every row when the allowed set is empty", () => {
    expect(passesColumnFilters(rows[0], { equipment: new Set() })).toBe(false);
  });

  it("matches on membership", () => {
    const f = { equipment: new Set(["Concrete saw"]) };
    expect(passesColumnFilters(rows[0], f)).toBe(true);
    expect(passesColumnFilters(rows[2], f)).toBe(false);
  });
});

describe("passesNumberRange", () => {
  it("open range passes everything numeric", () => {
    expect(passesNumberRange(rows[0], "depth", null, null)).toBe(true);
  });

  it("min only", () => {
    expect(passesNumberRange(rows[0], "depth", 150, null)).toBe(false);
    expect(passesNumberRange(rows[1], "depth", 150, null)).toBe(true);
  });

  it("max only", () => {
    expect(passesNumberRange(rows[0], "depth", null, 150)).toBe(true);
    expect(passesNumberRange(rows[1], "depth", null, 150)).toBe(false);
  });

  it("bounds are inclusive", () => {
    expect(passesNumberRange(rows[0], "depth", 100, 100)).toBe(true);
  });

  it("non-numeric / null values fail any bounded range", () => {
    expect(passesNumberRange(rows[3], "depth", 0, 500)).toBe(false);
  });
});

describe("distinctValues", () => {
  it("returns sorted, de-duped, string-projected values", () => {
    expect(distinctValues(rows, "equipment")).toEqual(["Concrete saw", "Wire saw"]);
    expect(distinctValues(rows, "depth")).toEqual(["", "100", "200"]);
  });
});

describe("compareRows", () => {
  const equipCol = cols[0];
  const depthCol = cols[1];

  it("compares text via localeCompare, both directions", () => {
    expect(compareRows(rows[0], rows[2], equipCol, 1)).toBeLessThan(0);
    expect(compareRows(rows[0], rows[2], equipCol, -1)).toBeGreaterThan(0);
  });

  it("compares numbers numerically", () => {
    expect(compareRows(rows[0], rows[1], depthCol, 1)).toBeLessThan(0);
    expect(compareRows(rows[1], rows[0], depthCol, 1)).toBeGreaterThan(0);
    expect(compareRows(rows[0], rows[1], depthCol, -1)).toBeGreaterThan(0);
  });

  it("pushes non-numeric values to the end for number columns", () => {
    expect(compareRows(rows[3], rows[0], depthCol, 1)).toBeGreaterThan(0);
    expect(compareRows(rows[0], rows[3], depthCol, 1)).toBeLessThan(0);
  });
});

describe("groupRows", () => {
  it("returns one synthetic group when the key is null", () => {
    const groups = groupRows(rows, null);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(rows.length);
  });

  it("groups by column value in stable alphabetical order", () => {
    const groups = groupRows(rows, "equipment");
    expect(groups.map((g) => g.key)).toEqual(["Concrete saw", "Wire saw"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(["3", "4"]);
  });
});
