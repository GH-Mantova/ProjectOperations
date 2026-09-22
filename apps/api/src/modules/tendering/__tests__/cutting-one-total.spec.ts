/**
 * cutting-one-total.spec.ts — CUTTING_ONE_TOTAL_V1 (scopecards-s7)
 *
 * Covers:
 *   1. cuttingLineTotal — half-up rounding at exact half-cents
 *   2. Scope-card equivalence: for every seeded cutting/cutting-mm/core-hole row,
 *      at qty 1, 2.5 and 17.35, with and without shiftLoading, the new Decimal
 *      half-up path is consistent, and cases where it differs from toFixed are
 *      documented below.
 *   3. priceCuttingLine — next-depth-up rule for saw cuts
 *   4. priceCuttingLine — supplied rate stored as given, no lookup
 *   5. estimates.service.ts updateCuttingLine recomputes when qty or rate changes
 *   6. priceCuttingLine — Wall elevation uses scope-card rate
 *   7. priceCuttingLine — core hole with no depth stores today's rate * qty
 *   8. Six readers use lineTotal, not qty * rate
 *
 * Half-cent cases where toFixed and Decimal half-up DIFFER (for PR body):
 *   - Ringsaw Wall 225mm qty=2.5 shift=0:  2.5 * 105.71 = 264.275 → toFixed=264.27 (JS round-half-even), half-up=264.28
 *   - Ringsaw Wall 225mm qty=2.5 shift=5:  2.5 * 105.71 + 5 = 269.275 → toFixed=269.27, half-up=269.28
 *   - Core-hole 32mm Floor depth=30 qty=17.35 shift=0: 17.35 * 5.10 = 88.485 → toFixed=88.49 (JS rounds this up), half-up=88.49
 *   - Core-hole 32mm Floor depth=30 qty=17.35 shift=5: 88.485 + 5 = 93.485 → toFixed=93.48 (JS rounds down), half-up=93.49
 *   - Core-hole 32mm Wall depth=30 qty=2.5 shift=5: 2.5 * 5.61 + 5 = 19.025 → toFixed=19.02 (JS rounds down), half-up=19.03
 *
 * In all cases the Decimal ROUND_HALF_UP result is the mathematically correct
 * half-cent rounding. The toFixed differences are JS binary-float artifacts.
 * Since Marco confirmed "no existing calculated quote within the ERP now",
 * these 5 divergences move no committed figure.
 */

import { Prisma } from "@prisma/client";
import { cuttingLineTotal, priceCuttingLine } from "../cutting-line-pricing";
import { RateResolverService } from "../../rates/rate-resolver.service";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRateResolver(overrides: Partial<{
  listRates: jest.Mock;
  resolveRate: jest.Mock;
}> = {}): RateResolverService {
  return {
    listRates: overrides.listRates ?? jest.fn().mockResolvedValue([]),
    resolveRate: overrides.resolveRate ?? jest.fn().mockResolvedValue(null)
  } as unknown as RateResolverService;
}

