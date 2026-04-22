import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Discipline } from "./dto/scope-of-works.dto";
import { DISCIPLINES } from "./dto/scope-of-works.dto";

// ── Column availability map ─────────────────────────────────────────────
// Required columns are always rendered. Optional columns are opt-in via
// ScopeViewConfig, but only become visible in the UI when the selected
// row type lists them as available (so a `plant-only` row doesn't show
// empty cells for "men" etc.).

export const REQUIRED_COLUMNS = ["wbsCode", "description", "rowType"] as const;

const COLUMNS_BY_ROW_TYPE: Record<string, string[]> = {
  demolition: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  "asbestos-removal": ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  enclosure: ["men", "days", "measurementQty", "measurementUnit", "material", "notes"],
  excavation: ["men", "days", "shift", "plantAssetId", "measurementQty", "measurementUnit", "material", "notes"],
  earthworks: ["men", "days", "shift", "plantAssetId", "measurementQty", "measurementUnit", "material", "notes"],
  "waste-disposal": ["wasteGroup", "wasteType", "wasteFacility", "wasteTonnes", "wasteLoads", "notes"],
  "plant-only": ["plantAssetId", "days", "notes"],
  "general-labour": ["men", "days", "shift", "notes"],
  cutting: ["notes"],
  // Legacy row-type aliases — kept so old rows keep resolving to a
  // sensible column set when the UI asks for availability.
  asbestos: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  waste: ["wasteGroup", "wasteType", "wasteFacility", "wasteTonnes", "wasteLoads", "notes"],
  general: ["men", "days", "shift", "notes"]
};

// Row-type × discipline matrix (server-authoritative).
const ROW_TYPES_BY_DISCIPLINE: Record<Discipline, string[]> = {
  SO: ["demolition", "waste-disposal", "plant-only", "general-labour", "cutting"],
  Str: ["demolition", "waste-disposal", "plant-only", "general-labour", "cutting"],
  Asb: ["asbestos-removal", "enclosure", "waste-disposal", "plant-only", "general-labour"],
  Civ: ["excavation", "earthworks", "waste-disposal", "plant-only", "general-labour", "cutting"],
  Prv: ["waste-disposal", "plant-only", "general-labour", "cutting"]
};

// Legacy aliases acceptable on any discipline the matrix allows.
const LEGACY_ROW_TYPES = new Set(["demolition", "cutting", "asbestos", "excavation", "waste", "general"]);

export function assertRowTypeForDiscipline(discipline: Discipline, rowType: string): void {
  const allowed = ROW_TYPES_BY_DISCIPLINE[discipline];
  if (!allowed) throw new BadRequestException(`Unknown discipline "${discipline}".`);
  if (allowed.includes(rowType)) return;
  if (LEGACY_ROW_TYPES.has(rowType)) return;
  throw new BadRequestException(
    `Row type "${rowType}" is not valid for discipline "${discipline}". Allowed: ${allowed.join(", ")}.`
  );
}

export function columnsForRowType(rowType: string) {
  const available = COLUMNS_BY_ROW_TYPE[rowType];
  if (!available) {
    throw new BadRequestException(`Unknown rowType "${rowType}".`);
  }
  return { available, required: [...REQUIRED_COLUMNS] };
}

// Default "optional columns on" for a discipline — union of all its
// row types' column sets (excluding required columns).
function defaultColumnsForDiscipline(discipline: Discipline): string[] {
  const union = new Set<string>();
  for (const rt of ROW_TYPES_BY_DISCIPLINE[discipline] ?? []) {
    for (const col of COLUMNS_BY_ROW_TYPE[rt] ?? []) union.add(col);
  }
  return Array.from(union).filter((c) => !(REQUIRED_COLUMNS as readonly string[]).includes(c));
}

const ELEVATION_MULTIPLIER: Record<string, number> = {
  Floor: 1.0,
  Any: 1.0,
  Wall: 1.1,
  Inverted: 2.0
};

const METHOD_MULTIPLIER: Record<string, number> = {
  "High-Freq": 1.25,
  "Low-emission": 1.25
};

const ANY_ELEVATION_EQUIPMENT = new Set(["Flush-cut", "Ringsaw", "Tracksaw"]);
const ANY_MATERIAL_EQUIPMENT = new Set(["Flush-cut", "Ringsaw", "Tracksaw"]);

