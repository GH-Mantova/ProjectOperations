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
