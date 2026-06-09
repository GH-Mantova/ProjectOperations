// Mock-based unit tests for WorkerAvailabilityService.
// Mirrors PR #283 (ProjectsService), PR #298 (FormsService), PR #311
// (SchedulerService). Drives the service directly with plain-object Prisma
// stubs. No production code is modified.

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { WorkerAvailabilityService } from "../availability.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

// ─── Fixtures ──────────────────────────────────────────────────────────────

const ACTOR_SELF = {
  sub: "user-self",
  permissions: ["resources.manage"],
  isSuperUser: false
};

const ACTOR_ADMIN = {
  sub: "user-admin",
  permissions: ["resources.manage"],
  isSuperUser: true
};

const ACTOR_OTHER = {
  sub: "user-other",
  permissions: ["resources.manage"],
  isSuperUser: false
};

function workerOwnedBySelf(overrides: Record<string, unknown> = {}) {
  return { id: "worker-1", internalUserId: "user-self", ...overrides };
}

function leaveRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "leave-1",
    workerProfileId: "worker-1",
    leaveType: "annual",
    status: "PENDING",
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    endDate: new Date("2026-07-05T00:00:00.000Z"),
    notes: null,
    requestedById: "user-self",
    approvedById: null,
    approvedAt: null,
    workerProfile: { internalUserId: "user-self" },
    ...overrides
  };
}

function unavailabilityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "una-1",
    workerProfileId: "worker-1",
    reason: "Medical appointment",
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    endDate: new Date("2026-07-01T12:00:00.000Z"),
    recurringDay: null,
    ...overrides
  };
}

// ─── Mock builders ─────────────────────────────────────────────────────────

type PrismaMock = {
  workerProfile: { findUnique: AsyncMock };
  workerLeave: {
    create: AsyncMock;
    findMany: AsyncMock;
    findUnique: AsyncMock;
    update: AsyncMock;
    delete: AsyncMock;
  };
  workerUnavailability: {
    create: AsyncMock;
    findMany: AsyncMock;
    findUnique: AsyncMock;
    delete: AsyncMock;
  };
};

function buildPrismaMock(): PrismaMock {
  return {
    workerProfile: {
      findUnique: jest.fn().mockResolvedValue(workerOwnedBySelf()) as AsyncMock
    },
    workerLeave: {
      create: jest.fn().mockResolvedValue(leaveRow()) as AsyncMock,
      findMany: jest.fn().mockResolvedValue([]) as AsyncMock,
      findUnique: jest.fn().mockResolvedValue(leaveRow()) as AsyncMock,
      update: jest.fn().mockResolvedValue(leaveRow()) as AsyncMock,
      delete: jest.fn().mockResolvedValue(leaveRow()) as AsyncMock
    },
    workerUnavailability: {
      create: jest.fn().mockResolvedValue(unavailabilityRow()) as AsyncMock,
      findMany: jest.fn().mockResolvedValue([]) as AsyncMock,
      findUnique: jest.fn().mockResolvedValue(unavailabilityRow()) as AsyncMock,
      delete: jest.fn().mockResolvedValue(unavailabilityRow()) as AsyncMock
    }
  };
}

function buildService() {
  const prisma = buildPrismaMock();
  const service = new WorkerAvailabilityService(prisma as never);
  return { service, prisma };
}

// ─── Leaves: createLeave ────────────────────────────────────────────────────

