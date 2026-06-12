// Mock-based unit tests for MaintenanceService — §12 assets and the records
// hanging off them (plans, events, inspections, breakdowns, status history)
// plus the §7 utilisation report. House pattern: plain-object Prisma mock,
// direct instantiation with `as never`. Topped up from the original
// single-test spec per backlog pr-118 — the emphasis is the derived
// maintenanceSummary state machine and the completed-event due-date roll.

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";

const NOW = new Date("2026-06-05T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

const fullAsset = (overrides: Record<string, unknown> = {}) => ({
  id: "asset-1",
  name: "Excavator 5T",
  status: "AVAILABLE",
  category: null,
  resourceType: null,
  maintenancePlans: [] as Array<Record<string, unknown>>,
  maintenanceEvents: [],
  inspections: [] as Array<Record<string, unknown>>,
  breakdowns: [] as Array<Record<string, unknown>>,
  statusHistory: [],
  ...overrides
});

const activePlan = (overrides: Record<string, unknown> = {}) => ({
  nextDueAt: daysFromNow(60),
  warningDays: 7,
  blockWhenOverdue: true,
  status: "ACTIVE",
  ...overrides
});

function buildService() {
  const prisma: Record<string, unknown> = {
    asset: {
      findUnique: jest.fn().mockResolvedValue(fullAsset()),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(fullAsset())
    },
    assetMaintenancePlan: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "plan-new", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      )
    },
    assetMaintenanceEvent: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "event-new", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, assetId: "asset-1", ...args.data })
      )
    },
    assetInspection: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "insp-new", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      )
    },
    assetBreakdown: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "break-new", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      )
    },
    assetStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: "hist-new" })
    },
    $transaction: jest.fn().mockImplementation((input: unknown) => {
      if (typeof input === "function") {
        return (input as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    })
  };

  const auditService = { write: jest.fn().mockResolvedValue({ id: "audit-1" }) };

  const service = new MaintenanceService(prisma as never, auditService as never);

  return { service, prisma, auditService };
}

// ─── Asset status transitions ──────────────────────────────────────────────

