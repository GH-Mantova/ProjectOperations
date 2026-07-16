import { ConflictException, NotFoundException } from "@nestjs/common";
import { AssetsService } from "./assets.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal prisma stub — extend per test with jest.fn() overrides. */
function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    assetCategory: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "cat-1" }),
      update: jest.fn().mockResolvedValue({ id: "cat-1" }),
      findMany: jest.fn().mockResolvedValue([])
    },
    asset: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "asset-1" }),
      update: jest.fn().mockResolvedValue({ id: "asset-1" }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    assetCheckout: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "co-1", assetId: "asset-1" }),
      update: jest.fn().mockResolvedValue({ id: "co-1", checkedInAt: new Date() }),
      findMany: jest.fn().mockResolvedValue([])
    },
    documentLink: {
      findMany: jest.fn().mockResolvedValue([])
    },
    $transaction: jest.fn().mockResolvedValue([[], 0]),
    ...overrides
  } as never;
}

function makeAssetRow(extra: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    name: "Truck 01",
    assetCode: "T01",
    status: "AVAILABLE",
    barcode: null,
    qrValue: null,
    serialNumber: null,
    maintenancePlans: [],
    inspections: [],
    breakdowns: [],
    statusHistory: [],
    shiftAssignments: [],
    maintenanceEvents: [],
    ...extra
  };
}

const auditStub = { write: jest.fn() } as never;

// ---------------------------------------------------------------------------
// Category tests
// ---------------------------------------------------------------------------

describe("AssetsService — category", () => {
  it("rejects duplicate asset category names", async () => {
    const prisma = makePrisma({
      assetCategory: {
        findFirst: jest.fn().mockResolvedValue({ id: "category-1" })
      }
    });
    const service = new AssetsService(prisma, auditStub);
    await expect(service.upsertCategory(undefined, { name: "Plant" }, "user-1")).rejects.toBeInstanceOf(ConflictException);
  });
});

// ---------------------------------------------------------------------------
// Checkout tests
// ---------------------------------------------------------------------------

describe("AssetsService — checkout", () => {
  it("creates a checkout when no open checkout exists", async () => {
    const createFn = jest.fn().mockResolvedValue({ id: "co-1", assetId: "asset-1" });
    const prisma = makePrisma({
      asset: {
        findUnique: jest.fn().mockResolvedValue({ id: "asset-1" }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      assetCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: createFn,
        update: jest.fn(),
        findMany: jest.fn()
      }
    });
    const service = new AssetsService(prisma, auditStub);
    const result = await service.checkoutAsset("asset-1", { holderWorkerId: "worker-1" }, "user-1");
    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assetId: "asset-1", holderWorkerId: "worker-1" })
      })
    );
    expect(result).toMatchObject({ id: "co-1", assetId: "asset-1" });
  });

  it("rejects checkout when an open checkout exists (open-checkout guard)", async () => {
    const prisma = makePrisma({
      asset: {
        findUnique: jest.fn().mockResolvedValue({ id: "asset-1" }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      assetCheckout: {
        findFirst: jest.fn().mockResolvedValue({ id: "co-existing", assetId: "asset-1", checkedInAt: null }),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
      }
    });
    const service = new AssetsService(prisma, auditStub);
    await expect(service.checkoutAsset("asset-1", {}, "user-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects checkout when the asset does not exist", async () => {
    const prisma = makePrisma({
      asset: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      assetCheckout: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
      }
    });
    const service = new AssetsService(prisma, auditStub);
    await expect(service.checkoutAsset("no-such-asset", {}, "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("closes open checkout on checkin", async () => {
    const updateFn = jest.fn().mockResolvedValue({ id: "co-1", checkedInAt: new Date() });
    const prisma = makePrisma({
      asset: {
        findUnique: jest.fn().mockResolvedValue({ id: "asset-1" }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      assetCheckout: {
        findFirst: jest.fn().mockResolvedValue({ id: "co-1", assetId: "asset-1", checkedInAt: null, notes: null }),
        create: jest.fn(),
        update: updateFn,
        findMany: jest.fn()
      }
    });
    const service = new AssetsService(prisma, auditStub);
    await service.checkinAsset("asset-1", { notes: "returned ok" }, "user-1");
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "co-1" },
        data: expect.objectContaining({ checkedInAt: expect.any(Date) })
      })
    );
  });

  it("rejects checkin when no open checkout exists", async () => {
    const prisma = makePrisma({
      asset: {
        findUnique: jest.fn().mockResolvedValue({ id: "asset-1" }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      },
      assetCheckout: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
      }
    });
    const service = new AssetsService(prisma, auditStub);
    await expect(service.checkinAsset("asset-1", {}, "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Scan tests
// ---------------------------------------------------------------------------

describe("AssetsService — scan", () => {
  it("resolves an asset by barcode", async () => {
    const assetRow = makeAssetRow({ barcode: "BC-12345" });
    const prisma = makePrisma({
      asset: {
        findFirst: jest.fn().mockResolvedValue({ id: "asset-1" }),
        findUnique: jest.fn().mockResolvedValue(assetRow),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      }
    });
    const service = new AssetsService(prisma, auditStub);
    const result = await service.scanAsset("BC-12345");
    expect(result).toMatchObject({ id: "asset-1", barcode: "BC-12345" });
  });

  it("returns 404 when no asset matches the scan code", async () => {
    const prisma = makePrisma({
      asset: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn()
      }
    });
    const service = new AssetsService(prisma, auditStub);
    await expect(service.scanAsset("UNKNOWN-CODE")).rejects.toBeInstanceOf(NotFoundException);
  });
});
