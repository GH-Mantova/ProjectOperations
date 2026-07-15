// Mock-based unit tests for AssetsService.
// Mirrors PR #283 (ProjectsService), PR #298 (FormsService), PR #311 (SchedulerService),
// PR #328 (DirectoryService), PR #329 (MasterDataService).
//
// Drives the service directly with plain-object Prisma / Audit stubs in the same
// shape as the pre-existing narrow assets.service.spec.ts alongside this file.
// No production code is modified.

import { ConflictException, NotFoundException } from "@nestjs/common";
import { AssetsService } from "../assets.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

function categoryRow(overrides: AnyRecord = {}) {
  return {
    id: "cat-1",
    name: "Plant",
    code: "PLANT",
    description: null,
    isActive: true,
    ...overrides
  };
}

function shiftAssignment(jobId: string, overrides: AnyRecord = {}) {
  return {
    id: `sa-${jobId}`,
    shift: {
      id: `shift-${jobId}`,
      job: {
        id: jobId,
        jobNumber: `J-${jobId}`,
        name: `Job ${jobId}`,
        status: "ACTIVE"
      }
    },
    assignedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides
  };
}

function assetRow(overrides: AnyRecord = {}) {
  return {
    id: "asset-1",
    name: "Excavator 5T",
    assetCode: "EX-001",
    serialNumber: "SN-001",
    status: "AVAILABLE",
    homeBase: "Yard",
    currentLocation: "Site A",
    notes: null,
    assetCategoryId: "cat-1",
    resourceTypeId: "rt-1",
    category: categoryRow(),
    resourceType: { id: "rt-1", name: "Plant operator" },
    maintenancePlans: [],
    maintenanceEvents: [],
    inspections: [],
    breakdowns: [],
    statusHistory: [],
    shiftAssignments: [],
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
    assetCategory: tableCRUD(),
    asset: tableCRUD(),
    documentLink: { findMany: jest.fn().mockResolvedValue([]) },
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
  const service = new AssetsService(prisma as never, audit as never);
  return { service, prisma, audit };
}

// ─── listCategories ────────────────────────────────────────────────────────

describe("AssetsService.listCategories", () => {
  it("returns categories ordered by name asc", async () => {
    const { service, prisma } = buildService();
    const rows = [categoryRow({ id: "cat-a", name: "Aerial" }), categoryRow({ id: "cat-b", name: "Bobcat" })];
    prisma.assetCategory.findMany.mockResolvedValueOnce(rows);

    const result = await service.listCategories();

    expect(result).toEqual(rows);
    expect(prisma.assetCategory.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" }
    });
  });
});

// ─── upsertCategory ────────────────────────────────────────────────────────

