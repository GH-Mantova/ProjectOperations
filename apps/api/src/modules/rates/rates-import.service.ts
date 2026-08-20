import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { MaterialKind, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RateTablesService } from "./rate-tables.service";

// ── Sheet names (export writes these; import matches case-insensitively) ─
const WASTE_SHEET = "Waste Disposal Fees";
const DENSITY_SHEET = "Material Density";
const PLANT_SHEET = "Plant Rates";
const TRANSPORT_SHEET = "Transport Fees";
const KNOWN_SHEETS = new Set([WASTE_SHEET, DENSITY_SHEET, PLANT_SHEET, TRANSPORT_SHEET]);

const NUMBER_TOLERANCE = 0.001;

export type WasteRowValues = {
  facility: string;
  wasteType: string;
  wasteGroup: string | null;
  unit: string;
  tonRate: number;
  loadRate: number;
};

export type DensityRowValues = {
  materialName: string;
  category: string | null;
  kind: MaterialKind;
  unit: string;
  density: number;
};

export type PlantRowValues = {
  item: string;
  category: string | null;
  unit: string;
  rate: number;
};

export type ImportOperation =
  | { surface: "waste"; op: "add" | "update"; id?: string; values: WasteRowValues; naturalKey: string }
  | { surface: "density"; op: "add" | "update"; id?: string; values: DensityRowValues; naturalKey: string }
  | { surface: "plant"; op: "add" | "update"; id?: string; values: PlantRowValues; naturalKey: string }
  | { surface: "transport"; op: "add" | "update"; id?: string; values: PlantRowValues; naturalKey: string };

export type DiffChange = {
  naturalKey: string;
  id?: string;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
  changedFields: string[];
};

export type DiffAdd = {
  naturalKey: string;
  values: Record<string, unknown>;
};

export type SurfaceDiff = {
  label: string;
  adds: DiffAdd[];
  changes: DiffChange[];
  noChangeCount: number;
};

export type ImportPreview = {
  surfaces: {
    waste: SurfaceDiff;
    density: SurfaceDiff;
    plant: SurfaceDiff;
    transport: SurfaceDiff;
  };
  warnings: string[];
  operations: ImportOperation[];
};

export type ImportApplyResult = {
  added: { waste: number; density: number; plant: number; transport: number };
  updated: { waste: number; density: number; plant: number; transport: number };
  total: number;
};

/**
 * System actor ID used when the import write-path calls RateTablesService.
 * RateRow.createdById / updatedById are nullable String fields with no FK
 * constraint, so a sentinel value is safe and clearly identifies the source.
 */
const IMPORT_ACTOR = "system-import";