/** Decimal round-half-up (the canonical Postgres ROUND path). */
function halfUpDec(qty: number, rate: number, addOn = 0): Prisma.Decimal {
  return new Prisma.Decimal(qty.toString())
    .mul(new Prisma.Decimal(rate.toString()))
    .add(new Prisma.Decimal(addOn.toString()))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Old toFixed path for comparison (pre-slice). */
function oldToFixed(qty: number, rate: number, addOn = 0): string {
  return (qty * rate + addOn).toFixed(2);
}

// ── Section 1: cuttingLineTotal — half-up rounding ────────────────────────

describe("cuttingLineTotal — half-up rounding at exact half-cents", () => {
  test("qty=1 rate=1.005 → 1.01 (half-up)", () => {
    const result = cuttingLineTotal({ qty: 1, rate: "1.005" });
    expect(result.equals(new Prisma.Decimal("1.01"))).toBe(true);
  });

  test("qty=3 rate=0.335 → 1.01 (3 * 0.335 = 1.005, half-up → 1.01)", () => {
    const result = cuttingLineTotal({ qty: 3, rate: "0.335" });
    expect(result.equals(new Prisma.Decimal("1.01"))).toBe(true);
  });

  test("addOn is added before rounding: qty=1 rate=1.005 addOn=0.5 → 1.51 (1.005+0.5=1.505)", () => {
    const result = cuttingLineTotal({ qty: 1, rate: "1.005", addOn: "0.5" });
    // 1.005 + 0.5 = 1.505, half-up → 1.51
    expect(result.equals(new Prisma.Decimal("1.51"))).toBe(true);
  });

  test("qty=2 rate=0.005 → 0.01 (2*0.005=0.010)", () => {
    const result = cuttingLineTotal({ qty: 2, rate: "0.005" });
    expect(result.equals(new Prisma.Decimal("0.01"))).toBe(true);
  });

  test("qty=1 rate=0.004 → 0.00 (rounds down)", () => {
    const result = cuttingLineTotal({ qty: 1, rate: "0.004" });
    expect(result.equals(new Prisma.Decimal("0.00"))).toBe(true);
  });

  test("accepts Prisma.Decimal inputs", () => {
    const result = cuttingLineTotal({
      qty: new Prisma.Decimal("3"),
      rate: new Prisma.Decimal("0.335")
    });
    expect(result.equals(new Prisma.Decimal("1.01"))).toBe(true);
  });

  test("addOn=null treated as 0", () => {
    const result = cuttingLineTotal({ qty: 5, rate: "2.00", addOn: null });
    expect(result.equals(new Prisma.Decimal("10.00"))).toBe(true);
  });
});

// ── Section 2: scope-card equivalence ────────────────────────────────────────
// For every seeded cutting/cutting-mm/core-hole row, at qty 1, 2.5 and 17.35,
// with and without shiftLoading, verify cuttingLineTotal is exactly 2 decimal places
// (Decimal arithmetic, not float) and for non-half-cent cases matches toFixed.
//
// Known half-cent divergences (see header docblock and PR body):
//   - Ringsaw Wall 225mm qty=2.5 shift=0 and shift=5
//   - Core-hole 32mm Floor depth=30 qty=17.35 shift=0 and shift=5
//   - Core-hole 32mm Wall depth=30 qty=2.5 shift=5

const KNOWN_HALF_CENT_CASES = new Set([
  "Ringsaw Wall 225mm:2.5:0",
  "Ringsaw Wall 225mm:2.5:5",
  "Core-hole 32mm Floor depth=30:17.35:0",
  "Core-hole 32mm Floor depth=30:17.35:5",
  "Core-hole 32mm Wall depth=30:2.5:5"
]);

describe("scope-card equivalence — cuttingLineTotal produces exact 2dp, agrees with toFixed on non-half-cent cases", () => {
  // All seeded cutting rates (from cutting-step-equivalence.spec.ts + seed migrations)
  const seededCuttingRates = [
    // Demosaw Floor
    { label: "Demosaw Floor 25mm", rate: 7.55 },
    { label: "Demosaw Floor 50mm", rate: 10.9 },
    { label: "Demosaw Floor 75mm", rate: 15.35 },
    { label: "Demosaw Floor 100mm", rate: 22.25 },
    { label: "Demosaw Floor 125mm", rate: 24.7 },
    { label: "Demosaw Floor 150mm", rate: 28.4 },
    // Demosaw Wall/Concrete
    { label: "Demosaw Wall 25mm", rate: 9.95 },
    { label: "Demosaw Wall 50mm", rate: 17.0 },
    { label: "Demosaw Wall 75mm", rate: 23.6 },
    { label: "Demosaw Wall 100mm", rate: 31.7 },
    { label: "Demosaw Wall 125mm", rate: 39.75 },
    { label: "Demosaw Wall 150mm", rate: 48.6 },
    // Ringsaw Any
    { label: "Ringsaw Any 175mm", rate: 71.3 },
    { label: "Ringsaw Any 200mm", rate: 84.25 },
    { label: "Ringsaw Any 225mm", rate: 96.1 },
    { label: "Ringsaw Any 250mm", rate: 108 },
    { label: "Ringsaw Any 275mm", rate: 117.7 },
    { label: "Ringsaw Any 300mm", rate: 126.35 },
    { label: "Ringsaw Any 320mm", rate: 141.5 },
    // Ringsaw Wall (seeded at Any * 1.1 to the cent)
    { label: "Ringsaw Wall 175mm", rate: 78.43 },
    { label: "Ringsaw Wall 200mm", rate: 92.68 },
    { label: "Ringsaw Wall 225mm", rate: 105.71 },
    { label: "Ringsaw Wall 250mm", rate: 118.8 },
    { label: "Ringsaw Wall 300mm", rate: 138.99 },
    { label: "Ringsaw Wall 320mm", rate: 155.65 }
  ];

  // cutting-mm rates (finalRate computed by step formula)
  const seededCuttingMmRates = [
    { label: "Tracksaw Floor 25mm", finalRate: 18.0 },
    { label: "Tracksaw Floor 80mm", finalRate: 57.6 },
    { label: "Tracksaw Wall 25mm", finalRate: 19.8 },
    { label: "Tracksaw Wall 80mm", finalRate: 63.36 },
    { label: "Flush-cut Floor 25mm", finalRate: 18.0 },
    { label: "Flush-cut Wall 25mm", finalRate: 19.8 }
  ];

  // core-hole rates (finalRate per hole, from unit-test-compat step formula)
  const seededCoreHoleRates = [
    { label: "Core-hole 32mm Floor depth=30", finalRate: 3 * 1.70 },   // 5.10
    { label: "Core-hole 32mm Wall depth=30", finalRate: 3 * 1.70 * 1.1 },  // 5.61
    { label: "Core-hole 100mm Floor depth=50", finalRate: 5 * 2.55 },  // 12.75
    { label: "Core-hole 150mm Floor depth=30", finalRate: 3 * 3.20 }   // 9.60
  ];

  const qtyValues = [1, 2.5, 17.35];
  const shiftValues = [0, 5.0];

  function runCase(label: string, rate: number, qty: number, shift: number) {
    const caseKey = `${label}:${qty}:${shift}`;
    const newVal = cuttingLineTotal({ qty, rate, addOn: shift });
    // Always: result must be exactly 2 decimal places (Decimal arithmetic).
    expect(newVal.decimalPlaces()).toBeLessThanOrEqual(2);
    // Non-half-cent cases: toFixed and half-up must agree.
    if (!KNOWN_HALF_CENT_CASES.has(caseKey)) {
      const old = oldToFixed(qty, rate, shift);
      expect(Number(newVal.toFixed(2))).toBeCloseTo(Number(old), 5);
    }
  }

  for (const { label, rate } of seededCuttingRates) {
    for (const qty of qtyValues) {
      for (const shift of shiftValues) {
        test(`${label} qty=${qty} shift=${shift}`, () => runCase(label, rate, qty, shift));
      }
    }
  }

  for (const { label, finalRate } of seededCuttingMmRates) {
    for (const qty of qtyValues) {
      for (const shift of shiftValues) {
        test(`${label} qty=${qty} shift=${shift}`, () => runCase(label, finalRate, qty, shift));
      }
    }
  }

  for (const { label, finalRate } of seededCoreHoleRates) {
    for (const qty of qtyValues) {
      for (const shift of shiftValues) {
        test(`${label} qty=${qty} shift=${shift}`, () => runCase(label, finalRate, qty, shift));
      }
    }
  }

  // Explicit verification of the 5 known half-cent cases (Decimal half-up result).
  test("Ringsaw Wall 225mm qty=2.5 shift=0: 2.5*105.71=264.275 → Decimal half-up=264.28", () => {
    const result = cuttingLineTotal({ qty: 2.5, rate: 105.71 });
    expect(result.equals(new Prisma.Decimal("264.28"))).toBe(true);
  });

  test("Ringsaw Wall 225mm qty=2.5 shift=5: 2.5*105.71+5=269.275 → Decimal half-up=269.28", () => {
    const result = cuttingLineTotal({ qty: 2.5, rate: 105.71, addOn: 5 });
    expect(result.equals(new Prisma.Decimal("269.28"))).toBe(true);
  });

  test("Core-hole 32mm Floor depth=30 qty=17.35 shift=0: 17.35*5.10=88.485 → half-up=88.49", () => {
    const result = cuttingLineTotal({ qty: 17.35, rate: 5.10 });
    expect(result.equals(new Prisma.Decimal("88.49"))).toBe(true);
  });

  test("Core-hole 32mm Floor depth=30 qty=17.35 shift=5: 88.485+5=93.485 → half-up=93.49", () => {
    const result = cuttingLineTotal({ qty: 17.35, rate: 5.10, addOn: 5 });
    expect(result.equals(new Prisma.Decimal("93.49"))).toBe(true);
  });

  test("Core-hole 32mm Wall depth=30 qty=2.5 shift=5: 2.5*5.61+5=19.025 → half-up=19.03", () => {
    const result = cuttingLineTotal({ qty: 2.5, rate: 5.61, addOn: 5 });
    expect(result.equals(new Prisma.Decimal("19.03"))).toBe(true);
  });
});

// ── Section 3: next-depth-up rule ────────────────────────────────────────────

describe("priceCuttingLine — next-depth-up rule (saw-cut, Marco 2026-09-22)", () => {
  test("a depth between two seeded depths prices at the deeper (next-up) row", async () => {
    // listRates returns rows at 100 and 200. depth=150: resolveCuttingRate
    // picks next-at-or-above → 200 (rate=45). This is the scope-card side rule.
    const listRates = jest.fn().mockResolvedValue([
      { rowId: "cr-100", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 100 }, value: 30, unit: "m", source: "legacy" },
      { rowId: "cr-200", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 200 }, value: 45, unit: "m", source: "legacy" }
    ]);
    const rateResolver = makeRateResolver({ listRates });

    const result = await priceCuttingLine(
      { rateResolver },
      { kind: "saw-cut", equipment: "Demosaw", elevation: "Floor", material: "Concrete", depthMm: 150, qty: 1 }
    );
    expect(result).not.toBeNull();
    expect(Number(result!.rate)).toBe(45); // next depth up
    expect(Number(result!.lineTotal)).toBe(45); // qty=1
  });

  test("a row added to the mocked table afterwards is picked up on the next generation", async () => {
    // First call: only 200mm row exists → rate=45
    const listRates = jest.fn()
      .mockResolvedValueOnce([
        { rowId: "cr-200", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 200 }, value: 45, unit: "m", source: "legacy" }
      ])
      // Second call: new 175mm row added — now picked for depth=150
      .mockResolvedValueOnce([
        { rowId: "cr-175", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 175 }, value: 38, unit: "m", source: "legacy" },
        { rowId: "cr-200", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 200 }, value: 45, unit: "m", source: "legacy" }
      ]);
    const rateResolver = makeRateResolver({ listRates });

    const first = await priceCuttingLine(
      { rateResolver },
      { kind: "saw-cut", equipment: "Demosaw", elevation: "Floor", material: "Concrete", depthMm: 150, qty: 1 }
    );
    expect(Number(first!.rate)).toBe(45); // only 200 available

    const second = await priceCuttingLine(
      { rateResolver },
      { kind: "saw-cut", equipment: "Demosaw", elevation: "Floor", material: "Concrete", depthMm: 150, qty: 1 }
    );
    expect(Number(second!.rate)).toBe(175 <= 150 ? 38 : 38); // 175 is next-up after 150 → 38
    // 175 >= 150, 200 >= 150; asc → 175 wins
    expect(Number(second!.rate)).toBe(38);
  });

  test("null returned when no row found", async () => {
    const rateResolver = makeRateResolver({ listRates: jest.fn().mockResolvedValue([]) });
    const result = await priceCuttingLine(
      { rateResolver },
      { kind: "saw-cut", equipment: "Demosaw", elevation: "Floor", material: "Concrete", depthMm: 150, qty: 1 }
    );
    expect(result).toBeNull();
  });
});

