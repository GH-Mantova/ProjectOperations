/**
 * waste-facility.spec.ts — TIP-ID-S1
 *
 * Unit tests for the pure resolveWasteFacility() function.
 * No Prisma, no DB. Four cases mandated by the slice spec:
 *   1. id null               -> name from cells.facility, not dangling
 *   2. id set and resolving  -> name from the lookup, not dangling
 *   3. id set and dangling   -> name from cells.facility, dangling: true
 *   4. both absent           -> empty string, no throw
 */

import { resolveWasteFacility, type WasteRateCells, type MapLocationLookup } from "../waste-facility";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a trivial Map-based lookup for tests. */
function lookup(entries: Record<string, string>): MapLocationLookup {
  return new Map(Object.entries(entries));
}

const emptyLookup = lookup({});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("resolveWasteFacility", () => {
  // Case 1: mapLocationId is null — not linked yet, fall back to facility string.
  it("returns the facility name when mapLocationId is null", () => {
    const cells: WasteRateCells = {
      facility: "Eastern Transfer Station",
      mapLocationId: null
    };
    const result = resolveWasteFacility(cells, emptyLookup);
    expect(result.name).toBe("Eastern Transfer Station");
    expect(result.dangling).toBe(false);
  });

  // Case 2: mapLocationId set and present in the lookup — use the MapLocation name.
  it("returns the MapLocation name when mapLocationId resolves", () => {
    const cells: WasteRateCells = {
      facility: "Eastern Transfer Station",
      mapLocationId: "loc-abc-123"
    };
    const result = resolveWasteFacility(cells, lookup({ "loc-abc-123": "East TIP (Renamed)" }));
    expect(result.name).toBe("East TIP (Renamed)");
    expect(result.dangling).toBe(false);
  });

  // Case 3: mapLocationId set but NOT in the lookup — dangling reference.
  // Must return the stored facility string AND signal dangling: true.
  it("returns the facility name and dangling:true when mapLocationId does not resolve", () => {
    const cells: WasteRateCells = {
      facility: "Eastern Transfer Station",
      mapLocationId: "loc-deleted-999"
    };
    const result = resolveWasteFacility(cells, emptyLookup);
    expect(result.name).toBe("Eastern Transfer Station");
    expect(result.dangling).toBe(true);
  });

  // Case 4: both facility and mapLocationId absent — must return "" and not throw.
  it("returns empty string without throwing when both facility and mapLocationId are absent", () => {
    const cells: WasteRateCells = {};
    expect(() => resolveWasteFacility(cells, emptyLookup)).not.toThrow();
    const result = resolveWasteFacility(cells, emptyLookup);
    expect(result.name).toBe("");
    expect(result.dangling).toBe(false);
  });

  // Extra guard: mapLocationId absent (undefined, not null) falls back to facility.
  // Covers rows written before TIP-ID-S1 where the field was never set at all.
  it("falls back to facility when mapLocationId is undefined (pre-S1 row)", () => {
    const cells: WasteRateCells = { facility: "Legacy TIP" };
    const result = resolveWasteFacility(cells, emptyLookup);
    expect(result.name).toBe("Legacy TIP");
    expect(result.dangling).toBe(false);
  });

  // Extra guard: dangling id with no facility string returns "" not undefined or null.
  it("returns empty string (not undefined) when dangling and facility is absent", () => {
    const cells: WasteRateCells = { mapLocationId: "loc-gone" };
    const result = resolveWasteFacility(cells, emptyLookup);
    expect(result.name).toBe("");
    expect(result.dangling).toBe(true);
  });
});
