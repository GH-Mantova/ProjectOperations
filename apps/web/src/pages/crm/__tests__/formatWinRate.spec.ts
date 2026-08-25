import { describe, expect, it } from "vitest";
import { formatWinRate } from "../formatWinRate";

describe("formatWinRate", () => {
  it("returns em dash for null", () => {
    expect(formatWinRate(null)).toBe("—");
  });

  it("returns em dash for undefined", () => {
    expect(formatWinRate(undefined)).toBe("—");
  });

  it("returns '0.0%' for 0", () => {
    expect(formatWinRate(0)).toBe("0.0%");
  });

  it("returns '23.5%' for 23.5 (number)", () => {
    expect(formatWinRate(23.5)).toBe("23.5%");
  });

  it("returns '23.5%' for '23.50' (string)", () => {
    expect(formatWinRate("23.50")).toBe("23.5%");
  });

  it("returns '100.0%' for 100", () => {
    expect(formatWinRate(100)).toBe("100.0%");
  });

  it("returns '100.0%+' for 150 (clamped display, value > 100)", () => {
    expect(formatWinRate(150)).toBe("100.0%+");
  });

  it("returns em dash for NaN", () => {
    expect(formatWinRate(NaN)).toBe("—");
  });

  it("returns em dash for non-numeric string 'abc'", () => {
    expect(formatWinRate("abc")).toBe("—");
  });
});
