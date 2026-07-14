import { NotFoundException } from "@nestjs/common";
import { RateResolverService } from "../rate-resolver.service";

const ORIGINAL_RATES_SOURCE = process.env.RATES_CANONICAL_SOURCE;

afterEach(() => {
  if (ORIGINAL_RATES_SOURCE === undefined) {
    delete process.env.RATES_CANONICAL_SOURCE;
  } else {
    process.env.RATES_CANONICAL_SOURCE = ORIGINAL_RATES_SOURCE;
  }
});

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

  test("enumerateRateSet: filters out reference tables at the DB layer", async () => {
    const prisma = makePrisma();
    const svc = new RateResolverService(prisma as never);
    await svc.enumerateRateSet();
    expect(prisma.rateTable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isReference: false } })
    );
  });

  test("resolveReferenceValue: returns the named metric for the matched key row", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue({
      id: "rt-exc",
      slug: "excavator-production",
      isReference: true,
      columns: [
        { id: "c-size", name: "Excavator size", role: "KEY", unit: null },
        { id: "c-exc", name: "Excavating", role: "VALUE", unit: "m³/hr" },
        { id: "c-slabs", name: "Demolishing concrete slabs", role: "VALUE", unit: "m³/day" }
      ]
    });
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-10t", cells: { "c-size": "10t", "c-exc": 50, "c-slabs": 20 } },
      { id: "r-20t", cells: { "c-size": "20t", "c-exc": 80, "c-slabs": 40 } }
    ]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveReferenceValue(
      "excavator-production",
      { "Excavator size": "10t" },
      "Excavating"
    );
    expect(out).toBe(50);
  });

  test("resolveReferenceValue: column-name lookup is case-insensitive and trims", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue({
      id: "rt-exc",
      slug: "excavator-production",
      isReference: true,
      columns: [
        { id: "c-size", name: "Excavator size", role: "KEY", unit: null },
        { id: "c-exc", name: "Excavating", role: "VALUE", unit: "m³/hr" }
      ]
    });
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-25t", cells: { "c-size": "25t", "c-exc": 100 } }
    ]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveReferenceValue(
      "excavator-production",
      { "Excavator size": "25t" },
      "  excavating  "
    );
    expect(out).toBe(100);
  });

  test("resolveReferenceValue: returns null when the KEY row is missing", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue({
      id: "rt-exc",
      slug: "excavator-production",
      isReference: true,
      columns: [
        { id: "c-size", name: "Excavator size", role: "KEY", unit: null },
        { id: "c-exc", name: "Excavating", role: "VALUE", unit: "m³/hr" }
      ]
    });
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-10t", cells: { "c-size": "10t", "c-exc": 50 } }
    ]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveReferenceValue(
      "excavator-production",
      { "Excavator size": "99t" },
      "Excavating"
    );
    expect(out).toBeNull();
  });

  test("resolveReferenceValue: returns null when the column name doesn't match", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue({
      id: "rt-exc",
      slug: "excavator-production",
      isReference: true,
      columns: [
        { id: "c-size", name: "Excavator size", role: "KEY", unit: null },
        { id: "c-exc", name: "Excavating", role: "VALUE", unit: "m³/hr" }
      ]
    });
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-10t", cells: { "c-size": "10t", "c-exc": 50 } }
    ]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveReferenceValue(
      "excavator-production",
      { "Excavator size": "10t" },
      "Unknown metric"
    );
    expect(out).toBeNull();
  });

  test("resolveReferenceValue: returns null when the row is inactive (filtered by isActive)", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue({
      id: "rt-exc",
      slug: "excavator-production",
      isReference: true,
      columns: [
        { id: "c-size", name: "Excavator size", role: "KEY", unit: null },
        { id: "c-exc", name: "Excavating", role: "VALUE", unit: "m³/hr" }
      ]
    });
    // rateRow.findMany is called with `isActive: true`; simulate the DB
    // dropping the row by returning an empty list.
    prisma.rateRow.findMany.mockResolvedValue([]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveReferenceValue(
      "excavator-production",
      { "Excavator size": "10t" },
      "Excavating"
    );
    expect(out).toBeNull();
    expect(prisma.rateRow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    );
  });

  test("resolveReferenceValue: returns null when the table is not flagged isReference", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue({
      id: "rt-plt",
      slug: "plant",
      isReference: false,
      columns: [
        { id: "c-item", name: "Item", role: "KEY", unit: null },
        { id: "c-rate", name: "Rate", role: "VALUE", unit: "hr" }
      ]
    });
    prisma.rateRow.findMany.mockResolvedValue([
      { id: "r-x", cells: { "c-item": "X", "c-rate": 10 } }
    ]);
    const svc = new RateResolverService(prisma as never);
    const out = await svc.resolveReferenceValue("plant", { Item: "X" }, "Rate");
    expect(out).toBeNull();
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

  describe("RATES_CANONICAL_SOURCE", () => {
    test("unset flag keeps legacy-first behaviour byte-identical", async () => {
      delete process.env.RATES_CANONICAL_SOURCE;
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
      // Never touched the ratetable model in legacy mode.
      expect(prisma.rateTable.findUnique).not.toHaveBeenCalled();
    });

    test("flag=legacy is identical to unset (default)", async () => {
      process.env.RATES_CANONICAL_SOURCE = "legacy";
      const prisma = makePrisma();
      prisma.estimatePlantRate.findUnique.mockResolvedValue({
        id: "p-1",
        rate: "80",
        unit: "hr"
      });
      const svc = new RateResolverService(prisma as never);
      const out = await svc.resolveRate("plant", { item: "Excavator 20t" });
      expect(out).toEqual({ rowId: "p-1", value: 80, unit: "hr", source: "legacy" });
      expect(prisma.rateTable.findUnique).not.toHaveBeenCalled();
    });

    test("flag=ratetable answers 'labour' from RateTable, not the legacy DB path", async () => {
      process.env.RATES_CANONICAL_SOURCE = "ratetable";
      const prisma = makePrisma();
      prisma.rateTable.findUnique.mockResolvedValue({
        id: "rt-lbr",
        slug: "labour",
        columns: [
          { id: "c-role", name: "role", role: "KEY", unit: null },
          { id: "c-day", name: "day", role: "VALUE", unit: "day" }
        ]
      });
      prisma.rateRow.findMany.mockResolvedValue([
        { id: "rr-foreman", cells: { "c-role": "Foreman", "c-day": 450 } }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out = await svc.resolveRate("labour", { role: "Foreman" });
      expect(out).toEqual({ rowId: "rr-foreman", value: 450, unit: "day", source: "ratetable" });
      // The legacy path must NOT be touched when the canonical source is ratetable.
      expect(prisma.estimateLabourRate.findUnique).not.toHaveBeenCalled();
    });

    test("flag=ratetable falls back to legacy when the ratetable has no matching row", async () => {
      process.env.RATES_CANONICAL_SOURCE = "ratetable";
      const prisma = makePrisma();
      // Slug is not present in the flexible model at all — simulate seed gap.
      prisma.rateTable.findUnique.mockResolvedValue(null);
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

    test("flag=ratetable throws NotFound when neither source has the slug", async () => {
      process.env.RATES_CANONICAL_SOURCE = "ratetable";
      const prisma = makePrisma();
      prisma.rateTable.findUnique.mockResolvedValue(null);
      const svc = new RateResolverService(prisma as never);
      await expect(svc.resolveRate("nope", {})).rejects.toBeInstanceOf(NotFoundException);
    });

    test("garbage flag value falls back to legacy (no silent 'ratetable' promotion)", async () => {
      process.env.RATES_CANONICAL_SOURCE = "yes-please";
      const prisma = makePrisma();
      prisma.estimateLabourRate.findUnique.mockResolvedValue({
        id: "lab-1",
        dayRate: "450",
        nightRate: "520",
        weekendRate: "600"
      });
      const svc = new RateResolverService(prisma as never);
      const out = await svc.resolveRate("labour", { role: "Foreman", shift: "day" });
      expect(out.source).toBe("legacy");
      // The ratetable path is not even consulted when the flag is unrecognised.
      expect(prisma.rateTable.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("assertRateParity", () => {
    test("returns matches=true when both sources answer identically", async () => {
      const prisma = makePrisma();
      prisma.estimateLabourRate.findUnique.mockResolvedValue({
        id: "lab-1",
        dayRate: "450",
        nightRate: "520",
        weekendRate: "600"
      });
      prisma.rateTable.findUnique.mockResolvedValue({
        id: "rt-lbr",
        slug: "labour",
        columns: [
          { id: "c-role", name: "role", role: "KEY", unit: null },
          { id: "c-day", name: "day", role: "VALUE", unit: "day" }
        ]
      });
      prisma.rateRow.findMany.mockResolvedValue([
        { id: "rr-foreman", cells: { "c-role": "Foreman", "c-day": 450 } }
      ]);
      const svc = new RateResolverService(prisma as never);
      const parity = await svc.assertRateParity("labour", { role: "Foreman", shift: "day" });
      expect(parity.matches).toBe(true);
      expect(parity.divergence).toBeUndefined();
    });

    test("returns matches=false with divergence when values differ", async () => {
      const prisma = makePrisma();
      prisma.estimateLabourRate.findUnique.mockResolvedValue({
        id: "lab-1",
        dayRate: "450",
        nightRate: "520",
        weekendRate: "600"
      });
      prisma.rateTable.findUnique.mockResolvedValue({
        id: "rt-lbr",
        slug: "labour",
        columns: [
          { id: "c-role", name: "role", role: "KEY", unit: null },
          { id: "c-day", name: "day", role: "VALUE", unit: "day" }
        ]
      });
      prisma.rateRow.findMany.mockResolvedValue([
        { id: "rr-foreman", cells: { "c-role": "Foreman", "c-day": 999 } } // drifted from legacy 450
      ]);
      const svc = new RateResolverService(prisma as never);
      const parity = await svc.assertRateParity("labour", { role: "Foreman", shift: "day" });
      expect(parity.matches).toBe(false);
      expect(parity.divergence).toContain("450");
      expect(parity.divergence).toContain("999");
    });

    test("reports missing side when only one source has the slug", async () => {
      const prisma = makePrisma();
      prisma.estimateLabourRate.findUnique.mockResolvedValue({
        id: "lab-1",
        dayRate: "450",
        nightRate: "520",
        weekendRate: "600"
      });
      prisma.rateTable.findUnique.mockResolvedValue(null); // ratetable has no row
      const svc = new RateResolverService(prisma as never);
      const parity = await svc.assertRateParity("labour", { role: "Foreman", shift: "day" });
      expect(parity.matches).toBe(false);
      expect(parity.divergence).toContain("legacy=ok");
      expect(parity.divergence).toContain("ratetable=missing");
    });
  });
});
