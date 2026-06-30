import { describe, expect, it } from "vitest";
import { daysFromPx, shiftDatesByDays } from "../ganttDragMath";

describe("daysFromPx", () => {
  it("rounds to nearest day at week zoom (36 px/day)", () => {
    expect(daysFromPx(0, 36)).toBe(0);
    expect(daysFromPx(17, 36)).toBe(0);
    expect(daysFromPx(18, 36)).toBe(1);
    expect(daysFromPx(36, 36)).toBe(1);
    expect(daysFromPx(72, 36)).toBe(2);
    expect(daysFromPx(-72, 36)).toBe(-2);
  });

  it("rounds at month zoom (14 px/day)", () => {
    expect(daysFromPx(14, 14)).toBe(1);
    expect(daysFromPx(42, 14)).toBe(3);
    expect(daysFromPx(-28, 14)).toBe(-2);
  });

  it("returns 0 for a non-positive pxPerDay", () => {
    expect(daysFromPx(100, 0)).toBe(0);
    expect(daysFromPx(100, -5)).toBe(0);
  });
});

describe("shiftDatesByDays", () => {
  it("shifts both ends by the given days, preserving duration", () => {
    const start = "2026-06-01T00:00:00.000Z";
    const end = "2026-06-05T00:00:00.000Z";
    const result = shiftDatesByDays(start, end, 3);
    expect(result.startDate).toBe("2026-06-04T00:00:00.000Z");
    expect(result.endDate).toBe("2026-06-08T00:00:00.000Z");
  });

  it("supports negative shifts", () => {
    const start = "2026-06-10T00:00:00.000Z";
    const end = "2026-06-15T00:00:00.000Z";
    const result = shiftDatesByDays(start, end, -2);
    expect(result.startDate).toBe("2026-06-08T00:00:00.000Z");
    expect(result.endDate).toBe("2026-06-13T00:00:00.000Z");
  });

  it("is a no-op when days is 0", () => {
    const start = "2026-06-01T00:00:00.000Z";
    const end = "2026-06-05T00:00:00.000Z";
    const result = shiftDatesByDays(start, end, 0);
    expect(result.startDate).toBe(start);
    expect(result.endDate).toBe(end);
  });
});
