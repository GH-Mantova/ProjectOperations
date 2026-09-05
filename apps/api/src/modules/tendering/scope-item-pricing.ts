// PR B1.7.1 (waste removed in B1.7.2) — pure pricing function for
// canonical (B1.6+) scope items.
//
// Reads only the canonical fields (men, days, shift, plantItems,
// provisionalAmount) plus the rate-card maps supplied by the caller.
// Doesn't touch Prisma, so every branch is unit-testable without a DB.
//
// Per the design doc, waste belongs to the auto-generated WASTE
// SUMMARY SUBTABLE — scope items themselves never reflect waste $.
// B1.7.1 mistakenly included a waste leg here; B1.7.2 removed it.
// B3 will rewire the proper waste calc on the dedicated subtable.
//
// WBS-SHIFT-S2: shift is read from item.shift, defaulting to Day.
//
// CARD-API SLICE 1 (SCOPE_ITEM_LABOUR_STORE_V1) added the per-row labour
// store and the item-level markup override:
//   - labourItems (JSONB, nullable) mirrors plantItems. Non-empty wins
//     over the men/days/shift scalars; NULL or [] falls back to them, so
//     every row written before the column existed prices unchanged.
//   - resolveEffectiveMarkup() is the single markup-resolution
//     expression: item.markupOverride ?? card.markupOverride ?? tender.
//   - plant now honours a per-row dayRateOverride, which is what makes a
//     free-typed custom machine price at all instead of at $0.
// Nothing here reads or writes men/days/shift differently than before,
// and there is no backfill — the fallback is what makes one unnecessary.
//
// CARD-WEB SLICE 2 (SCOPE_PLANT_PERSIST_V1) needed BOTH plant legs below —
// `dayRateOverride` beating the catalogue, and a description-only row pricing
// from that override — and found them already here, landed by CARD-API SLICE
// 1. No behaviour is added by that slice; this note records that the plant
// loop now has a WRITER. Until it, the only UI that wrote plantItems was the
// legacy PlantCluster, which had no rate field at all, so the override leg
// was unreachable from the product and the custom-machine leg could only ever
// be reached by a hand-written payload.
//
// The array that reaches this function from the Plant column group is, per
// row, exactly:
//   { columnIndex, plantRateId, description, qty, days, unit, dayRateOverride }
// with every key present and absence stated as null (qty/days as 0 — a blank
// box is "none costed", and `qty == null ? 1` below is why it cannot be sent
// as null). `columnIndex` and `unit` are stored for the web's benefit and are
// not read here; `description` is not read here either, but IS read by
// getCardSummary, which skips any entry without one.

import { Prisma } from "@prisma/client";
import { Discipline, DISCIPLINES } from "./dto/scope-of-works.dto";

// ── Shared constants ─────────────────────────────────────────────────

/** Canonical discipline → labour-role mapping. Moved from
 *  scope-of-works.service.ts in B1.7.2 so both items and summary
 *  endpoints share one source of truth. */
export const DEFAULT_ROLE_BY_DISCIPLINE: Record<Discipline, string> = {
  DEM: "Demolition labourer",
  CIV: "Machine operator",
  ASB: "Asbestos labourer",
  // SUB lines carry no in-house labour by default; an explicit entry makes
  // that intent readable (rather than a silent gap that prices $0 with no error).
  // The labour role here still resolves via buildRateMaps — if a SUB card has
  // men/days filled in, it will price correctly against this role.
  SUB: "Demolition labourer",
  Other: "Demolition labourer"
};

/** Display/sort order of disciplines (DEM → CIV → ASB → Other), copied from the DTO's DISCIPLINES tuple. */
export const DISCIPLINE_ORDER: Discipline[] = [...DISCIPLINES];

// ── Types ────────────────────────────────────────────────────────────

/**
 * One plant cell from a scope item's plantItems JSONB array. Only
 * entries with a plantRateId contribute to the plant total; qty
 * defaults to 1 and days to 0 when omitted.
 */
export type ScopePlantEntryInput = {
  columnIndex?: number;
  plantRateId?: string | null;
  /** Free-typed description; the only identity a custom (non-catalogue) row has. */
  description?: string | null;
  qty?: number | null;
  days?: number | null;
  /**
   * CARD-API SLICE 1 — per-row $/day override. When present (including a
   * stored 0, which is a real value) it wins over the catalogue rate, and
   * it is the ONLY way a free-typed custom plant row can price at all.
   */
  dayRateOverride?: number | null;
};

