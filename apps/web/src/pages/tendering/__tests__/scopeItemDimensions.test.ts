import { describe, it, expect } from "vitest";
import { computeDerivedDimensions, isDimensionOverride } from "../scopeItemDimensions";

describe("isDimensionOverride", () => {
  it("returns false when saved is null", () => {
    expect(isDimensionOverride(null, 10)).toBe(false);
  });

  it("returns false when saved is undefined", () => {
    expect(isDimensionOverride(undefined, 10)).toBe(false);
  });

  it("returns false when saved is not a finite number", () => {
    expect(isDimensionOverride("abc", 10)).toBe(false);
    expect(isDimensionOverride("NaN", 10)).toBe(false);
  });

  it("returns true when saved has a value but auto is null (no derive basis)", () => {
    expect(isDimensionOverride("500", null)).toBe(true);
  });

  it("returns true when saved differs from auto-derive", () => {
    expect(isDimensionOverride("500", 10)).toBe(true);
  });

  it("returns false when saved equals auto-derive", () => {
    expect(isDimensionOverride("10", 10)).toBe(false);
  });

  it("handles rounding tolerance: 50.001 vs 50.00 → not override", () => {
    expect(isDimensionOverride("50.001", 50.00)).toBe(false);
  });

  it("handles rounding tolerance: 50.006 vs 50.00 → is override", () => {
    expect(isDimensionOverride("50.006", 50.00)).toBe(true);
  });

  it("treats zero saved vs null auto as override", () => {
    expect(isDimensionOverride("0", null)).toBe(true);
  });

  it("treats zero saved vs zero auto as not override", () => {
    expect(isDimensionOverride("0", 0)).toBe(false);
  });
});

describe("dirty-on-load integration", () => {
  function computeDirtyOnLoad(item: {
    length?: string | null;
    height?: string | null;
    depth?: string | null;
    density?: string | null;
    sqm?: string | null;
    m3?: string | null;
    tonnes?: string | null;
  }) {
    const num = (v: string | null | undefined) => (v == null ? null : Number(v));
    const autoDerived = computeDerivedDimensions({
      length: num(item.length),
      height: num(item.height),
      depth: num(item.depth),
      density: num(item.density),
      sqm: null,
      m3: null,
      tonnes: null
    });
    return {
      sqm: isDimensionOverride(item.sqm, autoDerived.sqm),
      m3: isDimensionOverride(item.m3, autoDerived.m3),
      tonnes: isDimensionOverride(item.tonnes, autoDerived.tonnes)
    };
  }

  it("sqm override: saved 500 vs auto-derive 10 (L=4, H=2.5)", () => {
    const dirty = computeDirtyOnLoad({
      length: "4", height: "2.5", sqm: "500"
    });
    expect(dirty.sqm).toBe(true);
  });

  it("sqm matches auto-derive: saved 10 with L=4, H=2.5", () => {
    const dirty = computeDirtyOnLoad({
      length: "4", height: "2.5", sqm: "10"
    });
    expect(dirty.sqm).toBe(false);
  });

  it("null saved sqm → not dirty", () => {
    const dirty = computeDirtyOnLoad({
      length: "4", height: "2.5", sqm: null
    });
    expect(dirty.sqm).toBe(false);
  });

  it("m3 override: saved 100 vs auto-derive 5 (L=4, H=2.5, D=0.5)", () => {
    const dirty = computeDirtyOnLoad({
      length: "4", height: "2.5", depth: "0.5", m3: "100"
    });
    expect(dirty.m3).toBe(true);
  });

  it("m3 matches: saved 5 with L=4, H=2.5, D=0.5", () => {
    const dirty = computeDirtyOnLoad({
      length: "4", height: "2.5", depth: "0.5", m3: "5"
    });
    expect(dirty.m3).toBe(false);
  });

  it("tonnes override: saved 50 vs auto-derive 12 (L=4, H=2.5, D=0.5, density=2.4)", () => {
    const dirty = computeDirtyOnLoad({
      length: "4", height: "2.5", depth: "0.5", density: "2.4", tonnes: "50"
    });
    expect(dirty.tonnes).toBe(true);
  });

  it("tonnes matches: saved 12 with L=4, H=2.5, D=0.5, density=2.4", () => {
    const dirty = computeDirtyOnLoad({
      length: "4", height: "2.5", depth: "0.5", density: "2.4", tonnes: "12"
    });
    expect(dirty.tonnes).toBe(false);
  });

  it("rounding tolerance: 50.001 vs 50.00 → not dirty", () => {
    const dirty = computeDirtyOnLoad({
      length: "10", height: "5", sqm: "50.001"
    });
    expect(dirty.sqm).toBe(false);
  });

  it("all null saved → all false", () => {
    const dirty = computeDirtyOnLoad({
      length: "4", height: "2.5", depth: "0.5", density: "2.4"
    });
    expect(dirty).toEqual({ sqm: false, m3: false, tonnes: false });
  });

  it("no raw inputs, saved sqm = 500 → override (no auto basis)", () => {
    const dirty = computeDirtyOnLoad({ sqm: "500" });
    expect(dirty.sqm).toBe(true);
  });
});

