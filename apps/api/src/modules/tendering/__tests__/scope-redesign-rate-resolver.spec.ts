// rates-consumers SLICE 2 — specs for ScopeRedesignService paths that
// now call RateResolverService instead of Prisma rate tables directly.
//
// Coverage:
//   - listRates("other-rates") — pricedCuttingData "other-rate" type
//   - listRates("cutting") range logic — resolveCuttingRate via pricedCuttingData
//   - listRates("core-hole") range logic — resolveCoreHoleRate via pricedCuttingData
//   - listRates("labour") + listRates("plant") — summary() pick-lists
//   - Tolerated-miss for "other-rate" when rowId not found → null lineTotal

import { ScopeRedesignService, resolveCuttingRate, resolveCoreHoleRate } from "../scope-redesign.service";
import { RateResolverService } from "../../rates/rate-resolver.service";
import { Prisma } from "@prisma/client";

// ── Minimal stubs ─────────────────────────────────────────────────────

function makeRateResolver(overrides: Partial<{
  listRates: jest.Mock;
  resolveRate: jest.Mock;
}> = {}) {
  return {
    listRates: overrides.listRates ?? jest.fn().mockResolvedValue([]),
    resolveRate: overrides.resolveRate ?? jest.fn().mockResolvedValue(null)
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
      create: jest.fn().mockResolvedValue({ id: "ci-1" })
    },
    scopeCard: { findFirst: jest.fn().mockResolvedValue({ id: "card-1" }) },
    ...overrides
  } as never;
}

// ── resolveCuttingRate standalone function ────────────────────────────

describe("resolveCuttingRate (SLICE 2 — uses RateResolverService)", () => {
  it("calls listRates('cutting') and picks the shallowest-at-or-above row for standard equipment", async () => {
    const cuttingRates = [
      { rowId: "cr-100", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 100 }, value: 30, unit: "m", source: "legacy" },
      { rowId: "cr-200", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 200 }, value: 45, unit: "m", source: "legacy" }
    ];
    const listRates = jest.fn().mockResolvedValue(cuttingRates);
    const rateResolver = makeRateResolver({ listRates });

    // depthMm=150: gte candidates are [200]; asc → first is 200
    const result = await resolveCuttingRate(rateResolver, {
      equipment: "Demosaw",
      elevation: "Floor",
      material: "Concrete",
      depthMm: 150
    });
    expect(listRates).toHaveBeenCalledWith("cutting", undefined);
    expect(result).not.toBeNull();
    expect(result!.baseRate).toBe(45);
    expect(result!.finalRate).toBe(45); // Floor multiplier = 1.0, no method
  });

  it("falls back to the deepest available row when depthMm exceeds all seeded rows", async () => {
    const cuttingRates = [
      { rowId: "cr-150", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 150 }, value: 50, unit: "m", source: "legacy" }
    ];
    const listRates = jest.fn().mockResolvedValue(cuttingRates);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCuttingRate(rateResolver, {
      equipment: "Demosaw",
      elevation: "Floor",
      material: "Concrete",
      depthMm: 300 // exceeds all rows
    });
    expect(result).not.toBeNull();
    expect(result!.baseRate).toBe(50); // max available fallback
  });

  it("Demosaw Wall does NOT apply elevation multiplier — priced Wall rows encode the premium (CUTTING_RATE_CORRECTIONS_V1 D4)", async () => {
    const cuttingRates = [
      {
        rowId: "cr-wall-100",
        keys: { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 100 },
        value: 40,
        unit: "m",
        source: "legacy"
      }
    ];
    const listRates = jest.fn().mockResolvedValue(cuttingRates);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCuttingRate(rateResolver, {
      equipment: "Demosaw",
      elevation: "Wall",
      material: "Concrete",
      depthMm: 100
    });
    expect(result).not.toBeNull();
    // D4 fix: Demosaw has explicit Wall rows — no uplift on top (was 1.1, now 1.0)
    expect(result!.elevationMultiplier).toBe(1.0);
    expect(result!.finalRate).toBeCloseTo(40, 5);
  });

  it("returns null when no matching cutting rows found", async () => {
    const listRates = jest.fn().mockResolvedValue([]);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCuttingRate(rateResolver, {
      equipment: "Demosaw",
      elevation: "Floor",
      material: "Concrete",
      depthMm: 100
    });
    expect(result).toBeNull();
  });
});

// ── resolveCoreHoleRate standalone function ───────────────────────────

