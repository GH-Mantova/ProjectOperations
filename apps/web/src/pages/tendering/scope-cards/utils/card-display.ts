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
export const DISCIPLINE_LABELS: Record<string, string> = {
  DEM: "Demolition",
  CIV: "Civil works",
  ASB: "Asbestos removal",
  Other: "Other"
};

/** Canonical discipline code tuple — imported from the single source of truth. */
export const DISCIPLINE_CODES = IS_DISCIPLINE_CODES;
export type DisciplineCode = IsDisciplineCode;

// Same colour palette used by the (now-deleted) ScopeDisciplineBar so users
// see a familiar accent stripe on each card tab.
export const DISCIPLINE_COLORS: Record<string, string> = {
  DEM: "#4A90A4",
  CIV: "#27AE60",
  ASB: "#E67E22",
  Other: "#8E44AD"
};

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
