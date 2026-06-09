// Mock-based unit tests for ResourcesService.
// Mirrors PR #283 (ProjectsService), PR #298 (FormsService), PR #311 (SchedulerService),
// PR #328 (DirectoryService), PR #329 (MasterDataService), PR #330 (AssetsService).
//
// Drives the service directly with plain-object Prisma / Audit stubs in the same
// shape as the pre-existing narrow resources.service.spec.ts alongside this file.
// No production code is modified.

import { ConflictException, NotFoundException } from "@nestjs/common";
import { ResourcesService } from "../resources.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

function workerRow(overrides: AnyRecord = {}) {
  return {
    id: "worker-1",
    firstName: "Alex",
    lastName: "Smith",
    employeeCode: "EMP-001",
    resourceTypeId: "rt-1",
    resourceType: { id: "rt-1", name: "Plant operator" },
    competencies: [],
    availabilityWindows: [],
    roleSuitabilities: [],
    shiftAssignments: [],
    ...overrides
  };
}

function availabilityWindowRow(overrides: AnyRecord = {}) {
  return {
    id: "aw-1",
    workerId: "worker-1",
    startAt: new Date("2026-06-10T06:00:00.000Z"),
    endAt: new Date("2026-06-10T14:00:00.000Z"),
    status: "AVAILABLE",
    notes: null,
    ...overrides
  };
}

function roleSuitabilityRow(overrides: AnyRecord = {}) {
  return {
    id: "rs-1",
    workerId: "worker-1",
    roleLabel: "Leading Hand",
    suitability: "SUITABLE",
    notes: null,
    ...overrides
  };
}

function shiftRequirementRow(overrides: AnyRecord = {}) {
  return {
    id: "req-1",
    shiftId: "shift-1",
    roleLabel: "Operator",
    competencyId: "comp-1",
    requiredCount: 1,
    competency: { id: "comp-1", name: "EWP licence" },
    ...overrides
  };
}

// ─── Mock builders ─────────────────────────────────────────────────────────

function tableCRUD() {
  return {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest
      .fn()
      .mockImplementation(async ({ data }: { data: AnyRecord }) => ({
        id: "new-id",
        ...data
      })),
    update: jest
      .fn()
      .mockImplementation(
        async ({ where, data }: { where: { id: string }; data: AnyRecord }) => ({
          id: where.id,
          ...data
        })
      )
  };
}

function buildPrismaMock() {
  return {
    worker: tableCRUD(),
    availabilityWindow: tableCRUD(),
    workerRoleSuitability: tableCRUD(),
    shiftRoleRequirement: tableCRUD(),
    shift: tableCRUD(),
    $transaction: jest
      .fn()
      .mockImplementation(async (ops: Array<Promise<unknown>>) =>
        Promise.all(ops)
      )
  };
}

function buildAudit() {
  return { write: jest.fn().mockResolvedValue(undefined) };
}

function buildService() {
  const prisma = buildPrismaMock();
  const audit = buildAudit();
  const service = new ResourcesService(prisma as never, audit as never);
  return { service, prisma, audit };
}

// ─── getWorker ─────────────────────────────────────────────────────────────

