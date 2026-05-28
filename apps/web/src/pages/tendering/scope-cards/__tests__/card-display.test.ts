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
    it("returns array of category lines for single category, single variant", () => {
      const groups = [
        { category: "Excavator", items: [{ variant: "01T-03T (dry hire)", peakQty: 2 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Excavators: 01T-03T (dry hire) ×2"]);
    });

    it("omits variant text when variant is null", () => {
      const groups = [
        { category: "Bobcat", items: [{ variant: null, peakQty: 1 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual(["Bobcats: ×1"]);
    });

    it("joins multiple variants with dot-separator within category", () => {
      const groups = [
        {
          category: "Excavator",
          items: [
            { variant: "01T-03T", peakQty: 2 },
            { variant: "16T-25T", peakQty: 1 }
          ]
        }
      ];
      expect(formatPlantSummary(groups)).toEqual([
        "Excavators: 01T-03T ×2 · 16T-25T ×1"
      ]);
    });

    it("returns multiple lines for multiple categories", () => {
      const groups = [
        { category: "Bobcat", items: [{ variant: null, peakQty: 1 }] },
        { category: "Excavator", items: [{ variant: "01T-03T", peakQty: 2 }] }
      ];
      expect(formatPlantSummary(groups)).toEqual([
        "Bobcats: ×1",
        "Excavators: 01T-03T ×2"
      ]);
    });

    it("returns em dash array for empty groups", () => {
      expect(formatPlantSummary([])).toEqual(["—"]);
    });

    it("returns em dash array when all entries have zero qty", () => {
      const groups = [
        { category: "Excavator", items: [{ variant: "01T-03T", peakQty: 0 }] }
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
