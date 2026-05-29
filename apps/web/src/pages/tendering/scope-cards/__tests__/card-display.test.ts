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
});
