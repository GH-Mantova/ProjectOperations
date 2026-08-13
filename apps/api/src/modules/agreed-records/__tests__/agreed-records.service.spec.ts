import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AgreedRecordStatus } from "@prisma/client";
import { AgreedRecordsService } from "../agreed-records.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { JobSorSnapshotService } from "../../schedule-of-rates/job-sor-snapshot.service";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAr(overrides: Partial<{
  id: string;
  jobId: string;
  status: AgreedRecordStatus;
  workerSignaturePath: string | null;
  clientRepSignaturePath: string | null;
  clientRepName: string | null;
  workerSignedById: string | null;
  workerSignedAt: Date | null;
  clientRepSignedAt: Date | null;
  jobSorSnapshotId: string | null;
  sorVersion: string | null;
  submittedAt: Date | null;
  lines: unknown[];
  attachments: unknown[];
}> = {}) {
  return {
    id: overrides.id ?? "ar-1",
    jobId: overrides.jobId ?? "job-1",
    recordNumber: "AR-000001",
    description: "Test dayworks",
    workDate: new Date("2026-08-13"),
    status: overrides.status ?? AgreedRecordStatus.DRAFT,
    workerSignaturePath: overrides.workerSignaturePath ?? null,
    clientRepSignaturePath: overrides.clientRepSignaturePath ?? null,
    clientRepName: overrides.clientRepName ?? null,
    workerSignedById: overrides.workerSignedById ?? null,
    workerSignedAt: overrides.workerSignedAt ?? null,
    clientRepSignedAt: overrides.clientRepSignedAt ?? null,
    jobSorSnapshotId: overrides.jobSorSnapshotId ?? null,
    sorVersion: overrides.sorVersion ?? null,
    submittedAt: overrides.submittedAt ?? null,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: overrides.lines ?? [],
    attachments: overrides.attachments ?? [],
  };
}

