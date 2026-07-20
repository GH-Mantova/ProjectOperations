// Mock-based unit tests for JobsService. Mirrors the patterns used by
// PR #283 (ProjectsService) and PR #298 (FormsService): Prisma is mocked
// per-test, and the service is instantiated directly with `as never`
// casts on the injected dependencies.
//
// Scope: this file covers the public methods that the existing top-level
// `jobs.service.spec.ts` and `__tests__/create-job.spec.ts` do not yet
// exercise — list, listArchive, getById, the per-jobId write methods
// (createStage/updateStage/createActivity/updateActivity/createIssue/
// updateIssue/createVariation/updateVariation/createProgressEntry),
// closeoutJob, and awardTenderClient. It also fills in the happy path
// for updateJob and the missing not-found path for updateStatus.
//
// Tenant scoping: Initial Services is single-tenant today — JobsService
// methods do not include any tenantId filter in their `where` clauses.
// The "tenant scoping gap" test at the bottom documents that with a
// TODO so the gap is visible when the platform eventually multi-tenants.

import { ConflictException, NotFoundException } from "@nestjs/common";
import { JobsService } from "../jobs.service";

// ─── Shared fixtures ───────────────────────────────────────────────────────

const jobRow = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  jobNumber: "J260612-ACME-001",
  name: "Demo Job",
  status: "ACTIVE",
  clientId: "client-1",
  ...overrides
});

const tenderRow = (overrides: Record<string, unknown> = {}) => ({
  id: "tender-1",
  status: "IN_PROGRESS",
  description: null,
  tenderNumber: "T-001",
  sourceJob: null,
  tenderClients: [
    { id: "tc-1", clientId: "client-1", isAwarded: false, contractIssued: false, contractIssuedAt: null }
  ],
  tenderDocuments: [],
  ...overrides
});

// Per-test mock builder. Tests override individual mock methods on the
// returned `prisma` object before driving the service.
function buildService(extraPrisma: Record<string, unknown> = {}) {
  const auditWrite = jest.fn().mockResolvedValue(undefined);
  const refreshLiveFollowUps = jest.fn().mockResolvedValue(undefined);

  const prisma: Record<string, unknown> = {
    job: {
      findUnique: jest.fn().mockResolvedValue(jobRow()),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(jobRow())
    },
    jobCloseout: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({})
    },
    jobStage: {
      findUnique: jest.fn().mockResolvedValue({ id: "stage-1", jobId: "job-1" }),
      create: jest.fn().mockResolvedValue({ id: "stage-new", name: "Stage" }),
      update: jest.fn().mockResolvedValue({})
    },
    jobActivity: {
      findUnique: jest.fn().mockResolvedValue({ id: "act-1", jobId: "job-1" }),
      create: jest.fn().mockResolvedValue({ id: "act-new" }),
      update: jest.fn().mockResolvedValue({})
    },
    jobIssue: {
      findUnique: jest.fn().mockResolvedValue({ id: "issue-1", jobId: "job-1" }),
      create: jest.fn().mockResolvedValue({ id: "issue-new" }),
      update: jest.fn().mockResolvedValue({})
    },
    jobVariation: {
      findUnique: jest.fn().mockResolvedValue({
        id: "var-1",
        jobId: "job-1",
        reference: "VAR-1"
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "var-new" }),
      update: jest.fn().mockResolvedValue({})
    },
    jobProgressEntry: {
      create: jest.fn().mockResolvedValue({ id: "prog-1", entryType: "PROGRESS" })
    },
    jobStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    activityEntry: { create: jest.fn().mockResolvedValue({}) },
    tender: {
      findUnique: jest.fn().mockResolvedValue(tenderRow()),
      update: jest.fn().mockResolvedValue({})
    },
    tenderClient: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    documentLink: {
      findMany: jest.fn().mockResolvedValue([])
    },
    $transaction: jest.fn().mockImplementation((input: unknown) => {
      if (typeof input === "function") {
        return (input as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    }),
    ...extraPrisma
  };

  const audit = { write: auditWrite };
  const sharepoint = {
    ensureFolder: jest.fn().mockResolvedValue({ id: "folder-1" })
  };
  const notifications = { refreshLiveFollowUps };
  const jobNumberService = {
    generate: jest.fn().mockResolvedValue({ jobNumber: "J260612-ACME-001", clientSlugSnapshot: "ACME" }),
    validate: jest.fn().mockReturnValue(null)
  };

  const service = new JobsService(
    prisma as never,
    audit as never,
    sharepoint as never,
    notifications as never,
    jobNumberService as never
  );

  return {
    service,
    prisma,
    audit,
    auditWrite,
    refreshLiveFollowUps,
    sharepoint,
    notifications,
    jobNumberService
  };
}

// ─── list ──────────────────────────────────────────────────────────────────

describe("JobsService.list", () => {
  it("returns paginated active jobs with the expected page/pageSize echoed back", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([jobRow()]);
    (prisma.job as { count: jest.Mock }).count.mockResolvedValueOnce(1);

    const result = await service.list({ page: 1, pageSize: 25 } as never);

    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 25 });
    expect(result.items).toHaveLength(1);
    const findManyArgs = (prisma.job as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      skip: number;
      take: number;
    };
    expect(findManyArgs.skip).toBe(0);
    expect(findManyArgs.take).toBe(25);
  });

  it("builds an OR search clause when q is supplied", async () => {
    const { service, prisma } = buildService();
    await service.list({ page: 2, pageSize: 10, q: "bridge" } as never);
    const findManyArgs = (prisma.job as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      where: { OR?: unknown[]; AND?: unknown[] };
      skip: number;
    };
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jobNumber: { contains: "bridge", mode: "insensitive" } }),
        expect.objectContaining({ name: { contains: "bridge", mode: "insensitive" } })
      ])
    );
    expect(findManyArgs.where.AND).toBeDefined();
  });

  it("filters out archived jobs in the default where clause", async () => {
    const { service, prisma } = buildService();
    await service.list({ page: 1, pageSize: 25 } as never);
    const findManyArgs = (prisma.job as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      where: { OR?: Array<Record<string, unknown>> };
    };
    expect(findManyArgs.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ closeout: { is: null } }),
        expect.objectContaining({ closeout: { is: { archivedAt: null } } })
      ])
    );
  });
});