describe("AssetsService.upsertCategory", () => {
  it("creates a new category with isActive defaulted to true and writes a create audit log", async () => {
    const { service, prisma, audit } = buildService();
    prisma.assetCategory.create.mockResolvedValueOnce(categoryRow({ id: "cat-new" }));

    const result = await service.upsertCategory(
      undefined,
      { name: "Plant", code: "PLANT", description: "Heavy plant" },
      "user-1"
    );

    expect(prisma.assetCategory.findFirst).toHaveBeenCalledWith({
      where: { name: "Plant" }
    });
    expect(prisma.assetCategory.create).toHaveBeenCalledWith({
      data: {
        name: "Plant",
        code: "PLANT",
        description: "Heavy plant",
        isActive: true,
        defaultFuelConsumptionLPer100km: null,
        defaultNominalLoadTonnes: null
      }
    });
    expect(prisma.assetCategory.update).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "assets.category.create",
      entityType: "AssetCategory",
      entityId: "cat-new"
    });
    expect(result.id).toBe("cat-new");
  });

  it("honours an explicit isActive=false on create", async () => {
    const { service, prisma } = buildService();
    prisma.assetCategory.create.mockResolvedValueOnce(categoryRow({ isActive: false }));

    await service.upsertCategory(undefined, { name: "Retired", isActive: false }, "user-1");

    expect(prisma.assetCategory.create).toHaveBeenCalledWith({
      data: { name: "Retired", code: undefined, description: undefined, isActive: false, defaultFuelConsumptionLPer100km: null, defaultNominalLoadTonnes: null }
    });
  });

  it("updates an existing category, excludes itself from the name conflict check, and writes an update audit log", async () => {
    const { service, prisma, audit } = buildService();
    prisma.assetCategory.update.mockResolvedValueOnce(
      categoryRow({ id: "cat-9", name: "Tools" })
    );

    const result = await service.upsertCategory(
      "cat-9",
      { name: "Tools", code: "TLS" },
      "user-9"
    );

    expect(prisma.assetCategory.findFirst).toHaveBeenCalledWith({
      where: { name: "Tools", NOT: { id: "cat-9" } }
    });
    expect(prisma.assetCategory.update).toHaveBeenCalledWith({
      where: { id: "cat-9" },
      data: { name: "Tools", code: "TLS", description: undefined, isActive: true, defaultFuelConsumptionLPer100km: null, defaultNominalLoadTonnes: null }
    });
    expect(prisma.assetCategory.create).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "assets.category.update", entityId: "cat-9" })
    );
    expect(result.id).toBe("cat-9");
  });

  it("throws ConflictException when another category already has the same name", async () => {
    const { service, prisma, audit } = buildService();
    prisma.assetCategory.findFirst.mockResolvedValueOnce({ id: "cat-other" });

    await expect(
      service.upsertCategory(undefined, { name: "Plant" }, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.assetCategory.create).not.toHaveBeenCalled();
    expect(prisma.assetCategory.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("forwards a null actor to the audit log without throwing", async () => {
    const { service, prisma, audit } = buildService();
    prisma.assetCategory.create.mockResolvedValueOnce(categoryRow({ id: "cat-x" }));

    await service.upsertCategory(undefined, { name: "NoActor" });

    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: undefined })
    );
  });
});

// ─── listAssets ────────────────────────────────────────────────────────────

