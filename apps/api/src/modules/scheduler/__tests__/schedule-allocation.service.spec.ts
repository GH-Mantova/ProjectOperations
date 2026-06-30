import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ScheduleAllocationService } from "../schedule-allocation.service";

/**
 * PR-452 — eligibility + upsert specs for the day-grain scheduler grid.
 *
 * The service is pure-Prisma; we mock the PrismaService surface and assert
 * the eligibility composition (effective-dated competencies, leave,
 * recurring unavailability, double-book) and the upsert override path.
 */

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    jobRole: { findUnique: jest.fn().mockResolvedValue(null) },
    workerQualification: { findMany: jest.fn().mockResolvedValue([]) },
    workerLeave: { findFirst: jest.fn().mockResolvedValue(null) },
    workerUnavailability: { findFirst: jest.fn().mockResolvedValue(null) },
    scheduleAllocation: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: "sa-mock" }),
      update: jest.fn().mockResolvedValue({ id: "sa-mock" }),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    workerProfile: { findMany: jest.fn().mockResolvedValue([]) },
    project: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    ...overrides
  } as never;
}

const ACTOR = { userId: "user-1", permissions: ["scheduler.manage"] };

describe("ScheduleAllocationService.computeEligibility", () => {
  const date = new Date("2026-07-10T00:00:00.000Z");

  it("returns eligible when all checks pass", async () => {
    const svc = new ScheduleAllocationService(prismaMock());
    const out = await svc.computeEligibility("w-1", null, date);
    expect(out).toEqual({ eligible: true, reasons: [] });
  });

  it("flags an expired mandatory competency (expiry one day BEFORE the slot)", async () => {
    const svc = new ScheduleAllocationService(
      prismaMock({
        jobRole: {
          findUnique: jest.fn().mockResolvedValue({
            id: "role-1",
            requirements: [
              { competency: { code: "asbestos_a", name: "Asbestos A" } }
            ]
          })
        },
        workerQualification: {
          findMany: jest.fn().mockResolvedValue([
            { qualType: "asbestos_a", expiryDate: new Date("2026-07-09T00:00:00.000Z") }
          ])
        }
      })
    );
    const out = await svc.computeEligibility("w-1", "role-1", date);
    expect(out.eligible).toBe(false);
    expect(out.reasons).toContain("expired:asbestos_a");
  });

  it("accepts a competency whose expiry equals the slot date (effective ON the day)", async () => {
    const svc = new ScheduleAllocationService(
      prismaMock({
        jobRole: {
          findUnique: jest.fn().mockResolvedValue({
            id: "role-1",
            requirements: [{ competency: { code: "asbestos_a", name: "A" } }]
          })
        },
        workerQualification: {
          findMany: jest.fn().mockResolvedValue([
            { qualType: "asbestos_a", expiryDate: date }
          ])
        }
      })
    );
    const out = await svc.computeEligibility("w-1", "role-1", date);
    expect(out.eligible).toBe(true);
  });

  it("flags a missing mandatory competency", async () => {
    const svc = new ScheduleAllocationService(
      prismaMock({
        jobRole: {
          findUnique: jest.fn().mockResolvedValue({
            id: "role-1",
            requirements: [{ competency: { code: "wh_red", name: "White card" } }]
          })
        }
      })
    );
    const out = await svc.computeEligibility("w-1", "role-1", date);
    expect(out.reasons).toContain("missing:wh_red");
  });

  it("flags on_leave when an APPROVED leave covers the day", async () => {
    const svc = new ScheduleAllocationService(
      prismaMock({
        workerLeave: {
          findFirst: jest.fn().mockResolvedValue({ leaveType: "ANNUAL" })
        }
      })
    );
    const out = await svc.computeEligibility("w-1", null, date);
    expect(out.reasons).toContain("on_leave:ANNUAL");
  });

  it("flags recurring unavailability via recurringDay (Sat=6 for 2026-07-11)", async () => {
    const saturday = new Date("2026-07-11T00:00:00.000Z");
    const svc = new ScheduleAllocationService(
      prismaMock({
        workerUnavailability: {
          findFirst: jest.fn().mockResolvedValue({ reason: "RDO" })
        }
      })
    );
    const out = await svc.computeEligibility("w-1", null, saturday);
    expect(out.reasons).toContain("unavailable:RDO");
  });

  it("flags double_booked when allocated to a different project that day", async () => {
    const svc = new ScheduleAllocationService(
      prismaMock({
        scheduleAllocation: {
          findFirst: jest.fn().mockResolvedValue({
            project: { projectNumber: "Buranda SS", name: "Buranda Storm" }
          }),
          findUnique: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([])
        }
      })
    );
    const out = await svc.computeEligibility("w-1", null, date);
    expect(out.reasons).toContain("double_booked:Buranda SS");
  });

  it("does not self-conflict when excludeProjectId matches the existing cell", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const svc = new ScheduleAllocationService(
      prismaMock({
        scheduleAllocation: {
          findFirst,
          findUnique: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([])
        }
      })
    );
    await svc.computeEligibility("w-1", null, date, "proj-A");
    expect(findFirst.mock.calls[0][0].where.projectId).toEqual({ not: "proj-A" });
  });
});

