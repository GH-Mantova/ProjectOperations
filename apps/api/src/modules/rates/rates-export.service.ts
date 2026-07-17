import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type EstimateWasteRateRow = Awaited<
  ReturnType<PrismaService["estimateWasteRate"]["findMany"]>
>[number];
type EstimateMaterialDensityRow = Awaited<
  ReturnType<PrismaService["estimateMaterialDensity"]["findMany"]>
>[number];
type EstimatePlantRateRow = Awaited<
  ReturnType<PrismaService["estimatePlantRate"]["findMany"]>
>[number];

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

function isTransportPlantRate(rate: EstimatePlantRateRow): boolean {
  const category = (rate.category ?? "").trim().toLowerCase();
  const unit = (rate.unit ?? "").trim().toLowerCase();
  return category === "truck" || unit === "each way";
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
  constructor(private readonly prisma: PrismaService) {}

  async buildWorkbook(): Promise<{ buffer: Buffer; filename: string }> {
    const [wasteRates, densities, plantRates] = await Promise.all([
      this.prisma.estimateWasteRate.findMany({
        orderBy: [{ facility: "asc" }, { wasteType: "asc" }]
      }),
      this.prisma.estimateMaterialDensity.findMany({
        orderBy: [{ category: "asc" }, { materialName: "asc" }]
      }),
      this.prisma.estimatePlantRate.findMany({
        orderBy: [{ category: "asc" }, { item: "asc" }]
      })
    ]);

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

  private addWasteSheet(workbook: ExcelJS.Workbook, rows: EstimateWasteRateRow[]) {
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
        rate: decimalToNumber(row.tonRate),
        loadRate: decimalToNumber(row.loadRate)
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

  private addPlantSheet(workbook: ExcelJS.Workbook, rows: EstimatePlantRateRow[]) {
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
        comments: row.category ?? "",
        rate: decimalToNumber(row.rate)
      });
    }
    this.styleHeader(sheet);
  }

  private addTransportSheet(workbook: ExcelJS.Workbook, rows: EstimatePlantRateRow[]) {
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
        comments: row.category ?? "",
        rate: decimalToNumber(row.rate)
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
