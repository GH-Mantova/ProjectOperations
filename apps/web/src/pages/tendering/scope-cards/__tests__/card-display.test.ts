import { describe, expect, it } from "vitest";
import {
  DISCIPLINE_CODES,
  DISCIPLINE_COLORS,
  DISCIPLINE_LABELS,
  disciplineColor,
  formatCardCode,
  formatItemCode
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
