import { describe, expect, it } from "vitest";
import {
  buildChartData,
  defaultDateRange,
  formatHours,
  formatPercent,
  summariseUtilisation,
  type UtilisationRow
} from "../utilisation-report-helpers";

const row = (overrides: Partial<UtilisationRow>): UtilisationRow => ({
  assetId: overrides.assetId ?? "asset-1",
  assetName: overrides.assetName ?? "Excavator 12T",
  category: overrides.category ?? "Plant",
  hoursAllocated: overrides.hoursAllocated ?? 0,
  hoursAvailable: overrides.hoursAvailable ?? 0,
  utilisationRate: overrides.utilisationRate ?? 0,
  allocationCount: overrides.allocationCount ?? 0
});

describe("summariseUtilisation", () => {
  it("returns zeros for an empty list", () => {
    expect(summariseUtilisation([])).toEqual({
      assetCount: 0,
      totalHoursAllocated: 0,
      totalHoursAvailable: 0,
      fleetUtilisationRate: 0,
      topAsset: null
    });
  });

  it("aggregates hours and picks the highest-utilisation asset", () => {
    const rows = [
      row({ assetId: "a", hoursAllocated: 40, hoursAvailable: 80, utilisationRate: 0.5 }),
      row({ assetId: "b", hoursAllocated: 70, hoursAvailable: 80, utilisationRate: 0.875, assetName: "Tipper" }),
      row({ assetId: "c", hoursAllocated: 10, hoursAvailable: 80, utilisationRate: 0.125 })
    ];
    const summary = summariseUtilisation(rows);
    expect(summary.assetCount).toBe(3);
    expect(summary.totalHoursAllocated).toBe(120);
    expect(summary.totalHoursAvailable).toBe(240);
    expect(summary.fleetUtilisationRate).toBeCloseTo(0.5);
    expect(summary.topAsset?.assetId).toBe("b");
  });

  it("clamps fleet utilisation at 1.0 when allocated exceeds available", () => {
    const rows = [row({ hoursAllocated: 200, hoursAvailable: 100, utilisationRate: 1 })];
    expect(summariseUtilisation(rows).fleetUtilisationRate).toBe(1);
  });
});

describe("buildChartData", () => {
  it("limits to the top N rows preserving input order", () => {
    const rows = Array.from({ length: 15 }, (_, idx) =>
      row({ assetId: `a-${idx}`, assetName: `Asset ${idx}`, utilisationRate: 0.1 * idx })
    );
    const data = buildChartData(rows, 10);
    expect(data).toHaveLength(10);
    expect(data[0]).toEqual({ label: "Asset 0", value: 0 });
    expect(data[9]).toEqual({ label: "Asset 9", value: 90 });
  });
});

describe("formatters", () => {
  it("formats a rate as percent with one decimal", () => {
    expect(formatPercent(0.756)).toBe("75.6%");
  });

  it("formats hours with one decimal", () => {
    expect(formatHours(12)).toBe("12.0h");
  });
});

describe("defaultDateRange", () => {
  it("returns a 28-day window ending today as ISO dates", () => {
    const now = new Date("2026-06-19T10:00:00Z");
    const range = defaultDateRange(now);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ms = new Date(range.to).getTime() - new Date(range.from).getTime();
    expect(Math.round(ms / (24 * 60 * 60 * 1000))).toBe(27);
  });
});
