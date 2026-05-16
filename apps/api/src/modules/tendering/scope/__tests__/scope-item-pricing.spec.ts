import {
  computeScopeItemTotal,
  wasteRateKey,
  type RateMaps,
  type ScopeItemPricingInput
} from "../../scope-item-pricing";
import type { Discipline } from "../../dto/scope-of-works.dto";

// PR B1.7.1 — pure unit tests for the canonical-row pricing helper.
// No Prisma, no DB — every branch is exercised against the formula
// locked in the B1.7.1 investigation.

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
  ]),
  wasteTonRateByGroupAndType: new Map<string, number>([
    [wasteRateKey("Concrete", "Clean concrete"), 80],
    [wasteRateKey("Mixed", "General"), 120]
  ])
});

const emptyItem = (overrides: Partial<ScopeItemPricingInput> = {}): ScopeItemPricingInput => ({
  discipline: "DEM",
  men: null,
  days: null,
  plantItems: null,
  unit: null,
  value: null,
  wasteIncluded: false,
  wasteGroup: null,
  wasteItem: null,
  provisionalAmount: null,
  ...overrides
});

describe("computeScopeItemTotal (PR B1.7.1)", () => {
  it("returns all zeros for an entirely empty item", () => {
    const result = computeScopeItemTotal(emptyItem(), baseRates(), 30);
    expect(result.labour).toBe(0);
    expect(result.plant).toBe(0);
    expect(result.waste).toBe(0);
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

  it("waste — happy path: unit=t, wasteIncluded, value × tonRate", () => {
    // 12 tonnes × $80/t = $960
    const result = computeScopeItemTotal(
      emptyItem({
        unit: "t",
        value: 12,
        wasteIncluded: true,
        wasteGroup: "Concrete",
        wasteItem: "Clean concrete"
      }),
      baseRates(),
      0
    );
    expect(result.waste).toBe(960);
    expect(result.lineTotal).toBe(960);
  });

  it("waste — non-t unit contributes 0 (B1.7.1 limitation, B3 revisit)", () => {
    for (const unit of ["m²", "m³", "ea"]) {
      const result = computeScopeItemTotal(
        emptyItem({
          unit,
          value: 50,
          wasteIncluded: true,
          wasteGroup: "Concrete",
          wasteItem: "Clean concrete"
        }),
        baseRates(),
        0
      );
      expect(result.waste).toBe(0);
    }
  });

  it("waste — wasteIncluded=false contributes 0 even with unit=t and rate match", () => {
    const result = computeScopeItemTotal(
      emptyItem({
        unit: "t",
        value: 100,
        wasteIncluded: false,
        wasteGroup: "Concrete",
        wasteItem: "Clean concrete"
      }),
      baseRates(),
      0
    );
    expect(result.waste).toBe(0);
  });

  it("waste — missing wasteGroup or wasteItem contributes 0", () => {
    const noGroup = computeScopeItemTotal(
      emptyItem({ unit: "t", value: 10, wasteIncluded: true, wasteItem: "Clean concrete" }),
      baseRates(),
      0
    );
    const noItem = computeScopeItemTotal(
      emptyItem({ unit: "t", value: 10, wasteIncluded: true, wasteGroup: "Concrete" }),
      baseRates(),
      0
    );
    expect(noGroup.waste).toBe(0);
    expect(noItem.waste).toBe(0);
  });

  it("waste — unknown (group, item) pair contributes 0", () => {
    const result = computeScopeItemTotal(
      emptyItem({
        unit: "t",
        value: 10,
        wasteIncluded: true,
        wasteGroup: "Unknown",
        wasteItem: "Unmapped"
      }),
      baseRates(),
      0
    );
    expect(result.waste).toBe(0);
  });

  it("Other discipline → lineTotal is provisionalAmount; never marked up", () => {
    const result = computeScopeItemTotal(
      emptyItem({
        discipline: "Other",
        provisionalAmount: 12345,
        // These should all be ignored for Other.
        men: 99,
        days: 99,
        plantItems: [{ columnIndex: 1, plantRateId: "plant-excavator", qty: 99, days: 99 }],
        unit: "t",
        value: 99,
        wasteIncluded: true,
        wasteGroup: "Concrete",
        wasteItem: "Clean concrete"
      }),
      baseRates(),
      30
    );
    expect(result.labour).toBe(0);
    expect(result.plant).toBe(0);
    expect(result.waste).toBe(0);
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

  it("mixed — labour + plant + waste sums correctly with markup", () => {
    // labour 200 + plant 650 + waste 960 = 1810; 30% markup = 2353.
    const result = computeScopeItemTotal(
      emptyItem({
        men: 1,
        days: 2,
        plantItems: [{ columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 1 }],
        unit: "t",
        value: 12,
        wasteIncluded: true,
        wasteGroup: "Concrete",
        wasteItem: "Clean concrete"
      }),
      baseRates(),
      30
    );
    expect(result.labour).toBe(200);
    expect(result.plant).toBe(650);
    expect(result.waste).toBe(960);
    expect(result.lineTotal).toBe(1810);
    expect(result.lineTotalWithMarkup).toBeCloseTo(2353, 6);
  });
});
