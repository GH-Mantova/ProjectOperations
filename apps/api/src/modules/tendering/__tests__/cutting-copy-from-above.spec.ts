// PR B4b — specs for the per-card "Copy from above" cutting aggregator.
// Mirrors the scope-waste sum-from-above spec pattern (B3). Mocks Prisma
// to avoid a real DB; verifies the transaction shape, field-mapping
// contract, replace semantics, and depth-overflow warnings.

import { NotFoundException } from "@nestjs/common";
import { ScopeRedesignService } from "../scope-redesign.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

type ScopeItem = {
  wbsCode: string;
  description: string | null;
  length: number | null;
  depth: number | null;
  material: string | null;
  materialType: string | null;
  cuttingIncluded: boolean;
};

function buildPrismaMock(opts: {
  tenderExists?: boolean;
  card?: { id: string; tenderId: string } | null;
  scopeItems?: ScopeItem[];
  deletedCount?: number;
} = {}) {
  const tenderFindUnique: AsyncMock = jest.fn(async () =>
    opts.tenderExists === false ? null : { id: "tender-1" }
  );
  const scopeCardFindFirst: AsyncMock = jest.fn(async () =>
    opts.card === undefined ? { id: "card-1", tenderId: "tender-1" } : opts.card
  );
  // findMany on scopeOfWorksItem must respect the cuttingIncluded
  // filter applied by the service — mock receives the where clause and
  // returns matching items so the spec exercises the same filtering
  // path as production.
  const scopeOfWorksItemFindMany: AsyncMock = jest.fn(async (args: unknown) => {
    const where = (args as { where?: Record<string, unknown> })?.where ?? {};
    const onlyCuttingIncluded = (where as { cuttingIncluded?: boolean }).cuttingIncluded === true;
    const all = opts.scopeItems ?? [];
    return onlyCuttingIncluded ? all.filter((i) => i.cuttingIncluded) : all;
  });
  const cuttingDeleteMany: AsyncMock = jest.fn(async () => ({ count: opts.deletedCount ?? 0 }));
  const cuttingCreate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return { id: `cut-${Math.random().toString(36).slice(2, 8)}`, ...data };
  });

  const tx = {
    cuttingSheetItem: {
      deleteMany: cuttingDeleteMany,
      create: cuttingCreate
    }
  };

  const $transaction: AsyncMock = jest.fn(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => Promise<unknown>)(tx);
    }
    return [];
  });

  const prisma = {
    tender: { findUnique: tenderFindUnique },
    scopeCard: { findFirst: scopeCardFindFirst },
    scopeOfWorksItem: { findMany: scopeOfWorksItemFindMany },
    cuttingSheetItem: { deleteMany: cuttingDeleteMany, create: cuttingCreate },
    $transaction
  };

  return {
    prisma,
    mocks: { scopeCardFindFirst, scopeOfWorksItemFindMany, cuttingDeleteMany, cuttingCreate, $transaction }
  };
}

