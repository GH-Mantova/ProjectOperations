/**
 * IS discipline codes — canonical source for the web app.
 *
 * Mirrors apps/api/src/modules/personas/definitions/disciplines.ts.
 * Web and API do not share a runtime package, so this file is the
 * single source of truth for every web consumer. Do not inline
 * discipline code literals elsewhere in the web app.
 *
 * Migration history (2026-05-16, PR A1):
 *   SO/Str → DEM, Asb → ASB, Civ → CIV, Prv → Other
 */

export const IS_DISCIPLINE_CODES = ["DEM", "CIV", "ASB", "Other"] as const;
export type IsDisciplineCode = (typeof IS_DISCIPLINE_CODES)[number];

/** Short display labels used across the web UI. */
export const IS_DISCIPLINE_LABELS: Record<IsDisciplineCode, string> = {
  DEM: "Demolition",
  CIV: "Civil",
  ASB: "Asbestos",
  Other: "Other"
};
