// WASTE_PANEL_LAYOUT_V1 (scopecards-s8j) -- Tests for the per-trip tonnes
// logic in TipFinderDrawer.
//
// House pattern (no jsdom / no @testing-library): pure helper assertions
// against computePerTripTonnes and source text assertions.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  computePerTripTonnes,
  type WasteRowContext
} from "../../../components/TipFinderDrawer";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../${relFromRepoRoot}`, import.meta.url));

const drawerSource = readFileSync(
  repoFile("apps/web/src/components/TipFinderDrawer.tsx"),
  "utf-8"
);

const panelSource = readFileSync(
  repoFile("apps/web/src/pages/admin/TipFinderPanel.tsx"),
  "utf-8"
);

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: per-trip tonnes -- wasteLoads override respected (FAILS on origin/main)
// Before S8j: loadTonnes was the whole quantity (100 t), not per-trip (25 t).
// ─────────────────────────────────────────────────────────────────────────────

describe("per-trip loadTonnes with wasteLoads override (test 7 -- fails on origin/main)", () => {
  it("100 t row with wasteLoads=4 sends loadTonnes 25, not 100 or 26", () => {
    const ctx: WasteRowContext = {
      qty: "100",
      wasteLoads: 4,
      capacityPerLoad: "26",
      capacityUnit: "t"
    };
    const result = computePerTripTonnes(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 100 t / 4 trips = 25 t, not 100 (whole qty) and not 26 (capacityPerLoad)
    expect(result.perTripTonnes).toBe(25);
    expect(result.requiredTrips).toBe(4);
    expect(result.totalTonnes).toBe(100);
  });

  it("100 t row with wasteLoads=5 sends loadTonnes 20 (override respected)", () => {
    const ctx: WasteRowContext = {
      qty: "100",
      wasteLoads: 5,
      capacityPerLoad: "26",
      capacityUnit: "t"
    };
    const result = computePerTripTonnes(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Override: 5 trips, so 100 / 5 = 20 t per trip
    expect(result.perTripTonnes).toBe(20);
    expect(result.requiredTrips).toBe(5);
  });

  it("never falls back to the whole quantity -- that is the defect being removed", () => {
    // With wasteLoads=4, perTripTonnes must never equal qty.
    const ctx: WasteRowContext = {
      qty: "100",
      wasteLoads: 4,
      capacityPerLoad: "26",
      capacityUnit: "t"
    };
    const result = computePerTripTonnes(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.perTripTonnes).not.toBe(100); // not the whole quantity
    expect(result.perTripTonnes).not.toBe(26);  // not the capacity per load
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: close-rate case -- Kedron vs Wacol (FAILS on origin/main)
// Before S8j: ranked on 100 t -> Wacol cheaper; after: ranked on 25 t -> Kedron cheaper.
// ─────────────────────────────────────────────────────────────────────────────

describe("close-rate ranking test (test 8 -- fails on origin/main)", () => {
  // Kedron: 12 km at $61.95/t; Wacol: 22 km at $60.00/t; travelRatePerKm: $2.50.
  // Formula: totalCost = loadTonnes * rate + distKm * 2 * travelRate
  function totalCost(loadTonnes: number, rate: number, distKm: number, travelRate: number) {
    return loadTonnes * rate + distKm * 2 * travelRate;
  }

  const kedronRate = 61.95;
  const kedronDist = 12;
  const wacolRate = 60.00;
  const wacolDist = 22;
  const travelRate = 2.50;

  it("at 25 t per trip, Kedron ranks first (cheaper total)", () => {
    const kedron = totalCost(25, kedronRate, kedronDist, travelRate);
    const wacol = totalCost(25, wacolRate, wacolDist, travelRate);
    // Kedron: 25 * 61.95 + 12 * 2 * 2.50 = 1548.75 + 60 = 1608.75
    // Wacol: 25 * 60.00 + 22 * 2 * 2.50 = 1500.00 + 110 = 1610.00
    expect(kedron).toBe(1608.75);
    expect(wacol).toBe(1610.00);
    expect(kedron).toBeLessThan(wacol); // Kedron is cheaper
  });

  it("at 26 t per trip, Wacol ranks first (cheaper total)", () => {
    const kedron = totalCost(26, kedronRate, kedronDist, travelRate);
    const wacol = totalCost(26, wacolRate, wacolDist, travelRate);
    // Kedron: 26 * 61.95 + 60 = 1670.70
    // Wacol: 26 * 60.00 + 110 = 1670.00
    expect(kedron).toBeCloseTo(1670.70, 1);
    expect(wacol).toBeCloseTo(1670.00, 1);
    expect(wacol).toBeLessThan(kedron); // Wacol is cheaper
  });

  it("100 t at 26 t cap = 4 trips of 25 t (per-trip logic gives Kedron)", () => {
    // This is the scenario where the old code (whole-qty) was wrong.
    // Old: loadTonnes=100 -> 100 * 61.95 + 60 = 6255 (Kedron) vs 100 * 60 + 110 = 6110 (Wacol) -> Wacol wrong winner
    // New: loadTonnes=25 -> Kedron is cheaper
    const ctx: WasteRowContext = {
      qty: "100",
      wasteLoads: 4, // explicit override confirming 4 trips
      capacityPerLoad: "26",
      capacityUnit: "t"
    };
    const result = computePerTripTonnes(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.perTripTonnes).toBe(25);
    // At 25 t Kedron ranks first.
    const kedron = totalCost(25, kedronRate, kedronDist, travelRate);
    const wacol = totalCost(25, wacolRate, wacolDist, travelRate);
    expect(kedron).toBeLessThan(wacol);
  });

  it("without a wasteLoads override, derives trips via ceil(qty / cap)", () => {
    const ctx: WasteRowContext = {
      qty: "100",
      wasteLoads: null, // no override
      capacityPerLoad: "26",
      capacityUnit: "t"
    };
    const result = computePerTripTonnes(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ceil(100 / 26) = 4 trips; 100 / 4 = 25 t
    expect(result.requiredTrips).toBe(4);
    expect(result.perTripTonnes).toBe(25);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: blocking cases -- ask, not guess
// ─────────────────────────────────────────────────────────────────────────────

describe("blocking cases: ask rather than fall back (test 9)", () => {
  it("missing capacity with no override returns ok: false, reason: no-capacity", () => {
    const ctx: WasteRowContext = {
      qty: "100",
      wasteLoads: null, // no override
      capacityPerLoad: null, // no capacity
      capacityUnit: "t"
    };
    const result = computePerTripTonnes(ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no-capacity");
  });

  it("missing tonnes returns ok: false, reason: no-tonnes", () => {
    const ctx: WasteRowContext = {
      qty: null,
      wasteLoads: null,
      capacityPerLoad: "26",
      capacityUnit: "t"
    };
    const result = computePerTripTonnes(ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no-tonnes");
  });

  it("m3 capacity with no override returns ok: false, reason: m3-capacity", () => {
    const ctx: WasteRowContext = {
      qty: "100",
      wasteLoads: null,
      capacityPerLoad: "14",
      capacityUnit: "m3"
    };
    const result = computePerTripTonnes(ctx);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Must not divide tonnes by m3 capacity
    expect(result.reason).toBe("m3-capacity");
  });

  it("m3 capacity WITH wasteLoads override is ok (override bypasses unit check)", () => {
    const ctx: WasteRowContext = {
      qty: "100",
      wasteLoads: 5, // override present -> no need to derive from cap
      capacityPerLoad: "14",
      capacityUnit: "m3"
    };
    const result = computePerTripTonnes(ctx);
    // Override is present, so m3 check is bypassed
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.requiredTrips).toBe(5);
    expect(result.perTripTonnes).toBe(20);
  });

  it("blocking messages are shown in the drawer, not silent", () => {
    // The drawer renders a blocking message when computePerTripTonnes returns ok: false.
    expect(drawerSource).toContain("blockingMsg");
    expect(drawerSource).toContain('data-testid="tip-finder-blocking-msg"');
  });

  it("no request is issued when blockingMsg is present (panel not rendered)", () => {
    // When blockingMsg is set, the TipFinderPanel is NOT rendered.
    // Source assertion: the panel is conditionally rendered.
    expect(drawerSource).toContain("blockingMsg ? (");
    expect(drawerSource).toContain("<TipFinderPanel");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: no "Coming from" control when opened from a waste row (FAILS on origin/main)
// Before S8j: the panel showed a "Coming from" field even from a waste row.
// ─────────────────────────────────────────────────────────────────────────────

describe("no Coming from control from waste row (test 10 -- fails on origin/main)", () => {
  it("drawer passes fromWasteRow=true and hideComingFrom to TipFinderPanel", () => {
    // The drawer in waste-row mode passes hideComingFrom to TipFinderPanel.
    expect(drawerSource).toContain("hideComingFrom={fromWasteRow}");
  });

  it("TipFinderPanel hides the Coming from label when hideComingFrom is true", () => {
    // The panel has !hideComingFrom guard around the Coming from field.
    expect(panelSource).toContain("!hideComingFrom");
    expect(panelSource).toContain("Coming from");
  });

  it("tender address is shown as text in the drawer (data-testid present)", () => {
    expect(panelSource).toContain('data-testid="tip-finder-tender-address"');
    expect(panelSource).toContain("From the tender site:");
  });

  it("the request still carries originType tender when fromWasteRow is true", () => {
    // originType is derived from tenderId -- if tenderId is present, originType="tender".
    expect(drawerSource).toContain('originType = tenderId ? "tender" : "office"');
    // initialOriginType is passed to TipFinderPanel.
    expect(drawerSource).toContain("initialOriginType={originType}");
  });

  it("tenderAddress prop is wired through to TipFinderPanel", () => {
    expect(drawerSource).toContain("tenderAddress={tenderAddress}");
  });
});