describe("WorkerAvailabilityService.createLeave", () => {
  const baseDto = {
    workerProfileId: "worker-1",
    leaveType: "annual",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-05T00:00:00.000Z",
    notes: "Family trip"
  };

  it("happy path: self-actor creates a leave for their own worker profile", async () => {
    const { service, prisma } = buildService();

    await service.createLeave(baseDto as never, ACTOR_SELF as never);

    expect(prisma.workerProfile.findUnique).toHaveBeenCalledWith({
      where: { id: "worker-1" },
      select: { id: true, internalUserId: true }
    });
    expect(prisma.workerLeave.create).toHaveBeenCalledWith({
      data: {
        workerProfileId: "worker-1",
        leaveType: "annual",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-07-05T00:00:00.000Z"),
        notes: "Family trip",
        requestedById: "user-self"
      }
    });
  });

  it("happy path: super-user admin can lodge leave for another worker", async () => {
    const { service, prisma } = buildService();
    prisma.workerProfile.findUnique.mockResolvedValueOnce(
      workerOwnedBySelf({ internalUserId: "user-other" })
    );

    await service.createLeave(baseDto as never, ACTOR_ADMIN as never);

    expect(prisma.workerLeave.create).toHaveBeenCalled();
  });

  it("nulls out notes when the DTO omits them", async () => {
    const { service, prisma } = buildService();

    await service.createLeave(
      { ...baseDto, notes: undefined } as never,
      ACTOR_SELF as never
    );

    expect(prisma.workerLeave.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: null }) })
    );
  });

  it("rejects when endDate precedes startDate", async () => {
    const { service, prisma } = buildService();

    await expect(
      service.createLeave(
        { ...baseDto, startDate: "2026-07-10T00:00:00.000Z" } as never,
        ACTOR_SELF as never
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workerProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.workerLeave.create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the worker profile does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.workerProfile.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createLeave(baseDto as never, ACTOR_SELF as never)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workerLeave.create).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when a non-admin tries to lodge for another worker", async () => {
    const { service, prisma } = buildService();
    prisma.workerProfile.findUnique.mockResolvedValueOnce(
      workerOwnedBySelf({ internalUserId: "user-other" })
    );

    await expect(
      service.createLeave(baseDto as never, ACTOR_SELF as never)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workerLeave.create).not.toHaveBeenCalled();
  });
});

// ─── Leaves: listLeaves ─────────────────────────────────────────────────────

describe("WorkerAvailabilityService.listLeaves", () => {
  it("returns leaves ordered by start date desc with no filter when none given", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findMany.mockResolvedValueOnce([leaveRow()]);

    await service.listLeaves();

    expect(prisma.workerLeave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { startDate: "desc" }
      })
    );
  });

  it("scopes by workerProfileId when provided", async () => {
    const { service, prisma } = buildService();

    await service.listLeaves("worker-42");

    expect(prisma.workerLeave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workerProfileId: "worker-42" } })
    );
  });
});

// ─── Leaves: setLeaveStatus ─────────────────────────────────────────────────

describe("WorkerAvailabilityService.setLeaveStatus", () => {
  it("approves a leave and stamps approver + timestamp when actor is not the requester", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findUnique.mockResolvedValueOnce(
      leaveRow({ workerProfile: { internalUserId: "user-other" } })
    );

    await service.setLeaveStatus(
      "leave-1",
      { status: "APPROVED" } as never,
      ACTOR_ADMIN as never
    );

    const call = prisma.workerLeave.update.mock.calls[0][0] as {
      where: { id: string };
      data: {
        status: string;
        approvedById: string | null;
        approvedAt: Date | null;
        notes: string | null;
      };
    };
    expect(call.where).toEqual({ id: "leave-1" });
    expect(call.data.status).toBe("APPROVED");
    expect(call.data.approvedById).toBe("user-admin");
    expect(call.data.approvedAt).toBeInstanceOf(Date);
  });

  it("preserves existing notes when DTO omits them", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findUnique.mockResolvedValueOnce(
      leaveRow({
        notes: "existing",
        workerProfile: { internalUserId: "user-other" }
      })
    );

    await service.setLeaveStatus(
      "leave-1",
      { status: "DECLINED" } as never,
      ACTOR_ADMIN as never
    );

    expect(prisma.workerLeave.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: "existing" })
      })
    );
  });

  it("clears approver fields when status is not APPROVED", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findUnique.mockResolvedValueOnce(
      leaveRow({ workerProfile: { internalUserId: "user-other" } })
    );

    await service.setLeaveStatus(
      "leave-1",
      { status: "DECLINED" } as never,
      ACTOR_ADMIN as never
    );

    expect(prisma.workerLeave.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DECLINED",
          approvedById: null,
          approvedAt: null
        })
      })
    );
  });

  it("blocks self-approval even by an admin", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findUnique.mockResolvedValueOnce(
      leaveRow({ workerProfile: { internalUserId: "user-admin" } })
    );

    await expect(
      service.setLeaveStatus(
        "leave-1",
        { status: "APPROVED" } as never,
        ACTOR_ADMIN as never
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workerLeave.update).not.toHaveBeenCalled();
  });

  it("allows a worker to CANCEL their own leave (self-serve cancel)", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findUnique.mockResolvedValueOnce(
      leaveRow({ workerProfile: { internalUserId: "user-self" } })
    );

    await service.setLeaveStatus(
      "leave-1",
      { status: "CANCELLED" } as never,
      ACTOR_SELF as never
    );

    expect(prisma.workerLeave.update).toHaveBeenCalled();
  });

  it("throws NotFoundException when the leave does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.setLeaveStatus(
        "missing",
        { status: "APPROVED" } as never,
        ACTOR_ADMIN as never
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workerLeave.update).not.toHaveBeenCalled();
  });
});

