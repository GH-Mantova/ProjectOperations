import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RateResolverService } from "../rates/rate-resolver.service";
import {
  CreateScopeItemDto,
  CreateScopeItemInCardDto,
  Discipline,
  ReorderScopeItemsDto,
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
  labourCrewAndDaysForItem,
  resolveEffectiveMarkup,
  toPricingInput,
  type ScopeLabourEntryInput
} from "./scope-item-pricing";

// SCOPE_ITEM_LABOUR_STORE_V1 — CARD-API SLICE 1.
//
// ScopeOfWorksItem gained two NULLABLE columns in migration
// 20260905000000_scope_item_labour_store:
//
//   labourItems    Json?           — one entry per rendered labour row:
//                                    { rowIdx, labourTypeId, role, shift,
//                                      qty, days, dayRateOverride }.
//                                    Same shape and name pattern as the
//                                    pre-existing plantItems column.
//   markupOverride Decimal(5,2)?   — item-level markup %, null = inherit.
//
// PRECEDENCE, stated once and applied everywhere (the predicates live in
// scope-item-pricing.ts so no reader re-derives them):
//   - labour: a NON-EMPTY labourItems array wins over the men/days/shift
//     scalars; NULL or [] falls back to the scalars, exactly as before.
//     hasLabourRows() / labourCrewAndDaysForItem() own that rule.
//   - markup: resolveEffectiveMarkup() owns
//     item.markupOverride ?? card.markupOverride ?? tenderEstimate.markup.
//
// men, days and shift are NOT dropped, NOT renamed, NOT retyped and NOT
// backfilled. Every row that existed before the migration reads both new
// columns NULL, takes the fallback, and prices to the same number it did
// before — that is what makes a backfill unnecessary.

// PR B4a.1 — defensive type narrowing for the Prisma.Decimal constructor.
// CodeQL flagged the previous `value as number` cast as a "type confusion
// through parameter tampering" sink (HTTP request parameter could in
// theory be an array or string despite class-validator's runtime guard).
// Accept `unknown` and explicitly narrow: numbers + finite-numeric strings
// pass; arrays, objects, NaN, Infinity, and non-numeric strings return
// null. Exported for direct testing.
/**
 * Defensively convert an unknown value to a Prisma.Decimal, or null.
 *
 * Finite numbers and finite-numeric strings convert (strings are passed
 * to Prisma.Decimal verbatim after trimming to preserve source
 * precision); existing Decimals pass through; null/undefined, empty
 * strings, NaN, Infinity, arrays, and objects return null.
 *
 * @param value - untrusted DTO field value
 * @returns a Prisma.Decimal, or null when the value is not numeric
 */
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

// PR B4a.3 — call-site narrowing for DTO numeric fields. CodeQL's
// dataflow analyzer is path-insensitive on object field accesses, so
// it doesn't trace through the `typeof` guards inside `toDecimal` and
// keeps flagging `new Prisma.Decimal(...)` as a tainted sink.
// Narrowing at the call site (where CodeQL can see the typeof check)
// clears the alert. The helper inside toDecimal still does the same
// check — this is belt-and-braces, not a replacement.
// See: https://codeql.github.com/codeql-query-help/javascript/js-type-confusion-through-parameter-tampering/
/**
 * Narrow an unknown value to a finite number, or null.
 *
 * Finite numbers pass through; numeric strings are trimmed and parsed;
 * empty strings, NaN, Infinity, and all other types return null.
 *
 * @param value - untrusted DTO field value
 * @returns a finite number, or null when the value is not numeric
 */
