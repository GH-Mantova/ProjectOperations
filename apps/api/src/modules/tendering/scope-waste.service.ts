import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications.service";
import { RateResolverService } from "../rates/rate-resolver.service";
import { narrowToNumber, toDecimal } from "./scope-of-works.service";

type UpsertWasteDto = {
  discipline?: string;
  cardId?: string | null;
  wbsRef?: string | null;
  description?: string;
  wasteGroup?: string | null;
  wasteType?: string | null;
  wasteFacility?: string | null;
  unit?: string | null;
  // PR chore/schema-hygiene-waste — renamed from `wasteTonnes` (column-name
  // lie post-B4a; this quantity is tonnes OR m³ depending on facility rate).
  qty?: number | null;
  // PR B4a — m³ companion to qty. Manual create/edit accepts
  // either; the sumFromAbove aggregator writes both.
  m3?: number | null;
  wasteLoads?: number | null;
  ratePerTonne?: number | null;
  ratePerLoad?: number | null;
  notes?: string | null;
  sortOrder?: number;
  // R3 T-1 — waste transport cost engine inputs. All nullable; the
  // engine only fires when the row has enough of them populated (see
  // computeCostEngine). Legacy /3 truck-days path stays intact.
  transportRateId?: string | null;
  assetId?: string | null;
  qtyTrucks?: number | null;
  loadsPerTruckPerDay?: number | null;
  capacityPerLoad?: number | null;
  capacityUnit?: string | null;
  dailyKm?: number | null;
};

// R3 T-1 — snapshot cost components computed by the engine. Returned by
// computeCostEngine and folded into the row's line_total. When the
// engine cannot fire (missing inputs) every component stays null and the
// row falls back to the legacy ratePerTonne/ratePerLoad path.
type EngineResult = {
  loads: number | null;
  durationDays: number | null;
  transportCost: number | null;
  fuelCost: number | null;
  disposalCost: number | null;
  lineTotal: number | null;
  quotedDisposalRate: number | null;
  quotedFuelPricePerLitre: number | null;
};

// Waste disposal rows live on their own table (ScopeWasteItem). Each row's
// truckDays and lineTotal are derived server-side so the UI only submits
// raw inputs — never a calculated value. Rule: 3 loads per truck day,
// rounded up to the nearest half-day.
/**
 * CRUD + aggregation service for ScopeWasteItem rows.
 *
 * truckDays and lineTotal are always derived server-side (3 loads per
 * truck day, rounded up to the nearest half-day; line total bills
 * against tonnes or m³ depending on the row's unit) — the UI only ever
 * submits raw inputs. The sumFromAbove aggregator owns autoSummed=true
 * rows; manual rows stay autoSummed=false.
 */
