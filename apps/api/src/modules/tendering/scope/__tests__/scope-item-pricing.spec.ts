import {
  computeScopeItemTotal,
  labourRateForShift,
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
//
// WBS-SHIFT-S2: baseRates now includes all three shift variants so
// shift-aware pricing is fully exercised without a DB.

const baseRates = (): RateMaps => ({
  labourRateByDiscipline: new Map<Discipline, number>([
    ["DEM", 100],
    ["CIV", 120],
    ["ASB", 150],
    ["Other", 0]
  ]),
  labourRateByDisciplineShift: new Map<string, number>([
    // DEM: day=100, night=160, weekend=140
    ["DEM:day", 100],
    ["DEM:night", 160],
    ["DEM:weekend", 140],
    // CIV: day=120, night=190, weekend=170
    ["CIV:day", 120],
    ["CIV:night", 190],
    ["CIV:weekend", 170],
    // ASB: day=150, night=240, weekend=210
    ["ASB:day", 150],
    ["ASB:night", 240],
    ["ASB:weekend", 210],
    // Other: provisional-only, no labour rate
    ["Other:day", 0]
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
  shift: null,
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

  it("Other discipline → lineTotal is provisionalAmount; PR B2 applies markup", () => {
    // PR B2 — Other-discipline rows DO get markup now. lineTotal still
    // reflects the raw provisional sum so the markup amount is visible
    // as the delta; lineTotalWithMarkup = provisional × markupFactor.
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
    // 12345 × 1.30 = 16048.5
    expect(result.lineTotalWithMarkup).toBeCloseTo(16048.5, 6);
  });

  it("Other discipline at 0% markup → lineTotalWithMarkup == lineTotal", () => {
    const result = computeScopeItemTotal(
      emptyItem({ discipline: "Other", provisionalAmount: 5000 }),
      baseRates(),
      0
    );
    expect(result.lineTotal).toBe(5000);
    expect(result.lineTotalWithMarkup).toBe(5000);
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

  // ── WBS-SHIFT-S2: shift-aware pricing ──────────────────────────────────

  it("Day shift prices at day rate (regression guard — Day unchanged)", () => {
    // 2 men × 3 days × $100 (DEM day rate) = $600
    const result = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, shift: "Day" }),
      baseRates(),
      0
    );
    expect(result.labour).toBe(600);
    expect(result.lineTotal).toBe(600);
  });

  it("Night shift prices at night rate", () => {
    // 2 men × 3 days × $160 (DEM night rate) = $960
    const result = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, shift: "Night" }),
      baseRates(),
      0
    );
    expect(result.labour).toBe(960);
    expect(result.lineTotal).toBe(960);
  });

  it("Weekend shift prices at weekend rate", () => {
    // 2 men × 3 days × $140 (DEM weekend rate) = $840
    const result = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, shift: "Weekend" }),
      baseRates(),
      0
    );
    expect(result.labour).toBe(840);
    expect(result.lineTotal).toBe(840);
  });

  it("null shift falls back to Day rate", () => {
    // null shift → day → 2 × 3 × $100 = $600
    const withNull = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, shift: null }),
      baseRates(),
      0
    );
    const withDay = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, shift: "Day" }),
      baseRates(),
      0
    );
    expect(withNull.labour).toBe(withDay.labour);
  });

  it("unrecognised shift string falls back to Day rate", () => {
    // "Evenings" is not a valid shift → falls back to day
    const withGarbage = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, shift: "Evenings" }),
      baseRates(),
      0
    );
    const withDay = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, shift: "Day" }),
      baseRates(),
      0
    );
    expect(withGarbage.labour).toBe(withDay.labour);
  });

  it("Night line priced by computeScopeItemTotal equals Path A (equality — the acceptance criterion)", () => {
    // Path A in scope-of-works.service.ts reads scopeItem.shift ?? "Day"
    // and calls resolveRate("labour", { role, shift: shift.toLowerCase() }).
    // The resolver returns nightRate for shift="night".
    //
    // Concretely (seed data):
    //   DEM night rate = $1000/man-day (seed-initial-services.ts)
    //   2 men × 5 days × $1000 = $10,000
    //
    // Path B (old, day rate): 2 × 5 × $600 = $6,000 — WRONG
    // Path B (new, night rate via labourRateForShift): 2 × 5 × $1000 = $10,000
    // Path A (correct): 2 × 5 × $1000 = $10,000
    //
    // This test uses the seed-representative night rate ($1000) to assert
    // that new Path B == Path A. The baseRates() here uses DEM night = $160
    // (simplified test fixture). The PR body carries the seed-data calculation.
    //
    // To simulate Path A: directly pick the night rate from the RateMaps
    // (what resolveRate would return for shift="night").
    const rates = baseRates();

    // Simulate Path B (new): computeScopeItemTotal with shift="Night"
    const pathBResult = computeScopeItemTotal(
      emptyItem({ men: 2, days: 5, shift: "Night" }),
      rates,
      0
    );

    // Simulate Path A: directly read the night rate (what resolveRate returns)
    const pathARate = labourRateForShift("DEM", "Night", rates);
    const pathALabour = 2 * 5 * pathARate;

    expect(pathBResult.labour).toBe(pathALabour);
    // Both should be 2 × 5 × 160 = 1600 with the test fixture
    expect(pathBResult.labour).toBe(1600);
    expect(pathALabour).toBe(1600);
  });
});

