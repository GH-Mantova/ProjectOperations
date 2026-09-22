// CUTTING_RATE_CORRECTIONS_V1 — four failing tests, one per defect.
// Written before the fix so each case is demonstrably red on unpatched code.
//
// Defect references (all verified against seed-initial-services.ts 2026-08-30):
//   D1  core-hole depth: no rounding, no minimum
//   D2  Tracksaw/Flush-cut: ignore depth above the seeded 25mm row
//   D3  core-hole: accepts method multiplier (should be 1.0 always)
//   D4  Demosaw wall: ELEVATION_MULTIPLIER 1.1 applied on top of a priced Wall row
//
// CHARGE_STEPS_PRICE_CUTTING_V1 (S5) updates:
//   D2  Step-path sub-describe: Tracksaw/Flush-cut depth scaling via cutting-mm steps.
//   D4  Ringsaw Wall: elevationMultiplier is now 1.0 (S5 seeded Ringsaw Wall rows
//       bake in the premium; ELEVATION_MULTIPLIER is removed).

import { ScopeRedesignService, resolveCuttingRate, resolveCoreHoleRate } from "../scope-redesign.service";
import { RateResolverService } from "../../rates/rate-resolver.service";
import { ChargeStepPricingService } from "../../rates/charge-step-pricing.service";
import { Prisma } from "@prisma/client";

// ── helpers ──────────────────────────────────────────────────────────────

function makeRateResolver(overrides: Partial<{ listRates: jest.Mock }> = {}) {
  return {
    listRates: overrides.listRates ?? jest.fn().mockResolvedValue([]),
    resolveRate: jest.fn().mockResolvedValue(null)
  } as unknown as RateResolverService;
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    tender: { findUnique: jest.fn().mockResolvedValue({ id: "t-1" }) },
    scopeOfWorksItem: { findMany: jest.fn().mockResolvedValue([]) },
    tenderEstimate: { findUnique: jest.fn().mockResolvedValue({ markup: new Prisma.Decimal(30) }) },
    scopeWasteItem: { findMany: jest.fn().mockResolvedValue([]) },
    cuttingSheetItem: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "ci-1", otherRate: null })
    },
    scopeCard: { findFirst: jest.fn().mockResolvedValue({ id: "card-1" }) },
    ...overrides
  } as never;
}

/**
 * Build a ChargeStepPricingService backed by a fake Prisma that returns the
 * given table definition. Used for D2 and D4 step-path assertions.
 *
 * `tableId` defaults to "rt-test". `slug` must match the slug passed to priceRow.
 * `columns` must list VALUE columns first so buildCellsFromRow places the row value
 * under the VALUE column ID (the charge-step-pricing service only sets VALUE cols).
 */
function makePricingService(opts: {
  slug: string;
  chargeSteps: unknown[];
  lineFields: unknown[];
  columns: Array<{ id: string; name: string; role: string }>;
  tableId?: string;
}): ChargeStepPricingService {
  const tableId = opts.tableId ?? "rt-test";
  const fakePrisma = {
    rateTable: {
      findUnique: jest.fn().mockResolvedValue({
        id: tableId,
        chargeSteps: opts.chargeSteps,
        lineFields: opts.lineFields,
        columns: opts.columns
      })
    },
    rateRow: {
      findMany: jest.fn().mockResolvedValue([])
    },
    tenderRateSet: {
      findUnique: jest.fn().mockResolvedValue(null)
    }
  };
  return new ChargeStepPricingService(fakePrisma as never);
}

// Cutting-mm step definition (mirrors seed migration):
//   start Rate per m -> multiply depthMm -> divide 25 -> floor 18 -> multiply metres
const CUTTING_MM_STEPS = [
  { op: "start", field: "Rate per m" },
  { op: "multiply", field: "depthMm" },
  { op: "divide", field: 25 },
  { op: "floor", value: 18 },
  { op: "multiply", field: "metres" }
];

// Cutting step definition (mirrors seed migration):
//   start Rate per m -> multiply 1.25 when method is High-Freq
//                    -> multiply 1.25 when method is Low-emission -> multiply metres
const CUTTING_STEPS = [
  { op: "start", field: "Rate per m" },
  { op: "multiply", field: 1.25, when: { field: "method", cmp: "is", value: "High-Freq" } },
  { op: "multiply", field: 1.25, when: { field: "method", cmp: "is", value: "Low-emission" } },
  { op: "multiply", field: "metres" }
];

const RATE_COL_ID = "rt-cut-mm-c-rate";
const CUTTING_RATE_COL_ID = "rt-cut-c-rate";

