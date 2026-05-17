import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateScopeItemDto,
  CreateScopeItemInCardDto,
  Discipline,
  ReorderScopeItemsDto,
  ScopeStatus,
  UpdateScopeHeaderDto,
  UpdateScopeItemDto
} from "./dto/scope-of-works.dto";
import { assertRowTypeForDiscipline } from "./scope-redesign.service";
import { getScopeCardDefault } from "./scope/card-defaults";
import {
  buildRateMaps,
  computeScopeItemTotal,
  DEFAULT_ROLE_BY_DISCIPLINE,
  DISCIPLINE_ORDER,
  toPricingInput
} from "./scope-item-pricing";
import { computeDerivedDimensions } from "./scope-item-dimensions";

// PR B4a.1 — defensive type narrowing for the Prisma.Decimal constructor.
// CodeQL flagged the previous `value as number` cast as a "type confusion
// through parameter tampering" sink (HTTP request parameter could in
// theory be an array or string despite class-validator's runtime guard).
// Accept `unknown` and explicitly narrow: numbers + finite-numeric strings
// pass; arrays, objects, NaN, Infinity, and non-numeric strings return
// null. Exported for direct testing.
export function toDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return new Prisma.Decimal(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    // Pass the trimmed string (not the parsed number) so Prisma.Decimal
    // preserves the source precision verbatim where it can.
    return new Prisma.Decimal(trimmed);
  }
  return null;
}

function numericFieldsFrom(dto: Partial<UpdateScopeItemDto & CreateScopeItemDto>) {
  return {
    men: dto.men !== undefined ? toDecimal(dto.men) : undefined,
    days: dto.days !== undefined ? toDecimal(dto.days) : undefined,
    shift: dto.shift,
    sqm: dto.sqm !== undefined ? toDecimal(dto.sqm) : undefined,
    m3: dto.m3 !== undefined ? toDecimal(dto.m3) : undefined,
    materialType: dto.materialType,
    cuttingEquipment: dto.cuttingEquipment,
    elevation: dto.elevation,
    depthMm: dto.depthMm,
    lm: dto.lm !== undefined ? toDecimal(dto.lm) : undefined,
    coreHoleDiameterMm: dto.coreHoleDiameterMm,
    coreHoleQty: dto.coreHoleQty !== undefined ? toDecimal(dto.coreHoleQty) : undefined,
    acmType: dto.acmType,
    acmMaterial: dto.acmMaterial,
    enclosureRequired: dto.enclosureRequired,
    airMonitoring: dto.airMonitoring,
    excavationDepthM: dto.excavationDepthM !== undefined ? toDecimal(dto.excavationDepthM) : undefined,
    excavationMaterial: dto.excavationMaterial,
    machineSize: dto.machineSize,
    wasteType: dto.wasteType,
    wasteFacility: dto.wasteFacility,
    wasteTonnes: dto.wasteTonnes !== undefined ? toDecimal(dto.wasteTonnes) : undefined,
    wasteLoads: dto.wasteLoads,
    wasteM3: dto.wasteM3 !== undefined ? toDecimal(dto.wasteM3) : undefined,
    excavatorDays: dto.excavatorDays !== undefined ? toDecimal(dto.excavatorDays) : undefined,
    bobcatDays: dto.bobcatDays !== undefined ? toDecimal(dto.bobcatDays) : undefined,
    ewpDays: dto.ewpDays !== undefined ? toDecimal(dto.ewpDays) : undefined,
    hookTruckDays: dto.hookTruckDays !== undefined ? toDecimal(dto.hookTruckDays) : undefined,
    semiTipperDays: dto.semiTipperDays !== undefined ? toDecimal(dto.semiTipperDays) : undefined,
    assetId: dto.assetId,
    notes: dto.notes,
    // Redesign additions.
    measurementQty: dto.measurementQty !== undefined ? toDecimal(dto.measurementQty) : undefined,
    measurementUnit: dto.measurementUnit,
    material: dto.material,
    plantAssetId: dto.plantAssetId,
    wasteGroup: dto.wasteGroup,
    provisionalAmount:
      dto.provisionalAmount !== undefined ? toDecimal(dto.provisionalAmount) : undefined,
    // Scope redesign v2 (PR #71). plantItems + measurements stored as
    // JSONB arrays. We pass through the DTO value directly; shape is
    // enforced by the class-validator shape hints in the DTO file.
    plantItems:
      dto.plantItems !== undefined ? (dto.plantItems as unknown as Prisma.InputJsonValue) : undefined,
    measurements:
      dto.measurements !== undefined ? (dto.measurements as unknown as Prisma.InputJsonValue) : undefined,
    // PR B1.6 — canonical items table columns. wasteItem completes the
    // group/item pair; wasteIncluded flags this row for the waste
    // aggregator.
    // @deprecated PR B4a — unit + value no longer drive the waste
    // aggregator (superseded by tonnes/m3 dimension fields below).
    unit: dto.unit,
    value: dto.value !== undefined ? toDecimal(dto.value) : undefined,
    wasteItem: dto.wasteItem,
    wasteIncluded: dto.wasteIncluded,
    // PR B4a — dimension fields. sqm/m3/tonnes are derived server-side
    // in createItem/updateItem via computeDerivedDimensions; raw inputs
    // (length/height/depth/density/chargeBy/cuttingIncluded) pass
    // through here.
    length: dto.length !== undefined ? toDecimal(dto.length) : undefined,
    height: dto.height !== undefined ? toDecimal(dto.height) : undefined,
    depth: dto.depth !== undefined ? toDecimal(dto.depth) : undefined,
    density: dto.density !== undefined ? toDecimal(dto.density) : undefined,
    tonnes: dto.tonnes !== undefined ? toDecimal(dto.tonnes) : undefined,
    chargeBy: dto.chargeBy,
    cuttingIncluded: dto.cuttingIncluded
  };
}