describe("ResourcesService.getWorker", () => {
  it("returns the hydrated worker on hit", async () => {
    const { service, prisma } = buildService();
    const row = workerRow();
    prisma.worker.findUnique.mockResolvedValueOnce(row);

    const result = await service.getWorker("worker-1");

    expect(result).toBe(row);
    expect(prisma.worker.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "worker-1" },
        include: expect.objectContaining({
          resourceType: true,
          competencies: { include: { competency: true } },
          availabilityWindows: { orderBy: { startAt: "asc" } },
          roleSuitabilities: { orderBy: { roleLabel: "asc" } }
        })
      })
    );
  });

  it("includes shiftAssignments ordered by assignedAt desc with nested job/activity/conflicts", async () => {
    const { service, prisma } = buildService();
    prisma.worker.findUnique.mockResolvedValueOnce(workerRow());

    await service.getWorker("worker-1");

    const callArg = prisma.worker.findUnique.mock.calls[0][0] as {
      include: { shiftAssignments: AnyRecord };
    };
    expect(callArg.include.shiftAssignments).toMatchObject({
      orderBy: { assignedAt: "desc" }
    });
    const shiftInclude = (
      callArg.include.shiftAssignments as { include: { shift: { include: AnyRecord } } }
    ).include.shift.include;
    expect(shiftInclude).toHaveProperty("job");
    expect(shiftInclude).toHaveProperty("activity");
    expect(shiftInclude).toHaveProperty("conflicts");
  });

  it("throws NotFoundException when worker missing", async () => {
    const { service, prisma } = buildService();
    prisma.worker.findUnique.mockResolvedValueOnce(null);

    await expect(service.getWorker("missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

// ─── listWorkers ───────────────────────────────────────────────────────────

const PAGE_QUERY: { page: number; pageSize: number } = { page: 1, pageSize: 10 };

describe("ResourcesService.listWorkers", () => {
  it("returns paginated payload with empty where on a bare query", async () => {
    const { service, prisma } = buildService();
    const items = [workerRow()];
    prisma.worker.findMany.mockResolvedValueOnce(items);
    prisma.worker.count.mockResolvedValueOnce(1);

    const result = await service.listWorkers({ ...PAGE_QUERY } as never);

    expect(result).toEqual({ items, total: 1, page: 1, pageSize: 10 });
    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 10,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      })
    );
    expect(prisma.worker.count).toHaveBeenCalledWith({ where: {} });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("computes skip from (page - 1) * pageSize", async () => {
    const { service, prisma } = buildService();
    prisma.worker.findMany.mockResolvedValueOnce([]);
    prisma.worker.count.mockResolvedValueOnce(0);

    await service.listWorkers({ page: 3, pageSize: 25 } as never);

    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25 })
    );
  });

  it("builds a 3-way OR across firstName | lastName | employeeCode when q is set", async () => {
    const { service, prisma } = buildService();
    prisma.worker.findMany.mockResolvedValueOnce([]);
    prisma.worker.count.mockResolvedValueOnce(0);

    await service.listWorkers({ ...PAGE_QUERY, q: "smith" } as never);

    const callArg = prisma.worker.findMany.mock.calls[0][0] as {
      where: { OR: Array<AnyRecord> };
    };
    expect(callArg.where.OR).toEqual([
      { firstName: { contains: "smith", mode: "insensitive" } },
      { lastName: { contains: "smith", mode: "insensitive" } },
      { employeeCode: { contains: "smith", mode: "insensitive" } }
    ]);
  });

  it("narrows by competencyId via a nested some filter", async () => {
    const { service, prisma } = buildService();
    prisma.worker.findMany.mockResolvedValueOnce([]);
    prisma.worker.count.mockResolvedValueOnce(0);

    await service.listWorkers({
      ...PAGE_QUERY,
      competencyId: "comp-99"
    } as never);

    expect(prisma.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { competencies: { some: { competencyId: "comp-99" } } }
      })
    );
  });

  it("combines q and competencyId filters", async () => {
    const { service, prisma } = buildService();
    prisma.worker.findMany.mockResolvedValueOnce([]);
    prisma.worker.count.mockResolvedValueOnce(0);

    await service.listWorkers({
      ...PAGE_QUERY,
      q: "alex",
      competencyId: "comp-7"
    } as never);

    const callArg = prisma.worker.findMany.mock.calls[0][0] as {
      where: { OR?: unknown; competencies?: unknown };
    };
    expect(callArg.where).toHaveProperty("OR");
    expect(callArg.where.competencies).toEqual({
      some: { competencyId: "comp-7" }
    });
  });

  it("wraps findMany + count in a single $transaction", async () => {
    const { service, prisma } = buildService();
    prisma.worker.findMany.mockResolvedValueOnce([workerRow()]);
    prisma.worker.count.mockResolvedValueOnce(1);

    await service.listWorkers({ ...PAGE_QUERY } as never);

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Promise), expect.any(Promise)])
    );
  });
});

