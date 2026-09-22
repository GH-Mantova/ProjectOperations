// rates-consumers SLICE 2 — specs for ScopeOfWorksService paths that
// now call RateResolverService instead of Prisma rate tables directly.
//
// Coverage:
//   - resolveRate("labour", {role, shift}) — createEstimateItemFromScope labour
//   - resolveRate("core-hole", {diameterMm}) — createEstimateItemFromScope core hole
//   - listRates("cutting") + in-memory range — createEstimateItemFromScope cutting
//   - listRates("waste") + in-memory match — createEstimateItemFromScope waste
//   - listRates("labour") + listRates("plant") — listItems pick-list
//   - Tolerated-miss path: resolveRate miss → rate stays 0 (NotFoundException swallowed)

import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ScopeOfWorksService } from "../scope-of-works.service";

// ── Minimal prisma stub ───────────────────────────────────────────────
function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    tender: { findUnique: jest.fn().mockResolvedValue({ id: "t-1" }) },
    tenderEstimate: {
      findUnique: jest.fn().mockResolvedValue({ id: "est-1", lockedAt: null, markup: new Prisma.Decimal(30) }),
      create: jest.fn().mockResolvedValue({ id: "est-1", lockedAt: null, markup: new Prisma.Decimal(30) })
    },
    estimateItem: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: "ei-1" })
    },
    estimateLabourLine: { create: jest.fn().mockResolvedValue({}) },
    estimatePlantLine: { create: jest.fn().mockResolvedValue({}) },
    estimateCuttingLine: { create: jest.fn().mockResolvedValue({}) },
    estimateWasteLine: { create: jest.fn().mockResolvedValue({}) },
    scopeOfWorksItem: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({})
    },
    ...overrides
  } as never;
}

// ── Minimal RateResolverService stub ─────────────────────────────────
function makeRateResolver(overrides: {
  resolveRate?: jest.Mock;
  listRates?: jest.Mock;
} = {}) {
  return {
    resolveRate: overrides.resolveRate ?? jest.fn().mockRejectedValue(new NotFoundException("not found")),
    listRates: overrides.listRates ?? jest.fn().mockResolvedValue([])
  } as never;
}

