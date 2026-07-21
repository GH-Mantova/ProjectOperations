import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RateResolverService } from "../rates/rate-resolver.service";
import { sumLabourTaskHours } from "./estimate-calculators";
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
  UpsertMaterialDensityDto,
  UpsertOtherRateDto,
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

/**
 * Business logic for the estimating module: rate-library CRUD and the
 * per-tender estimate aggregate (scope items, cost lines, assumptions,
 * lock state and server-authoritative totals).
 *
 * Cross-cutting behaviour: every write records an audit entry; all
 * estimate mutations are blocked with ForbiddenException once the
 * estimate is locked; mutating methods return the full re-fetched
 * estimate rather than just the touched row.
 */
@Injectable()
export class EstimatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rateResolver: RateResolverService
  ) {}

  // ──────────────────────────────────────────────────────────────
  //  Rate library
  // ──────────────────────────────────────────────────────────────

  /**
   * List labour rates, active first then by sortOrder and role.
   *
   * @returns all EstimateLabourRate rows
   */
  listLabourRates() {
    return this.prisma.estimateLabourRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { role: "asc" }]
    });
  }
  /**
   * Create (id undefined) or update (id given) a labour rate; audited.
   *
   * @param id - existing rate id for update, undefined for create
   * @returns the created/updated rate row
   */
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
  /**
   * Hard-delete a labour rate; audited.
   *
   * @returns `{ id }` of the deleted rate
   */
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

  /**
   * List plant rates, active first then by sortOrder and item.
   *
   * @returns all EstimatePlantRate rows
   */
  listPlantRates() {
    return this.prisma.estimatePlantRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { item: "asc" }]
    });
  }
  /**
   * Create (id undefined) or update (id given) a plant rate; audited.
   * Unit defaults to "day", fuelRate to 0.
   *
   * @returns the created/updated rate row
   */
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
  /**
   * Hard-delete a plant rate; audited.
   *
   * @returns `{ id }` of the deleted rate
   */
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

  /**
   * List waste rates, active first then by sortOrder, wasteType and facility.
   *
   * @returns all EstimateWasteRate rows
   */
  listWasteRates() {
    return this.prisma.estimateWasteRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { wasteType: "asc" }, { facility: "asc" }]
    });
  }
  /**
   * Create (id undefined) or update (id given) a waste rate; audited.
   * Unit defaults to "tonne", loadRate to 0.
   *
   * @returns the created/updated rate row
   */
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
  /**
   * Hard-delete a waste rate; audited.
   *
   * @returns `{ id }` of the deleted rate
   */
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

  /**
   * List cutting rates ordered by equipment, material, elevation and depth.
   *
   * @returns all EstimateCuttingRate rows
   */
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
  /**
   * Create (id undefined) or update (id given) a cutting rate; audited.
   *
   * @returns the created/updated rate row
   */
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
  /**
   * Hard-delete a cutting rate; audited.
   *
   * @returns `{ id }` of the deleted rate
   */
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

  /**
   * List core-hole rates, active first then by diameter.
   *
   * @returns all EstimateCoreHoleRate rows
   */
  listCoreHoleRates() {
    return this.prisma.estimateCoreHoleRate.findMany({
      orderBy: [{ isActive: "desc" }, { diameterMm: "asc" }]
    });
  }
  /**
   * Create (id undefined) or update (id given) a core-hole rate; audited.
   *
   * @returns the created/updated rate row
   */
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
  /**
   * Hard-delete a core-hole rate; audited.
   *
   * @returns `{ id }` of the deleted rate
   */
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

  /**
   * List fuel rates, active first then by sortOrder and item.
   *
   * @returns all EstimateFuelRate rows
   */
  listFuelRates() {
    return this.prisma.estimateFuelRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { item: "asc" }]
    });
  }
  /**
   * Create (id undefined) or update (id given) a fuel rate; audited.
   *
   * @returns the created/updated rate row
   */
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
  /**
   * Hard-delete a fuel rate; audited.
   *
   * @returns `{ id }` of the deleted rate
   */
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

  /**
   * List enclosure rates, active first then by sortOrder and type.
   *
   * @returns all EstimateEnclosureRate rows
   */
  listEnclosureRates() {
    return this.prisma.estimateEnclosureRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { enclosureType: "asc" }]
    });
  }
  /**
   * Create (id undefined) or update (id given) an enclosure rate; audited.
   *
   * @returns the created/updated rate row
   */
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
  /**
   * Hard-delete an enclosure rate; audited.
   *
   * @returns `{ id }` of the deleted rate
   */
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

  // Material density — lookup table for density by material name.
  // Reads delegate to `RateResolverService`, the density read seam
  // (see rate-resolver.service.ts). Legacy `EstimateMaterialDensity`
  // remains write-authoritative here for this PR (deprecate-in-place).
  /**
   * List material densities, active first then by category and name.
   *
   * @returns density rows via the resolver seam (byte-identical to a
   *          direct `estimateMaterialDensity.findMany` today)
   */
  listMaterialDensities() {
    return this.rateResolver.listMaterialDensities();
  }
  /**
   * Create (id undefined) or update (id given) a material density; audited.
   *
   * @returns the created/updated density row
   */
  async upsertMaterialDensity(id: string | undefined, dto: UpsertMaterialDensityDto, actorId?: string) {
    const data = {
      materialName: dto.materialName,
      density: new Prisma.Decimal(dto.density),
      unit: dto.unit,
      // `kind` is optional in the DTO; Prisma will apply the schema default
      // (VOLUME) when omitted on create. On update we only touch it if given.
      ...(dto.kind ? { kind: dto.kind } : {}),
      category: dto.category ?? null,
      notes: dto.notes ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    };
    const record = id
      ? await this.prisma.estimateMaterialDensity.update({ where: { id }, data })
      : await this.prisma.estimateMaterialDensity.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.materialDensity.update" : "estimates.materialDensity.create",
      entityType: "EstimateMaterialDensity",
      entityId: record.id
    });
    return record;
  }
  /**
   * Soft-delete a material density — sets isActive false rather than
   * removing the row; audited as a delete.
   *
   * @returns `{ id }` of the deactivated density
   */
  async deleteMaterialDensity(id: string, actorId?: string) {
    await this.prisma.estimateMaterialDensity.update({
      where: { id },
      data: { isActive: false }
    });
    await this.auditService.write({
      actorId,
      action: "estimates.materialDensity.delete",
      entityType: "EstimateMaterialDensity",
      entityId: id
    });
    return { id };
  }

  // Other rates — flat-fee / unit-priced cutting-sheet catalogue
  // (establishment fees, saw-blade changes, etc).
  /**
   * List cutting-sheet other-rates, active first then by sortOrder and description.
   *
   * @returns all CuttingOtherRate rows
   */
  listOtherRates() {
    return this.prisma.cuttingOtherRate.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { description: "asc" }]
    });
  }
  /**
   * Create (id undefined) or update (id given) an other-rate; audited.
   *
   * @returns the created/updated rate row
   */
  async upsertOtherRate(id: string | undefined, dto: UpsertOtherRateDto, actorId?: string) {
    const data = {
      description: dto.description,
      unit: dto.unit,
      rate: new Prisma.Decimal(dto.rate),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0
    };
    const record = id
      ? await this.prisma.cuttingOtherRate.update({ where: { id }, data })
      : await this.prisma.cuttingOtherRate.create({ data });
    await this.auditService.write({
      actorId,
      action: id ? "estimates.otherRate.update" : "estimates.otherRate.create",
      entityType: "CuttingOtherRate",
      entityId: record.id
    });
    return record;
  }
  /**
   * Hard-delete an other-rate after confirming no cutting-sheet items
   * reference it; audited.
   *
   * @returns `{ id }` of the deleted rate
   * @throws ForbiddenException when cuttingSheetItem rows still reference the rate
   */
  async deleteOtherRate(id: string, actorId?: string) {
    const usage = await this.prisma.cuttingSheetItem.count({ where: { otherRateId: id } });
    if (usage > 0) {
      throw new ForbiddenException(
        `Other rate is referenced by ${usage} cutting line(s). Deactivate it instead of deleting.`
      );
    }
    await this.prisma.cuttingOtherRate.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "estimates.otherRate.delete",
      entityType: "CuttingOtherRate",
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

  /**
   * Get a tender's estimate with all items, lines and assumptions.
   *
   * @returns the estimate, or null when none has been created yet
   * @throws NotFoundException when the tender does not exist
   */
  async getEstimate(tenderId: string) {
    await this.requireTender(tenderId);
    const existing = await this.getEstimateForTender(tenderId);
    return existing ?? null;
  }

  /**
   * Create the estimate for a tender, idempotently.
   *
   * Returns the existing estimate untouched when one is already present;
   * otherwise creates one with the 30% default markup and writes an
   * `estimates.create` audit entry.
   *
   * @returns the estimate with full includes
   * @throws NotFoundException when the tender does not exist
   */
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

  /**
   * Patch estimate-level fields (markup, notes) with upsert semantics.
   *
   * When no estimate exists yet, one is created on the fly with the
   * patched values (markup defaults to 30). The lock check only applies
   * to existing estimates. Audited as create or update accordingly.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the tender does not exist
   * @throws ForbiddenException when an existing estimate is locked
   */
  async updateEstimate(tenderId: string, dto: UpdateEstimateDto, actorId?: string) {
    // PR B2 — upsert behaviour. Fresh tenders have no TenderEstimate
    // row until one is explicitly created; the scope-of-works markup
    // picker now expects PATCH /tenders/:id/estimate to work without
    // a prior POST. If the estimate doesn't exist we create it on the
    // fly with the patched values (markup defaults to 30 when omitted).
    await this.requireTender(tenderId);
    const existing = await this.getEstimateForTender(tenderId);
    if (!existing) {
      const created = await this.prisma.tenderEstimate.create({
        data: {
          tenderId,
          markup: new Prisma.Decimal(dto.markup ?? "30"),
          notes: dto.notes ?? null
        }
      });
      await this.auditService.write({
        actorId,
        action: "estimates.create",
        entityType: "TenderEstimate",
        entityId: created.id,
        metadata: { tenderId, viaUpsert: true }
      });
      return this.requireEstimate(tenderId);
    }
    this.ensureNotLocked(existing);
    const data: Prisma.TenderEstimateUpdateInput = {};
    if (dto.markup !== undefined) data.markup = new Prisma.Decimal(dto.markup);
    if (dto.notes !== undefined) data.notes = dto.notes;
    await this.prisma.tenderEstimate.update({ where: { id: existing.id }, data });
    await this.auditService.write({
      actorId,
      action: "estimates.update",
      entityType: "TenderEstimate",
      entityId: existing.id
    });
    return this.requireEstimate(tenderId);
  }

  /**
   * Lock an estimate, stamping lockedAt and lockedById; audited.
   *
   * Locking is idempotent — re-locking refreshes the timestamp.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate does not exist
   */
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

  /**
   * Unlock an estimate, clearing lockedAt and lockedById; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate does not exist
   */
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

  /**
   * Add a scope item to a tender's estimate; audited.
   *
   * When itemNumber is omitted it is derived as (count of existing items
   * with the same code) + 1. Item markup defaults to 30%.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Sparse-update a scope item (only defined dto fields are written); audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Delete a scope item (DB cascade removes its lines and assumptions); audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Add a labour line (qty x days x rate; shift defaults "Day") to an item; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Sparse-update a labour line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Delete a labour line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Add a plant line (qty x days x rate) to an item; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Sparse-update a plant line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Delete a plant line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Add an equipment/subcontractor line (qty x duration x rate; period
   * defaults "Day") to an item; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Sparse-update an equipment/subcontractor line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Delete an equipment/subcontractor line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Add a waste line (tonnes x tonRate + loads x loadRate) to an item; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Sparse-update a waste line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Delete a waste line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Add a cutting line (qty x rate, typed by cuttingType) to an item; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Sparse-update a cutting line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Delete a cutting line; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or line does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Add a free-text assumption to an item; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate or item does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Sparse-update an assumption; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or assumption does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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
  /**
   * Delete an assumption; audited.
   *
   * @returns the full refreshed estimate
   * @throws NotFoundException when the estimate, item or assumption does not exist
   * @throws ForbiddenException when the estimate is locked
   */
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

  /**
   * Compute server-authoritative per-item and overall totals.
   *
   * Provisional items pass through at provisionalAmount with no markup
   * (subtotal = price so rolled-up markupAmount stays accurate). Normal
   * items sum labour/equip/plant/waste/cutting lines, then apply the
   * item-level markup percentage. All figures rounded to 2dp.
   *
   * @returns `{ estimateId, markup, locked, items, totals, markupAmount }`;
   *          a zeroed shape with estimateId null when no estimate exists
   * @throws NotFoundException when the tender does not exist
   */
  async summary(tenderId: string) {
    await this.requireTender(tenderId);
    const estimate = await this.getEstimateForTender(tenderId);
    if (!estimate) {
      return {
        estimateId: null,
        markup: 0,
        locked: false,
        items: [],
        totals: {
          labour: 0,
          equip: 0,
          plant: 0,
          waste: 0,
          cutting: 0,
          subtotal: 0,
          price: 0,
          taskHours: 0,
          wasteTonnes: 0
        },
        markupAmount: 0
      };
    }

    const items = estimate.items.map((item: EstimateItemWithLines) => {
      // Provisional sum items are passed through at cost — provisionalAmount
      // IS the client-facing price with no markup applied (IS QS practice).
      // Subtotal is set to the same value so the rolled-up markupAmount
      // ( = totals.price - totals.subtotal ) stays accurate.
      if (item.isProvisional) {
        const amount = round2(toNumber(item.provisionalAmount));
        return {
          itemId: item.id,
          code: item.code,
          itemNumber: item.itemNumber,
          title: item.title,
          isProvisional: true,
          labour: 0,
          equip: 0,
          plant: 0,
          waste: 0,
          cutting: 0,
          subtotal: amount,
          markup: 0,
          price: amount,
          taskHours: 0,
          wasteTonnes: 0
        };
      }

      const labour = round2(item.labourLines.reduce((sum: number, l) => sum + toNumber(l.qty) * toNumber(l.days) * toNumber(l.rate), 0));
      const equip = round2(item.equipLines.reduce((sum: number, l) => sum + toNumber(l.qty) * toNumber(l.duration) * toNumber(l.rate), 0));
      const plant = round2(item.plantLines.reduce((sum: number, l) => sum + toNumber(l.qty) * toNumber(l.days) * toNumber(l.rate), 0));
      const waste = round2(item.wasteLines.reduce((sum: number, l) => sum + toNumber(l.qtyTonnes) * toNumber(l.tonRate) + (l.loads ?? 0) * toNumber(l.loadRate), 0));
      const cutting = round2(item.cuttingLines.reduce((sum: number, l) => sum + toNumber(l.qty) * toNumber(l.rate), 0));
      const subtotal = round2(labour + equip + plant + waste + cutting);
      const markup = toNumber(item.markup);
      const price = round2(subtotal * (1 + markup / 100));
      // SoT §10 calculators (BACKLOG-DECISIONS.md #7). These are
      // *display-only* derived aggregates — they do not feed pricing.
      // taskHours: Σ (persons × days × 8h) across labour lines, via the
      //   task-time calculator. Surfaces "how many crew-hours does this
      //   scope commit to?" for estimator review.
      // wasteTonnes: Σ qtyTonnes across waste lines (the persisted value).
      //   Kept as its own summary field so the UI does not have to
      //   re-derive it, and so a future switch to volume × density (via
      //   wasteWeightFromTonneDensity) is one call-site.
      const taskHours = round2(
        sumLabourTaskHours(
          item.labourLines.map((l) => ({ qty: toNumber(l.qty), days: toNumber(l.days) }))
        )
      );
      const wasteTonnes = round2(
        item.wasteLines.reduce((sum: number, l) => sum + toNumber(l.qtyTonnes), 0)
      );
      return {
        itemId: item.id,
        code: item.code,
        itemNumber: item.itemNumber,
        title: item.title,
        isProvisional: false,
        labour,
        equip,
        plant,
        waste,
        cutting,
        subtotal,
        markup,
        price,
        taskHours,
        wasteTonnes
      };
    });

    type Totals = {
      labour: number;
      equip: number;
      plant: number;
      waste: number;
      cutting: number;
      subtotal: number;
      price: number;
      taskHours: number;
      wasteTonnes: number;
    };
    const totals = items.reduce<Totals>(
      (acc, item) => {
        acc.labour += item.labour;
        acc.equip += item.equip;
        acc.plant += item.plant;
        acc.waste += item.waste;
        acc.cutting += item.cutting;
        acc.subtotal += item.subtotal;
        acc.price += item.price;
        acc.taskHours += item.taskHours;
        acc.wasteTonnes += item.wasteTonnes;
        return acc;
      },
      {
        labour: 0,
        equip: 0,
        plant: 0,
        waste: 0,
        cutting: 0,
        subtotal: 0,
        price: 0,
        taskHours: 0,
        wasteTonnes: 0
      }
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