// ─── Leaves: deleteLeave ────────────────────────────────────────────────────

describe("WorkerAvailabilityService.deleteLeave", () => {
  it("deletes the leave and returns its id", async () => {
    const { service, prisma } = buildService();

    const result = await service.deleteLeave("leave-1");

    expect(prisma.workerLeave.delete).toHaveBeenCalledWith({
      where: { id: "leave-1" }
    });
    expect(result).toEqual({ id: "leave-1" });
  });

  it("throws NotFoundException when the leave does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findUnique.mockResolvedValueOnce(null);

    await expect(service.deleteLeave("missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.workerLeave.delete).not.toHaveBeenCalled();
  });
});

// ─── Unavailability: createUnavailability ───────────────────────────────────

describe("WorkerAvailabilityService.createUnavailability", () => {
  const baseDto = {
    workerProfileId: "worker-1",
    reason: "School pickup",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-01T12:00:00.000Z"
  };

  it("happy path: persists with null recurringDay when not provided", async () => {
    const { service, prisma } = buildService();

    await service.createUnavailability(baseDto as never, ACTOR_SELF as never);

    expect(prisma.workerUnavailability.create).toHaveBeenCalledWith({
      data: {
        workerProfileId: "worker-1",
        reason: "School pickup",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-07-01T12:00:00.000Z"),
        recurringDay: null
      }
    });
  });

  it("persists recurringDay when provided", async () => {
    const { service, prisma } = buildService();

    await service.createUnavailability(
      { ...baseDto, recurringDay: 3 } as never,
      ACTOR_SELF as never
    );

    expect(prisma.workerUnavailability.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recurringDay: 3 })
      })
    );
  });

  it("rejects when endDate precedes startDate", async () => {
    const { service, prisma } = buildService();

    await expect(
      service.createUnavailability(
        { ...baseDto, startDate: "2026-07-02T00:00:00.000Z" } as never,
        ACTOR_SELF as never
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workerUnavailability.create).not.toHaveBeenCalled();
  });

  it("throws ForbiddenException when a non-admin acts on another worker", async () => {
    const { service, prisma } = buildService();
    prisma.workerProfile.findUnique.mockResolvedValueOnce(
      workerOwnedBySelf({ internalUserId: "user-someone-else" })
    );

    await expect(
      service.createUnavailability(baseDto as never, ACTOR_OTHER as never)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workerUnavailability.create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the worker profile is missing", async () => {
    const { service, prisma } = buildService();
    prisma.workerProfile.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createUnavailability(baseDto as never, ACTOR_SELF as never)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── Unavailability: listUnavailability ─────────────────────────────────────

describe("WorkerAvailabilityService.listUnavailability", () => {
  it("returns unavailability rows with no filter when none given", async () => {
    const { service, prisma } = buildService();

    await service.listUnavailability();

    expect(prisma.workerUnavailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { startDate: "desc" }
      })
    );
  });

  it("scopes by workerProfileId when provided", async () => {
    const { service, prisma } = buildService();

    await service.listUnavailability("worker-42");

    expect(prisma.workerUnavailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workerProfileId: "worker-42" } })
    );
  });
});

// ─── Unavailability: deleteUnavailability ───────────────────────────────────

describe("WorkerAvailabilityService.deleteUnavailability", () => {
  it("deletes the row and returns its id", async () => {
    const { service, prisma } = buildService();

    const result = await service.deleteUnavailability("una-1");

    expect(prisma.workerUnavailability.delete).toHaveBeenCalledWith({
      where: { id: "una-1" }
    });
    expect(result).toEqual({ id: "una-1" });
  });

  it("throws NotFoundException when the row is missing", async () => {
    const { service, prisma } = buildService();
    prisma.workerUnavailability.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.deleteUnavailability("missing")
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workerUnavailability.delete).not.toHaveBeenCalled();
  });
});

// ─── Calendar overlay ──────────────────────────────────────────────────────