// User-facing material labels → Cutrite table material values. Scope rows
// use strings like "Concrete (unreinforced)"; the rate table only stores
// three categorical values.
function mapUserMaterial(raw: string | null | undefined): string {
  if (!raw) return "Concrete";
  const s = raw.toLowerCase();
  if (s.includes("asphalt")) return "Asphalt";
  if (s.includes("brick") || s.includes("block") || s.includes("masonry")) return "Brick/Block";
  return "Concrete";
}

/**
 * Implement the spec's 6-step rate resolver. Returns null when no rate
 * exists for the resolved key (UI shows "—" rather than erroring).
 */
export async function resolveCuttingRate(
  prisma: PrismaService,
  input: {
    equipment: string;
    elevation: string;
    material: string;
    depthMm: number;
    method?: string | null;
  }
): Promise<{ baseRate: number; methodMultiplier: number; elevationMultiplier: number; finalRate: number } | null> {
  const { equipment, depthMm } = input;

  // Steps 1 + 2 — collapse elevation/material into the table's three-level
  // categorical set. This mirrors the rate-library layout: Demosaw has
  // separate Floor/Any and Wall/{Concrete,Brick/Block} rows; Roadsaw has
  // Floor/{Concrete,Asphalt}; everything else is Any/Any.
  let effectiveElevation = input.elevation;
  let effectiveMaterial = mapUserMaterial(input.material);

  if (ANY_ELEVATION_EQUIPMENT.has(equipment)) {
    effectiveElevation = "Any";
    effectiveMaterial = ANY_MATERIAL_EQUIPMENT.has(equipment) ? "Any" : effectiveMaterial;
  } else if (equipment === "Demosaw") {
    if (input.elevation === "Floor") {
      effectiveElevation = "Floor";
      effectiveMaterial = "Any";
    } else {
      effectiveElevation = "Wall";
      if (effectiveMaterial !== "Brick/Block") effectiveMaterial = "Concrete";
    }
  } else if (equipment === "Roadsaw") {
    effectiveElevation = "Floor";
    effectiveMaterial = effectiveMaterial === "Asphalt" ? "Asphalt" : "Concrete";
  }

  // Step 3 — effective depth.
  let rateRow: { depthMm: number; ratePerM: unknown } | null = null;
  if (equipment === "Tracksaw" || equipment === "Flush-cut") {
    const bucketed = Math.max(25, Math.ceil(depthMm / 25) * 25);
    rateRow = await prisma.estimateCuttingRate.findFirst({
      where: {
        equipment,
        elevation: effectiveElevation,
        material: effectiveMaterial,
        depthMm: bucketed,
        isActive: true
      }
    });
    // Fall back to the single seeded 25mm row if the bucketed depth isn't
    // in the table (Tracksaw/Flush-cut only have the one seed row).
    if (!rateRow) {
      rateRow = await prisma.estimateCuttingRate.findFirst({
        where: {
          equipment,
          elevation: effectiveElevation,
          material: effectiveMaterial,
          depthMm: { gte: 0 },
          isActive: true
        }
      });
    }
  } else {
    rateRow = await prisma.estimateCuttingRate.findFirst({
      where: {
        equipment,
        elevation: effectiveElevation,
        material: effectiveMaterial,
        depthMm: { gte: depthMm },
        isActive: true
      },
      orderBy: { depthMm: "asc" }
    });
    if (!rateRow) {
      // If requested depth exceeds the max seeded depth, use the biggest available.
      rateRow = await prisma.estimateCuttingRate.findFirst({
        where: {
          equipment,
          elevation: effectiveElevation,
          material: effectiveMaterial,
          isActive: true
        },
        orderBy: { depthMm: "desc" }
      });
    }
  }

  if (!rateRow) return null;

  const baseRate = Number(rateRow.ratePerM);
  const methodMultiplier = METHOD_MULTIPLIER[input.method ?? ""] ?? 1.0;
  const elevationMultiplier = ELEVATION_MULTIPLIER[input.elevation] ?? 1.0;
  const finalRate = baseRate * methodMultiplier * elevationMultiplier;
  return { baseRate, methodMultiplier, elevationMultiplier, finalRate };
}