@Injectable()
export class RatesImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateTables: RateTablesService
  ) {}

  async preview(buffer: Buffer): Promise<ImportPreview> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs.xlsx.load wants an ArrayBuffer; Multer hands us a Node Buffer,
      // whose backing store is not necessarily a plain ArrayBuffer.
      const ab = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(ab).set(buffer);
      await workbook.xlsx.load(ab);
    } catch {
      throw new BadRequestException("Uploaded file is not a valid .xlsx workbook.");
    }

    const warnings: string[] = [];
    for (const ws of workbook.worksheets) {
      if (!KNOWN_SHEETS.has(ws.name)) {
        warnings.push(`Ignored unknown sheet: "${ws.name}".`);
      }
    }

    const parsed = {
      waste: this.parseWaste(workbook.getWorksheet(WASTE_SHEET), warnings),
      density: this.parseDensity(workbook.getWorksheet(DENSITY_SHEET), warnings),
      plant: this.parsePlant(workbook.getWorksheet(PLANT_SHEET), warnings, "day"),
      transport: this.parsePlant(workbook.getWorksheet(TRANSPORT_SHEET), warnings, "each way")
    };

    const [dbWaste, dbDensity, dbPlant] = await Promise.all([
      this.prisma.estimateWasteRate.findMany(),
      this.prisma.estimateMaterialDensity.findMany(),
      this.prisma.estimatePlantRate.findMany()
    ]);

    const dbPlantNonTransport = dbPlant.filter((r) => !this.isTransport(r.category, r.unit));
    const dbTransport = dbPlant.filter((r) => this.isTransport(r.category, r.unit));

    const operations: ImportOperation[] = [];

    const wasteDiff = this.diffWaste(parsed.waste, dbWaste, warnings, operations);
    const densityDiff = this.diffDensity(parsed.density, dbDensity, warnings, operations);
    const plantDiff = this.diffPlant(parsed.plant, dbPlantNonTransport, warnings, operations, "plant");
    const transportDiff = this.diffPlant(parsed.transport, dbTransport, warnings, operations, "transport");

    return {
      surfaces: {
        waste: wasteDiff,
        density: densityDiff,
        plant: plantDiff,
        transport: transportDiff
      },
      warnings,
      operations
    };
  }

  async apply(operations: ImportOperation[]): Promise<ImportApplyResult> {
    const result: ImportApplyResult = {
      added: { waste: 0, density: 0, plant: 0, transport: 0 },
      updated: { waste: 0, density: 0, plant: 0, transport: 0 },
      total: 0
    };

    for (const op of operations) {
      switch (op.surface) {
        case "waste":
          await this.applyWaste(op);
          break;
        case "density":
          await this.applyDensity(op);
          break;
        case "plant":
        case "transport":
          await this.applyPlant(op);
          break;
      }
      if (op.op === "add") result.added[op.surface]++;
      else result.updated[op.surface]++;
      result.total++;
    }

    return result;
  }

  // ── Parsing ──────────────────────────────────────────────────────────

  private parseWaste(
    sheet: ExcelJS.Worksheet | undefined,
    warnings: string[]
  ): Array<{ id?: string; values: WasteRowValues }> {
    if (!sheet) return [];
    const rows: Array<{ id?: string; values: WasteRowValues }> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const id = this.stringOrUndef(row.getCell(1).value);
      const facility = this.normaliseDash(this.stringOrEmpty(row.getCell(2).value));
      const wasteType = this.normaliseDash(this.stringOrEmpty(row.getCell(3).value));
      if (!facility || !wasteType) return; // silently skip fully blank rows
      const wasteGroup = this.stringOrNull(row.getCell(4).value);
      const rawUnit = this.stringOrEmpty(row.getCell(5).value).toLowerCase();
      const unit = rawUnit === "load" || rawUnit === "per load" ? "load" : rawUnit || "tonne";
      const tonRate = this.parseRate(row.getCell(6).value, warnings, `Waste "${facility} / ${wasteType}" rate`);
      const loadRate = this.parseRate(row.getCell(7).value, warnings, `Waste "${facility} / ${wasteType}" load rate`);
      if (tonRate === null && loadRate === null) {
        warnings.push(`Skipped waste row "${facility} / ${wasteType}" — no priced rate (POA/TBC on both columns).`);
        return;
      }
      rows.push({
        id,
        values: {
          facility,
          wasteType,
          wasteGroup,
          unit,
          tonRate: tonRate ?? 0,
          loadRate: loadRate ?? 0
        }
      });
    });
    return rows;
  }

  private parseDensity(
    sheet: ExcelJS.Worksheet | undefined,
    warnings: string[]
  ): Array<{ id?: string; values: DensityRowValues }> {
    if (!sheet) return [];
    const rows: Array<{ id?: string; values: DensityRowValues }> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const id = this.stringOrUndef(row.getCell(1).value);
      const materialName = this.stringOrEmpty(row.getCell(2).value).trim();
      if (!materialName) return;
      const category = this.stringOrNull(row.getCell(3).value);
      const kindRaw = this.stringOrEmpty(row.getCell(4).value).toUpperCase();
      const kind = this.coerceKind(kindRaw);
      const densityType = this.stringOrEmpty(row.getCell(5).value).trim();
      const weight = this.parseNumber(row.getCell(6).value);
      const weightUnit = this.stringOrEmpty(row.getCell(7).value).trim();
      if (weight === null) {
        warnings.push(`Skipped density row "${materialName}" — weight not numeric.`);
        return;
      }
      const density = this.reverseDensity(weight, weightUnit);
      rows.push({
        id,
        values: {
          materialName,
          category,
          kind,
          unit: densityType || (weightUnit.toLowerCase() === "t" ? "kg/m³" : "kg/m²"),
          density
        }
      });
    });
    return rows;
  }

  private parsePlant(
    sheet: ExcelJS.Worksheet | undefined,
    warnings: string[],
    defaultUnit: "day" | "each way"
  ): Array<{ id?: string; values: PlantRowValues }> {
    if (!sheet) return [];
    const rows: Array<{ id?: string; values: PlantRowValues }> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const id = this.stringOrUndef(row.getCell(1).value);
      const item = this.stringOrEmpty(row.getCell(2).value).trim();
      if (!item) return;
      const category = this.stringOrNull(row.getCell(3).value);
      const rate = this.parseRate(row.getCell(4).value, warnings, `${defaultUnit === "day" ? "Plant" : "Transport"} "${item}" rate`);
      if (rate === null) {
        warnings.push(`Skipped ${defaultUnit === "day" ? "plant" : "transport"} row "${item}" — POA/TBC.`);
        return;
      }
      rows.push({
        id,
        values: { item, category, unit: defaultUnit, rate }
      });
    });
    return rows;
  }

  // ── Diffing ──────────────────────────────────────────────────────────

  private diffWaste(
    parsed: Array<{ id?: string; values: WasteRowValues }>,
    db: Array<{
      id: string;
      facility: string;
      wasteType: string;
      wasteGroup: string | null;
      unit: string;
      tonRate: Prisma.Decimal;
      loadRate: Prisma.Decimal;
    }>,
    warnings: string[],
    operations: ImportOperation[]
  ): SurfaceDiff {
    const byId = new Map(db.map((r) => [r.id, r]));
    const byNaturalKey = new Map(
      db.map((r) => [this.wasteNaturalKey(r.facility, r.wasteType), r])
    );
    const adds: DiffAdd[] = [];
    const changes: DiffChange[] = [];
    let noChanges = 0;

    for (const { id, values } of parsed) {
      const nk = this.wasteNaturalKey(values.facility, values.wasteType);
      const match = (id && byId.get(id)) || byNaturalKey.get(nk);
      if (!match) {
        adds.push({ naturalKey: nk, values: this.wasteToPlain(values) });
        operations.push({ surface: "waste", op: "add", values, naturalKey: nk });
        continue;
      }
      const fromValues: WasteRowValues = {
        facility: match.facility,
        wasteType: match.wasteType,
        wasteGroup: match.wasteGroup,
        unit: match.unit,
        tonRate: this.decimalToNumber(match.tonRate),
        loadRate: this.decimalToNumber(match.loadRate)
      };
      const changed = this.compareWaste(fromValues, values);
      if (changed.length === 0) {
        noChanges++;
        continue;
      }
      changes.push({
        naturalKey: nk,
        id: match.id,
        from: this.wasteToPlain(fromValues),
        to: this.wasteToPlain(values),
        changedFields: changed
      });
      operations.push({ surface: "waste", op: "update", id: match.id, values, naturalKey: nk });
    }

    return { label: WASTE_SHEET, adds, changes, noChangeCount: noChanges };
  }

  private diffDensity(
    parsed: Array<{ id?: string; values: DensityRowValues }>,
    db: Array<{
      id: string;
      materialName: string;
      category: string | null;
      kind: MaterialKind;
      unit: string;
      density: Prisma.Decimal;
    }>,
    _warnings: string[],
    operations: ImportOperation[]
  ): SurfaceDiff {
    const byId = new Map(db.map((r) => [r.id, r]));
    const byNaturalKey = new Map(db.map((r) => [r.materialName.toLowerCase(), r]));
    const adds: DiffAdd[] = [];
    const changes: DiffChange[] = [];
    let noChanges = 0;

    for (const { id, values } of parsed) {
      const nk = values.materialName.toLowerCase();
      const match = (id && byId.get(id)) || byNaturalKey.get(nk);
      if (!match) {
        adds.push({ naturalKey: values.materialName, values: this.densityToPlain(values) });
        operations.push({ surface: "density", op: "add", values, naturalKey: values.materialName });
        continue;
      }
      const fromValues: DensityRowValues = {
        materialName: match.materialName,
        category: match.category,
        kind: match.kind,
        unit: match.unit,
        density: this.decimalToNumber(match.density)
      };
      const changed = this.compareDensity(fromValues, values);
      if (changed.length === 0) {
        noChanges++;
        continue;
      }
      changes.push({
        naturalKey: values.materialName,
        id: match.id,
        from: this.densityToPlain(fromValues),
        to: this.densityToPlain(values),
        changedFields: changed
      });
      operations.push({ surface: "density", op: "update", id: match.id, values, naturalKey: values.materialName });
    }

    return { label: DENSITY_SHEET, adds, changes, noChangeCount: noChanges };
  }

  private diffPlant(
    parsed: Array<{ id?: string; values: PlantRowValues }>,
    db: Array<{
      id: string;
      item: string;
      category: string | null;
      unit: string;
      rate: Prisma.Decimal;
    }>,
    _warnings: string[],
    operations: ImportOperation[],
    surface: "plant" | "transport"
  ): SurfaceDiff {
    const byId = new Map(db.map((r) => [r.id, r]));
    const byNaturalKey = new Map(db.map((r) => [r.item.toLowerCase(), r]));
    const adds: DiffAdd[] = [];
    const changes: DiffChange[] = [];
    let noChanges = 0;

    for (const { id, values } of parsed) {
      const nk = values.item.toLowerCase();
      const match = (id && byId.get(id)) || byNaturalKey.get(nk);
      if (!match) {
        adds.push({ naturalKey: values.item, values: this.plantToPlain(values) });
        operations.push({ surface, op: "add", values, naturalKey: values.item });
        continue;
      }
      const fromValues: PlantRowValues = {
        item: match.item,
        category: match.category,
        unit: match.unit,
        rate: this.decimalToNumber(match.rate)
      };
      const changed = this.comparePlant(fromValues, values);
      if (changed.length === 0) {
        noChanges++;
        continue;
      }
      changes.push({
        naturalKey: values.item,
        id: match.id,
        from: this.plantToPlain(fromValues),
        to: this.plantToPlain(values),
        changedFields: changed
      });
      operations.push({ surface, op: "update", id: match.id, values, naturalKey: values.item });
    }

    return {
      label: surface === "plant" ? PLANT_SHEET : TRANSPORT_SHEET,
      adds,
      changes,
      noChangeCount: noChanges
    };
  }

  // ── Applying ─────────────────────────────────────────────────────────

  private async applyWaste(
    op: Extract<ImportOperation, { surface: "waste" }>
  ): Promise<void> {
    // Route to the correct RateTable based on unit — the legacy EstimateWasteRate table
    // is unified, but the RateTable projection splits into waste-per-tonne (tonne unit)
    // and waste-per-m3 (all other units, e.g. m³). The value column name differs too.
    const isTonne = op.values.unit.toLowerCase() === "tonne";
    const tableSlug = isTonne ? "waste-per-tonne" : "waste-per-m3";

    // Map of import domain field → RateTable column name for this surface.
    // Column names must match what the seed created exactly.
    const fieldToColName: Record<string, string> = isTonne
      ? {
          facility: "Facility",
          wasteType: "Waste type",
          wasteGroup: "Group",
          ton: "Rate per tonne",
          load: "Rate per load"
        }
      : {
          facility: "Facility",
          wasteType: "Waste type",
          wasteGroup: "Group",
          m3: "Rate per m³"
        };

    // Build cells and find existing row; both are done against live table metadata.
    const cellsByColName: Record<string, unknown> = isTonne
      ? {
          facility: op.values.facility,
          wasteType: op.values.wasteType,
          wasteGroup: op.values.wasteGroup ?? "",
          ton: op.values.tonRate,
          load: op.values.loadRate
        }
      : {
          facility: op.values.facility,
          wasteType: op.values.wasteType,
          wasteGroup: op.values.wasteGroup ?? "",
          m3: op.values.tonRate
        };

    await this.upsertRateTableRow(tableSlug, fieldToColName, cellsByColName, {
      naturalKeyFields: ["facility", "wasteType"]
    });
  }

  private async applyDensity(
    op: Extract<ImportOperation, { surface: "density" }>
  ): Promise<void> {
    const data = {
      materialName: op.values.materialName,
      category: op.values.category,
      kind: op.values.kind,
      unit: op.values.unit,
      density: new Prisma.Decimal(op.values.density)
    };
    if (op.op === "update" && op.id) {
      await this.prisma.estimateMaterialDensity.update({ where: { id: op.id }, data });
      return;
    }
    await this.prisma.estimateMaterialDensity.upsert({
      where: { materialName: data.materialName },
      create: data,
      update: data
    });
  }

  private async applyPlant(
    op: Extract<ImportOperation, { surface: "plant" | "transport" }>
  ): Promise<void> {
    // Both plant and transport rows live in the "plant" RateTable (the legacy
    // EstimatePlantRate table stored both, distinguished by unit and category).
    const fieldToColName: Record<string, string> = {
      item: "Item",
      category: "Category",
      unit: "Unit",
      rate: "Rate"
    };
    const cellsByColName: Record<string, unknown> = {
      item: op.values.item,
      category: op.values.category ?? "",
      unit: op.values.unit,
      rate: op.values.rate
    };

    await this.upsertRateTableRow("plant", fieldToColName, cellsByColName, {
      naturalKeyFields: ["item"]
    });
  }

  // ── RateTable upsert helper ───────────────────────────────────────────

  /**
   * Find-then-update-or-create a RateRow in the given RateTable slug,
   * preserving the same upsert semantics the legacy Prisma calls used.
   *
   * `fieldToColName` maps the short domain-field keys used in `cellsByColName`
   * to the exact column names stored in the DB. This indirection means no
   * hardcoded column IDs here — column IDs are resolved at runtime from the
   * live table metadata, so they survive any future seed reorganisation.
   *
   * `naturalKeyFields` names the subset of field keys that together form the
   * natural key (the unique-match criterion for "update vs insert").
   *
   * Throws NotFoundException if the table slug does not exist — the caller
   * should not silently create rows in a non-existent table.
   */
  private async upsertRateTableRow(
    tableSlug: string,
    fieldToColName: Record<string, string>,
    cellsByColName: Record<string, unknown>,
    opts: { naturalKeyFields: string[] }
  ): Promise<void> {
    // Look up the table with its columns.
    const table = await this.prisma.rateTable.findUnique({
      where: { slug: tableSlug },
      include: { columns: { orderBy: { sortOrder: "asc" } } }
    });
    if (!table) {
      throw new NotFoundException(
        `Import write failed: RateTable with slug "${tableSlug}" not found. ` +
          `Run seedRateTableProjections to create it before importing.`
      );
    }

    // Build a name->id map for fast lookup.
    const colIdByName = new Map(table.columns.map((c) => [c.name, c.id]));

    // Translate cellsByColName (field-keyed) into cells (column-id-keyed).
    const cells: Record<string, unknown> = {};
    for (const [field, colName] of Object.entries(fieldToColName)) {
      const colId = colIdByName.get(colName);
      if (!colId) continue; // column absent in this table -- skip gracefully
      cells[colId] = cellsByColName[field];
    }

    // Build the natural-key predicate to find an existing row.
    const keyPredicates: Array<{ colId: string; value: string }> = [];
    for (const field of opts.naturalKeyFields) {
      const colName = fieldToColName[field];
      const colId = colName ? colIdByName.get(colName) : undefined;
      if (colId) {
        keyPredicates.push({
          colId,
          value: String(cellsByColName[field] ?? "").trim().toLowerCase()
        });
      }
    }

    // Search active rows for a natural-key match.
    const activeRows = await this.prisma.rateRow.findMany({
      where: { rateTableId: table.id, isActive: true }
    });
    const existingRow = activeRows.find((r) => {
      const rowCells = (r.cells as Record<string, unknown> | null) ?? {};
      return keyPredicates.every(
        ({ colId, value }) => String(rowCells[colId] ?? "").trim().toLowerCase() === value
      );
    });

    if (existingRow) {
      await this.rateTables.updateRow(IMPORT_ACTOR, table.id, existingRow.id, { cells });
    } else {
      await this.rateTables.createRow(IMPORT_ACTOR, table.id, { cells });
    }
  }

  // ── Comparators ──────────────────────────────────────────────────────

  private compareWaste(a: WasteRowValues, b: WasteRowValues): string[] {
    const changed: string[] = [];
    if (!this.eqString(a.wasteGroup, b.wasteGroup)) changed.push("wasteGroup");
    if (!this.eqString(a.unit, b.unit)) changed.push("unit");
    if (!this.eqNumber(a.tonRate, b.tonRate)) changed.push("tonRate");
    if (!this.eqNumber(a.loadRate, b.loadRate)) changed.push("loadRate");
    // NB: facility/wasteType are the natural key — never a "change".
    return changed;
  }

  private compareDensity(a: DensityRowValues, b: DensityRowValues): string[] {
    const changed: string[] = [];
    if (!this.eqString(a.category, b.category)) changed.push("category");
    if (a.kind !== b.kind) changed.push("kind");
    if (!this.eqString(a.unit, b.unit)) changed.push("unit");
    if (!this.eqNumber(a.density, b.density)) changed.push("density");
    return changed;
  }

  private comparePlant(a: PlantRowValues, b: PlantRowValues): string[] {
    const changed: string[] = [];
    if (!this.eqString(a.category, b.category)) changed.push("category");
    if (!this.eqString(a.unit, b.unit)) changed.push("unit");
    if (!this.eqNumber(a.rate, b.rate)) changed.push("rate");
    return changed;
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private wasteNaturalKey(facility: string, wasteType: string): string {
    return `${this.normaliseDash(facility).toLowerCase()}||${this.normaliseDash(wasteType).toLowerCase()}`;
  }

  private wasteToPlain(v: WasteRowValues): Record<string, unknown> {
    return {
      facility: v.facility,
      wasteType: v.wasteType,
      wasteGroup: v.wasteGroup,
      unit: v.unit,
      tonRate: v.tonRate,
      loadRate: v.loadRate
    };
  }

  private densityToPlain(v: DensityRowValues): Record<string, unknown> {
    return {
      materialName: v.materialName,
      category: v.category,
      kind: v.kind,
      unit: v.unit,
      density: v.density
    };
  }

  private plantToPlain(v: PlantRowValues): Record<string, unknown> {
    return { item: v.item, category: v.category, unit: v.unit, rate: v.rate };
  }

  private isTransport(category: string | null, unit: string): boolean {
    const cat = (category ?? "").trim().toLowerCase();
    const u = (unit ?? "").trim().toLowerCase();
    return cat === "truck" || u === "each way";
  }

  private normaliseDash(input: string): string {
    // Marco's convention: em-dash is canonical; normalise hyphens and
    // en-dashes so ' — ' and ' - ' and ' – ' collapse to the same key.
    return input.replace(/\s+[–\-]\s+/g, " — ").trim();
  }

  private coerceKind(raw: string): MaterialKind {
    const upper = raw.trim().toUpperCase();
    if (upper === "VOLUME" || upper === "AREA" || upper === "EACH" || upper === "FACTOR") {
      return upper as MaterialKind;
    }
    return "VOLUME";
  }

  private reverseDensity(weight: number, weightUnit: string): number {
    const u = weightUnit.trim().toLowerCase();
    if (u === "t" || u === "tonne" || u === "tonnes") return weight * 1000;
    return weight;
  }

  private parseRate(value: unknown, warnings: string[], label: string): number | null {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return value;
    const str = String(value).trim();
    if (str === "") return 0;
    const upper = str.toUpperCase();
    if (upper === "POA" || upper === "TBC" || upper === "N/A") {
      warnings.push(`${label} is ${upper} — treated as unpriced (0).`);
      return null;
    }
    const cleaned = str.replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n)) {
      warnings.push(`${label} not numeric ("${str}") — skipped.`);
      return null;
    }
    return n;
  }

  private parseNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return value;
    const cleaned = String(value).replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  private stringOrEmpty(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && "text" in (value as Record<string, unknown>)) {
      return String((value as { text: unknown }).text ?? "");
    }
    return String(value);
  }

  private stringOrUndef(value: unknown): string | undefined {
    const s = this.stringOrEmpty(value).trim();
    return s || undefined;
  }

  private stringOrNull(value: unknown): string | null {
    const s = this.stringOrEmpty(value).trim();
    return s || null;
  }

  private eqString(a: string | null | undefined, b: string | null | undefined): boolean {
    return (a ?? "").trim() === (b ?? "").trim();
  }

  private eqNumber(a: number, b: number): boolean {
    return Math.abs(a - b) < NUMBER_TOLERANCE;
  }

  private decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    return Number(value.toString());
  }
}
