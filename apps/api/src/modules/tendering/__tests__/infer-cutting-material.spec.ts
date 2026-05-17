// PR B4b — specs for the cutting material auto-inference helper used by
// the per-card "Copy from above" aggregator. Pure function; no Prisma,
// no NestJS — just the priority + matching contract.
//
// Critical behaviour (Marco's locked answer #1): when no field contains
// a recognisable material token, return null. Do NOT default to
// "Concrete". The frontend renders an amber warning border so the
// estimator picks manually — silent defaults would hide misclassified
// rows under the wrong rate column.

import { inferCuttingMaterial } from "../scope-redesign.service";

describe("inferCuttingMaterial (PR B4b)", () => {
  it("returns 'Asphalt' when material contains the word asphalt", () => {
    expect(
      inferCuttingMaterial({ material: "Asphalt", materialType: null, description: null })
    ).toBe("Asphalt");
  });

  it("falls through to materialType when material is null — 'brick' → 'Masonry'", () => {
    expect(
      inferCuttingMaterial({ material: null, materialType: "clay brick", description: null })
    ).toBe("Masonry");
  });

  it("falls through to description when material + materialType are both null — 'concrete' → 'Concrete'", () => {
    expect(
      inferCuttingMaterial({
        material: null,
        materialType: null,
        description: "reinforced concrete slab"
      })
    ).toBe("Concrete");
  });

  it("returns null when every field is null (no default-to-Concrete)", () => {
    expect(
      inferCuttingMaterial({ material: null, materialType: null, description: null })
    ).toBeNull();
  });

  it("is case-insensitive — 'ASPHALT' → 'Asphalt'", () => {
    expect(
      inferCuttingMaterial({ material: "ASPHALT", materialType: null, description: null })
    ).toBe("Asphalt");
  });

  it("returns null when no candidate field contains a recognised token (Marco's locked answer #1)", () => {
    // Deliberately does NOT default to Concrete. The estimator must
    // pick manually so misclassified rows don't silently price under
    // the wrong rate column.
    expect(
      inferCuttingMaterial({
        material: "carpet underlay",
        materialType: null,
        description: "soundproofing layer"
      })
    ).toBeNull();
  });

  it("'masonry' alone matches Masonry (synonym list — brick / block / masonry)", () => {
    expect(
      inferCuttingMaterial({ material: "masonry wall", materialType: null, description: null })
    ).toBe("Masonry");
  });

  it("'block' alone matches Masonry", () => {
    expect(
      inferCuttingMaterial({ material: "concrete block", materialType: null, description: null })
    ).toBe("Masonry");
  });
});