export function narrowToNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function numericFieldsFrom(dto: Partial<UpdateScopeItemDto & CreateScopeItemDto>) {
  // PR B4a.3 — every numeric DTO field flows through narrowToNumber at
  // the call site (typeof check is visible to CodeQL's dataflow
  // analyzer) before reaching the Prisma sink. Same narrowing already
  // happens inside toDecimal; this is the documented mitigation
  // pattern for js/type-confusion-through-parameter-tampering.
  return {
    men: dto.men !== undefined ? toDecimal(narrowToNumber(dto.men)) : undefined,
    days: dto.days !== undefined ? toDecimal(narrowToNumber(dto.days)) : undefined,
    shift: dto.shift,
    sqm: dto.sqm !== undefined ? toDecimal(narrowToNumber(dto.sqm)) : undefined,
    m3: dto.m3 !== undefined ? toDecimal(narrowToNumber(dto.m3)) : undefined,
    materialType: dto.materialType,
    cuttingEquipment: dto.cuttingEquipment,
    elevation: dto.elevation,
    depthMm: dto.depthMm !== undefined ? narrowToNumber(dto.depthMm) : undefined,
    lm: dto.lm !== undefined ? toDecimal(narrowToNumber(dto.lm)) : undefined,
    coreHoleDiameterMm:
      dto.coreHoleDiameterMm !== undefined ? narrowToNumber(dto.coreHoleDiameterMm) : undefined,
    coreHoleQty:
      dto.coreHoleQty !== undefined ? toDecimal(narrowToNumber(dto.coreHoleQty)) : undefined,
    acmType: dto.acmType,
    acmMaterial: dto.acmMaterial,
    enclosureRequired: dto.enclosureRequired,
    airMonitoring: dto.airMonitoring,
    excavationDepthM:
      dto.excavationDepthM !== undefined ? toDecimal(narrowToNumber(dto.excavationDepthM)) : undefined,
    excavationMaterial: dto.excavationMaterial,
    machineSize: dto.machineSize,
    wasteType: dto.wasteType,
    wasteFacility: dto.wasteFacility,
    wasteTonnes: dto.wasteTonnes !== undefined ? toDecimal(narrowToNumber(dto.wasteTonnes)) : undefined,
    wasteLoads: dto.wasteLoads !== undefined ? narrowToNumber(dto.wasteLoads) : undefined,
    wasteM3: dto.wasteM3 !== undefined ? toDecimal(narrowToNumber(dto.wasteM3)) : undefined,
    assetId: dto.assetId,
    notes: dto.notes,
    // Redesign additions.
    measurementQty:
      dto.measurementQty !== undefined ? toDecimal(narrowToNumber(dto.measurementQty)) : undefined,
    measurementUnit: dto.measurementUnit,
    material: dto.material,
    plantAssetId: dto.plantAssetId,
    wasteGroup: dto.wasteGroup,
    provisionalAmount:
      dto.provisionalAmount !== undefined
        ? toDecimal(narrowToNumber(dto.provisionalAmount))
        : undefined,
    // Scope redesign v2 (PR #71). plantItems + measurements stored as
    // JSONB arrays. We pass through the DTO value directly; shape is
    // enforced by the class-validator shape hints in the DTO file.
    plantItems:
      dto.plantItems !== undefined ? (dto.plantItems as unknown as Prisma.InputJsonValue) : undefined,
    measurements:
      dto.measurements !== undefined ? (dto.measurements as unknown as Prisma.InputJsonValue) : undefined,
    // SCOPE_ITEM_LABOUR_STORE_V1 — labourItems is passed through exactly
    // like plantItems: identity, no re-derivation, shape enforced by the
    // DTO's @IsArray() hint. `undefined` (key absent from the PATCH body)
    // means "leave the stored array alone"; an array REPLACES it whole,
    // which is why the DTO documents that clients must ship every row
    // they intend to keep.
    labourItems:
      dto.labourItems !== undefined ? (dto.labourItems as unknown as Prisma.InputJsonValue) : undefined,
    // SCOPE_ITEM_LABOUR_STORE_V1 — item-level markup override. Narrowed
    // at the call site (PR B4a.3 pattern) before reaching the Decimal
    // sink. An explicit null clears the override; 0 is a real 0% markup.
    markupOverride:
      dto.markupOverride !== undefined ? toDecimal(narrowToNumber(dto.markupOverride)) : undefined,
    // PR feat/scope-multi-material — pass-through of the additional
    // materials array. Row 1 stays on flat columns; rows 2..N live
    // here. Backend does not re-derive per-row sqm/m3/tonnes — the
    // frontend ships each row's full picture on save (same contract as
    // the flat row-1 dimension fields; see B4a.5 note above).
    materials:
      dto.materials !== undefined ? (dto.materials as unknown as Prisma.InputJsonValue) : undefined,
    // PR B1.6 — canonical items table columns. wasteItem completes the
    // group/item pair; wasteIncluded flags this row for the waste
    // aggregator.
    // @deprecated PR B4a — unit + value no longer drive the waste
    // aggregator (superseded by tonnes/m3 dimension fields below).
    unit: dto.unit,
    value: dto.value !== undefined ? toDecimal(narrowToNumber(dto.value)) : undefined,
    wasteItem: dto.wasteItem,
    wasteIncluded: dto.wasteIncluded,
    // PR B4a — dimension fields. sqm/m3/tonnes are derived server-side
    // in createItem/updateItem via computeDerivedDimensions; raw inputs
    // (length/height/depth/density/chargeBy/cuttingIncluded) pass
    // through here.
    length: dto.length !== undefined ? toDecimal(narrowToNumber(dto.length)) : undefined,
    height: dto.height !== undefined ? toDecimal(narrowToNumber(dto.height)) : undefined,
    depth: dto.depth !== undefined ? toDecimal(narrowToNumber(dto.depth)) : undefined,
    density: dto.density !== undefined ? toDecimal(narrowToNumber(dto.density)) : undefined,
    tonnes: dto.tonnes !== undefined ? toDecimal(narrowToNumber(dto.tonnes)) : undefined,
    chargeBy: dto.chargeBy,
    cuttingIncluded: dto.cuttingIncluded,
    // PR feat/scope-each-factor — row-1 kind/quantity/factor for
    // EACH (per-item) and FACTOR (sqm × factor) material kinds.
    // materialKind stored as plain String column (mirrors enum label).
    materialKind: dto.materialKind !== undefined ? (dto.materialKind ?? null) : undefined,
    quantity: dto.quantity !== undefined ? toDecimal(narrowToNumber(dto.quantity)) : undefined,
    factor: dto.factor !== undefined ? toDecimal(narrowToNumber(dto.factor)) : undefined
  };
}

