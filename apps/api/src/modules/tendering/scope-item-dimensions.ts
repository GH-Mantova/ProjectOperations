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

export type DimensionInput = {
  length?: number | null;
  height?: number | null;
  depth?: number | null;
  density?: number | null;
  sqm?: number | null; // explicit override
  m3?: number | null; // explicit override
  tonnes?: number | null; // explicit override
};

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

  // tonnes: explicit override wins. Otherwise needs computed m3 × density.
  let tonnes: number | null;
  if (input.tonnes !== null && input.tonnes !== undefined && Number.isFinite(input.tonnes)) {
    tonnes = round2(input.tonnes);
  } else if (m3 !== null && density !== null) {
    tonnes = round2(m3 * density);
  } else {
    tonnes = null;
  }

  return { sqm, m3, tonnes };
}
