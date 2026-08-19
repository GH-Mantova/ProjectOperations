// scope-waste-transport-snapshot.spec.ts
//
// Regression + behaviour tests for the transport-rate snapshot feature
// (SLICE 1, 2026-08-19). All Prisma calls are mocked; no DB required.
//
// Tests:
//   1. Engine prices from the snapshot when present, ignoring a differing live rate.
//   2. Engine falls back to the live rate when snapshot is NULL, and the returned
//      snapshot equals that live rate.
//   3. notes-only PATCH does NOT change lineTotal (regression test for the silent-reprice
//      bug — this test MUST fail against the pre-change service code where update()
//      unconditionally ran the engine and wrote lineTotal).
//   4. variance() sets hasVariance true on a >= $1.00/day transport move and
//      false at $0.50.
//
// How to confirm the regression test (3) proved the bug existed:
//   Against the old code: update() called computeCostEngine unconditionally and always
//   wrote data.lineTotal = toDecimal(effectiveLineTotal). A notes-only PATCH would
//   cause prisma.update to be called with a lineTotal argument (even if the engine
//   returned null and the legacy path returned null, effectiveLineTotal was null and
//   toDecimal(null) would be null — but when the engine DID fire it would re-price).
//   With the old code and an engine that can fire (transportRateId + sizing inputs
//   present), a notes-only PATCH would call prisma.update with lineTotal set to the
//   newly-computed value. The test below asserts lineTotal is absent from the update
//   call — which would FAIL against the old code because lineTotal was always written.

import { Prisma } from "@prisma/client";
import { ScopeWasteService } from "../scope-waste.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransportRate(rate: number) {
  return { id: "rate-1", rate: new Prisma.Decimal(rate) };
}

function makeOpsSettings(fuelPricePerLitre: number) {
  return { id: "singleton", fuelPricePerLitre: new Prisma.Decimal(fuelPricePerLitre) };
}

function makeExistingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    tenderId: "tender-1",
    cardId: "card-1",
    discipline: "DEM",
    description: "Transport waste",
    wbsRef: null,
    wasteGroup: "Concrete",
    wasteType: "Concrete",
    wasteFacility: "FACILITY_A",
    unit: "t",
    qty: new Prisma.Decimal("500"),
    m3: null,
    wasteLoads: 20,
    truckDays: new Prisma.Decimal("3"),
    ratePerTonne: new Prisma.Decimal("85"),
    ratePerLoad: null,
    lineTotal: new Prisma.Decimal("52100"),
    transportRateId: "rate-1",
    assetId: null,
    qtyTrucks: 2,
    loadsPerTruckPerDay: new Prisma.Decimal("3"),
    capacityPerLoad: new Prisma.Decimal("25"),
    capacityUnit: "t",
    dailyKm: null,
    transportCost: new Prisma.Decimal("48000"),
    fuelCost: new Prisma.Decimal("0"),
    disposalCost: new Prisma.Decimal("42500"),
    quotedDisposalRate: new Prisma.Decimal("85"),
    quotedFuelPricePerLitre: null,
    quotedTransportRatePerDay: new Prisma.Decimal("1200"),
    notes: null,
    sortOrder: 0,
    autoSummed: false,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function buildMocks(existingRow: ReturnType<typeof makeExistingRow>, transportRateRow?: ReturnType<typeof makeTransportRate>) {
  const findUnique = jest.fn().mockImplementation(async (args: { where: { id?: string } }) => {
    const id = args?.where?.id;
    if (id === "item-1") return existingRow;
    if (id === "rate-1" && transportRateRow) return transportRateRow;
    if (id === "rate-1" && !transportRateRow) return null;
    if (id === "singleton") return makeOpsSettings(1.85);
    return null;
  });
  const update = jest.fn().mockResolvedValue({ ...existingRow });

  const prisma = {
    scopeWasteItem: { findUnique, update },
    estimatePlantRate: { findUnique },
    operationsSettings: { findUnique },
    asset: { findUnique }
  };

  const rateResolver = {
    resolveRate: jest.fn().mockResolvedValue({ value: 85, unit: "t" })
  };

  const notifications = {
    create: jest.fn().mockResolvedValue({})
  };

  return { prisma, rateResolver, notifications, mocks: { findUnique, update } };
}

