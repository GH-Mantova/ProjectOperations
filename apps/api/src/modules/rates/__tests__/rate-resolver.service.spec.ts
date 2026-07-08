import { NotFoundException } from "@nestjs/common";
import { RateResolverService } from "../rate-resolver.service";

function makePrisma() {
  return {
    estimateLabourRate: { findUnique: jest.fn() },
    estimatePlantRate: { findUnique: jest.fn() },
    estimateWasteRate: { findUnique: jest.fn() },
    estimateCuttingRate: { findUnique: jest.fn() },
    estimateCoreHoleRate: { findUnique: jest.fn() },
    estimateFuelRate: { findUnique: jest.fn() },
    rateTable: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
    rateRow: { findMany: jest.fn().mockResolvedValue([]) }
  };
}

describe("RateResolverService", () => {
  test("legacy labour lookup returns dayRate with source=legacy", async () => {
    const prisma = makePrisma();
    prisma.estimateLabourRate.findUnique.mockResolvedValue({
      id: "lab-1",
      dayRate: "450",
      nightRate: "520",
      weekendRate: "600"
    });
    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveRate("labour", { role: "Foreman", shift: "day" });
    expect(out).toEqual({ rowId: "lab-1", value: 450, unit: "day", source: "legacy" });
  });

  test("unknown slug with no flexible table throws NotFoundException", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue(null);
    const svc = new RateResolverService(prisma as never);
    await expect(svc.resolveRate("nope", {})).rejects.toBeInstanceOf(NotFoundException);
  });

  test("enumerateRateSet: projects each active RateTable row × VALUE column into a labelled entry", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findMany.mockResolvedValue([
      {
        id: "rt-lbr",
        slug: "labour",
        name: "Labour rates",
        columns: [
          { id: "c-role", name: "Role", role: "KEY", unit: null, sortOrder: 1 },
          { id: "c-day", name: "Day rate", role: "VALUE", unit: "day", sortOrder: 2 },
          { id: "c-night", name: "Night rate", role: "VALUE", unit: "day", sortOrder: 3 }
        ]
      }
    ]);
    prisma.rateRow.findMany.mockResolvedValue([
      {
        id: "rr-lbr-foreman",
        cells: { "c-role": "Foreman", "c-day": 600, "c-night": 1000 }
      }
    ]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.enumerateRateSet();
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      key: "rt-lbr:rr-lbr-foreman:c-day",
      rateTableId: "rt-lbr",
      rateTableSlug: "labour",
      label: "Labour rates — Foreman (Day rate)",
      unit: "day",
      value: 600
    });
    expect(out[1].value).toBe(1000);
    expect(out[1].unit).toBe("day");
  });

  test("enumerateRateSet: skips VALUE cells that are missing or non-numeric", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findMany.mockResolvedValue([
      {
        id: "rt-x",
        slug: "x",
        name: "X",
        columns: [
          { id: "c-key", name: "Key", role: "KEY", unit: null, sortOrder: 1 },
          { id: "c-val", name: "Val", role: "VALUE", unit: null, sortOrder: 2 }
        ]
      }
    ]);
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-1", cells: { "c-key": "A", "c-val": 10 } },
      { id: "r-2", cells: { "c-key": "B" } }, // missing value → skipped
      { id: "r-3", cells: { "c-key": "C", "c-val": "not-a-number" } }
    ]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.enumerateRateSet();
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(10);
  });

  test("flexible table resolves KEY match and returns source=ratetable", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue({
      id: "t-1",
      slug: "custom",
      columns: [
        { id: "c-key", name: "region", role: "KEY", unit: null },
        { id: "c-val", name: "rate", role: "VALUE", unit: "hr" }
      ]
    });
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-1", cells: { "c-key": "SEQ", "c-val": 125 } }
    ]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveRate("custom", { region: "SEQ" });
    expect(out).toEqual({ rowId: "r-1", value: 125, unit: "hr", source: "ratetable" });
  });
});