/**
 * One labour row from a scope item's labourItems JSONB array.
 *
 * CARD-API SLICE 1 (SCOPE_ITEM_LABOUR_STORE_V1). Deliberately mirrors
 * ScopePlantEntryInput: same optionality, same "override beats catalogue"
 * rule, same tolerance for partially-filled rows.
 *
 * `role` is the rate-card labour role. When it is absent the row falls
 * back to the discipline's default role, so a half-filled row still
 * prices rather than silently costing nothing.
 *
 * Every numeric field distinguishes null/undefined (absent) from 0 (a
 * real value the user typed): qty defaults to 1 only when ABSENT, and a
 * dayRateOverride of 0 means "this row is free", not "use the catalogue".
 */
export type ScopeLabourEntryInput = {
  rowIdx?: number;
  labourTypeId?: string | null;
  role?: string | null;
  shift?: string | null;
  qty?: number | null;
  days?: number | null;
  dayRateOverride?: number | null;
};

/** Canonical pricing fields of a scope item, as consumed by computeScopeItemTotal. */
export type ScopeItemPricingInput = {
  discipline: Discipline;
  men: number | null;
  days: number | null;
  /** Labour shift: "Day" | "Night" | "Weekend". null/absent defaults to "Day". */
  shift?: string | null;
  plantItems: ReadonlyArray<ScopePlantEntryInput> | null;
  /**
   * CARD-API SLICE 1 — per-row labour store. A NON-EMPTY array wins over
   * the men/days/shift scalars above; null / undefined / [] falls back to
   * them, exactly as before this field existed. Optional so that every
   * pre-existing caller and fixture keeps compiling and keeps pricing to
   * the same number.
   */
  labourItems?: ReadonlyArray<ScopeLabourEntryInput> | null;
  /**
   * CARD-API SLICE 1 — the item-level markup % override as stored.
   * computeScopeItemTotal does NOT read this: the caller still passes the
   * already-resolved markupPercent, so the function signature is
   * unchanged for every existing caller. It is carried on the projection
   * so a reader that has a pricing input in hand can feed
   * resolveEffectiveMarkup() without re-fetching the row.
   * null/undefined = inherit; 0 is a real 0% override.
   */
  markupOverride?: number | null;
  provisionalAmount: number | null;
};

/** Pre-built rate lookups (see buildRateMaps) so pricing stays a pure function. */
export type RateMaps = {
  /**
   * Maps discipline → day rate in $/man-day.
   * Retained for backward compatibility; use `labourRateForShift` for
   * shift-aware pricing.
   */
  labourRateByDiscipline: Map<Discipline, number>;
  /**
   * Maps `${discipline}:${shift}` → rate in $/man-day, where shift is the
   * lowercase canonical value ("day" | "night" | "weekend"). Populated by
   * buildRateMaps from all three shift columns.
   */
  labourRateByDisciplineShift: Map<string, number>;
  /**
   * CARD-API SLICE 1 — maps `${role}:${shift}` → rate in $/man-day, keyed
   * by the RATE-CARD ROLE rather than by discipline, so a labour row can
   * be priced from the role the user actually picked.
   *
   * OPTIONAL on purpose: RateMaps is constructed as an object literal by
   * existing specs and callers outside this slice's scope, and making the
   * field required would break them at compile time for no behavioural
   * gain. An absent map simply means "no role-level rates known", and
   * labourRateForRole falls back to the discipline default.
   */
  labourRateByRoleShift?: Map<string, number>;
  /** Maps EstimatePlantRate.id → rate in $/day. */
  plantRateById: Map<string, number>;
};

/** Per-row pricing result in dollars; values are NOT rounded here (caller rounds for display). */
export type ScopeItemTotals = {
  labour: number;
  plant: number;
  lineTotal: number;
  lineTotalWithMarkup: number;
};

// ── Helpers ──────────────────────────────────────────────────────────

function n(value: number | null | undefined): number {
  return value == null || !Number.isFinite(value) ? 0 : Number(value);
}

