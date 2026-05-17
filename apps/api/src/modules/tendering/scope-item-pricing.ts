// PR B1.7.1 (waste removed in B1.7.2) — pure pricing function for
// canonical (B1.6+) scope items.
//
// Reads only the canonical fields (men, days, plantItems, provisional
// Amount) plus the rate-card maps supplied by the caller. Doesn't
// touch Prisma, so every branch is unit-testable without a DB.
//
// Per the design doc, waste belongs to the auto-generated WASTE
// SUMMARY SUBTABLE — scope items themselves never reflect waste $.
// B1.7.1 mistakenly included a waste leg here; B1.7.2 removed it.
// B3 will rewire the proper waste calc on the dedicated subtable.
//
// Open caveats (revisited in PR B3):
//   - Shift is currently always "Day" (legacy field, not surfaced in
//     the canonical UI). nightRate/weekendRate ignored.

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
  Other: "Demolition labourer"
};

export const DISCIPLINE_ORDER: Discipline[] = [...DISCIPLINES];

// ── Types ────────────────────────────────────────────────────────────

export type ScopePlantEntryInput = {
  columnIndex?: number;
  plantRateId?: string | null;
  qty?: number | null;
  days?: number | null;
};

export type ScopeItemPricingInput = {
  discipline: Discipline;
  men: number | null;
  days: number | null;
  plantItems: ReadonlyArray<ScopePlantEntryInput> | null;
  provisionalAmount: number | null;
};

export type RateMaps = {
  /** Maps discipline → day rate in $/man-day. */
  labourRateByDiscipline: Map<Discipline, number>;
  /** Maps EstimatePlantRate.id → rate in $/day. */
  plantRateById: Map<string, number>;
};

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
 * Build the rate-lookup maps consumed by computeScopeItemTotal. Labour
 * rate is resolved via discipline → role → EstimateLabourRate.dayRate;
 * shift defaults to Day (night/weekend not yet surfaced).
 */
export function buildRateMaps(
  labourRates: ReadonlyArray<{ role: string; dayRate: Prisma.Decimal }>,
  plantRates: ReadonlyArray<{ id: string; rate: Prisma.Decimal }>
): RateMaps {
  const labourByRole = new Map<string, number>();
  for (const r of labourRates) labourByRole.set(r.role, Number(r.dayRate));

  const labourRateByDiscipline = new Map<Discipline, number>();
  for (const d of DISCIPLINE_ORDER) {
    const role = DEFAULT_ROLE_BY_DISCIPLINE[d];
    const rate = labourByRole.get(role);
    if (rate != null) labourRateByDiscipline.set(d, rate);
  }

  const plantRateById = new Map<string, number>();
  for (const p of plantRates) plantRateById.set(p.id, Number(p.rate));

  return { labourRateByDiscipline, plantRateById };
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

  const dayRate = rates.labourRateByDiscipline.get(item.discipline) ?? 0;
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