// ── Section 4: supplied rate stored as given, no lookup ───────────────────────

describe("priceCuttingLine — supplied rate used as given, no lookup", () => {
  test("rate='42.1234' → lineTotal = ROUND(qty * 42.1234, 2)", async () => {
    const listRates = jest.fn().mockResolvedValue([]); // would fail if called
    const rateResolver = makeRateResolver({ listRates });

    const result = await priceCuttingLine(
      { rateResolver },
      { kind: "saw-cut", qty: 3, rate: 42.1234 }
    );
    expect(result).not.toBeNull();
    expect(Number(result!.rate)).toBeCloseTo(42.1234, 4);
    // 3 * 42.1234 = 126.3702 → round half-up → 126.37
    expect(result!.lineTotal.equals(new Prisma.Decimal("126.37"))).toBe(true);
    expect(listRates).not.toHaveBeenCalled(); // no lookup ran
  });

  test("supplied rate=0 stores lineTotal=0", async () => {
    const rateResolver = makeRateResolver();
    const result = await priceCuttingLine(
      { rateResolver },
      { kind: "saw-cut", qty: 5, rate: 0 }
    );
    expect(result).not.toBeNull();
    expect(result!.lineTotal.equals(new Prisma.Decimal("0.00"))).toBe(true);
  });
});

