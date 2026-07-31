import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { LiveCrewService } from "../live-crew.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ts-1",
    clockOnTime: new Date("2026-07-20T06:00:00.000Z"),
    clockOnLat: -37.81,
    clockOnLng: 144.96,
    clockOnAccuracy: 12,
    workerProfile: { id: "w-1", firstName: "Ada", lastName: "Lovelace", role: "Operator" },
    project: { id: "p-1", name: "Melbourne CBD demo", projectNumber: "PRJ-0001" },
    ...overrides
  };
}

describe("LiveCrewService.whosWorking", () => {
  it("queries timesheets that are clocked on but not clocked off, ordered oldest first", async () => {
    const findMany = jest.fn().mockResolvedValue([buildRow()]) as AsyncMock;
    const breadcrumbFindMany = jest.fn().mockResolvedValue([]) as AsyncMock;
    const prisma = {
      timesheet: { findMany },
      workerLocationLog: { findMany: breadcrumbFindMany }
    };
    const service = new LiveCrewService(prisma as never);

    const result = await service.whosWorking();

    expect(findMany).toHaveBeenCalledWith({
      where: { clockOnTime: { not: null }, clockOffTime: null },
      orderBy: { clockOnTime: "asc" },
      include: expect.any(Object)
    });
    expect(result).toEqual([
      {
        workerProfileId: "w-1",
        workerName: "Ada Lovelace",
        role: "Operator",
        projectId: "p-1",
        projectName: "Melbourne CBD demo",
        projectNumber: "PRJ-0001",
        clockOnTime: "2026-07-20T06:00:00.000Z",
        lat: -37.81,
        lng: 144.96,
        accuracy: 12,
        lastFixAt: "2026-07-20T06:00:00.000Z",
        lastFixSource: "clock_on"
      }
    ]);
  });

  it("surfaces workers on the clock with no GPS point as null lat/lng", async () => {
    const findMany = jest.fn().mockResolvedValue([
      buildRow({ clockOnLat: null, clockOnLng: null, clockOnAccuracy: null })
    ]) as AsyncMock;
    const prisma = {
      timesheet: { findMany },
      workerLocationLog: { findMany: jest.fn().mockResolvedValue([]) as AsyncMock }
    };
    const service = new LiveCrewService(prisma as never);

    const [row] = await service.whosWorking();
    expect(row.lat).toBeNull();
    expect(row.lng).toBeNull();
    expect(row.accuracy).toBeNull();
    expect(row.lastFixAt).toBeNull();
    expect(row.lastFixSource).toBeNull();
  });

  it("prefers the latest breadcrumb over the clock-on pin when it is newer", async () => {
    const findMany = jest.fn().mockResolvedValue([buildRow()]) as AsyncMock;
    const breadcrumbFindMany = jest.fn().mockResolvedValue([
      {
        timesheetId: "ts-1",
        latitude: -37.82,
        longitude: 144.97,
        accuracy: 8,
        recordedAt: new Date("2026-07-20T06:30:00.000Z")
      }
    ]) as AsyncMock;
    const prisma = {
      timesheet: { findMany },
      workerLocationLog: { findMany: breadcrumbFindMany }
    };
    const service = new LiveCrewService(prisma as never);

    const [row] = await service.whosWorking();
    expect(row.lat).toBeCloseTo(-37.82);
    expect(row.lng).toBeCloseTo(144.97);
    expect(row.accuracy).toBe(8);
    expect(row.lastFixSource).toBe("breadcrumb");
    expect(row.lastFixAt).toBe("2026-07-20T06:30:00.000Z");
  });

  it("keeps the clock-on pin when the newest breadcrumb is older than clock-on", async () => {
    const findMany = jest.fn().mockResolvedValue([buildRow()]) as AsyncMock;
    const breadcrumbFindMany = jest.fn().mockResolvedValue([
      {
        timesheetId: "ts-1",
        latitude: -37.82,
        longitude: 144.97,
        accuracy: 8,
        recordedAt: new Date("2026-07-20T05:00:00.000Z")
      }
    ]) as AsyncMock;
    const prisma = {
      timesheet: { findMany },
      workerLocationLog: { findMany: breadcrumbFindMany }
    };
    const service = new LiveCrewService(prisma as never);

    const [row] = await service.whosWorking();
    expect(row.lat).toBeCloseTo(-37.81);
    expect(row.lastFixSource).toBe("clock_on");
  });
});