function makeSnapshot(overrides: Partial<{ id: string; sorVersion: string }> = {}) {
  return {
    id: overrides.id ?? "snap-1",
    jobId: "job-1",
    sorVersion: overrides.sorVersion ?? "2026-H1-2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    rates: [],
  };
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  job: { findUnique: jest.fn() },
  agreedRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  agreedRecordLine: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  agreedRecordAttachment: {
    create: jest.fn(),
    count: jest.fn(),
  },
  agreedRecordNumberSequence: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockSnapshotService = {
  getForJob: jest.fn(),
  attach: jest.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("AgreedRecordsService", () => {
  let service: AgreedRecordsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgreedRecordsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JobSorSnapshotService, useValue: mockSnapshotService },
      ],
    }).compile();

    service = module.get<AgreedRecordsService>(AgreedRecordsService);

    jest.clearAllMocks();
  });

  // ─── (a) submit rejects if worker signature missing ─────────────────────

  describe("submit — signature validation", () => {
    it("(a) rejects submission when worker signature is missing", async () => {
      const ar = makeAr({
        status: AgreedRecordStatus.DRAFT,
        workerSignaturePath: null,
        clientRepSignaturePath: "/sigs/client.png",
        clientRepName: "John Smith",
      });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordAttachment.count.mockResolvedValue(1);

      await expect(
        service.submit(
          "ar-1",
          {
            workerSignaturePath: "",
            clientRepName: "John Smith",
            clientRepSignaturePath: "/sigs/client.png",
          },
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("(a) rejects submission when client-rep signature is missing", async () => {
      const ar = makeAr({
        status: AgreedRecordStatus.DRAFT,
        workerSignaturePath: "/sigs/worker.png",
        clientRepSignaturePath: null,
        clientRepName: null,
      });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordAttachment.count.mockResolvedValue(1);

      await expect(
        service.submit(
          "ar-1",
          {
            workerSignaturePath: "/sigs/worker.png",
            clientRepName: "John Smith",
            clientRepSignaturePath: "",
          },
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("(a) rejects submission when no photo attachment exists", async () => {
      const ar = makeAr({
        status: AgreedRecordStatus.DRAFT,
        workerSignaturePath: "/sigs/worker.png",
        clientRepSignaturePath: "/sigs/client.png",
        clientRepName: "John Smith",
      });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordAttachment.count.mockResolvedValue(0);

      await expect(
        service.submit(
          "ar-1",
          {
            workerSignaturePath: "/sigs/worker.png",
            clientRepName: "John Smith",
            clientRepSignaturePath: "/sigs/client.png",
          },
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── (b) first submit against a job triggers snapshot attach ────────────

  describe("submit — snapshot attach on first use", () => {
    it("(b) calls snapshot.attach when job has no active snapshot", async () => {
      const ar = makeAr({
        status: AgreedRecordStatus.DRAFT,
        workerSignaturePath: "/sigs/worker.png",
        clientRepSignaturePath: "/sigs/client.png",
        clientRepName: "John Smith",
      });
      const snap = makeSnapshot();

      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordAttachment.count.mockResolvedValue(2);
      mockSnapshotService.getForJob.mockResolvedValue(null); // no existing snapshot
      mockSnapshotService.attach.mockResolvedValue(snap);
      mockPrisma.agreedRecord.update.mockResolvedValue({
        ...ar,
        status: AgreedRecordStatus.SUBMITTED,
        jobSorSnapshotId: snap.id,
        sorVersion: snap.sorVersion,
      });

      await service.submit(
        "ar-1",
        {
          workerSignaturePath: "/sigs/worker.png",
          clientRepName: "John Smith",
          clientRepSignaturePath: "/sigs/client.png",
          sorPeriodId: "period-1",
        },
        "user-1",
      );

      expect(mockSnapshotService.attach).toHaveBeenCalledWith(
        { jobId: "job-1", sorPeriodId: "period-1" },
        "user-1",
      );
    });

    it("(b) raises BadRequestException when job has no snapshot and no sorPeriodId given", async () => {
      const ar = makeAr({
        status: AgreedRecordStatus.DRAFT,
        workerSignaturePath: "/sigs/worker.png",
        clientRepSignaturePath: "/sigs/client.png",
        clientRepName: "John Smith",
      });

      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordAttachment.count.mockResolvedValue(1);
      mockSnapshotService.getForJob.mockResolvedValue(null);

      await expect(
        service.submit(
          "ar-1",
          {
            workerSignaturePath: "/sigs/worker.png",
            clientRepName: "John Smith",
            clientRepSignaturePath: "/sigs/client.png",
            // sorPeriodId intentionally omitted
          },
          "user-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── (c) subsequent submits reuse same snapshot ─────────────────────────

  describe("submit — subsequent ARs reuse existing snapshot", () => {
    it("(c) does not call snapshot.attach when an active snapshot already exists", async () => {
      const existingSnap = makeSnapshot({ id: "snap-existing" });
      const ar = makeAr({
        status: AgreedRecordStatus.DRAFT,
        workerSignaturePath: "/sigs/worker.png",
        clientRepSignaturePath: "/sigs/client.png",
        clientRepName: "John Smith",
      });

      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordAttachment.count.mockResolvedValue(1);
      mockSnapshotService.getForJob.mockResolvedValue(existingSnap);
      mockPrisma.agreedRecord.update.mockResolvedValue({
        ...ar,
        status: AgreedRecordStatus.SUBMITTED,
        jobSorSnapshotId: existingSnap.id,
        sorVersion: existingSnap.sorVersion,
      });

      const result = await service.submit(
        "ar-1",
        {
          workerSignaturePath: "/sigs/worker.png",
          clientRepName: "John Smith",
          clientRepSignaturePath: "/sigs/client.png",
          sorPeriodId: "period-1",
        },
        "user-1",
      );

      expect(mockSnapshotService.attach).not.toHaveBeenCalled();
      expect(result.jobSorSnapshotId).toBe("snap-existing");
      expect(result.sorVersion).toBe(existingSnap.sorVersion);
    });
  });

  // ─── (d) lines never carry rate/amount in returned DTOs ────────────────

  describe("include shape — no rate or dollar values", () => {
    it("(d) returned lines do not include rate or amount fields", async () => {
      const lineWithoutRate = {
        id: "line-1",
        agreedRecordId: "ar-1",
        category: "LABOUR",
        resourceName: "Excavator operator",
        class: "Class 3",
        unit: "hr",
        quantity: "8.00",
        tier: "ORDINARY",
        notes: null,
        sortOrder: 0,
        // NOTE: no `rate`, no `amount`, no `lineAmount`, no `ordinary` — by schema design
      };

      const ar = makeAr({ lines: [lineWithoutRate] });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.job.findUnique.mockResolvedValue({ id: "job-1" });
      mockPrisma.agreedRecord.findMany.mockResolvedValue([ar]);

      const records = await service.listForJob("job-1");
      expect(records).toHaveLength(1);
      const line = records[0].lines[0] as Record<string, unknown>;

      // Assert that none of the pricing keys exist on the returned line object.
      expect(line).not.toHaveProperty("rate");
      expect(line).not.toHaveProperty("amount");
      expect(line).not.toHaveProperty("lineAmount");
      expect(line).not.toHaveProperty("ordinary");
      expect(line).not.toHaveProperty("oneAndHalf");
      expect(line).not.toHaveProperty("double");
    });
  });
});
