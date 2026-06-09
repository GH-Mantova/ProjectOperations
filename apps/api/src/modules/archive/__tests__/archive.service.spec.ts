// Mock-based unit tests for ArchiveService.
// Mirrors PR #283 (ProjectsService), PR #298 (FormsService),
// PR #310 (EstimatesService), PR #311 (SchedulerService),
// PR #322 (AllocationsService).
//
// Drives the service directly with plain-object Prisma stubs in the same
// `MockPrisma` / `makePrisma()` shape as the prior unit-test PRs. No production
// code is modified.

import { NotFoundException } from "@nestjs/common";
import { ArchiveService } from "../archive.service";
import { ArchiveQueryDto } from "../dto/archive-query.dto";

type MockPrisma = {
  job: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock };
  documentLink: { findMany: jest.Mock };
  formSubmission: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  return {
    job: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn()
    },
    documentLink: { findMany: jest.fn().mockResolvedValue([]) },
    formSubmission: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops))
  };
}

function makeService(prisma: MockPrisma) {
  return new ArchiveService(prisma as never);
}

function makeQuery(overrides: Partial<ArchiveQueryDto> = {}): ArchiveQueryDto {
  return {
    page: 1,
    pageSize: 20,
    ...overrides
  } as ArchiveQueryDto;
}

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    jobNumber: "J-2026-001",
    name: "Ipswich Earthworks",
    status: "ACTIVE",
    client: { id: "client-1", name: "QLD Transport" },
    closeout: {
      status: "ARCHIVED",
      archivedAt: new Date("2026-03-25T00:00:00.000Z"),
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-25T00:00:00.000Z")
    },
    ...overrides
  };
}

// ─── list() ────────────────────────────────────────────────────────────────

describe("ArchiveService.list — happy path + mapping", () => {
  it("returns mapped items, total, page, pageSize from the transaction result", async () => {
    const prisma = makePrisma();
    const row = jobRow();
    prisma.job.findMany.mockResolvedValue([row]);
    prisma.job.count.mockResolvedValue(1);
    const service = makeService(prisma);

    const result = await service.list(makeQuery({ page: 1, pageSize: 20 }));

    expect(result).toEqual({
      items: [
        {
          id: "job-1",
          jobNumber: "J-2026-001",
          name: "Ipswich Earthworks",
          clientName: "QLD Transport",
          closedAt: "2026-03-01T00:00:00.000Z",
          archivedAt: "2026-03-25T00:00:00.000Z",
          status: "ARCHIVED"
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    });
  });

  it("falls back to job.status when closeout is null and emits null timestamps", async () => {
    const prisma = makePrisma();
    prisma.job.findMany.mockResolvedValue([
      jobRow({ status: "CLOSED", closeout: null })
    ]);
    prisma.job.count.mockResolvedValue(1);
    const service = makeService(prisma);

    const result = await service.list(makeQuery());

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        closedAt: null,
        archivedAt: null,
        status: "CLOSED"
      })
    );
  });

  it("emits null archivedAt when closeout exists but has not been archived yet", async () => {
    const prisma = makePrisma();
    prisma.job.findMany.mockResolvedValue([
      jobRow({
        closeout: {
          status: "CLOSED",
          archivedAt: null,
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
          updatedAt: new Date("2026-03-02T00:00:00.000Z")
        }
      })
    ]);
    prisma.job.count.mockResolvedValue(1);
    const service = makeService(prisma);

    const result = await service.list(makeQuery());

    expect(result.items[0].archivedAt).toBeNull();
    expect(result.items[0].closedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(result.items[0].status).toBe("CLOSED");
  });

  it("returns empty items and zero total when no rows match", async () => {
    const prisma = makePrisma();
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);
    const service = makeService(prisma);

    const result = await service.list(makeQuery());

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it("orders by updatedAt desc and applies skip + take from pagination", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery({ page: 3, pageSize: 25 }));

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }],
        skip: 50,
        take: 25
      })
    );
  });

  it("invokes findMany and count inside $transaction with matching where clauses", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery({ clientId: "client-9" }));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.job.findMany.mock.calls[0][0];
    const countArgs = prisma.job.count.mock.calls[0][0];
    expect(findManyArgs.where).toEqual(countArgs.where);
  });
});

