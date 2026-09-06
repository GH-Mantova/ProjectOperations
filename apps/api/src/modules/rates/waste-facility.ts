/**
 * waste-facility.ts — TIP-ID-S1
 *
 * Pure resolver for the display name of a waste rate row's facility.
 *
 * D3 option (d): the rate row carries a MapLocation id in cells.mapLocationId.
 * When the id is set AND resolves through the caller-supplied lookup, the
 * MapLocation name is returned. Otherwise the stored facility string is used as
 * fallback, preserving the legacy behaviour on every row that was written before
 * this slice (where mapLocationId is null) and on any row where the id has gone
 * stale (dangling reference).
 *
 * A dangling reference — id set but not in the lookup — is distinguished from
 * "not linked yet" (id null) so callers can surface it to the user. This is the
 * safety argument for option (d): a dead link must never be invisible.
 *
 * This module is inert until TIP-ID-S2 writes real ids into the rows. Until
 * then every row ships mapLocationId: null and resolveWasteFacility always
 * returns { name: cells.facility, dangling: false }.
 *
 * No Prisma — the lookup is a plain Map or record supplied by the caller, so
 * every branch is unit-testable without a DB, in the same style as
 * scope-item-pricing.ts.
 */

/**
 * The cells object for a waste rate row as stored in the JSON column.
 * Only the fields this resolver reads are typed here; other keys are allowed.
 */
export interface WasteRateCells {
  /** Human-readable facility string — always present, never removed. */
  facility?: string | null;
  /**
   * MapLocation id (TIP-ID-S1+). Null means "not linked yet"; the field must
   * be present and explicitly null rather than absent so readers can tell the
   * difference between an unlinked row and a row written before this column
   * existed.
   */
  mapLocationId?: string | null;
  /** Allow additional cell keys. */
  [key: string]: unknown;
}

/**
 * Result of resolving the display name for a waste row.
 *
 * - `name`     — the string to display. Never null; falls back to "" if both
 *                facility and lookup produce nothing.
 * - `dangling` — true when mapLocationId was set (non-null) but did not appear
 *                in the supplied lookup. Callers should surface this to the user;
 *                a dead id must never be indistinguishable from "not linked yet".
 */
export interface WasteFacilityResult {
  name: string;
  dangling: boolean;
}

/**
 * A lookup from MapLocation id to name, as supplied by the caller.
 * Accepts a plain `Map<string, string>` or any object with a `get` method
 * (so tests can use a Map directly and the service layer can use a Map built
 * from a Prisma query result).
 */
export interface MapLocationLookup {
  get(id: string): string | undefined;
}

/**
 * Resolve the display name for a waste rate row.
 *
 * @param cells  The `cells` JSON from the rate row.
 * @param lookup A map from MapLocation id to name. The caller is responsible
 *               for building this from the database; this function does not
 *               touch Prisma.
 *
 * @returns `{ name, dangling }` — see `WasteFacilityResult` for semantics.
 *          Never throws.
 */
export function resolveWasteFacility(
  cells: WasteRateCells,
  lookup: MapLocationLookup
): WasteFacilityResult {
  const id = cells.mapLocationId ?? null;

  if (id !== null) {
    const resolved = lookup.get(id);
    if (resolved !== undefined) {
      // id set and resolves — return the MapLocation name, no dangling signal.
      return { name: resolved, dangling: false };
    }
    // id set but not in the lookup — dangling reference.
    return { name: cells.facility ?? "", dangling: true };
  }

  // id null — not linked yet, fall back silently to the stored facility string.
  return { name: cells.facility ?? "", dangling: false };
}
