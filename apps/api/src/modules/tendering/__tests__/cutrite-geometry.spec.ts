// PR #37 (§7) — specs for the Cutrite geometry helpers. Pure functions,
// no Prisma, no NestJS — just the math contract.

import {
  computeBlockWeight,
  computeGhostCutLengthMetres,
} from "../cutrite-geometry";

describe("computeBlockWeight (PR #37)", () => {
  it("1m³ of concrete (2400 kg/m³) weighs 2400 kg", () => {
    expect(
      computeBlockWeight({ lengthM: 1, widthM: 1, depthM: 1 }, 2400),
    ).toBe(2400.0);
  });

  it("0.5 × 0.5 × 0.2 m concrete block weighs 120 kg", () => {
    expect(
      computeBlockWeight({ lengthM: 0.5, widthM: 0.5, depthM: 0.2 }, 2400),
    ).toBe(120.0);
  });

  it("2 × 1 × 0.3 m light-concrete block (1800 kg/m³) weighs 1080 kg", () => {
    expect(
      computeBlockWeight({ lengthM: 2, widthM: 1, depthM: 0.3 }, 1800),
    ).toBe(1080.0);
  });

  it("rounds to 1 decimal place", () => {
    // 1 × 1 × 0.1234 × 2400 = 296.16 → rounds to 296.2
    expect(
      computeBlockWeight({ lengthM: 1, widthM: 1, depthM: 0.1234 }, 2400),
    ).toBe(296.2);
  });

  it("throws on zero depth", () => {
    expect(() =>
      computeBlockWeight({ lengthM: 1, widthM: 1, depthM: 0 }, 2400),
    ).toThrow(/depthM/);
  });

  it("throws on negative length", () => {
    expect(() =>
      computeBlockWeight({ lengthM: -1, widthM: 1, depthM: 1 }, 2400),
    ).toThrow(/lengthM/);
  });

  it("throws on NaN density", () => {
    expect(() =>
      computeBlockWeight({ lengthM: 1, widthM: 1, depthM: 1 }, NaN),
    ).toThrow(/densityKgPerM3/);
  });

  it("throws on Infinity width", () => {
    expect(() =>
      computeBlockWeight(
        { lengthM: 1, widthM: Number.POSITIVE_INFINITY, depthM: 1 },
        2400,
      ),
    ).toThrow(/widthM/);
  });
});

describe("computeGhostCutLengthMetres (PR #37)", () => {
  it("2×1 rectangle, 1 piece → perimeter only (6 m)", () => {
    expect(
      computeGhostCutLengthMetres({ lengthM: 2, widthM: 1, pieces: 1 }),
    ).toBe(6.0);
  });

  it("2×1 rectangle, 2 pieces → 6 + 1 internal cut = 7 m", () => {
    expect(
      computeGhostCutLengthMetres({ lengthM: 2, widthM: 1, pieces: 2 }),
    ).toBe(7.0);
  });

  it("4×2 rectangle, 3 pieces → 12 + 2×2 internal cuts = 16 m", () => {
    expect(
      computeGhostCutLengthMetres({ lengthM: 4, widthM: 2, pieces: 3 }),
    ).toBe(16.0);
  });

  it("defaults to 1 piece when pieces is omitted", () => {
    expect(computeGhostCutLengthMetres({ lengthM: 2, widthM: 1 })).toBe(6.0);
  });

  it("rounds to 0.01 m", () => {
    // 2 × (1.2345 + 1) = 4.469 → rounds to 4.47
    expect(
      computeGhostCutLengthMetres({ lengthM: 1.2345, widthM: 1, pieces: 1 }),
    ).toBe(4.47);
  });

  it("throws when pieces is 0", () => {
    expect(() =>
      computeGhostCutLengthMetres({ lengthM: 1, widthM: 1, pieces: 0 }),
    ).toThrow(/pieces/);
  });

  it("throws when pieces is negative", () => {
    expect(() =>
      computeGhostCutLengthMetres({ lengthM: 1, widthM: 1, pieces: -1 }),
    ).toThrow(/pieces/);
  });

  it("throws when pieces is not an integer", () => {
    expect(() =>
      computeGhostCutLengthMetres({ lengthM: 1, widthM: 1, pieces: 1.5 }),
    ).toThrow(/pieces/);
  });

  it("throws on zero width", () => {
    expect(() =>
      computeGhostCutLengthMetres({ lengthM: 1, widthM: 0, pieces: 1 }),
    ).toThrow(/widthM/);
  });

  it("throws on negative length", () => {
    expect(() =>
      computeGhostCutLengthMetres({ lengthM: -1, widthM: 1, pieces: 1 }),
    ).toThrow(/lengthM/);
  });
});
