// Specs for createJob covering G5 server-generated job numbers
// (J{YYMMDD}-{SLUG}-{NNN}), the pre-check 409, P2002 race 409, and the
// long-standing happy/error paths from B02.
//
// Mocks Prisma + JobNumberService and drives the service directly.
// Mirrors the cutting-create-cardid.spec.ts pattern.

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { JobsService } from "../jobs.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

const GENERATED = { jobNumber: "J260612-ACME-001", clientSlugSnapshot: "ACME" };

function buildMocks(opts: {
  clientExists?: boolean;
  siteExists?: boolean;
  jobNumberTaken?: boolean;
  createdJob?: { id: string; jobNumber: string };
  jobCreateImpl?: (...args: unknown[]) => Promise<unknown>;
  generatorOutput?: { jobNumber: string; clientSlugSnapshot: string };
} = {}) {
  const generated = opts.generatorOutput ?? GENERATED;
  const clientFindUnique: AsyncMock = jest.fn(async () =>
    opts.clientExists === false ? null : { id: "client-1", name: "Acme Infrastructure" }
  );
  const siteFindUnique: AsyncMock = jest.fn(async () =>
    opts.siteExists === false ? null : { id: "site-1" }
  );
  const jobFindUnique: AsyncMock = jest.fn();
  const createdJob = opts.createdJob ?? { id: "job-new", jobNumber: generated.jobNumber };
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
    generate: jest.fn(async () => generated)
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
  name: "Manual Test Job",
  clientId: "client-1",
  status: "PLANNING"
};

describe("JobsService.createJob (G5 — server-generated canonical IDs + race-fix)", () => {
  it("happy path: creates the job with the generated number + slug, writes audit", async () => {
    const { service, mocks } = buildMocks();
    const result = await service.createJob(validDto, "user-1");
    expect(result).toBeDefined();
    expect(mocks.jobNumberService.generate).toHaveBeenCalledWith("client-1", "Acme Infrastructure");
    expect(mocks.jobCreate).toHaveBeenCalledTimes(1);
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.jobNumber).toBe("J260612-ACME-001");
    expect(data.clientSlugSnapshot).toBe("ACME");
    expect(data.name).toBe("Manual Test Job");
    expect(data.clientId).toBe("client-1");
    expect(data.status).toBe("PLANNING");
    // siteId defaults to the seeded "Unassigned" Site since siteId became NOT
    // NULL in 20260716140000_site_id_not_null_backfill.
    expect(data.siteId).toBe("site-unassigned");
    expect(mocks.auditWrite).toHaveBeenCalledTimes(1);
    const auditArgs = mocks.auditWrite.mock.calls[0]?.[0] as { action: string; entityType: string };
    expect(auditArgs.action).toBe("jobs.create");
    expect(auditArgs.entityType).toBe("Job");
  });

  it("trims string inputs and defaults status to PLANNING when omitted", async () => {
    const { service, mocks } = buildMocks();
    await service.createJob(
      { name: "  Trim Me  ", clientId: " client-1 " },
      "user-1"
    );
    const data = (mocks.jobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.name).toBe("Trim Me");
    expect(data.clientId).toBe("client-1");
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
    expect(mocks.jobNumberService.generate).not.toHaveBeenCalled();
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

  it("throws ConflictException when the generated jobNumber is already taken (pre-check)", async () => {
    const { service, mocks } = buildMocks({ jobNumberTaken: true });
    await expect(service.createJob(validDto, "user-1")).rejects.toBeInstanceOf(ConflictException);
    expect(mocks.jobCreate).not.toHaveBeenCalled();
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
