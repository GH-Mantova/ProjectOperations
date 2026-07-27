// GPS-A1: unit tests for the field service GPS hard-gate in createTimesheet
// and updateTimesheet. No schema changes — the columns already exist.

import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FieldService } from "../field.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

// Minimal worker profile with consent acknowledged
const WORKER = {
  id: "wp-test",
  internalUserId: "u-test",
  firstName: "Test",
  lastName: "Worker",
  phone: null,
  role: "LABOURER",
  locationConsent: true,
  locationConsentAt: new Date(),
  locationConsentRevokedAt: null
};

const ALLOCATION = {
  id: "alloc-1",
  projectId: "proj-1",
  workerProfileId: "wp-test"
};

function buildPrisma(overrides: Record<string, unknown> = {}) {
  const workerFindUnique = jest.fn().mockResolvedValue(WORKER) as AsyncMock;
  const allocationFindUnique = jest.fn().mockResolvedValue(ALLOCATION) as AsyncMock;
  const timesheetFindUnique = jest.fn().mockResolvedValue(null) as AsyncMock;
  const timesheetCreate = jest
    .fn()
    .mockResolvedValue({ id: "ts-1", projectId: "proj-1" }) as AsyncMock;
  const timesheetUpdate = jest
    .fn()
    .mockResolvedValue({ id: "ts-1", projectId: "proj-1" }) as AsyncMock;
  const locationLogFindMany = jest.fn().mockResolvedValue([]) as AsyncMock;
  const locationLogCreateMany = jest.fn().mockResolvedValue({ count: 0 }) as AsyncMock;
  const projectFindUnique = jest.fn().mockResolvedValue({ siteId: null }) as AsyncMock;

  return {
    workerProfile: { findUnique: workerFindUnique },
    projectAllocation: { findUnique: allocationFindUnique },
    timesheet: {
      findUnique: timesheetFindUnique,
      create: timesheetCreate,
      update: timesheetUpdate
    },
    workerLocationLog: {
      findMany: locationLogFindMany,
      createMany: locationLogCreateMany
    },
    project: { findUnique: projectFindUnique },
    ...overrides
  };
}

function buildService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = buildPrisma(prismaOverrides);
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new FieldService(prisma as never, notifications as never);
  return { service, prisma };
}

const ACTOR = { userId: "u-test", permissions: new Set<string>() };

const BASE_CREATE_DTO = {
  allocationId: "alloc-1",
  date: "2026-07-27",
  hoursWorked: 8,
  breakMinutes: 30
};

