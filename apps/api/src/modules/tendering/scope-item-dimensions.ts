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
 */
export type DimensionInput = {
  length?: number | null;
  height?: number | null;
  depth?: number | null;
  density?: number | null;
  sqm?: number | null; // explicit override
  m3?: number | null; // explicit override
  tonnes?: number | null; // explicit override
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

  // tonnes: explicit override wins. Otherwise:
  //   - if m³ > 0 → m³ × density (density treated as t/m³ for volumes)
  //   - else if sqm > 0 → sqm × density / 1000 (PR B4a.5 sheet-material
  //     fallback: density treated as kg/m², divided by 1000 to convert
  //     kg → tonnes)
  //   - else null
  let tonnes: number | null;
  if (input.tonnes !== null && input.tonnes !== undefined && Number.isFinite(input.tonnes)) {
    tonnes = round2(input.tonnes);
  } else if (m3 !== null && m3 > 0 && density !== null) {
    tonnes = round2(m3 * density);
  } else if (sqm !== null && sqm > 0 && density !== null) {
    tonnes = round2((sqm * density) / 1000);
  } else {
    tonnes = null;
  }

  return { sqm, m3, tonnes };
}
