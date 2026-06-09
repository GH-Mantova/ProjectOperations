import { AllocationsService } from "../allocations.service";
import { CompetencyGateResult } from "../../compliance/competency-gate";

type MockPrisma = {
  project: { findUnique: jest.Mock };
  projectAllocation: {
    findMany: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  projectActivityLog: { create: jest.Mock };
  auditLog: { create: jest.Mock };
};

function makePrisma(): MockPrisma {
  return {
    project: { findUnique: jest.fn() },
    projectAllocation: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({})
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

describe("AllocationsService.create — DTO validation", () => {
  it("WORKER without workerProfileId throws BadRequest", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    const { service } = makeService(prisma);

    await expect(
      service.create(
        "p-1",
        { ...WORKER_DTO, workerProfileId: undefined } as never,
        ACTOR
      )
    ).rejects.toThrow("WORKER allocations require workerProfileId");
    expect(prisma.projectAllocation.create).not.toHaveBeenCalled();
  });

  it("WORKER with assetId set throws BadRequest", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    const { service } = makeService(prisma);

    await expect(
      service.create(
        "p-1",
        { ...WORKER_DTO, assetId: "a-1" } as never,
        ACTOR
      )
    ).rejects.toThrow("WORKER allocations require workerProfileId");
    expect(prisma.projectAllocation.create).not.toHaveBeenCalled();
  });

  it("ASSET without assetId throws BadRequest", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    const { service } = makeService(prisma);

    await expect(
      service.create(
        "p-1",
        { ...ASSET_DTO, assetId: undefined } as never,
        ACTOR
      )
    ).rejects.toThrow("ASSET allocations require assetId");
    expect(prisma.projectAllocation.create).not.toHaveBeenCalled();
  });

  it("ASSET with workerProfileId set throws BadRequest", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    const { service } = makeService(prisma);

    await expect(
      service.create(
        "p-1",
        { ...ASSET_DTO, workerProfileId: "w-1" } as never,
        ACTOR
      )
    ).rejects.toThrow("ASSET allocations require assetId");
    expect(prisma.projectAllocation.create).not.toHaveBeenCalled();
  });

  it("project not found throws NotFound before any further work", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(null);
    const { service, compliance } = makeService(prisma);

    await expect(
      service.create("missing-project", WORKER_DTO as never, ACTOR)
    ).rejects.toThrow("Project not found");

    expect(prisma.projectAllocation.create).not.toHaveBeenCalled();
    expect(prisma.projectAllocation.findMany).not.toHaveBeenCalled();
    expect(compliance.checkWorkerCompetency).not.toHaveBeenCalled();
  });
});

describe("AllocationsService.create — overlap detection (WORKER)", () => {
  it("returns warnings when worker has overlapping allocations on other active projects", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.findMany.mockResolvedValue([
      {
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-30"),
        project: { id: "p-other", projectNumber: "IS-P099", name: "Other Project" }
      }
    ]);
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const { service } = makeService(prisma);

    const result = await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toEqual({
      projectId: "p-other",
      projectNumber: "IS-P099",
      projectName: "Other Project",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-06-30")
    });
  });

  it("queries overlap excluding current project and only MOBILISING/ACTIVE status", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const { service } = makeService(prisma);

    await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(prisma.projectAllocation.findMany).toHaveBeenCalledTimes(1);
    const where = prisma.projectAllocation.findMany.mock.calls[0][0].where;
    expect(where.type).toBe("WORKER");
    expect(where.workerProfileId).toBe("w-1");
    expect(where.projectId).toEqual({ not: "p-1" });
    expect(where.project).toEqual({ status: { in: ["MOBILISING", "ACTIVE"] } });
  });

  it("returns empty warnings array when no overlap rows are found", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const { service } = makeService(prisma);

    const result = await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(result.warnings).toEqual([]);
  });

  it("ASSET allocations do NOT query for worker overlaps", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.create.mockResolvedValue(assetAllocationRow());
    const { service } = makeService(prisma);

    const result = await service.create("p-1", ASSET_DTO as never, ACTOR);

    expect(prisma.projectAllocation.findMany).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
  });
});