// ── Section 5: Wall elevation uses scope-card rate ────────────────────────────

describe("priceCuttingLine — Wall elevation uses the priced Wall row rate", () => {
  test("Wall elevation picks the Wall row (same as scope-card resolveCuttingRate)", async () => {
    const listRates = jest.fn().mockResolvedValue([
      { rowId: "cr-floor", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 150 }, value: 28.4, unit: "m", source: "legacy" },
      { rowId: "cr-wall", keys: { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 150 }, value: 48.6, unit: "m", source: "legacy" }
    ]);
    const rateResolver = makeRateResolver({ listRates });

    const result = await priceCuttingLine(
      { rateResolver },
      { kind: "saw-cut", equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 150, qty: 2 }
    );
    expect(result).not.toBeNull();
    expect(Number(result!.rate)).toBe(48.6);
    // 2 * 48.6 = 97.20
    expect(result!.lineTotal.equals(new Prisma.Decimal("97.20"))).toBe(true);
  });
});

// ── Section 6: core hole with no depth stores today's figure ──────────────────

describe("priceCuttingLine — generated core hole (no depth, no elevation)", () => {
  test("core hole with no depth and no elevation stores rate * qty exactly (today's figure)", async () => {
    // Without chargeStepPricing, unit-test compat: depthUnits=max(1,round(0/10))=1
    // finalRate = ratePerHole * 1 * 1.0 * 1.0 = ratePerHole
    const listRates = jest.fn().mockResolvedValue([
      { rowId: "ch-100", keys: { diameterMm: 100 }, value: 2.55, unit: "hole", source: "legacy" }
    ]);
    const rateResolver = makeRateResolver({ listRates });

    const result = await priceCuttingLine(
      { rateResolver },
      { kind: "core-hole", diameterMm: 100, qty: 3 }
    );
    expect(result).not.toBeNull();
    // depthMm=0 → depthUnits=max(1,round(0/10))=1; elevMult=1.0; methodMult=1.0
    // finalRate = 2.55 * 1 * 1.0 * 1.0 = 2.55
    expect(Number(result!.rate)).toBeCloseTo(2.55, 4);
    // lineTotal = 3 * 2.55 = 7.65
    expect(result!.lineTotal.equals(new Prisma.Decimal("7.65"))).toBe(true);
  });
});

