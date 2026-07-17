// PR B4a — pure helper for scope-item dimension derivation.
//
// Inputs are the raw dimension fields a user types into a scope card's
// Quantification section: length, height, depth, density, plus three
// "derived-or-override" fields (sqm, m³, tonnes). The helper computes
// the derived values, honouring any explicit override the user has
// supplied:
//
//   sqm    = explicit.sqm    ?? length × height
//   m3     = explicit.m3     ?? sqm    × depth
//   tonnes = explicit.tonnes ?? m3     × density
//
// Any leg whose inputs are insufficient (missing factor, non-finite,
// negative) returns null. Explicit overrides are respected verbatim,
// INCLUDING explicit 0 — null vs 0 is a deliberate distinction (cleared
// vs zeroed). Output values are rounded to 2 decimal places.
//
// Lives server-side; an identical mirror ships at
// apps/web/src/pages/tendering/scopeItemDimensions.ts for live preview.

/**
 * Raw Quantification inputs for a scope item: length/height/depth in
 * metres, density in t/m³ (or kg/m² for the sheet-material fallback),
 * plus optional explicit overrides for the three derived fields.
 *
 * PR feat/scope-each-factor — kind selects the formula branch:
 *   VOLUME (default): tonnes = m³ × density
 *   AREA:             tonnes = sqm × density / 1000
 *   EACH:             tonnes = quantity × (perItemWeightKg / 1000)
 *   FACTOR:           tonnes = sqm × factor
 * quantity and factor are only meaningful for EACH and FACTOR respectively.
 */
export type DimensionInput = {
  length?: number | null;
  height?: number | null;
  depth?: number | null;
  density?: number | null;
  sqm?: number | null; // explicit override
  m3?: number | null; // explicit override
  tonnes?: number | null; // explicit override
  // PR feat/scope-each-factor
  kind?: "VOLUME" | "AREA" | "EACH" | "FACTOR" | null;
  quantity?: number | null; // for EACH: count of items
  factor?: number | null; // for FACTOR: sqm multiplier
};

/** Derived dimension values; null means "could not be derived / cleared". */
export type DerivedDimensions = {
  sqm: number | null;
  m3: number | null;
  tonnes: number | null;
};

function pos(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Derive sqm / m³ / tonnes from raw dimension inputs, honouring
 * explicit overrides.
 *
 * Chain: sqm = sqm ?? L×H; m3 = m3 ?? sqm×depth; tonnes = tonnes ??
 * (m³>0 ? m³×density : sqm>0 ? sqm×density/1000 : null) — the sqm
 * fallback treats density as kg/m² for sheet materials. Explicit
 * overrides are respected verbatim, INCLUDING explicit 0 (cleared vs
 * zeroed is deliberate). Negative or non-finite factor inputs are
 * treated as absent; any leg with insufficient inputs is null.
 *
 * @param input - raw dimensions plus optional sqm/m3/tonnes overrides
 * @returns { sqm, m3, tonnes } each rounded to 2 decimal places or null
 */
export function computeDerivedDimensions(input: DimensionInput): DerivedDimensions {
  const length = pos(input.length);
  const height = pos(input.height);
  const depth = pos(input.depth);
  const density = pos(input.density);

  // sqm: explicit override wins (even 0). Otherwise needs both L and H.
  let sqm: number | null;
  if (input.sqm !== null && input.sqm !== undefined && Number.isFinite(input.sqm)) {
    sqm = round2(input.sqm);
  } else if (length !== null && height !== null) {
    sqm = round2(length * height);
  } else {
    sqm = null;
  }

  // m3: explicit override wins. Otherwise needs computed sqm × depth.
  let m3: number | null;
  if (input.m3 !== null && input.m3 !== undefined && Number.isFinite(input.m3)) {
    m3 = round2(input.m3);
  } else if (sqm !== null && depth !== null) {
    m3 = round2(sqm * depth);
  } else {
    m3 = null;
  }

  // tonnes: explicit override wins. Otherwise branch on kind:
  //   EACH   → quantity × (density / 1000), where density stores perItemWeightKg.
  //   FACTOR → sqm × factor (no density divide).
  //   VOLUME (default) → m³ × density.
  //   AREA   → sqm × density / 1000 (PR B4a.5 sheet-material fallback).
  // PR feat/scope-each-factor — kind is optional; null/undefined falls
  // through to the legacy VOLUME/AREA chain for backward compat.
  const kind = input.kind ?? null;
  const quantity = pos(input.quantity);
  const factor = pos(input.factor);
  let tonnes: number | null;
  if (input.tonnes !== null && input.tonnes !== undefined && Number.isFinite(input.tonnes)) {
    tonnes = round2(input.tonnes);
  } else if (kind === "EACH") {
    // tonnes = quantity × (perItemWeightKg ÷ 1000)
    tonnes = quantity !== null && density !== null ? round2(quantity * (density / 1000)) : null;
  } else if (kind === "FACTOR") {
    // tonnes = sqm × factor
    tonnes = sqm !== null && sqm > 0 && factor !== null ? round2(sqm * factor) : null;
  } else if (m3 !== null && m3 > 0 && density !== null) {
    tonnes = round2(m3 * density);
  } else if (sqm !== null && sqm > 0 && density !== null) {
    tonnes = round2((sqm * density) / 1000);
  } else {
    tonnes = null;
  }

  return { sqm, m3, tonnes };
}
