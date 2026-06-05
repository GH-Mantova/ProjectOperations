// Mock-based unit tests for SchedulerService.
// Mirrors PR #283 (ProjectsService), PR #298 (FormsService), PR-73 (JobsService).
//
// Drives the service directly with plain-object Prisma / Audit / Notifications
// stubs, in the same shape as the pre-existing scheduler.service.spec.ts
// alongside this file. No production code is modified.

import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from "@nestjs/common";
import { SchedulerService } from "../scheduler.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function emptyShiftDetails(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "shift-1",
    startAt: new Date("2026-04-28T06:00:00.000Z"),
    endAt: new Date("2026-04-28T14:00:00.000Z"),
    status: "PLANNED",
    roleRequirements: [],
    workerAssignments: [],
    assetAssignments: [],
    conflicts: [],
    ...overrides
  };
}

function buildAudit() {
  return { write: jest.fn() as AsyncMock };
}

function buildNotifications() {
  return { refreshLiveFollowUps: jest.fn() as AsyncMock };
}

describe("SchedulerService — workspace", () => {
  it("returns jobs, workers, assets, and shifts with totals from the page query", async () => {
    const jobsList = [{ id: "job-1" }];
    const workersList = [{ id: "worker-1" }];
    const assetsList = [{ id: "asset-1" }];
    const shiftsList = [
      { id: "shift-1" },
      { id: "shift-2" }
    ];
    const prisma = {
      job: { findMany: jest.fn().mockResolvedValue(jobsList) },
      worker: { findMany: jest.fn().mockResolvedValue(workersList) },
      asset: { findMany: jest.fn().mockResolvedValue(assetsList) },
      shift: { findMany: jest.fn().mockResolvedValue(shiftsList) }
    };

    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    const result = await service.workspace({ page: 2, pageSize: 25 } as never);

    expect(result).toEqual({
      items: {
        jobs: jobsList,
        workers: workersList,
        assets: assetsList,
        shifts: shiftsList
      },
      total: 2,
      page: 2,
      pageSize: 25
    });
    expect(prisma.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { startAt: "asc" } })
    );
  });
});