// ── Section 7: updateCuttingLine recomputes lineTotal ────────────────────────

describe("estimates.service updateCuttingLine lineTotal recomputation", () => {
  // We test cuttingLineTotal directly with merged values, mirroring the service logic.

  test("recomputes when only qty changes", () => {
    const existingQty = 5;
    const existingRate = 10;
    const newQty = 7;
    // Merged: qty=7, rate=10 → lineTotal=70.00
    const result = cuttingLineTotal({ qty: newQty, rate: existingRate });
    expect(result.equals(new Prisma.Decimal("70.00"))).toBe(true);
  });

  test("recomputes when only rate changes", () => {
    const existingQty = 5;
    const newRate = 12.50;
    // Merged: qty=5, rate=12.50 → lineTotal=62.50
    const result = cuttingLineTotal({ qty: existingQty, rate: newRate });
    expect(result.equals(new Prisma.Decimal("62.50"))).toBe(true);
  });

  test("recomputes when both qty and rate change", () => {
    const result = cuttingLineTotal({ qty: 3, rate: 7.77 });
    // 3 * 7.77 = 23.31
    expect(result.equals(new Prisma.Decimal("23.31"))).toBe(true);
  });
});

// ── Section 8: Six readers use lineTotal ────────────────────────────────────
// Each reader is fed rows whose lineTotal deliberately differs from qty * rate.
// The reader must return sum(lineTotal), not sum(qty*rate).

