import { NotFoundException } from "@nestjs/common";
import { RatesImportService, type ImportOperation } from "../rates-import.service";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLANT_TABLE = {
  id: "rt-plt",
  slug: "plant",
  columns: [
    { id: "rt-plt-c-item", name: "Item", role: "KEY", sortOrder: 1 },
    { id: "rt-plt-c-category", name: "Category", role: "INFO", sortOrder: 2 },
    { id: "rt-plt-c-unit", name: "Unit", role: "INFO", sortOrder: 3 },
    { id: "rt-plt-c-rate", name: "Rate", role: "VALUE", sortOrder: 4 }
  ]
};

const WASTE_TONNE_TABLE = {
  id: "rt-wst-t",
  slug: "waste-per-tonne",
  columns: [
    { id: "rt-wst-t-c-facility", name: "Facility", role: "KEY", sortOrder: 1 },
    { id: "rt-wst-t-c-type", name: "Waste type", role: "KEY", sortOrder: 2 },
    { id: "rt-wst-t-c-group", name: "Group", role: "INFO", sortOrder: 3 },
    { id: "rt-wst-t-c-ton", name: "Rate per tonne", role: "VALUE", sortOrder: 4 },
    { id: "rt-wst-t-c-load", name: "Rate per load", role: "VALUE", sortOrder: 5 }
  ]
};

const DENSITY_TABLE_STUB = {
  id: "md-1",
  materialName: "Concrete",
  category: null,
  kind: "VOLUME",
  unit: "kg/m3",
  density: { toString: () => "2400" }
};

// ── Mock factories ─────────────────────────────────────────────────────────────

function makePrisma() {
  return {
    rateTable: { findUnique: jest.fn().mockResolvedValue(null) },
    rateRow: { findMany: jest.fn().mockResolvedValue([]) },
    estimateWasteRate: { findMany: jest.fn().mockResolvedValue([]) },
    estimateMaterialDensity: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({})
    },
    estimatePlantRate: { findMany: jest.fn().mockResolvedValue([]) }
  };
}

function makeRateTables() {
  return {
    createRow: jest.fn().mockResolvedValue({ id: "new-row-id" }),
    updateRow: jest.fn().mockResolvedValue({ id: "existing-row-id" })
  };
}

function buildService(
  prismaOverrides: Partial<ReturnType<typeof makePrisma>> = {},
  rateTablesOverrides: Partial<ReturnType<typeof makeRateTables>> = {}
) {
  const prisma = { ...makePrisma(), ...prismaOverrides };
  const rateTables = { ...makeRateTables(), ...rateTablesOverrides };
  const svc = new RatesImportService(prisma as never, rateTables as never);
  return { svc, prisma, rateTables };
}

// ── apply: plant surface — UPDATE existing row ─────────────────────────────────