describe("SchedulerService — createShift", () => {
  const dto = {
    jobId: "job-1",
    jobActivityId: "activity-1",
    title: "Day shift",
    startAt: "2026-04-28T06:00:00.000Z",
    endAt: "2026-04-28T14:00:00.000Z"
  };

  it("happy path: validates, creates, refreshes conflicts, audits, notifies", async () => {
    const created = emptyShiftDetails({ id: "shift-new" });
    const audit = buildAudit();
    const notifications = buildNotifications();
    const prisma = {
      jobActivity: {
        findUnique: jest.fn().mockResolvedValue({
          id: "activity-1",
          jobId: "job-1",
          jobStageId: "stage-1"
        })
      },
      shift: {
        create: jest.fn().mockResolvedValue(created),
        findUnique: jest
          .fn()
          // refreshConflicts lookup
          .mockResolvedValueOnce({ ...created })
          // requireShift inside getShift
          .mockResolvedValueOnce({ ...created })
      },
      schedulingConflict: {
        deleteMany: jest.fn(),
        createMany: jest.fn()
      }
    };

    const service = new SchedulerService(
      prisma as never,
      audit as never,
      notifications as never
    );

    const result = await service.createShift(dto as never, "user-1");

    expect(prisma.shift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "job-1",
          jobActivityId: "activity-1",
          jobStageId: "stage-1",
          status: "PLANNED",
          leadUserId: null
        })
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "scheduler.shift.create",
        entityType: "Shift",
        entityId: "shift-new"
      })
    );
    expect(notifications.refreshLiveFollowUps).toHaveBeenCalledWith("user-1");
    expect(result).toEqual(created);
  });

  it("throws NotFoundException when the job activity does not exist", async () => {
    const prisma = {
      jobActivity: { findUnique: jest.fn().mockResolvedValue(null) }
    };

    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(
      service.createShift(dto as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when the activity belongs to a different job (scope guard)", async () => {
    const prisma = {
      jobActivity: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "activity-1", jobId: "other-job", jobStageId: "s" })
      }
    };

    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(
      service.createShift(dto as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws BadRequestException when endAt is not after startAt", async () => {
    const prisma = {
      jobActivity: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "activity-1", jobId: "job-1", jobStageId: "s" })
      }
    };

    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(
      service.createShift(
        { ...dto, endAt: dto.startAt } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("SchedulerService — updateShift", () => {
  const dto = {
    jobId: "job-1",
    jobActivityId: "activity-1",
    title: "Updated",
    startAt: "2026-04-28T06:00:00.000Z",
    endAt: "2026-04-28T18:00:00.000Z"
  };

  it("happy path: updates the row, refreshes conflicts, audits, notifies", async () => {
    const existing = emptyShiftDetails();
    const updated = emptyShiftDetails({ title: "Updated" });
    const audit = buildAudit();
    const notifications = buildNotifications();
    const prisma = {
      shift: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(existing) // requireShift
          .mockResolvedValueOnce(updated) // refreshConflicts
          .mockResolvedValueOnce(updated), // getShift
        update: jest.fn().mockResolvedValue(updated)
      },
      schedulingConflict: { deleteMany: jest.fn(), createMany: jest.fn() }
    };

    const service = new SchedulerService(
      prisma as never,
      audit as never,
      notifications as never
    );

    const result = await service.updateShift("shift-1", dto as never, "user-1");

    expect(prisma.shift.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "shift-1" },
        data: expect.objectContaining({
          jobId: "job-1",
          jobActivityId: "activity-1",
          title: "Updated",
          status: "PLANNED",
          leadUserId: null
        })
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "scheduler.shift.update",
        entityId: "shift-1"
      })
    );
    expect(notifications.refreshLiveFollowUps).toHaveBeenCalledWith("user-1");
    expect(result).toEqual(updated);
  });

  it("throws NotFoundException when the shift does not exist", async () => {
    const prisma = { shift: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(
      service.updateShift("missing", dto as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws BadRequestException when endAt is not after startAt", async () => {
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(emptyShiftDetails()) }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(
      service.updateShift(
        "shift-1",
        { ...dto, endAt: dto.startAt } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("SchedulerService — assignWorker", () => {
  it("happy path: creates the assignment, refreshes, audits, notifies", async () => {
    const shift = emptyShiftDetails();
    const audit = buildAudit();
    const notifications = buildNotifications();
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      shift: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(shift) // requireShift
          .mockResolvedValueOnce(shift) // refreshConflicts
          .mockResolvedValueOnce(shift) // getShift
      },
      shiftWorkerAssignment: { create },
      schedulingConflict: { deleteMany: jest.fn(), createMany: jest.fn() }
    };

    const service = new SchedulerService(
      prisma as never,
      audit as never,
      notifications as never
    );

    await service.assignWorker(
      "shift-1",
      { workerId: "worker-1", roleLabel: "Lead" } as never,
      "user-1"
    );

    expect(create).toHaveBeenCalledWith({
      data: { shiftId: "shift-1", workerId: "worker-1", roleLabel: "Lead" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "scheduler.worker.assign",
        entityId: "shift-1"
      })
    );
    expect(notifications.refreshLiveFollowUps).toHaveBeenCalledWith("user-1");
  });

  it("translates a Prisma unique-constraint failure into ConflictException", async () => {
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(emptyShiftDetails()) },
      shiftWorkerAssignment: {
        create: jest.fn().mockRejectedValue(new Error("unique constraint"))
      }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(
      service.assignWorker(
        "shift-1",
        { workerId: "worker-1" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("throws NotFoundException when the shift is missing", async () => {
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(null) }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(
      service.assignWorker(
        "shift-1",
        { workerId: "worker-1" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SchedulerService — assignAsset", () => {
  it("happy path: creates the assignment, refreshes, audits, notifies", async () => {
    const shift = emptyShiftDetails();
    const audit = buildAudit();
    const notifications = buildNotifications();
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      shift: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(shift)
          .mockResolvedValueOnce(shift)
          .mockResolvedValueOnce(shift)
      },
      shiftAssetAssignment: { create },
      schedulingConflict: { deleteMany: jest.fn(), createMany: jest.fn() }
    };

    const service = new SchedulerService(
      prisma as never,
      audit as never,
      notifications as never
    );

    await service.assignAsset(
      "shift-1",
      { assetId: "asset-1" } as never,
      "user-1"
    );

    expect(create).toHaveBeenCalledWith({
      data: { shiftId: "shift-1", assetId: "asset-1" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "scheduler.asset.assign",
        entityId: "shift-1"
      })
    );
    expect(notifications.refreshLiveFollowUps).toHaveBeenCalledWith("user-1");
  });

  it("translates a Prisma unique-constraint failure into ConflictException", async () => {
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(emptyShiftDetails()) },
      shiftAssetAssignment: {
        create: jest.fn().mockRejectedValue(new Error("dup"))
      }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(
      service.assignAsset(
        "shift-1",
        { assetId: "asset-1" } as never,
        "user-1"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("SchedulerService — unassign", () => {
  it("unassignWorker: deletes by composite key, refreshes, audits, notifies", async () => {
    const shift = emptyShiftDetails();
    const audit = buildAudit();
    const notifications = buildNotifications();
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      shift: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(shift) // refreshConflicts
          .mockResolvedValueOnce(shift) // getShift
      },
      shiftWorkerAssignment: { deleteMany },
      schedulingConflict: { deleteMany: jest.fn(), createMany: jest.fn() }
    };

    const service = new SchedulerService(
      prisma as never,
      audit as never,
      notifications as never
    );

    await service.unassignWorker("shift-1", "worker-1", "user-1");

    expect(deleteMany).toHaveBeenCalledWith({
      where: { shiftId: "shift-1", workerId: "worker-1" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "scheduler.worker.unassign",
        entityId: "shift-1",
        metadata: { shiftId: "shift-1", workerId: "worker-1" }
      })
    );
    expect(notifications.refreshLiveFollowUps).toHaveBeenCalledWith("user-1");
  });

  it("unassignAsset: deletes by composite key, refreshes, audits, notifies", async () => {
    const shift = emptyShiftDetails();
    const audit = buildAudit();
    const notifications = buildNotifications();
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      shift: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(shift)
          .mockResolvedValueOnce(shift)
      },
      shiftAssetAssignment: { deleteMany },
      schedulingConflict: { deleteMany: jest.fn(), createMany: jest.fn() }
    };

    const service = new SchedulerService(
      prisma as never,
      audit as never,
      notifications as never
    );

    await service.unassignAsset("shift-1", "asset-1", "user-1");

    expect(deleteMany).toHaveBeenCalledWith({
      where: { shiftId: "shift-1", assetId: "asset-1" }
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "scheduler.asset.unassign",
        metadata: { shiftId: "shift-1", assetId: "asset-1" }
      })
    );
  });
});

describe("SchedulerService — getShift", () => {
  it("returns the shift when present", async () => {
    const shift = emptyShiftDetails();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(service.getShift("shift-1")).resolves.toEqual(shift);
  });

  it("throws NotFoundException when the shift is missing", async () => {
    const prisma = { shift: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await expect(service.getShift("missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

// ---------------------------------------------------------------------------
// refreshConflicts (private) — drives the conflict-detection branches via the
// `service["refreshConflicts"]` escape hatch (same pattern as the existing
// scheduler.service.spec.ts).
// ---------------------------------------------------------------------------

const SHIFT_WINDOW = {
  startAt: new Date("2026-04-28T06:00:00.000Z"),
  endAt: new Date("2026-04-28T14:00:00.000Z")
};

function makeWorker(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "worker-1",
    firstName: "Alex",
    lastName: "Smith",
    competencies: [],
    availabilityWindows: [],
    roleSuitabilities: [],
    ...overrides
  };
}

function makeAsset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "asset-1",
    name: "Excavator",
    status: "AVAILABLE",
    maintenancePlans: [],
    inspections: [],
    breakdowns: [],
    ...overrides
  };
}

function makeShift(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "shift-1",
    ...SHIFT_WINDOW,
    roleRequirements: [],
    workerAssignments: [],
    assetAssignments: [],
    ...overrides
  };
}

describe("SchedulerService — refreshConflicts (conflict detection)", () => {
  it("returns silently and writes nothing when the shift cannot be found", async () => {
    const deleteMany = jest.fn();
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(null) },
      schedulingConflict: { deleteMany, createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-missing");

    expect(deleteMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("clears stale conflicts and skips createMany when no problems are detected", async () => {
    const shift = makeShift({
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: "Operator",
          worker: makeWorker()
        }
      ],
      assetAssignments: [
        {
          assetId: "asset-1",
          asset: makeAsset()
        }
      ]
    });
    const deleteMany = jest.fn();
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany, createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    expect(deleteMany).toHaveBeenCalledWith({ where: { shiftId: "shift-1" } });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("flags WORKER_OVERLAP when the same worker is double-booked on an overlapping shift", async () => {
    const shift = makeShift({
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: null,
          worker: makeWorker()
        }
      ],
      assetAssignments: [
        { assetId: "asset-1", asset: makeAsset() }
      ]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            shift: { id: "shift-other" },
            worker: { firstName: "Alex", lastName: "Smith" }
          }
        ])
      },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    expect(createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          shiftId: "shift-1",
          severity: "RED",
          code: "WORKER_OVERLAP"
        })
      ])
    });
  });

  it("flags WORKER_UNAVAILABLE when an unavailable window overlaps the shift", async () => {
    const shift = makeShift({
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: null,
          worker: makeWorker({
            availabilityWindows: [
              {
                status: "UNAVAILABLE",
                startAt: new Date("2026-04-28T05:00:00.000Z"),
                endAt: new Date("2026-04-28T12:00:00.000Z")
              }
            ]
          })
        }
      ],
      assetAssignments: [{ assetId: "asset-1", asset: makeAsset() }]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    const data = (createMany.mock.calls[0]?.[0] as { data: Array<{ code: string }> }).data;
    expect(data.some((entry) => entry.code === "WORKER_UNAVAILABLE")).toBe(true);
  });

  it("flags ROLE_COVERAGE when assigned worker count is below requiredCount", async () => {
    const shift = makeShift({
      roleRequirements: [
        {
          roleLabel: "Operator",
          requiredCount: 2,
          competencyId: null,
          competency: null
        }
      ],
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: "Operator",
          worker: makeWorker()
        }
      ],
      assetAssignments: [{ assetId: "asset-1", asset: makeAsset() }]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    const data = (createMany.mock.calls[0]?.[0] as { data: Array<{ code: string; severity: string }> }).data;
    expect(
      data.some(
        (entry) => entry.code === "ROLE_COVERAGE" && entry.severity === "AMBER"
      )
    ).toBe(true);
  });

  it("flags MISSING_COMPETENCY when a required competency is not held by the assignee", async () => {
    const shift = makeShift({
      roleRequirements: [
        {
          roleLabel: "Operator",
          requiredCount: 1,
          competencyId: "comp-1",
          competency: { name: "Forklift" }
        }
      ],
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: "Operator",
          worker: makeWorker({ competencies: [] })
        }
      ],
      assetAssignments: [{ assetId: "asset-1", asset: makeAsset() }]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    const data = (createMany.mock.calls[0]?.[0] as { data: Array<{ code: string }> }).data;
    expect(data.some((entry) => entry.code === "MISSING_COMPETENCY")).toBe(true);
  });

  it("flags COMPETENCY_EXPIRING when an assignee's competency expires during the shift", async () => {
    const shift = makeShift({
      roleRequirements: [
        {
          roleLabel: "Operator",
          requiredCount: 1,
          competencyId: "comp-1",
          competency: { name: "Forklift" }
        }
      ],
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: "Operator",
          worker: makeWorker({
            competencies: [
              {
                competencyId: "comp-1",
                expiresAt: new Date("2026-04-28T10:00:00.000Z"),
                competency: { name: "Forklift" }
              }
            ]
          })
        }
      ],
      assetAssignments: [{ assetId: "asset-1", asset: makeAsset() }]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    const data = (createMany.mock.calls[0]?.[0] as { data: Array<{ code: string }> }).data;
    expect(data.some((entry) => entry.code === "COMPETENCY_EXPIRING")).toBe(true);
  });

  it("flags ROLE_SUITABILITY when the worker is marked UNSUITABLE for the role", async () => {
    const shift = makeShift({
      roleRequirements: [
        {
          roleLabel: "Operator",
          requiredCount: 1,
          competencyId: null,
          competency: null
        }
      ],
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: "Operator",
          worker: makeWorker({
            roleSuitabilities: [
              { roleLabel: "Operator", suitability: "UNSUITABLE" }
            ]
          })
        }
      ],
      assetAssignments: [{ assetId: "asset-1", asset: makeAsset() }]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    const data = (createMany.mock.calls[0]?.[0] as { data: Array<{ code: string }> }).data;
    expect(data.some((entry) => entry.code === "ROLE_SUITABILITY")).toBe(true);
  });

  it("flags ASSET_OVERLAP when the asset is booked on another overlapping shift", async () => {
    const shift = makeShift({
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: null,
          worker: makeWorker()
        }
      ],
      assetAssignments: [
        { assetId: "asset-1", asset: makeAsset() }
      ]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            shift: { id: "shift-other" },
            asset: { name: "Excavator" }
          }
        ])
      },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    const data = (createMany.mock.calls[0]?.[0] as { data: Array<{ code: string; severity: string }> }).data;
    expect(
      data.some(
        (entry) => entry.code === "ASSET_OVERLAP" && entry.severity === "RED"
      )
    ).toBe(true);
  });

  it("flags ASSET_MAINTENANCE_BLOCK when an asset has an open breakdown", async () => {
    const shift = makeShift({
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: null,
          worker: makeWorker()
        }
      ],
      assetAssignments: [
        {
          assetId: "asset-1",
          asset: makeAsset({
            breakdowns: [{ status: "OPEN" }]
          })
        }
      ]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    const data = (createMany.mock.calls[0]?.[0] as { data: Array<{ code: string; severity: string }> }).data;
    expect(
      data.some(
        (entry) => entry.code === "ASSET_MAINTENANCE_BLOCK" && entry.severity === "RED"
      )
    ).toBe(true);
  });

  it("flags ASSET_MAINTENANCE_WARNING when the asset is in MAINTENANCE state", async () => {
    const shift = makeShift({
      workerAssignments: [
        {
          workerId: "worker-1",
          roleLabel: null,
          worker: makeWorker()
        }
      ],
      assetAssignments: [
        {
          assetId: "asset-1",
          asset: makeAsset({ status: "MAINTENANCE" })
        }
      ]
    });
    const createMany = jest.fn();
    const prisma = {
      shift: { findUnique: jest.fn().mockResolvedValue(shift) },
      shiftWorkerAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssetAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      schedulingConflict: { deleteMany: jest.fn(), createMany }
    };
    const service = new SchedulerService(
      prisma as never,
      buildAudit() as never,
      buildNotifications() as never
    );

    await service["refreshConflicts"]("shift-1");

    const data = (createMany.mock.calls[0]?.[0] as { data: Array<{ code: string; severity: string }> }).data;
    expect(
      data.some(
        (entry) =>
          entry.code === "ASSET_MAINTENANCE_WARNING" && entry.severity === "AMBER"
      )
    ).toBe(true);
  });
});