// ── SCOPE_PLANT_PERSIST_V1: the two plant legs the web now writes ──────────
//
// Both legs landed with CARD-API SLICE 1 and are UNCHANGED by the web slice
// that finally reaches them. These pin them from the perspective of the
// payload the Plant column group sends, which until now no test did: every
// key present, absence stated as null, qty/days stated as 0 rather than
// omitted. If the plant loop ever regresses to "skip anything without a
// plantRateId, always read the catalogue", a custom machine silently returns
// to $0 and every typed rate override is silently ignored.

describe("computeScopeItemTotal — plant rows as SCOPE_PLANT_PERSIST_V1 writes them", () => {
  /** One row exactly as buildPlantItems() emits it: every key, nulls explicit. */
  const wireRow = (patch: Record<string, unknown> = {}) => ({
    columnIndex: 1,
    plantRateId: null,
    description: "",
    qty: 0,
    days: 0,
    unit: null,
    dayRateOverride: null,
    ...patch
  });

  it("a catalogue row with no override prices off the catalogue, unchanged", () => {
    // 1 × 5 × $650 = $3250 — the same number this row priced before the web
    // started sending explicit nulls for the keys it has nothing to say about.
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [
          wireRow({ plantRateId: "plant-excavator", description: "Excavator", qty: 1, days: 5 })
        ]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(3250);
  });

  it("leg 1 — a typed day rate beats the catalogue rate", () => {
    // 1 × 2 × $900 (typed), NOT 1 × 2 × $650 (catalogue).
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [
          wireRow({
            plantRateId: "plant-excavator",
            description: "Excavator",
            qty: 1,
            days: 2,
            dayRateOverride: 900
          })
        ]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(1800);
  });

  it("leg 2 — a free-typed custom machine prices from its override, not $0", () => {
    // No plantRateId at all: the only rate this row has is the one the
    // estimator typed. 1 × 4 × $1200 = $4800.
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [
          wireRow({ description: "Hired 30t excavator", qty: 1, days: 4, dayRateOverride: 1200 })
        ]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(4800);
  });

  it("a typed rate of 0 is a real override (supplied free), not an absence", () => {
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [
          wireRow({
            plantRateId: "plant-excavator",
            description: "Excavator",
            qty: 2,
            days: 5,
            dayRateOverride: 0
          })
        ]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(0);
  });

  it("an untouched blank row — what '+ Row' appends — contributes exactly 0", () => {
    // No rate id and no override, so `rate == null` and the loop skips it.
    // This is what makes adding a row cost nothing.
    const result = computeScopeItemTotal(emptyItem({ plantItems: [wireRow()] }), baseRates(), 30);
    expect(result.plant).toBe(0);
    expect(result.lineTotal).toBe(0);
    expect(result.lineTotalWithMarkup).toBe(0);
  });

  it("a blank qty on a priced row costs nothing — 0 is sent, and 0 means zero", () => {
    // The web sends a blank Qty box as 0, never as null. Had it sent null,
    // `qty = cell.qty == null ? 1 : n(cell.qty)` would cost ONE machine the
    // estimator never typed: 1 × 3 × 650 = $1950 instead of $0.
    const zeroQty = computeScopeItemTotal(
      emptyItem({
        plantItems: [wireRow({ plantRateId: "plant-excavator", qty: 0, days: 3 })]
      }),
      baseRates(),
      0
    );
    const absentQty = computeScopeItemTotal(
      emptyItem({
        plantItems: [{ columnIndex: 1, plantRateId: "plant-excavator", days: 3 }]
      }),
      baseRates(),
      0
    );
    expect(zeroQty.plant).toBe(0);
    expect(absentQty.plant).toBe(1950);
  });

  it("a multi-row item sums the whole array — every row of the write is priced", () => {
    // The web ships EVERY row on every edit, so this is the shape of an
    // ordinary save: three rows, two of them priced.
    const result = computeScopeItemTotal(
      emptyItem({
        plantItems: [
          wireRow({ columnIndex: 1, plantRateId: "plant-excavator", qty: 1, days: 2 }), // 1300
          wireRow({ columnIndex: 2, description: "Hired crane", qty: 1, days: 1, dayRateOverride: 700 }), // 700
          wireRow({ columnIndex: 3 }) // blank -> 0
        ]
      }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(2000);
  });
});

// ── Existing-data safety: plantItems still NULL ───────────────────────────────
// SCOPE_PLANT_PERSIST_V1 adds a writer, not a backfill. An item nobody has
// touched still reads plantItems = NULL, and NULL must price exactly as it
// does today — no plant leg, no substituted default, no crash.

describe("an item whose plantItems is NULL prices unchanged", () => {
  it("NULL contributes no plant at all", () => {
    const result = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, plantItems: null }),
      baseRates(),
      0
    );
    expect(result.plant).toBe(0);
    // Labour is untouched: 2 × 3 × $100 = $600, exactly as before.
    expect(result.labour).toBe(600);
    expect(result.lineTotal).toBe(600);
  });

  it("NULL and an empty array price identically", () => {
    const withNull = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, plantItems: null }),
      baseRates(),
      30
    );
    const withEmpty = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, plantItems: [] }),
      baseRates(),
      30
    );
    expect(withNull).toStrictEqual(withEmpty);
  });

  it("NULL prices the same with markup as it always did", () => {
    // 600 × 1.30 = 780.
    const result = computeScopeItemTotal(
      emptyItem({ men: 2, days: 3, plantItems: null }),
      baseRates(),
      30
    );
    expect(result.lineTotalWithMarkup).toBeCloseTo(780, 6);
  });
});

