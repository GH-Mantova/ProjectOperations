import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SorCategory, SorPeriodHalf } from "@prisma/client";
import { JobSorSnapshotService } from "../job-sor-snapshot.service";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

type MockPrisma = {
  sorPeriod: { findUnique: jest.Mock };
  sorRate: { findMany: jest.Mock };
  sorClientRateCard: { findUnique: jest.Mock };
  sorClientRateEntry: { findMany: jest.Mock };
  job: { findUnique: jest.Mock };
  tenderClient: { findFirst: jest.Mock };
  jobSorSnapshot: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  jobSorSnapshotRate: {
    createMany: jest.Mock;
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    sorPeriod: { findUnique: jest.fn() },
    sorRate: { findMany: jest.fn().mockResolvedValue([]) },
    sorClientRateCard: { findUnique: jest.fn().mockResolvedValue(null) },
    sorClientRateEntry: { findMany: jest.fn().mockResolvedValue([]) },
    job: { findUnique: jest.fn() },
    tenderClient: { findFirst: jest.fn() },
    jobSorSnapshot: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    jobSorSnapshotRate: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(
      (fn: (tx: MockPrisma) => Promise<unknown>) => fn(prisma),
    ),
  };
  return prisma;
}

function makeService(prisma: MockPrisma) {
  return new JobSorSnapshotService(prisma as never);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PERIOD_H1 = {
  id: "period-h1",
  year: 2026,
  half: SorPeriodHalf.H1,
  startDate: new Date("2026-01-01"),
  expiryDate: new Date("2026-06-30"),
  label: "H1 2026",
  status: "ACTIVE",
  createdAt: new Date(),
};

const PERIOD_H2 = {
  id: "period-h2",
  year: 2026,
  half: SorPeriodHalf.H2,
  startDate: new Date("2026-07-01"),
  expiryDate: new Date("2026-12-31"),
  label: "H2 2026",
  status: "ACTIVE",
  createdAt: new Date(),
};

const MASTER_RATE_PM = {
  id: "rate-pm",
  periodId: "period-h1",
  category: SorCategory.LABOUR,
  name: "Project Manager",
  class: "Demolition",
  unit: "Per Hour",
  ordinary: 133.1,
  oneAndHalf: 160,
  double: 193,
  isReference: false,
  comments: null,
  sortOrder: 10,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MASTER_RATE_LABOURER = {
  ...MASTER_RATE_PM,
  id: "rate-lab",
  name: "General Labourer",
  ordinary: 70,
  oneAndHalf: 100,
  double: 130,
  sortOrder: 20,
};

const CARD = {
  id: "card-1",
  clientId: "client-1",
  sorPeriodId: "period-h1",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Override on the PM row + a fresh client-only addition.
const CLIENT_ENTRIES = [
  {
    id: "entry-override",
    cardId: "card-1",
    sorRateId: "rate-pm",
    category: SorCategory.LABOUR,
    position: "Project Manager (client override)",
    class: "Demolition",
    unit: "Per Hour",
    ordinary: 150,
    oneAndHalf: 180,
    double: 220,
    isOverride: true,
    isRemoved: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "entry-added",
    cardId: "card-1",
    sorRateId: null,
    category: SorCategory.PLANT,
    position: "Client-only Bobcat",
    class: null,
    unit: "Per Day",
    ordinary: 550,
    oneAndHalf: null,
    double: null,
    isOverride: false,
    isRemoved: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("JobSorSnapshotService", () => {
  // ── (a) attach merges master + client overrides at lock time ─────────────

  describe("attach() — merge behaviour", () => {
    it("copies master rows and applies client overrides + additions", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue(PERIOD_H1);
      prisma.job.findUnique.mockResolvedValue({ clientId: "client-1" });
      prisma.sorClientRateCard.findUnique.mockResolvedValue(CARD);
      prisma.sorRate.findMany.mockResolvedValue([MASTER_RATE_PM, MASTER_RATE_LABOURER]);
      prisma.sorClientRateEntry.findMany.mockResolvedValue(CLIENT_ENTRIES);
      prisma.jobSorSnapshot.create.mockResolvedValue({
        id: "snap-1",
        jobId: "job-1",
        clientId: "client-1",
      });
      prisma.jobSorSnapshot.findUniqueOrThrow.mockResolvedValue({
        id: "snap-1",
        rates: [],
      });

      const service = makeService(prisma);
      await service.attach({ jobId: "job-1", sorPeriodId: "period-h1" }, "user-1");

      expect(prisma.jobSorSnapshotRate.createMany).toHaveBeenCalledTimes(1);
      const rows = prisma.jobSorSnapshotRate.createMany.mock.calls[0][0].data as Array<
        Record<string, unknown>
      >;
      // Master PM overridden by client, master labourer untouched, plus fresh add.
      expect(rows).toHaveLength(3);
      const overridden = rows.find((r) => r.sourceRateId === "rate-pm");
      expect(overridden).toMatchObject({
        name: "Project Manager (client override)",
        ordinary: 150,
      });
      const untouched = rows.find((r) => r.sourceRateId === "rate-lab");
      expect(untouched).toMatchObject({ name: "General Labourer", ordinary: 70 });
      const added = rows.find((r) => r.sourceRateId === null);
      expect(added).toMatchObject({
        name: "Client-only Bobcat",
        category: SorCategory.PLANT,
      });
    });

    it("drops master rows the client soft-removed", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue(PERIOD_H1);
      prisma.job.findUnique.mockResolvedValue({ clientId: "client-1" });
      prisma.sorClientRateCard.findUnique.mockResolvedValue(CARD);
      prisma.sorRate.findMany.mockResolvedValue([MASTER_RATE_PM]);
      prisma.sorClientRateEntry.findMany.mockResolvedValue([
        { ...CLIENT_ENTRIES[0], isRemoved: true, isOverride: false },
      ]);
      prisma.jobSorSnapshot.create.mockResolvedValue({ id: "snap-1" });
      prisma.jobSorSnapshot.findUniqueOrThrow.mockResolvedValue({ id: "snap-1", rates: [] });

      const service = makeService(prisma);
      await service.attach({ jobId: "job-1", sorPeriodId: "period-h1" }, "user-1");

      // Removed master row is not copied; no fresh adds either → createMany
      // is skipped entirely.
      expect(prisma.jobSorSnapshotRate.createMany).not.toHaveBeenCalled();
    });
  });

  // ── (b) idempotency: repeat attach returns the existing snapshot ─────────

  describe("attach() — idempotency", () => {
    it("returns the existing ACTIVE snapshot without re-creating rates", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue(PERIOD_H1);
      prisma.job.findUnique.mockResolvedValue({ clientId: "client-1" });
      const existing = {
        id: "snap-existing",
        jobId: "job-1",
        sorPeriodId: "period-h1",
        status: "ACTIVE",
        rates: [{ id: "row-1" }],
      };
      prisma.jobSorSnapshot.findFirst.mockResolvedValue(existing);

      const service = makeService(prisma);
      const result = await service.attach(
        { jobId: "job-1", sorPeriodId: "period-h1" },
        "user-1",
      );

      expect(result).toBe(existing);
      expect(prisma.jobSorSnapshot.create).not.toHaveBeenCalled();
      expect(prisma.jobSorSnapshotRate.createMany).not.toHaveBeenCalled();
    });

    it("rejects when neither jobId nor tenderId is provided", async () => {
      const service = makeService(makePrisma());
      await expect(
        service.attach({ sorPeriodId: "period-h1" } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects when both jobId and tenderId are provided", async () => {
      const service = makeService(makePrisma());
      await expect(
        service.attach({ jobId: "j", tenderId: "t", sorPeriodId: "period-h1" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── (c) reissue: sets supersededById and creates a new snapshot ──────────

  describe("reissue()", () => {
    it("creates a successor and marks the predecessor SUPERSEDED", async () => {
      const prisma = makePrisma();
      const expiredCurrent = {
        id: "snap-old",
        jobId: "job-1",
        tenderId: null,
        status: "ACTIVE",
        sorPeriod: { ...PERIOD_H1, expiryDate: new Date("2025-01-01") },
      };
      prisma.jobSorSnapshot.findUnique.mockResolvedValue(expiredCurrent);

      // attach() flow for the successor:
      prisma.sorPeriod.findUnique.mockResolvedValue(PERIOD_H2);
      prisma.job.findUnique.mockResolvedValue({ clientId: "client-1" });
      prisma.sorClientRateCard.findUnique.mockResolvedValue(null);
      prisma.sorRate.findMany.mockResolvedValue([MASTER_RATE_PM]);
      prisma.jobSorSnapshot.create.mockResolvedValue({ id: "snap-new" });
      prisma.jobSorSnapshot.findUniqueOrThrow.mockResolvedValue({
        id: "snap-new",
        rates: [],
      });

      const service = makeService(prisma);
      const successor = await service.reissue("snap-old", "period-h2", "user-1");

      expect(successor).toEqual(expect.objectContaining({ id: "snap-new" }));
      expect(prisma.jobSorSnapshot.update).toHaveBeenCalledWith({
        where: { id: "snap-old" },
        data: { status: "SUPERSEDED", supersededById: "snap-new" },
      });
    });

    it("refuses to reissue while the current period is still active", async () => {
      const prisma = makePrisma();
      prisma.jobSorSnapshot.findUnique.mockResolvedValue({
        id: "snap-old",
        status: "ACTIVE",
        // Expiry in the far future — reissue must fail.
        sorPeriod: { ...PERIOD_H1, expiryDate: new Date("2099-01-01") },
      });

      const service = makeService(prisma);
      await expect(
        service.reissue("snap-old", "period-h2", "user-1"),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.jobSorSnapshot.update).not.toHaveBeenCalled();
    });
  });

  // ── (d) getLockedRate: returns the frozen row, not the live SorRate ──────

  describe("getLockedRate()", () => {
    it("returns the JobSorSnapshotRate scoped to the given snapshot", async () => {
      const prisma = makePrisma();
      const locked = {
        id: "srate-1",
        snapshotId: "snap-1",
        sourceRateId: "rate-pm",
        category: SorCategory.LABOUR,
        name: "Project Manager",
        ordinary: 133.1,
      };
      prisma.jobSorSnapshotRate.findFirst.mockResolvedValue(locked);

      const service = makeService(prisma);
      const result = await service.getLockedRate("snap-1", "srate-1");

      expect(result).toBe(locked);
      expect(prisma.jobSorSnapshotRate.findFirst).toHaveBeenCalledWith({
        where: { id: "srate-1", snapshotId: "snap-1" },
      });
    });

    it("throws NotFoundException when the row belongs to a different snapshot", async () => {
      const prisma = makePrisma();
      prisma.jobSorSnapshotRate.findFirst.mockResolvedValue(null);
      const service = makeService(prisma);
      await expect(service.getLockedRate("snap-1", "srate-999")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
