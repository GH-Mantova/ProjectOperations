import { NotFoundException } from "@nestjs/common";
import { ComplianceService } from "../compliance.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function makeService(opts: {
  workerExists?: boolean;
  workerQuals?: Array<{ qualType: string; expiryDate: Date | null }>;
} = {}) {
  const workerProfileFindUnique: AsyncMock = jest.fn(async () =>
    opts.workerExists === false ? null : { id: "worker-1" }
  );
  const workerQualificationFindMany: AsyncMock = jest.fn(async () => opts.workerQuals ?? []);

  const prisma = {
    workerProfile: { findUnique: workerProfileFindUnique },
    workerQualification: { findMany: workerQualificationFindMany }
  };
  const notifications = {};
  const email = {};
  const service = new ComplianceService(prisma as never, notifications as never, email as never);
  return { service, mocks: { workerProfileFindUnique, workerQualificationFindMany } };
}

describe("ComplianceService.checkWorkerCompetency (service-level, roadmap §7)", () => {
  it("throws NotFoundException when the worker profile does not exist", async () => {
    const { service, mocks } = makeService({ workerExists: false });
    await expect(service.checkWorkerCompetency("missing", ["asbestos_b"]))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(mocks.workerQualificationFindMany).not.toHaveBeenCalled();
  });

  it("returns a passing gate when the worker holds every required, unexpired qual", async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      workerQuals: [
        { qualType: "asbestos_b", expiryDate: future },
        { qualType: "white_card", expiryDate: future }
      ]
    });
    const result = await service.checkWorkerCompetency("worker-1", ["asbestos_b", "white_card"]);
    expect(result).toEqual({
      allowed: true,
      missing: [],
      expired: [],
      expiringSoon: []
    });
  });

  it("blocks and surfaces the missing qual codes", async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      workerQuals: [{ qualType: "white_card", expiryDate: future }]
    });
    const result = await service.checkWorkerCompetency("worker-1", ["asbestos_b", "white_card"]);
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(["asbestos_b"]);
  });

  it("blocks and surfaces expired qual codes", async () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      workerQuals: [
        { qualType: "asbestos_b", expiryDate: past },
        { qualType: "white_card", expiryDate: future }
      ]
    });
    const result = await service.checkWorkerCompetency("worker-1", ["asbestos_b", "white_card"]);
    expect(result.allowed).toBe(false);
    expect(result.expired).toEqual(["asbestos_b"]);
  });

  it("requests only the columns it needs from Prisma", async () => {
    const { service, mocks } = makeService({ workerQuals: [] });
    await service.checkWorkerCompetency("worker-1", ["asbestos_b"]);
    const args = mocks.workerQualificationFindMany.mock.calls[0]?.[0] as {
      where: { workerProfileId: string };
      select: { qualType: boolean; expiryDate: boolean };
    };
    expect(args.where.workerProfileId).toBe("worker-1");
    expect(args.select.qualType).toBe(true);
    expect(args.select.expiryDate).toBe(true);
  });
});