describe("AssetsService.listAssets", () => {
  const PAGE_QUERY: { page: number; pageSize: number } = { page: 1, pageSize: 10 };

  it("returns paginated items with maintenance summary attached, and an empty where clause when no filters are given", async () => {
    const { service, prisma } = buildService();
    const rows = [assetRow({ id: "a-1" }), assetRow({ id: "a-2" })];
    prisma.asset.findMany.mockResolvedValueOnce(rows);
    prisma.asset.count.mockResolvedValueOnce(2);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.items).toHaveLength(2);
    for (const item of result.items) {
      expect(item).toHaveProperty("maintenanceSummary");
      expect(item.maintenanceSummary).toEqual({
        maintenanceState: "COMPLIANT",
        schedulerImpact: "NONE",
        openBreakdown: false,
        failedInspection: false
      });
    }
    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ name: "asc" }],
        skip: 0,
        take: 10
      })
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("builds a q OR-clause across name, assetCode, serialNumber, homeBase, and currentLocation (case-insensitive)", async () => {
    const { service, prisma } = buildService();

    await service.listAssets({ ...PAGE_QUERY, q: "EX" } as never);

    const call = prisma.asset.findMany.mock.calls[0][0] as {
      where: { OR: Array<AnyRecord> };
    };
    expect(call.where.OR).toEqual([
      { name: { contains: "EX", mode: "insensitive" } },
      { assetCode: { contains: "EX", mode: "insensitive" } },
      { serialNumber: { contains: "EX", mode: "insensitive" } },
      { homeBase: { contains: "EX", mode: "insensitive" } },
      { currentLocation: { contains: "EX", mode: "insensitive" } }
    ]);
  });

  it("narrows by categoryId and status when provided", async () => {
    const { service, prisma } = buildService();

    await service.listAssets({
      ...PAGE_QUERY,
      categoryId: "cat-1",
      status: "MAINTENANCE"
    } as never);

    const call = prisma.asset.findMany.mock.calls[0][0] as { where: AnyRecord };
    expect(call.where).toMatchObject({
      assetCategoryId: "cat-1",
      status: "MAINTENANCE"
    });
    expect(prisma.asset.count).toHaveBeenCalledWith({ where: expect.objectContaining(call.where) });
  });

  it("computes skip from page and pageSize", async () => {
    const { service, prisma } = buildService();

    await service.listAssets({ page: 3, pageSize: 25 } as never);

    expect(prisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25 })
    );
  });

  it("flags OUT_OF_SERVICE assets as UNAVAILABLE / BLOCK in the maintenance summary", async () => {
    const { service, prisma } = buildService();
    prisma.asset.findMany.mockResolvedValueOnce([assetRow({ status: "OUT_OF_SERVICE" })]);
    prisma.asset.count.mockResolvedValueOnce(1);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    const summary = (result.items[0] as { maintenanceSummary: AnyRecord }).maintenanceSummary;
    expect(summary).toEqual({
      maintenanceState: "UNAVAILABLE",
      schedulerImpact: "BLOCK",
      openBreakdown: false,
      failedInspection: false
    });
  });

  it("flags MAINTENANCE status as IN_MAINTENANCE / WARN when no plan is overdue", async () => {
    const { service, prisma } = buildService();
    prisma.asset.findMany.mockResolvedValueOnce([assetRow({ status: "MAINTENANCE" })]);
    prisma.asset.count.mockResolvedValueOnce(1);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    expect(
      (result.items[0] as { maintenanceSummary: AnyRecord }).maintenanceSummary
    ).toMatchObject({
      maintenanceState: "IN_MAINTENANCE",
      schedulerImpact: "WARN"
    });
  });

  it("flags an overdue ACTIVE plan with blockWhenOverdue=true as OVERDUE / BLOCK", async () => {
    const { service, prisma } = buildService();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prisma.asset.findMany.mockResolvedValueOnce([
      assetRow({
        maintenancePlans: [
          { status: "ACTIVE", nextDueAt: yesterday, warningDays: 7, blockWhenOverdue: true }
        ]
      })
    ]);
    prisma.asset.count.mockResolvedValueOnce(1);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    expect(
      (result.items[0] as { maintenanceSummary: AnyRecord }).maintenanceSummary
    ).toMatchObject({
      maintenanceState: "OVERDUE",
      schedulerImpact: "BLOCK"
    });
  });

  it("downgrades overdue + blockWhenOverdue=false to OVERDUE / WARN", async () => {
    const { service, prisma } = buildService();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    prisma.asset.findMany.mockResolvedValueOnce([
      assetRow({
        maintenancePlans: [
          { status: "ACTIVE", nextDueAt: yesterday, warningDays: 7, blockWhenOverdue: false }
        ]
      })
    ]);
    prisma.asset.count.mockResolvedValueOnce(1);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    expect(
      (result.items[0] as { maintenanceSummary: AnyRecord }).maintenanceSummary
    ).toMatchObject({
      maintenanceState: "OVERDUE",
      schedulerImpact: "WARN"
    });
  });

  it("flags a plan within the warning window as DUE_SOON / WARN", async () => {
    const { service, prisma } = buildService();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    prisma.asset.findMany.mockResolvedValueOnce([
      assetRow({
        maintenancePlans: [
          { status: "ACTIVE", nextDueAt: tomorrow, warningDays: 7, blockWhenOverdue: true }
        ]
      })
    ]);
    prisma.asset.count.mockResolvedValueOnce(1);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    expect(
      (result.items[0] as { maintenanceSummary: AnyRecord }).maintenanceSummary
    ).toMatchObject({
      maintenanceState: "DUE_SOON",
      schedulerImpact: "WARN"
    });
  });

  it("ignores plans that are not ACTIVE or have no nextDueAt", async () => {
    const { service, prisma } = buildService();
    prisma.asset.findMany.mockResolvedValueOnce([
      assetRow({
        maintenancePlans: [
          { status: "DRAFT", nextDueAt: new Date("2020-01-01"), warningDays: 7, blockWhenOverdue: true },
          { status: "ACTIVE", nextDueAt: null, warningDays: 7, blockWhenOverdue: true }
        ]
      })
    ]);
    prisma.asset.count.mockResolvedValueOnce(1);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    expect(
      (result.items[0] as { maintenanceSummary: AnyRecord }).maintenanceSummary
    ).toMatchObject({ maintenanceState: "COMPLIANT", schedulerImpact: "NONE" });
  });

  it("flags any open breakdown as UNAVAILABLE / BLOCK", async () => {
    const { service, prisma } = buildService();
    prisma.asset.findMany.mockResolvedValueOnce([
      assetRow({ breakdowns: [{ status: "OPEN" }, { status: "RESOLVED" }] })
    ]);
    prisma.asset.count.mockResolvedValueOnce(1);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    expect(
      (result.items[0] as { maintenanceSummary: AnyRecord }).maintenanceSummary
    ).toMatchObject({
      maintenanceState: "UNAVAILABLE",
      schedulerImpact: "BLOCK",
      openBreakdown: true
    });
  });

  it("flags a failed inspection as UNAVAILABLE / BLOCK", async () => {
    const { service, prisma } = buildService();
    prisma.asset.findMany.mockResolvedValueOnce([
      assetRow({ inspections: [{ status: "PASS" }, { status: "FAIL" }] })
    ]);
    prisma.asset.count.mockResolvedValueOnce(1);

    const result = await service.listAssets({ ...PAGE_QUERY } as never);

    expect(
      (result.items[0] as { maintenanceSummary: AnyRecord }).maintenanceSummary
    ).toMatchObject({
      maintenanceState: "UNAVAILABLE",
      schedulerImpact: "BLOCK",
      failedInspection: true
    });
  });
});

