/**
 * transport-capacity.spec.ts -- TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9)
 *
 * Unit tests for resolveCapacityPerLoad and listMatrixTransportTypes.
 * No DB required — the RateResolverService is mocked at the listRates level.
 *
 * Tests (10 cases):
 *   1. Version marker equals "scopecards-s9"
 *   2. Exact match on material class + transport type returns tonnes capacity
 *   3. Exact match returns m3 capacity when capacityUnit is "m3"
 *   4. Exact match returns m3 capacity when capacityUnit is the unicode "m³"
 *   5. Unmatched material class returns null
 *   6. Unmatched transport type returns null
 *   7. Blank transportType param returns null (no matrix lookup fires)
 *   8. Null transportType param returns null
 *   9. capacityUnit neither "t" nor "m3"/"m³" returns null
 *  10. listMatrixTransportTypes returns deduped type strings from matrix rows
 */

import {
  TRANSPORT_CAPACITY_MATRIX_V1,
  resolveCapacityPerLoad,
  listMatrixTransportTypes
} from "../transport-capacity";
import type { RateResolverService } from "../../rates/rate-resolver.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ListedRate row as returned by RateResolverService.listRates.
 * Only the fields used by resolveCapacityPerLoad are required.
 */
function makeRow(
  materialClass: string,
  transportType: string,
  tonnes: number,
  m3: number
) {
  return {
    rowId: `row-${materialClass}-${transportType}`,
    keys: {
      "Material class": materialClass,
      "Transport type": transportType
    },
    info: {},
    value: tonnes,
    extraValues: {
      "Capacity (m³)": m3
    },
    unit: "t",
    isActive: true,
    sortOrder: 0,
    fuelRate: null,
    source: "ratetable" as const
  };
}

/** Build a mock RateResolverService whose listRates always returns `rows`. */
function mockResolver(
  rows: ReturnType<typeof makeRow>[]
): Pick<RateResolverService, "listRates"> {
  return {
    listRates: jest.fn().mockResolvedValue(rows)
  };
}

/** Build a resolver whose listRates throws NotFoundException. */
function errorResolver(): Pick<RateResolverService, "listRates"> {
  return {
    listRates: jest.fn().mockRejectedValue(new Error("Not found"))
  };
}

// The standard matrix used by most tests:
//   Concrete x 10-wheel  => 25t / 14m3
//   Soil x Semi          => 20t / 18m3
//   Concrete x Semi      => 26t / 16m3
const standardMatrix = [
  makeRow("Concrete", "10-wheel", 25, 14),
  makeRow("Soil", "Semi", 20, 18),
  makeRow("Concrete", "Semi", 26, 16)
];

// ---------------------------------------------------------------------------
// 1. Version marker
// ---------------------------------------------------------------------------

describe("TRANSPORT_CAPACITY_MATRIX_V1", () => {
  it("equals the scopecards-s9 identifier", () => {
    expect(TRANSPORT_CAPACITY_MATRIX_V1).toBe("scopecards-s9");
  });
});

// ---------------------------------------------------------------------------
// 2. Exact match — tonnes
// ---------------------------------------------------------------------------

describe("resolveCapacityPerLoad — exact match (tonnes)", () => {
  it("returns the correct tonnes value for a known material class and transport type", async () => {
    const resolver = mockResolver(standardMatrix);
    const result = await resolveCapacityPerLoad(resolver, {
      wasteGroup: "Concrete",
      transportType: "10-wheel",
      capacityUnit: "t"
    });
    expect(result).not.toBeNull();
    expect(result?.capacity).toBe(25);
    expect(result?.source).toBe("matrix");
    expect(result?.materialClass).toBe("Concrete");
    expect(result?.transportType).toBe("10-wheel");
  });
});

// ---------------------------------------------------------------------------
// 3. Exact match — m3
// ---------------------------------------------------------------------------

