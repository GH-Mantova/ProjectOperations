/**
 * transport-capacity.ts -- TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9)
 *
 * Resolver that reads the transport-capacity reference rate table
 * (slug "transport-capacity") to supply a default capacity per load for a
 * waste line, keyed by material class (= wasteGroup) x transport type
 * (= EstimatePlantRate.transportType).
 *
 * Marco's rules (from the S9 brief):
 *   - Capacity lives in a reference table keyed by (material class x transport
 *     type); a per-line override stays local to the line and never pushes back
 *     to the table.
 *   - No guessing. No fuzzy matching, no aliases, no "nearest" row. Either
 *     both keys match a row exactly or the resolver returns null.
 *   - A material class with no row (a wasteGroup the matrix has never heard of)
 *     is a null, not a default.
 *   - The matrix is a reference table (isReference = true) and is excluded from
 *     tender rate-set snapshots. Capacity defaults are resolved live, not locked.
 *
 * Column names (from migration 20260715120000_r3_t0_asset_fuel_capacity):
 *   KEY:   "Material class"      -- matches ScopeWasteItem.wasteGroup exactly
 *   KEY:   "Transport type"      -- matches EstimatePlantRate.transportType exactly
 *   VALUE: "Capacity (tonnes)"   -- returned when capacityUnit is "t" (valueCols[0])
 *   VALUE: "Capacity (m3)"      -- returned when capacityUnit is "m3"/"m3"
 *                                   (valueCols[1], exposed via ListedRate.extraValues)
 *
 * The RateResolverService.listRates method exposes the primary VALUE column in
 * `value` and secondary VALUE columns in `extraValues` (TRANSPORT_CAPACITY_MATRIX_V1
 * extension, added alongside this resolver). This resolver uses:
 *   - match.value          for the tonnes column (valueCols[0])
 *   - match.extraValues[COL_M3] for the m3 column (valueCols[1])
 */

import type { RateResolverService } from "../rates/rate-resolver.service";

/** Version marker required by the done_when gate. */
export const TRANSPORT_CAPACITY_MATRIX_V1 = "scopecards-s9";

/** Slug of the transport-capacity reference rate table. */
const TABLE_SLUG = "transport-capacity";

/** Column name for the material-class KEY column in the matrix. */
const COL_MATERIAL = "Material class";

/** Column name for the transport-type KEY column in the matrix. */
const COL_TRANSPORT = "Transport type";

/**
 * Column name for the m3 VALUE column (second VALUE column in the matrix).
 * Accessed via ListedRate.extraValues[COL_M3] -- populated by the rate resolver's
 * tryListRateTable when it encounters a table with multiple VALUE columns.
 */
const COL_M3 = "Capacity (m³)";

export type CapacityResolveResult = {
  capacity: number;
  source: "matrix";
  materialClass: string;
  transportType: string;
};

/**
 * Resolve a default capacity per load from the transport-capacity matrix.
 *
 * Reads the matrix via RateResolverService.listRates("transport-capacity"),
 * matches Material class = wasteGroup AND Transport type = transportType
 * (both exact, case-sensitive, as stored). Returns the tonnes column value when
 * capacityUnit is "t", or the m3 column value when capacityUnit is "m3"/"m3".
 *
 * Returns null when:
 *   - transportType is null/blank (plant rate has no rig type assigned)
 *   - wasteGroup is null/blank
 *   - no row matches both keys exactly
 *   - the matching row has no value for the requested unit column
 *   - capacityUnit is neither "t" nor "m3"/"m3"
 *   - the matrix table cannot be loaded (e.g. NotFoundException)
 *
 * NEVER writes to the matrix. NEVER guesses or fuzzy-matches.
 *
 * The transport-type option list is read from the matrix's own Transport type
 * key column (via listRates), so the dropdown in Rates & Lists admin and the
 * matrix can never drift -- no hard-coded list anywhere in this code path.
 *
 * @param rateResolver - injected RateResolverService
 * @param params.wasteGroup - the waste line's material class (must match matrix exactly)
 * @param params.transportType - the plant rate's transport type (must match matrix exactly)
 * @param params.capacityUnit - "t" for tonnes, "m3" or "m3" for cubic metres
 */
export async function resolveCapacityPerLoad(
  rateResolver: Pick<RateResolverService, "listRates">,
  params: {
    wasteGroup: string | null | undefined;
    transportType: string | null | undefined;
    capacityUnit: string | null | undefined;
  }
): Promise<CapacityResolveResult | null> {
  const { wasteGroup, transportType, capacityUnit } = params;

  // Gate: both keys must be present and non-blank.
  if (!wasteGroup || !transportType) return null;

  // Determine which value column to read.
  const wantM3 = capacityUnit === "m3" || capacityUnit === "m³";
  const wantTonnes = capacityUnit === "t";
  if (!wantM3 && !wantTonnes) return null;

  let rows;
  try {
    // The transport-capacity table is isReference=true, so it is NOT locked
    // into tender rate-set snapshots. Always resolve live (no tenderId passed).
    rows = await rateResolver.listRates(TABLE_SLUG);
  } catch {
    // NotFoundException or any other error -- return null quietly.
    return null;
  }

  // Find the row where both KEY columns match exactly (case-sensitive, as stored).
  // No fuzzy matching, no aliases. Both keys must be an exact hit.
  const match = rows.find((row) => {
    const mat = row.keys[COL_MATERIAL];
    const trn = row.keys[COL_TRANSPORT];
    return mat === wasteGroup && trn === transportType;
  });

  if (!match) return null;

  // Read the appropriate value column.
  // - For tonnes: match.value is valueCols[0] = "Capacity (tonnes)".
  // - For m3: match.extraValues[COL_M3] is valueCols[1] = "Capacity (m3)",
  //   exposed by the rate resolver's TRANSPORT_CAPACITY_MATRIX_V1 extension.
  let capacity: number | null = null;

  if (wantTonnes) {
    const n = match.value;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) {
      capacity = n;
    }
  } else {
    // wantM3: read from extraValues keyed by column name.
    const raw = match.extraValues[COL_M3];
    if (raw !== undefined && typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      capacity = raw;
    }
  }

  if (capacity === null) return null;

  return {
    capacity,
    source: "matrix",
    materialClass: String(wasteGroup),
    transportType: String(transportType)
  };
}

/**
 * Read the distinct transport-type values from the matrix's own Transport type
 * KEY column. Used by the admin UI to populate the Transport type select on
 * transport-category plant rates WITHOUT a hard-coded list.
 *
 * Returns an empty array when the matrix cannot be loaded.
 *
 * The list is read live so that any transport types Marco adds in Rates & Lists
 * appear immediately in the plant-rate editor.
 */
export async function listMatrixTransportTypes(
  rateResolver: Pick<RateResolverService, "listRates">
): Promise<string[]> {
  let rows;
  try {
    rows = await rateResolver.listRates(TABLE_SLUG);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  for (const row of rows) {
    const trn = row.keys[COL_TRANSPORT];
    if (typeof trn === "string" && trn.trim()) {
      seen.add(trn);
    }
  }
  // Return in the order the matrix presents them (listRates respects sortOrder).
  return [...seen];
}
