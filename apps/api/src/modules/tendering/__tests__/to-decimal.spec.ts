// PR B4a.1 — defensive type narrowing for toDecimal. Covers the matrix
// of inputs that CodeQL flagged as a "type confusion through parameter
// tampering" sink: anything that isn't a finite number or finite-numeric
// string must return null instead of constructing a Prisma.Decimal.

import { Prisma } from "@prisma/client";
import { toDecimal } from "../scope-of-works.service";

describe("toDecimal (PR B4a.1)", () => {
  describe("null + undefined", () => {
    it("returns null for null", () => {
      expect(toDecimal(null)).toBeNull();
    });
    it("returns null for undefined", () => {
      expect(toDecimal(undefined)).toBeNull();
    });
  });

  describe("numbers", () => {
    it("returns Decimal(0) for 0 (preserves the zero override)", () => {
      const result = toDecimal(0);
      expect(result).toBeInstanceOf(Prisma.Decimal);
      expect(Number(result)).toBe(0);
    });
    it("returns Decimal for a finite positive number", () => {
      const result = toDecimal(1.5);
      expect(result).toBeInstanceOf(Prisma.Decimal);
      expect(Number(result)).toBe(1.5);
    });
    it("returns Decimal for a finite negative number", () => {
      const result = toDecimal(-3.14);
      expect(result).toBeInstanceOf(Prisma.Decimal);
      expect(Number(result)).toBe(-3.14);
    });
    it("returns null for NaN", () => {
      expect(toDecimal(Number.NaN)).toBeNull();
    });
    it("returns null for Infinity", () => {
      expect(toDecimal(Number.POSITIVE_INFINITY)).toBeNull();
      expect(toDecimal(Number.NEGATIVE_INFINITY)).toBeNull();
    });
  });

  describe("Prisma.Decimal passthrough", () => {
    it("returns the same Decimal instance untouched", () => {
      const input = new Prisma.Decimal("42.000");
      const result = toDecimal(input);
      expect(result).toBe(input);
    });
  });

  describe("strings", () => {
    it("parses a numeric string", () => {
      const result = toDecimal("1.5");
      expect(result).toBeInstanceOf(Prisma.Decimal);
      expect(Number(result)).toBe(1.5);
    });
    it("trims whitespace before parsing", () => {
      const result = toDecimal("  2.5  ");
      expect(Number(result)).toBe(2.5);
    });
    it("returns null for an empty string", () => {
      expect(toDecimal("")).toBeNull();
    });
    it("returns null for a whitespace-only string", () => {
      expect(toDecimal("   ")).toBeNull();
    });
    it("returns null for a non-numeric string", () => {
      expect(toDecimal("abc")).toBeNull();
    });
    it("returns null for a partially numeric string", () => {
      // Number("1.5x") is NaN — defensive rejection
      expect(toDecimal("1.5x")).toBeNull();
    });
  });

  describe("defence against type confusion (CodeQL)", () => {
    it("returns null for an array input", () => {
      // The exact CodeQL case: HTTP body delivered an array where the
      // route expected a number.
      expect(toDecimal([1, 2, 3] as unknown)).toBeNull();
    });
    it("returns null for an empty array", () => {
      expect(toDecimal([] as unknown)).toBeNull();
    });
    it("returns null for an object", () => {
      expect(toDecimal({} as unknown)).toBeNull();
      expect(toDecimal({ value: 5 } as unknown)).toBeNull();
    });
    it("returns null for a boolean", () => {
      expect(toDecimal(true as unknown)).toBeNull();
      expect(toDecimal(false as unknown)).toBeNull();
    });
  });
});
