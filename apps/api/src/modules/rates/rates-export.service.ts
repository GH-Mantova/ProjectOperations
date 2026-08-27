import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RateResolverService } from "./rate-resolver.service";

type EstimateMaterialDensityRow = Awaited<
  ReturnType<PrismaService["estimateMaterialDensity"]["findMany"]>
>[number];

/**
 * Normalised plant-rate row used internally by addPlantSheet /
 * addTransportSheet. Built from ListedRate (rates-consumers SLICE 3) so
 * the two sheet-writers don't need to know which source answered.
 * All values are already converted to primitives — no Decimal arithmetic
 * needed downstream.
 */
type PlantRateExportRow = {
  id: string;
  item: string;
  category: string;
  rate: number;
  unit: string;
};

/**
 * Normalised waste-rate row used internally by addWasteSheet.
 * Built from ListedRate (rates-consumers SLICE 3a) so the sheet-writer
 * doesn't need to know which source answered. All values are primitives.
 */
type WasteRateExportRow = {
  id: string;
  facility: string;
  wasteType: string;
  wasteGroup: string | null;
  unit: string;
  tonRate: number;
  loadRate: number;
};

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF005B61" }
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };

const KEY_COLUMN_HEADER = "_key";

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

function isTransportPlantRate(rate: PlantRateExportRow): boolean {
  const category = (rate.category ?? "").trim().toLowerCase();
  const unit = (rate.unit ?? "").trim().toLowerCase();
  return category === "truck" || unit === "each way";
}

/**
 * Stable JS comparator that approximates Postgres default collation for the
 * ASCII-range values in rate tables. Uses raw string comparison (NOT
 * .toLowerCase()) — this preserves digit-before-letter ordering consistent
 * with Postgres "C" / POSIX collation, which is what the real DB uses.
 *
 * ORDERING TRAP from PR #1337: `.toLowerCase()` does NOT reproduce Postgres
 * collation. Use this comparator instead. If mixed-locale or unicode values
 * appear in a future data set, re-verify and update this comparator.
 */
function pgAscCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Builds the round-trip Excel workbook for the Rates & Lists surface.
 *
 * Layout: one worksheet per surface, each with a hidden `_key` column
 * carrying the DB id so the future import PR can match rows deterministically
 * rather than by natural-key guessing.
 *
 * Waste-type rows are NOT a separate tab — they are derived from the
 * `Waste Disposal Fees` tab's `Waste type` column at import time.
 */
