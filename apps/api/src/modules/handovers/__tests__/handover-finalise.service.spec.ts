// B-HW-11 unit tests for HandoverFinaliseService.
//
// Covers:
//  1. Happy path — 100% handover: creates job, freezes handover, snapshots baseline.
//  2. <100% completionPct — throws BadRequestException.
//  3. Already-finalised handover — idempotent no-op (returns alreadyFinalised=true).
//  4. Subcontractor folder scaffolding — one ensureFolder call per subbie.
//  5. Handover not found — throws NotFoundException.
//  6. Contract/project not found — throws appropriate error.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { HandoverFinaliseService } from "../handover-finalise.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { JobsService } from "../../jobs/jobs.service";
import { SharePointService } from "../../platform/sharepoint.service";
import { HandoverSubcontractorsService } from "../handover-subcontractors.service";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const HANDOVER_DRAFT = {
  id: "hw-1",
  contractId: "contract-1",
  tenderId: "tender-1",
  templateVersionId: "tpl-v1",
  status: "draft",
  completionPct: 100,
  createdById: "user-1",
  finalisedAt: null,
  values: [
    { fieldKey: "contract-value", value: 250000, isOverridden: false, sourceValue: 250000 }
  ]
};

const HANDOVER_INCOMPLETE = {
  ...HANDOVER_DRAFT,
  completionPct: 60
};

const HANDOVER_FINALISED = {
  ...HANDOVER_DRAFT,
  status: "finalised",
  finalisedAt: new Date("2026-09-01T10:00:00Z")
};

const CONTRACT_WITH_PROJECT = {
  id: "contract-1",
  projectId: "project-1",
  project: {
    id: "project-1",
    name: "Kings Beach Retaining Wall",
    sourceTenderId: "tender-1"
  }
};

const CREATED_JOB = {
  id: "job-1",
  jobNumber: "J260901-KBR-001",
  name: "Kings Beach Retaining Wall",
  status: "PLANNING"
};

const SUBBIES = [
  { id: "sub-1", handoverId: "hw-1", name: "Concrete Pty Ltd", folderSlot: "concrete", quoteRef: "Q-001", poRef: null, hasGap: false, createdAt: new Date(), updatedAt: new Date() },
  { id: "sub-2", handoverId: "hw-1", name: "Steel Co", folderSlot: "steel", quoteRef: null, poRef: "PO-042", hasGap: false, createdAt: new Date(), updatedAt: new Date() }
];

const JOB_FOLDER_LINK = {
  id: "fl-1",
  relativePath: "Project Operations/Jobs/J260901-KBR-001_Kings Beach Retaining Wall"
};

// ─── Mock builders ────────────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    handover: {
      findUnique: jest.fn().mockResolvedValue(HANDOVER_DRAFT),
      update: jest.fn().mockResolvedValue({ ...HANDOVER_DRAFT, status: "finalised", finalisedAt: new Date() })
    },
    contract: {
      findUnique: jest.fn().mockResolvedValue(CONTRACT_WITH_PROJECT)
    },
    job: {
      findFirst: jest.fn().mockResolvedValue(CREATED_JOB)
    },
    sharePointFolderLink: {
      findFirst: jest.fn().mockResolvedValue(JOB_FOLDER_LINK)
    },
    scopeOfWorksItem: {
      findMany: jest.fn().mockResolvedValue([])
    },
    documentLink: {
      create: jest.fn().mockResolvedValue({ id: "dl-1" })
    },
    ...overrides
  } as unknown as PrismaService;
}

function makeAuditService(): AuditService {
  return {
    write: jest.fn().mockResolvedValue({ id: "audit-1" })
  } as unknown as AuditService;
}

function makeJobsService(): JobsService {
  return {
    convertTenderToJob: jest.fn().mockResolvedValue(CREATED_JOB)
  } as unknown as JobsService;
}

function makeSharePointService(): SharePointService {
  return {
    ensureFolder: jest.fn().mockResolvedValue({ id: "fl-sub-1" })
  } as unknown as SharePointService;
}