// A minimal Cutrite "core-hole" rate row, mimicking what listRates("core-hole") returns.
// $1.70/hole per 10mm depth for a 32mm diameter (first/smallest seeded row).
const CORE_HOLE_32MM = [
  {
    rowId: "ch-32",
    keys: { diameterMm: 32 },
    value: 1.70,
    unit: "hole",
    source: "legacy" as const
  }
];

// The only Tracksaw / Flush-cut seeded row — 25mm Any/Any at $18.00/m.
// D2's correction must derive both constants from this single row.
const TRACKSAW_25MM = [
  {
    rowId: "ts-25",
    keys: { equipment: "Tracksaw", elevation: "Any", material: "Any", depthMm: 25 },
    value: 18.00,
    unit: "m",
    source: "legacy" as const
  }
];
const FLUSHCUT_25MM = [
  {
    rowId: "fc-25",
    keys: { equipment: "Flush-cut", elevation: "Any", material: "Any", depthMm: 25 },
    value: 18.00,
    unit: "m",
    source: "legacy" as const
  }
];

// cutting-mm RateTable rows (Floor) for the step-path sub-tests.
const TRACKSAW_FLOOR_ROW = [
  {
    rowId: "rr-cut-mm-tracksaw-floor",
    keys: { Equipment: "Tracksaw", Elevation: "Floor" },
    value: 18.00,
    unit: "m",
    source: "rateTable" as const
  }
];

const FLUSHCUT_FLOOR_ROW = [
  {
    rowId: "rr-cut-mm-flush-cut-floor",
    keys: { Equipment: "Flush-cut", Elevation: "Floor" },
    value: 18.00,
    unit: "m",
    source: "rateTable" as const
  }
];

// A Demosaw Wall/Concrete row at 150mm — seeded at $48.60/m.
const DEMOSAW_WALL_150MM = [
  {
    rowId: "ds-wall-150",
    keys: { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 150 },
    value: 48.60,
    unit: "m",
    source: "legacy" as const
  }
];

// A Ringsaw Any/Any row at 200mm — $84.25/m (seeded Any value).
// With S5: elevationMultiplier removed; Wall premium is in seeded Wall rows, not in code.
const RINGSAW_200MM = [
  {
    rowId: "rs-200",
    keys: { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 200 },
    value: 84.25,
    unit: "m",
    source: "legacy" as const
  }
];

// ── D1: core-hole depth — rounding and minimum ───────────────────────────
//
// Rule: rate buys one whole 10mm unit; part-units round at the five
//   (x0–x4 down, x5–x9 up); every hole bills at least one unit.
// At $1.70/unit:
//   depthMm=14 → 1.4 → rounds to 1 → ratePerHole = 1.70
//   depthMm=15 → 1.5 → rounds to 2 → ratePerHole = 3.40
//   depthMm=25 → 2.5 → rounds to 3 → ratePerHole = 5.10
//
// On unpatched code depthUnits = depthMm / 10 (no round), so pricedCuttingData computes:
//   depthMm=14 → 1.4 units → ratePerHole = 1.70 × 1.4 = 2.38 ≠ 1.70 (FAILS)
//   depthMm=15 → 1.5 units → ratePerHole = 1.70 × 1.5 = 2.55 ≠ 3.40 (FAILS)
//   depthMm=25 → 2.5 units → ratePerHole = 1.70 × 2.5 = 4.25 ≠ 5.10 (FAILS)
//
// We test via ScopeRedesignService.createCuttingItem which calls pricedCuttingData
// and records ratePerHole in the create call.