/** Convert a Prisma.Decimal | number | null to a plain number | null. */
export function decToNum(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

/**
 * Build the rate-lookup maps consumed by computeScopeItemTotal and
 * labourRateForShift.
 *
 * Accepts all shift rows (day / night / weekend) from listRates. Each
 * entry carries `{ role, shift, rate }` where shift is the lowercase
 * canonical value. Populates both `labourRateByDiscipline` (day-rate
 * backward-compat map) and `labourRateByDisciplineShift` (the full
 * shift-aware map keyed `${discipline}:${shift}`).
 */
export function buildRateMaps(
  labourRates: ReadonlyArray<{ role: string; shift: string; rate: Prisma.Decimal }>,
  plantRates: ReadonlyArray<{ id: string; rate: Prisma.Decimal }>
): RateMaps {
  // Build a map of role:shift → rate for all three shift variants.
  const labourByRoleShift = new Map<string, number>();
  for (const r of labourRates) {
    labourByRoleShift.set(`${r.role}:${r.shift}`, Number(r.rate));
  }

  const labourRateByDiscipline = new Map<Discipline, number>();
  const labourRateByDisciplineShift = new Map<string, number>();
  for (const d of DISCIPLINE_ORDER) {
    const role = DEFAULT_ROLE_BY_DISCIPLINE[d];
    for (const shift of ["day", "night", "weekend"] as const) {
      const rate = labourByRoleShift.get(`${role}:${shift}`);
      if (rate != null) {
        labourRateByDisciplineShift.set(`${d}:${shift}`, rate);
        if (shift === "day") labourRateByDiscipline.set(d, rate);
      }
    }
  }

  const plantRateById = new Map<string, number>();
  for (const p of plantRates) plantRateById.set(p.id, Number(p.rate));

  // CARD-API SLICE 1 — the same rows, keyed by role rather than by
  // discipline, so a labourItems row prices from the role the user
  // actually picked instead of DEFAULT_ROLE_BY_DISCIPLINE. Built from
  // labourByRoleShift, which already holds every (role, shift) pair the
  // caller passed in, so this costs no extra query and no extra input.
  const labourRateByRoleShift = new Map(labourByRoleShift);

  return {
    labourRateByDiscipline,
    labourRateByDisciplineShift,
    labourRateByRoleShift,
    plantRateById
  };
}

/**
 * Resolve the effective labour rate for a (discipline, shift) pair.
 *
 * Normalises the shift string to lowercase; any unrecognised value
 * (including null / undefined / empty) falls back to "day". Returns 0
 * when no rate is found (same as the legacy path for an unknown role).
 *
 * Exported so WBS-SHIFT-S1 (web display) and any future consumer can
 * depend on exactly this resolver without re-implementing the fallback.
 */
export function labourRateForShift(
  discipline: Discipline,
  shift: string | null | undefined,
  rates: RateMaps
): number {
  // CARD-API SLICE 1 — the lowercase/fallback rule moved to the shared
  // normaliseShift helper below so the per-row resolver cannot drift from
  // this one. Behaviour is byte-for-byte what it was.
  return rates.labourRateByDisciplineShift.get(`${discipline}:${normaliseShift(shift)}`) ?? 0;
}

/** Canonical shift values as stored on rows and rate-card keys. */
const VALID_SHIFTS = new Set(["day", "night", "weekend"]);

/** Normalise any shift string to "day" | "night" | "weekend" ("day" when unrecognised). */
function normaliseShift(shift: string | null | undefined): string {
  const normalised = (shift ?? "").toLowerCase();
  return VALID_SHIFTS.has(normalised) ? normalised : "day";
}

/**
 * CARD-API SLICE 1 — resolve the effective labour rate for one labourItems
 * row.
 *
 * Order of resolution:
 *   1. the row's own `dayRateOverride`, when it is a finite number. A
 *      stored 0 IS an override ("this row is free") — only null/undefined
 *      falls through.
 *   2. the rate card, keyed by the row's own `role` and its own `shift`.
 *   3. the discipline's default role at that shift, when the row carries
 *      no role (a half-filled row still prices).
 *   4. 0, when nothing matches — same as the legacy path for an unknown role.
 *
 * The row's shift, not the item's, is what is used: that is the whole
 * point of a per-row store.
 */
export function labourRateForRow(
  row: ScopeLabourEntryInput,
  discipline: Discipline,
  rates: RateMaps
): number {
  if (row.dayRateOverride != null && Number.isFinite(Number(row.dayRateOverride))) {
    return Number(row.dayRateOverride);
  }
  const shift = normaliseShift(row.shift);
  const role = typeof row.role === "string" ? row.role.trim() : "";
  if (role !== "") {
    const byRole = rates.labourRateByRoleShift?.get(`${role}:${shift}`);
    if (byRole != null) return byRole;
  }
  return rates.labourRateByDisciplineShift.get(`${discipline}:${shift}`) ?? 0;
}

/**
 * CARD-API SLICE 1 — the precedence predicate, stated ONCE.
 *
 * `labourItems` present AND non-empty wins over the men/days/shift
 * scalars; absent, null, not-an-array or empty falls back to the scalars
 * exactly as before this column existed. Every reader (pricing,
 * card summary) asks this function rather than re-deriving the rule.
 */
export function hasLabourRows(
  labourItems: ReadonlyArray<ScopeLabourEntryInput> | null | undefined
): labourItems is ReadonlyArray<ScopeLabourEntryInput> {
  return Array.isArray(labourItems) && labourItems.length > 0;
}

/**
 * CARD-API SLICE 1 — crew size and person-days for ONE item, honouring
 * the labourItems/scalars precedence rule.
 *
 * With labour rows, the item's crew is the SUM of the rows' qty (the rows
 * are people working on the same item at the same time, so a 1-labourer +
 * 1-supervisor item is a crew of 2), and person-days is the sum of
 * qty x days across rows. Without them it is the legacy men / men x days.
 *
 * Exported so getCardSummary derives peakCrew and labourDays from exactly
 * this expression instead of reading item.men alone.
 */
export function labourCrewAndDaysForItem(input: {
  men: number | null | undefined;
  days: number | null | undefined;
  labourItems?: ReadonlyArray<ScopeLabourEntryInput> | null;
}): { crew: number; personDays: number } {
  if (hasLabourRows(input.labourItems)) {
    let crew = 0;
    let personDays = 0;
    for (const row of input.labourItems) {
      // qty defaults to 1 only when ABSENT; a stored 0 is a real value.
      const qty = row?.qty == null ? 1 : n(row.qty);
      const days = n(row?.days);
      crew += qty;
      personDays += qty * days;
    }
    return { crew, personDays };
  }
  const men = n(input.men);
  return { crew: men, personDays: men * n(input.days) };
}

/**
 * CARD-API SLICE 1 — the ONE markup-resolution expression.
 *
 * `item.markupOverride ?? card.markupOverride ?? tenderEstimate.markup`.
 * Every resolver call site calls this rather than inlining the chain, so
 * the two cannot drift. null/undefined means "inherit"; a stored 0 is a
 * real override (0% markup), which is why this is `??` and not `||`.
 */
export function resolveEffectiveMarkup(
  itemMarkupOverride: number | null | undefined,
  cardMarkupOverride: number | null | undefined,
  tenderMarkup: number
): number {
  return itemMarkupOverride ?? cardMarkupOverride ?? tenderMarkup;
}

/**
 * Project a Prisma ScopeOfWorksItem row (with `card` included) into
 * the shape consumed by computeScopeItemTotal. Reads only canonical
 * pricing fields plus provisionalAmount.
 */
export function toPricingInput(
  item: Prisma.ScopeOfWorksItemGetPayload<{ include: { card: true } }>,
  discipline: Discipline
): ScopeItemPricingInput {
  const plantItemsRaw = item.plantItems;
  const plantItems = Array.isArray(plantItemsRaw)
    ? (plantItemsRaw as unknown as ScopePlantEntryInput[])
    : null;
  // CARD-API SLICE 1 — labourItems is stored exactly like plantItems, so
  // it is projected exactly like plantItems: an array passes through, and
  // anything else (NULL, a scalar, a stray object) becomes null and takes
  // the men/days/shift fallback rather than throwing.
  const labourItemsRaw = item.labourItems;
  const labourItems = Array.isArray(labourItemsRaw)
    ? (labourItemsRaw as unknown as ScopeLabourEntryInput[])
    : null;
  return {
    discipline,
    men: decToNum(item.men),
    days: decToNum(item.days),
    shift: item.shift ?? null,
    plantItems,
    labourItems,
    markupOverride: decToNum(item.markupOverride),
    provisionalAmount: decToNum(item.provisionalAmount)
  };
}

// ── Pricing function ─────────────────────────────────────────────────

/**
 * Compute the per-row line total for a canonical (B1.6+) scope item.
 *
 * Formula (CARD-API SLICE 1 — SCOPE_ITEM_LABOUR_STORE_V1):
 *   labour     = labourItems non-empty
 *                  ? Σ over labourItems: (qty ?? 1) × (days ?? 0) × rowRate
 *                      where rowRate = row.dayRateOverride
 *                                   ?? rateCard[row.role : row.shift]
 *                                   ?? rateCard[discipline-default : row.shift]
 *                  : (men ?? 0) × (days ?? 0) × labourRate        ← unchanged
 *   plant      = Σ over plantItems priceable by an override OR a catalogue id:
 *                  (qty ?? 1) × (days ?? 0) × (dayRateOverride ?? plant.rate)
 *   lineTotal  = labour + plant
 *
 *   Other discipline overrides: lineTotal = provisionalAmount ?? 0
 *
 *   lineTotalWithMarkup = lineTotal × (1 + markupPercent / 100)
 *     (PR B2 — Other discipline NOW applies markup too; B1.7.1's
 *     "no markup for Other" exemption was removed per Marco's spec.)
 *
 * Waste is NOT included here — it belongs to the dedicated waste
 * summary subtable (B3). B1.7.1 mistakenly added a waste leg; B1.7.2
 * removed it.
 *
 * The caller supplies the *effective* markup for this row. CARD-API
 * SLICE 1 moved that chain into resolveEffectiveMarkup():
 * `item.markupOverride ?? card.markupOverride ?? tenderEstimate.markup`.
 */
export function computeScopeItemTotal(
  item: ScopeItemPricingInput,
  rates: RateMaps,
  markupPercent: number
): ScopeItemTotals {
  const markupFactor = 1 + (Number.isFinite(markupPercent) ? markupPercent : 0) / 100;

  // Other discipline is provisional-only — labour/plant don't apply.
  // PR B2: markup now DOES apply (was previously a hard exemption).
  if (item.discipline === "Other") {
    const provisional = n(item.provisionalAmount);
    return {
      labour: 0,
      plant: 0,
      lineTotal: provisional,
      lineTotalWithMarkup: provisional * markupFactor
    };
  }

  // ── Labour ─────────────────────────────────────────────────────────
  // CARD-API SLICE 1 — precedence, asked once via hasLabourRows():
  // a non-empty labourItems array wins; NULL / [] falls back to the
  // men x days x default-role-rate scalars, unchanged. Every row that
  // predates the labour_items column takes the fallback branch and
  // therefore prices to exactly the number it priced before.
  let labour = 0;
  if (hasLabourRows(item.labourItems)) {
    for (const row of item.labourItems) {
      if (!row) continue;
      // qty defaults to 1 only when ABSENT (the user picked a role but
      // typed no headcount); a stored 0 means zero people and prices $0.
      const qty = row.qty == null ? 1 : n(row.qty);
      const days = n(row.days);
      labour += qty * days * labourRateForRow(row, item.discipline, rates);
    }
  } else {
    const dayRate = labourRateForShift(item.discipline, item.shift, rates);
    labour = n(item.men) * n(item.days) * dayRate;
  }

  // ── Plant ──────────────────────────────────────────────────────────
  // CARD-API SLICE 1 — a row now prices when EITHER it names a catalogue
  // rate we know OR it carries a dayRateOverride. Before this slice the
  // loop skipped every entry with no plantRateId and always read the
  // catalogue, so a free-typed custom machine priced at $0 and an
  // override was silently ignored. An entry with neither a known
  // catalogue rate nor an override still contributes 0 (unchanged).
  let plant = 0;
  if (Array.isArray(item.plantItems)) {
    for (const cell of item.plantItems) {
      if (!cell) continue;
      // The override wins over the catalogue when present. A stored 0 is
      // a real override ("supplied free"), so only null/undefined falls
      // through to the catalogue lookup.
      const hasOverride =
        cell.dayRateOverride != null && Number.isFinite(Number(cell.dayRateOverride));
      const rate = hasOverride
        ? Number(cell.dayRateOverride)
        : cell.plantRateId
          ? rates.plantRateById.get(cell.plantRateId)
          : undefined;
      if (rate == null) continue;
      // qty defaults to 1 if the user picked a rate without specifying
      // a quantity (single piece of plant); days defaults to 0 so the
      // contribution is 0 until the user fills it in.
      const qty = cell.qty == null ? 1 : n(cell.qty);
      const days = n(cell.days);
      plant += qty * days * rate;
    }
  }

  const lineTotal = labour + plant;
  const lineTotalWithMarkup = lineTotal * markupFactor;

  return { labour, plant, lineTotal, lineTotalWithMarkup };
}
