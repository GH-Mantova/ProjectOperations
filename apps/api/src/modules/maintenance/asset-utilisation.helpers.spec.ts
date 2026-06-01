// Unit tests for the §7 asset utilisation helpers. Independent of Prisma /
// Nest so we can iterate on calendar math without bringing up the module.

import {
  computeUtilisationRate,
  hoursForShiftInRange,
  workingHoursBetween
} from "./asset-utilisation.helpers";

describe("workingHoursBetween", () => {
  it("returns 40 for a Mon-Sun span (5 weekdays × 8h)", () => {
    // 2026-05-04 is Monday, 2026-05-10 is Sunday.
    const from = new Date("2026-05-04T00:00:00.000Z");
    const to = new Date("2026-05-10T23:59:59.999Z");
    expect(workingHoursBetween(from, to)).toBe(40);
  });

  it("returns 0 for a Sat-Sun-only span", () => {
    const from = new Date("2026-05-09T00:00:00.000Z");
    const to = new Date("2026-05-10T23:59:59.999Z");
    expect(workingHoursBetween(from, to)).toBe(0);
  });

  it("returns 8 for a single weekday (same-day query)", () => {
    const from = new Date("2026-05-06T00:00:00.000Z");
    const to = new Date("2026-05-06T23:59:59.999Z");
    expect(workingHoursBetween(from, to)).toBe(8);
  });

  it("returns 0 when to is before from", () => {
    const from = new Date("2026-05-10T00:00:00.000Z");
    const to = new Date("2026-05-04T23:59:59.999Z");
    expect(workingHoursBetween(from, to)).toBe(0);
  });
});

describe("hoursForShiftInRange", () => {
  const rangeStart = new Date("2026-05-04T00:00:00.000Z");
  const rangeEnd = new Date("2026-05-10T23:59:59.999Z");

  it("counts the full shift when it sits inside the range", () => {
    const start = new Date("2026-05-05T08:00:00.000Z");
    const end = new Date("2026-05-05T16:00:00.000Z");
    expect(hoursForShiftInRange(start, end, rangeStart, rangeEnd)).toBe(8);
  });

  it("clamps the shift to the range when it overlaps the start", () => {
    const start = new Date("2026-05-03T20:00:00.000Z");
    const end = new Date("2026-05-04T04:00:00.000Z");
    expect(hoursForShiftInRange(start, end, rangeStart, rangeEnd)).toBe(4);
  });

  it("returns 0 for a shift entirely outside the range", () => {
    const start = new Date("2026-05-11T08:00:00.000Z");
    const end = new Date("2026-05-11T16:00:00.000Z");
    expect(hoursForShiftInRange(start, end, rangeStart, rangeEnd)).toBe(0);
  });
});

describe("computeUtilisationRate", () => {
  it("rounds to 3 decimal places", () => {
    expect(computeUtilisationRate(10, 40)).toBe(0.25);
    expect(computeUtilisationRate(1, 3)).toBe(0.333);
  });

  it("caps at 1.0 when allocated exceeds available", () => {
    expect(computeUtilisationRate(80, 40)).toBe(1);
  });

  it("returns 0 when available hours is zero", () => {
    expect(computeUtilisationRate(8, 0)).toBe(0);
  });

  it("returns 0 when allocated is zero", () => {
    expect(computeUtilisationRate(0, 40)).toBe(0);
  });
});
