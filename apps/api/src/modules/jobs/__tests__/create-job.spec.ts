// PR B05 — specs for createJob covering the canonical job-number
// generation, validation, pre-check 409, P2002 race 409, and the
// long-standing happy/error paths from B02.
//
// Mocks Prisma + JobNumberService and drives the service directly.
// Mirrors the cutting-create-cardid.spec.ts pattern.

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { JobsService } from "../jobs.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildMocks(opts: {
  clientExists?: boolean;
  siteExists?: boolean;
  jobNumberTaken?: boolean;
  createdJob?: { id: string; jobNumber: string };
  jobCreateImpl?: (...args: unknown[]) => Promise<unknown>;
  generatorOutput?: string;
} = {}) {
  const clientFindUnique: AsyncMock = jest.fn(async () =>
    opts.clientExists === false ? null : { id: "client-1" }
  );
  const siteFindUnique: AsyncMock = jest.fn(async () =>
    opts.siteExists === false ? null : { id: "site-1" }
  );
  const jobFindUnique: AsyncMock = jest.fn();
  const createdJob = opts.createdJob ?? { id: "job-new", jobNumber: "J-2026-100" };
  // First call is the jobNumber uniqueness pre-check; subsequent calls
  // (the requireJob inside getById) return the row.
  jobFindUnique
    .mockImplementationOnce(async () => (opts.jobNumberTaken ? { id: "existing" } : null))
    .mockImplementation(async () => ({ ...createdJob, name: "Test Job", status: "PLANNING" }));
  const jobCreate: AsyncMock = jest.fn(
    opts.jobCreateImpl ?? (async () => createdJob)
  );
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
  const jobNumberService = {
    generate: jest.fn(async () => opts.generatorOutput ?? "J-2026-500"),
    validate: jest.fn((value: string) => {
      if (!value) return "Job number is required.";
      if (!/^J-\d{4}-\d{3}$/.test(value)) {
        return `Job number "${value}" is not in canonical format J-YYYY-NNN.`;
      }
      return null;
    })
  };

  const service = new JobsService(
    prisma as never,
    audit as never,
    sharepoint as never,
    notifications as never,
    jobNumberService as never
  );

  return { service, mocks: { clientFindUnique, siteFindUnique, jobFindUnique, jobCreate, auditWrite, jobNumberService } };
}

const validDto = {
  jobNumber: "J-2026-100",
  name: "Manual Test Job",
  clientId: "client-1",
  status: "PLANNING"
};

describe("JobsService.createJob (PR B05 — canonical IDs + race-fix)", () => {
  it("happy path: creates the job, writes audit, returns the row", async () => {
    const { service, mocks } = buildMocks();
    const result = await service.createJob(validDto, "user-1");
    expect(result).toBeDefined();
    expect(mocks.jobCreate).toHaveBeenCalledTimes(1);
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toBe("J-2026-100");
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
      { jobNumber: "  J-2026-101 ", name: "  Trim Me  ", clientId: "client-1" },
      "user-1"
    );
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toBe("J-2026-101");
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

  it("throws ConflictException when jobNumber is already taken (pre-check)", async () => {
    const { service, mocks } = buildMocks({ jobNumberTaken: true });
    await expect(service.createJob(validDto, "user-1")).rejects.toBeInstanceOf(ConflictException);
    expect(mocks.jobCreate).not.toHaveBeenCalled();
  });

  it("persists canonical J-YYYY-NNN jobNumber verbatim when supplied", async () => {
    const { service, mocks } = buildMocks();
    await service.createJob({ ...validDto, jobNumber: "J-2026-200" }, "user-1");
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toMatch(/^J-\d{4}-\d{3}$/);
    expect(data.jobNumber).toBe("J-2026-200");
  });

  // B05 — generator
  it("server-generates jobNumber when caller omits it", async () => {
    const { service, mocks } = buildMocks({ generatorOutput: "J-2026-038" });
    const { jobNumber: _ignored, ...dtoWithoutNumber } = validDto;
    await service.createJob(dtoWithoutNumber, "user-1");
    expect(mocks.jobNumberService.generate).toHaveBeenCalledTimes(1);
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toBe("J-2026-038");
  });

  it("server-generates when caller sends empty/whitespace jobNumber", async () => {
    const { service, mocks } = buildMocks({ generatorOutput: "J-2026-039" });
    await service.createJob({ ...validDto, jobNumber: "   " }, "user-1");
    expect(mocks.jobNumberService.generate).toHaveBeenCalledTimes(1);
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toBe("J-2026-039");
  });

  // B05 — validation
  it("rejects non-canonical supplied jobNumber with 400 (legacy JOB- prefix)", async () => {
    const { service, mocks } = buildMocks();
    await expect(
      service.createJob({ ...validDto, jobNumber: "JOB-2026-001" }, "user-1")
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.jobCreate).not.toHaveBeenCalled();
    expect(mocks.jobNumberService.generate).not.toHaveBeenCalled();
  });

  // B02.1 — P2002 race fix
  it("translates P2002 race on prisma.job.create into 409 ConflictException", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test", meta: { target: ["job_number"] } }
    );
    const { service, mocks } = buildMocks({
      jobCreateImpl: async () => {
        throw p2002;
      }
    });
    await expect(service.createJob(validDto, "user-1")).rejects.toBeInstanceOf(ConflictException);
    expect(mocks.auditWrite).not.toHaveBeenCalled();
  });

  it("handles P2002 with string-shaped meta.target", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test", meta: { target: "jobs_job_number_key" } }
    );
    const { service } = buildMocks({
      jobCreateImpl: async () => {
        throw p2002;
      }
    });
    await expect(service.createJob(validDto, "user-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("does NOT translate P2002 on a different column — propagates unchanged", async () => {
    const p2002Other = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test", meta: { target: ["some_other_column"] } }
    );
    const { service } = buildMocks({
      jobCreateImpl: async () => {
        throw p2002Other;
      }
    });
    // Should propagate the original Prisma error, NOT a ConflictException.
    await expect(service.createJob(validDto, "user-1")).rejects.toBe(p2002Other);
  });

  it("propagates non-P2002 Prisma errors unchanged", async () => {
    const otherErr = new Error("disk full");
    const { service } = buildMocks({
      jobCreateImpl: async () => {
        throw otherErr;
      }
    });
    await expect(service.createJob(validDto, "user-1")).rejects.toBe(otherErr);
  });
});
