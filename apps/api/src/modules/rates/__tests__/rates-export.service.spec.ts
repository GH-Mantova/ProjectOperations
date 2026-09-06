/**
 * rates-export.service.spec.ts
 *
 * Asserts the exported workbook sheet shape is unchanged after routing
 * estimatePlantRate and estimateWasteRate through RateResolverService
 * (rates-consumers SLICE 3a). Golden-row assertions on each tab verify
 * headers, column order, and numeric formatting are byte-identical to
 * the pre-SLICE-3a direct-prisma path.
 *
 * Change 4 (SLICE 3a): adversarial fixture covering mixed case, leading-digit
 * items, punctuation, null/blank category, and two rows differing only by
 * case. The spec pins exact emitted row order for Plant Rates, Transport Fees,
 * and Waste Disposal Fees sheets.
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
  isActive: boolean;
  sortOrder: number | null;
}> = {}): ListedRate {
  return {
    rowId: overrides.rowId ?? "plt-1",
    keys: { item: overrides.item ?? "5T excavator" },
    info: { Category: overrides.category ?? "Excavator", Unit: overrides.unit ?? "day" },
    value: overrides.rate ?? 750,
    unit: overrides.unit ?? "day",
    // listRates("plant") does NOT filter on isActive — the legacy plant
    // adapter has no `where`. Default true here because these fixtures
    // exercise the export's grouping, not the activity flag.
    isActive: overrides.isActive ?? true,
    // The export sheets order themselves (by category, then item); they never
    // read sortOrder. Defaulted to 0 here only so the fixture satisfies the
    // ListedRate type — pass an override if a test ever asserts on it.
    sortOrder: overrides.sortOrder !== undefined ? overrides.sortOrder : 0,
    source: "legacy"
  };
}

/** Build a ListedRate entry as returned by listRates("waste"). */
function makeWasteListedRate(overrides: Partial<{
  rowId: string;
  wasteType: string;
  facility: string;
  wasteGroup: string | null;
  unit: string;
  tonRate: number;
  loadRate: number;
  isActive: boolean;
  sortOrder: number | null;
}> = {}): ListedRate {
  return {
    rowId: overrides.rowId ?? "w-1",
    keys: {
      wasteType: overrides.wasteType ?? "General waste",
      facility: overrides.facility ?? "Cleanaway Willawong"
    },
    info: {
      wasteGroup: overrides.wasteGroup !== undefined ? overrides.wasteGroup : "GENERAL",
      loadRate: overrides.loadRate ?? 0
    },
    value: overrides.tonRate ?? 180,
    unit: overrides.unit ?? "tonne",
    // As above: listRates("waste") returns inactive rows too. Default true.
    isActive: overrides.isActive ?? true,
    // As above: the waste sheet does its own ordering and never reads
    // sortOrder. Defaulted to 0 only to satisfy the ListedRate type.
    sortOrder: overrides.sortOrder !== undefined ? overrides.sortOrder : 0,
    source: "legacy"
  };
}

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function buildPrismaMock(opts: {
  densityRows?: ReturnType<typeof makeDensityRow>[];
}) {
  return {
    estimateMaterialDensity: {
      findMany: jest.fn().mockResolvedValue(opts.densityRows ?? [])
    }
  } as unknown as PrismaService;
}

