import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, QuoteDestination } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications.service";
import { RateResolverService } from "../rates/rate-resolver.service";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { narrowToNumber, toDecimal } from "./scope-of-works.service";
import { decToNum, resolveEffectiveMarkup } from "./scope-item-pricing";
import {
  StraightLineTravelProvider,
  deriveCycle,
  planningMinutes,
  requiredTrips,
  durationDays as deriveDurationDays,
  totalTripKm as deriveTotalTripKm,
  type TravelEstimate,
  type TravelTimeProvider
} from "./travel-time";
import { GeoapifyRouteProvider } from "./providers/geoapify-route.provider";
import { resolveCapacityPerLoad } from "./transport-capacity";

// S8g extended travel estimate: carries the suggestedIndex from Geoapify.
type ExtendedTravelEstimate = TravelEstimate & { suggestedIndex?: number | null };

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
  // SCOPE_QUOTE_DESTINATION_V1 (scopecards-s2a) -- where this waste line goes
  // on the client quote. Optional; defaults PRICE.
  quoteDestination?: QuoteDestination;
  // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- per-line markup override.
  // null clears the override. 0 is a real override (0% markup), NOT an absence.
  markupOverride?: number | null;
  // TRAVEL_TIME_PORT_V1 (scopecards-s8a) -- tip link. null clears it.
  mapLocationId?: string | null;
  // TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9) -- provenance of capacityPerLoad.
  // "manual" when the estimator typed a figure. "matrix" is set by the server
  // when the resolver fills the default; the client does NOT need to send this.
  capacitySource?: string | null;
  // GEOAPIFY_ROUTE_TRAVEL_V1 (scopecards-s8g) -- editable traffic index.
  // null clears a manual override (returns to automatic geoapify suggestion).
  // The index is a MODELLED TRAFFIC ALLOWANCE, not measured peak-hour traffic.
  travelIndex?: number | null;
};

// R3 T-1 — snapshot cost components computed by the engine. Returned by
// computeCostEngine and folded into the row's line_total. When the
// engine cannot fire (missing inputs) every component stays null and the
// row falls back to the legacy ratePerTonne/ratePerLoad path.
type EngineResult = {
  loads: number | null;
  durationDays: number | null;
  // S8g: infeasible-cycle flag (loadsPerDay = 0). When true, loads/duration/cost are null.
  infeasibleCycle: boolean;
  transportCost: number | null;
  fuelCost: number | null;
  disposalCost: number | null;
  lineTotal: number | null;
  quotedDisposalRate: number | null;
  quotedFuelPricePerLitre: number | null;
  // Transport-rate snapshot (SLICE 1, 2026-08-19). The $/day rate from
  // EstimatePlantRate at the moment the line is priced. Returned by
  // computeCostEngine alongside the other two snapshots.
  quotedTransportRatePerDay: number | null;
  // S8g: total route kilometres for the job (trips x 2 x one-way km).
  // Fuel is charged on this, not on dailyKm x duration x trucks.
  totalTripKm: number | null;
};

// PRICING_INPUTS — the set of DTO keys whose presence in a PATCH means we
// must re-run the cost engine and update lineTotal. Keys NOT in this list
// (description, wbsRef, notes, sortOrder, discipline) are metadata-only
// and must NOT trigger a reprice.
//
// When you add a new pricing column to UpsertWasteDto, add it here too.
// Failing to do so will cause a notes-only PATCH to silently re-price the
// line against whatever the plant rate says today (this is the bug this
// set of constants exists to prevent).
const PRICING_INPUTS = new Set<keyof UpsertWasteDto>([
  "qty",
  "m3",
  "unit",
  "wasteLoads",
  "ratePerTonne",
  "ratePerLoad",
  "transportRateId",
  "assetId",
  "qtyTrucks",
  "loadsPerTruckPerDay",
  "capacityPerLoad",
  "capacityUnit",
  "dailyKm",
  "wasteType",
  "wasteFacility",
  // TRAVEL_TIME_PORT_V1 -- a tip change triggers travel re-resolve.
  "mapLocationId",
  // GEOAPIFY_ROUTE_TRAVEL_V1 -- an index change reprices duration and cost.
  "travelIndex",
]);

