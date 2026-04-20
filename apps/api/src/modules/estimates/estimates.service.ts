import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  UpdateAssumptionDto,
  UpdateCuttingLineDto,
  UpdateEquipLineDto,
  UpdateEstimateDto,
  UpdateEstimateItemDto,
  UpdateLabourLineDto,
  UpdatePlantLineDto,
  UpdateWasteLineDto,
  UpsertAssumptionDto,
  UpsertCoreHoleRateDto,
  UpsertCuttingLineDto,
  UpsertCuttingRateDto,
  UpsertEnclosureRateDto,
  UpsertEquipLineDto,
  UpsertEstimateItemDto,
  UpsertFuelRateDto,
  UpsertLabourLineDto,
  UpsertLabourRateDto,
  UpsertPlantLineDto,
  UpsertPlantRateDto,
  UpsertWasteLineDto,
  UpsertWasteRateDto
} from "./dto/estimates.dto";

const estimateInclude = Prisma.validator<Prisma.TenderEstimateInclude>()({
  items: {
    orderBy: [{ code: "asc" }, { itemNumber: "asc" }, { sortOrder: "asc" }],
    include: {
      labourLines: { orderBy: { sortOrder: "asc" } },
      equipLines: { orderBy: { sortOrder: "asc" } },
      plantLines: { orderBy: { sortOrder: "asc" } },
      wasteLines: { orderBy: { sortOrder: "asc" } },
      cuttingLines: { orderBy: { sortOrder: "asc" } },
      assumptions: { orderBy: { sortOrder: "asc" } }
    }
  }
});

