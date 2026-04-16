import { NotFoundException } from "@nestjs/common";
import { JobsService } from "./jobs.service";

describe("JobsService", () => {
  const notificationsServiceMock = {
    refreshLiveFollowUps: jest.fn()
  };

  it("rejects contract issuance for a non-awarded tender client", async () => {
    const service = new JobsService(
      {
        tender: {
          findUnique: jest.fn().mockResolvedValue({
            id: "tender-1",
            sourceJob: null,
            tenderClients: [
              {
                id: "tc-1",
                clientId: "client-1",
                isAwarded: false,
                contractIssued: false
              }
            ],
            tenderDocuments: []
          })
        }
        ,
        jobCloseout: { findUnique: jest.fn().mockResolvedValue(null) }
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await expect(
      service.issueContract("tender-1", { tenderClientId: "tc-1" }, "user-1")
    ).rejects.toThrow("Only the awarded client can issue a contract.");
  });

  it("rolls a converted tender back to awarded with a new awarded client", async () => {
    const jobUpdate = jest.fn();
    const jobCloseoutUpsert = jest.fn();
    const jobConversionDeleteMany = jest.fn();
    const tenderClientUpdateMany = jest.fn();
    const tenderClientUpdate = jest.fn();
    const tenderUpdate = jest.fn();
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: "tender-1",
        sourceJob: { id: "job-1", jobNumber: "JOB-001", name: "Converted job", status: "ACTIVE" },
        tenderClients: [
          { id: "tc-1", clientId: "client-1", isAwarded: true, contractIssued: true, contractIssuedAt: new Date("2026-04-01T00:00:00.000Z") },
          { id: "tc-2", clientId: "client-2", isAwarded: false, contractIssued: false, contractIssuedAt: null }
        ],
        tenderDocuments: []
      })
      .mockResolvedValueOnce({
        id: "tender-1",
        sourceJob: null,
        tenderClients: [],
        tenderDocuments: []
      });
    const service = new JobsService(
      {
        tender: { findUnique: findUnique, update: tenderUpdate },
        tenderClient: { updateMany: tenderClientUpdateMany, update: tenderClientUpdate },
        job: { update: jobUpdate },
        jobCloseout: { upsert: jobCloseoutUpsert, findUnique: jest.fn().mockResolvedValue(null) },
        jobConversion: { deleteMany: jobConversionDeleteMany },
        $transaction: jest.fn(async (callback) =>
          callback({
            job: { update: jobUpdate },
            jobCloseout: { upsert: jobCloseoutUpsert },
            jobConversion: { deleteMany: jobConversionDeleteMany },
            tenderClient: { updateMany: tenderClientUpdateMany, update: tenderClientUpdate },
            tender: { update: tenderUpdate }
          })
        )
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await service.rollbackTenderLifecycle(
      "tender-1",
      { targetStage: "AWARDED", tenderClientId: "tc-2" },
      "user-1"
    );

    expect(jobCloseoutUpsert).toHaveBeenCalled();
    expect(jobUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "COMPLETE",
        sourceTenderId: null
      }
    });
    expect(jobConversionDeleteMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" }
    });
    expect(tenderClientUpdateMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" },
      data: {
        isAwarded: false,
        contractIssued: false,
        contractIssuedAt: null
      }
    });
    expect(tenderClientUpdate).toHaveBeenCalledWith({
      where: { id: "tc-2" },
      data: {
        isAwarded: true,
        contractIssued: false,
        contractIssuedAt: null
      }
    });
    expect(tenderUpdate).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: { status: "AWARDED" }
    });
  });

  it("rolls a converted tender back to submitted without reassigning an awarded client", async () => {
    const jobUpdate = jest.fn();
    const jobCloseoutUpsert = jest.fn();
    const jobConversionDeleteMany = jest.fn();
    const tenderClientUpdateMany = jest.fn();
    const tenderClientUpdate = jest.fn();
    const tenderUpdate = jest.fn();
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: "tender-1",
        sourceJob: { id: "job-1", jobNumber: "JOB-001", name: "Converted job", status: "ACTIVE" },
        tenderClients: [
          { id: "tc-1", clientId: "client-1", isAwarded: true, contractIssued: true, contractIssuedAt: new Date("2026-04-01T00:00:00.000Z") }
        ],
        tenderDocuments: []
      })
      .mockResolvedValueOnce({
        id: "tender-1",
        sourceJob: null,
        tenderClients: [],
        tenderDocuments: []
      });
    const service = new JobsService(
      {
        tender: { findUnique: findUnique, update: tenderUpdate },
        tenderClient: { updateMany: tenderClientUpdateMany, update: tenderClientUpdate },
        job: { update: jobUpdate },
        jobCloseout: { upsert: jobCloseoutUpsert, findUnique: jest.fn().mockResolvedValue(null) },
        jobConversion: { deleteMany: jobConversionDeleteMany },
        $transaction: jest.fn(async (callback) =>
          callback({
            job: { update: jobUpdate },
            jobCloseout: { upsert: jobCloseoutUpsert },
            jobConversion: { deleteMany: jobConversionDeleteMany },
            tenderClient: { updateMany: tenderClientUpdateMany, update: tenderClientUpdate },
            tender: { update: tenderUpdate }
          })
        )
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await service.rollbackTenderLifecycle(
      "tender-1",
      { targetStage: "SUBMITTED" },
      "user-1"
    );

    expect(jobCloseoutUpsert).toHaveBeenCalled();
    expect(jobUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "COMPLETE",
        sourceTenderId: null
      }
    });
    expect(jobConversionDeleteMany).toHaveBeenCalledWith({
      where: { tenderId: "tender-1" }
    });
    expect(tenderClientUpdateMany).toHaveBeenCalled();
    expect(tenderClientUpdate).not.toHaveBeenCalled();
    expect(tenderUpdate).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: { status: "SUBMITTED" }
    });
  });

  it("reuses an archived job conversion as a new stage", async () => {
    const jobUpdate = jest.fn().mockResolvedValue({ id: "job-1", jobNumber: "JOB-001", name: "Reopened job", status: "PLANNING" });
    const jobCloseoutUpsert = jest.fn();
    const jobStageCreate = jest.fn();
    const jobConversionUpsert = jest.fn();
    const tenderUpdate = jest.fn();
    const findArchivedJobById = jest.fn().mockResolvedValue({
      id: "job-1",
      jobNumber: "JOB-001",
      closeout: { archivedAt: new Date("2026-04-01T00:00:00.000Z") },
      stages: [{ stageOrder: 2 }]
    });
    const findTender = jest
      .fn()
      .mockResolvedValueOnce({
        id: "tender-1",
        sourceJob: null,
        tenderClients: [
          { id: "tc-1", clientId: "client-1", isAwarded: true, contractIssued: true }
        ],
        tenderDocuments: []
      });
    const findArchivedJob = jest.fn().mockResolvedValue({
      id: "job-1",
      jobNumber: "JOB-001",
      closeout: { archivedAt: new Date("2026-04-01T00:00:00.000Z") },
      stages: [{ stageOrder: 2 }]
    });
    const service = new JobsService(
      {
        tender: { findUnique: findTender, update: tenderUpdate },
        job: {
          findFirst: findArchivedJob,
          findUnique: findArchivedJobById,
          update: jobUpdate,
        },
        jobCloseout: {
          upsert: jobCloseoutUpsert,
          findUnique: jest.fn().mockResolvedValue(null)
        },
        jobStage: { create: jobStageCreate },
        jobConversion: { upsert: jobConversionUpsert },
        documentLink: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn(async (callback) =>
          callback({
            job: { update: jobUpdate },
            jobCloseout: { upsert: jobCloseoutUpsert },
            jobStage: { create: jobStageCreate },
            jobConversion: { upsert: jobConversionUpsert },
            documentLink: { createMany: jest.fn() },
            tender: { update: tenderUpdate }
          })
        )
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await service.reuseArchivedJobConversion(
      "tender-1",
      {
        archivedJobId: "job-1",
        jobNumber: "JOB-001",
        name: "Reopened job",
        stageName: "Stage 3",
        carryTenderDocuments: false
      },
      "user-1"
    );

    expect(jobUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        sourceTenderId: "tender-1",
        status: "ACTIVE"
      })
    });
    expect(jobCloseoutUpsert).toHaveBeenCalled();
    expect(jobStageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: "job-1",
        name: "Stage 3",
        stageOrder: 3,
        status: "ACTIVE"
      })
    });
    expect(jobConversionUpsert).toHaveBeenCalled();
    expect(tenderUpdate).toHaveBeenCalledWith({
      where: { id: "tender-1" },
      data: { status: "CONVERTED" }
    });
    expect(findArchivedJobById).toHaveBeenCalledWith({
      where: { id: "job-1" },
      include: {
        closeout: true,
        stages: {
          orderBy: { stageOrder: "desc" },
          take: 1
        }
      }
    });
    expect(findArchivedJob).not.toHaveBeenCalled();
  });

  it("reuses an archived job even after rollback cleared the source tender link", async () => {
    const jobUpdate = jest.fn().mockResolvedValue({ id: "job-1", jobNumber: "JOB-001", name: "Reopened job", status: "ACTIVE" });
    const jobCloseoutUpsert = jest.fn();
    const jobStageCreate = jest.fn();
    const jobConversionUpsert = jest.fn();
    const tenderUpdate = jest.fn();
    const findTender = jest.fn().mockResolvedValue({
      id: "tender-1",
      sourceJob: null,
      tenderClients: [{ id: "tc-1", clientId: "client-1", isAwarded: true, contractIssued: true }],
      tenderDocuments: []
    });
    const findArchivedJob = jest.fn().mockResolvedValue({
      id: "job-1",
      jobNumber: "JOB-001",
      sourceTenderId: null,
      closeout: { archivedAt: new Date("2026-04-01T00:00:00.000Z") },
      stages: []
    });
    const service = new JobsService(
      {
        tender: { findUnique: findTender, update: tenderUpdate },
        job: {
          findFirst: findArchivedJob,
          update: jobUpdate,
          findUnique: jest.fn().mockResolvedValue({ id: "job-1", status: "ACTIVE" })
        },
        jobCloseout: { upsert: jobCloseoutUpsert, findUnique: jest.fn().mockResolvedValue(null) },
        jobStage: { create: jobStageCreate },
        jobConversion: { upsert: jobConversionUpsert },
        documentLink: { createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn(async (callback) =>
          callback({
            job: { update: jobUpdate },
            jobCloseout: { upsert: jobCloseoutUpsert },
            jobStage: { create: jobStageCreate },
            jobConversion: { upsert: jobConversionUpsert },
            documentLink: { createMany: jest.fn() },
            tender: { update: tenderUpdate }
          })
        )
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await service.reuseArchivedJobConversion(
      "tender-1",
      {
        jobNumber: "JOB-001",
        name: "Reopened job",
        stageName: "Restart",
        carryTenderDocuments: false
      },
      "user-1"
    );

    expect(findArchivedJob).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jobNumber: {
            equals: "JOB-001",
            mode: "insensitive"
          },
          closeout: {
            is: {
              archivedAt: { not: null }
            }
          }
        }
      })
    );
  });

  it("returns archived conflict metadata when conversion collides with an archived job", async () => {
    const service = new JobsService(
      {
        tender: {
          findUnique: jest.fn().mockResolvedValue({
            id: "tender-1",
            sourceJob: null,
            tenderClients: [{ id: "tc-1", clientId: "client-1", isAwarded: true, contractIssued: true }],
            tenderDocuments: []
          })
        },
        job: {
          findFirst: jest.fn().mockResolvedValue({
            id: "job-archived-1",
            closeout: { archivedAt: new Date("2026-04-01T00:00:00.000Z") }
          })
        }
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await expect(
      service.convertTenderToJob(
        "tender-1",
        {
          jobNumber: "JOB-001",
          name: "Converted job"
        },
        "user-1"
      )
    ).rejects.toMatchObject({
      response: {
        message: "A job with this number and source tender already exists.",
        archivedJobId: "job-archived-1",
        isArchived: true
      }
    });
  });

  it("records status history when updating job status", async () => {
    const update = jest.fn().mockResolvedValue({ id: "job-1", status: "ACTIVE" });
    const create = jest.fn();
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: "job-1", status: "PLANNING" })
      .mockResolvedValueOnce({ id: "job-1", status: "ACTIVE" });
    const service = new JobsService(
      {
        job: { findUnique, update },
        jobCloseout: { findUnique: jest.fn().mockResolvedValue(null) },
        documentLink: { findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn(async (callback) =>
          callback({
            job: { update },
            jobStatusHistory: { create }
          })
        )
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await service.updateStatus("job-1", { status: "ACTIVE", note: "Mobilised" }, "user-1");

    expect(update).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: "job-1",
        fromStatus: "PLANNING",
        toStatus: "ACTIVE",
        note: "Mobilised",
        changedById: "user-1"
      })
    });
  });

  it("rejects creating an activity against a stage from another job", async () => {
    const service = new JobsService(
      {
        job: { findUnique: jest.fn().mockResolvedValue({ id: "job-1" }) },
        jobCloseout: { findUnique: jest.fn().mockResolvedValue(null) },
        jobStage: { findUnique: jest.fn().mockResolvedValue({ id: "stage-1", jobId: "job-2" }) }
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await expect(
      service.createActivity("job-1", { jobStageId: "stage-1", name: "Activity" }, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("blocks updates once a job is archived and read-only", async () => {
    const service = new JobsService(
      {
        jobCloseout: {
          findUnique: jest.fn().mockResolvedValue({
            jobId: "job-1",
            readOnlyFrom: new Date("2026-04-01T00:00:00.000Z")
          })
        }
      } as never,
      { write: jest.fn() } as never,
      { ensureFolder: jest.fn() } as never,
      notificationsServiceMock as never
    );

    await expect(service.updateJob("job-1", { name: "Changed" }, "user-1")).rejects.toThrow(
      "Archived jobs are read-only."
    );
  });
});