// ─── upsertAvailabilityWindow ──────────────────────────────────────────────

describe("ResourcesService.upsertAvailabilityWindow", () => {
  const dto = {
    workerId: "worker-1",
    startAt: "2026-06-10T06:00:00.000Z",
    endAt: "2026-06-10T14:00:00.000Z"
  };

  it("create branch: writes record, coerces dates, defaults status to AVAILABLE, audits .create", async () => {
    const { service, prisma, audit } = buildService();
    prisma.availabilityWindow.create.mockResolvedValueOnce(
      availabilityWindowRow({ id: "aw-new" })
    );

    const result = await service.upsertAvailabilityWindow(undefined, dto, "user-1");

    expect(result).toMatchObject({ id: "aw-new" });
    expect(prisma.availabilityWindow.update).not.toHaveBeenCalled();
    const createArg = prisma.availabilityWindow.create.mock.calls[0][0] as {
      data: { startAt: Date; endAt: Date; status: string };
    };
    expect(createArg.data.startAt).toBeInstanceOf(Date);
    expect(createArg.data.endAt).toBeInstanceOf(Date);
    expect(createArg.data.startAt.toISOString()).toBe(dto.startAt);
    expect(createArg.data.status).toBe("AVAILABLE");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "resources.availability.create",
        entityType: "AvailabilityWindow",
        entityId: "aw-new"
      })
    );
  });

  it("honours explicit status override on create", async () => {
    const { service, prisma } = buildService();
    prisma.availabilityWindow.create.mockResolvedValueOnce(
      availabilityWindowRow({ id: "aw-new", status: "ON_LEAVE" })
    );

    await service.upsertAvailabilityWindow(
      undefined,
      { ...dto, status: "ON_LEAVE", notes: "Annual leave" },
      "user-1"
    );

    const createArg = prisma.availabilityWindow.create.mock.calls[0][0] as {
      data: { status: string; notes: string | undefined };
    };
    expect(createArg.data.status).toBe("ON_LEAVE");
    expect(createArg.data.notes).toBe("Annual leave");
  });

  it("update branch: scopes by id, audits .update", async () => {
    const { service, prisma, audit } = buildService();
    prisma.availabilityWindow.update.mockResolvedValueOnce(
      availabilityWindowRow({ id: "aw-existing" })
    );

    const result = await service.upsertAvailabilityWindow("aw-existing", dto, "user-1");

    expect(result).toMatchObject({ id: "aw-existing" });
    expect(prisma.availabilityWindow.create).not.toHaveBeenCalled();
    expect(prisma.availabilityWindow.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "aw-existing" } })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "resources.availability.update",
        entityId: "aw-existing"
      })
    );
  });

  it("forwards undefined actor to audit when not supplied", async () => {
    const { service, prisma, audit } = buildService();
    prisma.availabilityWindow.create.mockResolvedValueOnce(
      availabilityWindowRow({ id: "aw-new" })
    );

    await service.upsertAvailabilityWindow(undefined, dto);

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: undefined })
    );
  });
});

// ─── upsertWorkerRoleSuitability ───────────────────────────────────────────

