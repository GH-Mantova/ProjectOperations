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
  qty?: number | null;
  days?: number | null;
};

/** Canonical pricing fields of a scope item, as consumed by computeScopeItemTotal. */
export type ScopeItemPricingInput = {
  discipline: Discipline;
  men: number | null;
  days: number | null;
  /** Labour shift: "Day" | "Night" | "Weekend". null/absent defaults to "Day". */
  shift?: string | null;
  plantItems: ReadonlyArray<ScopePlantEntryInput> | null;
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

  return { labourRateByDiscipline, labourRateByDisciplineShift, plantRateById };
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
  const VALID_SHIFTS = new Set(["day", "night", "weekend"]);
  const normalised = (shift ?? "").toLowerCase();
  const effectiveShift = VALID_SHIFTS.has(normalised) ? normalised : "day";
  return rates.labourRateByDisciplineShift.get(`${discipline}:${effectiveShift}`) ?? 0;
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
  return {
    discipline,
    men: decToNum(item.men),
    days: decToNum(item.days),
    shift: item.shift ?? null,
    plantItems,
    provisionalAmount: decToNum(item.provisionalAmount)
  };
}

// ── Pricing function ─────────────────────────────────────────────────

/**
 * Compute the per-row line total for a canonical (B1.6+) scope item.
 *
 * Formula:
 *   labour     = (men ?? 0) × (days ?? 0) × labourRate
 *   plant      = Σ over plantItems where plantRateId is set:
 *                  (qty ?? 1) × (days ?? 0) × plant.rate
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
 * The caller supplies the *effective* markup for this row — for B2 the
 * resolver is `card.markupOverride ?? tenderEstimate.markup ?? 30`.
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

  const dayRate = labourRateForShift(item.discipline, item.shift, rates);
  const labour = n(item.men) * n(item.days) * dayRate;

  let plant = 0;
  if (Array.isArray(item.plantItems)) {
    for (const cell of item.plantItems) {
      if (!cell?.plantRateId) continue;
      const rate = rates.plantRateById.get(cell.plantRateId);
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