describe("AllocationsService.create — activity log, notifications, email", () => {
  it("WORKER writes WORKER_ALLOCATED activity log + sends email", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const { service, email } = makeService(prisma);

    await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(prisma.projectActivityLog.create).toHaveBeenCalledTimes(1);
    const logCall = prisma.projectActivityLog.create.mock.calls[0][0];
    expect(logCall.data.action).toBe("WORKER_ALLOCATED");
    expect(logCall.data.projectId).toBe("p-1");
    expect(logCall.data.userId).toBe("user-1");
    expect(logCall.data.details.targetId).toBe("w-1");
    expect(logCall.data.details.targetName).toBe("Sam Worker");

    expect(email.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(email.sendNotificationEmail.mock.calls[0][0].trigger).toBe(
      "worker.allocated"
    );
  });

  it("ASSET writes ASSET_ALLOCATED activity log + does NOT send email", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.create.mockResolvedValue(assetAllocationRow());
    const { service, email } = makeService(prisma);

    await service.create("p-1", ASSET_DTO as never, ACTOR);

    expect(prisma.projectActivityLog.create).toHaveBeenCalledTimes(1);
    const logCall = prisma.projectActivityLog.create.mock.calls[0][0];
    expect(logCall.data.action).toBe("ASSET_ALLOCATED");
    expect(logCall.data.details.targetId).toBe("a-1");
    expect(logCall.data.details.targetName).toBe("Skid steer (AS-001)");

    expect(email.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("WORKER with linked internalUserId triggers in-app notification", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.create.mockResolvedValue({
      ...workerAllocationRow(),
      workerProfile: {
        id: "w-1",
        firstName: "Sam",
        lastName: "Worker",
        internalUserId: "u-99"
      }
    });
    const { service, notifications } = makeService(prisma);

    await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(notifications.create).toHaveBeenCalledTimes(1);
    const [payload, actorUserId] = notifications.create.mock.calls[0];
    expect(payload.userId).toBe("u-99");
    expect(payload.linkUrl).toBe("/projects/p-1");
    expect(payload.severity).toBe("LOW");
    expect(actorUserId).toBe("user-1");
  });

  it("WORKER without internalUserId skips in-app notification", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(projectRow());
    prisma.projectAllocation.create.mockResolvedValue(workerAllocationRow());
    const { service, notifications } = makeService(prisma);

    await service.create("p-1", WORKER_DTO as never, ACTOR);

    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe("AllocationsService.listForProject", () => {
  it("throws NotFound when project does not exist", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue(null);
    const { service } = makeService(prisma);

    await expect(service.listForProject("missing")).rejects.toThrow(
      "Project not found"
    );
    expect(prisma.projectAllocation.findMany).not.toHaveBeenCalled();
  });

  it("separates WORKER and ASSET rows into shape expected by controller", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue({ id: "p-1" });
    prisma.projectAllocation.findMany.mockResolvedValue([
      {
        id: "alloc-w",
        type: "WORKER",
        roleOnProject: "Operator",
        startDate: new Date("2026-06-10"),
        endDate: null,
        notes: "shift A",
        workerProfile: { id: "w-1", firstName: "Sam", lastName: "Worker", role: "OPERATOR" },
        asset: null
      },
      {
        id: "alloc-a",
        type: "ASSET",
        roleOnProject: null,
        startDate: new Date("2026-06-11"),
        endDate: new Date("2026-06-12"),
        notes: null,
        workerProfile: null,
        asset: {
          id: "a-1",
          name: "Skid steer",
          assetCode: "AS-001",
          category: { name: "Plant" }
        }
      }
    ]);
    const { service } = makeService(prisma);

    const result = await service.listForProject("p-1");

    expect(result.workers).toHaveLength(1);
    expect(result.workers[0]).toMatchObject({
      id: "alloc-w",
      roleOnProject: "Operator",
      notes: "shift A",
      workerProfile: { id: "w-1", firstName: "Sam", lastName: "Worker", role: "OPERATOR" }
    });

    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      id: "alloc-a",
      asset: { id: "a-1", name: "Skid steer", assetNumber: "AS-001", category: "Plant" }
    });
  });

  it("ASSET row with null asset relation surfaces asset:null in the projection", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue({ id: "p-1" });
    prisma.projectAllocation.findMany.mockResolvedValue([
      {
        id: "alloc-a",
        type: "ASSET",
        roleOnProject: null,
        startDate: new Date("2026-06-11"),
        endDate: null,
        notes: null,
        workerProfile: null,
        asset: null
      }
    ]);
    const { service } = makeService(prisma);

    const result = await service.listForProject("p-1");

    expect(result.assets[0].asset).toBeNull();
  });

  it("ASSET with null category surfaces category:null", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue({ id: "p-1" });
    prisma.projectAllocation.findMany.mockResolvedValue([
      {
        id: "alloc-a",
        type: "ASSET",
        roleOnProject: null,
        startDate: new Date("2026-06-11"),
        endDate: null,
        notes: null,
        workerProfile: null,
        asset: { id: "a-1", name: "Hand tool", assetCode: "AS-002", category: null }
      }
    ]);
    const { service } = makeService(prisma);

    const result = await service.listForProject("p-1");

    expect(result.assets[0].asset).toEqual({
      id: "a-1",
      name: "Hand tool",
      assetNumber: "AS-002",
      category: null
    });
  });

  it("returns empty groups when no allocations exist", async () => {
    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue({ id: "p-1" });
    prisma.projectAllocation.findMany.mockResolvedValue([]);
    const { service } = makeService(prisma);

    const result = await service.listForProject("p-1");

    expect(result.workers).toEqual([]);
    expect(result.assets).toEqual([]);
  });
});