describe("ResourcesService.upsertWorkerRoleSuitability", () => {
  const dto = { workerId: "worker-1", roleLabel: "Leading Hand" };

  it("create branch: no existing → creates, defaults suitability to SUITABLE, audits .create", async () => {
    const { service, prisma, audit } = buildService();
    prisma.workerRoleSuitability.findFirst.mockResolvedValueOnce(null);
    prisma.workerRoleSuitability.create.mockResolvedValueOnce(
      roleSuitabilityRow({ id: "rs-new" })
    );

    const result = await service.upsertWorkerRoleSuitability(undefined, dto, "user-1");

    expect(result).toMatchObject({ id: "rs-new" });
    expect(prisma.workerRoleSuitability.findFirst).toHaveBeenCalledWith({
      where: { workerId: "worker-1", roleLabel: "Leading Hand" }
    });
    const createArg = prisma.workerRoleSuitability.create.mock.calls[0][0] as {
      data: { suitability: string };
    };
    expect(createArg.data.suitability).toBe("SUITABLE");
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "resources.role-suitability.create",
        entityType: "WorkerRoleSuitability",
        entityId: "rs-new"
      })
    );
  });

  it("create branch: existing row → throws ConflictException, never writes, never audits", async () => {
    const { service, prisma, audit } = buildService();
    prisma.workerRoleSuitability.findFirst.mockResolvedValueOnce({
      id: "rs-existing"
    });

    await expect(
      service.upsertWorkerRoleSuitability(undefined, dto, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.workerRoleSuitability.create).not.toHaveBeenCalled();
    expect(prisma.workerRoleSuitability.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("update branch: skips the duplicate guard, scopes by id, audits .update", async () => {
    const { service, prisma, audit } = buildService();
    prisma.workerRoleSuitability.update.mockResolvedValueOnce(
      roleSuitabilityRow({ id: "rs-existing" })
    );

    await service.upsertWorkerRoleSuitability("rs-existing", dto, "user-1");

    expect(prisma.workerRoleSuitability.findFirst).not.toHaveBeenCalled();
    expect(prisma.workerRoleSuitability.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rs-existing" } })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "resources.role-suitability.update",
        entityId: "rs-existing"
      })
    );
  });

  it("honours explicit suitability override on create", async () => {
    const { service, prisma } = buildService();
    prisma.workerRoleSuitability.findFirst.mockResolvedValueOnce(null);
    prisma.workerRoleSuitability.create.mockResolvedValueOnce(
      roleSuitabilityRow({ id: "rs-new", suitability: "NOT_SUITABLE" })
    );

    await service.upsertWorkerRoleSuitability(
      undefined,
      { ...dto, suitability: "NOT_SUITABLE", notes: "Pending training" },
      "user-1"
    );

    const createArg = prisma.workerRoleSuitability.create.mock.calls[0][0] as {
      data: { suitability: string; notes: string | undefined };
    };
    expect(createArg.data.suitability).toBe("NOT_SUITABLE");
    expect(createArg.data.notes).toBe("Pending training");
  });
});

// ─── listShiftRequirements ─────────────────────────────────────────────────

describe("ResourcesService.listShiftRequirements", () => {
  it("returns requirements scoped to shiftId, includes competency, ordered by createdAt asc", async () => {
    const { service, prisma } = buildService();
    const rows = [shiftRequirementRow()];
    prisma.shiftRoleRequirement.findMany.mockResolvedValueOnce(rows);

    const result = await service.listShiftRequirements("shift-1");

    expect(result).toBe(rows);
    expect(prisma.shiftRoleRequirement.findMany).toHaveBeenCalledWith({
      where: { shiftId: "shift-1" },
      include: { competency: true },
      orderBy: { createdAt: "asc" }
    });
  });
});

// ─── upsertShiftRequirement ────────────────────────────────────────────────