function makeSubcontractorsService(subbies = SUBBIES): HandoverSubcontractorsService {
  return {
    list: jest.fn().mockResolvedValue(subbies)
  } as unknown as HandoverSubcontractorsService;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HandoverFinaliseService", () => {
  let service: HandoverFinaliseService;
  let prisma: PrismaService;
  let auditService: AuditService;
  let jobsService: JobsService;
  let sharePointService: SharePointService;
  let subcontractorsService: HandoverSubcontractorsService;

  async function buildService(prismaOverrides: Record<string, unknown> = {}, subbies = SUBBIES) {
    prisma = makePrisma(prismaOverrides);
    auditService = makeAuditService();
    jobsService = makeJobsService();
    sharePointService = makeSharePointService();
    subcontractorsService = makeSubcontractorsService(subbies);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoverFinaliseService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: JobsService, useValue: jobsService },
        { provide: SharePointService, useValue: sharePointService },
        { provide: HandoverSubcontractorsService, useValue: subcontractorsService }
      ]
    }).compile();

    service = module.get<HandoverFinaliseService>(HandoverFinaliseService);
  }

  // ── 1. Happy path ──────────────────────────────────────────────────────────

  describe("finalise — happy path", () => {
    it("calls convertTenderToJob with the project name when jobName is not supplied", async () => {
      await buildService();

      const result = await service.finalise("hw-1", {}, "user-1");

      expect(jobsService.convertTenderToJob).toHaveBeenCalledWith(
        "tender-1",
        expect.objectContaining({ name: "Kings Beach Retaining Wall" }),
        "user-1"
      );
      expect(result.jobId).toBe("job-1");
      expect(result.jobNumber).toBe("J260901-KBR-001");
      expect(result.alreadyFinalised).toBe(false);
    });

    it("calls convertTenderToJob with dto.jobName when supplied", async () => {
      await buildService();

      await service.finalise("hw-1", { jobName: "Custom Job Name" }, "user-1");

      expect(jobsService.convertTenderToJob).toHaveBeenCalledWith(
        "tender-1",
        expect.objectContaining({ name: "Custom Job Name" }),
        "user-1"
      );
    });

    it("freezes the handover (status=finalised, finalisedAt set)", async () => {
      await buildService();

      await service.finalise("hw-1", {}, "user-1");

      expect(prisma.handover.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "hw-1" },
          data: expect.objectContaining({
            status: "finalised",
            finalisedAt: expect.any(Date)
          })
        })
      );
    });

    it("writes a baseline snapshot to the audit log", async () => {
      await buildService();

      await service.finalise("hw-1", {}, "user-1");

      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "handover.finalise.baseline",
          entityType: "Handover",
          entityId: "hw-1",
          metadata: expect.objectContaining({
            jobId: "job-1",
            handoverId: "hw-1",
            tenderId: "tender-1"
          })
        })
      );
    });

    it("creates a handover PDF document-link stub", async () => {
      await buildService();

      await service.finalise("hw-1", {}, "user-1");

      expect(prisma.documentLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linkedEntityType: "Job",
            linkedEntityId: "job-1",
            category: "CONTRACT",
            title: "Contract Handover Document"
          })
        })
      );
    });

    it("passes carryTenderDocuments to convertTenderToJob when set", async () => {
      await buildService();

      await service.finalise("hw-1", { carryTenderDocuments: true }, "user-1");

      expect(jobsService.convertTenderToJob).toHaveBeenCalledWith(
        "tender-1",
        expect.objectContaining({ carryTenderDocuments: true }),
        "user-1"
      );
    });
  });

  // ── 2. Blocked when < 100% ─────────────────────────────────────────────────

  describe("finalise — completeness guard", () => {
    it("throws BadRequestException when completionPct < 100", async () => {
      await buildService({
        handover: {
          findUnique: jest.fn().mockResolvedValue(HANDOVER_INCOMPLETE),
          update: jest.fn()
        }
      });

      await expect(service.finalise("hw-1", {}, "user-1")).rejects.toThrow(BadRequestException);
    });

    it("does not call convertTenderToJob when completionPct < 100", async () => {
      await buildService({
        handover: {
          findUnique: jest.fn().mockResolvedValue(HANDOVER_INCOMPLETE),
          update: jest.fn()
        }
      });

      await expect(service.finalise("hw-1", {}, "user-1")).rejects.toThrow();
      expect(jobsService.convertTenderToJob).not.toHaveBeenCalled();
    });
  });

  // ── 3. Idempotent second call ──────────────────────────────────────────────

  describe("finalise — idempotency", () => {
    it("returns alreadyFinalised=true without calling convertTenderToJob when already finalised", async () => {
      await buildService({
        handover: {
          findUnique: jest.fn().mockResolvedValue(HANDOVER_FINALISED),
          update: jest.fn()
        }
      });

      const result = await service.finalise("hw-1", {}, "user-1");

      expect(result.alreadyFinalised).toBe(true);
      expect(jobsService.convertTenderToJob).not.toHaveBeenCalled();
      expect(prisma.handover.update).not.toHaveBeenCalled();
    });

    it("does not freeze or snapshot when already finalised", async () => {
      await buildService({
        handover: {
          findUnique: jest.fn().mockResolvedValue(HANDOVER_FINALISED),
          update: jest.fn()
        }
      });

      await service.finalise("hw-1", {}, "user-1");

      expect(prisma.handover.update).not.toHaveBeenCalled();
      expect(auditService.write).not.toHaveBeenCalled();
    });
  });

  // ── 4. Subcontractor folder scaffolding ───────────────────────────────────

  describe("finalise — subcontractor folder scaffolding", () => {
    it("calls ensureFolder once per engaged subcontractor", async () => {
      await buildService();

      await service.finalise("hw-1", {}, "user-1");

      // Two subbies → two ensureFolder calls.
      expect(sharePointService.ensureFolder).toHaveBeenCalledTimes(2);
    });

    it("includes the folderSlot in the ensureFolder relativePath", async () => {
      await buildService();

      await service.finalise("hw-1", {}, "user-1");

      const calls = (sharePointService.ensureFolder as jest.Mock).mock.calls;
      const paths = calls.map((call: [{ relativePath: string }]) => call[0].relativePath);

      expect(paths.some((p: string) => p.includes("concrete"))).toBe(true);
      expect(paths.some((p: string) => p.includes("steel"))).toBe(true);
    });

    it("skips folder scaffolding when there are no subcontractors", async () => {
      await buildService({}, []); // empty subbies list

      await service.finalise("hw-1", {}, "user-1");

      expect(sharePointService.ensureFolder).not.toHaveBeenCalled();
    });

    it("skips scaffolding and logs a warning when no job folder link exists", async () => {
      await buildService({
        sharePointFolderLink: {
          findFirst: jest.fn().mockResolvedValue(null)
        }
      });

      // Should NOT throw — it logs and continues.
      await expect(service.finalise("hw-1", {}, "user-1")).resolves.toBeDefined();
      expect(sharePointService.ensureFolder).not.toHaveBeenCalled();
    });
  });

  // ── 5. Not found ──────────────────────────────────────────────────────────

  describe("finalise — not found", () => {
    it("throws NotFoundException when handover does not exist", async () => {
      await buildService({
        handover: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn()
        }
      });

      await expect(service.finalise("missing-hw", {}, "user-1")).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the handover's contract does not exist", async () => {
      await buildService({
        contract: {
          findUnique: jest.fn().mockResolvedValue(null)
        }
      });

      await expect(service.finalise("hw-1", {}, "user-1")).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when the contract has no linked project", async () => {
      await buildService({
        contract: {
          findUnique: jest.fn().mockResolvedValue({ ...CONTRACT_WITH_PROJECT, project: null })
        }
      });

      await expect(service.finalise("hw-1", {}, "user-1")).rejects.toThrow(BadRequestException);
    });
  });
});
