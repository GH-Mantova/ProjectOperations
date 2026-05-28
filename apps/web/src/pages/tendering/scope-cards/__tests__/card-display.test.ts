import { describe, expect, it } from "vitest";
import {
  DISCIPLINE_CODES,
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  disciplineColor,
  formatCardCode,
  formatItemCode,
  formatPlantSummary
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

  describe("formatPlantSummary", () => {
    it("formats valid entries as 'Name ×Qty' joined by ' · '", () => {
      const entries = [
        { name: "Excavator", peakQty: 2 },
        { name: "Bobcat", peakQty: 1 }
      ];
      expect(formatPlantSummary(entries)).toBe("Excavator ×2 · Bobcat ×1");
    });

    it("returns em dash when all entries have undefined fields", () => {
      const entries = [
        { name: undefined, peakQty: undefined }
      ] as Array<{ name?: string; peakQty?: number }>;
      expect(formatPlantSummary(entries)).toBe("—");
    });

    it("returns em dash for empty array", () => {
      expect(formatPlantSummary([])).toBe("—");
    });

    it("filters out entries with missing name", () => {
      const entries = [
        { name: "", peakQty: 2 },
        { name: "Bobcat", peakQty: 1 }
      ];
      expect(formatPlantSummary(entries)).toBe("Bobcat ×1");
    });

    it("filters out entries with zero qty", () => {
      const entries = [
        { name: "Excavator", peakQty: 0 },
        { name: "Bobcat", peakQty: 3 }
      ];
      expect(formatPlantSummary(entries)).toBe("Bobcat ×3");
    });

    it("returns em dash when all entries are filtered out", () => {
      const entries = [
        { name: "", peakQty: 0 },
        { name: undefined, peakQty: 1 } as { name?: string; peakQty?: number }
      ];
      expect(formatPlantSummary(entries)).toBe("—");
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
