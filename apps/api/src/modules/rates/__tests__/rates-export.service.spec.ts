/**
 * rates-export.service.spec.ts
 *
 * Asserts the exported workbook sheet shape is unchanged after routing
 * estimatePlantRate through RateResolverService.listRates("plant")
 * (rates-consumers SLICE 3). Golden-row assertions on each tab verify
 * headers, column order, and numeric formatting are byte-identical to
 * the pre-SLICE-3 direct-prisma path.
 */

import { Prisma } from "@prisma/client";
import { RatesExportService } from "../rates-export.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { RateResolverService, ListedRate } from "../rate-resolver.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dec(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

/** Minimal waste row matching the Prisma model shape the export reads. */
function makeWasteRow(overrides: Partial<{
  id: string;
  facility: string;
  wasteType: string;
  wasteGroup: string | null;
  unit: string;
  tonRate: Prisma.Decimal;
  loadRate: Prisma.Decimal;
}> = {}) {
  return {
    id: overrides.id ?? "w-1",
    facility: overrides.facility ?? "Cleanaway Willawong",
    wasteType: overrides.wasteType ?? "General waste",
    wasteGroup: overrides.wasteGroup ?? "GENERAL",
    unit: overrides.unit ?? "tonne",
    tonRate: overrides.tonRate ?? dec(180),
    loadRate: overrides.loadRate ?? dec(0)
  };
}

/** Minimal density row matching the Prisma model shape the export reads. */
function makeDensityRow(overrides: Partial<{
  id: string;
  materialName: string;
  category: string | null;
  kind: string;
  unit: string;
  density: Prisma.Decimal;
}> = {}) {
  return {
    id: overrides.id ?? "d-1",
    materialName: overrides.materialName ?? "Concrete",
    category: overrides.category ?? "Concrete",
    kind: overrides.kind ?? "VOLUME",
    unit: overrides.unit ?? "kg/m³",
    density: overrides.density ?? dec(2400),
    isActive: true
  };
}

/** Build a ListedRate entry as returned by listRates("plant"). */
function makePlantListedRate(overrides: Partial<{
  rowId: string;
  item: string;
  category: string;
  unit: string;
  rate: number;
}> = {}): ListedRate {
  return {
    rowId: overrides.rowId ?? "plt-1",
    keys: { item: overrides.item ?? "5T excavator" },
    info: { Category: overrides.category ?? "Excavator", Unit: overrides.unit ?? "day" },
    value: overrides.rate ?? 750,
    unit: overrides.unit ?? "day",
    source: "legacy"
  };
}

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function buildPrismaMock(opts: {
  wasteRows?: ReturnType<typeof makeWasteRow>[];
  densityRows?: ReturnType<typeof makeDensityRow>[];
}) {
  return {
    estimateWasteRate: {
      findMany: jest.fn().mockResolvedValue(opts.wasteRows ?? [])
    },
    estimateMaterialDensity: {
      findMany: jest.fn().mockResolvedValue(opts.densityRows ?? [])
    }
  } as unknown as PrismaService;
}

function buildResolverMock(plantRows: ListedRate[]) {
  return {
    listRates: jest.fn().mockResolvedValue(plantRows)
  } as unknown as RateResolverService;
}

// ---------------------------------------------------------------------------
// ExcelJS workbook reader (parses buffer back to rows for assertion)
// ---------------------------------------------------------------------------

/**
 * Import ExcelJS lazily inside the helper so the import is only used in
 * these tests, matching the production service import style.
 */
async function readSheet(
  buffer: Buffer,
  sheetName: string
): Promise<{ header: string[]; rows: unknown[][] }> {
  const ExcelJS = require("exceljs") as typeof import("exceljs");
  const wb = new ExcelJS.Workbook();
  // Node 24 Buffer<ArrayBufferLike> is not directly assignable to ExcelJS's
  // Buffer. Wrap in Buffer.from to satisfy the type check at test time only.
  await wb.xlsx.load(Buffer.from(buffer) as never);
  const sheet = wb.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const all: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: unknown[] = [];
    (row.values as unknown[]).forEach((v, i) => {
      // ExcelJS row.values is 1-indexed with a leading undefined at [0]
      if (i > 0) values.push(v);
    });
    all.push(values);
  });
  const [headerRow, ...dataRows] = all;
  return { header: (headerRow ?? []) as string[], rows: dataRows };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RatesExportService.buildWorkbook", () => {
  describe("Plant Rates sheet — routed through listRates(\"plant\")", () => {
    it("emits one row per non-transport plant rate with correct column order", async () => {
      const plantRow = makePlantListedRate({
        rowId: "plt-excavator",
        item: "5T excavator",
        category: "Excavator",
        rate: 750,
        unit: "day"
      });
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock([plantRow]);
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const sheet = await readSheet(buffer, "Plant Rates");

      // Headers (column 1 = _key, hidden but present in the buffer)
      expect(sheet.header).toEqual(["_key", "Type", "Comments", "Daily rate ($)"]);
      // One data row
      expect(sheet.rows).toHaveLength(1);
      const [id, type, comments, rate] = sheet.rows[0]!;
      expect(id).toBe("plt-excavator");
      expect(type).toBe("5T excavator");
      expect(comments).toBe("Excavator");
      expect(rate).toBe(750);
    });

    it("routes transport rows (category=Truck OR unit=each way) to Transport Fees sheet", async () => {
      const truckRow = makePlantListedRate({
        rowId: "plt-truck",
        item: "10T truck",
        category: "Truck",
        rate: 1200,
        unit: "each way"
      });
      const excavatorRow = makePlantListedRate({
        rowId: "plt-exc",
        item: "13T excavator",
        category: "Excavator",
        rate: 950,
        unit: "day"
      });
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock([truckRow, excavatorRow]);
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const plantSheet = await readSheet(buffer, "Plant Rates");
      const transportSheet = await readSheet(buffer, "Transport Fees");

      // Plant Rates has only the excavator
      expect(plantSheet.rows).toHaveLength(1);
      expect(plantSheet.rows[0]![1]).toBe("13T excavator");

      // Transport Fees has only the truck
      expect(transportSheet.rows).toHaveLength(1);
      expect(transportSheet.rows[0]![1]).toBe("10T truck");
      expect(transportSheet.header).toEqual(["_key", "Type", "Comments", "Rate ($)"]);
    });

    it("re-sorts plant rows by [category asc, item asc] — matching pre-SLICE-3 order", async () => {
      // These come from listRates already item-sorted; after re-sort they
      // should be ordered by category first, then item within category.
      // Items are sorted case-insensitively. Digits sort before letters so
      // "5T excavator" < "Bobcat" within "Earthmoving".
      const rows: ListedRate[] = [
        makePlantListedRate({ rowId: "p1", item: "Bobcat",        category: "Earthmoving", rate: 500, unit: "day" }),
        makePlantListedRate({ rowId: "p2", item: "5T excavator",  category: "Earthmoving", rate: 750, unit: "day" }),
        makePlantListedRate({ rowId: "p3", item: "Scissor lift",  category: "Access",      rate: 350, unit: "day" })
      ];
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock(rows);
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const sheet = await readSheet(buffer, "Plant Rates");

      // Access ("a") before Earthmoving ("e"), then within Earthmoving:
      // "5t excavator" < "bobcat" (digit < letter in ASCII/toLowerCase order)
      const itemOrder = sheet.rows.map((r) => r[1]);
      expect(itemOrder).toEqual(["Scissor lift", "5T excavator", "Bobcat"]);
    });

    it("calls listRates with slug 'plant'", async () => {
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock([]);
      const svc = new RatesExportService(prisma, resolver);
      await svc.buildWorkbook();
      expect(resolver.listRates).toHaveBeenCalledWith("plant");
    });

    it("does NOT call prisma.estimatePlantRate for the plant export", async () => {
      const prisma = buildPrismaMock({});
      // Attach a spy so we can assert it was never called
      const plantSpy = jest.fn();
      (prisma as unknown as { estimatePlantRate?: { findMany: jest.Mock } }).estimatePlantRate = {
        findMany: plantSpy
      };
      const resolver = buildResolverMock([]);
      const svc = new RatesExportService(prisma, resolver);
      await svc.buildWorkbook();
      expect(plantSpy).not.toHaveBeenCalled();
    });
  });

  describe("Waste Disposal Fees sheet — direct prisma (wasteGroup + loadRate required)", () => {
    it("emits correct headers and golden row", async () => {
      const wasteRow = makeWasteRow({
        id: "w-uuid",
        facility: "BMI Swanbank",
        wasteType: "Concrete",
        wasteGroup: "Inert",
        unit: "tonne",
        tonRate: dec(45),
        loadRate: dec(120)
      });
      const prisma = buildPrismaMock({ wasteRows: [wasteRow] });
      const resolver = buildResolverMock([]);
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const sheet = await readSheet(buffer, "Waste Disposal Fees");

      expect(sheet.header).toEqual(["_key", "Facility", "Waste type", "Group", "Charged as (unit)", "Rate ($)", "Load rate ($)"]);
      expect(sheet.rows).toHaveLength(1);
      const [id, facility, wasteType, group, unit, rate, loadRate] = sheet.rows[0]!;
      expect(id).toBe("w-uuid");
      expect(facility).toBe("BMI Swanbank");
      expect(wasteType).toBe("Concrete");
      expect(group).toBe("Inert");
      expect(unit).toBe("tonne");
      expect(rate).toBe(45);
      expect(loadRate).toBe(120);
    });
  });

  describe("Material Density sheet — direct prisma (sort order preserved)", () => {
    it("emits correct headers and converts kg/m³ density to T weight", async () => {
      const densityRow = makeDensityRow({
        id: "d-uuid",
        materialName: "Concrete",
        category: "Concrete",
        kind: "VOLUME",
        unit: "kg/m³",
        density: dec(2400)
      });
      const prisma = buildPrismaMock({ densityRows: [densityRow] });
      const resolver = buildResolverMock([]);
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const sheet = await readSheet(buffer, "Material Density");

      expect(sheet.header).toEqual(["_key", "Material", "Category", "Kind", "Density type", "Weight", "Weight unit"]);
      expect(sheet.rows).toHaveLength(1);
      const [id, material, category, kind, densityType, weight, weightUnit] = sheet.rows[0]!;
      expect(id).toBe("d-uuid");
      expect(material).toBe("Concrete");
      expect(category).toBe("Concrete");
      expect(kind).toBe("VOLUME");
      expect(densityType).toBe("kg/m³");
      // 2400 kg/m³ → 2.4 T
      expect(weight).toBe(2.4);
      expect(weightUnit).toBe("T");
    });
  });

  describe("filename", () => {
    it("returns a filename with today's date in YYYY-MM-DD format", async () => {
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock([]);
      const svc = new RatesExportService(prisma, resolver);
      const { filename } = await svc.buildWorkbook();
      expect(filename).toMatch(/^rates-lists-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
  });
});