describe("AllocationsService.update", () => {
  it("throws NotFound when allocation does not exist", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue(null);
    const { service } = makeService(prisma);

    await expect(
      service.update("p-1", "missing", { roleOnProject: "X" } as never)
    ).rejects.toThrow("Allocation not found");
    expect(prisma.projectAllocation.update).not.toHaveBeenCalled();
  });

  it("throws NotFound when allocation belongs to a different project", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      projectId: "p-OTHER",
      startDate: new Date("2026-06-10"),
      endDate: null
    });
    const { service } = makeService(prisma);

    await expect(
      service.update("p-1", "alloc-1", { roleOnProject: "X" } as never)
    ).rejects.toThrow("Allocation not found");
    expect(prisma.projectAllocation.update).not.toHaveBeenCalled();
  });

  it("throws BadRequest when new endDate is before new startDate", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      projectId: "p-1",
      startDate: new Date("2026-06-10"),
      endDate: null
    });
    const { service } = makeService(prisma);

    await expect(
      service.update("p-1", "alloc-1", {
        startDate: "2026-06-20",
        endDate: "2026-06-15"
      } as never)
    ).rejects.toThrow("endDate must be on or after startDate");
    expect(prisma.projectAllocation.update).not.toHaveBeenCalled();
  });

  it("throws BadRequest when new endDate is before existing startDate (no startDate in dto)", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      projectId: "p-1",
      startDate: new Date("2026-06-20"),
      endDate: null
    });
    const { service } = makeService(prisma);

    await expect(
      service.update("p-1", "alloc-1", { endDate: "2026-06-10" } as never)
    ).rejects.toThrow("endDate must be on or after startDate");
  });

  it("partial update — only roleOnProject — does not touch start/end dates", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      projectId: "p-1",
      startDate: new Date("2026-06-10"),
      endDate: null
    });
    prisma.projectAllocation.update.mockResolvedValue({ id: "alloc-1" });
    const { service } = makeService(prisma);

    await service.update("p-1", "alloc-1", { roleOnProject: "Supervisor" } as never);

    const updateArgs = prisma.projectAllocation.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "alloc-1" });
    expect(updateArgs.data).toEqual({
      roleOnProject: "Supervisor",
      startDate: undefined,
      endDate: undefined,
      notes: undefined
    });
  });

  it("update with new startDate + endDate passes Date instances to prisma", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      projectId: "p-1",
      startDate: new Date("2026-06-10"),
      endDate: null
    });
    prisma.projectAllocation.update.mockResolvedValue({ id: "alloc-1" });
    const { service } = makeService(prisma);

    await service.update("p-1", "alloc-1", {
      startDate: "2026-07-01",
      endDate: "2026-07-15",
      notes: "extended"
    } as never);

    const updateArgs = prisma.projectAllocation.update.mock.calls[0][0];
    expect(updateArgs.data.startDate).toEqual(new Date("2026-07-01"));
    expect(updateArgs.data.endDate).toEqual(new Date("2026-07-15"));
    expect(updateArgs.data.notes).toBe("extended");
  });
});

describe("AllocationsService.remove", () => {
  it("throws NotFound when allocation does not exist", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue(null);
    const { service } = makeService(prisma);

    await expect(service.remove("p-1", "missing")).rejects.toThrow(
      "Allocation not found"
    );
    expect(prisma.projectAllocation.delete).not.toHaveBeenCalled();
  });

  it("throws NotFound when allocation belongs to a different project", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      projectId: "p-OTHER"
    });
    const { service } = makeService(prisma);

    await expect(service.remove("p-1", "alloc-1")).rejects.toThrow(
      "Allocation not found"
    );
    expect(prisma.projectAllocation.delete).not.toHaveBeenCalled();
  });

  it("deletes the row and returns { deleted: true } on success", async () => {
    const prisma = makePrisma();
    prisma.projectAllocation.findUnique.mockResolvedValue({
      id: "alloc-1",
      projectId: "p-1"
    });
    const { service } = makeService(prisma);

    const result = await service.remove("p-1", "alloc-1");

    expect(prisma.projectAllocation.delete).toHaveBeenCalledWith({
      where: { id: "alloc-1" }
    });
    expect(result).toEqual({ deleted: true });
  });
});
