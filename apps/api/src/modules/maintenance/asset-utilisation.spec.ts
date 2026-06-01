// Service-level tests for the §7 asset utilisation endpoint with a mocked
// Prisma. Verifies the prisma query shape (filters by assetId / category,
// shift overlap window), the per-row arithmetic, capping at 1.0, sort
// order, and BadRequest on inverted / invalid ranges.

import { BadRequestException } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";

type ShiftStub = { id: string; startAt: Date; endAt: Date };
type AssignmentStub = { shift: ShiftStub };
type AssetStub = {
  id: string;
  name: string;
  category: { name: string } | null;
  shiftAssignments: AssignmentStub[];
};

type FindManyArgs = {
  where: {
    id?: string;
    category?: { name: string };
  };
  include: {
    shiftAssignments: {
      where: { shift: { startAt: { lt: Date }; endAt: { gt: Date } } };
    };
  };
};

function buildService(assets: AssetStub[]) {
  const findMany = jest.fn((_args: FindManyArgs) => Promise.resolve(assets));
  const prisma = { asset: { findMany } };
  const audit = { write: jest.fn() };
  const service = new MaintenanceService(prisma as never, audit as never);
  return { service, findMany };
}

function asset(overrides: Partial<AssetStub> & { id: string }): AssetStub {
  return {
    name: "Default asset",
    category: { name: "Plant" },
    shiftAssignments: [],
    ...overrides
  };
}

function shift(id: string, startAt: string, endAt: string): AssignmentStub {
  return { shift: { id, startAt: new Date(startAt), endAt: new Date(endAt) } };
}

describe("MaintenanceService.assetUtilisation (§7)", () => {
  // 2026-05-04 → 2026-05-08 is Mon-Fri → 40 working hours.
  const FROM = "2026-05-04";
  const TO = "2026-05-08";

  it("returns 0 utilisation / 0 allocations for an asset with no shifts in range", async () => {
    const { service } = buildService([asset({ id: "a-1", name: "Excavator 12t" })]);
    const rows = await service.assetUtilisation({ from: FROM, to: TO });
    expect(rows).toEqual([
      {
        assetId: "a-1",
        assetName: "Excavator 12t",
        category: "Plant",
        hoursAllocated: 0,
        hoursAvailable: 40,
        utilisationRate: 0,
        allocationCount: 0
      }
    ]);
  });

  it("computes ~0.5 utilisation for an asset allocated half the working hours", async () => {
    // 2 × 10h shifts on Mon and Tue = 20h allocated of 40h available.
    const { service } = buildService([
      asset({
        id: "a-2",
        name: "Bobcat S70",
        shiftAssignments: [
          shift("s-1", "2026-05-04T07:00:00.000Z", "2026-05-04T17:00:00.000Z"),
          shift("s-2", "2026-05-05T07:00:00.000Z", "2026-05-05T17:00:00.000Z")
        ]
      })
    ]);
    const rows = await service.assetUtilisation({ from: FROM, to: TO });
    expect(rows[0]!.hoursAllocated).toBe(20);
    expect(rows[0]!.utilisationRate).toBe(0.5);
    expect(rows[0]!.allocationCount).toBe(2);
  });

  it("caps utilisation at 1.0 when overlapping shifts over-allocate the asset", async () => {
    // Two overlapping full-week shifts → 80h "raw", which would otherwise
    // exceed the 40h Mon-Fri window.
    const { service } = buildService([
      asset({
        id: "a-3",
        name: "Truck 8t",
        shiftAssignments: [
          shift("s-1", "2026-05-04T00:00:00.000Z", "2026-05-08T16:00:00.000Z"),
          shift("s-2", "2026-05-04T00:00:00.000Z", "2026-05-08T16:00:00.000Z")
        ]
      })
    ]);
    const rows = await service.assetUtilisation({ from: FROM, to: TO });
    expect(rows[0]!.utilisationRate).toBe(1);
    expect(rows[0]!.allocationCount).toBe(2);
  });

  it("sorts by utilisationRate DESC then assetName ASC", async () => {
    const { service } = buildService([
      asset({ id: "a-low", name: "Zebra crane" }),
      asset({
        id: "a-mid-b",
        name: "Beta drill",
        shiftAssignments: [
          shift("s-1", "2026-05-04T08:00:00.000Z", "2026-05-04T16:00:00.000Z")
        ]
      }),
      asset({
        id: "a-mid-a",
        name: "Alpha drill",
        shiftAssignments: [
          shift("s-1", "2026-05-04T08:00:00.000Z", "2026-05-04T16:00:00.000Z")
        ]
      })
    ]);
    const rows = await service.assetUtilisation({ from: FROM, to: TO });
    expect(rows.map((r) => r.assetId)).toEqual(["a-mid-a", "a-mid-b", "a-low"]);
  });

  it("passes the assetId filter through to prisma.where", async () => {
    const { service, findMany } = buildService([]);
    await service.assetUtilisation({ from: FROM, to: TO, assetId: "a-42" });
    expect(findMany.mock.calls[0]![0].where.id).toBe("a-42");
  });

  it("passes the category filter through to prisma.where", async () => {
    const { service, findMany } = buildService([]);
    await service.assetUtilisation({ from: FROM, to: TO, category: "Trucks" });
    expect(findMany.mock.calls[0]![0].where.category).toEqual({ name: "Trucks" });
  });

  it("scopes the shift include to shifts overlapping the requested range", async () => {
    const { service, findMany } = buildService([]);
    await service.assetUtilisation({ from: FROM, to: TO });
    const shiftWhere = findMany.mock.calls[0]![0].include.shiftAssignments.where.shift;
    // `to` is rolled to end-of-day so single-day queries match shifts.
    expect(shiftWhere.startAt.lt).toEqual(new Date("2026-05-08T23:59:59.999Z"));
    expect(shiftWhere.endAt.gt).toEqual(new Date("2026-05-04T00:00:00.000Z"));
  });

  it("labels assets with no category as 'Uncategorised'", async () => {
    const { service } = buildService([asset({ id: "a-1", name: "Misc tool", category: null })]);
    const rows = await service.assetUtilisation({ from: FROM, to: TO });
    expect(rows[0]!.category).toBe("Uncategorised");
  });

  it("throws BadRequest when from > to", async () => {
    const { service, findMany } = buildService([]);
    await expect(
      service.assetUtilisation({ from: "2026-05-10", to: "2026-05-04" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("throws BadRequest when from/to parse to NaN", async () => {
    const { service, findMany } = buildService([]);
    await expect(
      service.assetUtilisation({ from: "not-a-date", to: "2026-05-08" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