describe("ResourcesService.upsertShiftRequirement", () => {
  const dto = { roleLabel: "Operator", competencyId: "comp-1", requiredCount: 2 };

  it("throws NotFoundException when shift missing and never writes", async () => {
    const { service, prisma, audit } = buildService();
    prisma.shift.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.upsertShiftRequirement("missing", undefined, dto, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.shiftRoleRequirement.create).not.toHaveBeenCalled();
    expect(prisma.shiftRoleRequirement.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("create branch: writes record with shiftId, audits .create with shiftId metadata, returns refreshed list", async () => {
    const { service, prisma, audit } = buildService();
    prisma.shift.findUnique.mockResolvedValueOnce({ id: "shift-1" });
    prisma.shiftRoleRequirement.create.mockResolvedValueOnce(
      shiftRequirementRow({ id: "req-new" })
    );
    const refreshed = [shiftRequirementRow({ id: "req-new" })];
    prisma.shiftRoleRequirement.findMany.mockResolvedValueOnce(refreshed);

    const result = await service.upsertShiftRequirement(
      "shift-1",
      undefined,
      dto,
      "user-1"
    );

    expect(result).toBe(refreshed);
    const createArg = prisma.shiftRoleRequirement.create.mock.calls[0][0] as {
      data: { shiftId: string; competencyId: string | null; requiredCount: number };
    };
    expect(createArg.data.shiftId).toBe("shift-1");
    expect(createArg.data.competencyId).toBe("comp-1");
    expect(createArg.data.requiredCount).toBe(2);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "resources.shift-requirement.create",
        entityType: "ShiftRoleRequirement",
        entityId: "req-new",
        metadata: { shiftId: "shift-1" }
      })
    );
  });

  it("create branch: nullable competencyId defaults to null, requiredCount defaults to 1", async () => {
    const { service, prisma } = buildService();
    prisma.shift.findUnique.mockResolvedValueOnce({ id: "shift-1" });
    prisma.shiftRoleRequirement.create.mockResolvedValueOnce(
      shiftRequirementRow({ id: "req-new" })
    );
    prisma.shiftRoleRequirement.findMany.mockResolvedValueOnce([]);

    await service.upsertShiftRequirement(
      "shift-1",
      undefined,
      { roleLabel: "Trade Assistant" } as never,
      "user-1"
    );

    const createArg = prisma.shiftRoleRequirement.create.mock.calls[0][0] as {
      data: { competencyId: string | null; requiredCount: number };
    };
    expect(createArg.data.competencyId).toBeNull();
    expect(createArg.data.requiredCount).toBe(1);
  });

  it("update branch: scopes by id, audits .update with shiftId metadata", async () => {
    const { service, prisma, audit } = buildService();
    prisma.shift.findUnique.mockResolvedValueOnce({ id: "shift-1" });
    prisma.shiftRoleRequirement.update.mockResolvedValueOnce(
      shiftRequirementRow({ id: "req-existing" })
    );
    prisma.shiftRoleRequirement.findMany.mockResolvedValueOnce([]);

    await service.upsertShiftRequirement(
      "shift-1",
      "req-existing",
      dto,
      "user-1"
    );

    expect(prisma.shiftRoleRequirement.create).not.toHaveBeenCalled();
    expect(prisma.shiftRoleRequirement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "req-existing" } })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "resources.shift-requirement.update",
        entityId: "req-existing",
        metadata: { shiftId: "shift-1" }
      })
    );
  });

  it("update branch: nullable competencyId still defaults to null when DTO omits it", async () => {
    const { service, prisma } = buildService();
    prisma.shift.findUnique.mockResolvedValueOnce({ id: "shift-1" });
    prisma.shiftRoleRequirement.update.mockResolvedValueOnce(
      shiftRequirementRow({ id: "req-existing" })
    );
    prisma.shiftRoleRequirement.findMany.mockResolvedValueOnce([]);

    await service.upsertShiftRequirement(
      "shift-1",
      "req-existing",
      { roleLabel: "Operator" } as never,
      "user-1"
    );

    const updateArg = prisma.shiftRoleRequirement.update.mock.calls[0][0] as {
      data: { competencyId: string | null; requiredCount: number };
    };
    expect(updateArg.data.competencyId).toBeNull();
    expect(updateArg.data.requiredCount).toBe(1);
  });
});
