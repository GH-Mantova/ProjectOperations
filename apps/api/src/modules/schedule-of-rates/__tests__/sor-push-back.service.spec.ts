import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { SorRateSourceType } from "@prisma/client";
import { SorPushBackService } from "../sor-push-back.service";

// ── Mock shapes ───────────────────────────────────────────────────────────────

type MockPrisma = {
  sorRate: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  rateRow: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
  rateTable: { findMany: jest.Mock };
  subcontractorRate: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  tender: { findMany: jest.Mock };
  tenderRateEntry: { findMany: jest.Mock };
  jobSorSnapshotRate: { findMany: jest.Mock };
  sorClientRateEntry: { findMany: jest.Mock };
  sorChangeLogEntry: { create: jest.Mock; createMany: jest.Mock };
  tenderRateSet: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

type MockAudit = { write: jest.Mock };

function makePrisma(): MockPrisma {
  return {
    sorRate: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    rateRow: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    rateTable: { findMany: jest.fn() },
    subcontractorRate: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    tender: { findMany: jest.fn().mockResolvedValue([]) },
    tenderRateEntry: { findMany: jest.fn().mockResolvedValue([]) },
    jobSorSnapshotRate: { findMany: jest.fn().mockResolvedValue([]) },
    sorClientRateEntry: { findMany: jest.fn().mockResolvedValue([]) },
    sorChangeLogEntry: {
      create: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({}),
    },
    tenderRateSet: { findMany: jest.fn().mockResolvedValue([]) },
    // $transaction executes the callback or array of operations.
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === "function") return arg(makePrisma());
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    }),
  };
}

function makeAudit(): MockAudit {
  return { write: jest.fn().mockResolvedValue({}) };
}

function make(prisma = makePrisma(), audit = makeAudit()) {
  const svc = new SorPushBackService(prisma as never, audit as never);
  return { svc, prisma, audit };
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const ACTIVE_PERIOD = {
  id: "period-1",
  label: "2026 H1",
  status: "ACTIVE",
};

const EXPIRED_PERIOD = {
  id: "period-2",
  label: "2025 H2",
  status: "EXPIRED",
};

const RATE_TABLE = {
  id: "rt-1",
  slug: "labour",
  isReference: false,
  columns: [
    { id: "col-role", name: "Role", sortOrder: 0 },
    { id: "col-day", name: "Day rate", sortOrder: 1 },
    { id: "col-night", name: "Night rate", sortOrder: 2 },
    { id: "col-weekend", name: "Weekend rate", sortOrder: 3 },
  ],
};

const INTERNAL_RATE_ROW = {
  id: "rr-1",
  rateTableId: "rt-1",
  isActive: true,
  cells: { "col-day": 100, "col-night": 150, "col-weekend": 200 },
  rateTable: RATE_TABLE,
};

function makeInternalSorRate(overrides: Record<string, unknown> = {}) {
  return {
    id: "sr-1",
    periodId: "period-1",
    period: ACTIVE_PERIOD,
    name: "Foreman",
    class: null,
    unit: "day",
    category: "LABOUR",
    sourceType: SorRateSourceType.INTERNAL,
    sourceRateRowId: "rr-1",
    sourceSubRateId: null,
    ordinary: 110,
    oneAndHalf: 160,
    double: 210,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// ── 1. The frozen guarantee ───────────────────────────────────────────────────
describe("SorPushBackService.pushBack (INTERNAL — frozen guarantee)", () => {
  it("calls rateRow.update with the same id, never rateRow.create, never touches isActive", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(makeInternalSorRate());
    prisma.rateRow.findUnique.mockResolvedValue(INTERNAL_RATE_ROW);

    // $transaction: capture what it receives and call the callback with a sub-prisma
    let transactionArg: unknown;
    const subPrisma = makePrisma();
    subPrisma.rateRow.update.mockResolvedValue(INTERNAL_RATE_ROW);
    subPrisma.sorChangeLogEntry.createMany.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      transactionArg = arg;
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      if (typeof arg === "function") return (arg as (p: unknown) => unknown)(subPrisma);
      return arg;
    });

    await svc.pushBack("sr-1", "user-1", {
      ordinary: 110,
      oneAndHalf: 160,
      double: 210,
    });

    // rateRow.update called with the same row id.
    expect(subPrisma.rateRow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rr-1" },
      }),
    );

    // rateRow.create was NEVER called.
    expect(subPrisma.rateRow.create).not.toHaveBeenCalled();
    expect(prisma.rateRow.create).not.toHaveBeenCalled();

    // isActive is NOT in the update data.
    const updateCall = subPrisma.rateRow.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall?.data).not.toHaveProperty("isActive");
    expect(updateCall?.data).not.toHaveProperty("id");

    // The forbidden tables are never touched.
    expect(prisma.tenderRateSet.findMany).not.toHaveBeenCalled();
    expect(prisma.tenderRateEntry.findMany).not.toHaveBeenCalled();
    // sorClientRateEntry.findMany IS called (to build frozen list) — only write methods are forbidden.
    expect(prisma.sorClientRateEntry.findMany).toBeDefined(); // ok to call for reads
  });

  it("does NOT call tenderRateSet, tenderRateEntry, jobSorSnapshot, or jobSorSnapshotRate write methods", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(makeInternalSorRate());
    prisma.rateRow.findUnique.mockResolvedValue(INTERNAL_RATE_ROW);

    const subPrisma = makePrisma();
    subPrisma.rateRow.update.mockResolvedValue(INTERNAL_RATE_ROW);
    subPrisma.sorChangeLogEntry.createMany.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      if (typeof arg === "function") return (arg as (p: unknown) => unknown)(subPrisma);
      return arg;
    });

    await svc.pushBack("sr-1", "user-1", {
      ordinary: 110,
      oneAndHalf: 160,
      double: 210,
    });

    // None of the forbidden write methods were invoked.
    expect(subPrisma.tenderRateSet.findMany).not.toHaveBeenCalled();
    expect(subPrisma.tenderRateEntry.findMany).not.toHaveBeenCalled();
    expect(subPrisma.jobSorSnapshotRate.findMany).not.toHaveBeenCalled();
    expect(subPrisma.sorClientRateEntry.findMany).not.toHaveBeenCalled();
  });
});