// ─── getAsset ──────────────────────────────────────────────────────────────

describe("AssetsService.getAsset", () => {
  it("throws NotFoundException and does not query documents when the asset is missing", async () => {
    const { service, prisma } = buildService();
    prisma.asset.findUnique.mockResolvedValueOnce(null);

    await expect(service.getAsset("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.documentLink.findMany).not.toHaveBeenCalled();
  });

  it("returns the asset with linkedJobs deduplicated, maintenance summary, and documents (with full include shape)", async () => {
    const { service, prisma } = buildService();
    prisma.asset.findUnique.mockResolvedValueOnce(
      assetRow({
        id: "asset-9",
        shiftAssignments: [
          shiftAssignment("job-1"),
          shiftAssignment("job-1", { id: "sa-dup" }),
          shiftAssignment("job-2")
        ]
      })
    );
    const docs = [{ id: "doc-1", fileLink: {}, tags: [] }];
    prisma.documentLink.findMany.mockResolvedValueOnce(docs);

    const result = await service.getAsset("asset-9");

    expect(prisma.asset.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "asset-9" },
        include: expect.objectContaining({ category: true, resourceType: true })
      })
    );
    expect(prisma.documentLink.findMany).toHaveBeenCalledWith({
      where: { linkedEntityType: "Asset", linkedEntityId: "asset-9" },
      include: { fileLink: true, tags: true },
      orderBy: { createdAt: "desc" }
    });
    expect(result.linkedJobs).toHaveLength(2);
    expect(result.linkedJobs.map((j) => j.id).sort()).toEqual(["job-1", "job-2"]);
    expect(result.documents).toEqual(docs);
    expect(result.maintenanceSummary).toEqual({
      maintenanceState: "COMPLIANT",
      schedulerImpact: "NONE",
      openBreakdown: false,
      failedInspection: false
    });
  });

  it("returns an empty linkedJobs array when the asset has no shift assignments", async () => {
    const { service, prisma } = buildService();
    prisma.asset.findUnique.mockResolvedValueOnce(assetRow({ shiftAssignments: [] }));

    const result = await service.getAsset("asset-1");

    expect(result.linkedJobs).toEqual([]);
  });
});

// ─── upsertAsset ───────────────────────────────────────────────────────────