describe("resolveCapacityPerLoad — exact match (m3 ASCII)", () => {
  it("returns the m3 column value when capacityUnit is 'm3'", async () => {
    const resolver = mockResolver(standardMatrix);
    const result = await resolveCapacityPerLoad(resolver, {
      wasteGroup: "Soil",
      transportType: "Semi",
      capacityUnit: "m3"
    });
    expect(result).not.toBeNull();
    expect(result?.capacity).toBe(18);
    expect(result?.source).toBe("matrix");
  });
});

// ---------------------------------------------------------------------------
// 4. Exact match — m³ (unicode)
// ---------------------------------------------------------------------------

describe("resolveCapacityPerLoad — exact match (m³ unicode)", () => {
  it("returns the m3 column value when capacityUnit is the unicode m³ character", async () => {
    const resolver = mockResolver(standardMatrix);
    const result = await resolveCapacityPerLoad(resolver, {
      wasteGroup: "Concrete",
      transportType: "Semi",
      capacityUnit: "m³"
    });
    expect(result).not.toBeNull();
    expect(result?.capacity).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// 5. Unmatched material class returns null
// ---------------------------------------------------------------------------

describe("resolveCapacityPerLoad — unmatched material class", () => {
  it("returns null when wasteGroup is not in the matrix", async () => {
    const resolver = mockResolver(standardMatrix);
    const result = await resolveCapacityPerLoad(resolver, {
      wasteGroup: "Asbestos",
      transportType: "10-wheel",
      capacityUnit: "t"
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Unmatched transport type returns null
// ---------------------------------------------------------------------------

describe("resolveCapacityPerLoad — unmatched transport type", () => {
  it("returns null when transportType is not in the matrix for that material class", async () => {
    const resolver = mockResolver(standardMatrix);
    const result = await resolveCapacityPerLoad(resolver, {
      wasteGroup: "Concrete",
      transportType: "B-double",
      capacityUnit: "t"
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. Blank transportType returns null (gate fires before lookup)
// ---------------------------------------------------------------------------

describe("resolveCapacityPerLoad — blank transportType", () => {
  it("returns null immediately when transportType is an empty string", async () => {
    const resolver = mockResolver(standardMatrix);
    const result = await resolveCapacityPerLoad(resolver, {
      wasteGroup: "Concrete",
      transportType: "",
      capacityUnit: "t"
    });
    expect(result).toBeNull();
    // listRates must NOT have been called — the gate fires before it.
    expect(resolver.listRates).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. Null transportType returns null
// ---------------------------------------------------------------------------

describe("resolveCapacityPerLoad — null transportType", () => {
  it("returns null when transportType is null", async () => {
    const resolver = mockResolver(standardMatrix);
    const result = await resolveCapacityPerLoad(resolver, {
      wasteGroup: "Concrete",
      transportType: null,
      capacityUnit: "t"
    });
    expect(result).toBeNull();
    expect(resolver.listRates).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 9. Unrecognised capacityUnit returns null
// ---------------------------------------------------------------------------

describe("resolveCapacityPerLoad — unrecognised capacityUnit", () => {
  it("returns null when capacityUnit is neither 't' nor 'm3'/'m³'", async () => {
    const resolver = mockResolver(standardMatrix);
    const result = await resolveCapacityPerLoad(resolver, {
      wasteGroup: "Concrete",
      transportType: "10-wheel",
      capacityUnit: "each"
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 10. listMatrixTransportTypes
// ---------------------------------------------------------------------------

describe("listMatrixTransportTypes", () => {
  it("returns deduplicated transport type strings in matrix order", async () => {
    // standardMatrix has: 10-wheel, Semi, Semi (duplicate).
    // Expects deduped in first-occurrence order.
    const resolver = mockResolver(standardMatrix);
    const types = await listMatrixTransportTypes(resolver);
    expect(types).toEqual(["10-wheel", "Semi"]);
  });

  it("returns an empty array when the matrix cannot be loaded", async () => {
    const resolver = errorResolver();
    const types = await listMatrixTransportTypes(resolver);
    expect(types).toEqual([]);
  });
});
