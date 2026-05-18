// PR fix/B02 — specs for the manual job-creation path.
// Mirrors the cutting-create-cardid.spec.ts pattern: mock Prisma,
// drive the service directly, assert the request shape that hits
// Prisma plus the audit write.

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { JobsService } from "../jobs.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildMocks(opts: {
  clientExists?: boolean;
  siteExists?: boolean;
  jobNumberTaken?: boolean;
  createdJob?: { id: string; jobNumber: string };
} = {}) {
  const clientFindUnique: AsyncMock = jest.fn(async () =>
    opts.clientExists === false ? null : { id: "client-1" }
  );
  const siteFindUnique: AsyncMock = jest.fn(async () =>
    opts.siteExists === false ? null : { id: "site-1" }
  );
  const jobFindUnique: AsyncMock = jest.fn();
  // First call is the jobNumber uniqueness pre-check; subsequent
  // calls (the requireJob inside getById) return the row.
  const createdJob = opts.createdJob ?? { id: "job-new", jobNumber: "JOB-2026-100" };
  jobFindUnique
    .mockImplementationOnce(async () => (opts.jobNumberTaken ? { id: "existing" } : null))
    .mockImplementation(async () => ({ ...createdJob, name: "Test Job", status: "PLANNING" }));
  const jobCreate: AsyncMock = jest.fn(async () => createdJob);
  const documentLinkFindMany: AsyncMock = jest.fn(async () => []);
  const auditWrite: AsyncMock = jest.fn();

  const prisma = {
    client: { findUnique: clientFindUnique },
    site: { findUnique: siteFindUnique },
    job: { findUnique: jobFindUnique, create: jobCreate },
    documentLink: { findMany: documentLinkFindMany }
  };
  const audit = { write: auditWrite };
  const sharepoint = {};
  const notifications = {};

  const service = new JobsService(
    prisma as never,
    audit as never,
    sharepoint as never,
    notifications as never
  );

  return { service, mocks: { clientFindUnique, siteFindUnique, jobFindUnique, jobCreate, auditWrite } };
}

const validDto = {
  jobNumber: "JOB-2026-100",
  name: "Manual Test Job",
  clientId: "client-1",
  status: "PLANNING"
};

describe("JobsService.createJob (PR fix/B02)", () => {
  it("happy path: creates the job, writes audit, returns the row", async () => {
    const { service, mocks } = buildMocks();
    const result = await service.createJob(validDto, "user-1");
    expect(result).toBeDefined();
    expect(mocks.jobCreate).toHaveBeenCalledTimes(1);
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toBe("JOB-2026-100");
    expect(data.name).toBe("Manual Test Job");
    expect(data.clientId).toBe("client-1");
    expect(data.status).toBe("PLANNING");
    expect(data.siteId).toBeNull();
    expect(mocks.auditWrite).toHaveBeenCalledTimes(1);
    const auditArgs = mocks.auditWrite.mock.calls[0]?.[0] as { action: string; entityType: string };
    expect(auditArgs.action).toBe("jobs.create");
    expect(auditArgs.entityType).toBe("Job");
  });

  it("trims string inputs and defaults status to PLANNING when omitted", async () => {
    const { service, mocks } = buildMocks();
    await service.createJob(
      { jobNumber: "  JOB-2026-101 ", name: "  Trim Me  ", clientId: "client-1" },
      "user-1"
    );
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toBe("JOB-2026-101");
    expect(data.name).toBe("Trim Me");
    expect(data.status).toBe("PLANNING");
  });

  it("throws BadRequestException when name is blank", async () => {
    const { service, mocks } = buildMocks();
    await expect(
      service.createJob({ ...validDto, name: "   " }, "user-1")
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.jobCreate).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when clientId does not exist", async () => {
    const { service, mocks } = buildMocks({ clientExists: false });
    await expect(service.createJob(validDto, "user-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.jobCreate).not.toHaveBeenCalled();
    expect(mocks.auditWrite).not.toHaveBeenCalled();
  });

  it("skips site lookup when siteId is omitted", async () => {
    const { service, mocks } = buildMocks();
    await service.createJob(validDto, "user-1");
    expect(mocks.siteFindUnique).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when supplied siteId does not exist", async () => {
    const { service, mocks } = buildMocks({ siteExists: false });
    await expect(
      service.createJob({ ...validDto, siteId: "missing-site" }, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.jobCreate).not.toHaveBeenCalled();
  });

  it("throws ConflictException when jobNumber is already taken", async () => {
    const { service, mocks } = buildMocks({ jobNumberTaken: true });
    await expect(service.createJob(validDto, "user-1")).rejects.toBeInstanceOf(ConflictException);
    expect(mocks.jobCreate).not.toHaveBeenCalled();
  });

  it("persists JOB-YYYY-NNN style jobNumber verbatim (no auto-generator in scope for B02)", async () => {
    const { service, mocks } = buildMocks();
    await service.createJob({ ...validDto, jobNumber: "JOB-2026-200" }, "user-1");
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toMatch(/^JOB-\d{4}-\d+$/);
  });
});
