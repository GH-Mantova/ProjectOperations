import { BadRequestException } from "@nestjs/common";
import { LiveCrewService } from "../live-crew.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
    const prisma = { timesheet: { findMany } };
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
        accuracy: 12
      }
    ]);
  });

  it("surfaces workers on the clock with no GPS point as null lat/lng", async () => {
    const findMany = jest.fn().mockResolvedValue([
      buildRow({ clockOnLat: null, clockOnLng: null, clockOnAccuracy: null })
    ]) as AsyncMock;
    const prisma = { timesheet: { findMany } };
    const service = new LiveCrewService(prisma as never);

    const [row] = await service.whosWorking();
    expect(row.lat).toBeNull();
    expect(row.lng).toBeNull();
    expect(row.accuracy).toBeNull();
  });
});

describe("LiveCrewService.nearestWorker", () => {
  it("returns on-clock workers with GPS, sorted by haversine distance", async () => {
    const findMany = jest.fn().mockResolvedValue([
      buildRow({
        clockOnLat: -37.9,
        clockOnLng: 145.05,
        workerProfile: { id: "w-far", firstName: "Far", lastName: "Away", role: "Operator" }
      }),
      buildRow({
        clockOnLat: -37.815,
        clockOnLng: 144.965,
        workerProfile: { id: "w-near", firstName: "Near", lastName: "By", role: "Operator" }
      }),
      buildRow({
        clockOnLat: null,
        clockOnLng: null,
        workerProfile: { id: "w-nogps", firstName: "No", lastName: "Gps", role: "Operator" }
      })
    ]) as AsyncMock;
    const prisma = { timesheet: { findMany } };
    const service = new LiveCrewService(prisma as never);

    const result = await service.nearestWorker(-37.813, 144.963, 5);

    expect(result.map((r) => r.workerProfileId)).toEqual(["w-near", "w-far"]);
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm);
    expect(result[0].distanceKm).toBeGreaterThanOrEqual(0);
  });

  it("rejects non-finite or out-of-range coordinates", async () => {
    const prisma = { timesheet: { findMany: jest.fn() } };
    const service = new LiveCrewService(prisma as never);

    await expect(service.nearestWorker(Number.NaN, 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.nearestWorker(0, 200)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.nearestWorker(-91, 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("caps limit to at most 20 and defaults to 5", async () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      buildRow({
        clockOnLat: -37 - i * 0.01,
        clockOnLng: 145,
        workerProfile: { id: `w-${i}`, firstName: "W", lastName: String(i), role: "Op" }
      })
    );
    const findMany = jest.fn().mockResolvedValue(rows) as AsyncMock;
    const prisma = { timesheet: { findMany } };
    const service = new LiveCrewService(prisma as never);

    expect(await service.nearestWorker(-37, 145)).toHaveLength(5);
    expect(await service.nearestWorker(-37, 145, 999)).toHaveLength(20);
  });
});
