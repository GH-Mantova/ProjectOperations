// PR #37 (§7) — pure helpers for Cutrite-specific geometry.
//
// Two unwired primitives that future Cutrite estimation flows can consume:
//   - computeBlockWeight: mass of a rectangular block from L×W×D × density.
//     Used for lifting / demolition planning.
//   - computeGhostCutLengthMetres: total saw-cut length to extract a
//     rectangular cut-out and slice it into N liftable pieces. Perimeter
//     plus (pieces-1) internal cuts along the longer (length) axis, so
//     each internal cut spans the shorter (width) dimension.
//
// Pure module: no Prisma, no NestJS, no I/O.

/** Default density for reinforced concrete, in kg/m³. */
export const DEFAULT_DENSITY_CONCRETE_KG_PER_M3 = 2400;

function assertPositiveFinite(value: number, name: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number (got ${value})`);
  }
  if (value <= 0) {
    throw new Error(`${name} must be greater than 0 (got ${value})`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number (got ${value})`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer (got ${value})`);
  }
  if (value < 1) {
    throw new Error(`${name} must be >= 1 (got ${value})`);
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Rectangular block dimensions, all in metres and all required > 0. */
export interface BlockDimensions {
  lengthM: number;
  widthM: number;
  depthM: number;
}

/**
 * Compute block weight (kg) from dimensions + material density.
 * @param dims Length, width, depth — all in metres, all > 0.
 * @param densityKgPerM3 Material density in kg/m³, > 0.
 * @returns Weight in kg, rounded to 1 decimal place.
 * @throws Error if any input is non-finite, zero, or negative.
 */
export function computeBlockWeight(
  dims: BlockDimensions,
  densityKgPerM3: number,
): number {
  assertPositiveFinite(dims.lengthM, "lengthM");
  assertPositiveFinite(dims.widthM, "widthM");
  assertPositiveFinite(dims.depthM, "depthM");
  assertPositiveFinite(densityKgPerM3, "densityKgPerM3");

  const volumeM3 = dims.lengthM * dims.widthM * dims.depthM;
  return round(volumeM3 * densityKgPerM3, 1);
}

/** Input for computeGhostCutLengthMetres: cut-out length/width in metres. */
export interface GhostCutInput {
  lengthM: number;
  widthM: number;
  /** Number of liftable pieces the cut-out is sliced into. >= 1. Defaults to 1. */
  pieces?: number;
}

/**
 * Compute total saw-cut length needed when extracting a rectangular
 * cut-out from a larger slab and slicing it into liftable pieces.
 *
 * Geometry: perimeter (2 × (L + W)) plus (pieces - 1) internal cuts.
 * Internal cuts run perpendicular to the longer (length) axis, so each
 * one spans the shorter (width) dimension.
 *
 * @returns Total cut length in metres, rounded to 0.01 m.
 * @throws Error if lengthM/widthM are not positive finite numbers, or
 *   pieces is not a positive integer.
 */
export function computeGhostCutLengthMetres(input: GhostCutInput): number {
  assertPositiveFinite(input.lengthM, "lengthM");
  assertPositiveFinite(input.widthM, "widthM");
  const pieces = input.pieces ?? 1;
  assertPositiveInteger(pieces, "pieces");

  const perimeter = 2 * (input.lengthM + input.widthM);
  const internalCuts = (pieces - 1) * input.widthM;
  return round(perimeter + internalCuts, 2);
}