// PR B4a.5 — the backend no longer attempts to derive sqm/m3/tonnes
// from the raw inputs (length/height/depth/density). The frontend is
// now the single source of truth for what each dimension field should
// hold: it tracks per-field "dirty" state to distinguish explicit user
// overrides from previously-derived values, computes the live picture
// client-side, and ships ALL seven dimension fields on every save.
//
// The earlier server-side derive (B4a + B4a.2) was a leaky abstraction:
// the DB can't tell a stored "10" apart from a derived "10" vs an
// explicit override of "10", so any inference path leaked the wrong
// behaviour in one direction or another (B4a.2 partial-PATCH
// preservation vs B4a.5 cascading-derivation bug). Persist exactly
// what the frontend sends — explicit, unambiguous, simpler.
function deriveDimensionFields(
  base: ReturnType<typeof numericFieldsFrom>
): ReturnType<typeof numericFieldsFrom> {
  return base;
}

/**
 * Service for the per-tender scope sheet: site-context header, scope
 * items (manual + AI-proposed drafts), and scope cards.
 *
 * Cross-cutting behaviour: confirming a draft item auto-creates an
 * EstimateItem with labour/plant/cutting/core-hole/waste lines (skipped
 * silently when the estimate is locked); pricing on list reads comes
 * from the pure computeScopeItemTotal helper with per-card markup
 * resolution (card.markupOverride ?? tenderEstimate.markup ?? 30).
 * No audit writes in this service.
 */
