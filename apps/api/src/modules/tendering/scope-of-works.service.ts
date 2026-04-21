import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateScopeItemDto,
  Discipline,
  DISCIPLINES,
  ReorderScopeItemsDto,
  ScopeStatus,
  UpdateScopeHeaderDto,
  UpdateScopeItemDto
} from "./dto/scope-of-works.dto";
import { assertRowTypeForDiscipline } from "./scope-redesign.service";

const DEFAULT_ROLE_BY_DISCIPLINE: Record<Discipline, string> = {
  SO: "Demolition labourer",
  Str: "Demolition labourer",
  Asb: "Asbestos labourer",
  Civ: "Machine operator",
  Prv: "Demolition labourer"
};

const DISCIPLINE_ORDER: Discipline[] = [...DISCIPLINES];

function toDecimal(value: number | null | undefined | Prisma.Decimal): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(value as number);
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
    wasteGroup: dto.wasteGroup
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
    const items = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId },
      orderBy: [{ discipline: "asc" }, { itemNumber: "asc" }, { sortOrder: "asc" }]
    });

    const sorted = items.slice().sort((a, b) => {
      const ai = DISCIPLINE_ORDER.indexOf(a.discipline as Discipline);
      const bi = DISCIPLINE_ORDER.indexOf(b.discipline as Discipline);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      if (a.itemNumber !== b.itemNumber) return a.itemNumber - b.itemNumber;
      return a.sortOrder - b.sortOrder;
    });

    // Linked estimate item totals (price by itemId).
    const estimateItemIds = sorted.map((s) => s.estimateItemId).filter((id): id is string => !!id);
    const priceByItemId = await this.computeEstimateItemPrices(estimateItemIds);

    const summaryByDiscipline = DISCIPLINE_ORDER.map((d) => {
      const group = sorted.filter((i) => i.discipline === d && i.status !== "excluded");
      const total = group.reduce(
        (sum, i) => sum + (i.estimateItemId ? Number(priceByItemId.get(i.estimateItemId) ?? 0) : 0),
        0
      );
      return { discipline: d, itemCount: group.length, totalValue: Number(total.toFixed(2)) };
    });

    return { items: sorted, summary: summaryByDiscipline };
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
    return this.prisma.scopeOfWorksItem.create({
      data: {
        tenderId,
        wbsCode,
        discipline,
        itemNumber,
        rowType: dto.rowType,
        description: dto.description,
        status: "confirmed",
        aiProposed: false,
        createdById: actorId,
        ...numericFieldsFrom(dto)
      }
    });
  }

  // ── Items: partial update (inline cell edits) ────────────────────────
  async updateItem(tenderId: string, itemId: string, dto: UpdateScopeItemDto, actorId: string) {
    if (dto.rowType) {
      const existing = await this.prisma.scopeOfWorksItem.findUnique({
        where: { id: itemId },
        select: { discipline: true, tenderId: true }
      });
      if (existing) assertRowTypeForDiscipline(existing.discipline as Discipline, dto.rowType);
    }
    const existing = await this.prisma.scopeOfWorksItem.findUnique({ where: { id: itemId } });
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
        ...numericFieldsFrom(dto)
      }
    });

    let estimateItem = null as Awaited<ReturnType<typeof this.createEstimateItemFromScope>> | null;
    if (prevStatus === "draft" && nextStatus === "confirmed") {
      estimateItem = await this.createEstimateItemFromScope(updated, tenderId, actorId);
    }
    return { scopeItem: estimateItem ? await this.prisma.scopeOfWorksItem.findUnique({ where: { id: itemId } }) : updated, estimateItem };
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
      data: { status: "confirmed" }
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
      orderBy: [{ discipline: "asc" }, { itemNumber: "asc" }]
    });
    const createdEstimates: Array<{ scopeItemId: string; estimateItemId: string }> = [];
    for (const draft of drafts) {
      const updated = await this.prisma.scopeOfWorksItem.update({
        where: { id: draft.id },
        data: { status: "confirmed" }
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
    scopeItem: Prisma.ScopeOfWorksItemGetPayload<Record<string, never>>,
    tenderId: string,
    _actorId: string
  ) {
    // Only confirmed rows should map into the estimate.
    if (scopeItem.status !== "confirmed") return null;
    const discipline = scopeItem.discipline as Discipline;

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
        isProvisional: discipline === "Prv"
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
      where: { tenderId, discipline }
    });
    return count + 1;
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
    const created: Array<Awaited<ReturnType<typeof this.prisma.scopeOfWorksItem.create>>> = [];
    for (const proposal of items) {
      const discipline = DISCIPLINE_ORDER.includes(proposal.code) ? proposal.code : ("SO" as Discipline);
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

      const record = await this.prisma.scopeOfWorksItem.create({
        data: {
          tenderId,
          wbsCode,
          discipline,
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
  if (discipline === "Asb") return "asbestos";
  if (discipline === "Civ") return "excavation";
  if (title.includes("saw") || title.includes("cut") || title.includes("core")) return "cutting";
  if ((proposal.estimatedWasteTonnes?.length ?? 0) > 0 && title.includes("dispos")) return "waste";
  if (discipline === "SO" || discipline === "Str") return "demolition";
  return "general";
}