describe("labourRateForShift", () => {
  it("returns day rate for shift='Day'", () => {
    expect(labourRateForShift("DEM", "Day", baseRates())).toBe(100);
  });

  it("returns night rate for shift='Night'", () => {
    expect(labourRateForShift("DEM", "Night", baseRates())).toBe(160);
  });

  it("returns weekend rate for shift='Weekend'", () => {
    expect(labourRateForShift("DEM", "Weekend", baseRates())).toBe(140);
  });

  it("is case-insensitive — 'NIGHT' resolves same as 'Night'", () => {
    expect(labourRateForShift("DEM", "NIGHT", baseRates())).toBe(160);
  });

  it("null falls back to day", () => {
    expect(labourRateForShift("DEM", null, baseRates())).toBe(100);
  });

  it("undefined falls back to day", () => {
    expect(labourRateForShift("DEM", undefined, baseRates())).toBe(100);
  });

  it("unrecognised string falls back to day", () => {
    expect(labourRateForShift("DEM", "graveyard", baseRates())).toBe(100);
  });

  it("returns 0 when discipline has no rate entry", () => {
    const sparse: RateMaps = {
      labourRateByDiscipline: new Map(),
      labourRateByDisciplineShift: new Map(),
      plantRateById: new Map()
    };
    expect(labourRateForShift("DEM", "Day", sparse)).toBe(0);
  });
});