// PR B4a — fold computeDerivedDimensions into the persisted record.
//
// The DB can't tell a derived sqm from a user-typed override, so:
//   - Raw fields (length/height/depth/density) fall back to the existing
//     row when the DTO didn't supply them — they have a single stored
//     meaning (the raw input).
//   - Override fields (sqm/m3/tonnes) only count as overrides when the
//     DTO actually sent them. If the DTO didn't touch them, treat as
//     "no override, derive from raw" — preventing stale derivations
//     from freezing the value across partial patches.
//
// The frontend's controlled-input model is expected to send the full
// dimension picture on any edit; this fallback is purely defensive.
function deriveDimensionFields(
  base: ReturnType<typeof numericFieldsFrom>,
  existing?: {
    length?: Prisma.Decimal | null;
    height?: Prisma.Decimal | null;
    depth?: Prisma.Decimal | null;
    density?: Prisma.Decimal | null;
  } | null
): ReturnType<typeof numericFieldsFrom> {
  const dec = (v: Prisma.Decimal | null | undefined): number | null =>
    v === null || v === undefined ? null : Number(v);

  // Raw inputs: DTO patch wins, else existing row, else null.
  const length = base.length !== undefined ? dec(base.length as Prisma.Decimal | null) : dec(existing?.length ?? null);
  const height = base.height !== undefined ? dec(base.height as Prisma.Decimal | null) : dec(existing?.height ?? null);
  const depth = base.depth !== undefined ? dec(base.depth as Prisma.Decimal | null) : dec(existing?.depth ?? null);
  const density = base.density !== undefined ? dec(base.density as Prisma.Decimal | null) : dec(existing?.density ?? null);

  // Overrides: only honoured when the DTO sent them. Undefined → null
  // (derive). Null → null (user cleared, derive). Number → override.
  const sqmOverride = base.sqm !== undefined ? dec(base.sqm as Prisma.Decimal | null) : null;
  const m3Override = base.m3 !== undefined ? dec(base.m3 as Prisma.Decimal | null) : null;
  const tonnesOverride = base.tonnes !== undefined ? dec(base.tonnes as Prisma.Decimal | null) : null;

  const derived = computeDerivedDimensions({
    length,
    height,
    depth,
    density,
    sqm: sqmOverride,
    m3: m3Override,
    tonnes: tonnesOverride
  });
  return {
    ...base,
    sqm: toDecimal(derived.sqm),
    m3: toDecimal(derived.m3),
    tonnes: toDecimal(derived.tonnes)
  };
}

