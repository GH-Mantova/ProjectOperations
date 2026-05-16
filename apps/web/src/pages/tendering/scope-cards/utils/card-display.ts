// PR B1.5 — display helpers for the cards-as-tabs UI.

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

// Mirror of apps/api IS_DISCIPLINE_LABELS — kept duplicated since web ↔ api
// don't share a runtime package.
export const DISCIPLINE_LABELS: Record<string, string> = {
  DEM: "Demolition",
  CIV: "Civil works",
  ASB: "Asbestos removal",
  Other: "Other"
};

export const DISCIPLINE_CODES = ["DEM", "CIV", "ASB", "Other"] as const;
export type DisciplineCode = (typeof DISCIPLINE_CODES)[number];

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
