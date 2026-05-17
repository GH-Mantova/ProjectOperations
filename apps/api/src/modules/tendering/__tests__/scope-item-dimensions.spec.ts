// PR B4a — specs for the pure dimensions helper. Pure function, no
// Prisma, no NestJS — just the math contract.

import { computeDerivedDimensions } from "../scope-item-dimensions";

describe("computeDerivedDimensions (PR B4a)", () => {
  it("returns all nulls when nothing is supplied", () => {
    expect(computeDerivedDimensions({})).toEqual({ sqm: null, m3: null, tonnes: null });
  });

  it("with length only, sqm/m3/tonnes are all null", () => {
    expect(computeDerivedDimensions({ length: 5 })).toEqual({
      sqm: null,
      m3: null,
      tonnes: null
    });
  });

  it("with length + height, derives sqm but not m3 or tonnes", () => {
    expect(computeDerivedDimensions({ length: 4, height: 2.5 })).toEqual({
      sqm: 10,
      m3: null,
      tonnes: null
    });
  });

  it("with L + H + D, derives sqm and m3 (tonnes still null without density)", () => {
    expect(computeDerivedDimensions({ length: 4, height: 2.5, depth: 0.5 })).toEqual({
      sqm: 10,
      m3: 5,
      tonnes: null
    });
  });

  it("with L + H + D + density, derives all three", () => {
    expect(
      computeDerivedDimensions({ length: 4, height: 2.5, depth: 0.5, density: 2.4 })
    ).toEqual({ sqm: 10, m3: 5, tonnes: 12 });
  });

  it("explicit sqm overrides length×height", () => {
    expect(
      computeDerivedDimensions({ length: 4, height: 2.5, sqm: 99 })
    ).toEqual({ sqm: 99, m3: null, tonnes: null });
  });

  it("explicit m3 overrides sqm×depth (and is independent of L/H)", () => {
    // L+H would give sqm=10; depth=0.5 would give m3=5. Override pins m3=7.
    expect(
      computeDerivedDimensions({ length: 4, height: 2.5, depth: 0.5, m3: 7, density: 2 })
    ).toEqual({ sqm: 10, m3: 7, tonnes: 14 }); // tonnes derives from overridden m3
  });

  it("explicit tonnes overrides m3×density", () => {
    expect(
      computeDerivedDimensions({
        length: 4,
        height: 2.5,
        depth: 0.5,
        density: 2.4,
        tonnes: 99
      })
    ).toEqual({ sqm: 10, m3: 5, tonnes: 99 });
  });

  it("explicit 0 is honoured as an override (not treated as null)", () => {
    expect(
      computeDerivedDimensions({ length: 4, height: 2.5, sqm: 0, depth: 0.5, density: 2 })
    ).toEqual({ sqm: 0, m3: 0, tonnes: 0 });
  });

  it("null sqm explicitly means 'derive' — falls back to L×H", () => {
    expect(
      computeDerivedDimensions({ length: 4, height: 2.5, sqm: null })
    ).toEqual({ sqm: 10, m3: null, tonnes: null });
  });

  it("negative inputs are rejected (treated as null)", () => {
    expect(
      computeDerivedDimensions({ length: -4, height: 2.5 })
    ).toEqual({ sqm: null, m3: null, tonnes: null });
  });

  it("non-finite inputs are rejected", () => {
    expect(
      computeDerivedDimensions({ length: Number.NaN, height: 2.5 })
    ).toEqual({ sqm: null, m3: null, tonnes: null });
    expect(
      computeDerivedDimensions({ length: Number.POSITIVE_INFINITY, height: 2.5 })
    ).toEqual({ sqm: null, m3: null, tonnes: null });
  });

  it("rounds derived values to 2 decimal places", () => {
    // 0.333 × 0.333 = 0.110889 → round to 0.11
    expect(computeDerivedDimensions({ length: 0.333, height: 0.333 }).sqm).toBe(0.11);
  });
});