describe("AssetsService.upsertAsset", () => {
  const BASE_DTO = {
    name: "Excavator",
    assetCode: "EX-001",
    assetCategoryId: "cat-1",
    resourceTypeId: "rt-1",
    serialNumber: "SN-001",
    status: "AVAILABLE",
    homeBase: "Yard",
    currentLocation: "Site A",
    notes: "Routine"
  };

  it("creates a new asset, audits the create, and returns the hydrated asset via getAsset", async () => {
    const { service, prisma, audit } = buildService();
    prisma.asset.create.mockResolvedValueOnce(assetRow({ id: "asset-new" }));
    // getAsset re-fetch
    prisma.asset.findUnique.mockResolvedValueOnce(assetRow({ id: "asset-new" }));

    const result = await service.upsertAsset(undefined, BASE_DTO as never, "user-1");

    expect(prisma.asset.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ assetCode: "EX-001" }, { serialNumber: "SN-001" }]
      }
    });
    expect(prisma.asset.create).toHaveBeenCalledWith({
      data: {
        assetCategoryId: "cat-1",
        resourceTypeId: "rt-1",
        name: "Excavator",
        assetCode: "EX-001",
        serialNumber: "SN-001",
        status: "AVAILABLE",
        homeBase: "Yard",
        currentLocation: "Site A",
        notes: "Routine",
        fuelConsumptionLPer100km: null,
        nominalLoadTonnes: null
      }
    });
    expect(prisma.asset.update).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith({
      actorId: "user-1",
      action: "assets.create",
      entityType: "Asset",
      entityId: "asset-new"
    });
    expect(result.id).toBe("asset-new");
    expect(result).toHaveProperty("maintenanceSummary");
    expect(result).toHaveProperty("linkedJobs");
  });

  it("omits the serialNumber OR-branch when the DTO has no serialNumber", async () => {
    const { service, prisma } = buildService();
    prisma.asset.create.mockResolvedValueOnce(assetRow({ id: "asset-x" }));
    prisma.asset.findUnique.mockResolvedValueOnce(assetRow({ id: "asset-x" }));

    await service.upsertAsset(
      undefined,
      { name: "Drill", assetCode: "DR-1" } as never,
      "user-1"
    );

    expect(prisma.asset.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ assetCode: "DR-1" }] }
    });
  });

  it("defaults nullable fields to null and status to AVAILABLE on a minimal create", async () => {
    const { service, prisma } = buildService();
    prisma.asset.create.mockResolvedValueOnce(assetRow({ id: "asset-min" }));
    prisma.asset.findUnique.mockResolvedValueOnce(assetRow({ id: "asset-min" }));

    await service.upsertAsset(
      undefined,
      { name: "Hammer", assetCode: "HM-1" } as never,
      "user-1"
    );

    expect(prisma.asset.create).toHaveBeenCalledWith({
      data: {
        assetCategoryId: null,
        resourceTypeId: null,
        name: "Hammer",
        assetCode: "HM-1",
        serialNumber: null,
        status: "AVAILABLE",
        homeBase: null,
        currentLocation: null,
        notes: null,
        fuelConsumptionLPer100km: null,
        nominalLoadTonnes: null
      }
    });
  });

  it("updates an existing asset, scopes the uniqueness check with NOT:{id}, and audits the update", async () => {
    const { service, prisma, audit } = buildService();
    prisma.asset.update.mockResolvedValueOnce(assetRow({ id: "asset-7" }));
    prisma.asset.findUnique.mockResolvedValueOnce(assetRow({ id: "asset-7" }));

    const result = await service.upsertAsset("asset-7", BASE_DTO as never, "user-9");

    expect(prisma.asset.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ assetCode: "EX-001" }, { serialNumber: "SN-001" }],
        NOT: { id: "asset-7" }
      }
    });
    expect(prisma.asset.update).toHaveBeenCalledWith({
      where: { id: "asset-7" },
      data: expect.objectContaining({
        assetCategoryId: "cat-1",
        name: "Excavator",
        assetCode: "EX-001"
      })
    });
    expect(prisma.asset.create).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "assets.update", entityId: "asset-7" })
    );
    expect(result.id).toBe("asset-7");
  });

  it("throws ConflictException when another asset already has the same assetCode or serialNumber", async () => {
    const { service, prisma, audit } = buildService();
    prisma.asset.findFirst.mockResolvedValueOnce({ id: "asset-other" });

    await expect(
      service.upsertAsset(undefined, BASE_DTO as never, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.asset.create).not.toHaveBeenCalled();
    expect(prisma.asset.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("propagates a NotFoundException when the post-write getAsset re-fetch returns null", async () => {
    const { service, prisma } = buildService();
    prisma.asset.create.mockResolvedValueOnce(assetRow({ id: "asset-ghost" }));
    prisma.asset.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.upsertAsset(undefined, BASE_DTO as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