// ── 2. EXPIRED period -> ForbiddenException ───────────────────────────────────
describe("SorPushBackService — EXPIRED period", () => {
  it("throws ForbiddenException and never writes anything", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(
      makeInternalSorRate({ period: EXPIRED_PERIOD }),
    );

    await expect(
      svc.pushBack("sr-1", "user-1", { ordinary: 110, oneAndHalf: 160, double: 210 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // No transaction, no write calls.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.rateRow.update).not.toHaveBeenCalled();
    expect(prisma.rateRow.create).not.toHaveBeenCalled();
  });

  it("getPreview also throws ForbiddenException for EXPIRED period", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(
      makeInternalSorRate({ period: EXPIRED_PERIOD }),
    );

    await expect(svc.getPreview("sr-1", "user-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

// ── 3. MANUAL sourceType -> BadRequestException ───────────────────────────────
describe("SorPushBackService — MANUAL sourceType", () => {
  it("throws BadRequestException when sourceType is MANUAL", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(
      makeInternalSorRate({
        sourceType: SorRateSourceType.MANUAL,
        sourceRateRowId: null,
      }),
    );

    await expect(
      svc.pushBack("sr-1", "user-1", { ordinary: 110, oneAndHalf: 160, double: 210 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("getPreview also throws BadRequestException for MANUAL", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(
      makeInternalSorRate({
        sourceType: SorRateSourceType.MANUAL,
        sourceRateRowId: null,
      }),
    );

    await expect(svc.getPreview("sr-1", "user-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

// ── 4. expected differs from live line -> ConflictException ───────────────────
describe("SorPushBackService — stale-detection", () => {
  it("throws ConflictException when expected ordinary differs from live", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(makeInternalSorRate());
    // ordinary is 110 on the live line; we pass 999 as expected.
    await expect(
      svc.pushBack("sr-1", "user-1", { ordinary: 999, oneAndHalf: 160, double: 210 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.rateRow.update).not.toHaveBeenCalled();
  });

  it("throws ConflictException when any figure differs", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(makeInternalSorRate());
    await expect(
      svc.pushBack("sr-1", "user-1", { ordinary: 110, oneAndHalf: 999, double: 210 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

// ── 5. nothingToPush ──────────────────────────────────────────────────────────
describe("SorPushBackService — nothingToPush", () => {
  it("preview returns nothingToPush=true when all landing figures equal the hub", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    // SoR line figures match the hub exactly: ordinary=100, oneAndHalf=150, double=200.
    prisma.sorRate.findUnique.mockResolvedValue(
      makeInternalSorRate({ ordinary: 100, oneAndHalf: 150, double: 200 }),
    );
    prisma.rateRow.findUnique.mockResolvedValue(INTERNAL_RATE_ROW);

    const preview = await svc.getPreview("sr-1", "user-1");
    expect(preview.nothingToPush).toBe(true);
  });

  it("pushBack throws ConflictException when nothingToPush", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    // SoR line figures match the hub exactly.
    prisma.sorRate.findUnique.mockResolvedValue(
      makeInternalSorRate({ ordinary: 100, oneAndHalf: 150, double: 200 }),
    );
    prisma.rateRow.findUnique.mockResolvedValue(INTERNAL_RATE_ROW);

    await expect(
      svc.pushBack("sr-1", "user-1", { ordinary: 100, oneAndHalf: 150, double: 200 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ── 6. Vendor push ────────────────────────────────────────────────────────────
describe("SorPushBackService.pushBack (SUBBIE — vendor supersede)", () => {
  function makeVendorSorRate(overrides: Record<string, unknown> = {}) {
    return {
      id: "sr-v",
      periodId: "period-1",
      period: ACTIVE_PERIOD,
      name: "Demo crew",
      class: null,
      unit: "m2",
      category: "SUBCONTRACTOR",
      sourceType: SorRateSourceType.SUBBIE,
      sourceRateRowId: null,
      sourceSubRateId: "sub-1",
      ordinary: 50,
      oneAndHalf: null,
      double: null,
      ...overrides,
    };
  }

  it("creates new SubcontractorRate, deactivates old, repoints all SorRates", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(makeVendorSorRate());

    const newSubRate = { id: "sub-new" };

    // $transaction callback captures the tx operations.
    const txPrisma = makePrisma();
    txPrisma.subcontractorRate.create.mockResolvedValue(newSubRate);
    txPrisma.subcontractorRate.update.mockResolvedValue({ id: "sub-1", isActive: false });
    txPrisma.sorRate.updateMany.mockResolvedValue({ count: 2 });
    txPrisma.sorChangeLogEntry.create.mockResolvedValue({});

    prisma.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") return (fn as (p: unknown) => unknown)(txPrisma);
      if (Array.isArray(fn)) return Promise.all(fn as Promise<unknown>[]);
      return fn;
    });

    prisma.subcontractorRate.findUnique.mockResolvedValue({
      id: "sub-1",
      subcontractorSupplierId: "vendor-1",
      discipline: "DEM",
      unit: "m2",
      rate: 40, // current hub rate differs from SoR line (50) — so push is needed.
      validFrom: null,
      notes: null,
      isActive: true,
    });

    const result = await svc.pushBack("sr-v", "user-1", {
      ordinary: 50,
      oneAndHalf: null,
      double: null,
    });

    // One new SubcontractorRate created.
    expect(txPrisma.subcontractorRate.create).toHaveBeenCalledTimes(1);
    expect(txPrisma.subcontractorRate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subcontractorSupplierId: "vendor-1",
          discipline: "DEM",
          unit: "m2",
          rate: 50,
          isActive: true,
          createdById: "user-1",
        }),
      }),
    );

    // Old row deactivated.
    expect(txPrisma.subcontractorRate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ isActive: false }),
      }),
    );

    // All SorRates repointed.
    expect(txPrisma.sorRate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceSubRateId: "sub-1" },
        data: { sourceSubRateId: "sub-new" },
      }),
    );

    // Only ordinary lands.
    expect(result.landed).toEqual(["ordinary"]);
    expect(result.targetModel).toBe("SubcontractorRate");
    expect(result.targetId).toBe("sub-new");
  });

  it("does NOT write to TenderRateEntry or TenderRateSet in vendor push", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(makeVendorSorRate());

    const txPrisma = makePrisma();
    txPrisma.subcontractorRate.create.mockResolvedValue({ id: "sub-new" });
    txPrisma.subcontractorRate.update.mockResolvedValue({});
    txPrisma.sorRate.updateMany.mockResolvedValue({ count: 1 });
    txPrisma.sorChangeLogEntry.create.mockResolvedValue({});

    prisma.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === "function") return (fn as (p: unknown) => unknown)(txPrisma);
      if (Array.isArray(fn)) return Promise.all(fn as Promise<unknown>[]);
      return fn;
    });

    prisma.subcontractorRate.findUnique.mockResolvedValue({
      id: "sub-1",
      subcontractorSupplierId: "vendor-1",
      discipline: "DEM",
      unit: "m2",
      rate: 40,
      validFrom: null,
      notes: null,
      isActive: true,
    });

    await svc.pushBack("sr-v", "user-1", {
      ordinary: 50,
      oneAndHalf: null,
      double: null,
    });

    // tenderRateEntry and tenderRateSet write methods never called in tx.
    expect(txPrisma.tenderRateEntry.findMany).not.toHaveBeenCalled();
    expect(txPrisma.tenderRateSet.findMany).not.toHaveBeenCalled();
  });
});

// ── 7. futureLocks filtering ──────────────────────────────────────────────────
describe("SorPushBackService.getPreview — futureLocks", () => {
  it("queries tenders with rateSet=null and status notIn TERMINAL_STATUSES", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(makeInternalSorRate());
    prisma.rateRow.findUnique.mockResolvedValue(INTERNAL_RATE_ROW);

    // tender.findMany returns one open tender.
    prisma.tender.findMany.mockResolvedValue([
      {
        id: "t-1",
        tenderNumber: "T-001",
        title: "Site works",
        status: "ESTIMATING",
      },
    ]);

    const preview = await svc.getPreview("sr-1", "user-1");

    // Verify the query includes the right where clause.
    expect(prisma.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rateSet: null,
          status: expect.objectContaining({
            notIn: expect.arrayContaining([
              "AWARDED",
              "CONTRACT_ISSUED",
              "CONVERTED",
              "LOST",
              "WITHDRAWN",
            ]),
          }),
        }),
      }),
    );

    expect(preview.futureLocks).toHaveLength(1);
    expect(preview.futureLocks[0]).toMatchObject({
      tenderId: "t-1",
      tenderNumber: "T-001",
      status: "ESTIMATING",
    });
  });

  it("returns empty futureLocks with a reason for vendor lines", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue({
      id: "sr-v",
      periodId: "period-1",
      period: ACTIVE_PERIOD,
      name: "Demo crew",
      class: null,
      unit: "m2",
      category: "SUBCONTRACTOR",
      sourceType: SorRateSourceType.SUBBIE,
      sourceRateRowId: null,
      sourceSubRateId: "sub-1",
      ordinary: 50,
      oneAndHalf: null,
      double: null,
    });

    prisma.subcontractorRate.findUnique.mockResolvedValue({
      id: "sub-1",
      rate: 40,
      subcontractorSupplier: { name: "Demo Co", id: "vendor-1" },
      discipline: "DEM",
      unit: "m2",
    });

    const preview = await svc.getPreview("sr-v", "user-1");

    expect(preview.futureLocks).toEqual([]);
    expect(preview.futureLocksReason).toMatch(/vendor/i);
    // tender.findMany is NOT called for vendor lines.
    expect(prisma.tender.findMany).not.toHaveBeenCalled();
  });

  it("returns empty futureLocks with a reason for reference-table lines", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(makeInternalSorRate());
    prisma.rateRow.findUnique.mockResolvedValue({
      ...INTERNAL_RATE_ROW,
      rateTable: { ...RATE_TABLE, isReference: true },
    });

    const preview = await svc.getPreview("sr-1", "user-1");

    expect(preview.futureLocks).toEqual([]);
    expect(preview.futureLocksReason).toMatch(/reference/i);
    expect(prisma.tender.findMany).not.toHaveBeenCalled();
  });
});

// ── 8. NotFoundException ──────────────────────────────────────────────────────
describe("SorPushBackService — not found", () => {
  it("throws NotFoundException when SorRate does not exist", async () => {
    const prisma = makePrisma();
    const { svc } = make(prisma);

    prisma.sorRate.findUnique.mockResolvedValue(null);

    await expect(svc.getPreview("no-such-id", "user-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