@Injectable()
export class ScopeRedesignService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Columns ──────────────────────────────────────────────────────────
  getColumnsForRowType(rowType: string) {
    return columnsForRowType(rowType);
  }

  // ── View config ──────────────────────────────────────────────────────
  async getViewConfig(tenderId: string, discipline: string) {
    await this.requireTender(tenderId);
    this.assertDiscipline(discipline);
    const existing = await this.prisma.scopeViewConfig.findUnique({
      where: { tenderId_discipline: { tenderId, discipline } }
    });
    if (existing) {
      return {
        tenderId,
        discipline,
        columns: Array.isArray(existing.columns) ? (existing.columns as string[]) : defaultColumnsForDiscipline(discipline as Discipline)
      };
    }
    return {
      tenderId,
      discipline,
      columns: defaultColumnsForDiscipline(discipline as Discipline)
    };
  }

  async upsertViewConfig(tenderId: string, discipline: string, columns: string[]) {
    await this.requireTender(tenderId);
    this.assertDiscipline(discipline);
    const cleaned = columns.filter((c) => typeof c === "string" && c.length > 0);
    return this.prisma.scopeViewConfig.upsert({
      where: { tenderId_discipline: { tenderId, discipline } },
      create: { tenderId, discipline, columns: cleaned as unknown as Prisma.InputJsonValue },
      update: { columns: cleaned as unknown as Prisma.InputJsonValue }
    });
  }

  // ── Cutting sheet items ──────────────────────────────────────────────
  async listCuttingItems(tenderId: string) {
    await this.requireTender(tenderId);
    return this.prisma.cuttingSheetItem.findMany({
      where: { tenderId },
      orderBy: [{ wbsRef: "asc" }, { sortOrder: "asc" }]
    });
  }

  async createCuttingItem(
    tenderId: string,
    actorId: string,
    dto: {
      wbsRef: string;
      description?: string | null;
      itemType: "saw-cut" | "core-hole";
      equipment?: string | null;
      elevation?: string | null;
      material?: string | null;
      depthMm?: number | null;
      diameterMm?: number | null;
      quantityLm?: number | null;
      quantityEach?: number | null;
      shift?: string | null;
      method?: string | null;
      shiftLoading?: number | null;
      notes?: string | null;
      sortOrder?: number | null;
    }
  ) {
    await this.requireTender(tenderId);
    if (!dto.wbsRef?.trim()) throw new BadRequestException("wbsRef is required.");
    if (!["saw-cut", "core-hole"].includes(dto.itemType)) {
      throw new BadRequestException('itemType must be "saw-cut" or "core-hole".');
    }
    const priced = await this.pricedCuttingData(dto);
    return this.prisma.cuttingSheetItem.create({
      data: {
        tenderId,
        createdById: actorId,
        wbsRef: dto.wbsRef.trim(),
        description: dto.description?.trim() || null,
        itemType: dto.itemType,
        equipment: dto.equipment ?? null,
        elevation: dto.elevation ?? null,
        material: dto.material ?? null,
        depthMm: dto.depthMm ?? null,
        diameterMm: dto.diameterMm ?? null,
        quantityLm: dto.quantityLm !== undefined && dto.quantityLm !== null ? new Prisma.Decimal(dto.quantityLm) : null,
        quantityEach: dto.quantityEach ?? null,
        shift: dto.shift ?? null,
        method: dto.method ?? null,
        shiftLoading: dto.shiftLoading !== undefined && dto.shiftLoading !== null ? new Prisma.Decimal(dto.shiftLoading) : null,
        notes: dto.notes ?? null,
        sortOrder: dto.sortOrder ?? 0,
        ratePerM: priced.ratePerM,
        ratePerHole: priced.ratePerHole,
        lineTotal: priced.lineTotal
      }
    });
  }

  async updateCuttingItem(
    tenderId: string,
    itemId: string,
    dto: Partial<{
      wbsRef: string;
      description: string | null;
      itemType: "saw-cut" | "core-hole";
      equipment: string | null;
      elevation: string | null;
      material: string | null;
      depthMm: number | null;
      diameterMm: number | null;
      quantityLm: number | null;
      quantityEach: number | null;
      shift: string | null;
      method: string | null;
      shiftLoading: number | null;
      notes: string | null;
      sortOrder: number | null;
    }>
  ) {
    const existing = await this.prisma.cuttingSheetItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.tenderId !== tenderId) throw new NotFoundException("Cutting item not found.");

    const merged = {
      itemType: (dto.itemType ?? existing.itemType) as "saw-cut" | "core-hole",
      equipment: dto.equipment !== undefined ? dto.equipment : existing.equipment,
      elevation: dto.elevation !== undefined ? dto.elevation : existing.elevation,
      material: dto.material !== undefined ? dto.material : existing.material,
      depthMm: dto.depthMm !== undefined ? dto.depthMm : existing.depthMm,
      diameterMm: dto.diameterMm !== undefined ? dto.diameterMm : existing.diameterMm,
      quantityLm:
        dto.quantityLm !== undefined
          ? dto.quantityLm
          : existing.quantityLm
            ? Number(existing.quantityLm)
            : null,
      quantityEach: dto.quantityEach !== undefined ? dto.quantityEach : existing.quantityEach,
      shift: dto.shift !== undefined ? dto.shift : existing.shift,
      method: dto.method !== undefined ? dto.method : existing.method,
      shiftLoading:
        dto.shiftLoading !== undefined
          ? dto.shiftLoading
          : existing.shiftLoading
            ? Number(existing.shiftLoading)
            : null
    };
    const priced = await this.pricedCuttingData(merged);
    return this.prisma.cuttingSheetItem.update({
      where: { id: itemId },
      data: {
        wbsRef: dto.wbsRef !== undefined ? dto.wbsRef.trim() : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        itemType: dto.itemType,
        equipment: dto.equipment,
        elevation: dto.elevation,
        material: dto.material,
        depthMm: dto.depthMm,
        diameterMm: dto.diameterMm,
        quantityLm:
          dto.quantityLm === undefined
            ? undefined
            : dto.quantityLm === null
              ? null
              : new Prisma.Decimal(dto.quantityLm),
        quantityEach: dto.quantityEach,
        shift: dto.shift,
        method: dto.method,
        shiftLoading:
          dto.shiftLoading === undefined
            ? undefined
            : dto.shiftLoading === null
              ? null
              : new Prisma.Decimal(dto.shiftLoading),
        notes: dto.notes,
        sortOrder: dto.sortOrder ?? undefined,
        ratePerM: priced.ratePerM,
        ratePerHole: priced.ratePerHole,
        lineTotal: priced.lineTotal
      }
    });
  }

  async deleteCuttingItem(tenderId: string, itemId: string) {
    const existing = await this.prisma.cuttingSheetItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.tenderId !== tenderId) throw new NotFoundException("Cutting item not found.");
    await this.prisma.cuttingSheetItem.delete({ where: { id: itemId } });
    return { id: itemId };
  }

  // ── Summary ──────────────────────────────────────────────────────────
  async summary(tenderId: string) {
    await this.requireTender(tenderId);
    // Discipline subtotals come from the same resolver the existing list
    // endpoint uses: sum of linked estimate-item prices per discipline.
    // Prv is special-cased — its final price is the provisionalAmount field
    // with no markup, not a sum of calculated line-items.
    const items = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId, status: { not: "excluded" } },
      select: { discipline: true, estimateItemId: true, provisionalAmount: true }
    });
    const estimateItemIds = items
      .filter((i) => i.discipline !== "Prv")
      .map((i) => i.estimateItemId)
      .filter((id): id is string => !!id);
    const priceByItemId = await this.computeEstimateItemPrices(estimateItemIds);
    const markup = await this.prisma.tenderEstimate
      .findUnique({ where: { tenderId }, select: { markup: true } })
      .then((e) => (e ? Number(e.markup) : 30));

    const perDiscipline: Record<string, { itemCount: number; subtotal: number; withMarkup: number }> = {};
    for (const d of DISCIPLINES) perDiscipline[d] = { itemCount: 0, subtotal: 0, withMarkup: 0 };
    for (const item of items) {
      const bucket = perDiscipline[item.discipline];
      if (!bucket) continue;
      bucket.itemCount += 1;
      if (item.discipline === "Prv") {
        bucket.subtotal += item.provisionalAmount ? Number(item.provisionalAmount) : 0;
      } else if (item.estimateItemId) {
        bucket.subtotal += priceByItemId.get(item.estimateItemId) ?? 0;
      }
    }
    // Markup applies to cost-based disciplines only. Prv is a fixed
    // provisional sum by definition.
    for (const d of DISCIPLINES) {
      perDiscipline[d].withMarkup =
        d === "Prv" ? perDiscipline[d].subtotal : perDiscipline[d].subtotal * (1 + markup / 100);
    }

    const cuttingItems = await this.prisma.cuttingSheetItem.findMany({
      where: { tenderId },
      select: { lineTotal: true }
    });
    const cuttingSubtotal = cuttingItems.reduce(
      (sum, ci) => sum + (ci.lineTotal ? Number(ci.lineTotal) : 0),
      0
    );
    const tenderPrice =
      Object.values(perDiscipline).reduce((s, v) => s + v.withMarkup, 0) + cuttingSubtotal;
    return {
      ...perDiscipline,
      cutting: { itemCount: cuttingItems.length, subtotal: Number(cuttingSubtotal.toFixed(2)) },
      tenderPrice: Number(tenderPrice.toFixed(2))
    };
  }

  // ── Private ──────────────────────────────────────────────────────────
  private async requireTender(tenderId: string) {
    const t = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!t) throw new NotFoundException("Tender not found.");
    return t;
  }

  private assertDiscipline(discipline: string) {
    if (!(DISCIPLINES as readonly string[]).includes(discipline)) {
      throw new BadRequestException(`Unknown discipline "${discipline}".`);
    }
  }

  private async pricedCuttingData(dto: {
    itemType: "saw-cut" | "core-hole";
    equipment?: string | null;
    elevation?: string | null;
    material?: string | null;
    depthMm?: number | null;
    diameterMm?: number | null;
    quantityLm?: number | null;
    quantityEach?: number | null;
    shiftLoading?: number | null;
    method?: string | null;
  }): Promise<{
    ratePerM: Prisma.Decimal | null;
    ratePerHole: Prisma.Decimal | null;
    lineTotal: Prisma.Decimal | null;
  }> {
    const shiftLoading = dto.shiftLoading !== undefined && dto.shiftLoading !== null ? Number(dto.shiftLoading) : 0;

    if (dto.itemType === "saw-cut") {
      if (!dto.equipment || !dto.depthMm) {
        return { ratePerM: null, ratePerHole: null, lineTotal: null };
      }
      const resolved = await resolveCuttingRate(this.prisma, {
        equipment: dto.equipment,
        elevation: dto.elevation ?? "Floor",
        material: dto.material ?? "Concrete",
        depthMm: dto.depthMm,
        method: dto.method ?? null
      });
      if (!resolved) return { ratePerM: null, ratePerHole: null, lineTotal: null };
      const qty = Number(dto.quantityLm ?? 0);
      const total = qty * resolved.finalRate + shiftLoading;
      return {
        ratePerM: new Prisma.Decimal(resolved.finalRate.toFixed(4)),
        ratePerHole: null,
        lineTotal: new Prisma.Decimal(total.toFixed(2))
      };
    }

    // core-hole: rate per 10mm depth × depth × qty × elevation × method + shift loading
    if (!dto.diameterMm) return { ratePerM: null, ratePerHole: null, lineTotal: null };
    const rate = await this.prisma.estimateCoreHoleRate.findUnique({ where: { diameterMm: dto.diameterMm } });
    if (!rate) return { ratePerM: null, ratePerHole: null, lineTotal: null };
    const depthMm = dto.depthMm && dto.depthMm > 0 ? dto.depthMm : 0;
    const depthUnits = depthMm / 10; // rate is $/hole per 10mm depth
    const qty = dto.quantityEach ?? 0;
    const elevationMultiplier = ELEVATION_MULTIPLIER[dto.elevation ?? "Floor"] ?? 1.0;
    const methodMultiplier = METHOD_MULTIPLIER[dto.method ?? ""] ?? 1.0;
    const total = Number(rate.ratePerHole) * depthUnits * qty * elevationMultiplier * methodMultiplier + shiftLoading;
    // ratePerHole stored as the base rate (per 10mm). Final-rate-inclusive
    // per-hole rate is surfaced to the UI via lineTotal/qty for display.
    const finalPerHoleRate = Number(rate.ratePerHole) * depthUnits * elevationMultiplier * methodMultiplier;
    return {
      ratePerM: null,
      ratePerHole: new Prisma.Decimal(finalPerHoleRate.toFixed(4)),
      lineTotal: new Prisma.Decimal(total.toFixed(2))
    };
  }

  private async computeEstimateItemPrices(itemIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (itemIds.length === 0) return map;
    const items = await this.prisma.estimateItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        labourLines: true,
        plantLines: true,
        equipLines: true,
        wasteLines: true,
        cuttingLines: true
      }
    });
    for (const item of items) {
      const labour = item.labourLines.reduce(
        (sum, l) => sum + Number(l.qty) * Number(l.days) * Number(l.rate),
        0
      );
      const plant = item.plantLines.reduce(
        (sum, l) => sum + Number(l.qty) * Number(l.days) * Number(l.rate),
        0
      );
      const equip = item.equipLines.reduce(
        (sum, l) => sum + Number(l.qty) * Number(l.duration) * Number(l.rate),
        0
      );
      const waste = item.wasteLines.reduce(
        (sum, l) => sum + Number(l.qtyTonnes) * Number(l.tonRate) + Number(l.loads) * Number(l.loadRate),
        0
      );
      const cutting = item.cuttingLines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0);
      // Per-item subtotal only — markup applied at the discipline summary
      // level so the grand total reflects tender-level markup.
      map.set(item.id, labour + plant + equip + waste + cutting);
    }
    return map;
  }
}