describe("LiveCrewService.nearestWorker", () => {
  it("returns on-clock workers with GPS, sorted by haversine distance", async () => {
    const findMany = jest.fn().mockResolvedValue([
      buildRow({
        id: "ts-far",
        clockOnLat: -37.9,
        clockOnLng: 145.05,
        workerProfile: { id: "w-far", firstName: "Far", lastName: "Away", role: "Operator" }
      }),
      buildRow({
        id: "ts-near",
        clockOnLat: -37.815,
        clockOnLng: 144.965,
        workerProfile: { id: "w-near", firstName: "Near", lastName: "By", role: "Operator" }
      }),
      buildRow({
        id: "ts-nogps",
        clockOnLat: null,
        clockOnLng: null,
        workerProfile: { id: "w-nogps", firstName: "No", lastName: "Gps", role: "Operator" }
      })
    ]) as AsyncMock;
    const prisma = {
      timesheet: { findMany },
      workerLocationLog: { findMany: jest.fn().mockResolvedValue([]) as AsyncMock }
    };
    const service = new LiveCrewService(prisma as never);

    const result = await service.nearestWorker(-37.813, 144.963, 5);

    expect(result.map((r) => r.workerProfileId)).toEqual(["w-near", "w-far"]);
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm);
    expect(result[0].distanceKm).toBeGreaterThanOrEqual(0);
  });

  it("rejects non-finite or out-of-range coordinates", async () => {
    const prisma = {
      timesheet: { findMany: jest.fn() },
      workerLocationLog: { findMany: jest.fn() }
    };
    const service = new LiveCrewService(prisma as never);

    await expect(service.nearestWorker(Number.NaN, 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.nearestWorker(0, 200)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.nearestWorker(-91, 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("caps limit to at most 20 and defaults to 5", async () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      buildRow({
        id: `ts-${i}`,
        clockOnLat: -37 - i * 0.01,
        clockOnLng: 145,
        workerProfile: { id: `w-${i}`, firstName: "W", lastName: String(i), role: "Op" }
      })
    );
    const findMany = jest.fn().mockResolvedValue(rows) as AsyncMock;
    const prisma = {
      timesheet: { findMany },
      workerLocationLog: { findMany: jest.fn().mockResolvedValue([]) as AsyncMock }
    };
    const service = new LiveCrewService(prisma as never);

    expect(await service.nearestWorker(-37, 145)).toHaveLength(5);
    expect(await service.nearestWorker(-37, 145, 999)).toHaveLength(20);
  });
});

describe("LiveCrewService.getTrail", () => {
  const CLOCK_ON = new Date("2026-07-20T06:00:00.000Z");
  const OPEN_SHIFT = {
    id: "ts-open",
    clockOnTime: CLOCK_ON,
    clockOnLat: -37.81,
    clockOnLng: 144.96,
    clockOnAccuracy: 10
  };

  it("returns the ordered pin + breadcrumbs for the open shift when the actor is a dispatcher", async () => {
    const timesheetFindFirst = jest.fn().mockResolvedValue(OPEN_SHIFT) as AsyncMock;
    const breadcrumbFindMany = jest.fn().mockResolvedValue([
      {
        latitude: -37.82,
        longitude: 144.97,
        accuracy: 8,
        recordedAt: new Date("2026-07-20T06:03:00.000Z")
      },
      {
        latitude: -37.83,
        longitude: 144.98,
        accuracy: 9,
        recordedAt: new Date("2026-07-20T06:06:00.000Z")
      }
    ]) as AsyncMock;
    const workerFindUnique = jest.fn() as AsyncMock;
    const prisma = {
      timesheet: { findFirst: timesheetFindFirst },
      workerLocationLog: { findMany: breadcrumbFindMany },
      workerProfile: { findUnique: workerFindUnique }
    };
    const service = new LiveCrewService(prisma as never);

    const result = await service.getTrail("w-1", {
      userId: "u-dispatcher",
      permissions: new Set(["scheduler.view"])
    });

    expect(workerFindUnique).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.timesheetId).toBe("ts-open");
    expect(result!.points).toHaveLength(3);
    expect(result!.points.map((p) => p.source)).toEqual(["clock_on", "breadcrumb", "breadcrumb"]);
    expect(result!.points[0].recordedAt).toBe(CLOCK_ON.toISOString());
    expect(result!.points[2].recordedAt).toBe("2026-07-20T06:06:00.000Z");
  });

  it("returns null when the worker has no open shift", async () => {
    const prisma = {
      timesheet: { findFirst: jest.fn().mockResolvedValue(null) as AsyncMock },
      workerLocationLog: { findMany: jest.fn() as AsyncMock },
      workerProfile: { findUnique: jest.fn() as AsyncMock }
    };
    const service = new LiveCrewService(prisma as never);
    const result = await service.getTrail("w-1", {
      userId: "u-dispatcher",
      permissions: new Set(["scheduler.view"])
    });
    expect(result).toBeNull();
  });

  it("permits a worker to fetch their own trail without scheduler.view", async () => {
    const prisma = {
      timesheet: { findFirst: jest.fn().mockResolvedValue(OPEN_SHIFT) as AsyncMock },
      workerLocationLog: { findMany: jest.fn().mockResolvedValue([]) as AsyncMock },
      workerProfile: { findUnique: jest.fn().mockResolvedValue({ id: "w-self" }) as AsyncMock }
    };
    const service = new LiveCrewService(prisma as never);
    const result = await service.getTrail("w-self", {
      userId: "u-self",
      permissions: new Set()
    });
    expect(result).not.toBeNull();
    expect(result!.points).toHaveLength(1);
  });

  it("forbids a worker from fetching someone else's trail", async () => {
    const prisma = {
      timesheet: { findFirst: jest.fn() as AsyncMock },
      workerLocationLog: { findMany: jest.fn() as AsyncMock },
      workerProfile: { findUnique: jest.fn().mockResolvedValue({ id: "w-self" }) as AsyncMock }
    };
    const service = new LiveCrewService(prisma as never);
    await expect(
      service.getTrail("w-other", { userId: "u-self", permissions: new Set() })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