@Injectable()
export class RatesExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateResolver: RateResolverService
  ) {}

  async buildWorkbook(): Promise<{ buffer: Buffer; filename: string }> {
    // rates-consumers SLICE 3a: both estimatePlantRate.findMany and
    // estimateWasteRate.findMany are routed through RateResolverService.
    // estimateMaterialDensity is left on direct prisma — it is a density
    // lookup, not a $ rate, and the done_when for pr-524 requires the
    // model to survive.
    const [listedPlant, listedWaste, densities] = await Promise.all([
      this.rateResolver.listRates("plant"),
      this.rateResolver.listRates("waste"),
      this.prisma.estimateMaterialDensity.findMany({
        orderBy: [{ category: "asc" }, { materialName: "asc" }]
      })
    ]);

    // Re-sort plant to match original DB order: [category asc, item asc].
    // listRates("plant") returns item-only order ({ item: "asc" }).
    // ORDERING TRAP: use pgAscCompare (raw string) not .toLowerCase() —
    // see function comment above for why.
    listedPlant.sort((lhs, rhs) => {
      const catCmp = pgAscCompare(
        String(lhs.info.Category ?? ""),
        String(rhs.info.Category ?? "")
      );
      if (catCmp !== 0) return catCmp;
      return pgAscCompare(
        String(lhs.keys.item ?? ""),
        String(rhs.keys.item ?? "")
      );
    });
    const plantRates: PlantRateExportRow[] = listedPlant.map((r) => ({
      id: r.rowId,
      item: String(r.keys.item ?? ""),
      category: String(r.info.Category ?? ""),
      rate: r.value,
      unit: r.unit
    }));

    // Re-sort waste to match original DB order: [facility asc, wasteType asc].
    // listRates("waste") returns [wasteType asc, facility asc] (reversed).
    // ORDERING TRAP: use pgAscCompare (raw string) not .toLowerCase().
    listedWaste.sort((lhs, rhs) => {
      const facCmp = pgAscCompare(
        String(lhs.keys.facility ?? ""),
        String(rhs.keys.facility ?? "")
      );
      if (facCmp !== 0) return facCmp;
      return pgAscCompare(
        String(lhs.keys.wasteType ?? ""),
        String(rhs.keys.wasteType ?? "")
      );
    });
    const wasteRates: WasteRateExportRow[] = listedWaste.map((r) => ({
      id: r.rowId,
      facility: String(r.keys.facility ?? ""),
      wasteType: String(r.keys.wasteType ?? ""),
      wasteGroup: r.info.wasteGroup !== undefined ? (r.info.wasteGroup as string | null) : null,
      unit: r.unit,
      tonRate: r.value,
      loadRate: typeof r.info.loadRate === "number" ? r.info.loadRate : 0
    }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "ProjectOperations";
    workbook.created = new Date();

    this.addWasteSheet(workbook, wasteRates);
    this.addDensitySheet(workbook, densities);
    this.addPlantSheet(
      workbook,
      plantRates.filter((r) => !isTransportPlantRate(r))
    );
    this.addTransportSheet(
      workbook,
      plantRates.filter((r) => isTransportPlantRate(r))
    );

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
    const stamp = new Date().toISOString().slice(0, 10);
    return { buffer, filename: `rates-lists-${stamp}.xlsx` };
  }

  private addWasteSheet(workbook: ExcelJS.Workbook, rows: WasteRateExportRow[]) {
    const sheet = workbook.addWorksheet("Waste Disposal Fees");
    sheet.columns = [
      { header: KEY_COLUMN_HEADER, key: "key", width: 38 },
      { header: "Facility", key: "facility", width: 28 },
      { header: "Waste type", key: "wasteType", width: 26 },
      { header: "Group", key: "group", width: 18 },
      { header: "Charged as (unit)", key: "unit", width: 16 },
      { header: "Rate ($)", key: "rate", width: 14 },
      { header: "Load rate ($)", key: "loadRate", width: 14 }
    ];
    for (const row of rows) {
      sheet.addRow({
        key: row.id,
        facility: row.facility,
        wasteType: row.wasteType,
        group: row.wasteGroup ?? "",
        unit: row.unit,
        rate: row.tonRate,
        loadRate: row.loadRate
      });
    }
    this.styleHeader(sheet);
  }

  private addDensitySheet(workbook: ExcelJS.Workbook, rows: EstimateMaterialDensityRow[]) {
    const sheet = workbook.addWorksheet("Material Density");
    sheet.columns = [
      { header: KEY_COLUMN_HEADER, key: "key", width: 38 },
      { header: "Material", key: "material", width: 30 },
      { header: "Category", key: "category", width: 16 },
      { header: "Kind", key: "kind", width: 12 },
      { header: "Density type", key: "densityType", width: 14 },
      { header: "Weight", key: "weight", width: 12 },
      { header: "Weight unit", key: "weightUnit", width: 12 }
    ];
    for (const row of rows) {
      const displayed = this.formatDensity(row.unit, decimalToNumber(row.density));
      sheet.addRow({
        key: row.id,
        material: row.materialName,
        category: row.category ?? "",
        kind: row.kind,
        densityType: row.unit,
        weight: displayed.weight,
        weightUnit: displayed.weightUnit
      });
    }
    this.styleHeader(sheet);
  }

  private addPlantSheet(workbook: ExcelJS.Workbook, rows: PlantRateExportRow[]) {
    const sheet = workbook.addWorksheet("Plant Rates");
    sheet.columns = [
      { header: KEY_COLUMN_HEADER, key: "key", width: 38 },
      { header: "Type", key: "type", width: 30 },
      { header: "Comments", key: "comments", width: 30 },
      { header: "Daily rate ($)", key: "rate", width: 14 }
    ];
    for (const row of rows) {
      sheet.addRow({
        key: row.id,
        type: row.item,
        comments: row.category,
        rate: row.rate
      });
    }
    this.styleHeader(sheet);
  }

  private addTransportSheet(workbook: ExcelJS.Workbook, rows: PlantRateExportRow[]) {
    const sheet = workbook.addWorksheet("Transport Fees");
    sheet.columns = [
      { header: KEY_COLUMN_HEADER, key: "key", width: 38 },
      { header: "Type", key: "type", width: 30 },
      { header: "Comments", key: "comments", width: 30 },
      { header: "Rate ($)", key: "rate", width: 14 }
    ];
    for (const row of rows) {
      sheet.addRow({
        key: row.id,
        type: row.item,
        comments: row.category,
        rate: row.rate
      });
    }
    this.styleHeader(sheet);
  }

  private formatDensity(unit: string, density: number): { weight: number; weightUnit: string } {
    const normalised = unit.replace(/\s+/g, "").toLowerCase();
    if (normalised === "kg/m³" || normalised === "kg/m3") {
      return { weight: density / 1000, weightUnit: "T" };
    }
    if (normalised === "kg/m²" || normalised === "kg/m2") {
      return { weight: density, weightUnit: "kg" };
    }
    return { weight: density, weightUnit: unit };
  }

  private styleHeader(sheet: ExcelJS.Worksheet) {
    const header = sheet.getRow(1);
    header.font = HEADER_FONT;
    header.fill = HEADER_FILL;
    header.alignment = { vertical: "middle", horizontal: "left" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    // The `_key` column carries the DB id for round-trip matching; hide it
    // so the user doesn't accidentally edit ids during the review pass.
    const keyColumn = sheet.getColumn("key");
    keyColumn.hidden = true;
  }
}