describe("WorkerAvailabilityService.overlay", () => {
  const RANGE = {
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-31T23:59:59.000Z"
  };

  it("rejects when 'to' precedes 'from'", async () => {
    const { service, prisma } = buildService();

    await expect(
      service.overlay({
        from: "2026-07-31T00:00:00.000Z",
        to: "2026-07-01T00:00:00.000Z"
      } as never)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workerLeave.findMany).not.toHaveBeenCalled();
  });

  it("only includes APPROVED leaves in the overlay query", async () => {
    const { service, prisma } = buildService();

    await service.overlay(RANGE as never);

    expect(prisma.workerLeave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "APPROVED" })
      })
    );
  });

  it("scopes both queries by workerProfileId when supplied", async () => {
    const { service, prisma } = buildService();

    await service.overlay({ ...RANGE, workerProfileId: "worker-7" } as never);

    expect(prisma.workerLeave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workerProfileId: "worker-7" })
      })
    );
    expect(prisma.workerUnavailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workerProfileId: "worker-7" })
      })
    );
  });

  it("maps approved leaves to leave bars with leaveType as label", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findMany.mockResolvedValueOnce([
      {
        id: "leave-1",
        workerProfileId: "worker-1",
        leaveType: "sick",
        notes: "flu",
        startDate: new Date("2026-07-10T00:00:00.000Z"),
        endDate: new Date("2026-07-12T00:00:00.000Z")
      }
    ]);

    const bars = await service.overlay(RANGE as never);

    expect(bars).toEqual([
      expect.objectContaining({
        kind: "leave",
        id: "leave-1",
        workerProfileId: "worker-1",
        label: "sick",
        notes: "flu"
      })
    ]);
  });

  it("emits a single one-shot unavailability bar when recurringDay is null", async () => {
    const { service, prisma } = buildService();
    prisma.workerUnavailability.findMany.mockResolvedValueOnce([
      unavailabilityRow({
        id: "una-x",
        startDate: new Date("2026-07-05T08:00:00.000Z"),
        endDate: new Date("2026-07-05T17:00:00.000Z"),
        recurringDay: null
      })
    ]);

    const bars = await service.overlay(RANGE as never);

    const unavailabilityBars = bars.filter((b) => b.kind === "unavailability");
    expect(unavailabilityBars).toHaveLength(1);
    expect(unavailabilityBars[0]).toMatchObject({
      id: "una-x",
      recurringDay: null
    });
  });

  it("expands a weekly-recurring unavailability into one bar per matching day-of-week", async () => {
    const { service, prisma } = buildService();
    // Range: a full week starting Wed 2026-07-01 → Tue 2026-07-07. Wed=3.
    // Recurring on day 3 (Wed) inside that range yields exactly one bar.
    prisma.workerUnavailability.findMany.mockResolvedValueOnce([
      unavailabilityRow({
        id: "una-rec",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-07-07T00:00:00.000Z"),
        recurringDay: 3
      })
    ]);

    const bars = await service.overlay({
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-07T23:59:59.000Z"
    } as never);

    const unavailabilityBars = bars.filter((b) => b.kind === "unavailability");
    expect(unavailabilityBars).toHaveLength(1);
    expect(unavailabilityBars[0].id).toContain("una-rec::");
    expect(unavailabilityBars[0].recurringDay).toBe(3);
  });

  it("returns an empty list when no leaves or unavailability overlap the range", async () => {
    const { service } = buildService();

    const bars = await service.overlay(RANGE as never);

    expect(bars).toEqual([]);
  });
});

// ─── Conflict check ────────────────────────────────────────────────────────

describe("WorkerAvailabilityService.conflictsForShift", () => {
  const SHIFT_START = new Date("2026-07-05T06:00:00.000Z");
  const SHIFT_END = new Date("2026-07-05T14:00:00.000Z");

  it("returns approved leaves that overlap the proposed shift window", async () => {
    const { service, prisma } = buildService();
    prisma.workerLeave.findMany.mockResolvedValueOnce([
      {
        id: "leave-clash",
        workerProfileId: "worker-1",
        leaveType: "annual",
        notes: null,
        startDate: new Date("2026-07-04T00:00:00.000Z"),
        endDate: new Date("2026-07-06T00:00:00.000Z")
      }
    ]);

    const conflicts = await service.conflictsForShift(
      "worker-1",
      SHIFT_START,
      SHIFT_END
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: "leave", id: "leave-clash" });
  });

  it("returns an empty list when there are no overlapping bars", async () => {
    const { service } = buildService();

    const conflicts = await service.conflictsForShift(
      "worker-1",
      SHIFT_START,
      SHIFT_END
    );

    expect(conflicts).toEqual([]);
  });
});