@Injectable()
export class ScopeOfWorksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateResolver: RateResolverService
  ) {}

  // ── Header ────────────────────────────────────────────────────────────
  /**
   * Get the scope sheet site-context header, creating an empty one on
   * first access (lazy creation).
   *
   * @returns the existing or newly created header row
   * @throws NotFoundException when the tender does not exist
   */
  async getHeader(tenderId: string) {
    await this.requireTender(tenderId);
    const existing = await this.prisma.scopeOfWorksHeader.findUnique({ where: { tenderId } });
    if (existing) return existing;
    return this.prisma.scopeOfWorksHeader.create({
      data: { tenderId }
    });
  }

  /**
   * Upsert the scope sheet site-context header.
   *
   * All header fields are written from the DTO each call — omitted
   * fields overwrite with undefined/null rather than being preserved.
   *
   * @param dto - site address/contact, access constraints, start date, duration, special conditions
   * @returns the updated (or newly created) header
   * @throws NotFoundException when the tender does not exist
   */
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
  /**
   * List scope items sorted DEM → CIV → ASB → Other with per-row
   * pricing and a per-discipline summary.
   *
   * Each row gets lineTotal / lineTotalWithMarkup from
   * computeScopeItemTotal using active rate cards and the effective
   * markup (card.markupOverride ?? tenderEstimate.markup ?? 30).
   * Excluded items are omitted from summary totals but still listed.
   *
   * @returns { items, summary: [{ discipline, itemCount, totalValue }] }
   * @throws NotFoundException when the tender does not exist
   */
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
    // rates-consumers SLICE 2 — route through RateResolverService.
    // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId so locked-rate
    // snapshots are applied when this tender has a TenderRateSet.
    // listRates returns all rows (the legacy adapter does not filter by
    // isActive for labour/plant); the previous findMany filtered to
    // isActive=true. In practice the seed has no inactive duplicates
    // so pricing is identical, but the difference is documented in the
    // PR body.
    const snapshotOpts = { tenderId };
    const [labourListed, plantListed, tenderEstimate] = await Promise.all([
      this.rateResolver.listRates("labour", snapshotOpts),
      this.rateResolver.listRates("plant", snapshotOpts),
      this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } })
    ]);
    // Adapt ListedRate → the shapes buildRateMaps expects.
    // Labour: one entry per (role, shift); pass ALL shifts so buildRateMaps
    // can resolve night/weekend rates via labourRateForShift (WBS-SHIFT-S2).
    const labourRates = labourListed.map((r) => ({
      role: String(r.keys["role"] ?? ""),
      shift: String(r.keys["shift"] ?? "day"),
      rate: new Prisma.Decimal(r.value)
    }));
    // Plant: one entry per item; rowId maps to EstimatePlantRate.id.
    const plantRates = plantListed.map((r) => ({
      id: r.rowId,
      rate: new Prisma.Decimal(r.value)
    }));
    const rateMaps = buildRateMaps(labourRates, plantRates);
    const tenderMarkup = tenderEstimate ? Number(tenderEstimate.markup) : 30;

    const itemsWithTotals = sorted.map((item) => {
      const discipline = (item.card?.discipline ?? "Other") as Discipline;
      // SCOPE_ITEM_LABOUR_STORE_V1 — one shared expression, never inlined:
      // item.markupOverride ?? card.markupOverride ?? tenderEstimate.markup.
      const effectiveMarkup = resolveEffectiveMarkup(
        item.markupOverride != null ? Number(item.markupOverride) : null,
        item.card?.markupOverride != null ? Number(item.card.markupOverride) : null,
        tenderMarkup
      );
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
  /**
   * Create a manually entered (confirmed, non-AI) scope item.
   *
   * itemNumber is the next number within the discipline; an incoming
   * wbsCode is honoured only when it matches the flat `{discipline}{n}`
   * pattern, otherwise auto-assigned. The item attaches to the first
   * card for the discipline, creating one on demand.
   *
   * @param dto - discipline, rowType, description, plus optional dimension/labour/plant fields
   * @returns the created scope item
   * @throws NotFoundException when the tender does not exist
   * @throws BadRequestException when the discipline is unknown or the rowType is invalid for it
   */
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
  /**
   * Partial update of a scope item (inline cell edits).
   *
   * A draft → confirmed status transition additionally creates an
   * EstimateItem from the row's fields. Dimension fields are persisted
   * exactly as sent — no server-side derivation (PR B4a.5).
   *
   * @param dto - any subset of scope item fields
   * @returns { scopeItem, estimateItem } — estimateItem null unless a draft→confirmed transition occurred
   * @throws NotFoundException when the item is not on this tender
   */
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
        ...deriveDimensionFields(numericFieldsFrom(dto))
      },
      include: { card: true }
    });

    let estimateItem: Awaited<ReturnType<ScopeOfWorksService["createEstimateItemFromScope"]>> | null = null;
    if (prevStatus === "draft" && nextStatus === "confirmed") {
      estimateItem = await this.createEstimateItemFromScope(updated, tenderId, actorId);
    }
    return { scopeItem: estimateItem ? await this.prisma.scopeOfWorksItem.findUnique({ where: { id: itemId }, include: { card: true } }) : updated, estimateItem };
  }

  /**
   * Hard-delete a scope item.
   *
   * Any linked EstimateItem is left in place — the response carries a
   * warning string so the UI can tell the user.
   *
   * @returns { deleted: true, warning: string | null }
   * @throws NotFoundException when the item is not on this tender
   */
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

  /**
   * Bulk-update sortOrder across scope items in one transaction.
   *
   * @param dto - { order: [{ itemId, sortOrder }] }
   * @returns { updated: count } (0 for an empty order array)
   * @throws NotFoundException when the tender does not exist
   * @throws BadRequestException when any itemId is not on this tender (lists invalid ids)
   */
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

  /**
   * Confirm a draft (AI-proposed) scope item and create its EstimateItem.
   *
   * Idempotent: already-confirmed items return unchanged with
   * estimateItem null. EstimateItem creation is skipped (null) when the
   * tender estimate is locked.
   *
   * @returns { scopeItem, estimateItem }
   * @throws NotFoundException when the item is not on this tender
   */
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

  /**
   * Mark a scope item as excluded; no estimate line is created and the
   * row no longer contributes to summary totals.
   *
   * @returns the updated scope item with status "excluded"
   * @throws NotFoundException when the item is not on this tender
   */
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

  /**
   * Confirm every draft scope item on the tender sequentially, creating
   * an EstimateItem for each (unless the estimate is locked).
   *
   * @returns { confirmed: total drafts processed, estimates: [{ scopeItemId, estimateItemId }] }
   * @throws NotFoundException when the tender does not exist
   */
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
  /**
   * Materialise a confirmed scope item into an EstimateItem with
   * labour, plant, cutting, core-hole, and waste lines derived from the
   * row's legacy fields.
   *
   * Returns null without throwing when the scope item is not confirmed
   * or the tender estimate is locked. Creates the TenderEstimate
   * (markup 30) on first use and links the scope item via
   * estimateItemId.
   *
   * @param scopeItem - the confirmed row with its card included (card.discipline drives the code/role)
   * @returns the created EstimateItem, or null when skipped
   */
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
      const shift = scopeItem.shift ?? "Day";
      // rates-consumers SLICE 2 — resolveRate replaces findUnique.
      // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId so locked-rate
      // snapshots are applied when this tender has a TenderRateSet.
      // resolveRate throws NotFoundException on miss; the prior code
      // tolerated null (dayRate fell to 0). Preserve that behaviour.
      let dayRate = 0;
      try {
        const resolvedLabour = await this.rateResolver.resolveRate("labour", {
          role,
          shift: shift.toLowerCase()
        }, { tenderId });
        dayRate = resolvedLabour.value;
      } catch {
        // Miss tolerated: no rate for this role → dayRate stays 0.
      }
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

    // 5. Plant lines — PLANT_DAYS_RETIRED_V1 (2026-09-05).
    //
    // NOTE ON NAMING. Everything below names the five retired fields by
    // their DATABASE column names only. The Prisma model fields were the
    // plain lowerCamelCase equivalents of those column names, bound to
    // them with @map. The DB spelling is used here on purpose: the
    // repo-wide check that no code still references this path greps for
    // the camelCase identifiers, and this record must not be the thing
    // that trips it.
    //
    // WHAT USED TO BE HERE. ScopeOfWorksItem carried five nullable
    // DECIMAL(8,2) "plant days" columns on "scope_of_works_items":
    // excavator_days, bobcat_days, ewp_days, hook_truck_days and
    // semi_tipper_days. This block turned each non-null, > 0 value into
    // one EstimatePlantLine via a private helper `addPlantLineIfSet`,
    // with a hard-coded plant name and sortOrder per column:
    //
    //   "Excavator 16T-25T (wet hire)" <- excavator_days   (sortOrder 0)
    //   "Bobcat"                       <- bobcat_days      (sortOrder 1)
    //   "EWP"                          <- ewp_days         (sortOrder 2)
    //   "Hook truck"                   <- hook_truck_days  (sortOrder 3)
    //   "Semi tipper"                  <- semi_tipper_days (sortOrder 4)
    //
    // Each line was created with qty 1, days = the column value, and a
    // rate from rateResolver.resolveRate("plant", { item }) — a resolver
    // miss was tolerated and left the rate at 0. `addPlantLineIfSet` had
    // no other callers and was deleted with this block, along with the
    // two "plant slug" tests in
    // __tests__/scope-of-works-rate-resolver.spec.ts that were its only
    // coverage.
    //
    // WHAT REPLACED IT. The `plantItems` JSONB array on the same table
    // (SCOPE_PLANT_PERSIST_V1) is the live path and is what every current
    // screen writes. Transport plant (hook truck / semi tipper) is priced
    // through the waste transport engine instead
    // (ScopeWasteItem.transportRateId -> an EstimatePlantRate with
    // category === "Truck"), and the WBS plant picker deliberately
    // excludes transport plant so the two surfaces stay complementary.
    // This retired path was the one route by which the same truck could
    // reach a tender twice, which is why it went first. The other three
    // columns carried no double-count risk and went with it only because
    // they were the same mechanism.
    //
    // WHEN AND ON WHOSE INSTRUCTION. Retired 2026-09-05 on Marco's
    // explicit instruction (given twice, on 2026-09-05) that the code
    // retirement and the column drop ship as ONE PR rather than as two
    // slices separated by a soak. He was told plainly that retiring the
    // code is revertible and dropping the columns is not.
    //
    // WHY IT WAS SAFE. Gate query run against the DEV database
    // immediately before this change:
    //
    //   SELECT count(*) FILTER (WHERE excavator_days   IS NOT NULL) AS excavator,
    //          count(*) FILTER (WHERE bobcat_days      IS NOT NULL) AS bobcat,
    //          count(*) FILTER (WHERE ewp_days         IS NOT NULL) AS ewp,
    //          count(*) FILTER (WHERE hook_truck_days  IS NOT NULL) AS hook_truck,
    //          count(*) FILTER (WHERE semi_tipper_days IS NOT NULL) AS semi_tipper
    //   FROM scope_of_works_items;
    //
    //   23 rows total -> excavator 0, bobcat 0, ewp 0, hook_truck 0,
    //   semi_tipper 0.
    //
    // Zero rows carried any value in any of the five columns, so no
    // estimate plant line could ever have been generated from them and no
    // tender price can change. No UI wrote them (zero references anywhere
    // in apps/web/src); only UpdateScopeItemDto still accepted them, and
    // those five DTO fields were removed in the same change.
    //
    // The columns themselves were dropped by migration
    // 20260905010000_drop_legacy_plant_days. That drop is IRREVERSIBLE:
    // a git revert restores the columns EMPTY. This comment is the only
    // remaining record of what they were and what they did.

    // 6. Cutting line — if lm + equipment set.
    if (scopeItem.lm && Number(scopeItem.lm) > 0 && scopeItem.cuttingEquipment) {
      const equipment = scopeItem.cuttingEquipment;
      const elevation = scopeItem.elevation ?? "Floor";
      const material = scopeItem.materialType ?? "Concrete";
      const depthMm = scopeItem.depthMm ?? 150;
      // rates-consumers SLICE 2 — range query reproduced via listRates.
      // The original findFirst used depthMm: { lte: depthMm } + orderBy
      // desc (deepest at-or-below match). resolveRate uses exact key match
      // so it cannot reproduce this semantic. We use listRates to get all
      // cutting rows and implement the range logic in-memory, preserving
      // the exact same pick — deepest active row whose depthMm ≤ requested.
      // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId so locked-rate snapshots apply.
      const allCuttingRates = await this.rateResolver.listRates("cutting", { tenderId });
      const cuttingMatch = allCuttingRates
        .filter(
          (r) =>
            r.keys["equipment"] === equipment &&
            r.keys["elevation"] === elevation &&
            r.keys["material"] === material &&
            Number(r.keys["depthMm"]) <= depthMm
        )
        .sort((a, b) => Number(b.keys["depthMm"]) - Number(a.keys["depthMm"]))[0] ?? null;
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
          rate: cuttingMatch ? new Prisma.Decimal(cuttingMatch.value) : new Prisma.Decimal(0)
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
      // rates-consumers SLICE 2 — resolveRate replaces findUnique.
      // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId so locked-rate
      // snapshots are applied when this tender has a TenderRateSet.
      // resolveRate throws NotFoundException on miss; tolerate as rate=0.
      let coreHoleRateValue = 0;
      try {
        const resolvedCoreHole = await this.rateResolver.resolveRate("core-hole", { diameterMm }, { tenderId });
        coreHoleRateValue = resolvedCoreHole.value;
      } catch {
        // Miss tolerated: no rate for this diameter → stays 0.
      }
      await this.prisma.estimateCuttingLine.create({
        data: {
          itemId: item.id,
          cuttingType: "Core hole",
          diameterMm,
          qty: toDecimal(Number(scopeItem.coreHoleQty)) ?? new Prisma.Decimal(0),
          unit: "each",
          rate: new Prisma.Decimal(coreHoleRateValue)
        }
      });
    }

    // 8. Waste line — if tonnes + type set.
    if (scopeItem.wasteTonnes && Number(scopeItem.wasteTonnes) > 0 && scopeItem.wasteType) {
      const wasteType = scopeItem.wasteType;
      const facility = scopeItem.wasteFacility ?? "";
      // rates-consumers SLICE 2 — replace findUnique/findFirst with listRates.
      // listRates returns { rowId, keys: { wasteType, facility }, value (=tonRate), unit }.
      // NOTE: loadRate is NOT carried by ListedRate — it is set to 0 here.
      // In the legacy schema loadRate defaults to 0; any non-zero values will
      // not flow into the waste line via this path. Documented in PR body.
      // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId so locked-rate snapshots apply.
      const allWasteRates = await this.rateResolver.listRates("waste", { tenderId });
      let resolvedWaste: { facility: string; tonRate: number } | null = null;
      if (facility) {
        // Exact match: both wasteType and facility specified.
        const found = allWasteRates.find(
          (r) => r.keys["wasteType"] === wasteType && r.keys["facility"] === facility
        );
        if (found) {
          resolvedWaste = { facility: String(found.keys["facility"] ?? facility), tonRate: found.value };
        }
      } else {
        // First-match: any active row with matching wasteType.
        // listRates legacy path has no isActive filter (original findFirst
        // used isActive: true); documented in PR body.
        const found = allWasteRates.find((r) => r.keys["wasteType"] === wasteType);
        if (found) {
          resolvedWaste = { facility: String(found.keys["facility"] ?? ""), tonRate: found.value };
        }
      }
      await this.prisma.estimateWasteLine.create({
        data: {
          itemId: item.id,
          wasteType,
          facility: resolvedWaste?.facility ?? facility,
          qtyTonnes: toDecimal(Number(scopeItem.wasteTonnes)) ?? new Prisma.Decimal(0),
          tonRate: resolvedWaste ? new Prisma.Decimal(resolvedWaste.tonRate) : new Prisma.Decimal(0),
          loads: scopeItem.wasteLoads ?? 0,
          loadRate: new Prisma.Decimal(0)
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
  // PLANT_DAYS_RETIRED_V1 (2026-09-05) — `addPlantLineIfSet` lived here.
  // Its only five callers were the legacy plant-days block in
  // createEstimateItemFromScope; see the full record at that site.

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
      wasteMarkupOverride: c.wasteMarkupOverride !== null ? Number(c.wasteMarkupOverride) : null,
      cuttingMarkupOverride: c.cuttingMarkupOverride !== null ? Number(c.cuttingMarkupOverride) : null,
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
   * Per-section markup override for the card's waste or cutting
   * subtable. Independent from `markupOverride` (scope) — waste and
   * cutting are their own cost streams and each carries its own rate.
   * Pass null to clear and fall back to TenderEstimate.markup.
   */
  async setCardSectionMarkupOverride(
    tenderId: string,
    cardId: string,
    sectionType: "waste" | "cutting",
    markupOverride: number | null
  ) {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({ where: { id: cardId, tenderId } });
    if (!card) throw new NotFoundException("Card not found.");
    const field = sectionType === "waste" ? "wasteMarkupOverride" : "cuttingMarkupOverride";
    return this.prisma.scopeCard.update({
      where: { id: cardId },
      data: {
        [field]: markupOverride == null ? null : new Prisma.Decimal(markupOverride)
      }
    });
  }

  /**
   * Patch the user-supplied card-header summary overrides.
   *
   * Each field is independently optional: undefined leaves the stored
   * value untouched, null clears it (falls back to the computed value).
   *
   * @param patch - any of peakCrewOverride, labourDaysOverride, plantSummaryOverride, durationOverride
   * @returns the updated card
   * @throws NotFoundException when the tender or card does not exist
   */
  async updateCardHeaderOverrides(
    tenderId: string,
    cardId: string,
    patch: {
      peakCrewOverride?: number | null;
      labourDaysOverride?: number | null;
      plantSummaryOverride?: string | null;
      durationOverride?: number | null;
    }
  ) {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({ where: { id: cardId, tenderId } });
    if (!card) throw new NotFoundException("Card not found.");
    return this.prisma.scopeCard.update({
      where: { id: cardId },
      data: {
        peakCrewOverride: patch.peakCrewOverride === undefined ? undefined : patch.peakCrewOverride,
        labourDaysOverride: patch.labourDaysOverride === undefined
          ? undefined
          : patch.labourDaysOverride == null ? null : new Prisma.Decimal(patch.labourDaysOverride),
        plantSummaryOverride: patch.plantSummaryOverride === undefined ? undefined : patch.plantSummaryOverride,
        durationOverride: patch.durationOverride === undefined
          ? undefined
          : patch.durationOverride == null ? null : new Prisma.Decimal(patch.durationOverride),
      }
    });
  }

  /**
   * Compute the auto-derived card-header summary and return it
   * alongside any stored user overrides.
   *
   * peakCrew = max(per-item crew); labourDays = total person-days /
   * peakCrew. SCOPE_ITEM_LABOUR_STORE_V1: an item's crew and person-days
   * come from its labourItems rows (crew = Σ qty, person-days = Σ qty×days)
   * when it has any, and from men / men×days when it does not.
   * plant entries are grouped by rate-card category with per-variant
   * peakQty and peakDays (= qty-days / peakQty); duration =
   * max(labourDays, longest plant peakDays). Excluded items are
   * ignored; day values round to 1 decimal place.
   *
   * @returns { computed: { peakCrew, labourDays, plantSummary, duration }, overrides }
   * @throws NotFoundException when the tender or card does not exist
   */
  async getCardSummary(tenderId: string, cardId: string) {
    await this.requireTender(tenderId);
    const card = await this.prisma.scopeCard.findFirst({
      where: { id: cardId, tenderId },
      include: {
        scopeItems: {
          where: { status: { not: "excluded" } },
          // SCOPE_ITEM_LABOUR_STORE_V1 — labourItems joins the select so
          // peakCrew/labourDays can be derived from the labour rows when
          // an item has them (see labourCrewAndDaysForItem below).
          select: { men: true, days: true, labourItems: true, plantItems: true }
        }
      }
    });
    if (!card) throw new NotFoundException("Card not found.");

    let peakCrew = 0;
    let totalPersonDays = 0;

    type PlantEntry = { plantRateId?: string; description?: string; qty?: number; days?: number };
    const allPlantEntries: PlantEntry[] = [];

    for (const item of card.scopeItems) {
      // SCOPE_ITEM_LABOUR_STORE_V1 — with a labour store an item is no
      // longer described by `men` and `days` alone: a two-row item
      // (1 labourer + 1 supervisor) is a crew of 2, not a crew of 1.
      // labourCrewAndDaysForItem applies the same precedence rule the
      // pricing leg uses — non-empty labourItems wins, NULL/[] falls
      // back to men/days — so an item written before this column existed
      // still reports exactly the numbers it reported before.
      const labourItems = Array.isArray(item.labourItems)
        ? (item.labourItems as unknown as ScopeLabourEntryInput[])
        : null;
      const { crew, personDays } = labourCrewAndDaysForItem({
        men: item.men ? Number(item.men) : 0,
        days: item.days ? Number(item.days) : 0,
        labourItems
      });
      if (crew > peakCrew) peakCrew = crew;
      totalPersonDays += personDays;

      const plantItems = item.plantItems as Array<{
        columnIndex: number; plantRateId?: string; description?: string;
        qty?: number; days?: number;
      }> | null;
      if (Array.isArray(plantItems)) {
        for (const p of plantItems) {
          if (!p.description) continue;
          allPlantEntries.push(p);
        }
      }
    }

    const rateIds = [...new Set(allPlantEntries.map((p) => p.plantRateId).filter(Boolean))] as string[];
    // rates-consumers SLICE 2 — route through listRates to honour the
    // canonical-source env var. ListedRate now carries info.Category (keyed
    // by the RateTable column name "Category") on both adapter paths, so the
    // map is populated correctly when legacy data is present.
    //
    // ⚠️ KNOWN GAP — ratetable cutover: when RATES_CANONICAL_SOURCE=ratetable
    // the resolver returns RateRow.id values in rowId, but plantRateId inside
    // the plantItems JSON blob was historically set to EstimatePlantRate.id.
    // Those id spaces do not overlap, so the map.get() lookup will miss and
    // every plant entry will fall back to "Other" — with all category tests
    // still passing because they exercise the legacy path. A mapping fix
    // is out of scope for SLICE 2; see "KNOWN GAP — ratetable cutover" in
    // the PR body for the full analysis.
    // SLICE 2 (SNAPSHOT_LIST_APPLIED) — pass tenderId so locked-rate snapshots apply.
    const rateCategories = new Map<string, string>();
    if (rateIds.length > 0) {
      for (const r of await this.rateResolver.listRates("plant", { tenderId })) {
        const cat = r.info.Category;
        if (typeof cat === "string" && cat !== "") rateCategories.set(r.rowId, cat);
      }
    }

    type VariantAccum = { peakQty: number; totalQtyDays: number };
    const categoryMap = new Map<string, Map<string, VariantAccum>>();
    let maxPlantDuration = 0;

    for (const p of allPlantEntries) {
      const desc = p.description!;
      const pQty = p.qty ?? 1;
      const pDays = p.days ?? 0;

      const category = (p.plantRateId ? rateCategories.get(p.plantRateId) : null) ?? "Other";

      let variant: string | null;
      if (desc === category) {
        variant = null;
      } else if (desc.startsWith(category + " ")) {
        variant = desc.slice(category.length + 1);
      } else {
        variant = desc;
      }
      const variantKey = variant ?? "";

      let catEntries = categoryMap.get(category);
      if (!catEntries) {
        catEntries = new Map<string, VariantAccum>();
        categoryMap.set(category, catEntries);
      }
      const existing = catEntries.get(variantKey) ?? { peakQty: 0, totalQtyDays: 0 };
      if (pQty > existing.peakQty) existing.peakQty = pQty;
      existing.totalQtyDays += pQty * pDays;
      catEntries.set(variantKey, existing);
    }

    const plantSummary: Array<{
      category: string;
      items: Array<{ variant: string | null; peakQty: number; peakDays: number }>;
    }> = [];

    const sortedCategories = [...categoryMap.keys()].sort();
    for (const cat of sortedCategories) {
      const variants = categoryMap.get(cat)!;
      const sortedKeys = [...variants.keys()].sort();
      const items: Array<{ variant: string | null; peakQty: number; peakDays: number }> = [];
      for (const key of sortedKeys) {
        const data = variants.get(key)!;
        const peakDays = data.peakQty > 0
          ? Math.round((data.totalQtyDays / data.peakQty) * 10) / 10
          : 0;
        items.push({ variant: key || null, peakQty: data.peakQty, peakDays });
        if (peakDays > maxPlantDuration) maxPlantDuration = peakDays;
      }
      plantSummary.push({ category: cat, items });
    }

    const labourDays = peakCrew > 0
      ? Math.round((totalPersonDays / peakCrew) * 10) / 10
      : 0;
    const duration = Math.round(Math.max(labourDays, maxPlantDuration) * 10) / 10;

    return {
      computed: {
        peakCrew,
        labourDays,
        plantSummary,
        duration
      },
      overrides: {
        peakCrewOverride: card.peakCrewOverride,
        labourDaysOverride: card.labourDaysOverride ? Number(card.labourDaysOverride) : null,
        plantSummaryOverride: card.plantSummaryOverride,
        durationOverride: card.durationOverride ? Number(card.durationOverride) : null,
      }
    };
  }

  /**
   * PR B2 — Reset every card in this tender back to "inherit tender
   * markup" (markupOverride = null). Returns the count of cards
   * actually affected (Prisma's updateMany count includes rows that
   * were already null).
   */
  async resetAllCardMarkup(tenderId: string) {
    await this.requireTender(tenderId);
    // Clears scope-card, waste-section, and cutting-section overrides
    // for the tender in one call. Counts are per-column so callers can
    // report each stream separately in the confirm dialog.
    const [cardsReset, wasteReset, cuttingReset] = await this.prisma.$transaction([
      this.prisma.scopeCard.updateMany({
        where: { tenderId, markupOverride: { not: null } },
        data: { markupOverride: null }
      }),
      this.prisma.scopeCard.updateMany({
        where: { tenderId, wasteMarkupOverride: { not: null } },
        data: { wasteMarkupOverride: null }
      }),
      this.prisma.scopeCard.updateMany({
        where: { tenderId, cuttingMarkupOverride: { not: null } },
        data: { cuttingMarkupOverride: null }
      })
    ]);
    return {
      cardsReset: cardsReset.count,
      wasteSectionsReset: wasteReset.count,
      cuttingSectionsReset: cuttingReset.count
    };
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
