import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AgreedRecordStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AgreedRecordReviewService } from "../agreed-record-review.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { JobSorSnapshotService } from "../../schedule-of-rates/job-sor-snapshot.service";
import { EmailService } from "../../email/email.service";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeAr(overrides: Record<string, unknown> = {}) {
  return {
    id: "ar-1",
    jobId: "job-1",
    recordNumber: "AR-000001",
    description: "Dayworks",
    workDate: new Date("2026-08-17"),
    status: AgreedRecordStatus.SUBMITTED,
    jobSorSnapshotId: "snap-1",
    sorVersion: "2026-H1-ts",
    reviewerId: null,
    reviewStartedAt: null,
    approvedById: null,
    approvedAt: null,
    totalPricedAmount: null,
    sentBackReason: null,
    workerSignaturePath: "/sigs/w.png",
    workerSignedById: "user-worker",
    workerSignedAt: new Date(),
    clientRepName: "Client Rep",
    clientRepSignaturePath: "/sigs/c.png",
    clientRepSignedAt: new Date(),
    submittedAt: new Date(),
    createdById: "user-worker",
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [],
    attachments: [],
    ...overrides,
  };
}

function makePricingLine(overrides: Record<string, unknown> = {}) {
  return {
    id: "pl-1",
    agreedRecordLineId: "line-1",
    snapshotRateId: "sr-1",
    tier: "ORDINARY",
    rate: new Decimal("45.00"),
    lineAmount: new Decimal("360.00"),
    pricedById: "user-pricer",
    pricedAt: new Date(),
    ...overrides,
  };
}