function buildResolverMock(opts: {
  plantRows?: ListedRate[];
  wasteRows?: ListedRate[];
}) {
  return {
    listRates: jest.fn().mockImplementation((slug: string) => {
      if (slug === "plant") return Promise.resolve(opts.plantRows ?? []);
      if (slug === "waste") return Promise.resolve(opts.wasteRows ?? []);
      return Promise.resolve([]);
    })
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
      const resolver = buildResolverMock({ plantRows: [plantRow] });
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
      const resolver = buildResolverMock({ plantRows: [truckRow, excavatorRow] });
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

    it("re-sorts plant rows by [category asc, item asc] — matching pre-SLICE-3a DB order", async () => {
      // These come from listRates already item-sorted; after re-sort they
      // should be ordered by category first, then item within category.
      // Uses pgAscCompare (raw string) — consistent with Postgres POSIX collation.
      const rows: ListedRate[] = [
        makePlantListedRate({ rowId: "p1", item: "Bobcat",        category: "Earthmoving", rate: 500, unit: "day" }),
        makePlantListedRate({ rowId: "p2", item: "5T excavator",  category: "Earthmoving", rate: 750, unit: "day" }),
        makePlantListedRate({ rowId: "p3", item: "Scissor lift",  category: "Access",      rate: 350, unit: "day" })
      ];
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({ plantRows: rows });
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const sheet = await readSheet(buffer, "Plant Rates");

      // "Access" < "Earthmoving"; within Earthmoving: "5T excavator" < "Bobcat"
      // (digit "5" < "B" in ASCII/Postgres POSIX collation, raw compare).
      const itemOrder = sheet.rows.map((r) => r[1]);
      expect(itemOrder).toEqual(["Scissor lift", "5T excavator", "Bobcat"]);
    });

    it("calls listRates with slug 'plant'", async () => {
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({ plantRows: [] });
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
      const resolver = buildResolverMock({ plantRows: [] });
      const svc = new RatesExportService(prisma, resolver);
      await svc.buildWorkbook();
      expect(plantSpy).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // ADVERSARIAL FIXTURE (Change 4 — SLICE 3a): mixed case, leading digits,
    // punctuation, null/blank category, two rows differing only by case.
    // -----------------------------------------------------------------------
    it("adversarial: pins exact row order for Plant Rates with edge-case inputs", async () => {
      // Input comes from listRates in arbitrary order; export must re-sort by
      // [category asc, item asc] using pgAscCompare (raw string, not lower).
      //
      // Categories (raw string order):
      //   "" (blank) < "Access" < "Earthmoving" < "access" (lower 'a' > upper 'A')
      //
      // NOTE: "access" (lowercase) sorts AFTER "Access" (uppercase) in raw ASCII
      // because lowercase letters have higher code points than uppercase.
      // Blank ("") sorts before all non-empty strings.
      //
      // Within "Earthmoving":
      //   "10T truck-like item" < "5T excavator" < "bobcat-Z" < "bobcat-z"
      //   (digits < letters; within letters: 'b' < 'b' same, '-' < anything alpha,
      //    'Z' < 'z' in ASCII raw compare).
      const rows: ListedRate[] = [
        // Two rows differing only by case in item name (same category "Earthmoving")
        makePlantListedRate({ rowId: "p-bobz",   item: "bobcat-z",             category: "Earthmoving", rate: 800, unit: "day" }),
        makePlantListedRate({ rowId: "p-bobZ",   item: "bobcat-Z",             category: "Earthmoving", rate: 790, unit: "day" }),
        // Leading-digit items
        makePlantListedRate({ rowId: "p-10t",    item: "10T truck-like item",  category: "Earthmoving", rate: 600, unit: "day" }),
        makePlantListedRate({ rowId: "p-5t",     item: "5T excavator",         category: "Earthmoving", rate: 750, unit: "day" }),
        // null category (carried through as "" in PlantRateExportRow)
        makePlantListedRate({ rowId: "p-null",   item: "Null-cat item",        category: "",            rate: 400, unit: "day" }),
        // Punctuation in item name
        makePlantListedRate({ rowId: "p-gen",    item: "Generator (6.5kVA)",   category: "Access",      rate: 350, unit: "day" }),
        // lowercase category — sorts after uppercase in raw compare
        makePlantListedRate({ rowId: "p-lower",  item: "air compressor",       category: "access",      rate: 300, unit: "day" })
      ];

      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({ plantRows: rows });
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const sheet = await readSheet(buffer, "Plant Rates");

      // Expected order (pgAscCompare = raw string, no toLowerCase):
      //   category "" (blank):      "Null-cat item"
      //   category "Access":        "Generator (6.5kVA)"
      //   category "Earthmoving":   "10T truck-like item", "5T excavator", "bobcat-Z", "bobcat-z"
      //   category "access":        "air compressor"
      //
      // Rationale for Earthmoving item order:
      //   "1" (0x31) < "5" (0x35) < "b" (0x62)
      //   "bobcat-Z" vs "bobcat-z": "-Z" ends with 'Z' (0x5A) < 'z' (0x7A)
      const expectedItems = [
        "Null-cat item",
        "Generator (6.5kVA)",
        "10T truck-like item",
        "5T excavator",
        "bobcat-Z",
        "bobcat-z",
        "air compressor"
      ];
      const itemOrder = sheet.rows.map((r) => r[1]);
      expect(itemOrder).toEqual(expectedItems);

      // Golden row for the null-category entry: category shows as "" in Comments
      const nullCatRow = sheet.rows[0]!;
      expect(nullCatRow[0]).toBe("p-null");   // _key
      expect(nullCatRow[1]).toBe("Null-cat item");
      expect(nullCatRow[2]).toBe("");          // Comments (blank category)
      expect(nullCatRow[3]).toBe(400);         // Daily rate ($)
    });

    it("adversarial: pins exact row order for Transport Fees with edge-case inputs", async () => {
      // Transport rows: category "Truck" OR unit "each way"
      const rows: ListedRate[] = [
        makePlantListedRate({ rowId: "t-b",    item: "Bogie truck",     category: "Truck",  rate: 1500, unit: "each way" }),
        makePlantListedRate({ rowId: "t-10",   item: "10T truck",       category: "Truck",  rate: 1200, unit: "each way" }),
        makePlantListedRate({ rowId: "t-5",    item: "5T light truck",  category: "Truck",  rate: 900,  unit: "each way" }),
        makePlantListedRate({ rowId: "t-low",  item: "low-loader",      category: "Truck",  rate: 2000, unit: "each way" }),
        // Non-transport row — must NOT appear in Transport Fees
        makePlantListedRate({ rowId: "p-exc",  item: "Excavator",       category: "Plant",  rate: 800,  unit: "day" })
      ];

      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({ plantRows: rows });
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const transportSheet = await readSheet(buffer, "Transport Fees");
      const plantSheet = await readSheet(buffer, "Plant Rates");

      // Raw string order: "10T truck" < "5T light truck" < "Bogie truck" < "low-loader"
      // ('1' < '5' < 'B' < 'l' in ASCII: digits < uppercase < lowercase)
      const expectedTransport = ["10T truck", "5T light truck", "Bogie truck", "low-loader"];
      expect(transportSheet.rows.map((r) => r[1])).toEqual(expectedTransport);

      // Non-transport row lands in Plant Rates
      expect(plantSheet.rows).toHaveLength(1);
      expect(plantSheet.rows[0]![1]).toBe("Excavator");
    });
  });

  describe("Waste Disposal Fees sheet — routed through listRates(\"waste\")", () => {
    it("emits correct headers and golden row", async () => {
      const wasteRow = makeWasteListedRate({
        rowId: "w-uuid",
        facility: "BMI Swanbank",
        wasteType: "Concrete",
        wasteGroup: "Inert",
        unit: "tonne",
        tonRate: 45,
        loadRate: 120
      });
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({ wasteRows: [wasteRow] });
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

    it("calls listRates with slug 'waste'", async () => {
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({ wasteRows: [] });
      const svc = new RatesExportService(prisma, resolver);
      await svc.buildWorkbook();
      expect(resolver.listRates).toHaveBeenCalledWith("waste");
    });

    it("does NOT call prisma.estimateWasteRate for the waste export", async () => {
      const prisma = buildPrismaMock({});
      const wasteSpy = jest.fn();
      (prisma as unknown as { estimateWasteRate?: { findMany: jest.Mock } }).estimateWasteRate = {
        findMany: wasteSpy
      };
      const resolver = buildResolverMock({ wasteRows: [] });
      const svc = new RatesExportService(prisma, resolver);
      await svc.buildWorkbook();
      expect(wasteSpy).not.toHaveBeenCalled();
    });

    it("re-sorts waste rows by [facility asc, wasteType asc] — matching pre-SLICE-3a DB order", async () => {
      // listRates("waste") returns [wasteType asc, facility asc] — reversed vs export.
      // Export re-sorts to [facility asc, wasteType asc].
      const rows: ListedRate[] = [
        makeWasteListedRate({ rowId: "w1", facility: "Suez Willawong",    wasteType: "General waste", tonRate: 210 }),
        makeWasteListedRate({ rowId: "w2", facility: "BMI Swanbank",      wasteType: "General waste", tonRate: 200 }),
        makeWasteListedRate({ rowId: "w3", facility: "Cleanaway Willawong", wasteType: "Concrete",    tonRate: 45  }),
        makeWasteListedRate({ rowId: "w4", facility: "BMI Swanbank",      wasteType: "Concrete",      tonRate: 40  })
      ];
      // listRates returns [wasteType asc, facility asc] — simulate that order:
      // "Concrete/BMI", "Concrete/Cleanaway", "General/BMI", "General/Suez"
      const resolverOrderedRows = [
        rows[3]!, // "Concrete" + "BMI Swanbank"
        rows[2]!, // "Concrete" + "Cleanaway Willawong"
        rows[1]!, // "General waste" + "BMI Swanbank"
        rows[0]!  // "General waste" + "Suez Willawong"
      ];

      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({ wasteRows: resolverOrderedRows });
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const sheet = await readSheet(buffer, "Waste Disposal Fees");

      // Expected after re-sort: [facility asc, wasteType asc]
      // BMI Swanbank: Concrete, General waste
      // Cleanaway Willawong: Concrete
      // Suez Willawong: General waste
      const facilityOrder = sheet.rows.map((r) => r[1]);
      const wasteTypeOrder = sheet.rows.map((r) => r[2]);
      expect(facilityOrder).toEqual([
        "BMI Swanbank",
        "BMI Swanbank",
        "Cleanaway Willawong",
        "Suez Willawong"
      ]);
      expect(wasteTypeOrder).toEqual([
        "Concrete",
        "General waste",
        "Concrete",
        "General waste"
      ]);
    });

    it("adversarial: pins exact row order for Waste Disposal Fees with edge-case inputs", async () => {
      // Mixed case, leading digits, punctuation, null wasteGroup.
      // Export sort: [facility asc, wasteType asc] using pgAscCompare (raw string).
      const rows: ListedRate[] = [
        makeWasteListedRate({ rowId: "wa1", facility: "Suez Environmental",    wasteType: "General waste",   wasteGroup: "GENERAL",  tonRate: 200, loadRate: 50 }),
        makeWasteListedRate({ rowId: "wa2", facility: "BMI Swanbank",          wasteType: "Concrete",        wasteGroup: "Inert",    tonRate: 40,  loadRate: 0  }),
        makeWasteListedRate({ rowId: "wa3", facility: "BMI Swanbank",          wasteType: "10mm roadbase",   wasteGroup: null,       tonRate: 35,  loadRate: 0  }),
        makeWasteListedRate({ rowId: "wa4", facility: "Cleanaway (North)",     wasteType: "asphalt milling", wasteGroup: "Inert",    tonRate: 55,  loadRate: 10 }),
        makeWasteListedRate({ rowId: "wa5", facility: "Cleanaway (North)",     wasteType: "Asphalt milling", wasteGroup: "Inert",    tonRate: 55,  loadRate: 10 }),
        makeWasteListedRate({ rowId: "wa6", facility: "bmi swanbank",          wasteType: "Sludge",          wasteGroup: "Liquid",   tonRate: 300, loadRate: 80 })
      ];

      // Simulate resolver returning in [wasteType asc, facility asc] order
      // (the resolver's native order — export re-sorts from this).
      // Actual resolver order doesn't matter; export must sort correctly regardless.
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({ wasteRows: rows });
      const svc = new RatesExportService(prisma, resolver);

      const { buffer } = await svc.buildWorkbook();
      const sheet = await readSheet(buffer, "Waste Disposal Fees");

      // Facility raw string order:
      //   "BMI Swanbank" < "Cleanaway (North)" < "Suez Environmental" < "bmi swanbank"
      //   (uppercase 'B','C','S' have lower code points than lowercase 'b')
      //
      // Within "BMI Swanbank": wasteType order:
      //   "10mm roadbase" < "Concrete" ('1' < 'C' in ASCII)
      //
      // Within "Cleanaway (North)": wasteType order:
      //   "Asphalt milling" < "asphalt milling" ('A' < 'a' in ASCII)
      const expectedFacilities = [
        "BMI Swanbank",
        "BMI Swanbank",
        "Cleanaway (North)",
        "Cleanaway (North)",
        "Suez Environmental",
        "bmi swanbank"
      ];
      const expectedWasteTypes = [
        "10mm roadbase",
        "Concrete",
        "Asphalt milling",
        "asphalt milling",
        "General waste",
        "Sludge"
      ];
      expect(sheet.rows.map((r) => r[1])).toEqual(expectedFacilities);
      expect(sheet.rows.map((r) => r[2])).toEqual(expectedWasteTypes);

      // Golden row: null wasteGroup shows as "" in the Group column
      const nullGroupRow = sheet.rows[0]!; // BMI Swanbank / 10mm roadbase
      expect(nullGroupRow[0]).toBe("wa3");  // _key
      expect(nullGroupRow[3]).toBe("");     // Group (wasteGroup = null -> "")

      // Golden row: non-null wasteGroup is preserved
      const inertRow = sheet.rows[1]!; // BMI Swanbank / Concrete
      expect(inertRow[3]).toBe("Inert");
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
      const resolver = buildResolverMock({});
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

    it("does NOT call prisma.estimateMaterialDensity via resolver (direct prisma is preserved)", async () => {
      const densitySpy = jest.fn().mockResolvedValue([]);
      const prisma = {
        estimateMaterialDensity: { findMany: densitySpy }
      } as unknown as PrismaService;
      const resolver = buildResolverMock({});
      const svc = new RatesExportService(prisma, resolver);
      await svc.buildWorkbook();
      // Direct prisma call preserved — spy must have been called exactly once
      expect(densitySpy).toHaveBeenCalledTimes(1);
      // And the resolver must NOT have been called with "material-densities"
      expect(resolver.listRates).not.toHaveBeenCalledWith("material-densities");
    });
  });

  describe("filename", () => {
    it("returns a filename with today's date in YYYY-MM-DD format", async () => {
      const prisma = buildPrismaMock({});
      const resolver = buildResolverMock({});
      const svc = new RatesExportService(prisma, resolver);
      const { filename } = await svc.buildWorkbook();
      expect(filename).toMatch(/^rates-lists-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
  });
});