describe("FieldService.createTimesheet — GPS hard gate (GPS-A1)", () => {
  it("accepts a timesheet with no clock times (no GPS required)", async () => {
    const { service } = buildService();
    await expect(service.createTimesheet(BASE_CREATE_DTO, ACTOR)).resolves.toBeDefined();
  });

  it("accepts a timesheet with clockOnTime AND matching lat/lng", async () => {
    const { service } = buildService();
    const dto = {
      ...BASE_CREATE_DTO,
      clockOnTime: "2026-07-27T07:00:00",
      clockOnLat: -27.4698,
      clockOnLng: 153.0251,
      clockOnAccuracy: 12
    };
    await expect(service.createTimesheet(dto, ACTOR)).resolves.toBeDefined();
  });

  it("rejects 400 when clockOnTime is set without clockOnLat/Lng", async () => {
    const { service } = buildService();
    const dto = { ...BASE_CREATE_DTO, clockOnTime: "2026-07-27T07:00:00" };
    await expect(service.createTimesheet(dto, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects 400 when clockOnTime is set with lat but no lng", async () => {
    const { service } = buildService();
    const dto = {
      ...BASE_CREATE_DTO,
      clockOnTime: "2026-07-27T07:00:00",
      clockOnLat: -27.4698
    };
    await expect(service.createTimesheet(dto, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects 400 when clockOffTime is set without clockOffLat/Lng", async () => {
    const { service } = buildService();
    const dto = {
      ...BASE_CREATE_DTO,
      clockOnTime: "2026-07-27T07:00:00",
      clockOnLat: -27.4698,
      clockOnLng: 153.0251,
      clockOffTime: "2026-07-27T15:30:00"
    };
    await expect(service.createTimesheet(dto, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts a timesheet with both clock times and matching lat/lng pairs", async () => {
    const { service } = buildService();
    const dto = {
      ...BASE_CREATE_DTO,
      clockOnTime: "2026-07-27T07:00:00",
      clockOnLat: -27.4698,
      clockOnLng: 153.0251,
      clockOnAccuracy: 8,
      clockOffTime: "2026-07-27T15:30:00",
      clockOffLat: -27.4699,
      clockOffLng: 153.0252,
      clockOffAccuracy: 10
    };
    await expect(service.createTimesheet(dto, ACTOR)).resolves.toBeDefined();
  });

  it("passes correct GPS data to prisma.timesheet.create when consent is true", async () => {
    const { service, prisma } = buildService();
    const dto = {
      ...BASE_CREATE_DTO,
      clockOnTime: "2026-07-27T07:00:00",
      clockOnLat: -27.4698,
      clockOnLng: 153.0251,
      clockOnAccuracy: 9
    };
    await service.createTimesheet(dto, ACTOR);
    const createCall = (prisma.timesheet.create as jest.Mock).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.clockOnLat).toEqual(new Prisma.Decimal(-27.4698));
    expect(createCall.data.clockOnLng).toEqual(new Prisma.Decimal(153.0251));
    expect(createCall.data.clockOnAccuracy).toEqual(new Prisma.Decimal(9));
  });

  it("throws ConflictException on duplicate date+allocation", async () => {
    const { service } = buildService({
      timesheet: {
        findUnique: jest.fn().mockResolvedValue({ id: "existing-ts" }),
        create: jest.fn(),
        update: jest.fn()
      }
    });
    await expect(service.createTimesheet(BASE_CREATE_DTO, ACTOR)).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("throws ForbiddenException when allocation belongs to a different worker", async () => {
    const { service } = buildService({
      projectAllocation: {
        findUnique: jest.fn().mockResolvedValue({
          ...ALLOCATION,
          workerProfileId: "wp-other"
        })
      }
    });
    await expect(service.createTimesheet(BASE_CREATE_DTO, ACTOR)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});

const EXISTING_TIMESHEET = {
  id: "ts-1",
  projectId: "proj-1",
  workerProfileId: "wp-test",
  allocationId: "alloc-1",
  status: "DRAFT",
  clockOnTime: null,
  clockOffTime: null
};

describe("FieldService.updateTimesheet — GPS hard gate (GPS-A1)", () => {
  it("accepts an update with no clock times (hours-only patch)", async () => {
    const { service } = buildService({
      timesheet: {
        findUnique: jest.fn().mockResolvedValue(EXISTING_TIMESHEET),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...EXISTING_TIMESHEET })
      }
    });
    await expect(
      service.updateTimesheet("ts-1", { hoursWorked: 9 }, ACTOR)
    ).resolves.toBeDefined();
  });

  it("rejects 400 when clockOnTime is updated without lat/lng", async () => {
    const { service } = buildService({
      timesheet: {
        findUnique: jest.fn().mockResolvedValue(EXISTING_TIMESHEET),
        create: jest.fn(),
        update: jest.fn()
      }
    });
    await expect(
      service.updateTimesheet(
        "ts-1",
        { clockOnTime: "2026-07-27T07:00:00" },
        ACTOR
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects 400 when clockOffTime is updated without lat/lng", async () => {
    const { service } = buildService({
      timesheet: {
        findUnique: jest.fn().mockResolvedValue(EXISTING_TIMESHEET),
        create: jest.fn(),
        update: jest.fn()
      }
    });
    await expect(
      service.updateTimesheet(
        "ts-1",
        { clockOffTime: "2026-07-27T15:30:00" },
        ACTOR
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts an update with clockOnTime and matching lat/lng", async () => {
    const { service } = buildService({
      timesheet: {
        findUnique: jest.fn().mockResolvedValue(EXISTING_TIMESHEET),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...EXISTING_TIMESHEET })
      }
    });
    await expect(
      service.updateTimesheet(
        "ts-1",
        {
          clockOnTime: "2026-07-27T07:00:00",
          clockOnLat: -27.4698,
          clockOnLng: 153.0251
        },
        ACTOR
      )
    ).resolves.toBeDefined();
  });
});
