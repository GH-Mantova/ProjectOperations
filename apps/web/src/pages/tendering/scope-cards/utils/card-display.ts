// PR B1.5 — display helpers for the cards-as-tabs UI.

import { IS_DISCIPLINE_CODES, type IsDisciplineCode } from "../../../../constants/disciplines";

export function formatCardCode(discipline: string, cardNumber: number): string {
  return `${discipline}${cardNumber}`;
}

export function formatItemCode(
  discipline: string,
  cardNumber: number,
  itemNumber: number
): string {
  return `${discipline}${cardNumber}.${itemNumber}`;
}

// Discipline labels for the cards UI. Derived from the canonical source —
// apps/web/src/constants/disciplines.ts — so a future code change propagates here.
// Declared with `satisfies` so that adding a code to IS_DISCIPLINE_CODES without
// giving it a label is a COMPILE error. Until 2026-08-31 these two maps were typed
// Record<string, string> directly, which is assignable from any object: adding "SUB"
// to the tuple therefore compiled clean and shipped `undefined` labels to six UI call
// sites (ScopeCardEmptyState, ScopeCardsTab, NewCardModal x2, ClientQuotesPanel x2).
// The exported types stay Record<string, string> so string-keyed callers are unchanged.
const DISCIPLINE_LABELS_EXACT = {
  DEM: "Demolition",
  CIV: "Civil works",
  ASB: "Asbestos removal",
  Other: "Other",
  SUB: "Subcontracted"
} satisfies Record<IsDisciplineCode, string>;

export const DISCIPLINE_LABELS: Record<string, string> = DISCIPLINE_LABELS_EXACT;

/** Canonical discipline code tuple — imported from the single source of truth. */
export const DISCIPLINE_CODES = IS_DISCIPLINE_CODES;
export type DisciplineCode = IsDisciplineCode;

// Same colour palette used by the (now-deleted) ScopeDisciplineBar so users
// see a familiar accent stripe on each card tab.
const DISCIPLINE_COLORS_EXACT = {
  DEM: "#4A90A4",
  CIV: "#27AE60",
  ASB: "#E67E22",
  Other: "#8E44AD",
  SUB: "#34495E"
} satisfies Record<IsDisciplineCode, string>;

export const DISCIPLINE_COLORS: Record<string, string> = DISCIPLINE_COLORS_EXACT;

export function disciplineColor(discipline: string): string {
  return DISCIPLINE_COLORS[discipline] ?? "#666";
}

export type PlantSummaryGroup = {
  category: string;
  items: Array<{ variant: string | null; peakQty: number; peakDays: number }>;
};

const PLURAL_MAP: Record<string, string> = {
  Excavator: "Excavators",
  Bobcat: "Bobcats",
  Truck: "Trucks",
  Crane: "Cranes",
  Compactor: "Compactors",
  Loader: "Loaders",
  Forklift: "Forklifts"
};

export function pluraliseCategory(cat: string): string {
  if (cat === "Other") return "Other";
  if (PLURAL_MAP[cat]) return PLURAL_MAP[cat];
  return cat.endsWith("s") ? cat : cat + "s";
}

// One line per variant — singular category name because each line refers
// to a single variant. `pluraliseCategory` is kept exported for other callers
// but no longer used here.
export function formatPlantSummary(
  groups: PlantSummaryGroup[]
): string[] {
  if (!groups || groups.length === 0) return ["—"];
  const lines: string[] = [];
  for (const group of groups) {
    for (const it of group.items) {
      if (it.peakQty <= 0) continue;
      const qtyDays = it.peakDays > 0 ? `${it.peakQty} × ${it.peakDays}d` : `×${it.peakQty}`;
      const prefix = it.variant ? `${group.category} ${it.variant}` : group.category;
      lines.push(`${prefix}: ${qtyDays}`);
    }
  }
  return lines.length > 0 ? lines : ["—"];
}

// ── SCOPE_SUB_TAB_V1 — the SUB tab's display vocabulary ─────────────────
//
// scope-subcontracted slice 5. Slice 4 shipped the link field, the quote
// table, the double-count guard and the endpoints; none of it was reachable
// from the screen. These helpers are the display half of that guard, and they
// live here rather than in either picker because the string they produce is
// read on a DISCIPLINE tab (DEM/CIV/ASB), not on the SUB tab — the covered
// item has to announce itself where the estimator is looking when the number
// moves, and ScopeQuantitiesTable is the only file that renders both.
//
// Nothing here computes money. `subMoney` FORMATS a figure the API sent, and
// `COVERED_ITEM_TOTAL` is a constant string, not a sum: slice 4's Rule A
// already decided that a covered item contributes zero, and the client's only
// job is to render that decision legibly rather than re-derive it.

/**
 * Money, to the cent.
 *
 * `fmtCurrency` in ScopeQuantitiesTable renders whole dollars
 * (maximumFractionDigits: 0), which is right for a column of item totals and
 * wrong for the one cell in the table that has to read exactly `$0.00`. Two
 * decimals, always, so a covered row cannot be mistaken for a rounded figure.
 */
export function subMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

/**
 * What a COVERED item's Item total reads.
 *
 * `$0.00` — not an em dash, and not blank. This is the one place in the whole
 * WBS table where a zero is the right rendering rather than a dash, and the
 * distinction is the entire point of the slice: an em dash says "no figure
 * here", a blank says "nobody has filled this in", and both read as an item
 * nobody has priced yet. A covered item IS priced. It is priced by the SUB
 * line named beside it, and priced at nothing HERE, which is exactly what the
 * estimator needs to see when they wonder why the discipline total dropped.
 *
 * Slice 4's double-count guard is invisible otherwise, and an invisible guard
 * reads as a bug.
 */
export const COVERED_ITEM_TOTAL = subMoney(0);

/**
 * The words that stand in for a covered item's Manpower and Plant column
 * groups: "priced on SUB1.1".
 *
 * `subLineWbsCode` is the SUB line's own wbsCode as the server stores it
 * (`${discipline}${cardNumber}.${itemNumber}` — see createItemInCard), so the
 * estimator can go straight to it. A link whose target has gone missing from
 * the tender read falls back to the bare statement rather than to
 * "priced on undefined".
 */
export function pricedOnLabel(subLineWbsCode: string | null | undefined): string {
  const code = (subLineWbsCode ?? "").trim();
  return code === "" ? "priced on a subcontract line" : `priced on ${code}`;
}

/** True when this item's labour and plant are covered by a SUB line. */
export function isCoveredBySubLine(item: { pricedBySubItemId?: string | null }): boolean {
  return item.pricedBySubItemId != null;
}