describe("MaintenanceService.updateAssetStatus", () => {
  it("rejects no-op asset status updates", async () => {
    const service = new MaintenanceService(
      {
        asset: {
          findUnique: jest.fn().mockResolvedValue({ id: "asset-1", status: "AVAILABLE" })
        }
      } as never,
      { write: jest.fn() } as never
    );

    await expect(
      service.updateAssetStatus("asset-1", { status: "AVAILABLE" }, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("404s when the asset does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.asset as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(
      service.updateAssetStatus("missing", { status: "MAINTENANCE" } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates the asset and appends status history in one transaction, then audits from/to", async () => {
    const { service, prisma, auditService } = buildService();

    const result = await service.updateAssetStatus(
      "asset-1",
      { status: "MAINTENANCE", note: "Scheduled service" } as never,
      "user-1"
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect((prisma.asset as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { status: "MAINTENANCE" }
    });
    expect((prisma.assetStatusHistory as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: {
        assetId: "asset-1",
        fromStatus: "AVAILABLE",
        toStatus: "MAINTENANCE",
        note: "Scheduled service"
      }
    });
    expect(auditService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "maintenance.asset-status.update",
        metadata: { fromStatus: "AVAILABLE", toStatus: "MAINTENANCE" }
      })
    );
    expect(result.maintenanceSummary).toBeDefined();
  });
});

// ─── Derived maintenance summary ───────────────────────────────────────────

describe("MaintenanceService maintenance summary", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function summaryFor(asset: Record<string, unknown>) {
    const { service, prisma } = buildService();
    (prisma.asset as { findUnique: jest.Mock }).findUnique.mockResolvedValue(asset);
    const result = await service.getAssetMaintenance("asset-1");
    return result.maintenanceSummary;
  }

  it("is COMPLIANT / NONE with no plans, breakdowns, or failed inspections", async () => {
    await expect(summaryFor(fullAsset())).resolves.toEqual({
      maintenanceState: "COMPLIANT",
      schedulerImpact: "NONE",
      openBreakdown: false,
      failedInspection: false
    });
  });

  it("is OVERDUE / BLOCK when an active blocking plan is past due", async () => {
    const summary = await summaryFor(
      fullAsset({ maintenancePlans: [activePlan({ nextDueAt: daysFromNow(-1) })] })
    );
    expect(summary).toMatchObject({ maintenanceState: "OVERDUE", schedulerImpact: "BLOCK" });
  });

  it("is OVERDUE / WARN when the overdue plan has blockWhenOverdue=false", async () => {
    const summary = await summaryFor(
      fullAsset({
        maintenancePlans: [activePlan({ nextDueAt: daysFromNow(-1), blockWhenOverdue: false })]
      })
    );
    expect(summary).toMatchObject({ maintenanceState: "OVERDUE", schedulerImpact: "WARN" });
  });

  it("is DUE_SOON / WARN inside the plan's warning window", async () => {
    const summary = await summaryFor(
      fullAsset({ maintenancePlans: [activePlan({ nextDueAt: daysFromNow(3), warningDays: 7 })] })
    );
    expect(summary).toMatchObject({ maintenanceState: "DUE_SOON", schedulerImpact: "WARN" });
  });

  it("ignores inactive plans and plans without a due date", async () => {
    const summary = await summaryFor(
      fullAsset({
        maintenancePlans: [
          activePlan({ nextDueAt: daysFromNow(-30), status: "PAUSED" }),
          activePlan({ nextDueAt: null })
        ]
      })
    );
    expect(summary).toMatchObject({ maintenanceState: "COMPLIANT", schedulerImpact: "NONE" });
  });

  it("is UNAVAILABLE / BLOCK on any unresolved breakdown", async () => {
    const summary = await summaryFor(fullAsset({ breakdowns: [{ status: "OPEN" }] }));
    expect(summary).toMatchObject({
      maintenanceState: "UNAVAILABLE",
      schedulerImpact: "BLOCK",
      openBreakdown: true
    });
  });

  it("treats resolved breakdowns as healthy", async () => {
    const summary = await summaryFor(fullAsset({ breakdowns: [{ status: "RESOLVED" }] }));
    expect(summary).toMatchObject({ maintenanceState: "COMPLIANT", openBreakdown: false });
  });

  it("is UNAVAILABLE / BLOCK on a failed inspection", async () => {
    const summary = await summaryFor(fullAsset({ inspections: [{ status: "FAIL" }] }));
    expect(summary).toMatchObject({
      maintenanceState: "UNAVAILABLE",
      schedulerImpact: "BLOCK",
      failedInspection: true
    });
  });

  it("is UNAVAILABLE / BLOCK for OUT_OF_SERVICE assets", async () => {
    const summary = await summaryFor(fullAsset({ status: "OUT_OF_SERVICE" }));
    expect(summary).toMatchObject({ maintenanceState: "UNAVAILABLE", schedulerImpact: "BLOCK" });
  });

  it("is IN_MAINTENANCE / WARN for MAINTENANCE-status assets without a block", async () => {
    const summary = await summaryFor(fullAsset({ status: "MAINTENANCE" }));
    expect(summary).toMatchObject({ maintenanceState: "IN_MAINTENANCE", schedulerImpact: "WARN" });
  });

  it("getAssetMaintenance 404s on a missing asset", async () => {
    const { service, prisma } = buildService();
    (prisma.asset as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.getAssetMaintenance("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── Dashboard ─────────────────────────────────────────────────────────────

describe("MaintenanceService.dashboard", () => {
  it("filters by assetId and status, pages, and decorates each row with a summary", async () => {
    const { service, prisma } = buildService();
    (prisma.asset as { findMany: jest.Mock }).findMany.mockResolvedValue([fullAsset()]);
    (prisma.asset as { count: jest.Mock }).count.mockResolvedValue(1);

    const result = await service.dashboard({
      assetId: "asset-1",
      status: "AVAILABLE",
      page: 2,
      pageSize: 10
    } as never);

    expect((prisma.asset as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "asset-1", status: "AVAILABLE" },
        skip: 10,
        take: 10
      })
    );
    expect(result.items[0].maintenanceSummary).toMatchObject({ maintenanceState: "COMPLIANT" });
    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 10 });
  });
});

// ─── Plan / event upserts ──────────────────────────────────────────────────

describe("MaintenanceService.upsertPlan", () => {
  const dto = { assetId: "asset-1", title: "250h service", intervalDays: 90 } as never;

  it("404s when the target asset does not exist", async () => {
    const { service, prisma } = buildService();
    (prisma.asset as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

    await expect(service.upsertPlan(undefined, dto, "user-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("creates with defaults — warningDays 7, blockWhenOverdue true, status ACTIVE", async () => {
    const { service, prisma, auditService } = buildService();

    await service.upsertPlan(undefined, dto, "user-1");

    expect((prisma.assetMaintenancePlan as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assetId: "asset-1",
        warningDays: 7,
        blockWhenOverdue: true,
        status: "ACTIVE",
        lastCompletedAt: null,
        nextDueAt: null
      })
    });
    expect(auditService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "maintenance.plan.create" })
    );
  });

  it("updates an existing plan and audits maintenance.plan.update", async () => {
    const { service, prisma, auditService } = buildService();

    await service.upsertPlan("plan-1", dto, "user-1");

    expect((prisma.assetMaintenancePlan as { update: jest.Mock }).update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1" } })
    );
    expect(auditService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "maintenance.plan.update", entityId: "plan-1" })
    );
  });
});

describe("MaintenanceService.upsertEvent", () => {
  it("rolls the parent plan's nextDueAt forward by intervalDays on completion", async () => {
    const { service, prisma } = buildService();
    (prisma.assetMaintenancePlan as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
      id: "plan-1",
      intervalDays: 30
    });
    const completedAt = "2026-06-01T00:00:00.000Z";

    await service.upsertEvent(
      undefined,
      { assetId: "asset-1", maintenancePlanId: "plan-1", eventType: "SERVICE", completedAt } as never,
      "user-1"
    );

    expect((prisma.assetMaintenancePlan as { update: jest.Mock }).update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: {
        lastCompletedAt: new Date(completedAt),
        nextDueAt: new Date("2026-07-01T00:00:00.000Z")
      }
    });
  });

  it("does not touch the plan when the event has no completedAt", async () => {
    const { service, prisma } = buildService();

    await service.upsertEvent(
      undefined,
      { assetId: "asset-1", maintenancePlanId: "plan-1", eventType: "SERVICE" } as never,
      "user-1"
    );

    expect((prisma.assetMaintenancePlan as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });

  it("does not touch any plan for unlinked events and defaults status to SCHEDULED", async () => {
    const { service, prisma } = buildService();

    await service.upsertEvent(
      undefined,
      { assetId: "asset-1", eventType: "SERVICE", completedAt: "2026-06-01T00:00:00.000Z" } as never,
      "user-1"
    );

    expect((prisma.assetMaintenancePlan as { update: jest.Mock }).update).not.toHaveBeenCalled();
    expect((prisma.assetMaintenanceEvent as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "SCHEDULED", maintenancePlanId: null })
    });
  });
});