// ── Minimal confirmed scope item ──────────────────────────────────────
function makeConfirmedScopeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "si-1",
    tenderId: "t-1",
    status: "confirmed",
    description: "Test item",
    notes: null,
    men: new Prisma.Decimal(2),
    days: new Prisma.Decimal(3),
    shift: "Day",
    lm: null,
    cuttingEquipment: null,
    elevation: null,
    materialType: null,
    depthMm: null,
    coreHoleQty: null,
    coreHoleDiameterMm: null,
    wasteTonnes: null,
    wasteType: null,
    wasteFacility: null,
    wasteLoads: null,
    estimateItemId: null,
    card: { discipline: "DEM" },
    ...overrides
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("ScopeOfWorksService — rates via RateResolverService (SLICE 2)", () => {
  // ── resolveRate("labour") ─────────────────────────────────────────
  describe("createEstimateItemFromScope — labour slug", () => {
    it("calls resolveRate('labour') with role and lowercase shift", async () => {
      const resolveRate = jest.fn().mockResolvedValue({ value: 450, unit: "day", rowId: "lr-1", source: "legacy" });
      const rateResolver = makeRateResolver({ resolveRate });
      const prisma = makePrisma();
      const svc = new ScopeOfWorksService(prisma, rateResolver);

      const scopeItem = makeConfirmedScopeItem({ shift: "Night" });
      await svc.createEstimateItemFromScope(scopeItem as never, "t-1", "user-1");

      expect(resolveRate).toHaveBeenCalledWith("labour", { role: "Demolition labourer", shift: "night" }, { tenderId: "t-1" });
      // Rate value is used in labour line create
      const labourCreate = (prisma as never as { estimateLabourLine: { create: jest.Mock } }).estimateLabourLine.create;
      expect(labourCreate).toHaveBeenCalledTimes(1);
      const data = (labourCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(Number(data.rate)).toBe(450);
    });

    it("tolerates NotFoundException from resolveRate — dayRate falls to 0", async () => {
      const resolveRate = jest.fn().mockRejectedValue(new NotFoundException("no labour rate"));
      const rateResolver = makeRateResolver({ resolveRate });
      const prisma = makePrisma();
      const svc = new ScopeOfWorksService(prisma, rateResolver);

      const scopeItem = makeConfirmedScopeItem();
      await svc.createEstimateItemFromScope(scopeItem as never, "t-1", "user-1");

      const labourCreate = (prisma as never as { estimateLabourLine: { create: jest.Mock } }).estimateLabourLine.create;
      expect(labourCreate).toHaveBeenCalledTimes(1);
      const data = (labourCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(Number(data.rate)).toBe(0);
    });
  });

  // PLANT_DAYS_RETIRED_V1 (2026-09-05) — the "plant slug" describe block
  // lived here. Its two tests drove resolveRate("plant") through the
  // private helper addPlantLineIfSet, which existed only to turn the five
  // legacy plant-days columns (excavator_days, bobcat_days, ewp_days,
  // hook_truck_days, semi_tipper_days) into EstimatePlantLine rows.
  // Columns, helper and tests were all removed together; there is no
  // surviving resolveRate("plant") caller in this service to cover.
  // Full record in ../scope-of-works.service.ts.

  // ── listRates("core-hole") via priceCuttingLine ──────────────────
  // CUTTING_ONE_TOTAL_V1 (scopecards-s7): priceCuttingLine replaces the
  // resolveRate call. priceCuttingLine calls resolveCoreHoleRate which
  // uses listRates. lineTotal is stored with rate.
  describe("createEstimateItemFromScope — core-hole slug (priceCuttingLine)", () => {
    it("calls listRates('core-hole') and stores rate + lineTotal", async () => {
      // No chargeStepPricing: unit-test compat path.
      // diameterMm=100, depthMm=null → 0 → depthUnits=max(1,round(0/10))=1
      // finalRate = ratePerHole * 1 * 1.0 * 1.0 = 85
      // lineTotal = qty(3) * 85 = 255.00
      const listRates = jest.fn().mockResolvedValue([
        { rowId: "ch-100", keys: { diameterMm: 100 }, value: 85, unit: "hole", source: "legacy" }
      ]);
      const rateResolver = makeRateResolver({ listRates });
      const prisma = makePrisma();
      const svc = new ScopeOfWorksService(prisma, rateResolver);

      const scopeItem = makeConfirmedScopeItem({
        men: null,
        days: null,
        coreHoleQty: new Prisma.Decimal(3),
        coreHoleDiameterMm: 100
      });
      await svc.createEstimateItemFromScope(scopeItem as never, "t-1", "user-1");

      expect(listRates).toHaveBeenCalledWith("core-hole", { tenderId: "t-1" });
      const cuttingCreate = (prisma as never as { estimateCuttingLine: { create: jest.Mock } }).estimateCuttingLine.create;
      expect(cuttingCreate).toHaveBeenCalledTimes(1);
      const data = (cuttingCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.cuttingType).toBe("Core hole");
      expect(Number(data.rate)).toBeCloseTo(85, 4);
      // lineTotal stored: qty=3 * rate=85 = 255.00
      expect(Number(data.lineTotal)).toBe(255);
    });

    it("listRates miss — rate=0 and lineTotal=0 (today's miss path)", async () => {
      // No matching core-hole rate → priceCuttingLine returns null → rate=0, lineTotal=0
      const listRates = jest.fn().mockResolvedValue([]);
      const rateResolver = makeRateResolver({ listRates });
      const prisma = makePrisma();
      const svc = new ScopeOfWorksService(prisma, rateResolver);

      const scopeItem = makeConfirmedScopeItem({
        men: null,
        days: null,
        coreHoleQty: new Prisma.Decimal(1),
        coreHoleDiameterMm: 50
      });
      await svc.createEstimateItemFromScope(scopeItem as never, "t-1", "user-1");

      const cuttingCreate = (prisma as never as { estimateCuttingLine: { create: jest.Mock } }).estimateCuttingLine.create;
      expect(cuttingCreate).toHaveBeenCalledTimes(1);
      const data = (cuttingCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(Number(data.rate)).toBe(0);
      expect(Number(data.lineTotal)).toBe(0);
    });
  });

  // ── listRates("cutting") via priceCuttingLine ─────────────────────
  // CUTTING_ONE_TOTAL_V1 (scopecards-s7): private row-picker removed;
  // priceCuttingLine calls resolveCuttingRate which picks next-at-or-above
  // (Marco's 2026-09-22 ruling). lineTotal is stored with rate.
  describe("createEstimateItemFromScope — cutting slug (priceCuttingLine)", () => {
    it("calls listRates('cutting') and picks next-at-or-above depthMm (next-depth-up rule)", async () => {
      const cuttingListedRates = [
        { rowId: "cr-1", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 100 }, value: 30, unit: "m", source: "legacy" },
        { rowId: "cr-2", keys: { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 200 }, value: 45, unit: "m", source: "legacy" }
      ];
      const listRates = jest.fn().mockResolvedValue(cuttingListedRates);
      const rateResolver = makeRateResolver({ listRates });
      const prisma = makePrisma();
      const svc = new ScopeOfWorksService(prisma, rateResolver);

      const scopeItem = makeConfirmedScopeItem({
        men: null,
        days: null,
        lm: new Prisma.Decimal(5),
        cuttingEquipment: "Demosaw",
        elevation: "Floor",
        materialType: "Concrete",
        depthMm: 150 // between 100 and 200 — next-at-or-above is 200 (rate=45)
      });
      await svc.createEstimateItemFromScope(scopeItem as never, "t-1", "user-1");

      expect(listRates).toHaveBeenCalledWith("cutting", { tenderId: "t-1" });
      const cuttingCreate = (prisma as never as { estimateCuttingLine: { create: jest.Mock } }).estimateCuttingLine.create;
      expect(cuttingCreate).toHaveBeenCalledTimes(1);
      const data = (cuttingCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.cuttingType).toBe("Saw cut");
      // next-depth-up: cr-2 (depthMm 200 >= 150, asc → first) → rate=45
      expect(Number(data.rate)).toBe(45);
      // lineTotal stored: qty=5 * rate=45 = 225.00
      expect(Number(data.lineTotal)).toBe(225);
    });
  });

  // ── listRates("waste") ────────────────────────────────────────────
  describe("createEstimateItemFromScope — waste slug (listRates)", () => {
    it("calls listRates('waste') and matches by wasteType+facility", async () => {
      const wasteListedRates = [
        { rowId: "wr-1", keys: { wasteType: "Asbestos", facility: "RecycleRight" }, value: 500, unit: "tonne", source: "legacy" }
      ];
      const listRates = jest.fn().mockResolvedValue(wasteListedRates);
      const rateResolver = makeRateResolver({ listRates });
      const prisma = makePrisma();
      const svc = new ScopeOfWorksService(prisma, rateResolver);

      const scopeItem = makeConfirmedScopeItem({
        men: null,
        days: null,
        wasteTonnes: new Prisma.Decimal(2),
        wasteType: "Asbestos",
        wasteFacility: "RecycleRight"
      });
      await svc.createEstimateItemFromScope(scopeItem as never, "t-1", "user-1");

      expect(listRates).toHaveBeenCalledWith("waste", { tenderId: "t-1" });
      const wasteCreate = (prisma as never as { estimateWasteLine: { create: jest.Mock } }).estimateWasteLine.create;
      expect(wasteCreate).toHaveBeenCalledTimes(1);
      const data = (wasteCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.wasteType).toBe("Asbestos");
      expect(data.facility).toBe("RecycleRight");
      expect(Number(data.tonRate)).toBe(500);
    });

    it("falls back to wasteRate=0 when no matching waste row found (tolerated miss)", async () => {
      const listRates = jest.fn().mockResolvedValue([]);
      const rateResolver = makeRateResolver({ listRates });
      const prisma = makePrisma();
      const svc = new ScopeOfWorksService(prisma, rateResolver);

      const scopeItem = makeConfirmedScopeItem({
        men: null,
        days: null,
        wasteTonnes: new Prisma.Decimal(1),
        wasteType: "General",
        wasteFacility: ""
      });
      await svc.createEstimateItemFromScope(scopeItem as never, "t-1", "user-1");

      const wasteCreate = (prisma as never as { estimateWasteLine: { create: jest.Mock } }).estimateWasteLine.create;
      expect(wasteCreate).toHaveBeenCalledTimes(1);
      const data = (wasteCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(Number(data.tonRate)).toBe(0);
    });
  });

  // ── listRates("labour") + listRates("plant") in listItems ────────
  describe("listItems — calls listRates for labour and plant", () => {
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
      const prisma = makePrisma({
        scopeOfWorksItem: {
          findMany: jest.fn().mockResolvedValue([])
        },
        scopeCard: { findMany: jest.fn().mockResolvedValue([]) },
        tenderEstimate: {
          findUnique: jest.fn().mockResolvedValue({ markup: new Prisma.Decimal(30) })
        }
      });
      const svc = new ScopeOfWorksService(prisma, rateResolver);

      await svc.listItems("t-1");

      expect(listRates).toHaveBeenCalledWith("labour", { tenderId: "t-1" });
      expect(listRates).toHaveBeenCalledWith("plant", { tenderId: "t-1" });
    });
  });
});