// ─── list() — buildWhere status branches ────────────────────────────────────

describe("ArchiveService.list — status filter branches", () => {
  it("default (no status) filters by closeout.status in [CLOSED, ARCHIVED]", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery());

    const where = prisma.job.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      closeout: { is: { status: { in: ["CLOSED", "ARCHIVED"] } } }
    });
  });

  it("status=ALL filters by closeout.status in [CLOSED, ARCHIVED]", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery({ status: "ALL" }));

    const where = prisma.job.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      closeout: { is: { status: { in: ["CLOSED", "ARCHIVED"] } } }
    });
  });

  it("status=ARCHIVED filters by closeout.archivedAt not null", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery({ status: "ARCHIVED" }));

    const where = prisma.job.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ closeout: { is: { archivedAt: { not: null } } } });
  });

  it("status=CLOSED filters by closeout.status in [CLOSED, ARCHIVED]", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery({ status: "CLOSED" }));

    const where = prisma.job.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      closeout: { is: { status: { in: ["CLOSED", "ARCHIVED"] } } }
    });
  });
});

// ─── list() — buildWhere search / clientId / year filters ──────────────────

describe("ArchiveService.list — composite filters", () => {
  it("adds search OR over jobNumber, name, and client.name (case-insensitive)", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery({ search: "ipswich" }));

    const where = prisma.job.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { jobNumber: { contains: "ipswich", mode: "insensitive" } },
            { name: { contains: "ipswich", mode: "insensitive" } },
            {
              client: {
                is: { name: { contains: "ipswich", mode: "insensitive" } }
              }
            }
          ]
        }
      ])
    );
  });

  it("adds clientId equality filter", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery({ clientId: "client-9" }));

    const where = prisma.job.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([{ clientId: "client-9" }])
    );
  });

  it("year=2026 adds an OR over archivedAt range or createdAt range with archivedAt null", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery({ year: 2026 }));

    const where = prisma.job.findMany.mock.calls[0][0].where;
    const start = new Date(Date.UTC(2026, 0, 1));
    const end = new Date(Date.UTC(2027, 0, 1));
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { closeout: { is: { archivedAt: { gte: start, lt: end } } } },
            {
              closeout: {
                is: { archivedAt: null, createdAt: { gte: start, lt: end } }
              }
            }
          ]
        }
      ])
    );
  });

  it("combines all filters under a single AND when multiple are present", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(
      makeQuery({
        search: "ips",
        clientId: "client-9",
        year: 2026,
        status: "ARCHIVED"
      })
    );

    const where = prisma.job.findMany.mock.calls[0][0].where;
    expect(Array.isArray(where.AND)).toBe(true);
    expect(where.AND).toHaveLength(4);
  });

  it("returns a single filter directly (no AND wrapper) when only status is present", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);

    await service.list(makeQuery());

    const where = prisma.job.findMany.mock.calls[0][0].where;
    expect(where.AND).toBeUndefined();
    expect(where.closeout).toBeDefined();
  });
});

// ─── export() ──────────────────────────────────────────────────────────────

function fullJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    jobNumber: "J-2026-001",
    name: "Ipswich Earthworks",
    description: "Earthworks for Stage 4",
    status: "ARCHIVED",
    client: { id: "client-1", name: "QLD Transport" },
    site: { id: "site-1", name: "Ipswich Depot" },
    projectManager: {
      id: "user-pm",
      firstName: "Pat",
      lastName: "Manager",
      email: "pm@example.com"
    },
    supervisor: {
      id: "user-sv",
      firstName: "Sam",
      lastName: "Supervisor",
      email: "sv@example.com"
    },
    stages: [{ id: "stage-1", stageOrder: 1 }],
    activities: [{ id: "act-1", jobStageId: "stage-1", activityOrder: 1 }],
    issues: [{ id: "iss-1", reportedAt: new Date("2026-02-01") }],
    variations: [{ id: "var-1", createdAt: new Date("2026-02-02") }],
    progressEntries: [{ id: "pe-1", entryDate: new Date("2026-02-03") }],
    statusHistory: [{ id: "sh-1", changedAt: new Date("2026-02-04") }],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-03-25"),
    closeout: {
      id: "co-1",
      status: "ARCHIVED",
      archivedAt: new Date("2026-03-25"),
      createdAt: new Date("2026-03-01"),
      updatedAt: new Date("2026-03-25"),
      checklistJson: { handover: true, snags: 0 },
      archivedBy: {
        id: "user-arch",
        firstName: "Avery",
        lastName: "Archiver"
      }
    },
    ...overrides
  };
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    title: "Site Plan",
    description: "Civil drawings",
    category: "DESIGN",
    module: "JOBS",
    status: "FINAL",
    versionLabel: "v1.0",
    versionNumber: 1,
    documentFamilyKey: "fam-1",
    isCurrentVersion: true,
    fileLink: { name: "site-plan.pdf", webUrl: "https://sp/site-plan.pdf" },
    folderLink: { relativePath: "Jobs/J-2026-001/Drawings" },
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-02"),
    ...overrides
  };
}

function submissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    status: "SUBMITTED",
    submittedAt: new Date("2026-02-10"),
    summary: "Daily prestart",
    templateVersion: {
      versionNumber: 3,
      template: { id: "tpl-1", name: "Daily Prestart", code: "PRESTART" }
    },
    values: [
      {
        fieldKey: "notes",
        valueText: "All clear",
        valueNumber: null,
        valueDateTime: null,
        valueJson: null
      }
    ],
    attachments: [
      {
        fieldKey: "photo",
        fileName: "photo.jpg",
        fileUrl: "https://sp/photo.jpg"
      }
    ],
    signatures: [
      {
        fieldKey: "signoff",
        signerName: "Sam Worker",
        signedAt: new Date("2026-02-10T08:00:00Z")
      }
    ],
    ...overrides
  };
}

describe("ArchiveService.export — 404 + short-circuit", () => {
  it("throws NotFoundException when job is missing", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.export("missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.export("missing")).rejects.toMatchObject({
      message: "Archived job not found."
    });
  });

  it("does NOT query documentLink or formSubmission when job is missing", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.export("missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.documentLink.findMany).not.toHaveBeenCalled();
    expect(prisma.formSubmission.findMany).not.toHaveBeenCalled();
  });

  it("queries findUnique with includes covering closeout + relations and orders stages/activities", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(fullJobRow());
    const service = makeService(prisma);

    await service.export("job-1");

    const args = prisma.job.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: "job-1" });
    expect(args.include).toEqual(
      expect.objectContaining({
        client: true,
        site: true,
        projectManager: expect.any(Object),
        supervisor: expect.any(Object),
        stages: { orderBy: { stageOrder: "asc" } },
        activities: {
          orderBy: [{ jobStageId: "asc" }, { activityOrder: "asc" }]
        },
        closeout: expect.objectContaining({
          include: expect.objectContaining({ archivedBy: expect.any(Object) })
        })
      })
    );
  });
});

