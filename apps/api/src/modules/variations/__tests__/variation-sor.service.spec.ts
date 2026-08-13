import { BadRequestException } from "@nestjs/common";
import { Prisma, SorCategory } from "@prisma/client";
import { VariationSorService } from "../variation-sor.service";

// -- Mock Prisma --------------------------------------------------------

type MockPrisma = {
  variation: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
  };
  variationSorLine: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    aggregate: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    variation: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ pricedDate: null }),
      update: jest.fn().mockResolvedValue({}),
    },
    variationSorLine: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn().mockResolvedValue({ _sum: { lineAmount: new Prisma.Decimal(0) } }),
    },
    $transaction: jest.fn().mockImplementation(
      (fn: (tx: MockPrisma) => Promise<unknown>) => fn(prisma),
    ),
  };
  return prisma;
}

// -- Mock snapshots service --------------------------------------------

type MockSnapshotService = {
  getForJob: jest.Mock;
  attach: jest.Mock;
  getLockedRate: jest.Mock;
};

function makeSnapshots(): MockSnapshotService {
  return {
    getForJob: jest.fn().mockResolvedValue(null),
    attach: jest.fn(),
    getLockedRate: jest.fn(),
  };
}

function makeService(prisma: MockPrisma, snapshots: MockSnapshotService) {
  return new VariationSorService(prisma as never, snapshots as never);
}

// -- Fixtures -----------------------------------------------------------

const VARIATION_ID = "var-1";
const JOB_ID = "job-1";
const SNAPSHOT_ID = "snap-1";
const SOR_VERSION = "2026-H1-2026-08-13T00:00:00.000Z";

const VARIATION_WITH_JOB = {
  contract: { project: { sourceJobId: JOB_ID } },
};

const SNAPSHOT_ACTIVE = {
  id: SNAPSHOT_ID,
  sorVersion: SOR_VERSION,
  status: "ACTIVE",
};

const LOCKED_RATE_PM = {
  id: "srate-pm",
  snapshotId: SNAPSHOT_ID,
  sourceRateId: "rate-pm",
  category: SorCategory.LABOUR,
  name: "Project Manager",
  class: "Demolition",
  unit: "Per Hour",
  ordinary: new Prisma.Decimal(133.1),
  oneAndHalf: new Prisma.Decimal(160),
  double: new Prisma.Decimal(193),
};

// -- Tests --------------------------------------------------------------