describe("resolveCoreHoleRate (SLICE 2 — uses RateResolverService)", () => {
  it("calls listRates('core-hole') and picks next-at-or-above diameter", async () => {
    const coreHoleRates = [
      { rowId: "ch-50", keys: { diameterMm: 50 }, value: 60, unit: "hole", source: "legacy" },
      { rowId: "ch-100", keys: { diameterMm: 100 }, value: 90, unit: "hole", source: "legacy" }
    ];
    const listRates = jest.fn().mockResolvedValue(coreHoleRates);
    const rateResolver = makeRateResolver({ listRates });

    // diameterMm=75: gte candidates = [100]; asc → first is 100
    const result = await resolveCoreHoleRate(rateResolver, { diameterMm: 75 });
    expect(listRates).toHaveBeenCalledWith("core-hole", undefined);
    expect(result).not.toBeNull();
    expect(result!.isPOA).toBe(false);
    if (!result!.isPOA) {
      expect(result!.ratePerHole).toBe(90);
      expect(result!.diameterResolved).toBe(100);
    }
  });

  it("returns isPOA=true for diameters > 650mm", async () => {
    const listRates = jest.fn().mockResolvedValue([]);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCoreHoleRate(rateResolver, { diameterMm: 700 });
    expect(result).not.toBeNull();
    expect(result!.isPOA).toBe(true);
    expect(listRates).not.toHaveBeenCalled(); // POA short-circuits before listRates
  });

  it("returns null when no core-hole rate found", async () => {
    const listRates = jest.fn().mockResolvedValue([]);
    const rateResolver = makeRateResolver({ listRates });

    const result = await resolveCoreHoleRate(rateResolver, { diameterMm: 50 });
    expect(result).toBeNull();
  });
});

// ── ScopeRedesignService.pricedCuttingData — other-rate slug ─────────

describe("ScopeRedesignService.createCuttingItem — other-rate via listRates", () => {
  it("calls listRates('other-rates') and matches by rowId", async () => {
    const otherRates = [
      { rowId: "or-1", keys: { description: "Traffic Control" }, value: 250, unit: "each", source: "legacy" }
    ];
    const listRates = jest.fn().mockResolvedValue(otherRates);
    const rateResolver = makeRateResolver({ listRates });
    const cuttingCreate = jest.fn().mockResolvedValue({ id: "ci-1", otherRate: null });
    const prisma = makePrisma({
      cuttingSheetItem: {
        create: cuttingCreate,
        findUnique: jest.fn().mockResolvedValue(null)
      }
    });
    const svc = new ScopeRedesignService(prisma, rateResolver);

    await svc.createCuttingItem("t-1", "user-1", {
      wbsRef: "DEM1.1",
      itemType: "other-rate",
      otherRateId: "or-1",
      quantityEach: 2,
      cardId: "card-1"
    });

    expect(listRates).toHaveBeenCalledWith("other-rates", { tenderId: "t-1" });
    const data = (cuttingCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    // 250 rate × 2 qty = 500 lineTotal
    expect(Number(data.lineTotal)).toBe(500);
  });

  it("returns null lineTotal when otherRateId not found in listRates results (tolerated miss)", async () => {
    const listRates = jest.fn().mockResolvedValue([]); // no rates
    const rateResolver = makeRateResolver({ listRates });
    const cuttingCreate = jest.fn().mockResolvedValue({ id: "ci-1", otherRate: null });
    const prisma = makePrisma({
      cuttingSheetItem: { create: cuttingCreate, findUnique: jest.fn().mockResolvedValue(null) }
    });
    const svc = new ScopeRedesignService(prisma, rateResolver);

    await svc.createCuttingItem("t-1", "user-1", {
      wbsRef: "DEM1.1",
      itemType: "other-rate",
      otherRateId: "missing-id",
      quantityEach: 1,
      cardId: "card-1"
    });

    const data = (cuttingCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.lineTotal).toBeNull();
  });
});

// ── ScopeRedesignService.summary — labour + plant pick-lists ─────────

describe("ScopeRedesignService.summary — calls listRates for labour and plant", () => {
  it("calls listRates('labour') and listRates('plant') to build rate maps", async () => {
    const labourListed = [
      { rowId: "lr-1", keys: { role: "Demolition labourer", shift: "day" }, value: 400, unit: "day", source: "legacy" },
      { rowId: "lr-1", keys: { role: "Demolition labourer", shift: "night" }, value: 500, unit: "day", source: "legacy" }
    ];
    const plantListed = [
      { rowId: "pr-1", keys: { item: "Excavator 16T-25T (wet hire)" }, value: 1100, unit: "day", source: "legacy" }
    ];
    const listRates = jest.fn(async (slug: string) => {
      if (slug === "labour") return labourListed;
      if (slug === "plant") return plantListed;
      return [];
    });
    const rateResolver = makeRateResolver({ listRates });
    const prisma = makePrisma();
    const svc = new ScopeRedesignService(prisma, rateResolver);

    await svc.summary("t-1");

    expect(listRates).toHaveBeenCalledWith("labour", { tenderId: "t-1" });
    expect(listRates).toHaveBeenCalledWith("plant", { tenderId: "t-1" });
  });
});
