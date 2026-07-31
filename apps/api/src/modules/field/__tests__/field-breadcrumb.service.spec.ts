// GPS-A2 — unit tests for the breadcrumb + open-shift service methods on
// FieldService. No schema changes: breadcrumbs land in WorkerLocationLog
// with eventType "breadcrumb".

import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FieldService } from "../field.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

const CONSENTING_WORKER = {
  id: "wp-1",
  internalUserId: "u-1",
  firstName: "Test",
  lastName: "Worker",
  phone: null,
  role: "LABOURER",
  locationConsent: true,
  locationConsentAt: new Date(),
  locationConsentRevokedAt: null
};

const OPEN_SHIFT = { id: "ts-open", projectId: "proj-1", clockOnTime: new Date("2026-07-20T06:00:00.000Z") };

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    workerProfile: {
      findUnique: jest.fn().mockResolvedValue(CONSENTING_WORKER) as AsyncMock
    },
    timesheet: {
      findFirst: jest.fn().mockResolvedValue(OPEN_SHIFT) as AsyncMock
    },
    workerLocationLog: {
      findFirst: jest.fn().mockResolvedValue(null) as AsyncMock,
      create: jest.fn().mockResolvedValue({}) as AsyncMock
    },
    ...overrides
  };
}

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = buildPrisma(prismaOverrides);
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new FieldService(prisma as never, notifications as never);
  return { service, prisma };
}

const ACTOR = { userId: "u-1", permissions: new Set<string>() };

describe("FieldService.getOpenTimesheet", () => {
  it("returns the open shift when the worker has one", async () => {
    const { service } = buildService();
    await expect(service.getOpenTimesheet(ACTOR)).resolves.toEqual({
      timesheetId: "ts-open",
      projectId: "proj-1",
      clockOnTime: OPEN_SHIFT.clockOnTime
    });
  });

  it("returns null when the worker has no open shift", async () => {
    const { service } = buildService({
      timesheet: { findFirst: jest.fn().mockResolvedValue(null) as AsyncMock }
    });
    await expect(service.getOpenTimesheet(ACTOR)).resolves.toBeNull();
  });
});

describe("FieldService.recordLocationBreadcrumb", () => {
  it("writes a breadcrumb row for the open shift", async () => {
    const { service, prisma } = buildService();
    const result = await service.recordLocationBreadcrumb(ACTOR, {
      lat: -37.81,
      lng: 144.96,
      accuracy: 12
    });
    expect(result).toEqual({ recorded: true, timesheetId: "ts-open" });
    const createCall = (prisma.workerLocationLog.create as jest.Mock).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data).toMatchObject({
      workerProfileId: "wp-1",
      timesheetId: "ts-open",
      eventType: "breadcrumb"
    });
    expect(createCall.data.latitude).toEqual(new Prisma.Decimal(-37.81));
    expect(createCall.data.longitude).toEqual(new Prisma.Decimal(144.96));
    expect(createCall.data.accuracy).toEqual(new Prisma.Decimal(12));
  });

  it("rejects when the worker has not granted location consent", async () => {
    const { service } = buildService({
      workerProfile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...CONSENTING_WORKER, locationConsent: false }) as AsyncMock
      }
    });
    await expect(
      service.recordLocationBreadcrumb(ACTOR, { lat: 0, lng: 0 })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects with 409 when the worker has no open shift", async () => {
    const { service } = buildService({
      timesheet: { findFirst: jest.fn().mockResolvedValue(null) as AsyncMock }
    });
    await expect(
      service.recordLocationBreadcrumb(ACTOR, { lat: 0, lng: 0 })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("throttles when a recent breadcrumb (<120s) already exists for the shift", async () => {
    const { service, prisma } = buildService({
      workerLocationLog: {
        findFirst: jest.fn().mockResolvedValue({ id: "recent-crumb" }) as AsyncMock,
        create: jest.fn() as AsyncMock
      }
    });
    const result = await service.recordLocationBreadcrumb(ACTOR, { lat: 0, lng: 0 });
    expect(result).toEqual({ recorded: false, reason: "throttled", timesheetId: "ts-open" });
    expect(prisma.workerLocationLog.create).not.toHaveBeenCalled();
  });

  it("passes the 120s floor cutoff to the recent-breadcrumb lookup", async () => {
    const { service, prisma } = buildService();
    const before = Date.now();
    await service.recordLocationBreadcrumb(ACTOR, { lat: 0, lng: 0 });
    const after = Date.now();
    const findFirstArgs = (prisma.workerLocationLog.findFirst as jest.Mock).mock.calls[0][0] as {
      where: { recordedAt: { gte: Date } };
    };
    const cutoff = findFirstArgs.where.recordedAt.gte.getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - 120_000);
    expect(cutoff).toBeLessThanOrEqual(after - 120_000);
  });
});
