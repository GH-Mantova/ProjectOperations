// PR B4a — frontend mirror of the API's pure dimensions helper. Identical
// math contract; kept in sync by hand so the live preview matches what
// the server will persist on save. See apps/api/src/modules/tendering/
// scope-item-dimensions.ts for the canonical source-of-truth.

export type DimensionInput = {
  length?: number | null;
  height?: number | null;
  depth?: number | null;
  density?: number | null;
  sqm?: number | null;
  m3?: number | null;
  tonnes?: number | null;
  // PR feat/scope-each-factor
  kind?: "VOLUME" | "AREA" | "EACH" | "FACTOR" | null;
  quantity?: number | null; // for EACH: count of items
  factor?: number | null; // for FACTOR: sqm multiplier
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

  let sqm: number | null;
  if (input.sqm !== null && input.sqm !== undefined && Number.isFinite(input.sqm)) {
    sqm = round2(input.sqm);
  } else if (length !== null && height !== null) {
    sqm = round2(length * height);
  } else {
    sqm = null;
  }

  let m3: number | null;
  if (input.m3 !== null && input.m3 !== undefined && Number.isFinite(input.m3)) {
    m3 = round2(input.m3);
  } else if (sqm !== null && depth !== null) {
    m3 = round2(sqm * depth);
  } else {
    m3 = null;
  }

  // PR B4a.5 — tonnes fallback chain: explicit > kind-branch > legacy chain.
  // PR feat/scope-each-factor — kind selects the formula:
  //   EACH:   quantity × (density / 1000) where density = perItemWeightKg
  //   FACTOR: sqm × factor
  //   default (VOLUME/AREA/null): m³×density then sqm×density/1000
  // Mirror of the API helper.
  const kind = input.kind ?? null;
  const quantity = pos(input.quantity);
  const factor = pos(input.factor);
  let tonnes: number | null;
  if (input.tonnes !== null && input.tonnes !== undefined && Number.isFinite(input.tonnes)) {
    tonnes = round2(input.tonnes);
  } else if (kind === "EACH") {
    tonnes = quantity !== null && density !== null ? round2(quantity * (density / 1000)) : null;
  } else if (kind === "FACTOR") {
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

export function isDimensionOverride(saved: string | null | undefined, autoDerived: number | null): boolean {
  if (saved == null) return false;
  const s = Number(saved);
  if (!Number.isFinite(s)) return false;
  if (autoDerived == null) return true;
  return Math.round(s * 100) !== Math.round(autoDerived * 100);
}