function makeSnapshotRate(overrides: Record<string, unknown> = {}) {
  return {
    id: "sr-1",
    snapshotId: "snap-1",
    sourceRateId: "rate-1",
    category: "LABOUR",
    name: "Excavator operator",
    class: null,
    unit: "hr",
    ordinary: new Decimal("45.00"),
    oneAndHalf: new Decimal("67.50"),
    double: new Decimal("90.00"),
    isReference: false,
    comments: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  agreedRecord: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  agreedRecordLine: {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  agreedRecordPricingLine: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockSnapshots = {
  getLockedRate: jest.fn(),
};

const mockEmail = {
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AgreedRecordReviewService", () => {
  let service: AgreedRecordReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgreedRecordReviewService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JobSorSnapshotService, useValue: mockSnapshots },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AgreedRecordReviewService>(AgreedRecordReviewService);
    jest.clearAllMocks();
  });

  // ── (a) take-review fires the WHS&CC trigger ─────────────────────────────

  describe("takeReview — fires WHS&CC notification", () => {
    it("(a) transitions SUBMITTED -> OFFICE_REVIEW and fires agreed_record.submitted trigger", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.SUBMITTED });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecord.update.mockResolvedValue({
        ...ar,
        status: AgreedRecordStatus.OFFICE_REVIEW,
        reviewerId: "user-reviewer",
      });

      await service.takeReview("ar-1", "user-reviewer");

      expect(mockPrisma.agreedRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "ar-1" },
          data: expect.objectContaining({
            status: AgreedRecordStatus.OFFICE_REVIEW,
            reviewerId: "user-reviewer",
          }),
        }),
      );

      // Notification is fire-and-forget; give it a tick to settle.
      await Promise.resolve();
      expect(mockEmail.sendNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: "agreed_record.submitted" }),
      );
    });

    it("(a) throws BadRequestException when AR is not in SUBMITTED status", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.DRAFT });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);

      await expect(service.takeReview("ar-1", "user-reviewer")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── (b) pricing reads FROZEN snapshot rate, not live SorRate ─────────────

  describe("priceLine — reads frozen snapshot rate", () => {
    it("(b) reads from JobSorSnapshotRate (frozen) and does NOT query live SorRate", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.OFFICE_REVIEW, jobSorSnapshotId: "snap-1" });
      const line = {
        id: "line-1",
        agreedRecordId: "ar-1",
        quantity: new Decimal("8"),
        tier: "ORDINARY",
      };
      const snapshotRate = makeSnapshotRate();

      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordLine.findUnique.mockResolvedValue(line);
      mockSnapshots.getLockedRate.mockResolvedValue(snapshotRate);
      mockPrisma.agreedRecordPricingLine.upsert.mockResolvedValue(makePricingLine());

      await service.priceLine("ar-1", "line-1", { snapshotRateId: "sr-1", tier: "ORDINARY" }, "user-pricer");

      // Must call getLockedRate (frozen) — must NOT call anything like sorRate.findUnique.
      expect(mockSnapshots.getLockedRate).toHaveBeenCalledWith("snap-1", "sr-1");
      expect(mockPrisma.agreedRecordPricingLine.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            rate: snapshotRate.ordinary,
            lineAmount: snapshotRate.ordinary.mul(line.quantity),
          }),
        }),
      );
    });

    it("(b) manual override with explicit rate stamps snapshotRateId = null", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.OFFICE_REVIEW, jobSorSnapshotId: "snap-1" });
      const line = {
        id: "line-1",
        agreedRecordId: "ar-1",
        quantity: new Decimal("4"),
        tier: "ORDINARY",
      };

      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordLine.findUnique.mockResolvedValue(line);
      mockPrisma.agreedRecordPricingLine.upsert.mockResolvedValue(makePricingLine({
        snapshotRateId: null,
        rate: new Decimal("50.00"),
        lineAmount: new Decimal("200.00"),
      }));

      await service.priceLine("ar-1", "line-1", { snapshotRateId: null, tier: "ORDINARY", rate: 50 }, "user-pricer");

      expect(mockSnapshots.getLockedRate).not.toHaveBeenCalled();
      expect(mockPrisma.agreedRecordPricingLine.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ snapshotRateId: null }),
        }),
      );
    });

    it("(b) manual override without rate throws BadRequestException", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.OFFICE_REVIEW, jobSorSnapshotId: "snap-1" });
      const line = { id: "line-1", agreedRecordId: "ar-1", quantity: new Decimal("4"), tier: "ORDINARY" };
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordLine.findUnique.mockResolvedValue(line);

      await expect(
        service.priceLine("ar-1", "line-1", { snapshotRateId: null, tier: "ORDINARY" }, "user-pricer"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── (c) finalise-pricing fires the Ops trigger ────────────────────────────

  describe("finalisePricing — fires Ops notification", () => {
    it("(c) transitions OFFICE_REVIEW -> PRICED and fires agreed_record.priced_awaiting_ops trigger", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.OFFICE_REVIEW });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordLine.count.mockResolvedValue(2);
      mockPrisma.agreedRecordPricingLine.count.mockResolvedValue(2);
      mockPrisma.agreedRecordPricingLine.findMany.mockResolvedValue([
        { lineAmount: new Decimal("360.00") },
        { lineAmount: new Decimal("120.00") },
      ]);
      mockPrisma.agreedRecord.update.mockResolvedValue({
        ...ar,
        status: AgreedRecordStatus.PRICED,
        totalPricedAmount: new Decimal("480.00"),
      });

      await service.finalisePricing("ar-1");

      expect(mockPrisma.agreedRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AgreedRecordStatus.PRICED,
          }),
        }),
      );

      await Promise.resolve();
      expect(mockEmail.sendNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: "agreed_record.priced_awaiting_ops" }),
      );
    });

    it("(c) throws when not all lines are priced", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.OFFICE_REVIEW });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordLine.count.mockResolvedValue(3);
      mockPrisma.agreedRecordPricingLine.count.mockResolvedValue(2);

      await expect(service.finalisePricing("ar-1")).rejects.toThrow(BadRequestException);
    });
  });

  // ── (d) approve rejects when approvedById == pricedById ──────────────────

  describe("approve — rejects same-person approval", () => {
    it("(d) throws ForbiddenException when approver priced any line", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.PRICED });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      // Pricing lines all priced by "user-pricer"
      mockPrisma.agreedRecordPricingLine.findMany.mockResolvedValue([
        { pricedById: "user-pricer" },
        { pricedById: "user-pricer" },
      ]);

      // Same user tries to approve
      await expect(service.approve("ar-1", "user-pricer")).rejects.toThrow(ForbiddenException);
    });

    it("(d) allows approval by a different user", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.PRICED });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecordPricingLine.findMany.mockResolvedValue([
        { pricedById: "user-pricer" },
      ]);
      mockPrisma.agreedRecord.update.mockResolvedValue({
        ...ar,
        status: AgreedRecordStatus.APPROVED,
        approvedById: "user-ops",
      });

      const result = await service.approve("ar-1", "user-ops");
      expect(result.status).toBe(AgreedRecordStatus.APPROVED);
    });

    it("(d) throws BadRequestException when AR is not in PRICED status", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.OFFICE_REVIEW });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);

      await expect(service.approve("ar-1", "user-ops")).rejects.toThrow(BadRequestException);
    });
  });

  // ── (e) send-back stamps reason and transitions to SENT_BACK ─────────────

  describe("sendBack — stamps reason", () => {
    it("(e) transitions OFFICE_REVIEW -> SENT_BACK and stamps sentBackReason", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.OFFICE_REVIEW });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecord.update.mockResolvedValue({
        ...ar,
        status: AgreedRecordStatus.SENT_BACK,
        sentBackReason: "Missing tool class on line 2",
      });

      const result = await service.sendBack("ar-1", { reason: "Missing tool class on line 2" });
      expect(result.status).toBe(AgreedRecordStatus.SENT_BACK);
      expect(mockPrisma.agreedRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AgreedRecordStatus.SENT_BACK,
            sentBackReason: "Missing tool class on line 2",
          }),
        }),
      );
    });

    it("(e) also allows send-back from PRICED state", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.PRICED });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);
      mockPrisma.agreedRecord.update.mockResolvedValue({
        ...ar,
        status: AgreedRecordStatus.SENT_BACK,
        sentBackReason: "Quantity error on line 1",
      });

      await service.sendBack("ar-1", { reason: "Quantity error on line 1" });
      expect(mockPrisma.agreedRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AgreedRecordStatus.SENT_BACK }),
        }),
      );
    });

    it("(e) throws BadRequestException when reason is empty", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.OFFICE_REVIEW });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);

      await expect(service.sendBack("ar-1", { reason: "   " })).rejects.toThrow(BadRequestException);
    });

    it("(e) throws BadRequestException when AR is not in an office state", async () => {
      const ar = makeAr({ status: AgreedRecordStatus.SUBMITTED });
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(ar);

      await expect(service.sendBack("ar-1", { reason: "some reason" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("(e) throws NotFoundException when AR does not exist", async () => {
      mockPrisma.agreedRecord.findUnique.mockResolvedValue(null);

      await expect(service.sendBack("ar-missing", { reason: "reason" })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