type EstimateWithItems = Prisma.TenderEstimateGetPayload<{ include: typeof estimateInclude }>;
type EstimateItemWithLines = EstimateWithItems["items"][number];

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  // ──────────────────────────────────────────────────────────────
  //  Rate library
  // ──────────────────────────────────────────────────────────────

  listLabourRates() {
    return this.prisma.estimateLabourRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { role: "asc" }]
    });
  }
  async upsertLabourRate(id: string | undefined, dto: UpsertLabourRateDto, actorId?: string) {
    const data = {
      role: dto.role,
      dayRate: new Prisma.Decimal(dto.dayRate),
      nightRate: new Prisma.Decimal(dto.nightRate),
      weekendRate: new Prisma.Decimal(dto.weekendRate),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    };
    const record = id
      ? await this.prisma.estimateLabourRate.update({ where: { id }, data })
      : await this.prisma.estimateLabourRate.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.labourRate.update" : "estimates.labourRate.create",
      entityType: "EstimateLabourRate",
      entityId: record.id
    });
    return record;
  }
  async deleteLabourRate(id: string, actorId?: string) {
    await this.prisma.estimateLabourRate.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "estimates.labourRate.delete",
      entityType: "EstimateLabourRate",
      entityId: id
    });
    return { id };
  }

  listPlantRates() {
    return this.prisma.estimatePlantRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { item: "asc" }]
    });
  }
  async upsertPlantRate(id: string | undefined, dto: UpsertPlantRateDto, actorId?: string) {
    const data = {
      item: dto.item,
      unit: dto.unit ?? "day",
      rate: new Prisma.Decimal(dto.rate),
      fuelRate: new Prisma.Decimal(dto.fuelRate ?? "0"),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    };
    const record = id
      ? await this.prisma.estimatePlantRate.update({ where: { id }, data })
      : await this.prisma.estimatePlantRate.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.plantRate.update" : "estimates.plantRate.create",
      entityType: "EstimatePlantRate",
      entityId: record.id
    });
    return record;
  }
  async deletePlantRate(id: string, actorId?: string) {
    await this.prisma.estimatePlantRate.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "estimates.plantRate.delete",
      entityType: "EstimatePlantRate",
      entityId: id
    });
    return { id };
  }

  listWasteRates() {
    return this.prisma.estimateWasteRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { wasteType: "asc" }, { facility: "asc" }]
    });
  }
  async upsertWasteRate(id: string | undefined, dto: UpsertWasteRateDto, actorId?: string) {
    const data = {
      wasteType: dto.wasteType,
      facility: dto.facility,
      wasteGroup: dto.wasteGroup ?? null,
      unit: dto.unit ?? "tonne",
      tonRate: new Prisma.Decimal(dto.tonRate),
      loadRate: new Prisma.Decimal(dto.loadRate ?? "0"),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    };
    const record = id
      ? await this.prisma.estimateWasteRate.update({ where: { id }, data })
      : await this.prisma.estimateWasteRate.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.wasteRate.update" : "estimates.wasteRate.create",
      entityType: "EstimateWasteRate",
      entityId: record.id
    });
    return record;
  }
  async deleteWasteRate(id: string, actorId?: string) {
    await this.prisma.estimateWasteRate.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "estimates.wasteRate.delete",
      entityType: "EstimateWasteRate",
      entityId: id
    });
    return { id };
  }

  listCuttingRates() {
    return this.prisma.estimateCuttingRate.findMany({
      orderBy: [
        { isActive: "desc" },
        { equipment: "asc" },
        { material: "asc" },
        { elevation: "asc" },
        { depthMm: "asc" }
      ]
    });
  }
  async upsertCuttingRate(id: string | undefined, dto: UpsertCuttingRateDto, actorId?: string) {
    const data = {
      equipment: dto.equipment,
      elevation: dto.elevation,
      material: dto.material,
      depthMm: dto.depthMm,
      ratePerM: new Prisma.Decimal(dto.ratePerM),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    };
    const record = id
      ? await this.prisma.estimateCuttingRate.update({ where: { id }, data })
      : await this.prisma.estimateCuttingRate.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.cuttingRate.update" : "estimates.cuttingRate.create",
      entityType: "EstimateCuttingRate",
      entityId: record.id
    });
    return record;
  }
  async deleteCuttingRate(id: string, actorId?: string) {
    await this.prisma.estimateCuttingRate.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "estimates.cuttingRate.delete",
      entityType: "EstimateCuttingRate",
      entityId: id
    });
    return { id };
  }

  listCoreHoleRates() {
    return this.prisma.estimateCoreHoleRate.findMany({
      orderBy: [{ isActive: "desc" }, { diameterMm: "asc" }]
    });
  }
  async upsertCoreHoleRate(id: string | undefined, dto: UpsertCoreHoleRateDto, actorId?: string) {
    const data = {
      diameterMm: dto.diameterMm,
      ratePerHole: new Prisma.Decimal(dto.ratePerHole),
      isActive: dto.isActive ?? true
    };
    const record = id
      ? await this.prisma.estimateCoreHoleRate.update({ where: { id }, data })
      : await this.prisma.estimateCoreHoleRate.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.coreHoleRate.update" : "estimates.coreHoleRate.create",
      entityType: "EstimateCoreHoleRate",
      entityId: record.id
    });
    return record;
  }
  async deleteCoreHoleRate(id: string, actorId?: string) {
    await this.prisma.estimateCoreHoleRate.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "estimates.coreHoleRate.delete",
      entityType: "EstimateCoreHoleRate",
      entityId: id
    });
    return { id };
  }

  listFuelRates() {
    return this.prisma.estimateFuelRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { item: "asc" }]
    });
  }
  async upsertFuelRate(id: string | undefined, dto: UpsertFuelRateDto, actorId?: string) {
    const data = {
      item: dto.item,
      unit: dto.unit,
      rate: new Prisma.Decimal(dto.rate),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    };
    const record = id
      ? await this.prisma.estimateFuelRate.update({ where: { id }, data })
      : await this.prisma.estimateFuelRate.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.fuelRate.update" : "estimates.fuelRate.create",
      entityType: "EstimateFuelRate",
      entityId: record.id
    });
    return record;
  }
  async deleteFuelRate(id: string, actorId?: string) {
    await this.prisma.estimateFuelRate.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "estimates.fuelRate.delete",
      entityType: "EstimateFuelRate",
      entityId: id
    });
    return { id };
  }

  listEnclosureRates() {
    return this.prisma.estimateEnclosureRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { enclosureType: "asc" }]
    });
  }
  async upsertEnclosureRate(id: string | undefined, dto: UpsertEnclosureRateDto, actorId?: string) {
    const data = {
      enclosureType: dto.enclosureType,
      unit: dto.unit,
      rate: new Prisma.Decimal(dto.rate),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    };
    const record = id
      ? await this.prisma.estimateEnclosureRate.update({ where: { id }, data })
      : await this.prisma.estimateEnclosureRate.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.enclosureRate.update" : "estimates.enclosureRate.create",
      entityType: "EstimateEnclosureRate",
      entityId: record.id
    });
    return record;
  }
  async deleteEnclosureRate(id: string, actorId?: string) {
    await this.prisma.estimateEnclosureRate.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "estimates.enclosureRate.delete",
      entityType: "EstimateEnclosureRate",
      entityId: id
    });
    return { id };
  }

  // ──────────────────────────────────────────────────────────────
  //  Estimate (one per tender)
  // ──────────────────────────────────────────────────────────────

  private async requireTender(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) throw new NotFoundException("Tender not found.");
    return tender;
  }

  private async getEstimateForTender(tenderId: string) {
    return this.prisma.tenderEstimate.findUnique({
      where: { tenderId },
      include: estimateInclude
    });
  }

  private async requireEstimate(tenderId: string) {
    const estimate = await this.getEstimateForTender(tenderId);
    if (!estimate) throw new NotFoundException("Estimate not found.");
    return estimate;
  }

  private ensureNotLocked(estimate: { lockedAt?: Date | null }) {
    if (estimate.lockedAt) {
      throw new ForbiddenException("Estimate is locked (tender submitted). Unlock via a status change to modify.");
    }
  }

  async getEstimate(tenderId: string) {
    await this.requireTender(tenderId);
    const existing = await this.getEstimateForTender(tenderId);
    return existing ?? null;
  }

  async createEstimate(tenderId: string, actorId?: string) {
    await this.requireTender(tenderId);
    const existing = await this.getEstimateForTender(tenderId);
    if (existing) return existing;
    const record = await this.prisma.tenderEstimate.create({
      data: { tenderId, markup: new Prisma.Decimal("30") }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.create",
      entityType: "TenderEstimate",
      entityId: record.id,
      metadata: { tenderId }
    });
    return this.requireEstimate(tenderId);
  }

  async updateEstimate(tenderId: string, dto: UpdateEstimateDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    const data: Prisma.TenderEstimateUpdateInput = {};
    if (dto.markup !== undefined) data.markup = new Prisma.Decimal(dto.markup);
    if (dto.notes !== undefined) data.notes = dto.notes;
    await this.prisma.tenderEstimate.update({ where: { id: estimate.id }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.update",
      entityType: "TenderEstimate",
      entityId: estimate.id
    });
    return this.requireEstimate(tenderId);
  }

  async lockEstimate(tenderId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    await this.prisma.tenderEstimate.update({
      where: { id: estimate.id },
      data: { lockedAt: new Date(), lockedById: actorId ?? null }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.lock",
      entityType: "TenderEstimate",
      entityId: estimate.id
    });
    return this.requireEstimate(tenderId);
  }

  async unlockEstimate(tenderId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    await this.prisma.tenderEstimate.update({
      where: { id: estimate.id },
      data: { lockedAt: null, lockedById: null }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.unlock",
      entityType: "TenderEstimate",
      entityId: estimate.id
    });
    return this.requireEstimate(tenderId);
  }

  // ──────────────────────────────────────────────────────────────
  //  Items (scope items)
  // ──────────────────────────────────────────────────────────────

  async addItem(tenderId: string, dto: UpsertEstimateItemDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    const itemNumber =
      dto.itemNumber ??
      (await this.prisma.estimateItem.count({ where: { estimateId: estimate.id, code: dto.code } })) + 1;
    const item = await this.prisma.estimateItem.create({
      data: {
        estimateId: estimate.id,
        code: dto.code,
        itemNumber,
        title: dto.title,
        description: dto.description ?? null,
        markup: new Prisma.Decimal(dto.markup ?? "30"),
        isProvisional: dto.isProvisional ?? false,
        provisionalAmount: dto.provisionalAmount ? new Prisma.Decimal(dto.provisionalAmount) : null,
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.item.create",
      entityType: "EstimateItem",
      entityId: item.id,
      metadata: { tenderId, code: dto.code }
    });
    return this.requireEstimate(tenderId);
  }

  async updateItem(tenderId: string, itemId: string, dto: UpdateEstimateItemDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureItemInEstimate(estimate.id, itemId);
    const data: Prisma.EstimateItemUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.markup !== undefined) data.markup = new Prisma.Decimal(dto.markup);
    if (dto.isProvisional !== undefined) data.isProvisional = dto.isProvisional;
    if (dto.provisionalAmount !== undefined) {
      data.provisionalAmount = dto.provisionalAmount ? new Prisma.Decimal(dto.provisionalAmount) : null;
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await this.prisma.estimateItem.update({ where: { id: itemId }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.item.update",
      entityType: "EstimateItem",
      entityId: itemId
    });
    return this.requireEstimate(tenderId);
  }

  async deleteItem(tenderId: string, itemId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureItemInEstimate(estimate.id, itemId);
    await this.prisma.estimateItem.delete({ where: { id: itemId } });
    await this.auditService.write({
      actorId,
      action: "estimates.item.delete",
      entityType: "EstimateItem",
      entityId: itemId
    });
    return this.requireEstimate(tenderId);
  }

  private async ensureItemInEstimate(estimateId: string, itemId: string) {
    const item = await this.prisma.estimateItem.findUnique({ where: { id: itemId } });
    if (!item || item.estimateId !== estimateId) {
      throw new NotFoundException("Item not found on this estimate.");
    }
  }

  // ──────────────────────────────────────────────────────────────
  //  Line items
  // ──────────────────────────────────────────────────────────────

  async addLabourLine(tenderId: string, itemId: string, dto: UpsertLabourLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureItemInEstimate(estimate.id, itemId);
    const line = await this.prisma.estimateLabourLine.create({
      data: {
        itemId,
        role: dto.role,
        qty: new Prisma.Decimal(dto.qty),
        days: new Prisma.Decimal(dto.days),
        shift: dto.shift ?? "Day",
        rate: new Prisma.Decimal(dto.rate),
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.labourLine.create",
      entityType: "EstimateLabourLine",
      entityId: line.id
    });
    return this.requireEstimate(tenderId);
  }
  async updateLabourLine(tenderId: string, itemId: string, lineId: string, dto: UpdateLabourLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureLabourLineInItem(itemId, lineId);
    const data: Prisma.EstimateLabourLineUpdateInput = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.qty !== undefined) data.qty = new Prisma.Decimal(dto.qty);
    if (dto.days !== undefined) data.days = new Prisma.Decimal(dto.days);
    if (dto.shift !== undefined) data.shift = dto.shift;
    if (dto.rate !== undefined) data.rate = new Prisma.Decimal(dto.rate);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await this.prisma.estimateLabourLine.update({ where: { id: lineId }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.labourLine.update",
      entityType: "EstimateLabourLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  async deleteLabourLine(tenderId: string, itemId: string, lineId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureLabourLineInItem(itemId, lineId);
    await this.prisma.estimateLabourLine.delete({ where: { id: lineId } });
    await this.auditService.write({
      actorId,
      action: "estimates.labourLine.delete",
      entityType: "EstimateLabourLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  private async ensureLabourLineInItem(itemId: string, lineId: string) {
    const line = await this.prisma.estimateLabourLine.findUnique({ where: { id: lineId } });
    if (!line || line.itemId !== itemId) throw new NotFoundException("Labour line not found on this item.");
  }

  async addPlantLine(tenderId: string, itemId: string, dto: UpsertPlantLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureItemInEstimate(estimate.id, itemId);
    const line = await this.prisma.estimatePlantLine.create({
      data: {
        itemId,
        plantItem: dto.plantItem,
        qty: new Prisma.Decimal(dto.qty),
        days: new Prisma.Decimal(dto.days),
        comment: dto.comment ?? null,
        rate: new Prisma.Decimal(dto.rate),
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.plantLine.create",
      entityType: "EstimatePlantLine",
      entityId: line.id
    });
    return this.requireEstimate(tenderId);
  }
  async updatePlantLine(tenderId: string, itemId: string, lineId: string, dto: UpdatePlantLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensurePlantLineInItem(itemId, lineId);
    const data: Prisma.EstimatePlantLineUpdateInput = {};
    if (dto.plantItem !== undefined) data.plantItem = dto.plantItem;
    if (dto.qty !== undefined) data.qty = new Prisma.Decimal(dto.qty);
    if (dto.days !== undefined) data.days = new Prisma.Decimal(dto.days);
    if (dto.comment !== undefined) data.comment = dto.comment;
    if (dto.rate !== undefined) data.rate = new Prisma.Decimal(dto.rate);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await this.prisma.estimatePlantLine.update({ where: { id: lineId }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.plantLine.update",
      entityType: "EstimatePlantLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  async deletePlantLine(tenderId: string, itemId: string, lineId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensurePlantLineInItem(itemId, lineId);
    await this.prisma.estimatePlantLine.delete({ where: { id: lineId } });
    await this.auditService.write({
      actorId,
      action: "estimates.plantLine.delete",
      entityType: "EstimatePlantLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  private async ensurePlantLineInItem(itemId: string, lineId: string) {
    const line = await this.prisma.estimatePlantLine.findUnique({ where: { id: lineId } });
    if (!line || line.itemId !== itemId) throw new NotFoundException("Plant line not found on this item.");
  }

  async addEquipLine(tenderId: string, itemId: string, dto: UpsertEquipLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureItemInEstimate(estimate.id, itemId);
    const line = await this.prisma.estimateEquipLine.create({
      data: {
        itemId,
        description: dto.description,
        qty: new Prisma.Decimal(dto.qty),
        duration: new Prisma.Decimal(dto.duration),
        period: dto.period ?? "Day",
        rate: new Prisma.Decimal(dto.rate),
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.equipLine.create",
      entityType: "EstimateEquipLine",
      entityId: line.id
    });
    return this.requireEstimate(tenderId);
  }
  async updateEquipLine(tenderId: string, itemId: string, lineId: string, dto: UpdateEquipLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureEquipLineInItem(itemId, lineId);
    const data: Prisma.EstimateEquipLineUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.qty !== undefined) data.qty = new Prisma.Decimal(dto.qty);
    if (dto.duration !== undefined) data.duration = new Prisma.Decimal(dto.duration);
    if (dto.period !== undefined) data.period = dto.period;
    if (dto.rate !== undefined) data.rate = new Prisma.Decimal(dto.rate);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await this.prisma.estimateEquipLine.update({ where: { id: lineId }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.equipLine.update",
      entityType: "EstimateEquipLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  async deleteEquipLine(tenderId: string, itemId: string, lineId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureEquipLineInItem(itemId, lineId);
    await this.prisma.estimateEquipLine.delete({ where: { id: lineId } });
    await this.auditService.write({
      actorId,
      action: "estimates.equipLine.delete",
      entityType: "EstimateEquipLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  private async ensureEquipLineInItem(itemId: string, lineId: string) {
    const line = await this.prisma.estimateEquipLine.findUnique({ where: { id: lineId } });
    if (!line || line.itemId !== itemId) throw new NotFoundException("Equipment line not found on this item.");
  }

  async addWasteLine(tenderId: string, itemId: string, dto: UpsertWasteLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureItemInEstimate(estimate.id, itemId);
    const line = await this.prisma.estimateWasteLine.create({
      data: {
        itemId,
        wasteGroup: dto.wasteGroup ?? null,
        wasteType: dto.wasteType,
        facility: dto.facility,
        qtyTonnes: new Prisma.Decimal(dto.qtyTonnes),
        tonRate: new Prisma.Decimal(dto.tonRate),
        loads: dto.loads ?? 0,
        loadRate: new Prisma.Decimal(dto.loadRate ?? "0"),
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.wasteLine.create",
      entityType: "EstimateWasteLine",
      entityId: line.id
    });
    return this.requireEstimate(tenderId);
  }
  async updateWasteLine(tenderId: string, itemId: string, lineId: string, dto: UpdateWasteLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureWasteLineInItem(itemId, lineId);
    const data: Prisma.EstimateWasteLineUpdateInput = {};
    if (dto.wasteGroup !== undefined) data.wasteGroup = dto.wasteGroup;
    if (dto.wasteType !== undefined) data.wasteType = dto.wasteType;
    if (dto.facility !== undefined) data.facility = dto.facility;
    if (dto.qtyTonnes !== undefined) data.qtyTonnes = new Prisma.Decimal(dto.qtyTonnes);
    if (dto.tonRate !== undefined) data.tonRate = new Prisma.Decimal(dto.tonRate);
    if (dto.loads !== undefined) data.loads = dto.loads;
    if (dto.loadRate !== undefined) data.loadRate = new Prisma.Decimal(dto.loadRate);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await this.prisma.estimateWasteLine.update({ where: { id: lineId }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.wasteLine.update",
      entityType: "EstimateWasteLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  async deleteWasteLine(tenderId: string, itemId: string, lineId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureWasteLineInItem(itemId, lineId);
    await this.prisma.estimateWasteLine.delete({ where: { id: lineId } });
    await this.auditService.write({
      actorId,
      action: "estimates.wasteLine.delete",
      entityType: "EstimateWasteLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  private async ensureWasteLineInItem(itemId: string, lineId: string) {
    const line = await this.prisma.estimateWasteLine.findUnique({ where: { id: lineId } });
    if (!line || line.itemId !== itemId) throw new NotFoundException("Waste line not found on this item.");
  }

  async addCuttingLine(tenderId: string, itemId: string, dto: UpsertCuttingLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureItemInEstimate(estimate.id, itemId);
    const line = await this.prisma.estimateCuttingLine.create({
      data: {
        itemId,
        cuttingType: dto.cuttingType,
        equipment: dto.equipment ?? null,
        elevation: dto.elevation ?? null,
        material: dto.material ?? null,
        depthMm: dto.depthMm ?? null,
        diameterMm: dto.diameterMm ?? null,
        qty: new Prisma.Decimal(dto.qty),
        unit: dto.unit,
        comment: dto.comment ?? null,
        rate: new Prisma.Decimal(dto.rate),
        sortOrder: dto.sortOrder ?? 0
      }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.cuttingLine.create",
      entityType: "EstimateCuttingLine",
      entityId: line.id
    });
    return this.requireEstimate(tenderId);
  }
  async updateCuttingLine(tenderId: string, itemId: string, lineId: string, dto: UpdateCuttingLineDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureCuttingLineInItem(itemId, lineId);
    const data: Prisma.EstimateCuttingLineUpdateInput = {};
    if (dto.cuttingType !== undefined) data.cuttingType = dto.cuttingType;
    if (dto.equipment !== undefined) data.equipment = dto.equipment;
    if (dto.elevation !== undefined) data.elevation = dto.elevation;
    if (dto.material !== undefined) data.material = dto.material;
    if (dto.depthMm !== undefined) data.depthMm = dto.depthMm;
    if (dto.diameterMm !== undefined) data.diameterMm = dto.diameterMm;
    if (dto.qty !== undefined) data.qty = new Prisma.Decimal(dto.qty);
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.comment !== undefined) data.comment = dto.comment;
    if (dto.rate !== undefined) data.rate = new Prisma.Decimal(dto.rate);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await this.prisma.estimateCuttingLine.update({ where: { id: lineId }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.cuttingLine.update",
      entityType: "EstimateCuttingLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  async deleteCuttingLine(tenderId: string, itemId: string, lineId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureCuttingLineInItem(itemId, lineId);
    await this.prisma.estimateCuttingLine.delete({ where: { id: lineId } });
    await this.auditService.write({
      actorId,
      action: "estimates.cuttingLine.delete",
      entityType: "EstimateCuttingLine",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  private async ensureCuttingLineInItem(itemId: string, lineId: string) {
    const line = await this.prisma.estimateCuttingLine.findUnique({ where: { id: lineId } });
    if (!line || line.itemId !== itemId) throw new NotFoundException("Cutting line not found on this item.");
  }

  async addAssumption(tenderId: string, itemId: string, dto: UpsertAssumptionDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureItemInEstimate(estimate.id, itemId);
    const record = await this.prisma.estimateAssumption.create({
      data: { itemId, text: dto.text, sortOrder: dto.sortOrder ?? 0 }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.assumption.create",
      entityType: "EstimateAssumption",
      entityId: record.id
    });
    return this.requireEstimate(tenderId);
  }
  async updateAssumption(tenderId: string, itemId: string, lineId: string, dto: UpdateAssumptionDto, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureAssumptionInItem(itemId, lineId);
    const data: Prisma.EstimateAssumptionUpdateInput = {};
    if (dto.text !== undefined) data.text = dto.text;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    await this.prisma.estimateAssumption.update({ where: { id: lineId }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.assumption.update",
      entityType: "EstimateAssumption",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  async deleteAssumption(tenderId: string, itemId: string, lineId: string, actorId?: string) {
    const estimate = await this.requireEstimate(tenderId);
    this.ensureNotLocked(estimate);
    await this.ensureAssumptionInItem(itemId, lineId);
    await this.prisma.estimateAssumption.delete({ where: { id: lineId } });
    await this.auditService.write({
      actorId,
      action: "estimates.assumption.delete",
      entityType: "EstimateAssumption",
      entityId: lineId
    });
    return this.requireEstimate(tenderId);
  }
  private async ensureAssumptionInItem(itemId: string, lineId: string) {
    const record = await this.prisma.estimateAssumption.findUnique({ where: { id: lineId } });
    if (!record || record.itemId !== itemId) throw new NotFoundException("Assumption not found on this item.");
  }

  // ──────────────────────────────────────────────────────────────
  //  Summary / totals (server authoritative)
  // ──────────────────────────────────────────────────────────────

  async summary(tenderId: string) {
    await this.requireTender(tenderId);
    const estimate = await this.getEstimateForTender(tenderId);
    if (!estimate) {
      return {
        estimateId: null,
        markup: 0,
        locked: false,
        items: [],
        totals: { labour: 0, equip: 0, plant: 0, waste: 0, cutting: 0, subtotal: 0, price: 0 },
        markupAmount: 0
      };
    }

    const items = estimate.items.map((item: EstimateItemWithLines) => {
      const labour = round2(item.labourLines.reduce((sum: number, l) => sum + toNumber(l.qty) * toNumber(l.days) * toNumber(l.rate), 0));
      const equip = round2(item.equipLines.reduce((sum: number, l) => sum + toNumber(l.qty) * toNumber(l.duration) * toNumber(l.rate), 0));
      const plant = round2(item.plantLines.reduce((sum: number, l) => sum + toNumber(l.qty) * toNumber(l.days) * toNumber(l.rate), 0));
      const waste = round2(item.wasteLines.reduce((sum: number, l) => sum + toNumber(l.qtyTonnes) * toNumber(l.tonRate) + (l.loads ?? 0) * toNumber(l.loadRate), 0));
      const cutting = round2(item.cuttingLines.reduce((sum: number, l) => sum + toNumber(l.qty) * toNumber(l.rate), 0));
      const subtotal = round2(labour + equip + plant + waste + cutting);
      const markup = toNumber(item.markup);
      const price = item.isProvisional
        ? round2(toNumber(item.provisionalAmount))
        : round2(subtotal * (1 + markup / 100));
      return {
        itemId: item.id,
        code: item.code,
        itemNumber: item.itemNumber,
        title: item.title,
        isProvisional: item.isProvisional,
        labour,
        equip,
        plant,
        waste,
        cutting,
        subtotal,
        markup,
        price
      };
    });

    type Totals = { labour: number; equip: number; plant: number; waste: number; cutting: number; subtotal: number; price: number };
    const totals = items.reduce<Totals>(
      (acc, item) => {
        acc.labour += item.labour;
        acc.equip += item.equip;
        acc.plant += item.plant;
        acc.waste += item.waste;
        acc.cutting += item.cutting;
        acc.subtotal += item.subtotal;
        acc.price += item.price;
        return acc;
      },
      { labour: 0, equip: 0, plant: 0, waste: 0, cutting: 0, subtotal: 0, price: 0 }
    );

    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[key] = round2(totals[key]);
    }

    const markupAmount = round2(totals.price - totals.subtotal);

    return {
      estimateId: estimate.id,
      markup: toNumber(estimate.markup),
      locked: Boolean(estimate.lockedAt),
      items,
      totals,
      markupAmount
    };
  }
}