describe("ScheduleAllocationService.upsert", () => {
  const baseDto = {
    date: "2026-07-10",
    projectId: "proj-A",
    targetType: "WORKER" as const,
    workerProfileId: "w-1",
    jobRoleId: "role-1"
  };

  it("rejects WORKER cell without workerProfileId", async () => {
    const svc = new ScheduleAllocationService(prismaMock());
    await expect(
      svc.upsert({ ...baseDto, workerProfileId: undefined }, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects WORKER cell with assetId set", async () => {
    const svc = new ScheduleAllocationService(prismaMock());
    await expect(
      svc.upsert({ ...baseDto, assetId: "a-1" }, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("404s when the project is missing", async () => {
    const svc = new ScheduleAllocationService(
      prismaMock({ project: { findUnique: jest.fn().mockResolvedValue(null) } })
    );
    await expect(svc.upsert(baseDto, ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("blocks an ineligible worker without an override (409)", async () => {
    const svc = new ScheduleAllocationService(
      prismaMock({
        project: { findUnique: jest.fn().mockResolvedValue({ id: "proj-A", projectNumber: "P-A", name: "Proj A" }) },
        jobRole: {
          findUnique: jest.fn().mockResolvedValue({
            id: "role-1",
            requirements: [{ competency: { code: "wh_red" } }]
          })
        }
      })
    );
    await expect(svc.upsert(baseDto, ACTOR)).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects an override from an actor without scheduler.manage (403)", async () => {
    const svc = new ScheduleAllocationService(
      prismaMock({
        project: { findUnique: jest.fn().mockResolvedValue({ id: "proj-A", projectNumber: "P-A", name: "Proj A" }) },
        jobRole: {
          findUnique: jest.fn().mockResolvedValue({
            id: "role-1",
            requirements: [{ competency: { code: "wh_red" } }]
          })
        }
      })
    );
    await expect(
      svc.upsert({ ...baseDto, override: { reason: "training day" } }, { userId: "u-2", permissions: [] })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("records an AuditLog when an override is applied successfully", async () => {
    const upsert = jest.fn().mockResolvedValue({ id: "sa-1" });
    const auditCreate = jest.fn().mockResolvedValue({});
    const svc = new ScheduleAllocationService(
      prismaMock({
        project: { findUnique: jest.fn().mockResolvedValue({ id: "proj-A", projectNumber: "P-A", name: "Proj A" }) },
        jobRole: {
          findUnique: jest.fn().mockResolvedValue({
            id: "role-1",
            requirements: [{ competency: { code: "wh_red" } }]
          })
        },
        scheduleAllocation: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn(),
          create: upsert,
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([])
        },
        auditLog: { create: auditCreate }
      })
    );
    const out = await svc.upsert({ ...baseDto, override: { reason: "supervised by John" } }, ACTOR);
    expect(out.allocation.id).toBe("sa-1");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "schedule.unqualified_override" })
      })
    );
  });

  it("creates a new row when no existing cell matches", async () => {
    const create = jest.fn().mockResolvedValue({ id: "sa-1" });
    const findFirst = jest.fn().mockImplementation((args: { where: { workerProfileId?: string } }) =>
      Promise.resolve(args.where.workerProfileId ? null : null)
    );
    const svc = new ScheduleAllocationService(
      prismaMock({
        project: { findUnique: jest.fn().mockResolvedValue({ id: "proj-A", projectNumber: "P-A", name: "Proj A" }) },
        scheduleAllocation: {
          findFirst,
          findUnique: jest.fn(),
          create,
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([])
        }
      })
    );
    await svc.upsert({ ...baseDto, jobRoleId: undefined }, ACTOR);
    expect(create).toHaveBeenCalled();
    const callArg = create.mock.calls[0][0];
    expect(callArg.data.workerProfileId).toBe("w-1");
  });

  it("updates an existing cell when one matches", async () => {
    const update = jest.fn().mockResolvedValue({ id: "sa-existing" });
    // Two findFirst call sites: eligibility (no targetType in where) returns null,
    // upsert (targetType set) returns the existing cell.
    const findFirst = jest.fn().mockImplementation((args: { where: Record<string, unknown> }) =>
      Promise.resolve(args.where.targetType ? { id: "sa-existing" } : null)
    );
    const svc = new ScheduleAllocationService(
      prismaMock({
        project: { findUnique: jest.fn().mockResolvedValue({ id: "proj-A", projectNumber: "P-A", name: "Proj A" }) },
        scheduleAllocation: {
          findFirst,
          findUnique: jest.fn(),
          create: jest.fn(),
          update,
          delete: jest.fn(),
          deleteMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([])
        }
      })
    );
    await svc.upsert({ ...baseDto, note: "updated" }, ACTOR);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sa-existing" }, data: expect.objectContaining({ note: "updated" }) })
    );
  });
});

describe("ScheduleAllocationService.range", () => {
  it("clears cells in the range when clear=true", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const svc = new ScheduleAllocationService(
      prismaMock({
        scheduleAllocation: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
          deleteMany,
          findMany: jest.fn().mockResolvedValue([])
        }
      })
    );
    const out = await svc.range(
      {
        from: "2026-07-10",
        to: "2026-07-12",
        projectId: "proj-A",
        targetType: "WORKER",
        workerProfileId: "w-1",
        clear: true
      },
      ACTOR
    );
    expect(out).toEqual({ cleared: 3 });
    expect(deleteMany).toHaveBeenCalled();
  });

  it("rejects an inverted range", async () => {
    const svc = new ScheduleAllocationService(prismaMock());
    await expect(
      svc.range(
        { from: "2026-07-12", to: "2026-07-10", projectId: "proj-A", targetType: "WORKER", workerProfileId: "w-1" },
        ACTOR
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