@Injectable()
export class ScopeWasteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateResolver: RateResolverService,
    private readonly notifications: NotificationsService
  ) {}

  /**
   * Lists waste rows for a tender, optionally filtered by discipline
   * and/or cardId, ordered by discipline, sortOrder, createdAt.
   *
   * When cardId is supplied, only rows attached to that card are
   * returned — cardless legacy rows are deliberately excluded.
   *
   * @param opts - optional `discipline` and/or `cardId` filters
   * @returns matching ScopeWasteItem rows
   */
  async list(tenderId: string, opts?: { discipline?: string; cardId?: string }) {
    return this.prisma.scopeWasteItem.findMany({
      where: {
        tenderId,
        ...(opts?.discipline ? { discipline: opts.discipline } : {}),
        // PR B3 — when cardId is supplied, return ONLY rows attached
        // to that card. Cardless legacy rows are deliberately excluded
        // (covered by Q7 in B3 investigation — follow-up cleanup).
        ...(opts?.cardId ? { cardId: opts.cardId } : {})
      },
      orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  /**
   * Creates a manual waste row (autoSummed=false) with server-derived
   * truckDays + lineTotal. Numeric DTO fields are narrowed before being
   * fed into Prisma.Decimal constructors.
   *
   * @param actorId - recorded as createdById
   * @param dto - raw inputs; description, discipline, and cardId are required
   * @returns the created ScopeWasteItem row
   * @throws BadRequestException when description, discipline, or cardId is missing/blank
   */
  async create(tenderId: string, actorId: string, dto: UpsertWasteDto) {
    if (!dto.description) throw new BadRequestException("description is required.");
    if (!dto.discipline) throw new BadRequestException("discipline is required.");
    // PR B-followup — cardId is NOT NULL at the schema level. Mirrors
    // the cutting service guard.
    if (
      dto.cardId == null ||
      (typeof dto.cardId === "string" && dto.cardId.trim() === "")
    ) {
      throw new BadRequestException(
        "cardId is required — waste items must belong to a scope card."
      );
    }
    const cardId = dto.cardId.trim();
    // PR B4a.3 — narrow DTO numerics at the call site so CodeQL's
    // dataflow analyzer can see the typeof guards. Downstream Decimal
    // constructors then operate on trusted `number | null` locals.
    const tonnesN = narrowToNumber(dto.qty);
    const m3N = narrowToNumber(dto.m3);
    const loadsN = narrowToNumber(dto.wasteLoads);
    const ratePerTonneN = narrowToNumber(dto.ratePerTonne);
    const ratePerLoadN = narrowToNumber(dto.ratePerLoad);
    const qtyTrucksN = narrowToNumber(dto.qtyTrucks);
    const loadsPerTruckPerDayN = narrowToNumber(dto.loadsPerTruckPerDay);
    const capacityPerLoadN = narrowToNumber(dto.capacityPerLoad);
    const dailyKmN = narrowToNumber(dto.dailyKm);
    // R3 T-1 - engine fires when a transport line is picked (transportRateId set)
    // AND we have qtyTrucks + loadsPerTruckPerDay + capacityPerLoad. If ANY are
    // missing the engine returns nulls and we fall back to the legacy path.
    const engine = await this.computeCostEngine({
      qty: tonnesN,
      m3: m3N,
      capacityUnit: dto.capacityUnit ?? null,
      capacityPerLoad: capacityPerLoadN,
      qtyTrucks: qtyTrucksN != null ? Math.trunc(qtyTrucksN) : null,
      loadsPerTruckPerDay: loadsPerTruckPerDayN,
      dailyKm: dailyKmN,
      transportRateId: dto.transportRateId ?? null,
      assetId: dto.assetId ?? null,
      wasteType: dto.wasteType ?? null,
      wasteFacility: dto.wasteFacility ?? null
    });
    const legacy = this.deriveTotals(
      tonnesN,
      m3N,
      loadsN,
      ratePerTonneN,
      ratePerLoadN,
      dto.unit
    );
    const effectiveLineTotal =
      engine.lineTotal != null ? engine.lineTotal : legacy.lineTotal;
    return this.prisma.scopeWasteItem.create({
      data: {
        tenderId,
        cardId,
        discipline: dto.discipline,
        wbsRef: dto.wbsRef ?? null,
        description: dto.description,
        wasteGroup: dto.wasteGroup ?? null,
        wasteType: dto.wasteType ?? null,
        wasteFacility: dto.wasteFacility ?? null,
        unit: dto.unit ?? null,
        qty: toDecimal(tonnesN),
        m3: toDecimal(m3N),
        wasteLoads: engine.loads != null ? engine.loads : loadsN,
        truckDays: toDecimal(
          engine.durationDays != null ? engine.durationDays : legacy.truckDays
        ),
        ratePerTonne: toDecimal(ratePerTonneN),
        ratePerLoad: toDecimal(ratePerLoadN),
        lineTotal: toDecimal(effectiveLineTotal),
        transportRateId: dto.transportRateId ?? null,
        assetId: dto.assetId ?? null,
        qtyTrucks: qtyTrucksN != null ? Math.trunc(qtyTrucksN) : null,
        loadsPerTruckPerDay: toDecimal(loadsPerTruckPerDayN),
        capacityPerLoad: toDecimal(capacityPerLoadN),
        capacityUnit: dto.capacityUnit ?? null,
        dailyKm: toDecimal(dailyKmN),
        transportCost: toDecimal(engine.transportCost),
        fuelCost: toDecimal(engine.fuelCost),
        disposalCost: toDecimal(engine.disposalCost),
        quotedDisposalRate: toDecimal(engine.quotedDisposalRate),
        quotedFuelPricePerLitre: toDecimal(engine.quotedFuelPricePerLitre),
        notes: dto.notes ?? null,
        sortOrder: dto.sortOrder ?? 0,
        // PR B3 — manual creates default autoSummed=false. Only
        // sumFromAbove flips this to true on aggregator-created rows.
        autoSummed: false,
        createdById: actorId
      }
    });
  }

  /**
   * Partially updates a waste row; DTO values win over existing values
   * when present, and truckDays + lineTotal are always re-derived from
   * the merged result.
   *
   * @param dto - partial patch; undefined fields keep their existing values
   * @returns the updated ScopeWasteItem row
   * @throws NotFoundException when the row is missing or belongs to another tender
   */
  async update(tenderId: string, id: string, dto: UpsertWasteDto) {
    const existing = await this.prisma.scopeWasteItem.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Waste item not found on this tender.");
    }
    // PR B4a.3 — narrow DTO numerics at the call site. The resulting
    // locals are typed `number | null` so CodeQL no longer flags the
    // downstream Prisma.Decimal constructors as tainted sinks.
    const dtoTonnesN = dto.qty === undefined ? undefined : narrowToNumber(dto.qty);
    const dtoM3N = dto.m3 === undefined ? undefined : narrowToNumber(dto.m3);
    const dtoLoadsN = dto.wasteLoads === undefined ? undefined : narrowToNumber(dto.wasteLoads);
    const dtoRatePerTonneN = dto.ratePerTonne === undefined ? undefined : narrowToNumber(dto.ratePerTonne);
    const dtoRatePerLoadN = dto.ratePerLoad === undefined ? undefined : narrowToNumber(dto.ratePerLoad);

    // R3 T-1 — narrow the engine inputs the same way.
    const dtoQtyTrucksN = dto.qtyTrucks === undefined ? undefined : narrowToNumber(dto.qtyTrucks);
    const dtoLoadsPerTruckPerDayN = dto.loadsPerTruckPerDay === undefined ? undefined : narrowToNumber(dto.loadsPerTruckPerDay);
    const dtoCapacityPerLoadN = dto.capacityPerLoad === undefined ? undefined : narrowToNumber(dto.capacityPerLoad);
    const dtoDailyKmN = dto.dailyKm === undefined ? undefined : narrowToNumber(dto.dailyKm);

    // Compute effective values for the totals: DTO value (narrowed) wins
    // when present; otherwise fall back to existing row.
    const tonnes = dtoTonnesN !== undefined ? dtoTonnesN : existing.qty ? Number(existing.qty) : null;
    const m3 = dtoM3N !== undefined ? dtoM3N : existing.m3 ? Number(existing.m3) : null;
    const loads = dtoLoadsN !== undefined ? dtoLoadsN : existing.wasteLoads;
    const ratePerTonne = dtoRatePerTonneN !== undefined ? dtoRatePerTonneN : existing.ratePerTonne ? Number(existing.ratePerTonne) : null;
    const ratePerLoad = dtoRatePerLoadN !== undefined ? dtoRatePerLoadN : existing.ratePerLoad ? Number(existing.ratePerLoad) : null;
    const unit = dto.unit !== undefined ? dto.unit : existing.unit;
    // R3 T-1 effective engine inputs.
    const eTransportRateId = dto.transportRateId !== undefined ? dto.transportRateId : existing.transportRateId;
    const eAssetId = dto.assetId !== undefined ? dto.assetId : existing.assetId;
    const eQtyTrucks = dtoQtyTrucksN !== undefined ? (dtoQtyTrucksN != null ? Math.trunc(dtoQtyTrucksN) : null) : existing.qtyTrucks;
    const eLoadsPerTruckPerDay = dtoLoadsPerTruckPerDayN !== undefined ? dtoLoadsPerTruckPerDayN : existing.loadsPerTruckPerDay ? Number(existing.loadsPerTruckPerDay) : null;
    const eCapacityPerLoad = dtoCapacityPerLoadN !== undefined ? dtoCapacityPerLoadN : existing.capacityPerLoad ? Number(existing.capacityPerLoad) : null;
    const eCapacityUnit = dto.capacityUnit !== undefined ? dto.capacityUnit : existing.capacityUnit;
    const eDailyKm = dtoDailyKmN !== undefined ? dtoDailyKmN : existing.dailyKm ? Number(existing.dailyKm) : null;
    const eWasteType = dto.wasteType !== undefined ? dto.wasteType : existing.wasteType;
    const eWasteFacility = dto.wasteFacility !== undefined ? dto.wasteFacility : existing.wasteFacility;

    const engine = await this.computeCostEngine({
      qty: tonnes,
      m3: m3,
      capacityUnit: eCapacityUnit,
      capacityPerLoad: eCapacityPerLoad,
      qtyTrucks: eQtyTrucks,
      loadsPerTruckPerDay: eLoadsPerTruckPerDay,
      dailyKm: eDailyKm,
      transportRateId: eTransportRateId,
      assetId: eAssetId,
      wasteType: eWasteType,
      wasteFacility: eWasteFacility
    });
    const legacy = this.deriveTotals(tonnes, m3, loads, ratePerTonne, ratePerLoad, unit);
    const effectiveLineTotal =
      engine.lineTotal != null ? engine.lineTotal : legacy.lineTotal;

    const data: Prisma.ScopeWasteItemUpdateInput = {};
    if (dto.discipline !== undefined) data.discipline = dto.discipline;
    if (dto.wbsRef !== undefined) data.wbsRef = dto.wbsRef;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.wasteGroup !== undefined) data.wasteGroup = dto.wasteGroup;
    if (dto.wasteType !== undefined) data.wasteType = dto.wasteType;
    if (dto.wasteFacility !== undefined) data.wasteFacility = dto.wasteFacility;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dtoTonnesN !== undefined) data.qty = toDecimal(dtoTonnesN);
    if (dtoM3N !== undefined) data.m3 = toDecimal(dtoM3N);
    if (dtoLoadsN !== undefined) data.wasteLoads = dtoLoadsN;
    if (dtoRatePerTonneN !== undefined) data.ratePerTonne = toDecimal(dtoRatePerTonneN);
    if (dtoRatePerLoadN !== undefined) data.ratePerLoad = toDecimal(dtoRatePerLoadN);
    // Engine result: engine.loads / durationDays override the legacy path
    // when the engine fires. Otherwise keep the legacy /3 truck-days value.
    if (engine.loads != null) data.wasteLoads = engine.loads;
    data.truckDays = toDecimal(
      engine.durationDays != null ? engine.durationDays : legacy.truckDays
    );
    data.lineTotal = toDecimal(effectiveLineTotal);
    // Engine inputs — persist whenever the DTO carried them. Nested
    // relation writes on the update side because Prisma emits the update
    // input via the relation field rather than the scalar FK.
    if (dto.transportRateId !== undefined) {
      data.transportRate = dto.transportRateId
        ? { connect: { id: dto.transportRateId } }
        : { disconnect: true };
    }
    if (dto.assetId !== undefined) {
      data.asset = dto.assetId
        ? { connect: { id: dto.assetId } }
        : { disconnect: true };
    }
    if (dtoQtyTrucksN !== undefined) data.qtyTrucks = dtoQtyTrucksN != null ? Math.trunc(dtoQtyTrucksN) : null;
    if (dtoLoadsPerTruckPerDayN !== undefined) data.loadsPerTruckPerDay = toDecimal(dtoLoadsPerTruckPerDayN);
    if (dtoCapacityPerLoadN !== undefined) data.capacityPerLoad = toDecimal(dtoCapacityPerLoadN);
    if (dto.capacityUnit !== undefined) data.capacityUnit = dto.capacityUnit;
    if (dtoDailyKmN !== undefined) data.dailyKm = toDecimal(dtoDailyKmN);
    // Engine snapshot components — always re-derived, so always written.
    data.transportCost = toDecimal(engine.transportCost);
    data.fuelCost = toDecimal(engine.fuelCost);
    data.disposalCost = toDecimal(engine.disposalCost);
    data.quotedDisposalRate = toDecimal(engine.quotedDisposalRate);
    data.quotedFuelPricePerLitre = toDecimal(engine.quotedFuelPricePerLitre);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.scopeWasteItem.update({ where: { id }, data });
  }

  /**
   * Hard-deletes a waste row after verifying it belongs to the tender.
   *
   * @returns `{ deleted: true }`
   * @throws NotFoundException when the row is missing or belongs to another tender
   */
  async remove(tenderId: string, id: string) {
    const existing = await this.prisma.scopeWasteItem.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Waste item not found on this tender.");
    }
    await this.prisma.scopeWasteItem.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Bulk-updates sortOrder in a single transaction. Each updateMany is
   * scoped to the tender, so entries pointing at foreign rows silently
   * affect zero rows rather than erroring.
   *
   * @param entries - (itemId, sortOrder) pairs to apply
   * @returns `{ reordered }` — count of entries submitted (not rows actually changed)
   */
  async reorder(tenderId: string, entries: Array<{ itemId: string; sortOrder: number }>) {
    await this.prisma.$transaction(
      entries.map((e) =>
        this.prisma.scopeWasteItem.updateMany({
          where: { id: e.itemId, tenderId },
          data: { sortOrder: e.sortOrder }
        })
      )
    );
    return { reordered: entries.length };
  }

  /**
   * R3 T-1 — waste transport cost engine. Implements
   * docs/architecture/drafts/waste-transport-cost-engine-DRAFT.md section 2.
   *
   * The engine fires only when the line has a transport plant rate picked
   * AND the three sizing inputs (qtyTrucks, loadsPerTruckPerDay,
   * capacityPerLoad) are populated. Otherwise every returned component is
   * null and callers fall back to the legacy ratePerTonne/ratePerLoad
   * path. Fuel this slice is manual/optional: the dailyKm term is 0
   * unless the estimator sets it (T-2/T-3 will wire live prices + map km).
   *
   *   waste_amount    = capacity-side qty (tonnes if capacityUnit="t",
   *                     m3 if capacityUnit="m3"; falls back to whichever
   *                     side has a value).
   *   loads           = ceil(waste_amount / capacityPerLoad)
   *   duration_days   = ceil(loads / qtyTrucks / loadsPerTruckPerDay)
   *   fuel_per_day    = fuelPricePerLitre * fuelConsumptionLPer100km * dailyKm / 100
   *                     (0 when any input missing)
   *   transport_cost  = (transportFeePerDay + fuel_per_day) * duration_days * qtyTrucks
   *   disposal_cost   = waste_amount * disposalRate (resolved via
   *                     RateResolverService "waste" slug - the single price
   *                     source; a decision from R0)
   *   line_total      = transport_cost + disposal_cost
   *
   * quotedDisposalRate and quotedFuelPricePerLitre are the price snapshots
   * the variance flag compares against the current live rate when the
   * line is later viewed.
   */
  private async computeCostEngine(input: {
    qty: number | null | undefined;
    m3: number | null | undefined;
    capacityUnit: string | null | undefined;
    capacityPerLoad: number | null | undefined;
    qtyTrucks: number | null | undefined;
    loadsPerTruckPerDay: number | null | undefined;
    dailyKm: number | null | undefined;
    transportRateId: string | null | undefined;
    assetId: string | null | undefined;
    wasteType: string | null | undefined;
    wasteFacility: string | null | undefined;
  }): Promise<EngineResult> {
    const empty: EngineResult = {
      loads: null,
      durationDays: null,
      transportCost: null,
      fuelCost: null,
      disposalCost: null,
      lineTotal: null,
      quotedDisposalRate: null,
      quotedFuelPricePerLitre: null
    };
    // Engine gate: transport line picked + the three sizing inputs.
    if (
      !input.transportRateId ||
      input.qtyTrucks == null || !(input.qtyTrucks > 0) ||
      input.loadsPerTruckPerDay == null || !(input.loadsPerTruckPerDay > 0) ||
      input.capacityPerLoad == null || !(input.capacityPerLoad > 0)
    ) {
      return empty;
    }
    // Waste amount: choose the side that matches capacityUnit; if the
    // matching side is empty, fall through to the other side so the
    // engine still computes a line when only one side is populated.
    const preferM3 = input.capacityUnit === "m3" || input.capacityUnit === "m³";
    const primary = preferM3 ? input.m3 : input.qty;
    const secondary = preferM3 ? input.qty : input.m3;
    const wasteAmount =
      primary != null && primary > 0
        ? Number(primary)
        : secondary != null && secondary > 0
          ? Number(secondary)
          : null;
    if (wasteAmount == null) return empty;

    const loads = Math.ceil(wasteAmount / Number(input.capacityPerLoad));
    const durationDays = Math.ceil(loads / Number(input.qtyTrucks) / Number(input.loadsPerTruckPerDay));

    // Transport rate row - $/day fee.
    const transportRate = await this.prisma.estimatePlantRate.findUnique({
      where: { id: input.transportRateId }
    });
    if (!transportRate) return empty;
    const transportFeePerDay = Number(transportRate.rate);

    // Fuel per day - manual this slice. Requires the asset's per-truck
    // consumption + the OperationsSettings fuel price + a dailyKm. Any
    // missing input drops the fuel term to 0 (the estimator can still
    // add it as a separate manual override later).
    let fuelPerDay = 0;
    let quotedFuelPricePerLitre: number | null = null;
    if (input.assetId && input.dailyKm != null && input.dailyKm > 0) {
      const [asset, opsSettings] = await Promise.all([
        this.prisma.asset.findUnique({
          where: { id: input.assetId },
          include: { category: true }
        }),
        this.prisma.operationsSettings.findUnique({ where: { id: "singleton" } })
      ]);
      const fuelConsumption =
        asset?.fuelConsumptionLPer100km != null
          ? Number(asset.fuelConsumptionLPer100km)
          : asset?.category?.defaultFuelConsumptionLPer100km != null
            ? Number(asset.category.defaultFuelConsumptionLPer100km)
            : null;
      const fuelPrice =
        opsSettings?.fuelPricePerLitre != null
          ? Number(opsSettings.fuelPricePerLitre)
          : null;
      if (fuelConsumption != null && fuelPrice != null) {
        fuelPerDay = (fuelPrice * fuelConsumption * Number(input.dailyKm)) / 100;
        quotedFuelPricePerLitre = fuelPrice;
      }
    }

    const transportCost =
      (transportFeePerDay + fuelPerDay) * durationDays * Number(input.qtyTrucks);
    const fuelCost = fuelPerDay * durationDays * Number(input.qtyTrucks);

    // Disposal cost - resolve via the rate resolver so we honour the
    // canonical-source flip (R0 decision: one price source).
    let disposalCost: number | null = null;
    let quotedDisposalRate: number | null = null;
    if (input.wasteType && input.wasteFacility) {
      try {
        const resolved = await this.rateResolver.resolveRate("waste", {
          wasteType: input.wasteType,
          facility: input.wasteFacility
        });
        // Bill against the side that matches the rate's unit.
        const disposalQty = resolved.unit === "m³" || resolved.unit === "m3"
          ? (input.m3 != null ? Number(input.m3) : wasteAmount)
          : (input.qty != null ? Number(input.qty) : wasteAmount);
        disposalCost = disposalQty * resolved.value;
        quotedDisposalRate = resolved.value;
      } catch {
        // NotFound - leave disposal null; estimator sees "no rate" in UI.
      }
    }

    const lineTotal =
      Math.round(((transportCost) + (disposalCost ?? 0)) * 100) / 100;

    return {
      loads,
      durationDays,
      transportCost: Math.round(transportCost * 100) / 100,
      fuelCost: Math.round(fuelCost * 100) / 100,
      disposalCost: disposalCost != null ? Math.round(disposalCost * 100) / 100 : null,
      lineTotal,
      quotedDisposalRate,
      quotedFuelPricePerLitre
    };
  }

  /**
   * R3 T-1 - variance check for a single waste line. Returns the
   * current live disposal + fuel rates alongside the snapshots we
   * recorded at pricing time, and a boolean for the UI to render an
   * "escalate this line" flag. Nothing here mutates state; the actual
   * escalation is a separate call (escalateVariance).
   */
  async variance(tenderId: string, itemId: string) {
    const row = await this.prisma.scopeWasteItem.findUnique({ where: { id: itemId } });
    if (!row || row.tenderId !== tenderId) {
      throw new NotFoundException("Waste item not found on this tender.");
    }
    let currentDisposalRate: number | null = null;
    if (row.wasteType && row.wasteFacility) {
      try {
        const resolved = await this.rateResolver.resolveRate("waste", {
          wasteType: row.wasteType,
          facility: row.wasteFacility
        });
        currentDisposalRate = resolved.value;
      } catch {
        currentDisposalRate = null;
      }
    }
    const ops = await this.prisma.operationsSettings.findUnique({ where: { id: "singleton" } });
    const currentFuelPricePerLitre =
      ops?.fuelPricePerLitre != null ? Number(ops.fuelPricePerLitre) : null;
    const quotedDisposalRate =
      row.quotedDisposalRate != null ? Number(row.quotedDisposalRate) : null;
    const quotedFuelPricePerLitre =
      row.quotedFuelPricePerLitre != null ? Number(row.quotedFuelPricePerLitre) : null;
    const disposalDelta =
      currentDisposalRate != null && quotedDisposalRate != null
        ? currentDisposalRate - quotedDisposalRate
        : null;
    const fuelDelta =
      currentFuelPricePerLitre != null && quotedFuelPricePerLitre != null
        ? currentFuelPricePerLitre - quotedFuelPricePerLitre
        : null;
    // Rate is "materially different" if the delta is non-trivially non-zero.
    // Threshold is intentionally strict (>= $0.01 / L or >= $0.50 / t) so
    // we do not flag rounding noise.
    const hasVariance =
      (disposalDelta != null && Math.abs(disposalDelta) >= 0.5) ||
      (fuelDelta != null && Math.abs(fuelDelta) >= 0.01);
    return {
      itemId,
      quotedDisposalRate,
      currentDisposalRate,
      quotedFuelPricePerLitre,
      currentFuelPricePerLitre,
      disposalDelta,
      fuelDelta,
      hasVariance
    };
  }

  /**
   * R3 T-1 - fire the notification trigger for a waste-line rate
   * variance. Creates an in-app Notification for each configured
   * recipient (role- and user-id-based). Idempotent per-caller by
   * design of the notifications service - we do not attempt to
   * deduplicate an estimator clicking the button twice.
   */
  async escalateVariance(tenderId: string, itemId: string, actorId: string) {
    const v = await this.variance(tenderId, itemId);
    const trigger = await this.prisma.notificationTriggerConfig.findUnique({
      where: { trigger: "waste_line.rate_variance_escalated" }
    });
    if (!trigger || !trigger.isEnabled) {
      // Trigger not configured or disabled by admin - swallow silently so
      // the UI can still show the visible variance flag without erroring
      // when the tenant has not opted in.
      return { escalated: false, recipients: 0 };
    }
    const recipients = await this.resolveTriggerRecipients(
      trigger.recipientUserIds,
      trigger.recipientRoles
    );
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { title: true, tenderNumber: true }
    });
    const label = tender?.tenderNumber ?? tender?.title ?? tenderId;
    const delta = [
      v.disposalDelta != null
        ? `disposal $${v.quotedDisposalRate ?? "?"} -> $${v.currentDisposalRate ?? "?"}`
        : null,
      v.fuelDelta != null
        ? `fuel $${v.quotedFuelPricePerLitre ?? "?"}/L -> $${v.currentFuelPricePerLitre ?? "?"}/L`
        : null
    ]
      .filter((s): s is string => s !== null)
      .join(", ") || "no live rate available";
    let sent = 0;
    for (const user of recipients) {
      await this.notifications.create(
        {
          userId: user.id,
          title: `Waste line rate variance on ${label}`,
          body: `Rate changed since quoted (${delta}). Confirm or reprice the line - the system does NOT auto-reprice.`,
          severity: "MEDIUM",
          linkUrl: `/tenders/${tenderId}/scope`
        },
        actorId
      );
      sent += 1;
    }
    return { escalated: true, recipients: sent };
  }

  private async resolveTriggerRecipients(userIds: string[], roleNames: string[]) {
    const users: Array<{ id: string }> = [];
    if (userIds.length > 0) {
      const byId = await this.prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { id: true }
      });
      users.push(...byId);
    }
    if (roleNames.length > 0) {
      const byRole = await this.prisma.user.findMany({
        where: {
          isActive: true,
          userRoles: { some: { role: { name: { in: roleNames } } } }
        },
        select: { id: true }
      });
      users.push(...byRole);
    }
    // Deduplicate.
    const seen = new Set<string>();
    return users.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }

  // CEILING(loads / 3) rounded up to nearest half-day.
  // PR B4a — line total now bills against EITHER tonnes OR m³ depending
  // on the row's unit (which mirrors the facility's rate.unit). The
  // `ratePerTonne` field name is a legacy column name; semantically it's
  // "rate per billing unit" — same number regardless of which side the
  // qty comes from.
  //   unit === "m³":  qtyForBilling = m3,  lineTotal = m3 * ratePerTonne + loads * ratePerLoad
  //   else (default): qtyForBilling = qty, lineTotal = qty * ratePerTonne + loads * ratePerLoad
  //   (`qty` here is the ScopeWasteItem.qty column — previously `wasteTonnes`.)
  private deriveTotals(
    tonnes: number | null | undefined,
    m3: number | null | undefined,
    loads: number | null | undefined,
    ratePerTonne: number | null | undefined,
    ratePerLoad: number | null | undefined,
    unit: string | null | undefined
  ): { truckDays: number | null; lineTotal: number | null } {
    const truckDays =
      loads === null || loads === undefined ? null : Math.ceil((loads / 3) * 2) / 2;
    const qty = unit === "m³" ? m3 : tonnes;
    let lineTotal: number | null = null;
    if ((qty !== null && qty !== undefined && ratePerTonne !== null && ratePerTonne !== undefined) ||
        (loads !== null && loads !== undefined && ratePerLoad !== null && ratePerLoad !== undefined)) {
      const q = qty ?? 0;
      const rt = ratePerTonne ?? 0;
      const l = loads ?? 0;
      const rl = ratePerLoad ?? 0;
      lineTotal = Math.round((q * rt + l * rl) * 100) / 100;
    }
    return { truckDays, lineTotal };
  }

  /**
   * "Sum from above" aggregator. Reads canonical scope items for the
   * card, groups items where wasteIncluded=true by (wasteGroup,
   * wasteItem), sums both `tonnes` and `m3`, picks the first active
   * EstimateWasteRate matching (group, type), and REPLACES the existing
   * autoSummed=true waste rows for the card in a single transaction.
   *
   * Manual rows (autoSummed=false) are untouched. Returns the count of
   * rows replaced and the count of new rows created.
   *
   * PR B4a — the group key dropped `unit` (a single group can now sum
   * across different scope items regardless of how they were
   * dimensioned), the per-row qty is now BOTH tonnes and m³, and the
   * line total bills against whichever side matches the facility's
   * rate.unit. Items missing both tonnes AND m³ are skipped.
   *
   * Existing autoSummed rows that were created under the B3 contract
   * are deleted on first regeneration — see PR body for the migration
   * note (user re-runs Sum from above per card after the upgrade).
   */
  async sumFromAbove(tenderId: string, cardId: string, actorId: string) {
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId },
      select: { id: true, discipline: true }
    });
    if (!card) throw new NotFoundException("Card not found.");

    const [items, rates] = await Promise.all([
      this.prisma.scopeOfWorksItem.findMany({
        where: { tenderId, cardId, status: { not: "excluded" } },
        select: {
          wasteIncluded: true,
          wasteGroup: true,
          wasteItem: true,
          tonnes: true,
          m3: true,
          // PR feat/scope-multi-material — rows 2..N of the material list.
          // Item's contribution to a waste group is the sum of tonnes/m³
          // across the flat row 1 fields AND every entry in materials.
          materials: true
        }
      }),
      this.prisma.estimateWasteRate.findMany({ where: { isActive: true } })
    ]);

    // Aggregate by (wasteGroup, wasteItem). Skip contributions missing
    // the group/item pair or with neither tonnes nor m³.
    //
    // PR feat/scope-material-inline-waste — attribution is now per
    // MATERIAL, not per item. Material 1 (item.tonnes/m3 + item.waste*)
    // and each entry in item.materials contribute independently, each
    // to their OWN (wasteGroup, wasteItem). A single-material item is
    // unchanged (its only contribution is Material 1); a mixed item now
    // splits its tonnage across whatever waste types its materials use.
    type GroupKey = string;
    const totals = new Map<
      GroupKey,
      { wasteGroup: string; wasteType: string; tonnes: number; m3: number }
    >();
    // PR B4a.2 — null-byte delimiter so a group/item pair like
    // ("A B", "C") cannot collide with ("A", "B C"). User input never
    // contains \x00 in practice, but a space delimiter would collapse
    // those two distinct pairs into the same key.
    const addContribution = (
      wasteGroup: string,
      wasteItem: string,
      tonnes: number,
      m3: number
    ) => {
      if (!(tonnes > 0) && !(m3 > 0)) return;
      const key = `${wasteGroup}\x00${wasteItem}`;
      const existing = totals.get(key);
      if (existing) {
        existing.tonnes += tonnes;
        existing.m3 += m3;
      } else {
        totals.set(key, { wasteGroup, wasteType: wasteItem, tonnes, m3 });
      }
    };
    for (const i of items) {
      // Material 1 — item's flat waste columns + flat tonnes/m3.
      if (i.wasteIncluded && i.wasteGroup && i.wasteItem) {
        const tonnes = i.tonnes == null ? 0 : Number(i.tonnes);
        const m3 = i.m3 == null ? 0 : Number(i.m3);
        addContribution(i.wasteGroup, i.wasteItem, tonnes, m3);
      }
      // Material 2..N — each entry carries its own waste classification.
      const materials = Array.isArray(i.materials)
        ? (i.materials as Array<{
            tonnes?: unknown;
            m3?: unknown;
            wasteGroup?: unknown;
            wasteItem?: unknown;
            wasteIncluded?: unknown;
          }>)
        : [];
      for (const m of materials) {
        if (m?.wasteIncluded !== true) continue;
        const wg = typeof m?.wasteGroup === "string" ? m.wasteGroup : null;
        const wi = typeof m?.wasteItem === "string" ? m.wasteItem : null;
        if (!wg || !wi) continue;
        const mt = Number(m?.tonnes);
        const mm = Number(m?.m3);
        const tonnes = Number.isFinite(mt) && mt > 0 ? mt : 0;
        const m3v = Number.isFinite(mm) && mm > 0 ? mm : 0;
        addContribution(wg, wi, tonnes, m3v);
      }
    }

    // Resolve a facility + rate per group, picking the first active
    // (group, type) match. Unit no longer narrows the rate lookup; the
    // billing side comes from the rate's own unit. null when no rate
    // exists; frontend renders the row with an amber warning tint.
    const rowsToInsert = Array.from(totals.values()).map((g, index) => {
      const rate = rates.find(
        (r) => r.wasteGroup === g.wasteGroup && r.wasteType === g.wasteType
      );
      const tonRate = rate ? Number(rate.tonRate) : null;
      const billingUnit = rate?.unit ?? null;
      const qtyForBilling = billingUnit === "m³" ? g.m3 : g.tonnes;
      const lineTotal = tonRate != null ? Math.round(qtyForBilling * tonRate * 100) / 100 : null;
      // Round persisted tonnes/m³ to match Decimal column precision.
      const tonnesRounded = Math.round(g.tonnes * 1000) / 1000;
      const m3Rounded = Math.round(g.m3 * 100) / 100;
      return {
        tenderId,
        cardId,
        discipline: card.discipline,
        wbsRef: null as string | null,
        description: g.wasteType,
        wasteGroup: g.wasteGroup,
        wasteType: g.wasteType,
        wasteFacility: rate?.facility ?? null,
        unit: billingUnit,
        qty: new Prisma.Decimal(tonnesRounded),
        m3: new Prisma.Decimal(m3Rounded),
        wasteLoads: null as number | null,
        truckDays: null as Prisma.Decimal | null,
        ratePerTonne: tonRate != null ? new Prisma.Decimal(tonRate) : null,
        ratePerLoad: null as Prisma.Decimal | null,
        lineTotal: lineTotal != null ? new Prisma.Decimal(lineTotal) : null,
        notes: null as string | null,
        sortOrder: index,
        autoSummed: true,
        createdById: actorId
      };
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.scopeWasteItem.deleteMany({
        where: { tenderId, cardId, autoSummed: true }
      });
      let created = 0;
      for (const data of rowsToInsert) {
        await tx.scopeWasteItem.create({ data });
        created += 1;
      }
      return { replaced: deleted.count, created };
    });

    return result;
  }
}