// TRAVEL_TIME_PORT_V1 -- inputs that trigger a travel re-resolve on update.
// Subset of PRICING_INPUTS; used to decide whether the travel snapshot must
// be refreshed (tip change, or a new create). Site coordinates are stable
// within a tender session and are not tracked here.
// Note: travelIndex does NOT trigger a re-resolve (it's an edit on top of the
// existing snapshot, not a reason to call the API again).
const TRAVEL_INPUTS = new Set<keyof UpsertWasteDto>(["mapLocationId"]);

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
  private readonly logger = new Logger(ScopeWasteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateResolver: RateResolverService,
    private readonly notifications: NotificationsService,
    private readonly apiKeys: ApiKeysService
  ) {}

  /**
   * SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — load the tender's markup.
   * Falls back to 30 when TenderEstimate is absent (same default as summary()).
   */
  private async loadTenderMarkup(tenderId: string): Promise<number> {
    const est = await this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } });
    return est ? Number(est.markup) : 30;
  }

  /**
   * SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — augment a waste row with
   * effectiveMarkup and lineTotalWithMarkup. cardWasteOverride is the card's
   * wasteMarkupOverride (null = not set); tenderMarkup is the tender's markup.
   */
  private augmentWasteMoney<T extends {
    lineTotal: Prisma.Decimal | null;
    markupOverride: Prisma.Decimal | null;
  }>(row: T, cardWasteOverride: number | null, tenderMarkup: number): T & {
    effectiveMarkup: number;
    lineTotalWithMarkup: number;
  } {
    const lineMarkupOverride = decToNum(row.markupOverride);
    const effectiveMarkup = resolveEffectiveMarkup(lineMarkupOverride, cardWasteOverride, tenderMarkup);
    const lt = row.lineTotal != null ? Number(row.lineTotal) : 0;
    const lineTotalWithMarkup = lt * (1 + effectiveMarkup / 100);
    return {
      ...row,
      effectiveMarkup: Number(effectiveMarkup.toFixed(2)),
      lineTotalWithMarkup: Number(lineTotalWithMarkup.toFixed(2))
    };
  }

  /**
   * Lists waste rows for a tender, optionally filtered by discipline
   * and/or cardId, ordered by discipline, sortOrder, createdAt.
   *
   * When cardId is supplied, only rows attached to that card are
   * returned — cardless legacy rows are deliberately excluded.
   *
   * SCOPE_LINE_MARKUP_ALL_TYPES_V1: each row now also carries
   * `effectiveMarkup` and `lineTotalWithMarkup` computed server-side.
   *
   * @param opts - optional `discipline` and/or `cardId` filters
   * @returns matching ScopeWasteItem rows (with money fields)
   */
  async list(tenderId: string, opts?: { discipline?: string; cardId?: string }) {
    const [rows, tenderMarkup] = await Promise.all([
      this.prisma.scopeWasteItem.findMany({
        where: {
          tenderId,
          ...(opts?.discipline ? { discipline: opts.discipline } : {}),
          // PR B3 — when cardId is supplied, return ONLY rows attached
          // to that card. Cardless legacy rows are deliberately excluded
          // (covered by Q7 in B3 investigation — follow-up cleanup).
          ...(opts?.cardId ? { cardId: opts.cardId } : {})
        },
        orderBy: [{ discipline: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        include: { card: { select: { wasteMarkupOverride: true } } }
      }),
      this.loadTenderMarkup(tenderId)
    ]);
    return rows.map((row) => {
      const cardWasteOverride = row.card?.wasteMarkupOverride != null ? Number(row.card.wasteMarkupOverride) : null;
      return this.augmentWasteMoney(row, cardWasteOverride, tenderMarkup);
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
    let capacityPerLoadN = narrowToNumber(dto.capacityPerLoad);
    const dailyKmN = narrowToNumber(dto.dailyKm);

    // TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9) -- when the estimator has
    // NOT typed a capacity figure, try to fill it from the matrix using the
    // plant rate's transport type and the line's waste group. A typed figure
    // always wins (capacityPerLoadN != null). Matrix fill only fires when:
    //   1. capacityPerLoadN is null (no typed figure)
    //   2. transportRateId is set (a rig is linked)
    //   3. the rig has a transportType set
    //   4. the line has a wasteGroup
    // Returns null when any of those conditions are unmet, or on any error.
    let capacitySource: string | null = dto.capacitySource ?? null;
    if (capacityPerLoadN == null && dto.transportRateId) {
      const plantRate = await this.prisma.estimatePlantRate.findUnique({
        where: { id: dto.transportRateId },
        select: { transportType: true }
      });
      if (plantRate?.transportType) {
        const resolved = await resolveCapacityPerLoad(this.rateResolver, {
          wasteGroup: dto.wasteGroup ?? null,
          transportType: plantRate.transportType,
          capacityUnit: dto.capacityUnit ?? null
        });
        if (resolved !== null) {
          capacityPerLoadN = resolved.capacity;
          capacitySource = "matrix";
        }
      }
    } else if (capacityPerLoadN != null && dto.capacitySource === undefined) {
      // Estimator typed a figure explicitly -- mark it as manual.
      capacitySource = "manual";
    }

    // S8g: Resolve travel BEFORE the engine so the first save has consistent
    // loads, duration, km, fuel and total.
    // TRAVEL_TIME_PORT_V1 -- resolve travel when the line has a tip link.
    // Never throws; a null estimate means no snapshot is stored.
    let travelEstimate: ExtendedTravelEstimate | null = null;
    if (dto.mapLocationId) {
      travelEstimate = await this.resolveTravelEstimate(dto.mapLocationId, tenderId) as ExtendedTravelEstimate | null;
    }

    // S8g: derive traffic index, planning minutes, loadsPerDay, totalTripKm.
    // A typed travelIndex from the DTO wins over the suggested one from Geoapify.
    const s8g = this.deriveS8gFields({
      travelEstimate,
      dtoTravelIndex: dto.travelIndex,
      dtoLoadsPerTruckPerDay: loadsPerTruckPerDayN,
      dtoDailyKm: dailyKmN,
      dtoQtyTrucks: qtyTrucksN != null ? Math.trunc(qtyTrucksN) : null,
      capacityPerLoad: capacityPerLoadN,
      // qty for required-trips calc
      qty: tonnesN,
      m3: m3N,
      capacityUnit: dto.capacityUnit ?? null,
      tipTurnaroundMinutes: null // loaded inside the function from DB on first call
    });

    // Load opsSettings once for both S8g defaults and the engine fuel calc.
    const settings = await this.prisma.operationsSettings.findUnique({
      where: { id: "singleton" },
      select: { tipTurnaroundMinutes: true }
    });
    const tipTurnaround = settings?.tipTurnaroundMinutes ?? 30;

    // Recompute S8g with the actual tipTurnaround.
    const s8gFull = this.deriveS8gFields({
      travelEstimate,
      dtoTravelIndex: dto.travelIndex,
      dtoLoadsPerTruckPerDay: loadsPerTruckPerDayN,
      dtoDailyKm: dailyKmN,
      dtoQtyTrucks: qtyTrucksN != null ? Math.trunc(qtyTrucksN) : null,
      capacityPerLoad: capacityPerLoadN,
      qty: tonnesN,
      m3: m3N,
      capacityUnit: dto.capacityUnit ?? null,
      tipTurnaroundMinutes: tipTurnaround
    });

    const effectiveLoadsPerTruckPerDay = s8gFull.effectiveLoadsPerTruckPerDay;
    const effectiveDailyKm = s8gFull.effectiveDailyKm;

    // R3 T-1 - engine fires when a transport line is picked (transportRateId set)
    // AND we have qtyTrucks + loadsPerTruckPerDay + capacityPerLoad. If ANY are
    // missing the engine returns nulls and we fall back to the legacy path.
    // quotedTransportRatePerDay is null on create (no prior snapshot exists).
    const engine = await this.computeCostEngine({
      qty: tonnesN,
      m3: m3N,
      capacityUnit: dto.capacityUnit ?? null,
      capacityPerLoad: capacityPerLoadN,
      qtyTrucks: qtyTrucksN != null ? Math.trunc(qtyTrucksN) : null,
      loadsPerTruckPerDay: effectiveLoadsPerTruckPerDay,
      // S8g: pass totalTripKm for fuel arithmetic; dailyKm stays stored but no longer drives fuel.
      totalTripKm: s8gFull.totalTripKm,
      dailyKm: effectiveDailyKm,
      transportRateId: dto.transportRateId ?? null,
      assetId: dto.assetId ?? null,
      wasteType: dto.wasteType ?? null,
      wasteFacility: dto.wasteFacility ?? null,
      existingQuotedTransportRatePerDay: null,
      // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId for snapshot lookup.
      tenderId
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
    const created = await this.prisma.scopeWasteItem.create({
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
        loadsPerTruckPerDay: toDecimal(effectiveLoadsPerTruckPerDay),
        capacityPerLoad: toDecimal(capacityPerLoadN),
        capacityUnit: dto.capacityUnit ?? null,
        // TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9) -- record provenance.
        capacitySource: capacitySource,
        dailyKm: toDecimal(effectiveDailyKm),
        dailyKmSource: s8gFull.dailyKmSource,
        transportCost: toDecimal(engine.transportCost),
        fuelCost: toDecimal(engine.fuelCost),
        disposalCost: toDecimal(engine.disposalCost),
        quotedDisposalRate: toDecimal(engine.quotedDisposalRate),
        quotedFuelPricePerLitre: toDecimal(engine.quotedFuelPricePerLitre),
        quotedTransportRatePerDay: toDecimal(engine.quotedTransportRatePerDay),
        notes: dto.notes ?? null,
        sortOrder: dto.sortOrder ?? 0,
        // SCOPE_QUOTE_DESTINATION_V1 -- defaults PRICE when absent.
        quoteDestination: dto.quoteDestination ?? QuoteDestination.PRICE,
        // PR B3 — manual creates default autoSummed=false. Only
        // sumFromAbove flips this to true on aggregator-created rows.
        autoSummed: false,
        createdById: actorId,
        // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- null when absent.
        markupOverride: dto.markupOverride !== undefined && dto.markupOverride !== null
          ? toDecimal(dto.markupOverride)
          : null,
        // TRAVEL_TIME_PORT_V1 (scopecards-s8a) -- tip link + snapshot.
        mapLocationId: dto.mapLocationId ?? null,
        travelKm: travelEstimate !== null ? toDecimal(travelEstimate.km) : null,
        travelMinutesOneWay: travelEstimate?.minutesOneWay ?? null,
        travelSource: travelEstimate?.source ?? null,
        travelDetail: travelEstimate?.detail ?? null,
        travelResolvedAt: travelEstimate?.resolvedAt ?? null,
        // GEOAPIFY_ROUTE_TRAVEL_V1 (scopecards-s8g) -- index, planning minutes, total km.
        travelIndex: s8gFull.travelIndex !== null ? toDecimal(s8gFull.travelIndex) : null,
        travelIndexSource: s8gFull.travelIndexSource,
        travelPlanningMinutesOneWay: s8gFull.planningMinutesOneWay,
        totalTripKm: engine.totalTripKm !== null ? toDecimal(engine.totalTripKm) : null,
        loadsSource: engine.infeasibleCycle ? "cycle" : (engine.loads !== null ? "cycle" : null)
      },
      include: { card: { select: { wasteMarkupOverride: true } } }
    });
    const tenderMarkup = await this.loadTenderMarkup(tenderId);
    const cardWasteOverride = created.card?.wasteMarkupOverride != null ? Number(created.card.wasteMarkupOverride) : null;
    return this.augmentWasteMoney(created, cardWasteOverride, tenderMarkup);
  }

  /**
   * Partially updates a waste row; DTO values win over existing values
   * when present. The cost engine (truckDays, lineTotal, snapshot
   * components) is ONLY re-run when the PATCH touches at least one
   * pricing input (see PRICING_INPUTS constant). A PATCH that only
   * changes description / wbsRef / notes / sortOrder / discipline
   * leaves lineTotal and every cost component exactly as they were —
   * this prevents the silent-reprice bug where a notes edit would
   * re-price the line against whatever the plant rate says today.
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

    // Determine whether any pricing input was touched. Only when true do
    // we re-run the cost engine and overwrite lineTotal / cost components.
    const pricingTouched = (Object.keys(dto) as Array<keyof UpsertWasteDto>).some(
      (key) => PRICING_INPUTS.has(key)
    );

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
    // TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9) -- capacity resolution on update.
    // Three cases:
    //   a) DTO carries a non-null capacityPerLoad -> typed figure, mark "manual".
    //   b) DTO carries capacityPerLoad: null (explicit clear) -> try matrix fill.
    //   c) DTO does not include capacityPerLoad -> keep existing, no change.
    let resolvedCapacitySource: string | null | undefined = undefined; // undefined = don't write
    if (dtoCapacityPerLoadN !== undefined) {
      if (dtoCapacityPerLoadN !== null) {
        // Case a: typed figure. Write it and mark as manual.
        data.capacityPerLoad = toDecimal(dtoCapacityPerLoadN);
        resolvedCapacitySource = "manual";
      } else {
        // Case b: explicit clear. Try matrix fill.
        const eTransportRateId = dto.transportRateId !== undefined
          ? dto.transportRateId
          : existing.transportRateId;
        const eCapacityUnit = dto.capacityUnit !== undefined
          ? dto.capacityUnit
          : existing.capacityUnit;
        const eWasteGroup = dto.wasteGroup !== undefined
          ? dto.wasteGroup
          : existing.wasteGroup;
        let matrixCapacity: number | null = null;
        if (eTransportRateId) {
          const plantRate = await this.prisma.estimatePlantRate.findUnique({
            where: { id: eTransportRateId },
            select: { transportType: true }
          });
          if (plantRate?.transportType) {
            const resolved = await resolveCapacityPerLoad(this.rateResolver, {
              wasteGroup: eWasteGroup ?? null,
              transportType: plantRate.transportType,
              capacityUnit: eCapacityUnit ?? null
            });
            if (resolved !== null) {
              matrixCapacity = resolved.capacity;
            }
          }
        }
        data.capacityPerLoad = toDecimal(matrixCapacity);
        resolvedCapacitySource = matrixCapacity !== null ? "matrix" : null;
      }
    } else if (dto.capacitySource !== undefined) {
      // DTO explicitly sets capacitySource (rare -- the client can override provenance).
      resolvedCapacitySource = dto.capacitySource ?? null;
    }
    if (resolvedCapacitySource !== undefined) {
      data.capacitySource = resolvedCapacitySource;
    }
    if (dto.capacityUnit !== undefined) data.capacityUnit = dto.capacityUnit;
    if (dtoDailyKmN !== undefined) {
      data.dailyKm = toDecimal(dtoDailyKmN);
      // When the estimator explicitly types a dailyKm, mark provenance as manual.
      // When they clear it (null), mark as derived (will be recalculated below).
      data.dailyKmSource = dtoDailyKmN !== null ? "manual" : "derived";
    }
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    // SCOPE_QUOTE_DESTINATION_V1 -- only overwrite when the DTO carries it.
    if (dto.quoteDestination !== undefined) data.quoteDestination = dto.quoteDestination;
    // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) -- only overwrite when the DTO carries it.
    // null clears the override; 0 is a real 0% (stored as Decimal 0.00).
    if (dto.markupOverride !== undefined) {
      data.markupOverride = dto.markupOverride !== null ? toDecimal(dto.markupOverride) : null;
    }
    // TRAVEL_TIME_PORT_V1 (scopecards-s8a) -- tip link.
    // Always write the FK when the DTO carries mapLocationId (null clears it).
    if (dto.mapLocationId !== undefined) {
      data.mapLocation = dto.mapLocationId
        ? { connect: { id: dto.mapLocationId } }
        : { disconnect: true };
    }
    // GEOAPIFY_ROUTE_TRAVEL_V1 (scopecards-s8g) -- editable traffic index.
    // DTO carries travelIndex -> manual. null -> return to automatic.
    if (dto.travelIndex !== undefined) {
      if (dto.travelIndex !== null) {
        data.travelIndex = toDecimal(dto.travelIndex);
        data.travelIndexSource = "manual";
      } else {
        // Clear manual override -- let the next re-resolve fill it.
        data.travelIndex = null;
        data.travelIndexSource = null;
      }
    }

    // TRAVEL_TIME_PORT_V1 -- re-resolve travel when the tip changed.
    // Also re-resolve on a create-like path where existingMapLocationId is null.
    const travelInputTouched = (Object.keys(dto) as Array<keyof UpsertWasteDto>).some(
      (key) => TRAVEL_INPUTS.has(key)
    );
    const effectiveMapLocationId =
      dto.mapLocationId !== undefined ? dto.mapLocationId : existing.mapLocationId;

    let updateTravelEstimate: ExtendedTravelEstimate | null | undefined = undefined; // undefined = don't touch
    if (travelInputTouched) {
      if (effectiveMapLocationId) {
        updateTravelEstimate = await this.resolveTravelEstimate(effectiveMapLocationId, tenderId) as ExtendedTravelEstimate | null;
      } else {
        // Tip was cleared -- clear the snapshot too.
        updateTravelEstimate = null;
      }
    }

    // Load opsSettings for tipTurnaround (used by S8g derivation).
    const opsSettings = await this.prisma.operationsSettings.findUnique({
      where: { id: "singleton" },
      select: { tipTurnaroundMinutes: true }
    });
    const tipTurnaround = opsSettings?.tipTurnaroundMinutes ?? 30;

    // When travel was re-resolved, apply derived defaults for empty fields.
    // "Typed figure always wins": only fill when the field is absent from the
    // DTO AND not already set on the existing row.
    if (updateTravelEstimate !== undefined && updateTravelEstimate !== null) {
      // For update, "typed" means either the DTO brought a value OR the row
      // already has a non-null value that was not cleared this PATCH.
      const existingLoads = existing.loadsPerTruckPerDay != null
        ? Number(existing.loadsPerTruckPerDay)
        : null;
      const existingDailyKm = existing.dailyKm != null ? Number(existing.dailyKm) : null;
      const dtoLoads = dtoLoadsPerTruckPerDayN; // undefined if DTO didn't carry it
      const dtoDailyKm = dtoDailyKmN; // undefined if DTO didn't carry it

      // Determine effective travelIndex for S8g (DTO wins, then existing, then suggested).
      const effectiveTravelIndex = dto.travelIndex !== undefined
        ? dto.travelIndex
        : existing.travelIndex != null
          ? Number(existing.travelIndex)
          : null;

      // S8g: when tip changed, update the suggested index from new route.
      // Only set if the estimator hasn't typed one (or cleared it this PATCH).
      const indexSource = dto.travelIndex !== undefined
        ? (dto.travelIndex !== null ? "manual" : null)
        : existing.travelIndexSource;

      if (updateTravelEstimate.suggestedIndex != null && indexSource !== "manual" && dto.travelIndex === undefined) {
        // New route has a suggested index and no manual override exists -- apply it.
        data.travelIndex = toDecimal(updateTravelEstimate.suggestedIndex);
        data.travelIndexSource = "geoapify";
      } else if (dto.travelIndex !== undefined) {
        // Already handled above.
      } else if (existing.travelIndex == null && updateTravelEstimate.suggestedIndex == null) {
        data.travelIndexSource = "none";
      }

      // S8g: compute planning minutes from effective index.
      const resolvedIndex = data.travelIndex != null
        ? Number(data.travelIndex)
        : effectiveTravelIndex ?? 1.0;
      const planMins = planningMinutes({ baseline: updateTravelEstimate.minutesOneWay, index: resolvedIndex });
      data.travelPlanningMinutesOneWay = planMins;

      // Derive loadsPerDay from planning minutes.
      const { loadsPerDay } = deriveCycle({ minutesOneWay: planMins, tipTurnaroundMinutes: tipTurnaround });

      // Field is "empty" when DTO left it undefined AND existing row has no value.
      const loadsIsEmpty = dtoLoads === undefined && existingLoads === null;
      const dailyKmIsEmpty = dtoDailyKm === undefined && existingDailyKm === null;

      if (loadsIsEmpty) {
        data.loadsPerTruckPerDay = toDecimal(loadsPerDay);
        data.loadsSource = loadsPerDay === 0 ? "cycle" : "cycle";
      }
      if (dailyKmIsEmpty) {
        // dailyKm = loadsPerDay * 2 * one-way km (S8g: stored but no longer drives fuel directly)
        const derivedDKm = loadsPerDay * 2 * updateTravelEstimate.km;
        data.dailyKm = toDecimal(derivedDKm);
        data.dailyKmSource = "derived";
      }
    }

    // Write travel snapshot when it was resolved (null = clear it).
    if (updateTravelEstimate !== undefined) {
      if (updateTravelEstimate !== null) {
        data.travelKm = toDecimal(updateTravelEstimate.km);
        data.travelMinutesOneWay = updateTravelEstimate.minutesOneWay;
        data.travelSource = updateTravelEstimate.source;
        data.travelDetail = updateTravelEstimate.detail;
        data.travelResolvedAt = updateTravelEstimate.resolvedAt;
        // If no index was set yet and we got a suggestion, record it.
        if (data.travelIndex === undefined && updateTravelEstimate.suggestedIndex != null) {
          const existingIsManual = existing.travelIndexSource === "manual";
          if (!existingIsManual) {
            data.travelIndex = toDecimal(updateTravelEstimate.suggestedIndex);
            data.travelIndexSource = "geoapify";
          }
        } else if (data.travelIndex === undefined && updateTravelEstimate.suggestedIndex == null) {
          data.travelIndex = null;
          data.travelIndexSource = "none";
        }
        // If not already set, compute planning minutes from the now-effective index.
        if (data.travelPlanningMinutesOneWay === undefined) {
          const idx = data.travelIndex != null
            ? Number(data.travelIndex)
            : existing.travelIndex != null
              ? Number(existing.travelIndex)
              : 1.0;
          data.travelPlanningMinutesOneWay = planningMinutes({ baseline: updateTravelEstimate.minutesOneWay, index: idx });
        }
      } else {
        // Tip cleared -- clear all travel snapshot and S8g fields.
        data.travelKm = null;
        data.travelMinutesOneWay = null;
        data.travelSource = null;
        data.travelDetail = null;
        data.travelResolvedAt = null;
        data.travelIndex = null;
        data.travelIndexSource = null;
        data.travelPlanningMinutesOneWay = null;
        data.totalTripKm = null;
        data.loadsSource = null;
      }
    }

    // When a travelIndex is being changed (but NOT a tip change), we need to
    // recompute planning minutes from the existing travel baseline.
    if (dto.travelIndex !== undefined && !travelInputTouched && updateTravelEstimate === undefined) {
      const baseline = existing.travelMinutesOneWay ?? null;
      if (baseline !== null) {
        const idx = dto.travelIndex !== null ? dto.travelIndex : 1.0;
        data.travelPlanningMinutesOneWay = planningMinutes({ baseline, index: idx });
      }
    }

    if (pricingTouched) {
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
      // Use the possibly-derived value if it was written into data above.
      const eLoadsPerTruckPerDay = dtoLoadsPerTruckPerDayN !== undefined
        ? dtoLoadsPerTruckPerDayN
        : (data.loadsPerTruckPerDay != null
            ? Number(data.loadsPerTruckPerDay)
            : (existing.loadsPerTruckPerDay ? Number(existing.loadsPerTruckPerDay) : null));
      // TRANSPORT_CAPACITY_MATRIX_V1 -- use the resolved capacity (which may have
      // been filled from the matrix if the DTO sent capacityPerLoad: null).
      // data.capacityPerLoad was written by the resolution block above when case b applied.
      const eCapacityPerLoad = dtoCapacityPerLoadN !== undefined
        ? (dtoCapacityPerLoadN ?? (data.capacityPerLoad != null ? Number(data.capacityPerLoad) : null))
        : (existing.capacityPerLoad ? Number(existing.capacityPerLoad) : null);
      const eCapacityUnit = dto.capacityUnit !== undefined ? dto.capacityUnit : existing.capacityUnit;
      const eDailyKm = dtoDailyKmN !== undefined
        ? dtoDailyKmN
        : (data.dailyKm != null
            ? Number(data.dailyKm)
            : (existing.dailyKm ? Number(existing.dailyKm) : null));
      const eWasteType = dto.wasteType !== undefined ? dto.wasteType : existing.wasteType;
      const eWasteFacility = dto.wasteFacility !== undefined ? dto.wasteFacility : existing.wasteFacility;

      // S8g: compute totalTripKm for the engine.
      // Use the planning minutes for loadsPerDay (if we have them).
      const ePlanningMinutes = data.travelPlanningMinutesOneWay !== undefined
        ? data.travelPlanningMinutesOneWay
        : (existing.travelPlanningMinutesOneWay ?? null);
      const eTravelKm = updateTravelEstimate !== undefined && updateTravelEstimate !== null
        ? updateTravelEstimate.km
        : (existing.travelKm != null ? Number(existing.travelKm) : null);

      // Compute totalTripKm: trips x 2 x one-way km.
      let eTotalTripKm: number | null = null;
      if (eTravelKm !== null && eCapacityPerLoad != null && eCapacityPerLoad > 0) {
        const preferM3 = eCapacityUnit === "m3" || eCapacityUnit === "m³";
        const primary = preferM3 ? m3 : tonnes;
        const secondary = preferM3 ? tonnes : m3;
        const wasteAmt = primary != null && primary > 0 ? primary : (secondary != null && secondary > 0 ? secondary : null);
        if (wasteAmt != null) {
          const trips = requiredTrips({ quantity: wasteAmt, capacityPerLoad: eCapacityPerLoad });
          eTotalTripKm = deriveTotalTripKm({ trips, oneWayKm: eTravelKm });
          data.totalTripKm = toDecimal(eTotalTripKm);
        }
      }

      // S8g: also update planning minutes-derived loadsPerDay if
      // loadsPerTruckPerDay is "cycle" source AND planning minutes changed.
      const existingLoadsSource = existing.loadsSource;
      const existingIsManualLoads = existingLoadsSource === "manual" || dtoLoadsPerTruckPerDayN !== undefined;
      if (!existingIsManualLoads && ePlanningMinutes !== null && eLoadsPerTruckPerDay !== null) {
        // loadsPerDay was cycle-derived -- may need refresh if planning minutes changed.
        // Only refresh when data.travelPlanningMinutesOneWay was written (meaning it changed).
        if (data.travelPlanningMinutesOneWay !== undefined) {
          // ePlanningMinutes was resolved from data.travelPlanningMinutesOneWay
          // (which we set as a plain int in this write path) or from existing.
          // Narrow the Prisma update-input union back to number for deriveCycle.
          const planMinsNum =
            typeof ePlanningMinutes === "number" ? ePlanningMinutes : Number(ePlanningMinutes);
          const { loadsPerDay } = deriveCycle({ minutesOneWay: planMinsNum, tipTurnaroundMinutes: tipTurnaround });
          data.loadsPerTruckPerDay = toDecimal(loadsPerDay);
          data.loadsSource = "cycle";
        }
      }

      // Pass the existing snapshot so the engine can re-use it when the
      // transport rate hasn't changed (snapshot-present -> use it).
      // If transportRateId changed in this PATCH, clear the snapshot so
      // the engine fetches and records the new live rate.
      const transportRateChanged =
        dto.transportRateId !== undefined &&
        dto.transportRateId !== existing.transportRateId;
      const existingQuotedTransportRatePerDay =
        !transportRateChanged && existing.quotedTransportRatePerDay != null
          ? Number(existing.quotedTransportRatePerDay)
          : null;

      // Re-read effective loadsPerTruckPerDay after S8g may have written it.
      const finalLoadsPerTruckPerDay = data.loadsPerTruckPerDay != null
        ? Number(data.loadsPerTruckPerDay)
        : eLoadsPerTruckPerDay;

      const engine = await this.computeCostEngine({
        qty: tonnes,
        m3: m3,
        capacityUnit: eCapacityUnit,
        capacityPerLoad: eCapacityPerLoad,
        qtyTrucks: eQtyTrucks,
        loadsPerTruckPerDay: finalLoadsPerTruckPerDay,
        totalTripKm: eTotalTripKm,
        dailyKm: eDailyKm,
        transportRateId: eTransportRateId,
        assetId: eAssetId,
        wasteType: eWasteType,
        wasteFacility: eWasteFacility,
        existingQuotedTransportRatePerDay,
        // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId for snapshot lookup.
        tenderId
      });
      const legacy = this.deriveTotals(tonnes, m3, loads, ratePerTonne, ratePerLoad, unit);
      const effectiveLineTotal =
        engine.lineTotal != null ? engine.lineTotal : legacy.lineTotal;

      // Engine result: engine.loads / durationDays override the legacy path
      // when the engine fires. Otherwise keep the legacy /3 truck-days value.
      if (engine.loads != null) data.wasteLoads = engine.loads;
      data.truckDays = toDecimal(
        engine.durationDays != null ? engine.durationDays : legacy.truckDays
      );
      data.lineTotal = toDecimal(effectiveLineTotal);
      // Engine snapshot components -- re-derived on every pricing write.
      data.transportCost = toDecimal(engine.transportCost);
      data.fuelCost = toDecimal(engine.fuelCost);
      data.disposalCost = toDecimal(engine.disposalCost);
      data.quotedDisposalRate = toDecimal(engine.quotedDisposalRate);
      data.quotedFuelPricePerLitre = toDecimal(engine.quotedFuelPricePerLitre);
      data.quotedTransportRatePerDay = toDecimal(engine.quotedTransportRatePerDay);
      // S8g: persist totalTripKm from engine (may differ if engine recomputed trips).
      if (engine.totalTripKm !== null) {
        data.totalTripKm = toDecimal(engine.totalTripKm);
      }
      if (engine.infeasibleCycle) {
        data.loadsSource = "cycle";
      }
    }
    // When pricingTouched is false: lineTotal, truckDays, transportCost,
    // fuelCost, disposalCost, and all snapshot columns are NOT written.
    // The row keeps exactly the values it had before the PATCH.

    const updated = await this.prisma.scopeWasteItem.update({
      where: { id },
      data,
      include: { card: { select: { wasteMarkupOverride: true } } }
    });
    const tenderMarkup = await this.loadTenderMarkup(tenderId);
    const cardWasteOverride = updated.card?.wasteMarkupOverride != null ? Number(updated.card.wasteMarkupOverride) : null;
    return this.augmentWasteMoney(updated, cardWasteOverride, tenderMarkup);
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
    // S8g: totalTripKm drives fuel when present. dailyKm is kept for storage.
    totalTripKm?: number | null;
    dailyKm: number | null | undefined;
    transportRateId: string | null | undefined;
    assetId: string | null | undefined;
    wasteType: string | null | undefined;
    wasteFacility: string | null | undefined;
    // Transport-rate snapshot (SLICE 1). When present, the engine uses it
    // as transportFeePerDay instead of looking up the live rate. This
    // means: on the FIRST write (create, or first pricing write after
    // migration), existingQuotedTransportRatePerDay is null and the live
    // rate is used and returned for persistence. On subsequent writes the
    // snapshot is preserved as-is. When the estimator explicitly changes
    // transportRateId the snapshot is cleared (null) by the caller so the
    // engine re-fetches and records the new live rate.
    existingQuotedTransportRatePerDay: number | null;
    // SLICE 2 (SNAPSHOT_LIST_APPLIED) -- tender id for snapshot lookup.
    tenderId?: string | null;
  }): Promise<EngineResult> {
    const empty: EngineResult = {
      loads: null,
      durationDays: null,
      infeasibleCycle: false,
      transportCost: null,
      fuelCost: null,
      disposalCost: null,
      lineTotal: null,
      quotedDisposalRate: null,
      quotedFuelPricePerLitre: null,
      quotedTransportRatePerDay: null,
      totalTripKm: null
    };
    // Engine gate: transport line picked + the three sizing inputs.
    if (
      !input.transportRateId ||
      input.qtyTrucks == null || !(input.qtyTrucks > 0) ||
      input.capacityPerLoad == null || !(input.capacityPerLoad > 0)
    ) {
      return empty;
    }
    // S8g: distinguish "not-yet-configured" (null) from "infeasible" (0).
    // null = no cycle derivation has happened yet (line hasn't been priced
    //        against a resolved route); return empty, unflagged.
    // 0    = deriveCycle returned 0 -- cycle exceeds the shift, so no
    //        loads-per-day is achievable. Flag infeasibleCycle; no division.
    if (input.loadsPerTruckPerDay == null) {
      return empty;
    }
    if (input.loadsPerTruckPerDay === 0) {
      return { ...empty, infeasibleCycle: true };
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

    // S8g: use requiredTrips (ceil) for trips, not loads directly.
    const loads = requiredTrips({ quantity: wasteAmount, capacityPerLoad: Number(input.capacityPerLoad) });
    const durationResult = deriveDurationDays({
      trips: loads,
      trucks: Number(input.qtyTrucks),
      loadsPerDay: Number(input.loadsPerTruckPerDay)
    });
    if ("infeasibleCycle" in durationResult) {
      return { ...empty, infeasibleCycle: true };
    }
    const durationDays = durationResult.durationDays;

    // S8g: totalTripKm = trips x 2 x one-way km (if available).
    const computedTotalTripKm = input.totalTripKm != null
      ? input.totalTripKm
      : null;

    // Transport rate row - $/day fee.
    // Precedence: snapshot present -> use it (price at quote time).
    // Snapshot absent -> look up live, and the returned
    // quotedTransportRatePerDay will be persisted as the new snapshot.
    let transportFeePerDay: number;
    let quotedTransportRatePerDay: number;
    if (input.existingQuotedTransportRatePerDay != null) {
      // Use the existing snapshot — do NOT touch the live rate.
      transportFeePerDay = input.existingQuotedTransportRatePerDay;
      quotedTransportRatePerDay = input.existingQuotedTransportRatePerDay;
    } else {
      const transportRate = await this.prisma.estimatePlantRate.findUnique({
        where: { id: input.transportRateId }
      });
      if (!transportRate) return empty;
      transportFeePerDay = Number(transportRate.rate);
      quotedTransportRatePerDay = transportFeePerDay;
    }

    // S8g: Fuel is charged on TOTAL TRIP KM (trips x 2 x one-way km),
    // not on dailyKm x durationDays x trucks.
    // fuelCost = fuelPrice * consumption / 100 * totalTripKm (whole job, once)
    // dailyKm stays stored and available for display, but no longer drives fuel.
    // When totalTripKm is unavailable (no route yet), fall back to dailyKm
    // x durationDays x trucks for backward compatibility (pre-S8g lines).
    let fuelCostTotal = 0;
    let quotedFuelPricePerLitre: number | null = null;
    if (input.assetId) {
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
        quotedFuelPricePerLitre = fuelPrice;
        if (computedTotalTripKm != null && computedTotalTripKm > 0) {
          // S8g path: fuel on total trip km, once for the whole job.
          fuelCostTotal = (fuelPrice * fuelConsumption * computedTotalTripKm) / 100;
        } else if (input.dailyKm != null && input.dailyKm > 0) {
          // Pre-S8g / no-route fallback: per-day x duration x trucks.
          const fuelPerDay = (fuelPrice * fuelConsumption * Number(input.dailyKm)) / 100;
          fuelCostTotal = fuelPerDay * durationDays * Number(input.qtyTrucks);
        }
      }
    }

    const transportCost =
      (transportFeePerDay * durationDays * Number(input.qtyTrucks)) + fuelCostTotal;
    const fuelCost = fuelCostTotal;

    // Disposal cost - resolve via the rate resolver so we honour the
    // canonical-source flip (R0 decision: one price source).
    // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId so locked-rate
    // snapshots are applied when this tender has a TenderRateSet.
    let disposalCost: number | null = null;
    let quotedDisposalRate: number | null = null;
    if (input.wasteType && input.wasteFacility) {
      try {
        const resolved = await this.rateResolver.resolveRate("waste", {
          wasteType: input.wasteType,
          facility: input.wasteFacility
        }, input.tenderId ? { tenderId: input.tenderId } : undefined);
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
      infeasibleCycle: false,
      transportCost: Math.round(transportCost * 100) / 100,
      fuelCost: Math.round(fuelCost * 100) / 100,
      disposalCost: disposalCost != null ? Math.round(disposalCost * 100) / 100 : null,
      lineTotal,
      quotedDisposalRate,
      quotedFuelPricePerLitre,
      quotedTransportRatePerDay,
      totalTripKm: computedTotalTripKm !== null ? Math.round(computedTotalTripKm * 100) / 100 : null
    };
  }

  /**
   * R3 T-1 - variance check for a single waste line. Returns the
   * current live disposal + fuel + transport rates alongside the
   * snapshots we recorded at pricing time, and a boolean for the UI to
   * render an "escalate this line" flag. Nothing here mutates state;
   * the actual escalation is a separate call (escalateVariance).
   */
  async variance(tenderId: string, itemId: string) {
    const row = await this.prisma.scopeWasteItem.findUnique({ where: { id: itemId } });
    if (!row || row.tenderId !== tenderId) {
      throw new NotFoundException("Waste item not found on this tender.");
    }
    // SLICE 2 — variance() checks LIVE rates (not snapshot) intentionally:
    // the variance flag compares what was quoted at lock time (quotedDisposalRate)
    // against the current live market rate. Using the snapshot here would
    // report zero variance for every locked tender, defeating the purpose.
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

    // Transport rate: read live from EstimatePlantRate via the row's
    // transportRateId. Null when the row has no transport rate, or when
    // the rate row has since been deleted.
    let currentTransportRatePerDay: number | null = null;
    if (row.transportRateId) {
      const transportRate = await this.prisma.estimatePlantRate.findUnique({
        where: { id: row.transportRateId }
      });
      currentTransportRatePerDay =
        transportRate?.rate != null ? Number(transportRate.rate) : null;
    }

    const quotedDisposalRate =
      row.quotedDisposalRate != null ? Number(row.quotedDisposalRate) : null;
    const quotedFuelPricePerLitre =
      row.quotedFuelPricePerLitre != null ? Number(row.quotedFuelPricePerLitre) : null;
    const quotedTransportRatePerDay =
      row.quotedTransportRatePerDay != null ? Number(row.quotedTransportRatePerDay) : null;

    const disposalDelta =
      currentDisposalRate != null && quotedDisposalRate != null
        ? currentDisposalRate - quotedDisposalRate
        : null;
    const fuelDelta =
      currentFuelPricePerLitre != null && quotedFuelPricePerLitre != null
        ? currentFuelPricePerLitre - quotedFuelPricePerLitre
        : null;
    const transportDelta =
      currentTransportRatePerDay != null && quotedTransportRatePerDay != null
        ? currentTransportRatePerDay - quotedTransportRatePerDay
        : null;

    // Rate is "materially different" if the delta is non-trivially non-zero.
    // Thresholds are intentionally strict so we do not flag rounding noise:
    //   >= $0.50 / t   for disposal
    //   >= $0.01 / L   for fuel
    //   >= $1.00 / day for transport (larger absolute scale; $/day not $/unit)
    const hasVariance =
      (disposalDelta != null && Math.abs(disposalDelta) >= 0.5) ||
      (fuelDelta != null && Math.abs(fuelDelta) >= 0.01) ||
      (transportDelta != null && Math.abs(transportDelta) >= 1.0);

    return {
      itemId,
      quotedDisposalRate,
      currentDisposalRate,
      quotedFuelPricePerLitre,
      currentFuelPricePerLitre,
      quotedTransportRatePerDay,
      currentTransportRatePerDay,
      disposalDelta,
      fuelDelta,
      transportDelta,
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
        : null,
      v.transportDelta != null
        ? `transport $${v.quotedTransportRatePerDay ?? "?"}/day -> $${v.currentTransportRatePerDay ?? "?"}/day`
        : null
    ]
      .filter((s): s is string => s !== null)
      .join(", ") || "no live rate available";
    // TODO(SLICE-5): narrow via resolveEffectiveChannel. For each recipient,
    // call NotificationPreferencesService.resolveEffectiveChannelForUser with
    // trigger="waste_line.rate_variance_escalated" and skip users whose
    // effective channel is "off" or "email" (this path is in-app only).
    // Requires importing NotificationPreferencesModule into TenderingModule.
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

  // ---- TRAVEL_TIME_PORT_V1 (scopecards-s8a) ---------------------------------

  /**
   * Resolve the straight-line travel estimate for a waste line.
   *
   * Returns the TravelEstimate when both the tip and the tender's site have
   * coordinates AND OperationsSettings has roadDistanceFactor + avgTruckSpeedKmh
   * populated. Returns null in all other cases -- callers must never fail
   * a save because travel resolution returned null.
   *
   * Never throws. Errors are caught and logged; the return value is null.
   */
  /**
   * Resolve a travel estimate for a waste line.
   *
   * S8g: uses GeoapifyRouteProvider when a key is available, falls back to
   * StraightLineTravelProvider. A provider failure falls back to straight
   * line, badged exactly as today. A save never fails because routing failed.
   *
   * IMPORTANT: the API key is never logged or returned in any response.
   */
  private async resolveTravelEstimate(
    mapLocationId: string,
    tenderId: string
  ): Promise<ExtendedTravelEstimate | null> {
    try {
      const [tip, tender, settings] = await Promise.all([
        this.prisma.mapLocation.findUnique({
          where: { id: mapLocationId },
          select: { latitude: true, longitude: true }
        }),
        this.prisma.tender.findUnique({
          where: { id: tenderId },
          select: { siteId: true }
        }),
        this.prisma.operationsSettings.findUnique({ where: { id: "singleton" } })
      ]);

      if (tip === null || tender === null) return null;
      if (tip.latitude === null || tip.longitude === null) return null;

      // Load site coordinates
      const site = await this.prisma.site.findUnique({
        where: { id: tender.siteId },
        select: { centreLat: true, centreLng: true }
      });
      if (!site?.centreLat || !site?.centreLng) return null;

      const from = { lat: Number(site.centreLat), lng: Number(site.centreLng) };
      const to = { lat: Number(tip.latitude), lng: Number(tip.longitude) };

      // S8g: select provider. Geoapify when key resolves, else straight line.
      let provider: TravelTimeProvider;
      const geoapifyKey = await this.apiKeys.resolve("geoapify", "company").catch(() => null);
      if (geoapifyKey) {
        const vehicleMode = settings?.routeVehicleMode ?? "truck";
        provider = new GeoapifyRouteProvider(geoapifyKey, vehicleMode);
      } else {
        provider = new StraightLineTravelProvider(
          settings?.roadDistanceFactor != null ? Number(settings.roadDistanceFactor) : null,
          settings?.avgTruckSpeedKmh ?? null
        );
      }

      const estimate = await provider.resolve(from, to);
      if (estimate === null) {
        // Provider failed -- fall back to straight line if we used Geoapify.
        if (geoapifyKey) {
          const fallback = new StraightLineTravelProvider(
            settings?.roadDistanceFactor != null ? Number(settings.roadDistanceFactor) : null,
            settings?.avgTruckSpeedKmh ?? null
          );
          return await fallback.resolve(from, to) as ExtendedTravelEstimate | null;
        }
        return null;
      }
      return estimate as ExtendedTravelEstimate;
    } catch (err) {
      this.logger.warn(
        `Travel resolve failed for mapLocationId=${mapLocationId} tenderId=${tenderId}: ` +
        String((err as Error)?.message ?? err)
      );
      return null;
    }
  }

  /**
   * Derive default loadsPerTruckPerDay and dailyKm from a travel estimate
   * when the estimator left those fields empty.
   *
   * S8g: uses planning minutes (average of baseline and index-adjusted) for
   * the cycle, not raw minutesOneWay. Index defaults to 1.0 when not set,
   * meaning planning = baseline until an index is supplied.
   *
   * "Typed figure always wins": when dtoLoadsPerTruckPerDay or dtoDailyKm
   * is already set (non-null), the derived value is NOT applied.
   */
  private deriveTravelDefaults(
    estimate: ExtendedTravelEstimate,
    tipTurnaroundMinutes: number,
    dtoLoadsPerTruckPerDay: number | null | undefined,
    dtoDailyKm: number | null | undefined,
    travelIndex: number | null = null
  ): {
    derivedLoadsPerTruckPerDay: number | null;
    derivedDailyKm: number | null;
  } {
    // S8g: use planning minutes for the cycle (baseline x index averaged).
    const effectiveIndex = travelIndex ?? (estimate as ExtendedTravelEstimate).suggestedIndex ?? 1.0;
    const planMins = planningMinutes({ baseline: estimate.minutesOneWay, index: effectiveIndex });

    const { loadsPerDay } = deriveCycle({
      minutesOneWay: planMins,
      tipTurnaroundMinutes
    });

    const derivedLoadsPerTruckPerDay = dtoLoadsPerTruckPerDay == null ? loadsPerDay : null;
    // dailyKm = loadsPerDay * 2 * travelKm (round trip per load, for storage/display)
    const derivedDailyKm =
      dtoDailyKm == null ? loadsPerDay * 2 * estimate.km : null;

    return { derivedLoadsPerTruckPerDay, derivedDailyKm };
  }

  /**
   * S8g: Derive all S8g-specific fields from a travel estimate and DTO inputs.
   * Used during create (and indirectly during update via the helper).
   * Pure function - reads no DB.
   */
  private deriveS8gFields(input: {
    travelEstimate: ExtendedTravelEstimate | null;
    dtoTravelIndex: number | null | undefined;
    dtoLoadsPerTruckPerDay: number | null | undefined;
    dtoDailyKm: number | null | undefined;
    dtoQtyTrucks: number | null;
    capacityPerLoad: number | null;
    qty: number | null | undefined;
    m3: number | null | undefined;
    capacityUnit: string | null | undefined;
    tipTurnaroundMinutes: number | null;
  }): {
    travelIndex: number | null;
    travelIndexSource: string | null;
    planningMinutesOneWay: number | null;
    effectiveLoadsPerTruckPerDay: number | null;
    effectiveDailyKm: number | null;
    loadsSource: string | null;
    dailyKmSource: string | null;
    totalTripKm: number | null;
  } {
    const { travelEstimate, dtoTravelIndex, dtoLoadsPerTruckPerDay, dtoDailyKm, tipTurnaroundMinutes } = input;

    if (travelEstimate === null) {
      // No route -- pass typed values through unchanged.
      return {
        travelIndex: dtoTravelIndex !== undefined ? dtoTravelIndex : null,
        travelIndexSource: null,
        planningMinutesOneWay: null,
        effectiveLoadsPerTruckPerDay: dtoLoadsPerTruckPerDay ?? null,
        effectiveDailyKm: dtoDailyKm ?? null,
        loadsSource: null,
        dailyKmSource: dtoDailyKm != null ? "manual" : null,
        totalTripKm: null
      };
    }

    // Determine effective index.
    let travelIndex: number | null;
    let travelIndexSource: string | null;
    if (dtoTravelIndex !== undefined && dtoTravelIndex !== null) {
      travelIndex = dtoTravelIndex;
      travelIndexSource = "manual";
    } else if (travelEstimate.suggestedIndex != null) {
      travelIndex = travelEstimate.suggestedIndex;
      travelIndexSource = "geoapify";
    } else {
      travelIndex = null;
      travelIndexSource = "none";
    }

    // Planning minutes.
    const effectiveIndex = travelIndex ?? 1.0;
    const planMins = planningMinutes({ baseline: travelEstimate.minutesOneWay, index: effectiveIndex });

    // Loads per day from planning minutes.
    const tt = tipTurnaroundMinutes ?? 30;
    const { loadsPerDay } = deriveCycle({ minutesOneWay: planMins, tipTurnaroundMinutes: tt });

    // Apply derived values only when the estimator left them empty.
    const effectiveLoadsPerTruckPerDay = dtoLoadsPerTruckPerDay != null ? dtoLoadsPerTruckPerDay : loadsPerDay;
    const loadsSource = dtoLoadsPerTruckPerDay != null ? null : "cycle";

    const derivedDailyKm = loadsPerDay * 2 * travelEstimate.km;
    const effectiveDailyKm = dtoDailyKm != null ? dtoDailyKm : derivedDailyKm;
    const dailyKmSource = dtoDailyKm != null ? "manual" : "derived";

    // Total trip km.
    let totalTripKm: number | null = null;
    const capPerLoad = input.capacityPerLoad;
    if (capPerLoad != null && capPerLoad > 0) {
      const preferM3 = input.capacityUnit === "m3" || input.capacityUnit === "m³";
      const primary = preferM3 ? input.m3 : input.qty;
      const secondary = preferM3 ? input.qty : input.m3;
      const wasteAmt = primary != null && (primary as number) > 0
        ? Number(primary)
        : secondary != null && (secondary as number) > 0
          ? Number(secondary)
          : null;
      if (wasteAmt != null) {
        const trips = requiredTrips({ quantity: wasteAmt, capacityPerLoad: capPerLoad });
        totalTripKm = deriveTotalTripKm({ trips, oneWayKm: travelEstimate.km });
      }
    }

    return {
      travelIndex,
      travelIndexSource,
      planningMinutesOneWay: planMins,
      effectiveLoadsPerTruckPerDay,
      effectiveDailyKm,
      loadsSource,
      dailyKmSource,
      totalTripKm
    };
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
