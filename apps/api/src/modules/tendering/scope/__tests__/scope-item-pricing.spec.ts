import {
  computeScopeItemTotal,
  type RateMaps,
  type ScopeItemPricingInput
} from "../../scope-item-pricing";
import type { Discipline } from "../../dto/scope-of-works.dto";

// PR B1.7.1 / B1.7.2 — pure unit tests for the canonical-row pricing
// helper. No Prisma, no DB. Every branch exercised against the formula:
//   labour = (men ?? 0) × (days ?? 0) × labourRate
//   plant  = Σ over plantItems where plantRateId set:
//             (qty ?? 1) × (days ?? 0) × plant.rate
//   lineTotal = labour + plant
//   Other discipline → lineTotal = provisionalAmount (never marked up).
//
// B1.7.2 removed the waste leg — it lived here briefly in B1.7.1 but
// per the design doc waste belongs to the auto-generated waste summary
// subtable, NOT the scope item total. The regression guard at the
// bottom locks the new contract.

const baseRates = (): RateMaps => ({
  labourRateByDiscipline: new Map<Discipline, number>([
    ["DEM", 100],
    ["CIV", 120],
    ["ASB", 150],
    ["Other", 0]
  ]),
  plantRateById: new Map<string, number>([
    ["plant-excavator", 650],
    ["plant-bobcat", 450]
  ])
});

const emptyItem = (overrides: Partial<ScopeItemPricingInput> = {}): ScopeItemPricingInput => ({
  discipline: "DEM",
  men: null,
  days: null,
  plantItems: null,
  provisionalAmount: null,
  ...overrides
});

describe("computeScopeItemTotal (PR B1.7.1 / B1.7.2)", () => {
  it("returns all zeros for an entirely empty item", () => {
    const result = computeScopeItemTotal(emptyItem(), baseRates(), 30);
    expect(result.labour).toBe(0);
    expect(result.plant).toBe(0);
    expect(result.lineTotal).toBe(0);
    expect(result.lineTotalWithMarkup).toBe(0);
  });

  it("labour only: men × days × dayRate", () => {
    // 2 men × 3 days × $100/day = $600
    const result = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3 }),
      baseRates(),
      0
    );
    expect(result.labour).toBe(600);
    expect(result.lineTotal).toBe(600);
  });

  it("plant only — single row, qty + days specified", () => {
    // 1 excavator × 5 days × $650 = $3250
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [{ columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 5 }]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(3250);
    expect(result.lineTotal).toBe(3250);
  });

  it("plant — qty defaults to 1 when omitted", () => {
    // missing qty → 1 piece × 4 days × $450 = $1800
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [{ columnIndex: 1, plantRateId: "plant-bobcat", days: 4 }]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(1800);
  });

  it("plant — multi-row sums correctly", () => {
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [
          { columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 2 }, // 1300
          { columnIndex: 2, plantRateId: "plant-bobcat", qty: 2, days: 3 } // 2700
        ]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(4000);
  });

  it("plant — unknown plantRateId contributes 0 (silent skip)", () => {
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [
          { columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 1 }, // 650
          { columnIndex: 2, plantRateId: "plant-doesnt-exist", qty: 99, days: 99 } // 0
        ]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(650);
  });

  it("Other discipline → lineTotal is provisionalAmount; never marked up", () => {
    const result = computeScopeItemTotal(
      emptyItem({
        discipline: "Other",
        provisionalAmount: 12345,
        // These should all be ignored for Other.
        men: 99,
        days: 99,
        plantItems: [{ columnIndex: 1, plantRateId: "plant-excavator", qty: 99, days: 99 }]
      }),
      baseRates(),
      30
    );
    expect(result.labour).toBe(0);
    expect(result.plant).toBe(0);
    expect(result.lineTotal).toBe(12345);
    expect(result.lineTotalWithMarkup).toBe(12345);
  });

  it("markup — lineTotalWithMarkup = lineTotal × (1 + markup/100)", () => {
    // labour 600 + plant 3250 = 3850; at 30% markup = 5005.
    const result = computeScopeItemTotal(
      emptyItem({
        men: 2,
        days: 3,
        plantItems: [{ columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 5 }]
      }),
      baseRates(),
      30
    );
    expect(result.lineTotal).toBe(3850);
    expect(result.lineTotalWithMarkup).toBeCloseTo(5005, 6);
  });

  it("mixed — labour + plant sums correctly with markup (no waste leg, B1.7.2)", () => {
    // labour 200 + plant 650 = 850; 30% markup = 1105.
    const result = computeScopeItemTotal(
      emptyItem({
        men: 1,
        days: 2,
        plantItems: [{ columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 1 }]
      }),
      baseRates(),
      30
    );
    expect(result.labour).toBe(200);
    expect(result.plant).toBe(650);
    expect(result.lineTotal).toBe(850);
    expect(result.lineTotalWithMarkup).toBeCloseTo(1105, 6);
  });

  it("regression guard (B1.7.2): result has no `waste` field; only labour + plant + lineTotal", () => {
    const result = computeScopeItemTotal(
      emptyItem({ men: 1, days: 1 }),
      baseRates(),
      0
    );
    expect("waste" in result).toBe(false);
    expect(result.labour).toBe(100);
    expect(result.plant).toBe(0);
    expect(result.lineTotal).toBe(100);
  });
});