describe("cascade-release downstream dirty flags", () => {
  type DirtyFlags = { sqm: boolean; m3: boolean; tonnes: boolean };
  type DimKey = "length" | "height" | "depth" | "density" | "sqm" | "m3" | "tonnes";

  /**
   * Mirrors the cascade-release logic in ScopeQuantitiesTable's setDim.
   * Starts from all-dirty (simulating saved overrides on load) and applies
   * the edit of a single upstream field.
   */
  function applySetDim(k: DimKey, initial: DirtyFlags = { sqm: true, m3: true, tonnes: true }): DirtyFlags {
    const next = { ...initial };
    if (k === "sqm" || k === "m3" || k === "tonnes") {
      next[k] = true;
    }
    if (k === "length" || k === "height") {
      next.sqm = false;
      next.m3 = false;
      next.tonnes = false;
    } else if (k === "depth") {
      next.m3 = false;
      next.tonnes = false;
    } else if (k === "density") {
      next.tonnes = false;
    } else if (k === "sqm") {
      next.m3 = false;
      next.tonnes = false;
    } else if (k === "m3") {
      next.tonnes = false;
    }
    return next;
  }

  it("editing length releases sqm, m3, tonnes", () => {
    const d = applySetDim("length");
    expect(d).toEqual({ sqm: false, m3: false, tonnes: false });
  });

  it("editing height releases sqm, m3, tonnes", () => {
    const d = applySetDim("height");
    expect(d).toEqual({ sqm: false, m3: false, tonnes: false });
  });

  it("editing depth releases m3, tonnes (sqm stays)", () => {
    const d = applySetDim("depth");
    expect(d).toEqual({ sqm: true, m3: false, tonnes: false });
  });

  it("editing density releases tonnes (sqm, m3 stay)", () => {
    const d = applySetDim("density");
    expect(d).toEqual({ sqm: true, m3: true, tonnes: false });
  });

  it("editing sqm sets sqm dirty, releases m3 and tonnes", () => {
    const d = applySetDim("sqm", { sqm: false, m3: true, tonnes: true });
    expect(d).toEqual({ sqm: true, m3: false, tonnes: false });
  });

  it("editing m3 sets m3 dirty, releases tonnes", () => {
    const d = applySetDim("m3", { sqm: true, m3: false, tonnes: true });
    expect(d).toEqual({ sqm: true, m3: true, tonnes: false });
  });

  it("editing tonnes does not release anything", () => {
    const d = applySetDim("tonnes");
    expect(d).toEqual({ sqm: true, m3: true, tonnes: true });
  });

  it("upstream edit then re-override downstream: tonnes sticks after m3 edit + tonnes edit", () => {
    let d = applySetDim("m3");
    expect(d.tonnes).toBe(false);
    d = applySetDim("tonnes", d);
    expect(d.tonnes).toBe(true);
  });
});