describe("RatesImportService.apply — plant surface", () => {
  test("UPDATE: calls rateTables.updateRow when a matching row already exists", async () => {
    const existingRowId = "rr-plt-existing";
    const existingCells = {
      "rt-plt-c-item": "Excavator 20t",
      "rt-plt-c-category": "Plant",
      "rt-plt-c-unit": "day",
      "rt-plt-c-rate": 800
    };

    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockImplementation(({ where }: { where: { slug: string } }) => {
      if (where.slug === "plant") return Promise.resolve(PLANT_TABLE);
      return Promise.resolve(null);
    });
    prisma.rateRow.findMany.mockResolvedValue([{ id: existingRowId, cells: existingCells }]);

    const { svc, rateTables } = buildService(prisma);

    const op: ImportOperation = {
      surface: "plant",
      op: "update",
      id: "legacy-id-irrelevant",
      naturalKey: "excavator 20t",
      values: { item: "Excavator 20t", category: "Plant", unit: "day", rate: 950 }
    };
    await svc.apply([op]);

    expect(rateTables.createRow).not.toHaveBeenCalled();
    expect(rateTables.updateRow).toHaveBeenCalledTimes(1);
    expect(rateTables.updateRow).toHaveBeenCalledWith(
      "system-import",
      "rt-plt",
      existingRowId,
      expect.objectContaining({
        cells: expect.objectContaining({
          "rt-plt-c-item": "Excavator 20t",
          "rt-plt-c-rate": 950
        })
      })
    );
  });

  // ADD: no existing row -> createRow
  test("ADD: calls rateTables.createRow when no matching row exists", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockImplementation(({ where }: { where: { slug: string } }) => {
      if (where.slug === "plant") return Promise.resolve(PLANT_TABLE);
      return Promise.resolve(null);
    });
    prisma.rateRow.findMany.mockResolvedValue([]); // no existing rows

    const { svc, rateTables } = buildService(prisma);

    const op: ImportOperation = {
      surface: "plant",
      op: "add",
      naturalKey: "roller 8t",
      values: { item: "Roller 8t", category: "Compaction", unit: "day", rate: 600 }
    };
    await svc.apply([op]);

    expect(rateTables.updateRow).not.toHaveBeenCalled();
    expect(rateTables.createRow).toHaveBeenCalledTimes(1);
    expect(rateTables.createRow).toHaveBeenCalledWith(
      "system-import",
      "rt-plt",
      expect.objectContaining({
        cells: expect.objectContaining({
          "rt-plt-c-item": "Roller 8t",
          "rt-plt-c-rate": 600
        })
      })
    );
  });

  // ADD idempotency: existing row found by natural key -> updateRow (not createRow)
  test("ADD idempotency: finds existing row by natural key and calls updateRow", async () => {
    const existingRowId = "rr-plt-roller";
    const existingCells = {
      "rt-plt-c-item": "Roller 8t",
      "rt-plt-c-category": "Compaction",
      "rt-plt-c-unit": "day",
      "rt-plt-c-rate": 550
    };

    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockImplementation(({ where }: { where: { slug: string } }) => {
      if (where.slug === "plant") return Promise.resolve(PLANT_TABLE);
      return Promise.resolve(null);
    });
    prisma.rateRow.findMany.mockResolvedValue([{ id: existingRowId, cells: existingCells }]);

    const { svc, rateTables } = buildService(prisma);

    const op: ImportOperation = {
      surface: "plant",
      op: "add", // 'add' but row already exists — idempotency case
      naturalKey: "roller 8t",
      values: { item: "Roller 8t", category: "Compaction", unit: "day", rate: 600 }
    };
    await svc.apply([op]);

    // Should update the existing row, not create a duplicate
    expect(rateTables.createRow).not.toHaveBeenCalled();
    expect(rateTables.updateRow).toHaveBeenCalledWith(
      "system-import",
      "rt-plt",
      existingRowId,
      expect.objectContaining({
        cells: expect.objectContaining({ "rt-plt-c-item": "Roller 8t", "rt-plt-c-rate": 600 })
      })
    );
  });

  // Throws NotFoundException when the RateTable slug is not in the DB
  test("throws NotFoundException when the plant RateTable does not exist", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockResolvedValue(null); // table missing

    const { svc } = buildService(prisma);

    const op: ImportOperation = {
      surface: "plant",
      op: "add",
      naturalKey: "missing item",
      values: { item: "Missing item", category: null, unit: "day", rate: 100 }
    };
    await expect(svc.apply([op])).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── apply: waste surface (tonne) ──────────────────────────────────────────────

describe("RatesImportService.apply — waste surface (tonne)", () => {
  test("UPDATE: routes to waste-per-tonne and calls updateRow on match", async () => {
    const existingRowId = "rr-wst-t-1";
    const existingCells = {
      "rt-wst-t-c-facility": "BMI Acacia Ridge",
      "rt-wst-t-c-type": "Concrete — clean",
      "rt-wst-t-c-group": "Rubble",
      "rt-wst-t-c-ton": 18,
      "rt-wst-t-c-load": 0
    };

    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockImplementation(({ where }: { where: { slug: string } }) => {
      if (where.slug === "waste-per-tonne") return Promise.resolve(WASTE_TONNE_TABLE);
      return Promise.resolve(null);
    });
    prisma.rateRow.findMany.mockResolvedValue([{ id: existingRowId, cells: existingCells }]);

    const { svc, rateTables } = buildService(prisma);

    const op: ImportOperation = {
      surface: "waste",
      op: "update",
      id: "legacy-id",
      naturalKey: "bmi acacia ridge||concrete — clean",
      values: {
        facility: "BMI Acacia Ridge",
        wasteType: "Concrete — clean",
        wasteGroup: "Rubble",
        unit: "tonne",
        tonRate: 22,
        loadRate: 400
      }
    };
    await svc.apply([op]);

    expect(rateTables.createRow).not.toHaveBeenCalled();
    expect(rateTables.updateRow).toHaveBeenCalledWith(
      "system-import",
      "rt-wst-t",
      existingRowId,
      expect.objectContaining({
        cells: expect.objectContaining({
          "rt-wst-t-c-facility": "BMI Acacia Ridge",
          "rt-wst-t-c-type": "Concrete — clean",
          "rt-wst-t-c-ton": 22,
          "rt-wst-t-c-load": 400
        })
      })
    );
  });

  test("ADD: calls createRow when no matching waste-per-tonne row exists", async () => {
    const prisma = makePrisma();
    prisma.rateTable.findUnique.mockImplementation(({ where }: { where: { slug: string } }) => {
      if (where.slug === "waste-per-tonne") return Promise.resolve(WASTE_TONNE_TABLE);
      return Promise.resolve(null);
    });
    prisma.rateRow.findMany.mockResolvedValue([]);

    const { svc, rateTables } = buildService(prisma);

    const op: ImportOperation = {
      surface: "waste",
      op: "add",
      naturalKey: "new facility||new type",
      values: {
        facility: "New Facility",
        wasteType: "New type",
        wasteGroup: "General waste",
        unit: "tonne",
        tonRate: 150,
        loadRate: 0
      }
    };
    await svc.apply([op]);

    expect(rateTables.updateRow).not.toHaveBeenCalled();
    expect(rateTables.createRow).toHaveBeenCalledWith(
      "system-import",
      "rt-wst-t",
      expect.objectContaining({
        cells: expect.objectContaining({
          "rt-wst-t-c-facility": "New Facility",
          "rt-wst-t-c-type": "New type",
          "rt-wst-t-c-ton": 150
        })
      })
    );
  });
});

// ── apply: density surface — untouched ────────────────────────────────────────

describe("RatesImportService.apply — density surface untouched", () => {
  test("density UPDATE still calls prisma.estimateMaterialDensity.update (not RateTablesService)", async () => {
    const prisma = makePrisma();
    const { svc, rateTables } = buildService(prisma);

    const op: ImportOperation = {
      surface: "density",
      op: "update",
      id: "density-row-id",
      naturalKey: "concrete",
      values: {
        materialName: "Concrete",
        category: null,
        kind: "VOLUME",
        unit: "kg/m3",
        density: 2400
      }
    };
    await svc.apply([op]);

    // RateTablesService must not be involved
    expect(rateTables.createRow).not.toHaveBeenCalled();
    expect(rateTables.updateRow).not.toHaveBeenCalled();
    // Prisma legacy path must be used
    expect(prisma.estimateMaterialDensity.update).toHaveBeenCalledTimes(1);
    expect(prisma.estimateMaterialDensity.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "density-row-id" } })
    );
  });

  test("density ADD still calls prisma.estimateMaterialDensity.upsert (not RateTablesService)", async () => {
    const prisma = makePrisma();
    const { svc, rateTables } = buildService(prisma);

    const op: ImportOperation = {
      surface: "density",
      op: "add",
      naturalKey: "new material",
      values: {
        materialName: "New material",
        category: "Aggregate",
        kind: "VOLUME",
        unit: "kg/m3",
        density: 1800
      }
    };
    await svc.apply([op]);

    expect(rateTables.createRow).not.toHaveBeenCalled();
    expect(rateTables.updateRow).not.toHaveBeenCalled();
    expect(prisma.estimateMaterialDensity.upsert).toHaveBeenCalledTimes(1);
  });
});