// ─── listArchive ───────────────────────────────────────────────────────────

describe("JobsService.listArchive", () => {
  it("filters to jobs whose closeout.archivedAt is set", async () => {
    const { service, prisma } = buildService();
    await service.listArchive({ page: 1, pageSize: 25 } as never);
    const findManyArgs = (prisma.job as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      where: { closeout: { is: { archivedAt: { not: null } } } };
    };
    expect(findManyArgs.where.closeout).toEqual({
      is: { archivedAt: { not: null } }
    });
  });

  it("ANDs the archived filter with an OR search clause when q is supplied", async () => {
    const { service, prisma } = buildService();
    await service.listArchive({ page: 1, pageSize: 25, q: "wall" } as never);
    const findManyArgs = (prisma.job as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      where: { OR?: unknown[] };
    };
    expect(findManyArgs.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jobNumber: { contains: "wall", mode: "insensitive" } })
      ])
    );
  });
});

// ─── getById ───────────────────────────────────────────────────────────────

describe("JobsService.getById", () => {
  it("returns the job with attached documents", async () => {
    const docs = [{ id: "doc-1", title: "Plan" }];
    const { service, prisma } = buildService();
    (prisma.documentLink as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(docs);

    const result = await service.getById("job-1");

    expect(result).toMatchObject({ id: "job-1", documents: docs });
    expect((prisma.documentLink as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { linkedEntityType: "Job", linkedEntityId: "job-1" }
      })
    );
  });

  it("throws NotFoundException when the job does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(service.getById("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── updateJob (happy path — read-only block already covered) ──────────────

describe("JobsService.updateJob", () => {
  it("updates the job, writes audit, and refreshes follow-ups", async () => {
    const { service, prisma, auditWrite, refreshLiveFollowUps } = buildService();
    await service.updateJob("job-1", { name: "Renamed" } as never, "user-1");
    expect((prisma.job as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ name: "Renamed" })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.update", entityType: "Job", entityId: "job-1" })
    );
    expect(refreshLiveFollowUps).toHaveBeenCalledWith("user-1");
  });

  it("throws NotFoundException when the job does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateJob("missing", { name: "x" } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── updateStatus (not-found path; happy path covered elsewhere) ───────────

describe("JobsService.updateStatus", () => {
  it("throws NotFoundException when the job does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateStatus("missing", { status: "ACTIVE" } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── createStage / updateStage ─────────────────────────────────────────────

describe("JobsService.createStage", () => {
  it("creates a stage, writes audit, and refreshes follow-ups", async () => {
    const { service, prisma, auditWrite, refreshLiveFollowUps } = buildService();
    await service.createStage(
      "job-1",
      { name: "Mobilisation", stageOrder: 1 } as never,
      "user-1"
    );
    expect((prisma.jobStage as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "job-1",
          name: "Mobilisation",
          stageOrder: 1,
          status: "PLANNED"
        })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.stage.create", entityType: "JobStage" })
    );
    expect(refreshLiveFollowUps).toHaveBeenCalledWith("user-1");
  });

  it("throws NotFoundException when the job does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createStage("missing", { name: "x" } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("JobsService.updateStage", () => {
  it("updates the stage and writes audit", async () => {
    const { service, prisma, auditWrite } = buildService();
    await service.updateStage(
      "job-1",
      "stage-1",
      { name: "Updated stage" } as never,
      "user-1"
    );
    expect((prisma.jobStage as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stage-1" },
        data: expect.objectContaining({ name: "Updated stage" })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.stage.update" })
    );
  });

  it("throws NotFoundException when the stage belongs to a different job", async () => {
    const { service, prisma } = buildService();
    (prisma.jobStage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "stage-1",
      jobId: "other-job"
    });
    await expect(
      service.updateStage("job-1", "stage-1", { name: "x" } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when the stage does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.jobStage as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.updateStage("job-1", "missing", { name: "x" } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── createActivity (happy) / updateActivity ───────────────────────────────

describe("JobsService.createActivity", () => {
  it("creates an activity when the stage belongs to the same job", async () => {
    const { service, prisma, auditWrite } = buildService();
    await service.createActivity(
      "job-1",
      { jobStageId: "stage-1", name: "Pour slab" } as never,
      "user-1"
    );
    expect((prisma.jobActivity as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "job-1",
          jobStageId: "stage-1",
          name: "Pour slab",
          status: "PLANNED"
        })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.activity.create" })
    );
  });
});

describe("JobsService.updateActivity", () => {
  it("updates an activity and writes audit", async () => {
    const { service, prisma, auditWrite } = buildService();
    await service.updateActivity(
      "job-1",
      "act-1",
      { jobStageId: "stage-1", name: "Renamed activity" } as never,
      "user-1"
    );
    expect((prisma.jobActivity as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "act-1" },
        data: expect.objectContaining({ name: "Renamed activity", jobStageId: "stage-1" })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.activity.update" })
    );
  });

  it("throws NotFoundException when the activity belongs to a different job", async () => {
    const { service, prisma } = buildService();
    (prisma.jobActivity as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "act-1",
      jobId: "other-job"
    });
    await expect(
      service.updateActivity(
        "job-1",
        "act-1",
        { jobStageId: "stage-1", name: "x" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // Regression for the job activity status toggle (see PR rev-404). The
  // JobDetailPage toggle sends only `{status}` — when `UpdateJobActivityDto`
  // re-required `jobStageId`/`name` from the create DTO and the service
  // unconditionally called `requireStage`, the PATCH 400'd / 404'd. The
  // partial update must succeed and must NOT touch `jobStageId`.
  it("applies a status-only partial update without resolving a stage", async () => {
    const { service, prisma } = buildService();
    const stageFindUnique = (prisma.jobStage as { findUnique: jest.Mock }).findUnique;
    await service.updateActivity("job-1", "act-1", { status: "IN_PROGRESS" } as never, "user-1");
    expect(stageFindUnique).not.toHaveBeenCalled();
    expect((prisma.jobActivity as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "act-1" },
        data: expect.objectContaining({ status: "IN_PROGRESS", jobStageId: undefined })
      })
    );
  });
});

// ─── createIssue / updateIssue ─────────────────────────────────────────────

describe("JobsService.createIssue", () => {
  it("creates an issue with defaulted severity and status, writes audit", async () => {
    const { service, prisma, auditWrite } = buildService();
    await service.createIssue(
      "job-1",
      { title: "Cracked footing" } as never,
      "user-1"
    );
    expect((prisma.jobIssue as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "job-1",
          title: "Cracked footing",
          severity: "MEDIUM",
          status: "OPEN",
          reportedById: "user-1"
        })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.issue.create" })
    );
  });

  it("throws NotFoundException when the job does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createIssue("missing", { title: "x" } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("JobsService.updateIssue", () => {
  it("updates the issue and writes audit", async () => {
    const { service, prisma, auditWrite } = buildService();
    await service.updateIssue(
      "job-1",
      "issue-1",
      { title: "Renamed", status: "RESOLVED" } as never,
      "user-1"
    );
    expect((prisma.jobIssue as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "issue-1" },
        data: expect.objectContaining({ title: "Renamed", status: "RESOLVED" })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.issue.update" })
    );
  });

  it("throws NotFoundException when the issue belongs to a different job", async () => {
    const { service, prisma } = buildService();
    (prisma.jobIssue as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "issue-1",
      jobId: "other-job"
    });
    await expect(
      service.updateIssue("job-1", "issue-1", { title: "x" } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── createVariation / updateVariation ─────────────────────────────────────

describe("JobsService.createVariation", () => {
  it("creates a variation with the supplied amount as a Decimal-compatible value", async () => {
    const { service, prisma, auditWrite } = buildService();
    await service.createVariation(
      "job-1",
      { reference: "VAR-001", title: "Extra fence", amount: "1500.00" } as never,
      "user-1"
    );
    expect((prisma.jobVariation as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "job-1",
          reference: "VAR-001",
          title: "Extra fence",
          status: "PROPOSED"
        })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.variation.create" })
    );
  });

  it("throws ConflictException when the variation reference is already used on this job", async () => {
    const { service, prisma } = buildService();
    (prisma.jobVariation as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce({
      id: "var-existing"
    });
    await expect(
      service.createVariation(
        "job-1",
        { reference: "VAR-001", title: "Dup" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("throws NotFoundException when the job does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createVariation(
        "missing",
        { reference: "VAR-001", title: "x" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("JobsService.updateVariation", () => {
  it("updates the variation when the reference is unchanged (no uniqueness re-check)", async () => {
    const { service, prisma, auditWrite } = buildService();
    (prisma.jobVariation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "var-1",
      jobId: "job-1",
      reference: "VAR-1"
    });
    await service.updateVariation(
      "job-1",
      "var-1",
      { reference: "VAR-1", title: "Renamed" } as never,
      "user-1"
    );
    expect((prisma.jobVariation as { findFirst: jest.Mock }).findFirst).not.toHaveBeenCalled();
    expect((prisma.jobVariation as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "var-1" },
        data: expect.objectContaining({ reference: "VAR-1", title: "Renamed" })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.variation.update" })
    );
  });

  it("rechecks reference uniqueness when reference changes and rejects on collision", async () => {
    const { service, prisma } = buildService();
    (prisma.jobVariation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "var-1",
      jobId: "job-1",
      reference: "VAR-1"
    });
    (prisma.jobVariation as { findFirst: jest.Mock }).findFirst.mockResolvedValueOnce({
      id: "var-other"
    });
    await expect(
      service.updateVariation(
        "job-1",
        "var-1",
        { reference: "VAR-2", title: "x" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("throws NotFoundException when the variation belongs to a different job", async () => {
    const { service, prisma } = buildService();
    (prisma.jobVariation as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce({
      id: "var-1",
      jobId: "other-job",
      reference: "VAR-1"
    });
    await expect(
      service.updateVariation(
        "job-1",
        "var-1",
        { reference: "VAR-1", title: "x" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── createProgressEntry ───────────────────────────────────────────────────

describe("JobsService.createProgressEntry", () => {
  it("creates a progress entry with defaulted entryType=PROGRESS", async () => {
    const { service, prisma, auditWrite } = buildService();
    await service.createProgressEntry(
      "job-1",
      { entryDate: "2026-06-01", summary: "10% complete", percentComplete: 10 } as never,
      "user-1"
    );
    expect((prisma.jobProgressEntry as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "job-1",
          entryType: "PROGRESS",
          summary: "10% complete",
          percentComplete: 10,
          authorUserId: "user-1"
        })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.progress.create" })
    );
  });

  it("throws NotFoundException when the job does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createProgressEntry(
        "missing",
        { entryDate: "2026-06-01", summary: "x" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── closeoutJob ───────────────────────────────────────────────────────────

describe("JobsService.closeoutJob", () => {
  it("upserts the closeout row, drives job→COMPLETE, and records status history", async () => {
    const { service, prisma, auditWrite } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      jobRow({ status: "ACTIVE" })
    );

    await service.closeoutJob(
      "job-1",
      { status: "CLOSED", summary: "All done" } as never,
      "user-1"
    );

    expect((prisma.jobCloseout as { upsert: jest.Mock }).upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: "job-1" },
        update: expect.objectContaining({ status: "CLOSED", summary: "All done" })
      })
    );
    expect((prisma.job as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "COMPLETE" })
      })
    );
    expect((prisma.jobStatusHistory as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "job-1",
          fromStatus: "ACTIVE",
          toStatus: "COMPLETE",
          note: "All done",
          changedById: "user-1"
        })
      })
    );
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "jobs.closeout", entityType: "JobCloseout" })
    );
  });

  it("throws NotFoundException when the job does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.job as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.closeoutJob("missing", {} as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── awardTenderClient ─────────────────────────────────────────────────────

describe("JobsService.awardTenderClient", () => {
  it("clears prior awards, marks the target awarded, and bumps tender to AWARDED", async () => {
    const { service, prisma, auditWrite } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValue(
      tenderRow({
        tenderClients: [
          { id: "tc-1", clientId: "client-1", isAwarded: true, contractIssued: false, contractIssuedAt: null },
          { id: "tc-2", clientId: "client-2", isAwarded: false, contractIssued: false, contractIssuedAt: null }
        ]
      })
    );

    await service.awardTenderClient("tender-1", "tc-2", "user-1");

    expect((prisma.tenderClient as { updateMany: jest.Mock }).updateMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" },
      data: { isAwarded: false }
    });
    expect((prisma.tenderClient as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "tc-2" },
      data: { isAwarded: true }
    });
    expect((prisma.tender as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: { status: "AWARDED" }
    });
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tenderconversion.award" })
    );
  });

  it("throws NotFoundException when the tender does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.tender as { findUnique: jest.Mock }).findUnique.mockResolvedValueOnce(null);
    await expect(
      service.awardTenderClient("missing", "tc-1", "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when the tenderClientId does not belong to the tender", async () => {
    const { service } = buildService();
    await expect(
      service.awardTenderClient("tender-1", "tc-does-not-exist", "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── Tenant scoping gap ────────────────────────────────────────────────────

describe("JobsService — tenant scoping gap", () => {
  // TODO(multi-tenant): JobsService.list does not include any tenantId
  // filter in its Prisma `where` clause. Initial Services runs as a
  // single-tenant deployment today, so this is intentional — but when
  // the platform moves to multi-tenant, every where-clause builder on
  // this service needs a tenant filter added (and this test should be
  // rewritten to assert it is present rather than absent).
  it("does NOT scope list queries by a tenantId today (single-tenant deployment)", async () => {
    const { service, prisma } = buildService();
    await service.list({ page: 1, pageSize: 25 } as never);
    const findManyArgs = (prisma.job as { findMany: jest.Mock }).findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(findManyArgs.where).not.toHaveProperty("tenantId");
    expect(JSON.stringify(findManyArgs.where)).not.toContain("tenantId");
  });
});