describe("ArchiveService.export — happy path + mapping", () => {
  it("returns the full snapshot with summary, closeout, checklist, and related lists", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(fullJobRow());
    prisma.documentLink.findMany.mockResolvedValue([documentRow()]);
    prisma.formSubmission.findMany.mockResolvedValue([submissionRow()]);
    const service = makeService(prisma);

    const result = await service.export("job-1");

    expect(result.summary).toEqual(
      expect.objectContaining({
        id: "job-1",
        jobNumber: "J-2026-001",
        name: "Ipswich Earthworks",
        status: "ARCHIVED",
        client: { id: "client-1", name: "QLD Transport" },
        site: { id: "site-1", name: "Ipswich Depot" }
      })
    );
    expect(result.closeout).toBeDefined();
    expect(result.checklist).toEqual({ handover: true, snags: 0 });
    expect(result.stages).toHaveLength(1);
    expect(result.activities).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
    expect(result.variations).toHaveLength(1);
    expect(result.progressEntries).toHaveLength(1);
    expect(result.statusHistory).toHaveLength(1);
    expect(typeof result.exportedAt).toBe("string");
  });

  it("maps documents from fileLink and folderLink with the expected field projection", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(fullJobRow());
    prisma.documentLink.findMany.mockResolvedValue([documentRow()]);
    const service = makeService(prisma);

    const result = await service.export("job-1");

    expect(result.documents).toEqual([
      expect.objectContaining({
        id: "doc-1",
        title: "Site Plan",
        fileName: "site-plan.pdf",
        webUrl: "https://sp/site-plan.pdf",
        folderPath: "Jobs/J-2026-001/Drawings"
      })
    ]);
  });

  it("emits null fileName/webUrl/folderPath when fileLink and folderLink are absent", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(fullJobRow());
    prisma.documentLink.findMany.mockResolvedValue([
      documentRow({ fileLink: null, folderLink: null })
    ]);
    const service = makeService(prisma);

    const result = await service.export("job-1");

    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        fileName: null,
        webUrl: null,
        folderPath: null
      })
    );
  });

  it("maps form submissions with templateCode, templateName, versionNumber, values, attachments, signatures", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(fullJobRow());
    prisma.formSubmission.findMany.mockResolvedValue([submissionRow()]);
    const service = makeService(prisma);

    const result = await service.export("job-1");

    expect(result.formSubmissions).toEqual([
      expect.objectContaining({
        id: "sub-1",
        templateCode: "PRESTART",
        templateName: "Daily Prestart",
        versionNumber: 3,
        status: "SUBMITTED",
        summary: "Daily prestart",
        values: [
          expect.objectContaining({ fieldKey: "notes", valueText: "All clear" })
        ],
        attachments: [
          expect.objectContaining({
            fieldKey: "photo",
            fileName: "photo.jpg",
            fileUrl: "https://sp/photo.jpg"
          })
        ],
        signatures: [
          expect.objectContaining({
            fieldKey: "signoff",
            signerName: "Sam Worker"
          })
        ]
      })
    ]);
  });

  it("returns null checklist when closeout has no checklistJson", async () => {
    const prisma = makePrisma();
    const job = fullJobRow();
    (job.closeout as Record<string, unknown>).checklistJson = null;
    prisma.job.findUnique.mockResolvedValue(job);
    const service = makeService(prisma);

    const result = await service.export("job-1");

    expect(result.checklist).toBeNull();
  });

  it("returns null checklist when closeout itself is null", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(fullJobRow({ closeout: null }));
    const service = makeService(prisma);

    const result = await service.export("job-1");

    expect(result.checklist).toBeNull();
    expect(result.closeout).toBeNull();
  });

  it("queries documentLink scoped to the job and formSubmission scoped to the job, in parallel", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(fullJobRow());
    const service = makeService(prisma);

    await service.export("job-1");

    expect(prisma.documentLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { linkedEntityType: "Job", linkedEntityId: "job-1" },
        orderBy: [{ category: "asc" }, { versionNumber: "desc" }]
      })
    );
    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: "job-1" },
        orderBy: { submittedAt: "desc" }
      })
    );
  });

  it("returns empty documents and formSubmissions lists when there are no linked records", async () => {
    const prisma = makePrisma();
    prisma.job.findUnique.mockResolvedValue(fullJobRow());
    prisma.documentLink.findMany.mockResolvedValue([]);
    prisma.formSubmission.findMany.mockResolvedValue([]);
    const service = makeService(prisma);

    const result = await service.export("job-1");

    expect(result.documents).toEqual([]);
    expect(result.formSubmissions).toEqual([]);
  });
});