// ---------------------------------------------------------------------------
// Test 1: Engine uses snapshot when present, ignores differing live rate
// ---------------------------------------------------------------------------
describe("computeCostEngine — snapshot precedence", () => {
  it("prices from quotedTransportRatePerDay when present, ignores differing live rate", async () => {
    // The row has snapshot $1,200/day. The live rate is $1,400/day.
    // The engine must use $1,200 and NOT $1,400.
    const row = makeExistingRow({
      quotedTransportRatePerDay: new Prisma.Decimal("1200")
    });
    const liveRate = makeTransportRate(1400); // higher than snapshot
    const { prisma, rateResolver, notifications } = buildMocks(row, liveRate);

    const svc = new ScopeWasteService(prisma as never, rateResolver as never, notifications as never);

    // Trigger a reprice via a pricing-input PATCH (qty change).
    // The engine should use the existing snapshot ($1,200), not the live rate ($1,400).
    await svc.update("tender-1", "item-1", { qty: 500 });

    const updateCall = (prisma.scopeWasteItem.update as jest.Mock).mock.calls[0]?.[0];
    const data = (updateCall as { data: Record<string, unknown> })?.data;

    // lineTotal should be based on $1,200/day:
    // loads = ceil(500/25) = 20, durationDays = ceil(20/2/3) = ceil(3.33) = 4
    // transportCost = 1200 * 4 * 2 = 9600
    // disposalCost = 500 * 85 = 42500
    // lineTotal = 9600 + 42500 = 52100
    const lineTotalNum = data?.lineTotal != null ? Number(data.lineTotal) : null;
    expect(lineTotalNum).toBeCloseTo(52100, 0);

    // Also check quotedTransportRatePerDay is preserved at 1200
    const snapshotNum = data?.quotedTransportRatePerDay != null ? Number(data.quotedTransportRatePerDay) : null;
    expect(snapshotNum).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Engine falls back to live rate when snapshot is NULL
// ---------------------------------------------------------------------------
describe("computeCostEngine — live rate fallback when snapshot is NULL", () => {
  it("fetches live rate when quotedTransportRatePerDay is NULL, and returned snapshot equals it", async () => {
    // Row has no snapshot yet (pre-migration row, or first price).
    const row = makeExistingRow({
      quotedTransportRatePerDay: null,
      lineTotal: null,
      transportCost: null
    });
    const liveRate = makeTransportRate(1200);
    const { prisma, rateResolver, notifications } = buildMocks(row, liveRate);

    const svc = new ScopeWasteService(prisma as never, rateResolver as never, notifications as never);

    await svc.update("tender-1", "item-1", { qty: 500 });

    const updateCall = (prisma.scopeWasteItem.update as jest.Mock).mock.calls[0]?.[0];
    const data = (updateCall as { data: Record<string, unknown> })?.data;

    // The snapshot should now be set to the live rate
    const snapshotNum = data?.quotedTransportRatePerDay != null ? Number(data.quotedTransportRatePerDay) : null;
    expect(snapshotNum).toBe(1200);

    // lineTotal should be priced at $1,200/day:
    // loads = 20, durationDays = 4, transportCost = 1200*4*2 = 9600
    // disposalCost = 500 * 85 = 42500, lineTotal = 52100
    const lineTotalNum = data?.lineTotal != null ? Number(data.lineTotal) : null;
    expect(lineTotalNum).toBeCloseTo(52100, 0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: notes-only PATCH does NOT change lineTotal (regression test)
//
// This test MUST fail against the pre-change code where update() always
// ran the engine and wrote data.lineTotal unconditionally. With the
// pre-change code: pricingTouched would be true for any key (no filtering
// existed), so even a { notes: "x" } DTO would write lineTotal.
//
// Against this PR's code: pricingTouched is false for { notes: ... }, so
// lineTotal is never written to the update payload.
// ---------------------------------------------------------------------------
describe("update() — notes-only PATCH does not reprice", () => {
  it("notes-only PATCH leaves lineTotal absent from the Prisma update payload", async () => {
    const originalLineTotal = new Prisma.Decimal("52100");
    const row = makeExistingRow({
      lineTotal: originalLineTotal,
      quotedTransportRatePerDay: new Prisma.Decimal("1200")
    });
    // Live rate has changed to $1,400 — if the engine fired, lineTotal would change
    const liveRate = makeTransportRate(1400);
    const { prisma, rateResolver, notifications } = buildMocks(row, liveRate);

    const svc = new ScopeWasteService(prisma as never, rateResolver as never, notifications as never);

    // Notes-only PATCH: only description field that is NOT in PRICING_INPUTS
    await svc.update("tender-1", "item-1", { notes: "updated notes" });

    const updateCall = (prisma.scopeWasteItem.update as jest.Mock).mock.calls[0]?.[0];
    const data = (updateCall as { data: Record<string, unknown> })?.data;

    // lineTotal must NOT be present in the update payload
    expect(Object.prototype.hasOwnProperty.call(data, "lineTotal")).toBe(false);

    // transportCost, fuelCost, disposalCost, snapshots must NOT be present
    expect(Object.prototype.hasOwnProperty.call(data, "transportCost")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(data, "fuelCost")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(data, "disposalCost")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(data, "quotedDisposalRate")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(data, "quotedTransportRatePerDay")).toBe(false);

    // notes must be present and correct
    expect(data?.notes).toBe("updated notes");

    // The live rate lookup must NOT have been called (engine did not fire)
    // We can verify by checking that estimatePlantRate.findUnique was called
    // at most once (for the row itself — the findUnique for the item id).
    // Actually, estimatePlantRate.findUnique shares the same mock as scopeWasteItem.findUnique
    // in our mock setup. Let us just confirm prisma.scopeWasteItem.update was called
    // with notes but without lineTotal.
    expect((prisma.scopeWasteItem.update as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it("description-only PATCH leaves lineTotal absent from the Prisma update payload", async () => {
    const row = makeExistingRow({ lineTotal: new Prisma.Decimal("52100") });
    const liveRate = makeTransportRate(1400);
    const { prisma, rateResolver, notifications } = buildMocks(row, liveRate);

    const svc = new ScopeWasteService(prisma as never, rateResolver as never, notifications as never);

    await svc.update("tender-1", "item-1", { description: "New description" });

    const updateCall = (prisma.scopeWasteItem.update as jest.Mock).mock.calls[0]?.[0];
    const data = (updateCall as { data: Record<string, unknown> })?.data;

    expect(Object.prototype.hasOwnProperty.call(data, "lineTotal")).toBe(false);
    expect(data?.description).toBe("New description");
  });
});

// ---------------------------------------------------------------------------
// Test 4: variance() transport threshold
// ---------------------------------------------------------------------------
describe("variance() — transport threshold", () => {
  it("sets hasVariance true when transport delta >= $1.00/day", async () => {
    // Snapshot: $1,200/day. Live: $1,201/day. Delta = $1.00 >= threshold.
    const row = makeExistingRow({
      quotedTransportRatePerDay: new Prisma.Decimal("1200"),
      quotedDisposalRate: new Prisma.Decimal("85"),
      quotedFuelPricePerLitre: null
    });

    // Build separate mocks for variance — the scopeWasteItem.findUnique returns the row,
    // the estimatePlantRate.findUnique returns the live (changed) rate.
    const scopeWasteFindUnique = jest.fn().mockResolvedValue(row);
    const plantRateFindUnique = jest.fn().mockResolvedValue(makeTransportRate(1201));
    const opsFindUnique = jest.fn().mockResolvedValue(makeOpsSettings(1.85));

    const prisma = {
      scopeWasteItem: { findUnique: scopeWasteFindUnique },
      estimatePlantRate: { findUnique: plantRateFindUnique },
      operationsSettings: { findUnique: opsFindUnique }
    };
    const rateResolver = { resolveRate: jest.fn().mockResolvedValue({ value: 85, unit: "t" }) };
    const notifications = { create: jest.fn() };

    const svc = new ScopeWasteService(prisma as never, rateResolver as never, notifications as never);
    const result = await svc.variance("tender-1", "item-1");

    expect(result.transportDelta).toBeCloseTo(1.0, 2);
    expect(result.hasVariance).toBe(true);
    expect(result.quotedTransportRatePerDay).toBe(1200);
    expect(result.currentTransportRatePerDay).toBe(1201);
  });

  it("sets hasVariance false when transport delta is $0.50/day (below $1.00 threshold)", async () => {
    // Snapshot: $1,200/day. Live: $1,200.50/day. Delta = $0.50 < $1.00 threshold.
    const row = makeExistingRow({
      quotedTransportRatePerDay: new Prisma.Decimal("1200"),
      quotedDisposalRate: new Prisma.Decimal("85"),
      quotedFuelPricePerLitre: null
    });

    const scopeWasteFindUnique = jest.fn().mockResolvedValue(row);
    const plantRateFindUnique = jest.fn().mockResolvedValue(makeTransportRate(1200.5));
    const opsFindUnique = jest.fn().mockResolvedValue(makeOpsSettings(1.85));

    const prisma = {
      scopeWasteItem: { findUnique: scopeWasteFindUnique },
      estimatePlantRate: { findUnique: plantRateFindUnique },
      operationsSettings: { findUnique: opsFindUnique }
    };
    const rateResolver = { resolveRate: jest.fn().mockResolvedValue({ value: 85, unit: "t" }) };
    const notifications = { create: jest.fn() };

    const svc = new ScopeWasteService(prisma as never, rateResolver as never, notifications as never);
    const result = await svc.variance("tender-1", "item-1");

    expect(result.transportDelta).toBeCloseTo(0.5, 2);
    expect(result.hasVariance).toBe(false);
  });

  it("sets hasVariance true when BOTH transport and disposal have variance", async () => {
    const row = makeExistingRow({
      quotedTransportRatePerDay: new Prisma.Decimal("1200"),
      quotedDisposalRate: new Prisma.Decimal("85"),
      quotedFuelPricePerLitre: null
    });

    const scopeWasteFindUnique = jest.fn().mockResolvedValue(row);
    const plantRateFindUnique = jest.fn().mockResolvedValue(makeTransportRate(1201));
    const opsFindUnique = jest.fn().mockResolvedValue(makeOpsSettings(1.85));

    const prisma = {
      scopeWasteItem: { findUnique: scopeWasteFindUnique },
      estimatePlantRate: { findUnique: plantRateFindUnique },
      operationsSettings: { findUnique: opsFindUnique }
    };
    // Disposal rate moved from 85 to 86 (+$1.00 >= $0.50 threshold)
    const rateResolver = { resolveRate: jest.fn().mockResolvedValue({ value: 86, unit: "t" }) };
    const notifications = { create: jest.fn() };

    const svc = new ScopeWasteService(prisma as never, rateResolver as never, notifications as never);
    const result = await svc.variance("tender-1", "item-1");

    expect(result.hasVariance).toBe(true);
    expect(result.disposalDelta).toBeCloseTo(1.0, 2);
    expect(result.transportDelta).toBeCloseTo(1.0, 2);
  });

  it("returns null transportDelta when row has no quotedTransportRatePerDay (pre-snapshot row)", async () => {
    const row = makeExistingRow({
      quotedTransportRatePerDay: null,
      quotedDisposalRate: new Prisma.Decimal("85"),
      quotedFuelPricePerLitre: null
    });

    const scopeWasteFindUnique = jest.fn().mockResolvedValue(row);
    const plantRateFindUnique = jest.fn().mockResolvedValue(makeTransportRate(1400));
    const opsFindUnique = jest.fn().mockResolvedValue(makeOpsSettings(1.85));

    const prisma = {
      scopeWasteItem: { findUnique: scopeWasteFindUnique },
      estimatePlantRate: { findUnique: plantRateFindUnique },
      operationsSettings: { findUnique: opsFindUnique }
    };
    const rateResolver = { resolveRate: jest.fn().mockResolvedValue({ value: 85, unit: "t" }) };
    const notifications = { create: jest.fn() };

    const svc = new ScopeWasteService(prisma as never, rateResolver as never, notifications as never);
    const result = await svc.variance("tender-1", "item-1");

    // No snapshot means we cannot compute a delta
    expect(result.transportDelta).toBeNull();
    expect(result.quotedTransportRatePerDay).toBeNull();
    // currentTransportRatePerDay is still populated (from live lookup)
    expect(result.currentTransportRatePerDay).toBe(1400);
    // hasVariance is false because disposal unchanged and transport delta is null
    expect(result.hasVariance).toBe(false);
  });
});
