import { describe, expect, it } from "vitest";
import {
  DISCIPLINE_CODES,
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  disciplineColor,
  formatCardCode,
  formatItemCode,
  formatPlantSummary,
  pluraliseCategory
} from "../utils/card-display";

describe("card-display utilities (PR B1.5)", () => {
  describe("formatCardCode", () => {
    it("joins discipline and cardNumber with no separator", () => {
      expect(formatCardCode("DEM", 1)).toBe("DEM1");
      expect(formatCardCode("CIV", 12)).toBe("CIV12");
      expect(formatCardCode("Other", 3)).toBe("Other3");
    });
  });

  describe("formatItemCode", () => {
    it("forms a dotted code with cardNumber and itemNumber", () => {
      expect(formatItemCode("DEM", 1, 1)).toBe("DEM1.1");
      expect(formatItemCode("ASB", 2, 7)).toBe("ASB2.7");
    });
  });

  describe("disciplineColor", () => {
    it("returns the configured colour for known codes", () => {
      expect(disciplineColor("DEM")).toBe(DISCIPLINE_COLORS.DEM);
      expect(disciplineColor("CIV")).toBe(DISCIPLINE_COLORS.CIV);
      expect(disciplineColor("ASB")).toBe(DISCIPLINE_COLORS.ASB);
      expect(disciplineColor("Other")).toBe(DISCIPLINE_COLORS.Other);
    });

    it("falls back to a neutral grey for unknown codes", () => {
      expect(disciplineColor("XYZ")).toBe("#666");
      expect(disciplineColor("")).toBe("#666");
    });
  });

  describe("pluraliseCategory", () => {
    it("pluralises known categories", () => {
      expect(pluraliseCategory("Excavator")).toBe("Excavators");
      expect(pluraliseCategory("Truck")).toBe("Trucks");
      expect(pluraliseCategory("Crane")).toBe("Cranes");
      expect(pluraliseCategory("Bobcat")).toBe("Bobcats");
    });

    it("does not pluralise Other", () => {
      expect(pluraliseCategory("Other")).toBe("Other");
    });

    it("appends s to unknown categories not ending in s", () => {
      expect(pluraliseCategory("Roller")).toBe("Rollers");
    });

    it("does not double-s categories already ending in s", () => {
      expect(pluraliseCategory("Backhoes")).toBe("Backhoes");
    });
  });

  describe("formatPlantSummary", () => {
    it("renders one line per variant with singular category name", () => {
      const groups = [
        { category: "Excavator", items: [{ variant: "01T-03T (dry hire)", peakQty: 1, peakDays: 3 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Excavator 01T-03T (dry hire): 1 × 3d"]);
    });

    it("renders variant-null entry without the variant token", () => {
      const groups = [
        { category: "Truck", items: [{ variant: null, peakQty: 2, peakDays: 5 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Truck: 2 × 5d"]);
    });

    it("produces one line per variant when a category has multiple variants", () => {
      const groups = [
        {
          category: "Excavator",
          items: [
            { variant: "01T-03T (dry hire)", peakQty: 1, peakDays: 3 },
            { variant: "16T-25T (wet hire)", peakQty: 1, peakDays: 2 }
          ]
        }
      ];
      expect(formatPlantSummary(groups)).toEqual([
        "Excavator 01T-03T (dry hire): 1 × 3d",
        "Excavator 16T-25T (wet hire): 1 × 2d"
      ]);
    });

    it("preserves order and produces N lines across multiple categories", () => {
      const groups = [
        {
          category: "Excavator",
          items: [
            { variant: "01T-03T (dry hire)", peakQty: 1, peakDays: 3 },
            { variant: "16T-25T (wet hire)", peakQty: 1, peakDays: 3 }
          ]
        },
        { category: "Truck", items: [{ variant: null, peakQty: 2, peakDays: 5 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual([
        "Excavator 01T-03T (dry hire): 1 × 3d",
        "Excavator 16T-25T (wet hire): 1 × 3d",
        "Truck: 2 × 5d"
      ]);
    });

    it("falls back to ×qty format when peakDays is 0", () => {
      const groups = [
        { category: "Bobcat", items: [{ variant: null, peakQty: 1, peakDays: 0 }] },
        { category: "Excavator", items: [{ variant: "01T-03T", peakQty: 2, peakDays: 0 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual([
        "Bobcat: ×1",
        "Excavator 01T-03T: ×2"
      ]);
    });

    it("returns em dash array for empty groups", () => {
      expect(formatPlantSummary([])).toEqual(["—"]);
    });

    it("returns em dash array when all entries have zero qty", () => {
      const groups = [
        { category: "Excavator", items: [{ variant: "01T-03T", peakQty: 0, peakDays: 3 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["—"]);
    });
  });

  describe("DISCIPLINE_CODES + DISCIPLINE_LABELS", () => {
    it("exposes exactly 4 canonical codes", () => {
      expect([...DISCIPLINE_CODES]).toEqual(["DEM", "CIV", "ASB", "Other"]);
    });

    it("provides a label for every code", () => {
      for (const code of DISCIPLINE_CODES) {
        expect(DISCIPLINE_LABELS[code]).toBeDefined();
        expect(DISCIPLINE_LABELS[code].length).toBeGreaterThan(0);
      }
    });
  });

  describe("formatPlantSummary edge cases", () => {
    it("renders variant === null with no extra space or variant token", () => {
      const groups = [
        { category: "Crane", items: [{ variant: null, peakQty: 1, peakDays: 7 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Crane: 1 × 7d"]);
    });

    it("renders variant === '' the same as null (falsy branch, no trailing space)", () => {
      const groups = [
        { category: "Crane", items: [{ variant: "", peakQty: 1, peakDays: 7 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Crane: 1 × 7d"]);
    });

    it("renders null-variant and string-variant entries in input order within one category", () => {
      const groups = [
        {
          category: "Truck",
          items: [
            { variant: null, peakQty: 2, peakDays: 5 },
            { variant: "Tipper", peakQty: 1, peakDays: 4 }
          ]
        }
      ];
      expect(formatPlantSummary(groups)).toEqual([
        "Truck: 2 × 5d",
        "Truck Tipper: 1 × 4d"
      ]);
    });

    it("renders all lines across multiple categories with 3+ variants total, preserving category order", () => {
      const groups = [
        {
          category: "Excavator",
          items: [
            { variant: "01T-03T", peakQty: 1, peakDays: 3 },
            { variant: "16T-25T", peakQty: 2, peakDays: 4 }
          ]
        },
        {
          category: "Truck",
          items: [
            { variant: "Tipper", peakQty: 1, peakDays: 2 },
            { variant: "Flatbed", peakQty: 1, peakDays: 1 }
          ]
        }
      ];
      expect(formatPlantSummary(groups)).toEqual([
        "Excavator 01T-03T: 1 × 3d",
        "Excavator 16T-25T: 2 × 4d",
        "Truck Tipper: 1 × 2d",
        "Truck Flatbed: 1 × 1d"
      ]);
    });

    it("filters out a single peakQty=0 variant but keeps siblings in the same category", () => {
      const groups = [
        {
          category: "Excavator",
          items: [
            { variant: "01T-03T", peakQty: 0, peakDays: 3 },
            { variant: "16T-25T", peakQty: 2, peakDays: 4 }
          ]
        }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Excavator 16T-25T: 2 × 4d"]);
    });

    it("contributes no lines for a category whose variants all have peakQty=0", () => {
      const groups = [
        {
          category: "Bobcat",
          items: [
            { variant: "Small", peakQty: 0, peakDays: 2 },
            { variant: "Large", peakQty: 0, peakDays: 4 }
          ]
        },
        { category: "Truck", items: [{ variant: "Tipper", peakQty: 1, peakDays: 5 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Truck Tipper: 1 × 5d"]);
    });

    it("returns ['—'] when every category has zero-qty variants only", () => {
      const groups = [
        {
          category: "Excavator",
          items: [
            { variant: "01T-03T", peakQty: 0, peakDays: 3 },
            { variant: "16T-25T", peakQty: 0, peakDays: 4 }
          ]
        },
        { category: "Truck", items: [{ variant: null, peakQty: 0, peakDays: 5 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["—"]);
    });

    it("uses ×qty fallback when peakDays=0 and peakQty>0 with a variant present", () => {
      const groups = [
        { category: "Forklift", items: [{ variant: "2.5T", peakQty: 3, peakDays: 0 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Forklift 2.5T: ×3"]);
    });

    it("returns a single-string array for a single category with a single variant", () => {
      const groups = [
        { category: "Loader", items: [{ variant: "Wheel", peakQty: 1, peakDays: 1 }] }
      ];
      const result = formatPlantSummary(groups);
      expect(result).toHaveLength(1);
      expect(result).toEqual(["Loader Wheel: 1 × 1d"]);
    });
  });
});
