// SCOPE_DISCBAR_V1 — unit tests for computeCardBarStats.
//
// The web workspace has no @testing-library / jsdom set up (all existing
// tests follow the no-render pattern; see card-display.test.ts). This file
// tests the pure helper that drives the bar's three numeric columns.
// Visual layout is covered by the PR smoke / E2E suite.

import { describe, expect, it } from "vitest";
import { computeCardBarStats, type CardBarStats } from "../DisciplineSummaryBar";
import type { ScopeItem } from "../../ScopeQuantitiesTable";

// ── Minimal factory — fill only fields needed for computeCardBarStats ──
function makeItem(
  overrides: {
    status?: "draft" | "confirmed" | "excluded";
    lineTotal?: number | null;
    lineTotalWithMarkup?: number | null;
  } = {}
): ScopeItem {
  return {
    id: "test-id",
    tenderId: "t1",
    cardId: "c1",
    wbsCode: "DEM1.1",
    itemNumber: 1,
    description: "Test item",
    status: overrides.status ?? "confirmed",
    aiProposed: false,
    aiConfidence: null,
    sortOrder: 0,
    notes: null,
    men: null,
    days: null,
    unit: null,
    value: null,
    wasteGroup: null,
    wasteItem: null,
    wasteIncluded: false,
    length: null,
    height: null,
    depth: null,
    sqm: null,
    m3: null,
    density: null,
    tonnes: null,
    chargeBy: null,
    materialType: null,
    cuttingIncluded: false,
    plantItems: null,
    estimateItemId: null,
    provisionalAmount: null,
    lineTotal: overrides.lineTotal ?? null,
    lineTotalWithMarkup: overrides.lineTotalWithMarkup ?? null
  };
}

describe("computeCardBarStats", () => {
  it("returns zeros for an empty items array", () => {
    const stats: CardBarStats = computeCardBarStats([]);
    expect(stats.itemCount).toBe(0);
    expect(stats.subtotal).toBe(0);
    expect(stats.subtotalWithMarkup).toBe(0);
  });

  it("counts only non-excluded items", () => {
    const items = [
      makeItem({ status: "confirmed", lineTotal: 100, lineTotalWithMarkup: 115 }),
      makeItem({ status: "draft",     lineTotal: 200, lineTotalWithMarkup: 230 }),
      makeItem({ status: "excluded",  lineTotal: 999, lineTotalWithMarkup: 1150 })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.itemCount).toBe(2);
    expect(stats.subtotal).toBe(300);
    expect(stats.subtotalWithMarkup).toBe(345);
  });

  it("sums lineTotal and lineTotalWithMarkup across all non-excluded items", () => {
    const items = [
      makeItem({ lineTotal: 500,  lineTotalWithMarkup: 575 }),
      makeItem({ lineTotal: 1200, lineTotalWithMarkup: 1380 }),
      makeItem({ lineTotal: 300,  lineTotalWithMarkup: 345 })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.subtotal).toBe(2000);
    expect(stats.subtotalWithMarkup).toBe(2300);
  });

  it("treats null lineTotal / lineTotalWithMarkup as 0 (old API rows)", () => {
    const items = [
      makeItem({ lineTotal: null, lineTotalWithMarkup: null }),
      makeItem({ lineTotal: 400,  lineTotalWithMarkup: 460 })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.itemCount).toBe(2);
    expect(stats.subtotal).toBe(400);
    expect(stats.subtotalWithMarkup).toBe(460);
  });

  it("treats string-coerced totals correctly (API returns number | string)", () => {
    const items = [
      makeItem({ lineTotal: "750" as unknown as number, lineTotalWithMarkup: "862.5" as unknown as number })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.subtotal).toBeCloseTo(750);
    expect(stats.subtotalWithMarkup).toBeCloseTo(862.5);
  });

  it("matches ScopeQuantitiesTable footer formula exactly for a mixed card", () => {
    // This test is the byte-identical-totals check called out in the PR spec.
    // Card: 2 confirmed items (one with markup override applied server-side),
    //       1 excluded item (must NOT appear in either total).
    // lineTotal / lineTotalWithMarkup are the server-computed values — the bar
    // must NOT recompute them from rates; it sums exactly what the table sums.
    const items = [
      makeItem({ status: "confirmed",  lineTotal: 1000,  lineTotalWithMarkup: 1150 }), // 15% markup
      makeItem({ status: "confirmed",  lineTotal: 2500,  lineTotalWithMarkup: 2750 }), // 10% markup override
      makeItem({ status: "excluded",   lineTotal: 5000,  lineTotalWithMarkup: 5750 })  // excluded — not summed
    ];
    // ScopeQuantitiesTable footer formula:
    const visible = items.filter((i) => i.status !== "excluded");
    const expectedSubtotal = visible.reduce(
      (sum, i) => sum + (i.lineTotal != null ? Number(i.lineTotal) : 0),
      0
    );
    const expectedWithMarkup = visible.reduce(
      (sum, i) => sum + (i.lineTotalWithMarkup != null ? Number(i.lineTotalWithMarkup) : 0),
      0
    );

    const stats = computeCardBarStats(items);
    expect(stats.subtotal).toBe(expectedSubtotal);        // bar === footer "Subtotal"
    expect(stats.subtotalWithMarkup).toBe(expectedWithMarkup); // bar === footer "with markup"
    // Concrete values for the PR body evidence:
    expect(stats.subtotal).toBe(3500);
    expect(stats.subtotalWithMarkup).toBe(3900);
  });

  it("handles a card with all items excluded (all-excluded card is zero)", () => {
    const items = [
      makeItem({ status: "excluded", lineTotal: 1000, lineTotalWithMarkup: 1150 }),
      makeItem({ status: "excluded", lineTotal: 500,  lineTotalWithMarkup: 575 })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.itemCount).toBe(0);
    expect(stats.subtotal).toBe(0);
    expect(stats.subtotalWithMarkup).toBe(0);
  });

  it("itemCount reflects visible (non-excluded) rows only", () => {
    const items = [
      makeItem({ status: "confirmed" }),
      makeItem({ status: "confirmed" }),
      makeItem({ status: "confirmed" }),
      makeItem({ status: "excluded" }),
      makeItem({ status: "excluded" })
    ];
    expect(computeCardBarStats(items).itemCount).toBe(3);
  });
});
