// Pure-function specs for the SoT §10 calculators.
// See BACKLOG-DECISIONS.md #7 — Marco shipped these in their own PR
// because they change quoted prices; the specs are what he grades the
// arithmetic against.

import {
  HOURS_PER_WORKING_DAY,
  sumLabourTaskHours,
  taskTimeCalculator,
  wasteWeightCalculator,
  wasteWeightFromTonneDensity
} from "../estimate-calculators";

describe("taskTimeCalculator — quantity ÷ production rate = hours", () => {
  it("computes hours for a normal (quantity, rate) pair", () => {
    // 200 m² of plasterboard at 25 m²/h → 8 h
    expect(taskTimeCalculator(200, 25)).toBe(8);
  });

  it("returns null when the quantity is missing", () => {
    expect(taskTimeCalculator(null, 25)).toBeNull();
    expect(taskTimeCalculator(undefined, 25)).toBeNull();
  });

  it("returns null when the production rate is missing", () => {
    expect(taskTimeCalculator(200, null)).toBeNull();
    expect(taskTimeCalculator(200, undefined)).toBeNull();
  });

  it("returns null on a zero or negative production rate (undefined division)", () => {
    expect(taskTimeCalculator(200, 0)).toBeNull();
    expect(taskTimeCalculator(200, -5)).toBeNull();
  });

  it("returns null on non-finite or negative quantity", () => {
    expect(taskTimeCalculator(Number.NaN, 25)).toBeNull();
    expect(taskTimeCalculator(Number.POSITIVE_INFINITY, 25)).toBeNull();
    expect(taskTimeCalculator(-1, 25)).toBeNull();
  });

  it("handles zero quantity as 0 hours (a real 'nothing to do' case)", () => {
    expect(taskTimeCalculator(0, 25)).toBe(0);
  });
});

describe("wasteWeightCalculator — volume × density (kg/m³) ÷ 1000 = tonnes", () => {
  it("computes tonnes for a normal (volume, density) pair", () => {
    // 10 m³ of normal concrete at 2400 kg/m³ (AS 1379) → 24 t
    expect(wasteWeightCalculator(10, 2400)).toBe(24);
  });

  it("returns null when either input is missing", () => {
    expect(wasteWeightCalculator(null, 2400)).toBeNull();
    expect(wasteWeightCalculator(10, null)).toBeNull();
    expect(wasteWeightCalculator(undefined, undefined)).toBeNull();
  });

  it("returns null on non-finite or negative inputs", () => {
    expect(wasteWeightCalculator(Number.NaN, 2400)).toBeNull();
    expect(wasteWeightCalculator(10, Number.POSITIVE_INFINITY)).toBeNull();
    expect(wasteWeightCalculator(-1, 2400)).toBeNull();
    expect(wasteWeightCalculator(10, -1)).toBeNull();
  });

  it("returns 0 for zero volume or zero density (real values, not missing)", () => {
    expect(wasteWeightCalculator(0, 2400)).toBe(0);
    expect(wasteWeightCalculator(10, 0)).toBe(0);
  });
});

describe("wasteWeightFromTonneDensity — thin wrapper for t/m³ densities", () => {
  it("scales the density into kg/m³ before delegating", () => {
    // 10 m³ × 2.4 t/m³ = 24 t (same result as the kg-density call)
    expect(wasteWeightFromTonneDensity(10, 2.4)).toBe(24);
  });

  it("returns null when the density is missing / non-finite", () => {
    expect(wasteWeightFromTonneDensity(10, null)).toBeNull();
    expect(wasteWeightFromTonneDensity(10, Number.NaN)).toBeNull();
  });

  it("propagates the base calculator's guards on volume", () => {
    expect(wasteWeightFromTonneDensity(null, 2.4)).toBeNull();
    expect(wasteWeightFromTonneDensity(-1, 2.4)).toBeNull();
  });
});

describe("sumLabourTaskHours — Σ (persons × days × HOURS_PER_WORKING_DAY)", () => {
  it("uses the working-day constant to convert person-days to hours", () => {
    // Sanity: the constant is 8. If a site ever switches to 10h shifts,
    // this constant flips and every consumer follows.
    expect(HOURS_PER_WORKING_DAY).toBe(8);
  });

  it("sums across multiple labour lines", () => {
    // (2 × 5 × 8) + (3 × 2 × 8) = 80 + 48 = 128
    expect(
      sumLabourTaskHours([
        { qty: 2, days: 5 },
        { qty: 3, days: 2 }
      ])
    ).toBe(128);
  });

  it("returns 0 on an empty list", () => {
    expect(sumLabourTaskHours([])).toBe(0);
  });

  it("skips lines whose qty or days is not finite (guards downstream Decimal→number)", () => {
    expect(
      sumLabourTaskHours([
        { qty: Number.NaN, days: 5 },
        { qty: 2, days: 5 }
      ])
    ).toBe(80);
  });
});