@Injectable()
export class ScopeOfWorksService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Header ────────────────────────────────────────────────────────────
  async getHeader(tenderId: string) {
    await this.requireTender(tenderId);
    const existing = await this.prisma.scopeOfWorksHeader.findUnique({ where: { tenderId } });
    if (existing) return existing;
    return this.prisma.scopeOfWorksHeader.create({
      data: { tenderId }
    });
  }

  async updateHeader(tenderId: string, dto: UpdateScopeHeaderDto) {
    await this.requireTender(tenderId);
    const existing = await this.prisma.scopeOfWorksHeader.findUnique({ where: { tenderId } });
    const data = {
      siteAddress: dto.siteAddress,
      siteContactName: dto.siteContactName,
      siteContactPhone: dto.siteContactPhone,
      accessConstraints: dto.accessConstraints,
      proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : null,
      durationWeeks: dto.durationWeeks,
      specialConditions: dto.specialConditions
    };
    if (existing) {
      return this.prisma.scopeOfWorksHeader.update({
        where: { tenderId },
        data
      });
    }
    return this.prisma.scopeOfWorksHeader.create({ data: { tenderId, ...data } });
  }

  // ── Items: list ───────────────────────────────────────────────────────
  async listItems(tenderId: string) {
    await this.requireTender(tenderId);
    // PR A2.5 — card.discipline is now authoritative. Include the card on
    // every read that needs to filter/order/group by discipline.
    const items = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId },
      orderBy: [{ card: { discipline: "asc" } }, { itemNumber: "asc" }, { sortOrder: "asc" }],
      include: { card: true }
    });

    const sorted = items.slice().sort((a, b) => {
      const ai = DISCIPLINE_ORDER.indexOf((a.card?.discipline ?? "Other") as Discipline);
      const bi = DISCIPLINE_ORDER.indexOf((b.card?.discipline ?? "Other") as Discipline);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      if (a.itemNumber !== b.itemNumber) return a.itemNumber - b.itemNumber;
      return a.sortOrder - b.sortOrder;
    });

    // PR B1.7.1 — batch-fetch the three rate cards + the tender markup
    // and compute a per-row total from canonical fields. Replaces the
    // legacy priceByItemId path which only worked for rows that had
    // been explicitly confirmed into an EstimateItem (canonical B1.6
    // rows never were, so they always contributed $0). See
    // scope-item-pricing.ts for the pure formula.
    // PR B1.7.2 — waste rate card no longer fetched here. Waste $ is
    // computed on the dedicated waste summary subtable (B3).
    // PR B2 — markup resolves per-card: effective = card.markupOverride
    // ?? tenderEstimate.markup ?? 30. card relation already included
    // above so no extra query.
    const [labourRates, plantRates, tenderEstimate] = await Promise.all([
      this.prisma.estimateLabourRate.findMany({ where: { isActive: true } }),
      this.prisma.estimatePlantRate.findMany({ where: { isActive: true } }),
      this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } })
    ]);
    const rateMaps = buildRateMaps(labourRates, plantRates);
    const tenderMarkup = tenderEstimate ? Number(tenderEstimate.markup) : 30;

    const itemsWithTotals = sorted.map((item) => {
      const discipline = (item.card?.discipline ?? "Other") as Discipline;
      const effectiveMarkup =
        item.card?.markupOverride != null ? Number(item.card.markupOverride) : tenderMarkup;
      const totals = computeScopeItemTotal(toPricingInput(item, discipline), rateMaps, effectiveMarkup);
      return {
        ...item,
        lineTotal: totals.lineTotal,
        lineTotalWithMarkup: totals.lineTotalWithMarkup
      };
    });

    const summaryByDiscipline = DISCIPLINE_ORDER.map((d) => {
      const group = itemsWithTotals.filter((i) => i.card?.discipline === d && i.status !== "excluded");
      const total = group.reduce((sum, i) => sum + i.lineTotal, 0);
      return { discipline: d, itemCount: group.length, totalValue: Number(total.toFixed(2)) };
    });

    return { items: itemsWithTotals, summary: summaryByDiscipline };
  }

  // ── Items: create manual row ──────────────────────────────────────────
  async createItem(tenderId: string, dto: CreateScopeItemDto, actorId: string) {
    await this.requireTender(tenderId);
    const discipline = dto.discipline;
    if (!DISCIPLINE_ORDER.includes(discipline)) {
      throw new BadRequestException(`Unknown discipline "${discipline}".`);
    }
    assertRowTypeForDiscipline(discipline, dto.rowType);
    const itemNumber = await this.nextItemNumber(tenderId, discipline);
    // Honour an incoming wbsCode only if it's a clean flat code for this
    // discipline (e.g. "SO3"); otherwise auto-assign. This prevents the
    // frontend from ever submitting sub-level codes like "SO1.1".
    const providedWbs = dto.wbsCode?.trim();
    const flatPattern = new RegExp(`^${discipline}\\d+$`);
    const wbsCode = providedWbs && flatPattern.test(providedWbs) ? providedWbs : `${discipline}${itemNumber}`;
    const cardId = await this.getOrCreateCardForDiscipline(tenderId, discipline, actorId);
    return this.prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId,
        wbsCode,
        itemNumber,
        rowType: dto.rowType,
        description: dto.description,
        status: "confirmed",
        aiProposed: false,
        createdById: actorId,
        ...deriveDimensionFields(numericFieldsFrom(dto))
      }
    });
  }

  // ── Items: partial update (inline cell edits) ────────────────────────
  async updateItem(tenderId: string, itemId: string, dto: UpdateScopeItemDto, actorId: string) {
    if (dto.rowType) {
      const existing = await this.prisma.scopeOfWorksItem.findUnique({
        where: { id: itemId },
        select: { tenderId: true, card: { select: { discipline: true } } }
      });
      if (existing?.card) assertRowTypeForDiscipline(existing.card.discipline as Discipline, dto.rowType);
    }
    const existing = await this.prisma.scopeOfWorksItem.findUnique({
      where: { id: itemId },
      include: { card: true }
    });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Scope item not found.");
    }

    const prevStatus = existing.status;
    const nextStatus = dto.status ?? prevStatus;

    const updated = await this.prisma.scopeOfWorksItem.update({
      where: { id: itemId },
      data: {
        description: dto.description,
        rowType: dto.rowType,
        status: dto.status,
        sortOrder: dto.sortOrder,
        ...deriveDimensionFields(numericFieldsFrom(dto), existing)
      },
      include: { card: true }
    });

    let estimateItem: Awaited<ReturnType<ScopeOfWorksService["createEstimateItemFromScope"]>> | null = null;
    if (prevStatus === "draft" && nextStatus === "confirmed") {
      estimateItem = await this.createEstimateItemFromScope(updated, tenderId, actorId);
    }
    return { scopeItem: estimateItem ? await this.prisma.scopeOfWorksItem.findUnique({ where: { id: itemId }, include: { card: true } }) : updated, estimateItem };
  }

  async deleteItem(tenderId: string, itemId: string) {
    const existing = await this.prisma.scopeOfWorksItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Scope item not found.");
    }
    await this.prisma.scopeOfWorksItem.delete({ where: { id: itemId } });
    return {
      deleted: true,
      warning: existing.estimateItemId
        ? "This item had an associated estimate line. The estimate line was NOT removed — open the Estimate tab if you also want to delete it."
        : null
    };
  }

  async reorder(tenderId: string, dto: ReorderScopeItemsDto) {
    await this.requireTender(tenderId);
    if (dto.order.length === 0) return { updated: 0 };
    const ids = dto.order.map((o) => o.itemId);
    const existing = await this.prisma.scopeOfWorksItem.findMany({
      where: { id: { in: ids }, tenderId },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((e) => e.id));
    const invalid = ids.filter((id) => !existingIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException({ message: "Some item IDs are not on this tender.", invalid });
    }
    await this.prisma.$transaction(
      dto.order.map((o) =>
        this.prisma.scopeOfWorksItem.update({
          where: { id: o.itemId },
          data: { sortOrder: o.sortOrder }
        })
      )
    );
    return { updated: dto.order.length };
  }

  async confirmItem(tenderId: string, itemId: string, actorId: string) {
    const existing = await this.prisma.scopeOfWorksItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Scope item not found.");
    }
    if (existing.status === "confirmed") {
      return { scopeItem: existing, estimateItem: null };
    }
    const updated = await this.prisma.scopeOfWorksItem.update({
      where: { id: itemId },
      data: { status: "confirmed" },
      include: { card: true }
    });
    const estimateItem = await this.createEstimateItemFromScope(updated, tenderId, actorId);
    const reloaded = await this.prisma.scopeOfWorksItem.findUnique({ where: { id: itemId } });
    return { scopeItem: reloaded, estimateItem };
  }

  async excludeItem(tenderId: string, itemId: string) {
    const existing = await this.prisma.scopeOfWorksItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Scope item not found.");
    }
    return this.prisma.scopeOfWorksItem.update({
      where: { id: itemId },
      data: { status: "excluded" }
    });
  }

  async confirmAllDrafts(tenderId: string, actorId: string) {
    await this.requireTender(tenderId);
    const drafts = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId, status: "draft" },
      orderBy: [{ card: { discipline: "asc" } }, { itemNumber: "asc" }]
    });
    const createdEstimates: Array<{ scopeItemId: string; estimateItemId: string }> = [];
    for (const draft of drafts) {
      const updated = await this.prisma.scopeOfWorksItem.update({
        where: { id: draft.id },
        data: { status: "confirmed" },
        include: { card: true }
      });
      const estimateItem = await this.createEstimateItemFromScope(updated, tenderId, actorId);
      if (estimateItem) {
        createdEstimates.push({ scopeItemId: draft.id, estimateItemId: estimateItem.id });
      }
    }
    return { confirmed: drafts.length, estimates: createdEstimates };
  }

  // ── Estimate item auto-create ────────────────────────────────────────
  async createEstimateItemFromScope(
    scopeItem: Prisma.ScopeOfWorksItemGetPayload<{ include: { card: true } }>,
    tenderId: string,
    _actorId: string
  ) {
    // Only confirmed rows should map into the estimate.
    if (scopeItem.status !== "confirmed") return null;
    const discipline = (scopeItem.card?.discipline ?? "Other") as Discipline;

    // 1. Find or create the TenderEstimate for this tender.
    let estimate = await this.prisma.tenderEstimate.findUnique({ where: { tenderId } });
    if (!estimate) {
      estimate = await this.prisma.tenderEstimate.create({
        data: { tenderId, markup: new Prisma.Decimal("30") }
      });
    }
    if (estimate.lockedAt) {
      // Don't throw — just return null so the confirmation still succeeds.
      return null;
    }

    // 2. Next itemNumber for this code within the estimate.
    const itemNumber =
      (await this.prisma.estimateItem.count({
        where: { estimateId: estimate.id, code: discipline }
      })) + 1;

    // 3. Create the estimate item.
    const item = await this.prisma.estimateItem.create({
      data: {
        estimateId: estimate.id,
        code: discipline,
        itemNumber,
        title: scopeItem.description.length > 60 ? scopeItem.description.slice(0, 60) : scopeItem.description,
        description: scopeItem.notes ? `${scopeItem.description}\n\n${scopeItem.notes}` : scopeItem.description,
        markup: new Prisma.Decimal("30"),
        isProvisional: discipline === "Other"
      }
    });

    // 4. Labour line — if men + days were supplied.
    if (scopeItem.men && Number(scopeItem.men) > 0 && scopeItem.days && Number(scopeItem.days) > 0) {
      const role = DEFAULT_ROLE_BY_DISCIPLINE[discipline];
      const rate = await this.prisma.estimateLabourRate.findUnique({ where: { role } });
      const shift = scopeItem.shift ?? "Day";
      const dayRate = rate
        ? shift === "Night"
          ? Number(rate.nightRate)
          : shift === "Weekend"
            ? Number(rate.weekendRate)
            : Number(rate.dayRate)
        : 0;
      await this.prisma.estimateLabourLine.create({
        data: {
          itemId: item.id,
          role,
          qty: toDecimal(Number(scopeItem.men)) ?? new Prisma.Decimal(0),
          days: toDecimal(Number(scopeItem.days)) ?? new Prisma.Decimal(0),
          shift,
          rate: new Prisma.Decimal(dayRate)
        }
      });
    }

    // 5. Plant lines.
    await this.addPlantLineIfSet(item.id, "Excavator 16T-25T (wet hire)", scopeItem.excavatorDays, 0);
    await this.addPlantLineIfSet(item.id, "Bobcat", scopeItem.bobcatDays, 1);
    await this.addPlantLineIfSet(item.id, "EWP", scopeItem.ewpDays, 2);
    await this.addPlantLineIfSet(item.id, "Hook truck", scopeItem.hookTruckDays, 3);
    await this.addPlantLineIfSet(item.id, "Semi tipper", scopeItem.semiTipperDays, 4);

    // 6. Cutting line — if lm + equipment set.
    if (scopeItem.lm && Number(scopeItem.lm) > 0 && scopeItem.cuttingEquipment) {
      const equipment = scopeItem.cuttingEquipment;
      const elevation = scopeItem.elevation ?? "Floor";
      const material = scopeItem.materialType ?? "Concrete";
      const depthMm = scopeItem.depthMm ?? 150;
      const rate = await this.prisma.estimateCuttingRate.findFirst({
        where: { equipment, elevation, material, depthMm: { lte: depthMm }, isActive: true },
        orderBy: { depthMm: "desc" }
      });
      await this.prisma.estimateCuttingLine.create({
        data: {
          itemId: item.id,
          cuttingType: "Saw cut",
          equipment,
          elevation,
          material,
          depthMm,
          qty: toDecimal(Number(scopeItem.lm)) ?? new Prisma.Decimal(0),
          unit: "lm",
          rate: rate ? new Prisma.Decimal(rate.ratePerM) : new Prisma.Decimal(0)
        }
      });
    }

    // 7. Core hole line — if diameter + qty set.
    if (
      scopeItem.coreHoleQty &&
      Number(scopeItem.coreHoleQty) > 0 &&
      scopeItem.coreHoleDiameterMm &&
      scopeItem.coreHoleDiameterMm > 0
    ) {
      const diameterMm = scopeItem.coreHoleDiameterMm;
      const rate = await this.prisma.estimateCoreHoleRate.findUnique({ where: { diameterMm } });
      await this.prisma.estimateCuttingLine.create({
        data: {
          itemId: item.id,
          cuttingType: "Core hole",
          diameterMm,
          qty: toDecimal(Number(scopeItem.coreHoleQty)) ?? new Prisma.Decimal(0),
          unit: "each",
          rate: rate ? new Prisma.Decimal(rate.ratePerHole) : new Prisma.Decimal(0)
        }
      });
    }

    // 8. Waste line — if tonnes + type set.
    if (scopeItem.wasteTonnes && Number(scopeItem.wasteTonnes) > 0 && scopeItem.wasteType) {
      const wasteType = scopeItem.wasteType;
      const facility = scopeItem.wasteFacility ?? "";
      const rate = facility
        ? await this.prisma.estimateWasteRate.findUnique({ where: { wasteType_facility: { wasteType, facility } } })
        : await this.prisma.estimateWasteRate.findFirst({ where: { wasteType, isActive: true } });
      await this.prisma.estimateWasteLine.create({
        data: {
          itemId: item.id,
          wasteType,
          facility: rate?.facility ?? facility,
          qtyTonnes: toDecimal(Number(scopeItem.wasteTonnes)) ?? new Prisma.Decimal(0),
          tonRate: rate ? new Prisma.Decimal(rate.tonRate) : new Prisma.Decimal(0),
          loads: scopeItem.wasteLoads ?? 0,
          loadRate: rate ? new Prisma.Decimal(rate.loadRate) : new Prisma.Decimal(0)
        }
      });
    }

    // 9. Link scope item → estimate item.
    await this.prisma.scopeOfWorksItem.update({
      where: { id: scopeItem.id },
      data: { estimateItemId: item.id }
    });

    return item;
  }

  // ── Private helpers ──────────────────────────────────────────────────
  private async addPlantLineIfSet(
    itemId: string,
    plantItem: string,
    days: Prisma.Decimal | null,
    sortOrder: number
  ) {
    if (!days || Number(days) <= 0) return;
    const rate = await this.prisma.estimatePlantRate.findUnique({ where: { item: plantItem } });
    await this.prisma.estimatePlantLine.create({
      data: {
        itemId,
        plantItem,
        qty: new Prisma.Decimal(1),
        days: new Prisma.Decimal(Number(days)),
        rate: rate ? new Prisma.Decimal(rate.rate) : new Prisma.Decimal(0),
        sortOrder
      }
    });
  }

  private async requireTender(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!tender) throw new NotFoundException("Tender not found.");
    return tender;
  }

  private async nextItemNumber(tenderId: string, discipline: Discipline): Promise<number> {
    const count = await this.prisma.scopeOfWorksItem.count({
      where: { tenderId, card: { discipline } }
    });
    return count + 1;
  }

  /**
   * PR A2.5 — every ScopeOfWorksItem must be linked to a ScopeCard.
   * Look up the FIRST card for (tenderId, discipline); create it on
   * demand with defaults if absent. Idempotent for the discipline-derived
   * legacy flows (proposals.acceptProposal, createItem).
   *
   * PR B1 — if a discipline has multiple cards, this returns the lowest
   * cardNumber. Callers that need a SPECIFIC card use the new
   * createItemInCard / listCards / etc. methods.
   */
  private async getOrCreateCardForDiscipline(
    tenderId: string,
    discipline: Discipline,
    actorId: string
  ): Promise<string> {
    const existing = await this.prisma.scopeCard.findFirst({
      where: { tenderId, discipline },
      orderBy: { cardNumber: "asc" },
      select: { id: true }
    });
    if (existing) return existing.id;
    const defaults = getScopeCardDefault(discipline);
    const created = await this.prisma.scopeCard.create({
      data: {
        tenderId,
        name: defaults.name,
        discipline,
        cardNumber: defaults.cardNumber,
        sortOrder: defaults.sortOrder,
        createdById: actorId
      },
      select: { id: true }
    });
    return created.id;
  }

  // ──────────────────────────────────────────────────────────────────────
  // PR B1 — card-CRUD service methods
  // ──────────────────────────────────────────────────────────────────────

  /**
   * List all cards for a tender with item counts. Drives the cards-as-tabs
   * UI; ordered by sortOrder (user-controlled via reorderCards).
   */
  async listCards(tenderId: string) {
    await this.requireTender(tenderId);
    const cards = await this.prisma.scopeCard.findMany({
      where: { tenderId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { scopeItems: true } } }
    });
    return cards.map((c) => ({
      id: c.id,
      tenderId: c.tenderId,
      name: c.name,
      discipline: c.discipline,
      cardNumber: c.cardNumber,
      plantColumnCount: c.plantColumnCount,
      cuttingNotes: c.cuttingNotes,
      wasteNotes: c.wasteNotes,
      markupOverride: c.markupOverride !== null ? Number(c.markupOverride) : null,
      sortOrder: c.sortOrder,
      itemCount: c._count.scopeItems,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
  }

  /**
   * Create a new card. cardNumber auto-assigned as MAX(cardNumber)+1 in
   * (tenderId, discipline). Never reuses freed numbers. sortOrder lands
   * the new card at the end of the tab row.
   */
  async createCard(
    tenderId: string,
    actorId: string,
    dto: { name: string; discipline: Discipline }
  ) {
    await this.requireTender(tenderId);
    const maxCard = await this.prisma.scopeCard.aggregate({
      where: { tenderId, discipline: dto.discipline },
      _max: { cardNumber: true }
    });
    const cardNumber = (maxCard._max.cardNumber ?? 0) + 1;
    const maxSort = await this.prisma.scopeCard.aggregate({
      where: { tenderId },
      _max: { sortOrder: true }
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    return this.prisma.scopeCard.create({
      data: {
        tenderId,
        name: dto.name.trim().slice(0, 200),
        discipline: dto.discipline,
        cardNumber,
        sortOrder,
        createdById: actorId
      }
    });
  }

  /**
   * PR B1.6 — Set plant column count for a card. Minimum 1 (Plant 1 is
   * always visible). Frontend is responsible for confirming with the user
   * before shrinking past columns that have data populated.
   */
  async setPlantColumnCount(tenderId: string, cardId: string, plantColumnCount: number) {
    await this.requireTender(tenderId);
    if (plantColumnCount < 1) {
      throw new BadRequestException("plantColumnCount must be at least 1 (Plant 1 is always visible).");
    }
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId }
    });
    if (!card) throw new NotFoundException("Card not found.");
    return this.prisma.scopeCard.update({
      where: { id: cardId },
      data: { plantColumnCount }
    });
  }

  /**
   * PR B1.7 — Set the shared cutting/waste notes blocks for a card.
   * Either field can be omitted (left unchanged) or set to null/empty
   * to clear. Returns the updated card.
   */
  async setCardNotes(
    tenderId: string,
    cardId: string,
    patch: { cuttingNotes?: string | null; wasteNotes?: string | null }
  ) {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({ where: { id: cardId, tenderId } });
    if (!card) throw new NotFoundException("Card not found.");
    const data: { cuttingNotes?: string | null; wasteNotes?: string | null } = {};
    if (patch.cuttingNotes !== undefined) data.cuttingNotes = patch.cuttingNotes || null;
    if (patch.wasteNotes !== undefined) data.wasteNotes = patch.wasteNotes || null;
    return this.prisma.scopeCard.update({ where: { id: cardId }, data });
  }

  /**
   * PR B2 — Set the per-card markup override. Pass null to clear the
   * override (card then inherits TenderEstimate.markup). Frontend
   * validates 0-100; the DTO @Min(0) blocks negatives but technically
   * accepts >100 — that's caller responsibility.
   */
  async setCardMarkupOverride(tenderId: string, cardId: string, markupOverride: number | null) {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({ where: { id: cardId, tenderId } });
    if (!card) throw new NotFoundException("Card not found.");
    return this.prisma.scopeCard.update({
      where: { id: cardId },
      data: {
        markupOverride: markupOverride == null ? null : new Prisma.Decimal(markupOverride)
      }
    });
  }

  /**
   * PR B2 — Reset every card in this tender back to "inherit tender
   * markup" (markupOverride = null). Returns the count of cards
   * actually affected (Prisma's updateMany count includes rows that
   * were already null).
   */
  async resetAllCardMarkup(tenderId: string) {
    await this.requireTender(tenderId);
    const result = await this.prisma.scopeCard.updateMany({
      where: { tenderId, markupOverride: { not: null } },
      data: { markupOverride: null }
    });
    return { cardsReset: result.count };
  }

  /**
   * Rename card. cardNumber + discipline preserved.
   */
  async renameCard(tenderId: string, cardId: string, name: string) {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId }
    });
    if (!card) throw new NotFoundException("Card not found.");
    return this.prisma.scopeCard.update({
      where: { id: cardId },
      data: { name: name.trim().slice(0, 200) }
    });
  }

  /**
   * Change card discipline. Cascades:
   *   - cardNumber re-issued (next available in NEW discipline)
   *   - wbsCode rewritten on every item in card
   *   - wbsRef updated on cutting and waste rows referencing those items
   * Idempotent for same-discipline calls (returns zero renumbered).
   */
  async changeCardDiscipline(
    tenderId: string,
    cardId: string,
    newDiscipline: Discipline
  ) {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId },
      include: { scopeItems: { orderBy: { itemNumber: "asc" } } }
    });
    if (!card) throw new NotFoundException("Card not found.");
    if (card.discipline === newDiscipline) {
      return { card, itemsRenumbered: 0, cuttingRefsUpdated: 0, wasteRefsUpdated: 0 };
    }

    const max = await this.prisma.scopeCard.aggregate({
      where: { tenderId, discipline: newDiscipline },
      _max: { cardNumber: true }
    });
    const newCardNumber = (max._max.cardNumber ?? 0) + 1;
    const newPrefix = `${newDiscipline}${newCardNumber}`;

    return this.prisma.$transaction(async (tx) => {
      const updatedCard = await tx.scopeCard.update({
        where: { id: cardId },
        data: { discipline: newDiscipline, cardNumber: newCardNumber }
      });

      const refMap: Array<{ oldCode: string; newCode: string }> = [];
      for (const item of card.scopeItems) {
        const newCode = `${newPrefix}.${item.itemNumber}`;
        refMap.push({ oldCode: item.wbsCode, newCode });
        await tx.scopeOfWorksItem.update({
          where: { id: item.id },
          data: { wbsCode: newCode }
        });
      }

      let cuttingRefsUpdated = 0;
      for (const { oldCode, newCode } of refMap) {
        const r = await tx.cuttingSheetItem.updateMany({
          where: { tenderId, wbsRef: oldCode },
          data: { wbsRef: newCode }
        });
        cuttingRefsUpdated += r.count;
      }

      let wasteRefsUpdated = 0;
      for (const { oldCode, newCode } of refMap) {
        const r = await tx.scopeWasteItem.updateMany({
          where: { tenderId, wbsRef: oldCode },
          data: { wbsRef: newCode }
        });
        wasteRefsUpdated += r.count;
      }

      return {
        card: updatedCard,
        itemsRenumbered: refMap.length,
        cuttingRefsUpdated,
        wasteRefsUpdated
      };
    });
  }

  /**
   * Delete card. Blocked when card has items (per Q3=A decision —
   * caller must move or delete items first).
   */
  async deleteCard(tenderId: string, cardId: string): Promise<void> {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId },
      select: { id: true }
    });
    if (!card) throw new NotFoundException("Card not found.");
    const itemCount = await this.prisma.scopeOfWorksItem.count({
      where: { cardId, tenderId }
    });
    if (itemCount > 0) {
      throw new ConflictException(
        `Cannot delete card with ${itemCount} item(s). Move or delete items first.`
      );
    }
    await this.prisma.scopeCard.delete({ where: { id: cardId } });
  }

  /**
   * Bulk-update card sortOrder. Used by drag-reorder on the tab row.
   * Each card gets sortOrder = its index in the cardIds array.
   */
  async reorderCards(tenderId: string, cardIds: string[]): Promise<void> {
    await this.requireTender(tenderId);
    const cards = await this.prisma.scopeCard.findMany({
      where: { tenderId },
      select: { id: true }
    });
    const validIds = new Set(cards.map((c) => c.id));
    for (const id of cardIds) {
      if (!validIds.has(id)) {
        throw new BadRequestException(`Card ${id} not found in tender.`);
      }
    }
    await this.prisma.$transaction(
      cardIds.map((id, index) =>
        this.prisma.scopeCard.update({ where: { id }, data: { sortOrder: index } })
      )
    );
  }

  /**
   * Card-scoped item creation. wbsCode = `${discipline}${cardNumber}.${itemNumber}`
   * with itemNumber per-card (NOT per-discipline as in legacy createItem).
   */
  async createItemInCard(
    tenderId: string,
    actorId: string,
    cardId: string,
    dto: CreateScopeItemInCardDto
  ) {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId },
      select: { id: true, discipline: true, cardNumber: true }
    });
    if (!card) throw new NotFoundException("Card not found.");
    const discipline = card.discipline as Discipline;
    // PR B1.7 — the canonical redesigned table no longer surfaces row
    // type. Default to "general-labour" so existing constraints continue
    // to pass; assertRowTypeForDiscipline still runs for safety in case
    // an older client sends an explicit value.
    const rowType = dto.rowType ?? "general-labour";
    assertRowTypeForDiscipline(discipline, rowType);

    const itemNumber = await this.nextItemNumberInCard(cardId);
    const wbsCode = `${discipline}${card.cardNumber}.${itemNumber}`;

    return this.prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        cardId,
        wbsCode,
        itemNumber,
        rowType,
        description: dto.description ?? "",
        status: "confirmed",
        aiProposed: false,
        createdById: actorId
      },
      include: { card: true }
    });
  }

  private async nextItemNumberInCard(cardId: string): Promise<number> {
    const max = await this.prisma.scopeOfWorksItem.aggregate({
      where: { cardId },
      _max: { itemNumber: true }
    });
    return (max._max.itemNumber ?? 0) + 1;
  }

  async createDraftItemsFromAi(
    tenderId: string,
    actorId: string,
    items: Array<{
      code: Discipline;
      title: string;
      description: string;
      confidence: "high" | "medium" | "low";
      sourceReference?: string;
      estimatedLabourDays?: number;
      estimatedLabourRole?: string;
      estimatedWasteTonnes?: Array<{ type: string; tonnes: number }>;
      estimatedPlantItems?: Array<{ item: string; days: number }>;
    }>
  ) {
    await this.requireTender(tenderId);
    const created: Array<Prisma.ScopeOfWorksItemGetPayload<{ include: { card: true } }>> = [];
    for (const proposal of items) {
      const discipline = DISCIPLINE_ORDER.includes(proposal.code) ? proposal.code : ("DEM" as Discipline);
      const itemNumber = await this.nextItemNumber(tenderId, discipline);
      const wbsCode = `${discipline}${itemNumber}`;

      const wasteTonnes = proposal.estimatedWasteTonnes?.[0]?.tonnes;
      const wasteType = proposal.estimatedWasteTonnes?.[0]?.type;

      let excavatorDays: number | undefined;
      let bobcatDays: number | undefined;
      let ewpDays: number | undefined;
      for (const p of proposal.estimatedPlantItems ?? []) {
        const item = p.item.toLowerCase();
        if (item.includes("excavator")) excavatorDays = (excavatorDays ?? 0) + p.days;
        else if (item.includes("bobcat")) bobcatDays = (bobcatDays ?? 0) + p.days;
        else if (item.includes("ewp") || item.includes("scissor")) ewpDays = (ewpDays ?? 0) + p.days;
      }

      const rowType = inferRowType(discipline, proposal);
      const cardId = await this.getOrCreateCardForDiscipline(tenderId, discipline, actorId);

      const record = await this.prisma.scopeOfWorksItem.create({
        include: { card: true },
        data: {
          tenderId,
          cardId,
          wbsCode,
          itemNumber,
          rowType,
          description: `${proposal.title}${proposal.description ? `\n${proposal.description}` : ""}`.trim().slice(0, 2000),
          status: "draft",
          aiProposed: true,
          aiConfidence: proposal.confidence,
          aiSourceRef: proposal.sourceReference ?? null,
          createdById: actorId,
          days: proposal.estimatedLabourDays ? new Prisma.Decimal(proposal.estimatedLabourDays) : null,
          wasteTonnes: wasteTonnes ? new Prisma.Decimal(wasteTonnes) : null,
          wasteType: wasteType ?? null,
          excavatorDays: excavatorDays ? new Prisma.Decimal(excavatorDays) : null,
          bobcatDays: bobcatDays ? new Prisma.Decimal(bobcatDays) : null,
          ewpDays: ewpDays ? new Prisma.Decimal(ewpDays) : null
        }
      });
      created.push(record);
    }
    return created;
  }

  /**
   * @deprecated PR B1.7.2 — legacy EstimateItem-based per-row pricing.
   * Canonical (B1.6+) rows never create EstimateItem so this path
   * silently returned $0 for them. listItems() now uses the pure
   * computeScopeItemTotal helper directly. Method kept for safety
   * until a separate cleanup PR confirms there are no callers.
   */
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
      const subtotal = labour + plant + equip + waste + cutting;
      const markup = subtotal * (Number(item.markup) / 100);
      map.set(item.id, subtotal + markup);
    }
    return map;
  }
}

function inferRowType(
  discipline: Discipline,
  proposal: { estimatedLabourRole?: string; estimatedWasteTonnes?: Array<{ type: string }>; title: string }
): ScopeStatus | "demolition" | "cutting" | "asbestos" | "excavation" | "waste" | "general" {
  const title = proposal.title.toLowerCase();
  if (discipline === "ASB") return "asbestos";
  if (discipline === "CIV") return "excavation";
  if (title.includes("saw") || title.includes("cut") || title.includes("core")) return "cutting";
  if ((proposal.estimatedWasteTonnes?.length ?? 0) > 0 && title.includes("dispos")) return "waste";
  if (discipline === "DEM") return "demolition";
  return "general";
}