describe("MaintenanceService.upsertInspection / upsertBreakdown defaults", () => {
  it("inspection status defaults to PASS", async () => {
    const { service, prisma } = buildService();

    await service.upsertInspection(
      undefined,
      { assetId: "asset-1", inspectionType: "PRESTART", inspectedAt: "2026-06-01T00:00:00.000Z" } as never,
      "user-1"
    );

    expect((prisma.assetInspection as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "PASS", notes: null })
    });
  });

  it("breakdown defaults to MEDIUM severity and OPEN status", async () => {
    const { service, prisma, auditService } = buildService();

    await service.upsertBreakdown(
      undefined,
      { assetId: "asset-1", reportedAt: "2026-06-01T00:00:00.000Z", summary: "Hydraulic leak" } as never,
      "user-1"
    );

    expect((prisma.assetBreakdown as { create: jest.Mock }).create).toHaveBeenCalledWith({
      data: expect.objectContaining({ severity: "MEDIUM", status: "OPEN", resolvedAt: null })
    });
    expect(auditService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "maintenance.breakdown.create" })
    );
  });
});

// ─── Asset utilisation report ──────────────────────────────────────────────

describe("MaintenanceService.assetUtilisation", () => {
  it.each([
    ["invalid from", { from: "not-a-date", to: "2026-06-05" }],
    ["invalid to", { from: "2026-06-01", to: "garbage" }],
    ["to before from", { from: "2026-06-05", to: "2026-06-01" }]
  ])("rejects %s with 400", async (_label, query) => {
    const { service } = buildService();
    await expect(service.assetUtilisation(query as never)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("computes per-asset hours, falls back to Uncategorised, and sorts by rate desc", async () => {
    const { service, prisma } = buildService();
    (prisma.asset as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        id: "asset-idle",
        name: "Idle Roller",
        category: null,
        shiftAssignments: []
      },
      {
        id: "asset-busy",
        name: "Busy Excavator",
        category: { name: "Earthmoving" },
        shiftAssignments: [
          {
            shift: {
              id: "shift-1",
              startAt: new Date("2026-06-02T08:00:00.000Z"),
              endAt: new Date("2026-06-02T16:00:00.000Z")
            }
          }
        ]
      }
    ]);

    // Mon 1 Jun → Fri 5 Jun 2026 = 5 weekdays × 8h = 40h available.
    const rows = await service.assetUtilisation({ from: "2026-06-01", to: "2026-06-05" } as never);

    expect(rows[0]).toEqual({
      assetId: "asset-busy",
      assetName: "Busy Excavator",
      category: "Earthmoving",
      hoursAllocated: 8,
      hoursAvailable: 40,
      utilisationRate: 0.2,
      allocationCount: 1
    });
    expect(rows[1]).toMatchObject({
      assetId: "asset-idle",
      category: "Uncategorised",
      hoursAllocated: 0,
      utilisationRate: 0
    });
  });

  it("clamps shifts that straddle the window to the overlapping hours only", async () => {
    const { service, prisma } = buildService();
    (prisma.asset as { findMany: jest.Mock }).findMany.mockResolvedValue([
      {
        id: "asset-1",
        name: "Crane",
        category: null,
        shiftAssignments: [
          {
            shift: {
              id: "shift-1",
              // Starts the day before the window opens.
              startAt: new Date("2026-05-31T20:00:00.000Z"),
              endAt: new Date("2026-06-01T04:00:00.000Z")
            }
          }
        ]
      }
    ]);

    const rows = await service.assetUtilisation({ from: "2026-06-01", to: "2026-06-01" } as never);

    expect(rows[0].hoursAllocated).toBe(4);
  });
});
