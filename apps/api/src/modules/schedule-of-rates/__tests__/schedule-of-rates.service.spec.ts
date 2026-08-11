import { NotFoundException } from "@nestjs/common";
import { ScheduleOfRatesService } from "../schedule-of-rates.service";
import { SorCategory, SorPeriodHalf } from "@prisma/client";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

type MockPrisma = {
  sorPeriod: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
  sorRate: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  sorChangeLogEntry: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    sorPeriod: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn()
    },
    sorRate: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    sorChangeLogEntry: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([])
    },
    // Simulate $transaction by running the callback with the same mock prisma
    $transaction: jest.fn().mockImplementation((fn: (tx: MockPrisma) => Promise<unknown>) =>
      fn(prisma)
    )
  };
  return prisma;
}

function makeService(prisma: MockPrisma) {
  return new ScheduleOfRatesService(prisma as never);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PERIOD_ROW = {
  id: "period-1",
  year: 2026,
  half: SorPeriodHalf.H1,
  startDate: new Date("2026-01-01"),
  expiryDate: new Date("2026-06-30"),
  label: "H1 2026 (1 Jan - 30 Jun)",
  status: "ACTIVE",
  createdAt: new Date()
};

const RATE_ROW = {
  id: "rate-1",
  periodId: "period-1",
  category: SorCategory.LABOUR,
  name: "Project Manager",
  class: "Demolition",
  unit: "Per Hour",
  ordinary: 133.10,
  oneAndHalf: 160.00,
  double: 193.00,
  isReference: false,
  comments: null,
  sortOrder: 10,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ScheduleOfRatesService", () => {
  // ── (a) Creating/updating a rate writes a change-log entry ────────────────

  describe("createRate", () => {
    it("writes a SorChangeLogEntry when a rate is created", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue(PERIOD_ROW);
      prisma.sorRate.create.mockResolvedValue(RATE_ROW);

      const service = makeService(prisma);
      await service.createRate(
        "period-1",
        {
          category: SorCategory.LABOUR,
          name: "Project Manager",
          class: "Demolition",
          unit: "Per Hour",
          ordinary: 133.10,
          oneAndHalf: 160.00,
          double: 193.00
        },
        "user-1"
      );

      expect(prisma.sorRate.create).toHaveBeenCalledTimes(1);
      expect(prisma.sorChangeLogEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            periodId: "period-1",
            rateId: RATE_ROW.id,
            field: "created",
            changedById: "user-1"
          })
        })
      );
    });

    it("throws NotFoundException when period does not exist", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(
        service.createRate("no-such-period", { category: SorCategory.PLANT, name: "Bobcat" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateRate", () => {
    it("writes a SorChangeLogEntry for each changed field", async () => {
      const prisma = makePrisma();
      prisma.sorRate.findUnique.mockResolvedValue(RATE_ROW);
      const updatedRow = { ...RATE_ROW, ordinary: 140.00, name: "Senior PM" };
      prisma.sorRate.update.mockResolvedValue(updatedRow);

      const service = makeService(prisma);
      await service.updateRate("rate-1", { ordinary: 140.00, name: "Senior PM" }, "user-2");

      // Two fields changed — expect two change-log entries
      expect(prisma.sorChangeLogEntry.create).toHaveBeenCalledTimes(2);
      const calls = prisma.sorChangeLogEntry.create.mock.calls.map((c) => c[0].data.field);
      expect(calls).toContain("name");
      expect(calls).toContain("ordinary");
    });

    it("writes no change-log entries when nothing changed", async () => {
      const prisma = makePrisma();
      prisma.sorRate.findUnique.mockResolvedValue(RATE_ROW);
      prisma.sorRate.update.mockResolvedValue(RATE_ROW);

      const service = makeService(prisma);
      // Pass same values — no real change
      await service.updateRate("rate-1", { name: RATE_ROW.name }, "user-2");

      expect(prisma.sorChangeLogEntry.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when rate does not exist", async () => {
      const prisma = makePrisma();
      prisma.sorRate.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(
        service.updateRate("no-such-rate", { name: "X" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── (b) list-by-period groups rates by category ───────────────────────────

  describe("getPeriodWithRates", () => {
    it("groups rates by category", async () => {
      const prisma = makePrisma();
      const labourRate = { ...RATE_ROW, id: "rate-1", category: SorCategory.LABOUR };
      const plantRate = { ...RATE_ROW, id: "rate-2", category: SorCategory.PLANT, name: "Bobcat" };
      const wasteRate = { ...RATE_ROW, id: "rate-3", category: SorCategory.WASTE, name: "C&D" };

      prisma.sorPeriod.findUnique.mockResolvedValue({
        ...PERIOD_ROW,
        rates: [labourRate, plantRate, wasteRate]
      });

      const service = makeService(prisma);
      const result = await service.getPeriodWithRates("period-1");

      expect(result.ratesByCategory).toHaveProperty("LABOUR");
      expect(result.ratesByCategory).toHaveProperty("PLANT");
      expect(result.ratesByCategory).toHaveProperty("WASTE");
      expect(result.ratesByCategory[SorCategory.LABOUR]).toHaveLength(1);
      expect(result.ratesByCategory[SorCategory.PLANT]).toHaveLength(1);
      expect(result.ratesByCategory[SorCategory.WASTE]).toHaveLength(1);
      expect(result.ratesByCategory[SorCategory.LABOUR]![0].name).toBe("Project Manager");
    });

    it("throws NotFoundException when period does not exist", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(service.getPeriodWithRates("no-such")).rejects.toThrow(NotFoundException);
    });

    it("returns an empty ratesByCategory when period has no active rates", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue({ ...PERIOD_ROW, rates: [] });

      const service = makeService(prisma);
      const result = await service.getPeriodWithRates("period-1");

      expect(result.ratesByCategory).toEqual({});
    });
  });

  // ── listChangeLog ──────────────────────────────────────────────────────────

  describe("listChangeLog", () => {
    it("returns change log entries for a period", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue(PERIOD_ROW);
      const entries = [
        { id: "cl-1", periodId: "period-1", rateId: "rate-1", field: "created", changedAt: new Date() }
      ];
      prisma.sorChangeLogEntry.findMany.mockResolvedValue(entries);

      const service = makeService(prisma);
      const result = await service.listChangeLog("period-1");

      expect(result).toEqual(entries);
    });

    it("throws NotFoundException when period does not exist", async () => {
      const prisma = makePrisma();
      prisma.sorPeriod.findUnique.mockResolvedValue(null);
      const service = makeService(prisma);

      await expect(service.listChangeLog("no-such")).rejects.toThrow(NotFoundException);
    });
  });
});
