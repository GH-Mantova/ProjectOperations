import { AllocationsService } from "../allocations.service";
import { CompetencyGateResult } from "../../compliance/competency-gate";

type MockPrisma = {
  project: { findUnique: jest.Mock };
  projectAllocation: { findMany: jest.Mock; create: jest.Mock };
  projectActivityLog: { create: jest.Mock };
  auditLog: { create: jest.Mock };
};

function makePrisma(): MockPrisma {
  return {
    project: { findUnique: jest.fn() },
    projectAllocation: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn()
    },
    projectActivityLog: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) }
  };
}

function makeService(prisma: MockPrisma, complianceImpl?: jest.Mock) {
  const checkWorkerCompetency =
    complianceImpl ?? jest.fn().mockResolvedValue(allowResult());
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const email = { sendNotificationEmail: jest.fn().mockResolvedValue({}) };
  const compliance = { checkWorkerCompetency };
  const service = new AllocationsService(
    prisma as never,
    notifications as never,
    email as never,
    compliance as never
  );
  return { service, compliance, notifications, email };
}

function allowResult(): CompetencyGateResult {
  return { allowed: true, missing: [], expired: [], expiringSoon: [] };
}

const ACTOR = { userId: "user-1" };

function projectRow(overrides: Partial<{ requiredQualifications: string[] }> = {}) {
  return {
    id: "p-1",
    projectNumber: "IS-P001",
    name: "Test Project",
    requiredQualifications: overrides.requiredQualifications ?? []
  };
}

function workerAllocationRow(overrides: Partial<{ workerProfileId: string }> = {}) {
  return {
    id: "alloc-1",
    type: "WORKER",
    workerProfileId: overrides.workerProfileId ?? "w-1",
    workerProfile: {
      id: overrides.workerProfileId ?? "w-1",
      firstName: "Sam",
      lastName: "Worker",
      internalUserId: null
    },
    asset: null
  };
}

function assetAllocationRow() {
  return {
    id: "alloc-2",
    type: "ASSET",
    workerProfileId: null,
    workerProfile: null,
    asset: { id: "a-1", name: "Skid steer", assetCode: "AS-001" }
  };
}

const WORKER_DTO = {
  type: "WORKER" as const,
  workerProfileId: "w-1",
  startDate: "2026-06-10",
  endDate: null,
  roleOnProject: "Operator",
  notes: null
};

const ASSET_DTO = {
  type: "ASSET" as const,
  assetId: "a-1",
  startDate: "2026-06-10",
  endDate: null,
  roleOnProject: null,
  notes: null
};

describe("AllocationsService.create — competency gate (soft warn + audit)", () => {
  it("1. WORKER, no required quals → allowed, no audit", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const { service, compliance } = makeService(prisma);

    const result = await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(result.competency).toEqual(allowResult());
    expect(compliance.checkWorkerCompetency).toHaveBeenCalledWith("w-1", []);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("2. WORKER holds all required quals → allowed, no audit", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(
      projectRow({ requiredQualifications: ["asbestos_b", "white_card"] })
    );
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const { service } = makeService(
      prisma,
      jest.fn().mockResolvedValue(allowResult())
    );

    const result = await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(result.competency.allowed).toBe(true);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("3. WORKER missing a required qual → soft-warn + audit row, allocation still created", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(
      projectRow({ requiredQualifications: ["asbestos_b"] })
    );
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const gateResult: CompetencyGateResult = {
      allowed: false,
      missing: ["asbestos_b"],
      expired: [],
      expiringSoon: []
    };
    const { service } = makeService(prisma, jest.fn().mockResolvedValue(gateResult));

    const result = await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(result.allocation).toBeDefined();
    expect(result.competency).toEqual(gateResult);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: "user-1",
        action: "allocation.unqualified_override",
        entityType: "ProjectAllocation",
        entityId: "alloc-1",
        metadata: {
          projectId: "p-1",
          projectNumber: "IS-P001",
          workerProfileId: "w-1",
          requiredQualifications: ["asbestos_b"],
          missing: ["asbestos_b"],
          expired: [],
          expiringSoon: []
        }
      }
    });
  });

  it("4. WORKER has an expired qual → soft-warn + audit row", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(
      projectRow({ requiredQualifications: ["white_card"] })
    );
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const gateResult: CompetencyGateResult = {
      allowed: false,
      missing: [],
      expired: ["white_card"],
      expiringSoon: []
    };
    const { service } = makeService(prisma, jest.fn().mockResolvedValue(gateResult));

    const result = await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(result.competency).toEqual(gateResult);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create.mock.calls[0][0].data.metadata.expired).toEqual([
      "white_card"
    ]);
  });

  it("5. WORKER has an expiringSoon-only qual → allowed, NO audit row", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(
      projectRow({ requiredQualifications: ["first_aid"] })
    );
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const gateResult: CompetencyGateResult = {
      allowed: true,
      missing: [],
      expired: [],
      expiringSoon: ["first_aid"]
    };
    const { service } = makeService(prisma, jest.fn().mockResolvedValue(gateResult));

    const result = await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(result.competency).toEqual(gateResult);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("6. WORKER both missing AND expiringSoon → audit row written (missing dominates)", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(
      projectRow({ requiredQualifications: ["asbestos_b", "first_aid"] })
    );
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const gateResult: CompetencyGateResult = {
      allowed: false,
      missing: ["asbestos_b"],
      expired: [],
      expiringSoon: ["first_aid"]
    };
    const { service } = makeService(prisma, jest.fn().mockResolvedValue(gateResult));

    const result = await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(result.competency.allowed).toBe(false);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const metadata = prisma.auditLog.create.mock.calls[0][0].data.metadata;
    expect(metadata.missing).toEqual(["asbestos_b"]);
    expect(metadata.expiringSoon).toEqual(["first_aid"]);
  });

  it("7. ASSET allocation → empty competency, ComplianceService NOT called, no audit", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(
      projectRow({ requiredQualifications: ["asbestos_b"] })
    );
    prisma.projectAllocation.create.mockResolvedValue(assetAllocationRow());
    const { service, compliance } = makeService(prisma);

    const result = await service.create("p-1", ASSET_DTO as never, ACTOR);

    expect(result.competency).toEqual(allowResult());
    expect(compliance.checkWorkerCompetency).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("8. invalid date range throws before competency check (gate not invoked)", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    const { service, compliance } = makeService(prisma);

    await expect(
      service.create(
        "p-1",
        { ...WORKER_DTO, startDate: "2026-06-20", endDate: "2026-06-10" } as never,
        ACTOR
      )
    ).rejects.toThrow();

    expect(compliance.checkWorkerCompetency).not.toHaveBeenCalled();
    expect(prisma.projectAllocation.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
