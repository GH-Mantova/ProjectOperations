import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AgreedRecordStatus, ClaimStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  AgreedRecordRegisterService,
  CLAIM_READY_TRIGGER,
} from "../agreed-record-register.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { ContractsService } from "../../contracts/contracts.service";
import { EmailService } from "../../email/email.service";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeVariation(overrides: Record<string, unknown> = {}) {
  return {
    id: "var-1",
    variationNumber: "VAR-001",
    description: "Extra excavation",
    status: "APPROVED",
    approvedAmount: new Decimal("1000.00"),
    pricedAmount: new Decimal("1000.00"),
    createdAt: new Date("2026-09-02"),
    sorLines: [{ sorVersion: "2026-H1-v3" }],
    ...overrides,
  };
}

function makeAr(overrides: Record<string, unknown> = {}) {
  return {
    id: "ar-1",
    recordNumber: "AR-000001",
    description: "Dayworks — traffic control",
    status: AgreedRecordStatus.APPROVED,
    sorVersion: "2026-H1-v3",
    totalPricedAmount: new Decimal("500.00"),
    workerSignaturePath: "/sigs/worker.png",
    clientRepSignaturePath: "/sigs/client.png",
    createdAt: new Date("2026-09-03"),
    ...overrides,
  };
}

// ── Mocks ───────────────────────────────────────────────────────────────────

// Records the order of the side effects we care about, so "the trigger fires
// AFTER the claim is written" is asserted as an ORDERING, not merely as
// "both happened".
let callOrder: string[] = [];

const mockPrisma = {
  job: { findUnique: jest.fn() },
  variation: { findMany: jest.fn() },
  agreedRecord: { findMany: jest.fn() },
  progressClaim: { findFirst: jest.fn(), update: jest.fn() },
  claimLineItem: { findFirst: jest.fn(), findMany: jest.fn(), createMany: jest.fn() },
};

const mockContracts = { createClaim: jest.fn() };
const mockEmail = { sendNotificationEmail: jest.fn() };

/** A job linked through survivingProject -> contract. */
function jobWithContract(contractId: string | null = "contract-1") {
  return {
    id: "job-1",
    survivingProject: { contract: contractId ? { id: contractId } : null },
  };
}