describe("ScopeRedesignService.copyFromAbove (PR B4b)", () => {
  it("404s when the card is not found on this tender", async () => {
    const { prisma } = buildPrismaMock({ card: null });
    const svc = new ScopeRedesignService(prisma as never);
    await expect(svc.copyFromAbove("tender-1", "missing-card", "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("skips items where cuttingIncluded=false", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        {
          wbsCode: "DEM1.1",
          description: "concrete slab",
          length: 10,
          depth: 0.2,
          material: "concrete",
          materialType: null,
          cuttingIncluded: false // excluded
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma as never);
    const result = await svc.copyFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0, warnings: [] });
    expect(mocks.cuttingCreate).not.toHaveBeenCalled();
  });

  it("skips items missing length OR depth (both > 0 required)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        // length missing
        { wbsCode: "DEM1.1", description: "x", length: null, depth: 0.1, material: "concrete", materialType: null, cuttingIncluded: true },
        // depth missing
        { wbsCode: "DEM1.2", description: "y", length: 5, depth: null, material: "concrete", materialType: null, cuttingIncluded: true },
        // length 0
        { wbsCode: "DEM1.3", description: "z", length: 0, depth: 0.1, material: "concrete", materialType: null, cuttingIncluded: true },
        // depth 0
        { wbsCode: "DEM1.4", description: "w", length: 5, depth: 0, material: "concrete", materialType: null, cuttingIncluded: true }
      ]
    });
    const svc = new ScopeRedesignService(prisma as never);
    const result = await svc.copyFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0, warnings: [] });
    expect(mocks.cuttingCreate).not.toHaveBeenCalled();
  });

  it("converts scope depth (metres) × 1000 → cutting depthMm (Marco's locked answer #4)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        {
          wbsCode: "DEM1.1",
          description: "saw 50mm slab",
          length: 12,
          depth: 0.05, // 50mm
          material: "concrete",
          materialType: null,
          cuttingIncluded: true
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma as never);
    const result = await svc.copyFromAbove("tender-1", "card-1", "user-1");
    expect(result.created).toBe(1);
    const data = (mocks.cuttingCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.depthMm).toBe(50);
  });

  it("replace semantics: deletes ONLY autoCopied=true saw-cut rows on the card; manual + core-hole + other-rate survive", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        {
          wbsCode: "DEM1.1",
          description: "concrete",
          length: 10,
          depth: 0.1,
          material: "concrete",
          materialType: null,
          cuttingIncluded: true
        }
      ],
      deletedCount: 3
    });
    const svc = new ScopeRedesignService(prisma as never);
    const result = await svc.copyFromAbove("tender-1", "card-1", "user-1");
    expect(result.replaced).toBe(3);
    expect(result.created).toBe(1);

    // The deleteMany call must scope to: this card, saw-cut only,
    // autoCopied=true only. Manual saw-cut + all core-hole + all
    // other-rate rows are preserved.
    const deleteArgs = (mocks.cuttingDeleteMany.mock.calls[0]?.[0] ?? {}) as {
      where?: { tenderId?: string; cardId?: string; itemType?: string; autoCopied?: boolean };
    };
    expect(deleteArgs.where?.tenderId).toBe("tender-1");
    expect(deleteArgs.where?.cardId).toBe("card-1");
    expect(deleteArgs.where?.itemType).toBe("saw-cut");
    expect(deleteArgs.where?.autoCopied).toBe(true);
  });

  it("field-copy contract: wbsRef = scopeItem.wbsCode; description verbatim; quantityLm = length; equipment / elevation / method / shift all null; autoCopied=true; itemType=saw-cut", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        {
          wbsCode: "DEM2.5",
          description: "200mm concrete slab cut",
          length: 8.5,
          depth: 0.2,
          material: "Concrete",
          materialType: null,
          cuttingIncluded: true
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma as never);
    await svc.copyFromAbove("tender-1", "card-1", "user-1");
    const data = (mocks.cuttingCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;

    expect(data.wbsRef).toBe("DEM2.5");
    expect(data.description).toBe("200mm concrete slab cut");
    expect(data.itemType).toBe("saw-cut");
    expect(data.autoCopied).toBe(true);
    expect(data.cardId).toBe("card-1");
    expect(Number(data.quantityLm)).toBe(8.5);
    expect(data.depthMm).toBe(200);
    expect(data.material).toBe("Concrete");
    expect(data.equipment).toBeNull();
    expect(data.elevation).toBeNull();
    expect(data.method).toBeNull();
    expect(data.shift).toBeNull();
    expect(data.ratePerM).toBeNull();
    expect(data.lineTotal).toBeNull();
  });

  it("material inference: null when no candidate field has a recognisable token (amber border in UI)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        {
          wbsCode: "DEM1.1",
          description: "general site work",
          length: 5,
          depth: 0.1,
          material: null,
          materialType: null,
          cuttingIncluded: true
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma as never);
    await svc.copyFromAbove("tender-1", "card-1", "user-1");
    const data = (mocks.cuttingCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.material).toBeNull();
  });

  it("warns (does NOT block) when computed depthMm > 2000", async () => {
    const { prisma, mocks } = buildPrismaMock({
      scopeItems: [
        {
          wbsCode: "DEM1.1",
          description: "deep cut",
          length: 5,
          depth: 2.5, // 2500mm — over the 2000 threshold
          material: "concrete",
          materialType: null,
          cuttingIncluded: true
        }
      ]
    });
    const svc = new ScopeRedesignService(prisma as never);
    const result = await svc.copyFromAbove("tender-1", "card-1", "user-1");
    expect(result.created).toBe(1); // not blocked
    expect(result.warnings).toEqual(["DEM1.1: depth 2500mm — please verify"]);
    // Row was still created — just with a warning attached.
    expect(mocks.cuttingCreate).toHaveBeenCalledTimes(1);
  });

  it("returns { replaced: 0, created: 0, warnings: [] } when no qualifying items", async () => {
    const { prisma } = buildPrismaMock({ scopeItems: [] });
    const svc = new ScopeRedesignService(prisma as never);
    const result = await svc.copyFromAbove("tender-1", "card-1", "user-1");
    expect(result).toEqual({ replaced: 0, created: 0, warnings: [] });
  });
});
