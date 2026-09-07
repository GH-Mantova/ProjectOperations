import { NotFoundException } from "@nestjs/common";
import { RateResolverService } from "../rate-resolver.service";
import type { ListedRate } from "../rate-resolver.service";

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
    estimateLabourRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimatePlantRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateWasteRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateCuttingRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateCoreHoleRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateFuelRate: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    estimateEnclosureRate: { findMany: jest.fn().mockResolvedValue([]) },
    cuttingOtherRate: { findMany: jest.fn().mockResolvedValue([]) },
    estimateMaterialDensity: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([])
    },
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

  describe("material densities", () => {
    test("listMaterialDensities delegates to prisma with the estimating UI order", async () => {
      const prisma = makePrisma();
      const rows = [{ id: "den-1" }, { id: "den-2" }];
      prisma.estimateMaterialDensity.findMany.mockResolvedValue(rows);
      const svc = new RateResolverService(prisma as never);
      const out = await svc.listMaterialDensities();
      expect(out).toBe(rows);
      expect(prisma.estimateMaterialDensity.findMany).toHaveBeenCalledWith({
        orderBy: [{ isActive: "desc" }, { category: "asc" }, { materialName: "asc" }]
      });
    });

    test("resolveMaterialDensity is byte-identical to a direct legacy lookup", async () => {
      const prisma = makePrisma();
      prisma.estimateMaterialDensity.findUnique.mockResolvedValue({
        id: "den-concrete",
        materialName: "Concrete",
        density: "2400",
        unit: "kg/m³",
        kind: "VOLUME",
        category: "concrete"
      });
      const svc = new RateResolverService(prisma as never);
      const out = await svc.resolveMaterialDensity("Concrete");
      expect(out).toEqual({
        density: 2400,
        unit: "kg/m³",
        kind: "VOLUME",
        category: "concrete"
      });
      // Byte-identical guard: Number(row.density) is what pre-cutover
      // consumers computed; the resolver returns the same numeric value.
      expect(out?.density).toBe(Number("2400"));
      expect(prisma.rateTable.findUnique).not.toHaveBeenCalled();
    });

    test("resolveMaterialDensity falls back to the RateTable projection when legacy is missing", async () => {
      const prisma = makePrisma();
      prisma.estimateMaterialDensity.findUnique.mockResolvedValue(null);
      prisma.rateTable.findUnique.mockResolvedValue({
        id: "rt-md",
        slug: "material-densities",
        columns: [
          { id: "rt-md-c-material", name: "Material", role: "KEY" },
          { id: "rt-md-c-density", name: "Density", role: "VALUE", unit: "kg/m³" },
          { id: "rt-md-c-unit", name: "Unit", role: "INFO" },
          { id: "rt-md-c-kind", name: "Kind", role: "INFO" },
          { id: "rt-md-c-category", name: "Category", role: "INFO" }
        ]
      });
      prisma.rateRow.findMany.mockResolvedValue([
        {
          id: "rr-md-concrete",
          cells: {
            "rt-md-c-material": "Concrete",
            "rt-md-c-density": 2400,
            "rt-md-c-unit": "kg/m³",
            "rt-md-c-kind": "VOLUME",
            "rt-md-c-category": "concrete"
          }
        }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out = await svc.resolveMaterialDensity("Concrete");
      expect(out).toEqual({
        density: 2400,
        unit: "kg/m³",
        kind: "VOLUME",
        category: "concrete"
      });
    });

    test("resolveMaterialDensity returns null when neither source has the material", async () => {
      const prisma = makePrisma();
      prisma.estimateMaterialDensity.findUnique.mockResolvedValue(null);
      prisma.rateTable.findUnique.mockResolvedValue(null);
      const svc = new RateResolverService(prisma as never);
      expect(await svc.resolveMaterialDensity("Unobtainium")).toBeNull();
    });
  });

  describe("listRates", () => {
    test("RateTable path returns rows with keys, info, value, unit and source=ratetable", async () => {
      process.env.RATES_CANONICAL_SOURCE = "ratetable";
      const prisma = makePrisma();
      prisma.rateTable.findUnique.mockResolvedValue({
        id: "rt-plant",
        slug: "plant",
        columns: [
          { id: "c-item",     name: "Item",      role: "KEY",   unit: null, sortOrder: 1 },
          { id: "c-category", name: "Category",  role: "INFO",  unit: null, sortOrder: 2 },
          { id: "c-unit-inf", name: "Unit",      role: "INFO",  unit: null, sortOrder: 3 },
          { id: "c-rate",     name: "Rate",      role: "VALUE", unit: "day", sortOrder: 4 },
          // PLANT_FUEL_COLUMN_V1 — the second VALUE column. Present here for
          // the same reason sortOrder is: a fixture that omits it lets the
          // exhaustive toEqual below pass while proving nothing about it.
          { id: "c-fuel",     name: "Fuel rate", role: "VALUE", unit: "day", sortOrder: 5 }
        ]
      });
      prisma.rateRow.findMany.mockResolvedValue([
        // sortOrder is deliberately non-positional (7 at index 0, 3 at index 1)
        // AND deliberately present: a mocked row that omits it makes the
        // resolver emit `undefined`, and jest's toEqual treats an undefined
        // property as absent — so the exhaustive assertions below would pass
        // while proving nothing about sortOrder at all. The fuel cells are
        // present and DISTINCT from the rate cells for the same reason.
        { id: "rr-exc", isActive: true, sortOrder: 7, cells: { "c-item": "Excavator 20t", "c-category": "Excavator", "c-unit-inf": "day", "c-rate": 800, "c-fuel": 140 } },
        { id: "rr-doz", isActive: true, sortOrder: 3, cells: { "c-item": "Dozer D6",      "c-category": "Dozer",     "c-unit-inf": "day", "c-rate": 950, "c-fuel": 165 } }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("plant");
      expect(out).toHaveLength(2);
      // keys carries only KEY columns; info carries INFO columns.
      expect(out[0]).toEqual({
        rowId: "rr-exc",
        keys: { Item: "Excavator 20t" },
        info: { Category: "Excavator", Unit: "day" },
        value: 800,
        unit: "day",
        isActive: true,
        sortOrder: 7,
        fuelRate: 140,
        source: "ratetable"
      });
      expect(out[1]).toEqual({
        rowId: "rr-doz",
        keys: { Item: "Dozer D6" },
        info: { Category: "Dozer", Unit: "day" },
        value: 950,
        unit: "day",
        isActive: true,
        sortOrder: 3,
        fuelRate: 165,
        source: "ratetable"
      });
      // Legacy path must NOT be consulted when ratetable answered.
      expect(prisma.estimatePlantRate.findMany).not.toHaveBeenCalled();
    });

    test("RateTable path: a row with no INFO columns yields info={}", async () => {
      process.env.RATES_CANONICAL_SOURCE = "ratetable";
      const prisma = makePrisma();
      prisma.rateTable.findUnique.mockResolvedValue({
        id: "rt-fuel",
        slug: "fuel",
        columns: [
          { id: "c-item", name: "Item", role: "KEY",   unit: null, sortOrder: 1 },
          { id: "c-rate", name: "Rate", role: "VALUE", unit: "L",  sortOrder: 2 }
          // No INFO columns.
        ]
      });
      prisma.rateRow.findMany.mockResolvedValue([
        { id: "rr-diesel", cells: { "c-item": "Diesel", "c-rate": 2.1 } }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("fuel");
      expect(out).toHaveLength(1);
      expect(out[0]!.info).toEqual({});
      expect(out[0]!.info).not.toBeUndefined();
    });

    test("legacy path: plant rows carry info.Category and info.Unit", async () => {
      delete process.env.RATES_CANONICAL_SOURCE;
      const prisma = makePrisma();
      prisma.estimatePlantRate.findMany.mockResolvedValue([
        { id: "p-exc", item: "Excavator 20t", rate: "800", unit: "day", category: "Excavator" },
        { id: "p-doz", item: "Dozer D6",      rate: "950", unit: "day", category: null }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("plant");
      expect(out).toHaveLength(2);
      expect(out[0]!.info).toEqual({ Category: "Excavator", Unit: "day" });
      // null category becomes "" (seed pattern); caller must guard against empty string.
      expect(out[1]!.info).toEqual({ Category: "", Unit: "day" });
    });

    test("legacy path: non-plant slugs yield info={}", async () => {
      delete process.env.RATES_CANONICAL_SOURCE;
      const prisma = makePrisma();
      prisma.estimateFuelRate.findMany.mockResolvedValue([
        { id: "f-1", item: "Diesel", rate: "2.1", unit: "L" }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("fuel");
      expect(out).toHaveLength(1);
      expect(out[0]!.info).toEqual({});
    });

    test("falls back to legacy when RATES_CANONICAL_SOURCE=ratetable but rateTable slug is absent", async () => {
      process.env.RATES_CANONICAL_SOURCE = "ratetable";
      const prisma = makePrisma();
      // Slug not present in RateTable — simulate seed gap.
      prisma.rateTable.findUnique.mockResolvedValue(null);
      prisma.estimatePlantRate.findMany.mockResolvedValue([
        { id: "p-exc", item: "Excavator 20t", rate: "800", unit: "day", category: "Excavator" },
        { id: "p-doz", item: "Dozer D6",      rate: "950", unit: "day", category: null }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("plant");
      expect(out).toHaveLength(2);
      expect(out[0]).toMatchObject({ source: "legacy", value: 800, keys: { item: "Excavator 20t" }, info: { Category: "Excavator" } });
      expect(out[1]).toMatchObject({ source: "legacy", value: 950, keys: { item: "Dozer D6" } });
    });

    test("unknown slug throws NotFoundException", async () => {
      const prisma = makePrisma();
      // Slug is not registered in legacy adapter and not in RateTable.
      prisma.rateTable.findUnique.mockResolvedValue(null);
      const svc = new RateResolverService(prisma as never);
      await expect(svc.listRates("does-not-exist")).rejects.toBeInstanceOf(NotFoundException);
    });

    test("stable ordering: same result on two calls and findMany includes deterministic orderBy", async () => {
      delete process.env.RATES_CANONICAL_SOURCE;
      const prisma = makePrisma();
      // Legacy-first: plant slug is registered in adapter.
      prisma.estimatePlantRate.findMany.mockResolvedValue([
        { id: "p-a", item: "A tool", rate: "100", unit: "hr", category: "Tool" },
        { id: "p-b", item: "B tool", rate: "200", unit: "hr", category: "Tool" }
      ]);
      const svc = new RateResolverService(prisma as never);
      const first: ListedRate[] = await svc.listRates("plant");
      const second: ListedRate[] = await svc.listRates("plant");
      expect(first).toEqual(second);
      // The findMany call must have included the deterministic orderBy.
      expect(prisma.estimatePlantRate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { item: "asc" } })
      );
    });

    // -----------------------------------------------------------------------
    // SLICE 3a: waste adapter info bag — wasteGroup + loadRate
    // -----------------------------------------------------------------------
    test("legacy path: waste rows carry info.wasteGroup (string) and info.loadRate (number)", async () => {
      delete process.env.RATES_CANONICAL_SOURCE;
      const prisma = makePrisma();
      prisma.estimateWasteRate.findMany.mockResolvedValue([
        {
          id: "w-1",
          wasteType: "General waste",
          facility: "BMI Swanbank",
          wasteGroup: "GENERAL",
          unit: "tonne",
          tonRate: "180",
          loadRate: "120"
        },
        {
          id: "w-2",
          wasteType: "Concrete",
          facility: "Cleanaway Willawong",
          wasteGroup: "Inert",
          unit: "tonne",
          tonRate: "45",
          loadRate: "0"
        }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("waste");
      expect(out).toHaveLength(2);
      // info.wasteGroup is the raw string value (not coerced)
      expect(out[0]!.info).toEqual({ wasteGroup: "GENERAL", loadRate: 120 });
      expect(out[1]!.info).toEqual({ wasteGroup: "Inert", loadRate: 0 });
      // info.loadRate is a JS number (Number(Decimal)), not a Decimal
      expect(typeof out[0]!.info.loadRate).toBe("number");
      expect(typeof out[1]!.info.loadRate).toBe("number");
    });

    test("legacy path: waste info.wasteGroup is null when DB value is null (not coerced to string)", async () => {
      delete process.env.RATES_CANONICAL_SOURCE;
      const prisma = makePrisma();
      prisma.estimateWasteRate.findMany.mockResolvedValue([
        {
          id: "w-null",
          wasteType: "Asphalt",
          facility: "Suez Environmental",
          wasteGroup: null,   // String? — null must pass through
          unit: "tonne",
          tonRate: "95",
          loadRate: "0"
        }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("waste");
      expect(out).toHaveLength(1);
      // null must NOT be coerced to "" — the export adds ?? "" at render time
      expect(out[0]!.info.wasteGroup).toBeNull();
      expect(out[0]!.info.loadRate).toBe(0);
    });

    test("legacy path: waste info.loadRate is always a number, not a Prisma Decimal", async () => {
      delete process.env.RATES_CANONICAL_SOURCE;
      const prisma = makePrisma();
      prisma.estimateWasteRate.findMany.mockResolvedValue([
        {
          id: "w-dec",
          wasteType: "Mixed C&D",
          facility: "BMI Swanbank",
          wasteGroup: "C&D",
          unit: "tonne",
          tonRate: "150",
          loadRate: "87.50"
        }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("waste");
      expect(out[0]!.info.loadRate).toBe(87.5);
      // Must be a JS number primitive, not a Decimal object.
      // typeof "number" is sufficient: Decimal objects have typeof "object".
      expect(typeof out[0]!.info.loadRate).toBe("number");
    });

    test("legacy path: waste keys still carry wasteType + facility (unchanged)", async () => {
      delete process.env.RATES_CANONICAL_SOURCE;
      const prisma = makePrisma();
      prisma.estimateWasteRate.findMany.mockResolvedValue([
        {
          id: "w-keys",
          wasteType: "General waste",
          facility: "Cleanaway Willawong",
          wasteGroup: "GENERAL",
          unit: "tonne",
          tonRate: "180",
          loadRate: "0"
        }
      ]);
      const svc = new RateResolverService(prisma as never);
      const out: ListedRate[] = await svc.listRates("waste");
      expect(out[0]!.keys).toEqual({ wasteType: "General waste", facility: "Cleanaway Willawong" });
      expect(out[0]!.value).toBe(180);
      expect(out[0]!.source).toBe("legacy");
    });

    // -----------------------------------------------------------------------
    // SLICE 11b2 (prerequisite): ListedRate.isActive
    //
    // The field REPORTS the source row's isActive column. It adds no filter,
    // so every fixture below is adversarial: it mixes active and inactive
    // rows and asserts BOTH that the row set is unchanged (the "additive"
    // regression guard) and that each entry's isActive matches its row.
    // -----------------------------------------------------------------------
    describe("isActive", () => {
      test("legacy waste: inactive rows are STILL returned, and isActive mirrors the row", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimateWasteRate.findMany.mockResolvedValue([
          { id: "w-on",  wasteType: "Concrete",      facility: "BMI Swanbank", wasteGroup: "Inert",   unit: "tonne", tonRate: "45",  loadRate: "0", isActive: true },
          { id: "w-off", wasteType: "General waste", facility: "Suez",         wasteGroup: "GENERAL", unit: "tonne", tonRate: "210", loadRate: "0", isActive: false }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("waste");

        // Row set unchanged — the inactive row is not filtered out.
        expect(out).toHaveLength(2);
        expect(out.map((r) => r.rowId)).toEqual(["w-on", "w-off"]);
        expect(out[0]!.isActive).toBe(true);
        expect(out[1]!.isActive).toBe(false);
        // No isActive filter was pushed into the query.
        expect(prisma.estimateWasteRate.findMany).toHaveBeenCalledWith({
          orderBy: [{ wasteType: "asc" }, { facility: "asc" }]
        });
      });

      test("legacy plant: same — rates-export.service.ts consumes this list", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimatePlantRate.findMany.mockResolvedValue([
          { id: "p-on",  item: "Excavator 20t", rate: "800", unit: "day", category: "Excavator", isActive: true },
          { id: "p-off", item: "Retired dozer", rate: "950", unit: "day", category: "Dozer",     isActive: false }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");

        expect(out).toHaveLength(2);
        expect(out.map((r) => [r.rowId, r.isActive])).toEqual([
          ["p-on", true],
          ["p-off", false]
        ]);
        expect(prisma.estimatePlantRate.findMany).toHaveBeenCalledWith({
          orderBy: { item: "asc" }
        });
      });

      test("RateTable path: the isActive:true `where` is intact and entries report isActive:true", async () => {
        process.env.RATES_CANONICAL_SOURCE = "ratetable";
        const prisma = makePrisma();
        prisma.rateTable.findUnique.mockResolvedValue({
          id: "rt-plant",
          slug: "plant",
          columns: [
            { id: "c-item", name: "Item", role: "KEY",   unit: null,  sortOrder: 1 },
            { id: "c-rate", name: "Rate", role: "VALUE", unit: "day", sortOrder: 2 }
          ]
        });
        // Prisma has already applied the where — only active rows come back.
        prisma.rateRow.findMany.mockResolvedValue([
          { id: "rr-a", isActive: true, cells: { "c-item": "Excavator 20t", "c-rate": 800 } }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");

        expect(prisma.rateRow.findMany).toHaveBeenCalledWith({
          where: { rateTableId: "rt-plant", isActive: true },
          orderBy: { sortOrder: "asc" }
        });
        expect(out).toHaveLength(1);
        expect(out[0]!.isActive).toBe(true);
        expect(out[0]!.source).toBe("ratetable");
      });

      test("labour fan-out: one inactive row yields three entries and ALL three report isActive:false", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimateLabourRate.findMany.mockResolvedValue([
          { id: "lab-off", role: "Retired role", dayRate: "450", nightRate: "520", weekendRate: "600", isActive: false }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("labour");

        expect(out).toHaveLength(3);
        expect(out.map((r) => r.keys.shift)).toEqual(["day", "night", "weekend"]);
        expect(out.map((r) => r.isActive)).toEqual([false, false, false]);
        expect(out.every((r) => r.rowId === "lab-off")).toBe(true);
      });

      test("the scope-waste filter is now expressible: .filter(r => r.isActive) yields exactly the active rows", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimateWasteRate.findMany.mockResolvedValue([
          { id: "w-1", wasteType: "Concrete",      facility: "BMI",  wasteGroup: "Inert",   unit: "tonne", tonRate: "45",  loadRate: "0", isActive: true },
          { id: "w-2", wasteType: "General waste", facility: "Suez", wasteGroup: "GENERAL", unit: "tonne", tonRate: "210", loadRate: "0", isActive: false },
          { id: "w-3", wasteType: "Asphalt",       facility: "BMI",  wasteGroup: "Inert",   unit: "tonne", tonRate: "95",  loadRate: "0", isActive: true }
        ]);
        const svc = new RateResolverService(prisma as never);

        // This is the call scope-waste.service.ts makes in the follow-up slice,
        // replacing its own `estimateWasteRate.findMany({ where: { isActive: true } })`.
        const active = (await svc.listRates("waste")).filter((r) => r.isActive);
        expect(active.map((r) => r.rowId)).toEqual(["w-1", "w-3"]);
      });

      test("the five remaining legacy adapters report their row's isActive verbatim", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        // Three adapters with NO isActive `where` — inactive rows come through.
        prisma.estimateCuttingRate.findMany.mockResolvedValue([
          { id: "c-off", equipment: "Ring saw", elevation: "Floor", material: "Concrete", depthMm: 100, ratePerM: "120", isActive: false }
        ]);
        prisma.estimateCoreHoleRate.findMany.mockResolvedValue([
          { id: "h-off", diameterMm: 100, ratePerHole: "80", isActive: false }
        ]);
        prisma.estimateFuelRate.findMany.mockResolvedValue([
          { id: "f-off", item: "Diesel", rate: "2.1", unit: "L", isActive: false }
        ]);
        // Two adapters that DO pre-filter — Prisma only ever hands back active rows.
        prisma.estimateEnclosureRate.findMany.mockResolvedValue([
          { id: "e-on", enclosureType: "Standard", rate: "300", unit: "each", isActive: true }
        ]);
        prisma.cuttingOtherRate.findMany.mockResolvedValue([
          { id: "o-on", description: "Setup", rate: "150", unit: "each", isActive: true }
        ]);
        const svc = new RateResolverService(prisma as never);

        expect((await svc.listRates("cutting")).map((r) => r.isActive)).toEqual([false]);
        expect((await svc.listRates("core-hole")).map((r) => r.isActive)).toEqual([false]);
        expect((await svc.listRates("fuel")).map((r) => r.isActive)).toEqual([false]);
        expect((await svc.listRates("enclosure")).map((r) => r.isActive)).toEqual([true]);
        expect((await svc.listRates("other-rates")).map((r) => r.isActive)).toEqual([true]);

        // The two pre-filtering adapters keep their `where` — unchanged by this slice.
        expect(prisma.estimateEnclosureRate.findMany).toHaveBeenCalledWith({
          where: { isActive: true },
          orderBy: { enclosureType: "asc" }
        });
        expect(prisma.cuttingOtherRate.findMany).toHaveBeenCalledWith({
          where: { isActive: true },
          orderBy: { description: "asc" }
        });
      });
    });

    // -----------------------------------------------------------------------
    // SLICE 11b3 (prerequisite): ListedRate.sortOrder
    //
    // The field REPORTS the source row's sort column. It adds no filter and no
    // ordering, so every fixture below is adversarial in the way that matters:
    // rows are mocked in an order that does NOT match their sortOrder values,
    // and the values are non-sequential and never equal to the array index.
    //
    //   - a resolver that DERIVED sortOrder from array position would emit
    //     0,1,2… and fail every value assertion below;
    //   - a resolver that SORTED by sortOrder would fail every row-order
    //     assertion below;
    //   - a resolver that defaulted it to 0 would fail both.
    //
    // Note the assertion style: `toBeNull()` and `typeof === "number"` are used
    // deliberately alongside toEqual, because jest's toEqual treats an
    // `undefined` property as absent and would not notice a field that stopped
    // being populated.
    // -----------------------------------------------------------------------
    describe("sortOrder", () => {
      test("legacy plant: sortOrder is READ FROM THE ROW, never derived from array position", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        // Mocked in the order Prisma returns them (item asc). Their sortOrder
        // values are 40, 5, 17 — non-sequential, and none equals its index.
        prisma.estimatePlantRate.findMany.mockResolvedValue([
          { id: "p-a", item: "Air compressor", rate: "300", unit: "day", category: "Access",     isActive: true, sortOrder: 40 },
          { id: "p-b", item: "Bobcat",         rate: "500", unit: "day", category: "Earthmoving", isActive: true, sortOrder: 5 },
          { id: "p-c", item: "Excavator 20t",  rate: "800", unit: "day", category: "Earthmoving", isActive: true, sortOrder: 17 }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");

        // THE point of the slice: position 0 reports 40, not 0.
        expect(out.map((r) => r.sortOrder)).toEqual([40, 5, 17]);
        // Row set AND order unchanged — the resolver did not sort by the new
        // field (sorted would be p-b, p-c, p-a).
        expect(out.map((r) => r.rowId)).toEqual(["p-a", "p-b", "p-c"]);
        // toEqual would accept `undefined` for a missing property; this will not.
        expect(out.every((r) => typeof r.sortOrder === "number")).toBe(true);
        // No filter and no ordering were pushed into the query.
        expect(prisma.estimatePlantRate.findMany).toHaveBeenCalledWith({
          orderBy: { item: "asc" }
        });
      });

      test("RateTable path: sortOrder mirrors RateRow.sortOrder and the row order is untouched", async () => {
        process.env.RATES_CANONICAL_SOURCE = "ratetable";
        const prisma = makePrisma();
        prisma.rateTable.findUnique.mockResolvedValue({
          id: "rt-plant",
          slug: "plant",
          columns: [
            { id: "c-item", name: "Item", role: "KEY",   unit: null,  sortOrder: 1 },
            { id: "c-rate", name: "Rate", role: "VALUE", unit: "day", sortOrder: 2 }
          ]
        });
        // Prisma has already applied `orderBy: { sortOrder: "asc" }`; these are
        // the rows as they come back. Values are 30/10/22 — the middle one is
        // out of ascending order on purpose, so an entry that quietly took its
        // array index (0,1,2) or re-sorted the list is visible here.
        prisma.rateRow.findMany.mockResolvedValue([
          { id: "rr-a", isActive: true, sortOrder: 30, cells: { "c-item": "Excavator 20t", "c-rate": 800 } },
          { id: "rr-b", isActive: true, sortOrder: 10, cells: { "c-item": "Dozer D6",      "c-rate": 950 } },
          { id: "rr-c", isActive: true, sortOrder: 22, cells: { "c-item": "Bobcat",        "c-rate": 500 } }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");

        expect(out.map((r) => [r.rowId, r.sortOrder])).toEqual([
          ["rr-a", 30],
          ["rr-b", 10],
          ["rr-c", 22]
        ]);
        // The `where` and `orderBy` of the RateTable path are untouched.
        expect(prisma.rateRow.findMany).toHaveBeenCalledWith({
          where: { rateTableId: "rt-plant", isActive: true },
          orderBy: { sortOrder: "asc" }
        });
      });

      test("labour fan-out: one row, three entries, all three carrying the row's sortOrder", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimateLabourRate.findMany.mockResolvedValue([
          { id: "lab-1", role: "Foreman", dayRate: "450", nightRate: "520", weekendRate: "600", isActive: true, sortOrder: 12 },
          { id: "lab-2", role: "Apprentice", dayRate: "250", nightRate: "300", weekendRate: "340", isActive: true, sortOrder: 3 }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("labour");

        expect(out).toHaveLength(6);
        // Each row's three shift entries share that row's value — and the
        // entries are NOT numbered 0..5 by position.
        expect(out.map((r) => r.sortOrder)).toEqual([12, 12, 12, 3, 3, 3]);
        expect(out.map((r) => r.keys.shift)).toEqual([
          "day", "night", "weekend", "day", "night", "weekend"
        ]);
      });

      test("other-rates: the CURATED business order survives — this is why the field exists", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        // The adapter orders by `description: "asc"`, which is NOT the curated
        // order. These are four real CuttingOtherRate seed rows, mocked
        // alphabetically as Prisma returns them, carrying their seeded
        // sortOrder values.
        prisma.cuttingOtherRate.findMany.mockResolvedValue([
          { id: "o-clean", description: "Clean-up time",                        rate: "95",  unit: "hour", isActive: true, sortOrder: 7 },
          { id: "o-extra", description: "Extra man",                            rate: "110", unit: "hour", isActive: true, sortOrder: 5 },
          { id: "o-ot",    description: "Overtime hourly charge beyond minimum", rate: "165", unit: "hour", isActive: true, sortOrder: 28 },
          { id: "o-stand", description: "Stand-down time",                      rate: "85",  unit: "hour", isActive: true, sortOrder: 6 }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("other-rates");

        // Alphabetical, exactly as before this slice — nothing was reordered.
        expect(out.map((r) => r.rowId)).toEqual(["o-clean", "o-extra", "o-ot", "o-stand"]);
        expect(out.map((r) => r.sortOrder)).toEqual([7, 5, 28, 6]);

        // And the curated order is now rebuildable at the call site, which it
        // was not before: this is the sort the persona lookup_rate handler
        // expresses as `orderBy: [{ sortOrder: "asc" }, { description: "asc" }]`.
        const curated = [...out].sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            String(a.keys.description).localeCompare(String(b.keys.description))
        );
        expect(curated.map((r) => r.keys.description)).toEqual([
          "Extra man",
          "Stand-down time",
          "Clean-up time",
          "Overtime hourly charge beyond minimum"
        ]);
      });

      test("core-hole reports null: EstimateCoreHoleRate has NO sort column and none is invented", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        // Note what is NOT on these rows: there is no sortOrder to read,
        // because the model does not declare one.
        prisma.estimateCoreHoleRate.findMany.mockResolvedValue([
          { id: "h-52",  diameterMm: 52,  ratePerHole: "60", isActive: true },
          { id: "h-100", diameterMm: 100, ratePerHole: "80", isActive: true }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("core-hole");

        // null, NOT 0 and NOT the array index. toBeNull() fails on undefined,
        // so this also guards against the field silently disappearing.
        expect(out[0]!.sortOrder).toBeNull();
        expect(out[1]!.sortOrder).toBeNull();
        expect(out.map((r) => r.sortOrder)).toEqual([null, null]);
        // The property is really there — a caller can distinguish "no curated
        // order for this kind" from "field not populated".
        expect(Object.keys(out[0]!)).toContain("sortOrder");
        expect(prisma.estimateCoreHoleRate.findMany).toHaveBeenCalledWith({
          orderBy: { diameterMm: "asc" }
        });
      });

      test("the remaining legacy adapters report their row's sortOrder verbatim", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimateWasteRate.findMany.mockResolvedValue([
          { id: "w-1", wasteType: "Concrete", facility: "BMI", wasteGroup: "Inert", unit: "tonne", tonRate: "45", loadRate: "0", isActive: true, sortOrder: 9 }
        ]);
        prisma.estimateCuttingRate.findMany.mockResolvedValue([
          { id: "c-1", equipment: "Ring saw", elevation: "Floor", material: "Concrete", depthMm: 100, ratePerM: "120", isActive: true, sortOrder: 14 }
        ]);
        prisma.estimateFuelRate.findMany.mockResolvedValue([
          { id: "f-1", item: "Diesel", rate: "2.1", unit: "L", isActive: true, sortOrder: 2 }
        ]);
        prisma.estimateEnclosureRate.findMany.mockResolvedValue([
          { id: "e-1", enclosureType: "Standard", rate: "300", unit: "each", isActive: true, sortOrder: 33 }
        ]);
        const svc = new RateResolverService(prisma as never);

        expect((await svc.listRates("waste")).map((r) => r.sortOrder)).toEqual([9]);
        expect((await svc.listRates("cutting")).map((r) => r.sortOrder)).toEqual([14]);
        expect((await svc.listRates("fuel")).map((r) => r.sortOrder)).toEqual([2]);
        expect((await svc.listRates("enclosure")).map((r) => r.sortOrder)).toEqual([33]);

        // Every `where`/`orderBy` in this slice's blast radius, unchanged.
        expect(prisma.estimateWasteRate.findMany).toHaveBeenCalledWith({
          orderBy: [{ wasteType: "asc" }, { facility: "asc" }]
        });
        expect(prisma.estimateCuttingRate.findMany).toHaveBeenCalledWith({
          orderBy: [
            { equipment: "asc" },
            { elevation: "asc" },
            { material: "asc" },
            { depthMm: "asc" }
          ]
        });
        expect(prisma.estimateFuelRate.findMany).toHaveBeenCalledWith({
          orderBy: { item: "asc" }
        });
        expect(prisma.estimateEnclosureRate.findMany).toHaveBeenCalledWith({
          where: { isActive: true },
          orderBy: { enclosureType: "asc" }
        });
      });
    });

    // ── PLANT_FUEL_COLUMN_V1 ────────────────────────────────────────────
    //
    // `ListedRate.value` carries one figure; plant is priced on two. The hire
    // rate is `value`; the running fuel cost is `fuelRate`, and the tendering
    // persona is told to report BOTH because "the hire rate alone understates
    // the all-in plant cost".
    //
    // Every fixture below states its fuel figure EXPLICITLY, and states one
    // DISTINCT from the row's rate wherever both are asserted. This is the
    // trap #1710 and #1715 each found in the RateTable-path test above: a
    // fixture that omits the field makes the resolver emit `undefined`, jest's
    // toEqual treats an undefined property as absent, and an exhaustive
    // assertion passes while proving nothing. `.not.toBeUndefined()` and
    // `toBeNull()` appear deliberately alongside toEqual for the same reason —
    // `toEqual({...})` would accept a silently missing `fuelRate`, these do not.
    describe("fuelRate", () => {
      test("legacy path: plant reports fuelRate, distinct from the hire rate", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimatePlantRate.findMany.mockResolvedValue([
          // fuelRate deliberately unequal to rate on every row, so a resolver
          // that returned the wrong column could not pass.
          { id: "p-exc", item: "Excavator 20t", rate: "800", unit: "day", category: "Excavator", fuelRate: "140", isActive: true, sortOrder: 17 },
          { id: "p-doz", item: "Dozer D6",      rate: "950", unit: "day", category: "Dozer",     fuelRate: "165", isActive: true, sortOrder: 3 }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");
        expect(out.map((r) => [r.value, r.fuelRate])).toEqual([
          [800, 140],
          [950, 165]
        ]);
        expect(out[0]!.fuelRate).not.toBeUndefined();
        // The figure is a named field, NOT smuggled into the info bag — info
        // is documented as metadata "not used for pricing", and a fuel rate is
        // a priced quantity (Marco, 2026-09-07: a second VALUE column).
        expect(out[0]!.info).toEqual({ Category: "Excavator", Unit: "day" });
      });

      test("legacy path: fuelRate 0 is reported as 0, never null — 0 is a real value", async () => {
        // EstimatePlantRate.fuelRate is `Decimal @default(0)` and NOT
        // nullable, and estimates.service.ts writes `dto.fuelRate ?? "0"`, so
        // an item entered with no fuel cost arrives here as 0. `null` on this
        // path is unreachable by construction; 0 means "no fuel cost", which
        // is a fact, not an absence.
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimatePlantRate.findMany.mockResolvedValue([
          { id: "p-att", item: "Attachment 16T-25T", rate: "281", unit: "day", category: "Other", fuelRate: "0", isActive: true, sortOrder: 10 }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");
        expect(out[0]!.fuelRate).toBe(0);
        expect(out[0]!.fuelRate).not.toBeNull();
      });

      test("RateTable path: the fuel cell is read from the VALUE column named \"Fuel rate\"", async () => {
        process.env.RATES_CANONICAL_SOURCE = "ratetable";
        const prisma = makePrisma();
        prisma.rateTable.findUnique.mockResolvedValue({
          id: "rt-plant",
          slug: "plant",
          columns: [
            { id: "c-item", name: "Item",      role: "KEY",   unit: null,  sortOrder: 1 },
            { id: "c-rate", name: "Rate",      role: "VALUE", unit: "day", sortOrder: 4 },
            { id: "c-fuel", name: "Fuel rate", role: "VALUE", unit: "day", sortOrder: 5 }
          ]
        });
        prisma.rateRow.findMany.mockResolvedValue([
          { id: "rr-exc", isActive: true, sortOrder: 7, cells: { "c-item": "Excavator 20t", "c-rate": 800, "c-fuel": 140 } },
          { id: "rr-att", isActive: true, sortOrder: 3, cells: { "c-item": "Attachment",    "c-rate": 281, "c-fuel": 0 } }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");
        expect(out.map((r) => [r.value, r.fuelRate])).toEqual([
          [800, 140],
          [281, 0]
        ]);
        // `value` still comes from valueCols[0]; the second VALUE column did
        // not displace it.
        expect(out[0]!.value).toBe(800);
        expect(out[0]!.unit).toBe("day");
        expect(out[1]!.fuelRate).not.toBeNull();
      });

      test("RateTable path: the column is found by NAME even when its id is a cuid", async () => {
        // The seed stamps `rt-plt-c-fuel` only in its create branch and upserts
        // on the unique (rate_table_id, name); a column created through the
        // admin UI carries a cuid under the same name, and the
        // 20260907120000_rates_plant_fuel_column migration writes its cells
        // under THAT id. Matching on the id would report null here.
        process.env.RATES_CANONICAL_SOURCE = "ratetable";
        const prisma = makePrisma();
        prisma.rateTable.findUnique.mockResolvedValue({
          id: "rt-plant",
          slug: "plant",
          columns: [
            { id: "c-item", name: "Item", role: "KEY", unit: null, sortOrder: 1 },
            { id: "c-rate", name: "Rate", role: "VALUE", unit: "day", sortOrder: 4 },
            { id: "clz8k2n1v0000abcdxyz9q1w2", name: "Fuel rate", role: "VALUE", unit: "day", sortOrder: 5 }
          ]
        });
        prisma.rateRow.findMany.mockResolvedValue([
          { id: "rr-exc", isActive: true, sortOrder: 1, cells: { "c-item": "Excavator 20t", "c-rate": 800, "clz8k2n1v0000abcdxyz9q1w2": 140 } }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");
        expect(out[0]!.fuelRate).toBe(140);
      });

      test("RateTable path: a cell keyed by column NAME is read too", async () => {
        // tryListRateTable's KEY/INFO readers tolerate `cells[col.id] ?? cells[col.name]`;
        // the fuel reader must not be stricter, or a name-keyed row silently
        // loses the figure. The migration deliberately skips such rows rather
        // than writing a second, competing key.
        process.env.RATES_CANONICAL_SOURCE = "ratetable";
        const prisma = makePrisma();
        prisma.rateTable.findUnique.mockResolvedValue({
          id: "rt-plant",
          slug: "plant",
          columns: [
            { id: "c-item", name: "Item", role: "KEY", unit: null, sortOrder: 1 },
            { id: "c-rate", name: "Rate", role: "VALUE", unit: "day", sortOrder: 4 },
            { id: "c-fuel", name: "Fuel rate", role: "VALUE", unit: "day", sortOrder: 5 }
          ]
        });
        prisma.rateRow.findMany.mockResolvedValue([
          { id: "rr-exc", isActive: true, sortOrder: 1, cells: { "c-item": "Excavator 20t", "c-rate": 800, "Fuel rate": 140 } }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");
        expect(out[0]!.fuelRate).toBe(140);
      });

      test("RateTable path: an ABSENT fuel cell reports null, not 0 and not NaN", async () => {
        // A row added through the admin UI after the migration and left blank.
        // 0 would fabricate a fuel cost of zero dollars — a claim, not an
        // absence; NaN would poison any `fuelRate ?? fallback` downstream.
        // Same reasoning as `sortOrder: null` for core-hole.
        process.env.RATES_CANONICAL_SOURCE = "ratetable";
        const prisma = makePrisma();
        prisma.rateTable.findUnique.mockResolvedValue({
          id: "rt-plant",
          slug: "plant",
          columns: [
            { id: "c-item", name: "Item", role: "KEY", unit: null, sortOrder: 1 },
            { id: "c-rate", name: "Rate", role: "VALUE", unit: "day", sortOrder: 4 },
            { id: "c-fuel", name: "Fuel rate", role: "VALUE", unit: "day", sortOrder: 5 }
          ]
        });
        prisma.rateRow.findMany.mockResolvedValue([
          { id: "rr-new",  isActive: true, sortOrder: 1, cells: { "c-item": "Uncosted item", "c-rate": 100 } },
          { id: "rr-null", isActive: true, sortOrder: 2, cells: { "c-item": "Explicit null", "c-rate": 200, "c-fuel": null } },
          { id: "rr-junk", isActive: true, sortOrder: 3, cells: { "c-item": "Junk cell",     "c-rate": 300, "c-fuel": "not a number" } }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("plant");
        expect(out.map((r) => r.fuelRate)).toEqual([null, null, null]);
        expect(out[0]!.fuelRate).toBeNull();
        expect(out[2]!.fuelRate).not.toBeNaN();
        // The hire rate is untouched by any of it.
        expect(out.map((r) => r.value)).toEqual([100, 200, 300]);
      });

      test("every non-plant kind reports fuelRate: null on the legacy path", async () => {
        delete process.env.RATES_CANONICAL_SOURCE;
        const prisma = makePrisma();
        prisma.estimateLabourRate.findMany.mockResolvedValue([
          { id: "lab-1", role: "Foreman", dayRate: "450", nightRate: "520", weekendRate: "600", isActive: true, sortOrder: 12 }
        ]);
        prisma.estimateWasteRate.findMany.mockResolvedValue([
          { id: "w-1", wasteType: "Concrete", facility: "BMI", wasteGroup: "Inert", unit: "tonne", tonRate: "45", loadRate: "0", isActive: true, sortOrder: 9 }
        ]);
        prisma.estimateCuttingRate.findMany.mockResolvedValue([
          { id: "c-1", equipment: "Ring saw", elevation: "Floor", material: "Concrete", depthMm: 100, ratePerM: "120", isActive: true, sortOrder: 14 }
        ]);
        prisma.estimateCoreHoleRate.findMany.mockResolvedValue([
          { id: "h-1", diameterMm: 52, ratePerHole: "60", isActive: true }
        ]);
        prisma.estimateFuelRate.findMany.mockResolvedValue([
          { id: "f-1", item: "Diesel", rate: "2.1", unit: "L", isActive: true, sortOrder: 2 }
        ]);
        prisma.estimateEnclosureRate.findMany.mockResolvedValue([
          { id: "e-1", enclosureType: "Standard", rate: "300", unit: "each", isActive: true, sortOrder: 33 }
        ]);
        prisma.cuttingOtherRate.findMany.mockResolvedValue([
          { id: "o-1", description: "Setup", rate: "150", unit: "each", isActive: true, sortOrder: 5 }
        ]);
        const svc = new RateResolverService(prisma as never);
        // The `fuel` SLUG is diesel-by-the-litre, nothing to do with a plant
        // item's fuel rate; it reports null like every other non-plant kind.
        for (const slug of ["labour", "waste", "cutting", "core-hole", "fuel", "enclosure", "other-rates"]) {
          const out = await svc.listRates(slug);
          expect(out.length).toBeGreaterThan(0);
          expect(out.map((r) => r.fuelRate)).toEqual(out.map(() => null));
          // toEqual would accept `undefined` for a missing property; this will not.
          for (const r of out) expect(r.fuelRate).toBeNull();
        }
        // The labour fan-out emits three entries from one row; all three carry it.
        expect((await svc.listRates("labour")).map((r) => r.fuelRate)).toEqual([null, null, null]);
      });

      test("RateTable path: a table with no \"Fuel rate\" column reports null and keeps its own VALUE column", async () => {
        process.env.RATES_CANONICAL_SOURCE = "ratetable";
        const prisma = makePrisma();
        prisma.rateTable.findUnique.mockResolvedValue({
          id: "rt-fuel",
          slug: "fuel",
          columns: [
            { id: "c-item", name: "Item", role: "KEY",   unit: null, sortOrder: 1 },
            { id: "c-rate", name: "Rate", role: "VALUE", unit: "L",  sortOrder: 2 }
          ]
        });
        prisma.rateRow.findMany.mockResolvedValue([
          { id: "rr-diesel", isActive: true, sortOrder: 1, cells: { "c-item": "Diesel", "c-rate": 2.1 } }
        ]);
        const svc = new RateResolverService(prisma as never);
        const out: ListedRate[] = await svc.listRates("fuel");
        expect(out[0]!.fuelRate).toBeNull();
        expect(out[0]!.value).toBe(2.1);
        expect(out[0]!.unit).toBe("L");
      });

      test("the row set and its order are UNCHANGED on both paths", async () => {
        // The invariant #1710 and #1715 each carried: not one `where` or
        // `orderBy` may be added, removed or altered by this slice.
        delete process.env.RATES_CANONICAL_SOURCE;
        const legacyPrisma = makePrisma();
        legacyPrisma.estimatePlantRate.findMany.mockResolvedValue([
          { id: "p-a", item: "Air compressor", rate: "300", unit: "day", category: "Access",      fuelRate: "35",  isActive: true,  sortOrder: 40 },
          { id: "p-b", item: "Bobcat",         rate: "500", unit: "day", category: "Earthmoving", fuelRate: "0",   isActive: false, sortOrder: 5 },
          { id: "p-c", item: "Excavator 20t",  rate: "800", unit: "day", category: "Earthmoving", fuelRate: "140", isActive: true,  sortOrder: 17 }
        ]);
        const legacySvc = new RateResolverService(legacyPrisma as never);
        const legacyOut = await legacySvc.listRates("plant");
        // Same rows, same order, INCLUDING the inactive one — still no filter.
        expect(legacyOut.map((r) => r.rowId)).toEqual(["p-a", "p-b", "p-c"]);
        expect(legacyOut.map((r) => r.isActive)).toEqual([true, false, true]);
        expect(legacyOut.map((r) => r.fuelRate)).toEqual([35, 0, 140]);
        expect(legacyPrisma.estimatePlantRate.findMany).toHaveBeenCalledWith({
          orderBy: { item: "asc" }
        });
        expect(legacyPrisma.estimatePlantRate.findMany).toHaveBeenCalledTimes(1);

        process.env.RATES_CANONICAL_SOURCE = "ratetable";
        const rtPrisma = makePrisma();
        rtPrisma.rateTable.findUnique.mockResolvedValue({
          id: "rt-plant",
          slug: "plant",
          columns: [
            { id: "c-item", name: "Item", role: "KEY", unit: null, sortOrder: 1 },
            { id: "c-rate", name: "Rate", role: "VALUE", unit: "day", sortOrder: 4 },
            { id: "c-fuel", name: "Fuel rate", role: "VALUE", unit: "day", sortOrder: 5 }
          ]
        });
        rtPrisma.rateRow.findMany.mockResolvedValue([
          { id: "rr-a", isActive: true, sortOrder: 30, cells: { "c-item": "Excavator 20t", "c-rate": 800, "c-fuel": 140 } },
          { id: "rr-b", isActive: true, sortOrder: 10, cells: { "c-item": "Dozer D6",      "c-rate": 950, "c-fuel": 165 } }
        ]);
        const rtSvc = new RateResolverService(rtPrisma as never);
        const rtOut = await rtSvc.listRates("plant");
        expect(rtOut.map((r) => r.rowId)).toEqual(["rr-a", "rr-b"]);
        expect(rtOut.map((r) => r.fuelRate)).toEqual([140, 165]);
        expect(rtPrisma.rateRow.findMany).toHaveBeenCalledWith({
          where: { rateTableId: "rt-plant", isActive: true },
          orderBy: { sortOrder: "asc" }
        });
        expect(rtPrisma.rateTable.findUnique).toHaveBeenCalledWith({
          where: { slug: "plant" },
          include: { columns: { orderBy: { sortOrder: "asc" } } }
        });
      });
    });
  });
});
