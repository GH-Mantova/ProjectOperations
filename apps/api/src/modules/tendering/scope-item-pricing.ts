// PR B1.7.1 — pure pricing function for canonical (B1.6+) scope items.
//
// Reads only the canonical fields (men, days, plantItems, value,
// wasteIncluded, wasteGroup, wasteItem, unit, provisionalAmount) plus
// the rate-card maps supplied by the caller. Doesn't touch Prisma, so
// every branch is unit-testable without a DB.
//
// Open caveats (revisited in PR B3):
//   - Waste contribution is non-zero ONLY when unit === "t". For m²/m³/
//     ea rows we can't map `value` to tonnes without a density column,
//     so waste = $0. Q1 of the B1.7.1 investigation locked this.
//   - DEFAULT_ROLE_BY_DISCIPLINE → labour role mapping lives in
//     scope-of-works.service.ts. The caller resolves the role and
//     passes its dayRate via labourRateByDiscipline.
//   - Shift is currently always "Day" (legacy field, not surfaced in
//     the canonical UI). nightRate/weekendRate ignored.

import type { Discipline } from "./dto/scope-of-works.dto";

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
  unit: string | null;
  value: number | null;
  wasteIncluded: boolean;
  wasteGroup: string | null;
  wasteItem: string | null;
  provisionalAmount: number | null;
};

export type RateMaps = {
  /** Maps discipline → day rate in $/man-day. */
  labourRateByDiscipline: Map<Discipline, number>;
  /** Maps EstimatePlantRate.id → rate in $/day. */
  plantRateById: Map<string, number>;
  /**
   * Lookup key = `${wasteGroup}|${wasteType}`. Value = $/tonne. We
   * arbitrarily pick the first active rate for that (group, type)
   * combination (matches the legacy createEstimateItemFromScope
   * `findFirst` fallback).
   */
  wasteTonRateByGroupAndType: Map<string, number>;
};

export type ScopeItemTotals = {
  labour: number;
  plant: number;
  waste: number;
  lineTotal: number;
  lineTotalWithMarkup: number;
};

function n(value: number | null | undefined): number {
  return value == null || !Number.isFinite(value) ? 0 : Number(value);
}

export function wasteRateKey(wasteGroup: string, wasteType: string): string {
  return `${wasteGroup}|${wasteType}`;
}

/**
 * Compute the per-row line total for a canonical (B1.6+) scope item.
 *
 * Formula:
 *   labour     = (men ?? 0) × (days ?? 0) × labourRate
 *   plant      = Σ over plantItems where plantRateId is set:
 *                  (qty ?? 1) × (days ?? 0) × plant.rate
 *   waste      = wasteIncluded && unit === "t" && wasteGroup &&
 *                wasteItem && value > 0
 *                  ? value × waste.tonRate
 *                  : 0
 *   lineTotal  = labour + plant + waste
 *
 *   Other discipline overrides: lineTotal = provisionalAmount ?? 0
 *
 *   lineTotalWithMarkup = lineTotal × (1 + markupPercent / 100)
 *     except Other, which is a fixed provisional and never marked up
 *     (matches existing summaryByDiscipline semantics in
 *     scope-redesign.service.ts:510-513).
 */
export function computeScopeItemTotal(
  item: ScopeItemPricingInput,
  rates: RateMaps,
  markupPercent: number
): ScopeItemTotals {
  // Other discipline is provisional-only — bypass the cost calc.
  if (item.discipline === "Other") {
    const provisional = n(item.provisionalAmount);
    return {
      labour: 0,
      plant: 0,
      waste: 0,
      lineTotal: provisional,
      lineTotalWithMarkup: provisional
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

  let waste = 0;
  if (
    item.wasteIncluded === true &&
    item.unit === "t" &&
    item.wasteGroup &&
    item.wasteItem &&
    n(item.value) > 0
  ) {
    const tonRate = rates.wasteTonRateByGroupAndType.get(
      wasteRateKey(item.wasteGroup, item.wasteItem)
    );
    if (tonRate != null) {
      waste = n(item.value) * tonRate;
    }
  }

  const lineTotal = labour + plant + waste;
  const markupFactor = 1 + (Number.isFinite(markupPercent) ? markupPercent : 0) / 100;
  const lineTotalWithMarkup = lineTotal * markupFactor;

  return { labour, plant, waste, lineTotal, lineTotalWithMarkup };
}