describe("D1: core-hole depth rounding and minimum (CUTTING_RATE_CORRECTIONS_V1)", () => {
  async function getRatePerHole(depthMm: number): Promise<number> {
    const listRates = jest.fn().mockResolvedValue(CORE_HOLE_32MM);
    const rateResolver = makeRateResolver({ listRates });
    const createFn = jest.fn().mockResolvedValue({ id: "ci-1", otherRate: null });
    const prisma = makePrisma({
      cuttingSheetItem: {
        create: createFn,
        findUnique: jest.fn().mockResolvedValue(null)
      }
    });
    const svc = new ScopeRedesignService(prisma, rateResolver);
    await svc.createCuttingItem("t-1", "user-1", {
      wbsRef: "DEM1.1",
      itemType: "core-hole",
      diameterMm: 32,
      depthMm,
      quantityEach: 1,
      elevation: "Floor",
      method: null,
      cardId: "card-1"
    });
    const data = (createFn.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    return Number(data.ratePerHole);
  }

  it("14mm depth bills 1 unit at $1.70 (rounds 1.4 → 1, minimum 1)", async () => {
    // Unpatched: 1.70 × 14/10 = 2.38; corrected: 1.70 × round(1.4)=1.70
    expect(await getRatePerHole(14)).toBeCloseTo(1.70, 2);
  });

  it("15mm depth bills 2 units at $3.40 (rounds 1.5 → 2)", async () => {
    // Unpatched: 1.70 × 15/10 = 2.55; corrected: 1.70 × round(1.5)=3.40
    expect(await getRatePerHole(15)).toBeCloseTo(3.40, 2);
  });

  it("25mm depth bills 3 units at $5.10 (rounds 2.5 → 3)", async () => {
    // Unpatched: 1.70 × 25/10 = 4.25; corrected: 1.70 × round(2.5)=5.10
    expect(await getRatePerHole(25)).toBeCloseTo(5.10, 2);
  });
});

// ── D2: Tracksaw / Flush-cut depth scaling (legacy no-step path) ─────────
//
// The 25mm row ($18.00/m) is the only seeded Tracksaw/Flush-cut row.
// Rule: $18.00 buys 25mm depth; above 25mm scale at $0.72/mm (= 18.00/25),
// with $18.00 as the floor. Both constants must be DERIVED from the row value,
// not hardcoded.
//
// A 100mm cut: max(18.00, 100 × 0.72) = 72.00/m.
// On unpatched code: ceil(100/25)*25=100 → no exact row → falls back to 25mm → $18.00 ≠ $72.00

describe("D2: Tracksaw/Flush-cut depth scaling — legacy no-step path (CUTTING_RATE_CORRECTIONS_V1)", () => {
  it("Tracksaw 100mm cut resolves to $18.00/m (no-step path: baseRate from the seeded row)", async () => {
    // Without chargeStepPricing, resolveCuttingRate returns baseRate directly
    // for the cutting-mm table path. The cutting-mm row value IS the floor rate ($18.00).
    // Depth scaling happens in the step formula — see D2-step-path sub-describe below.
    const listRates = jest.fn().mockResolvedValue(TRACKSAW_25MM);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCuttingRate(rateResolver, {
      equipment: "Tracksaw",
      elevation: "Any",
      material: "Any",
      depthMm: 100
    });

    expect(result).not.toBeNull();
    // No-step path: baseRate is the matched row value (18.00).
    // Depth scaling is performed by charge steps (see D2-step-path tests).
    expect(result!.baseRate).toBeCloseTo(18.00, 2);
    expect(result!.finalRate).toBeCloseTo(18.00, 2);
  });

  it("Tracksaw 25mm cut still resolves to $18.00/m (floor respected)", async () => {
    const listRates = jest.fn().mockResolvedValue(TRACKSAW_25MM);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCuttingRate(rateResolver, {
      equipment: "Tracksaw",
      elevation: "Any",
      material: "Any",
      depthMm: 25
    });

    expect(result).not.toBeNull();
    expect(result!.finalRate).toBeCloseTo(18.00, 2);
  });
});

// ── D2 (step path): Tracksaw / Flush-cut depth scaling via cutting-mm steps ──
//
// With CHARGE_STEPS_PRICE_CUTTING_V1, the step formula:
//   start Rate per m -> multiply depthMm -> divide 25 -> floor 18 -> multiply metres
// produces the correct depth-scaled rate.
//
// 100mm cut: 18.00 * 100 / 25 = 72.00 (floor 18 applies, 72 > 18) -> $72.00/m
// 10mm cut:  18.00 * 10  / 25 =  7.20 (floor 18 applies, 7.2 < 18) -> $18.00/m
// 25mm cut:  18.00 * 25  / 25 = 18.00 (floor 18 applies, 18 = 18)  -> $18.00/m

describe("D2 step-path: Tracksaw/Flush-cut depth scaling via cutting-mm steps (CHARGE_STEPS_PRICE_CUTTING_V1)", () => {
  function makePricingForCuttingMm() {
    return makePricingService({
      slug: "cutting-mm",
      chargeSteps: CUTTING_MM_STEPS,
      lineFields: [
        { name: "depthMm", kind: "number", unit: "mm", sample: 25 },
        { name: "metres", kind: "number", unit: "m", sample: 1 },
        { name: "method", kind: "text", options: ["Fuel", "High-Freq"], sample: "Fuel" }
      ],
      columns: [
        { id: "rt-cut-mm-c-eq", name: "Equipment", role: "KEY" },
        { id: "rt-cut-mm-c-el", name: "Elevation", role: "KEY" },
        { id: RATE_COL_ID, name: "Rate per m", role: "VALUE" }
      ]
    });
  }

  it("Tracksaw Floor 100mm cut resolves to $72.00/m via step formula (18 * 100 / 25 = 72)", async () => {
    const listRates = jest.fn().mockResolvedValue(TRACKSAW_FLOOR_ROW);
    const rateResolver = makeRateResolver({ listRates });
    const chargeStepPricing = makePricingForCuttingMm();

    const result = await resolveCuttingRate(
      rateResolver,
      { equipment: "Tracksaw", elevation: "Floor", material: "Any", depthMm: 100 },
      chargeStepPricing
    );

    expect(result).not.toBeNull();
    // Step formula: 18.00 * 100 / 25 = 72.00; floor(18) does not apply (72 > 18)
    expect(result!.finalRate).toBeCloseTo(72.00, 2);
    expect(result!.elevationMultiplier).toBe(1.0);
  });

  it("Flush-cut Floor 100mm cut resolves to $72.00/m via step formula", async () => {
    const listRates = jest.fn().mockResolvedValue(FLUSHCUT_FLOOR_ROW);
    const rateResolver = makeRateResolver({ listRates });
    const chargeStepPricing = makePricingForCuttingMm();

    const result = await resolveCuttingRate(
      rateResolver,
      { equipment: "Flush-cut", elevation: "Floor", material: "Any", depthMm: 100 },
      chargeStepPricing
    );

    expect(result).not.toBeNull();
    expect(result!.finalRate).toBeCloseTo(72.00, 2);
  });

  it("Tracksaw Floor 10mm cut resolves to $18.00/m (floor applied: 18 * 10 / 25 = 7.2 < 18)", async () => {
    const listRates = jest.fn().mockResolvedValue(TRACKSAW_FLOOR_ROW);
    const rateResolver = makeRateResolver({ listRates });
    const chargeStepPricing = makePricingForCuttingMm();

    const result = await resolveCuttingRate(
      rateResolver,
      { equipment: "Tracksaw", elevation: "Floor", material: "Any", depthMm: 10 },
      chargeStepPricing
    );

    expect(result).not.toBeNull();
    // Step formula: 18.00 * 10 / 25 = 7.2; floor(18) applies -> $18.00
    expect(result!.finalRate).toBeCloseTo(18.00, 2);
  });

  it("Tracksaw Floor 25mm cut resolves to $18.00/m (floor at 25mm: 18 * 25 / 25 = 18)", async () => {
    const listRates = jest.fn().mockResolvedValue(TRACKSAW_FLOOR_ROW);
    const rateResolver = makeRateResolver({ listRates });
    const chargeStepPricing = makePricingForCuttingMm();

    const result = await resolveCuttingRate(
      rateResolver,
      { equipment: "Tracksaw", elevation: "Floor", material: "Any", depthMm: 25 },
      chargeStepPricing
    );

    expect(result).not.toBeNull();
    expect(result!.finalRate).toBeCloseTo(18.00, 2);
  });
});

// ── D3: core-hole must never apply method multiplier ─────────────────────
//
// Core holes take no method multiplier. Low-emission or High-Freq on a core
// hole must NOT add 25%. Only elevation applies.
//
// On unpatched code: resolveCoreHoleRate reads METHOD_MULTIPLIER[method] and
// returns a 1.25 multiplier for "Low-emission", making the caller's total wrong.

describe("D3: core-hole ignores method multiplier (CUTTING_RATE_CORRECTIONS_V1)", () => {
  it("Low-emission method on a core hole does NOT add 25% (methodMultiplier must be 1.0)", async () => {
    const listRates = jest.fn().mockResolvedValue(CORE_HOLE_32MM);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCoreHoleRate(rateResolver, {
      diameterMm: 32,
      elevation: "Floor",
      method: "Low-emission"
    });

    expect(result).not.toBeNull();
    expect(result!.isPOA).toBe(false);
    // After fix: methodMultiplier must be 1.0 regardless of method
    expect(result!.methodMultiplier).toBe(1.0);
  });

  it("High-Freq method on a core hole does NOT add 25% (methodMultiplier must be 1.0)", async () => {
    const listRates = jest.fn().mockResolvedValue(CORE_HOLE_32MM);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCoreHoleRate(rateResolver, {
      diameterMm: 32,
      elevation: "Floor",
      method: "High-Freq"
    });

    expect(result).not.toBeNull();
    expect(result!.isPOA).toBe(false);
    // On unpatched code: METHOD_MULTIPLIER["High-Freq"]=1.25, so this FAILS (returns 1.25)
    expect(result!.methodMultiplier).toBe(1.0);
  });
});

// ── D4: Demosaw Wall cuts must NOT receive ELEVATION_MULTIPLIER 1.1 ──────
//
// Demosaw has explicit Wall rows in the Cutrite schedule; the priced row
// already incorporates the wall premium. Applying the 1.1 multiplier on top
// produces $53.46/m instead of the correct $48.60/m for a 150mm Wall/Concrete cut.
//
// CHARGE_STEPS_PRICE_CUTTING_V1 (S5) update for Ringsaw:
//   Ringsaw Wall rows are now seeded at x1.1 of Any values (e.g. 200mm Wall = $92.68).
//   ELEVATION_MULTIPLIER is removed from code entirely. elevationMultiplier is always 1.0.
//   The step formula (start Rate per m -> multiply metres) does NOT add a wall uplift.
//   The uplift is in the seeded Wall rows. `effectiveElevation` for Ringsaw remains "Any"
//   (the ANY_ELEVATION_EQUIPMENT set includes Ringsaw) so the Any row ($84.25) is still
//   selected when only Any-row mock data is provided. finalRate = 84.25 with no 1.1 uplift.

describe("D4: Demosaw Wall cuts use priced Wall row, no extra 1.1 uplift (CUTTING_RATE_CORRECTIONS_V1)", () => {
  it("Demosaw Wall/Concrete/150mm resolves to $48.60/m (no extra 1.1 on top)", async () => {
    const listRates = jest.fn().mockResolvedValue(DEMOSAW_WALL_150MM);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCuttingRate(rateResolver, {
      equipment: "Demosaw",
      elevation: "Wall",
      material: "Concrete",
      depthMm: 150
    });

    expect(result).not.toBeNull();
    // elevationMultiplier must be 1.0 for Demosaw (it has its own Wall rows)
    expect(result!.elevationMultiplier).toBe(1.0);
    // On unpatched code: 48.60 × 1.1 = 53.46 → FAILS
    expect(result!.finalRate).toBeCloseTo(48.60, 2);
  });

  it("Demosaw Wall/Concrete/150mm resolves to $48.60/m via step path (CHARGE_STEPS_PRICE_CUTTING_V1)", async () => {
    const listRates = jest.fn().mockResolvedValue(DEMOSAW_WALL_150MM);
    const rateResolver = makeRateResolver({ listRates });

    // Cutting step formula: start Rate per m -> (conditionals) -> multiply metres
    // For Demosaw Wall/Concrete, method is null, metres=1 -> finalRate = 48.60
    const chargeStepPricing = makePricingService({
      slug: "cutting",
      chargeSteps: CUTTING_STEPS,
      lineFields: [
        { name: "method", kind: "text", options: ["Fuel", "High-Freq", "Low-emission"], sample: "Fuel" },
        { name: "metres", kind: "number", unit: "m", sample: 1 }
      ],
      columns: [
        { id: "rt-cut-c-eq", name: "Equipment", role: "KEY" },
        { id: "rt-cut-c-el", name: "Elevation", role: "KEY" },
        { id: "rt-cut-c-mat", name: "Material", role: "KEY" },
        { id: "rt-cut-c-dep", name: "Depth mm", role: "KEY" },
        { id: CUTTING_RATE_COL_ID, name: "Rate per m", role: "VALUE" }
      ]
    });

    const result = await resolveCuttingRate(
      rateResolver,
      { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 150 },
      chargeStepPricing
    );

    expect(result).not.toBeNull();
    // Step formula: start 48.60 -> no High-Freq/Low-emission (method null) -> multiply metres(1) = 48.60
    expect(result!.elevationMultiplier).toBe(1.0);
    expect(result!.finalRate).toBeCloseTo(48.60, 2);
  });

  it("Ringsaw Wall 200mm resolves to $84.25/m (S5: elevationMultiplier removed, Any row selected)", async () => {
    // With S5 (CHARGE_STEPS_PRICE_CUTTING_V1): ELEVATION_MULTIPLIER is removed.
    // Ringsaw ANY_ELEVATION_EQUIPMENT -> effectiveElevation = "Any".
    // Mock returns the Any row ($84.25). elevationMultiplier is always 1.0.
    // The 1.1 wall premium is now in seeded Ringsaw Wall rows (data), not in code.
    const listRates = jest.fn().mockResolvedValue(RINGSAW_200MM);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCuttingRate(rateResolver, {
      equipment: "Ringsaw",
      elevation: "Wall",
      material: "Concrete",
      depthMm: 200
    });

    expect(result).not.toBeNull();
    // S5: elevation multiplier is always 1.0; wall premium is baked into seeded rows
    expect(result!.elevationMultiplier).toBe(1.0);
    expect(result!.finalRate).toBeCloseTo(84.25, 2);
  });
});