describe("AgreedRecordRegisterService", () => {
  let service: AgreedRecordRegisterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgreedRecordRegisterService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ContractsService, useValue: mockContracts },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AgreedRecordRegisterService>(AgreedRecordRegisterService);
    jest.clearAllMocks();
    callOrder = [];

    mockPrisma.claimLineItem.createMany.mockImplementation(async () => {
      callOrder.push("claim-lines-written");
      return { count: 0 };
    });
    mockPrisma.progressClaim.update.mockImplementation(async () => {
      callOrder.push("claim-total-updated");
      return {};
    });
    mockEmail.sendNotificationEmail.mockImplementation(async () => {
      callOrder.push("director-notified");
    });
    mockPrisma.claimLineItem.findFirst.mockResolvedValue({ sortOrder: 4 });
    mockPrisma.claimLineItem.findMany.mockResolvedValue([
      { thisClaimAmount: new Decimal("1000.00") },
      { thisClaimAmount: new Decimal("500.00") },
    ]);
  });

  // ── (a) the register merges VC + AR rows for a job ────────────────────────

  describe("getRegisterForJob", () => {
    it("(a) merges VC and AR rows for the job, each carrying its SoR version", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(jobWithContract());
      mockPrisma.variation.findMany.mockResolvedValue([makeVariation()]);
      mockPrisma.agreedRecord.findMany.mockResolvedValue([makeAr()]);

      const result = await service.getRegisterForJob("job-1");

      expect(result.jobId).toBe("job-1");
      expect(result.contractId).toBe("contract-1");
      expect(result.variations).toHaveLength(1);
      expect(result.agreedRecords).toHaveLength(1);

      // Full-shape assertion — toStrictEqual, so an accidentally-undefined
      // property is a failure rather than an invisible pass.
      expect(result.variations[0]).toStrictEqual({
        kind: "VARIATION",
        id: "var-1",
        number: "VAR-001",
        description: "Extra excavation",
        status: "APPROVED",
        sorVersion: "2026-H1-v3",
        amount: "1000.00",
        isEligible: true,
        createdAt: new Date("2026-09-02"),
      });
      expect(result.agreedRecords[0]).toStrictEqual({
        kind: "AGREED_RECORD",
        id: "ar-1",
        number: "AR-000001",
        description: "Dayworks — traffic control",
        status: AgreedRecordStatus.APPROVED,
        sorVersion: "2026-H1-v3",
        amount: "500.00",
        workerSigned: true,
        clientRepSigned: true,
        isEligible: true,
        createdAt: new Date("2026-09-03"),
      });

      // The VC half is scoped to the job's contract, the AR half to the job.
      expect(mockPrisma.variation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contractId: "contract-1" } }),
      );
      expect(mockPrisma.agreedRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { jobId: "job-1" } }),
      );
    });

    it("(a2) still returns the AR half when the job has no linked contract", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(jobWithContract(null));
      mockPrisma.agreedRecord.findMany.mockResolvedValue([makeAr()]);

      const result = await service.getRegisterForJob("job-1");

      expect(result.contractId).toBeNull();
      expect(result.variations).toStrictEqual([]);
      expect(result.agreedRecords).toHaveLength(1);
      expect(mockPrisma.variation.findMany).not.toHaveBeenCalled();
    });

    it("(a3) throws when the job does not exist", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);
      await expect(service.getRegisterForJob("nope")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── (b) eligible-for-claim filters unapproved / unsigned items out ────────

  describe("getEligibleForClaim", () => {
    it("(b) drops unpriced VCs and AR rows that are unapproved or missing a signature", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(jobWithContract());
      mockPrisma.variation.findMany.mockResolvedValue([
        makeVariation({ id: "var-ok" }),
        // Approved status but never given an approved amount — not claimable.
        makeVariation({ id: "var-no-amount", approvedAmount: null }),
      ]);
      mockPrisma.agreedRecord.findMany.mockResolvedValue([
        makeAr({ id: "ar-ok" }),
        makeAr({ id: "ar-draft", status: AgreedRecordStatus.DRAFT }),
        makeAr({ id: "ar-submitted", status: AgreedRecordStatus.SUBMITTED }),
        makeAr({ id: "ar-no-worker-sig", workerSignaturePath: null }),
        makeAr({ id: "ar-no-client-sig", clientRepSignaturePath: null }),
      ]);

      const result = await service.getEligibleForClaim("job-1");

      expect(result.variations.map((v) => v.id)).toStrictEqual(["var-ok"]);
      expect(result.agreedRecords.map((a) => a.id)).toStrictEqual(["ar-ok"]);
    });
  });

  // ── (c) raise-claim writes the right FK on each line ──────────────────────

  describe("raiseClaim", () => {
    beforeEach(() => {
      mockPrisma.job.findUnique.mockResolvedValue(jobWithContract());
      mockPrisma.variation.findMany.mockResolvedValue([makeVariation()]);
      mockPrisma.agreedRecord.findMany.mockResolvedValue([makeAr()]);
      mockPrisma.progressClaim.findFirst.mockResolvedValue(null);
      mockContracts.createClaim.mockResolvedValue({ id: "claim-1", lineItems: [] });
    });

    it("(c) writes agreedRecordId on AR lines and variationId on VC lines", async () => {
      const result = await service.raiseClaim("job-1", "user-1", {
        claimMonth: "2026-09-15",
        variationIds: ["var-1"],
        agreedRecordIds: ["ar-1"],
      });

      expect(mockPrisma.claimLineItem.createMany).toHaveBeenCalledTimes(1);
      const written = mockPrisma.claimLineItem.createMany.mock.calls[0][0].data as Record<
        string,
        unknown
      >[];
      expect(written).toHaveLength(2);

      const vcLine = written.find((l) => l.variationId === "var-1");
      const arLine = written.find((l) => l.agreedRecordId === "ar-1");

      // Key PRESENCE is asserted explicitly — a missing FK must not slip
      // through as `undefined`.
      expect(vcLine).toBeDefined();
      expect(Object.keys(vcLine as object)).toContain("variationId");
      expect(vcLine).toStrictEqual({
        claimId: "claim-1",
        discipline: "Variation",
        description: "VAR VAR-001 — Extra excavation",
        contractValue: new Decimal("1000.00"),
        previouslyClaimed: new Decimal(0),
        thisClaimPct: new Decimal(100),
        thisClaimAmount: new Decimal("1000.00"),
        variationId: "var-1",
        sortOrder: 5,
      });

      expect(arLine).toBeDefined();
      expect(Object.keys(arLine as object)).toContain("agreedRecordId");
      expect(arLine).toStrictEqual({
        claimId: "claim-1",
        discipline: "Agreed Record",
        description: "AR AR-000001 — Dayworks — traffic control",
        contractValue: new Decimal("500.00"),
        previouslyClaimed: new Decimal(0),
        thisClaimPct: new Decimal(100),
        thisClaimAmount: new Decimal("500.00"),
        agreedRecordId: "ar-1",
        sortOrder: 6,
      });

      // The VC line must NOT carry an AR id, and vice versa.
      expect(Object.keys(vcLine as object)).not.toContain("agreedRecordId");
      expect(Object.keys(arLine as object)).not.toContain("variationId");

      expect(result.linesAdded).toBe(2);
      expect(result.variationLinesAdded).toBe(1);
      expect(result.agreedRecordLinesAdded).toBe(1);
      expect(result.createdClaim).toBe(true);
    });

    it("(c2) does not duplicate a VC that createClaim already put on the claim", async () => {
      mockContracts.createClaim.mockResolvedValue({
        id: "claim-1",
        lineItems: [{ variationId: "var-1", agreedRecordId: null }],
      });

      const result = await service.raiseClaim("job-1", "user-1", {
        claimMonth: "2026-09-15",
        variationIds: ["var-1"],
        agreedRecordIds: ["ar-1"],
      });

      const written = mockPrisma.claimLineItem.createMany.mock.calls[0][0].data as Record<
        string,
        unknown
      >[];
      expect(written).toHaveLength(1);
      expect(written[0].agreedRecordId).toBe("ar-1");
      expect(result.variationLinesAdded).toBe(0);
    });

    it("(c3) filters unapproved items out at the query, and reports them as skipped", async () => {
      // The query returns only the approved AR; the requested VC is not
      // approved, so it never comes back.
      mockPrisma.variation.findMany.mockResolvedValue([]);
      mockPrisma.agreedRecord.findMany.mockResolvedValue([makeAr()]);

      const result = await service.raiseClaim("job-1", "user-1", {
        claimMonth: "2026-09-15",
        variationIds: ["var-unapproved"],
        agreedRecordIds: ["ar-1"],
      });

      expect(result.skipped).toStrictEqual(["var-unapproved"]);
      expect(mockPrisma.variation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ approvedAmount: { not: null } }),
        }),
      );
      expect(mockPrisma.agreedRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: AgreedRecordStatus.APPROVED,
            workerSignaturePath: { not: null },
            clientRepSignaturePath: { not: null },
          }),
        }),
      );
    });

    it("(c4) rejects when nothing selected survives the approval filter", async () => {
      mockPrisma.variation.findMany.mockResolvedValue([]);
      mockPrisma.agreedRecord.findMany.mockResolvedValue([]);

      await expect(
        service.raiseClaim("job-1", "user-1", {
          claimMonth: "2026-09-15",
          variationIds: ["var-x"],
          agreedRecordIds: ["ar-x"],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockPrisma.claimLineItem.createMany).not.toHaveBeenCalled();
      expect(mockEmail.sendNotificationEmail).not.toHaveBeenCalled();
    });

    it("(c5) appends to the existing DRAFT claim for the month instead of creating a second one", async () => {
      mockPrisma.progressClaim.findFirst.mockResolvedValue({
        id: "claim-existing",
        status: ClaimStatus.DRAFT,
        lineItems: [],
      });

      const result = await service.raiseClaim("job-1", "user-1", {
        claimMonth: "2026-09-15",
        variationIds: ["var-1"],
        agreedRecordIds: ["ar-1"],
      });

      expect(mockContracts.createClaim).not.toHaveBeenCalled();
      expect(result.claimId).toBe("claim-existing");
      expect(result.createdClaim).toBe(false);
      // The month is normalised to UTC start-of-month before the lookup.
      expect(mockPrisma.progressClaim.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId: "contract-1", claimMonth: new Date("2026-09-01T00:00:00.000Z") },
        }),
      );
    });

    it("(c6) refuses to add items to a claim that is no longer a draft", async () => {
      mockPrisma.progressClaim.findFirst.mockResolvedValue({
        id: "claim-submitted",
        status: ClaimStatus.SUBMITTED,
        lineItems: [],
      });

      await expect(
        service.raiseClaim("job-1", "user-1", {
          claimMonth: "2026-09-15",
          variationIds: ["var-1"],
          agreedRecordIds: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockPrisma.claimLineItem.createMany).not.toHaveBeenCalled();
    });

    it("(c7) rejects a job with no linked contract before touching any claim", async () => {
      mockPrisma.job.findUnique.mockResolvedValue(jobWithContract(null));

      await expect(
        service.raiseClaim("job-1", "user-1", {
          claimMonth: "2026-09-15",
          variationIds: ["var-1"],
          agreedRecordIds: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockContracts.createClaim).not.toHaveBeenCalled();
      expect(mockPrisma.claimLineItem.createMany).not.toHaveBeenCalled();
    });

    // ── (d) the Director trigger fires AFTER the claim write ───────────────

    it("(d) fires progress_claim.ready_for_director AFTER the claim is written, not before", async () => {
      await service.raiseClaim("job-1", "user-1", {
        claimMonth: "2026-09-15",
        variationIds: ["var-1"],
        agreedRecordIds: ["ar-1"],
      });

      // Let the fire-and-forget notification settle.
      await Promise.resolve();

      expect(mockEmail.sendNotificationEmail).toHaveBeenCalledTimes(1);
      expect(mockEmail.sendNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: CLAIM_READY_TRIGGER }),
      );

      // The ordering IS the assertion: lines written, total updated, then notify.
      expect(callOrder).toStrictEqual([
        "claim-lines-written",
        "claim-total-updated",
        "director-notified",
      ]);
      expect(callOrder.indexOf("director-notified")).toBeGreaterThan(
        callOrder.indexOf("claim-lines-written"),
      );
    });

    it("(d2) a failing notification does not fail the already-written claim", async () => {
      mockEmail.sendNotificationEmail.mockRejectedValue(new Error("smtp down"));

      const result = await service.raiseClaim("job-1", "user-1", {
        claimMonth: "2026-09-15",
        variationIds: ["var-1"],
        agreedRecordIds: ["ar-1"],
      });

      await Promise.resolve();
      expect(result.claimId).toBe("claim-1");
      expect(result.linesAdded).toBe(2);
    });
  });
});