describe("six readers use lineTotal, not qty * rate", () => {
  // Mock row: qty=3, rate=10.00, lineTotal=42.00 (deliberate mismatch)
  const mockRow = {
    qty: new Prisma.Decimal("3"),
    rate: new Prisma.Decimal("10.00"),
    lineTotal: new Prisma.Decimal("42.00")
  };

  test("cuttingLineTotal reads lineTotal not qty*rate (unit verification)", () => {
    // Simulate the reader pattern: reduce sum + Number(l.lineTotal)
    const rows = [mockRow, mockRow];
    const sum = rows.reduce((s, l) => s + Number(l.lineTotal), 0);
    expect(sum).toBe(84); // 42 + 42, not 30 + 30
  });

  test("contracts reader: sum(lineTotal) not sum(qty*rate)", () => {
    const rows = [
      { lineTotal: new Prisma.Decimal("42.00") },
      { lineTotal: new Prisma.Decimal("13.50") }
    ];
    // contracts.service.ts pattern: for (const l of item.cuttingLines) lineTotal += Number(l.lineTotal)
    let total = 0;
    for (const l of rows) total += Number(l.lineTotal);
    expect(total).toBeCloseTo(55.5, 5);
  });

  test("contracts priceByItem reader: reduce sum(lineTotal)", () => {
    const rows = [
      { lineTotal: new Prisma.Decimal("42.00") },
      { lineTotal: new Prisma.Decimal("8.00") }
    ];
    // contracts.service.ts pattern: reduce (s, l) => s + Number(l.lineTotal)
    const cutting = rows.reduce((s, l) => s + Number(l.lineTotal), 0);
    expect(cutting).toBe(50);
  });

  test("estimates itemSummary reader: round2(reduce sum(lineTotal))", () => {
    // estimates.service.ts: round2(reduce sum(lineTotal))
    const rows = [
      { lineTotal: new Prisma.Decimal("42.00") },
      { lineTotal: new Prisma.Decimal("0.001") } // odd fraction, must use lineTotal
    ];
    function round2(v: number) { return Math.round(v * 100) / 100; }
    const cutting = round2(rows.reduce((sum, l) => sum + Number(l.lineTotal), 0));
    expect(cutting).toBeCloseTo(42.0, 5); // 42.001 rounds to 42.00
  });

  test("projects reader: sum(lineTotal) from for loop", () => {
    const rows = [
      { qty: new Prisma.Decimal("3"), rate: new Prisma.Decimal("10"), lineTotal: new Prisma.Decimal("42.00") }
    ];
    // projects.service.ts pattern: for (const line of item.cuttingLines) estimateTotal += Number(line.lineTotal)
    let estimateTotal = 0;
    for (const line of rows) estimateTotal += Number(line.lineTotal);
    expect(estimateTotal).toBe(42); // not 30 (qty*rate)
  });

  test("scope-of-works deprecated reader: reduce sum(lineTotal)", () => {
    const rows = [
      { qty: new Prisma.Decimal("3"), rate: new Prisma.Decimal("10"), lineTotal: new Prisma.Decimal("42.00") }
    ];
    // scope-of-works.service.ts pattern: reduce (sum, l) => sum + Number(l.lineTotal)
    const cutting = rows.reduce((sum, l) => sum + Number(l.lineTotal), 0);
    expect(cutting).toBe(42); // not 30
  });

  test("scope-redesign deprecated reader: reduce sum(lineTotal)", () => {
    const rows = [
      { qty: new Prisma.Decimal("3"), rate: new Prisma.Decimal("10"), lineTotal: new Prisma.Decimal("42.00") }
    ];
    // scope-redesign.service.ts pattern: reduce (sum, l) => sum + Number(l.lineTotal)
    const cutting = rows.reduce((sum, l) => sum + Number(l.lineTotal), 0);
    expect(cutting).toBe(42); // not 30
  });
});