describe("VariationSorService", () => {
  describe("createLine()", () => {
    it("(a) first line triggers snapshot.attach when the job has no active snapshot", async () => {
      const prisma = makePrisma();
      const snapshots = makeSnapshots();
      prisma.variation.findUnique
        // requireVariation
        .mockResolvedValueOnce({ id: VARIATION_ID })
        // resolveJobIdForVariation
        .mockResolvedValueOnce(VARIATION_WITH_JOB);
      snapshots.getForJob.mockResolvedValue(null);
      snapshots.attach.mockResolvedValue(SNAPSHOT_ACTIVE);
      snapshots.getLockedRate.mockResolvedValue(LOCKED_RATE_PM);
      prisma.variationSorLine.create.mockResolvedValue({ id: "line-1" });

      const service = makeService(prisma, snapshots);
      await service.createLine(
        VARIATION_ID,
        {
          snapshotRateId: LOCKED_RATE_PM.id,
          tier: "ORDINARY",
          quantity: 10,
          sorPeriodId: "period-h1",
        },
        "user-1",
      );

      expect(snapshots.attach).toHaveBeenCalledWith(
        { jobId: JOB_ID, sorPeriodId: "period-h1" },
        "user-1",
      );
      // Line was created with frozen rate + computed line amount.
      expect(prisma.variationSorLine.create).toHaveBeenCalledTimes(1);
      const args = prisma.variationSorLine.create.mock.calls[0][0].data;
      expect(args.jobSorSnapshotId).toBe(SNAPSHOT_ID);
      expect(args.sorVersion).toBe(SOR_VERSION);
      expect(String(args.rate)).toBe("133.1");
      expect(String(args.lineAmount)).toBe("1331");
    });

    it("(a2) rejects the first line when no active snapshot AND no sorPeriodId supplied", async () => {
      const prisma = makePrisma();
      const snapshots = makeSnapshots();
      prisma.variation.findUnique
        .mockResolvedValueOnce({ id: VARIATION_ID })
        .mockResolvedValueOnce(VARIATION_WITH_JOB);
      snapshots.getForJob.mockResolvedValue(null);

      const service = makeService(prisma, snapshots);
      await expect(
        service.createLine(VARIATION_ID, {
          snapshotRateId: LOCKED_RATE_PM.id,
          tier: "ORDINARY",
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(snapshots.attach).not.toHaveBeenCalled();
    });

    it("(b) subsequent lines reuse the same snapshot + sorVersion (no re-attach)", async () => {
      const prisma = makePrisma();
      const snapshots = makeSnapshots();
      prisma.variation.findUnique
        .mockResolvedValueOnce({ id: VARIATION_ID })
        .mockResolvedValueOnce(VARIATION_WITH_JOB);
      snapshots.getForJob.mockResolvedValue(SNAPSHOT_ACTIVE);
      snapshots.getLockedRate.mockResolvedValue(LOCKED_RATE_PM);
      prisma.variationSorLine.create.mockResolvedValue({ id: "line-2" });

      const service = makeService(prisma, snapshots);
      await service.createLine(VARIATION_ID, {
        snapshotRateId: LOCKED_RATE_PM.id,
        tier: "DOUBLE",
        quantity: 2,
        // deliberately no sorPeriodId -- reused snapshot must be enough
      });

      expect(snapshots.attach).not.toHaveBeenCalled();
      const args = prisma.variationSorLine.create.mock.calls[0][0].data;
      expect(args.jobSorSnapshotId).toBe(SNAPSHOT_ID);
      expect(args.sorVersion).toBe(SOR_VERSION);
      // Double tier picks the double rate from the frozen row.
      expect(String(args.rate)).toBe("193");
      expect(String(args.lineAmount)).toBe("386");
    });

    it("(manual) copies caller-supplied fields when snapshotRateId is omitted", async () => {
      const prisma = makePrisma();
      const snapshots = makeSnapshots();
      prisma.variation.findUnique
        .mockResolvedValueOnce({ id: VARIATION_ID })
        .mockResolvedValueOnce(VARIATION_WITH_JOB);
      snapshots.getForJob.mockResolvedValue(SNAPSHOT_ACTIVE);
      prisma.variationSorLine.create.mockResolvedValue({ id: "line-3" });

      const service = makeService(prisma, snapshots);
      await service.createLine(VARIATION_ID, {
        tier: "ORDINARY",
        quantity: 4,
        name: "Bespoke crane hire",
        category: SorCategory.PLANT,
        unit: "Per Day",
        rate: 500,
      });

      expect(snapshots.getLockedRate).not.toHaveBeenCalled();
      const args = prisma.variationSorLine.create.mock.calls[0][0].data;
      expect(args.name).toBe("Bespoke crane hire");
      expect(args.category).toBe(SorCategory.PLANT);
      expect(args.snapshotRateId).toBeNull();
      expect(String(args.rate)).toBe("500");
      expect(String(args.lineAmount)).toBe("2000");
    });
  });

  describe("updateLine()", () => {
    it("(c) editing quantity keeps the rate frozen at the originally copied value", async () => {
      const prisma = makePrisma();
      const snapshots = makeSnapshots();
      const existing = {
        id: "line-1",
        variationId: VARIATION_ID,
        rate: new Prisma.Decimal(133.1),
        quantity: new Prisma.Decimal(10),
        lineAmount: new Prisma.Decimal(1331),
        tier: "ORDINARY",
        notes: null,
        sortOrder: 0,
      };
      prisma.variationSorLine.findUnique.mockResolvedValue(existing);
      prisma.variationSorLine.update.mockResolvedValue({ ...existing, quantity: new Prisma.Decimal(20), lineAmount: new Prisma.Decimal(2662) });

      const service = makeService(prisma, snapshots);
      await service.updateLine(VARIATION_ID, "line-1", { quantity: 20 });

      const args = prisma.variationSorLine.update.mock.calls[0][0].data;
      // rate is not in the update payload -- Prisma ignores it, but the
      // recomputed lineAmount uses the frozen rate we already had.
      expect(args.rate).toBeUndefined();
      expect(String(args.lineAmount)).toBe("2662");
    });
  });

  describe("recompute", () => {
    it("(d) pricedAmount + pricedDate are stamped on the variation after every write", async () => {
      const prisma = makePrisma();
      const snapshots = makeSnapshots();
      prisma.variation.findUnique
        .mockResolvedValueOnce({ id: VARIATION_ID })
        .mockResolvedValueOnce(VARIATION_WITH_JOB);
      snapshots.getForJob.mockResolvedValue(SNAPSHOT_ACTIVE);
      snapshots.getLockedRate.mockResolvedValue(LOCKED_RATE_PM);
      prisma.variationSorLine.create.mockResolvedValue({ id: "line-1" });
      prisma.variationSorLine.aggregate.mockResolvedValue({
        _sum: { lineAmount: new Prisma.Decimal(1331) },
      });
      prisma.variation.findUniqueOrThrow.mockResolvedValue({ pricedDate: null });

      const service = makeService(prisma, snapshots);
      await service.createLine(VARIATION_ID, {
        snapshotRateId: LOCKED_RATE_PM.id,
        tier: "ORDINARY",
        quantity: 10,
      });

      expect(prisma.variation.update).toHaveBeenCalledTimes(1);
      const update = prisma.variation.update.mock.calls[0][0];
      expect(update.where).toEqual({ id: VARIATION_ID });
      expect(String(update.data.pricedAmount)).toBe("1331");
      expect(update.data.pricedDate).toBeInstanceOf(Date);
    });

    it("(d2) preserves an existing pricedDate on subsequent writes", async () => {
      const prisma = makePrisma();
      const snapshots = makeSnapshots();
      const existingDate = new Date("2026-08-10T00:00:00.000Z");
      prisma.variation.findUnique
        .mockResolvedValueOnce({ id: VARIATION_ID })
        .mockResolvedValueOnce(VARIATION_WITH_JOB);
      snapshots.getForJob.mockResolvedValue(SNAPSHOT_ACTIVE);
      snapshots.getLockedRate.mockResolvedValue(LOCKED_RATE_PM);
      prisma.variationSorLine.create.mockResolvedValue({ id: "line-2" });
      prisma.variationSorLine.aggregate.mockResolvedValue({
        _sum: { lineAmount: new Prisma.Decimal(2662) },
      });
      prisma.variation.findUniqueOrThrow.mockResolvedValue({ pricedDate: existingDate });

      const service = makeService(prisma, snapshots);
      await service.createLine(VARIATION_ID, {
        snapshotRateId: LOCKED_RATE_PM.id,
        tier: "ORDINARY",
        quantity: 20,
      });

      const update = prisma.variation.update.mock.calls[0][0];
      expect(update.data.pricedDate).toBe(existingDate);
    });
  });

  describe("guards", () => {
    it("rejects a variation whose contract has no sourceJob", async () => {
      const prisma = makePrisma();
      const snapshots = makeSnapshots();
      prisma.variation.findUnique
        .mockResolvedValueOnce({ id: VARIATION_ID })
        .mockResolvedValueOnce({ contract: { project: { sourceJobId: null } } });

      const service = makeService(prisma, snapshots);
      await expect(
        service.createLine(VARIATION_ID, {
          snapshotRateId: LOCKED_RATE_PM.id,
          tier: "ORDINARY",
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
