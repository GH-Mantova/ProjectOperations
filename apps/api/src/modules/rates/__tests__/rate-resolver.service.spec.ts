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
    rateTable: { findUnique: jest.fn() },
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
