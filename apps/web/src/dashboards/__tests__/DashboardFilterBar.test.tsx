/**
 * DashboardFilterBar.test.tsx — unit tests for the EA-2b filter bar helpers.
 *
 * Tests pure-logic exports from DashboardFilterBar:
 *  - deriveReachability (filter-reachability chip logic)
 *  - hasWidgetOverride (override badge detection)
 *
 * No React rendering — the logic is factored into pure functions so it can
 * be tested without jsdom. The component itself is covered by the e2e suite.
 */

import { describe, expect, it } from "vitest";
import { deriveReachability, hasWidgetOverride, type FilterReachability } from "../DashboardFilterBar";

// ── deriveReachability ────────────────────────────────────────────────────────

describe("deriveReachability", () => {
  /** Params that include from, to, clientId, estimatorId */
  const fullParams = [
    { name: "from", type: "date" },
    { name: "to", type: "date" },
    { name: "clientId", type: "string" },
    { name: "estimatorId", type: "string" }
  ];

  /** Params for tender-win-rate: only from / to */
  const tenderWinRateParams = [
    { name: "from", type: "date" },
    { name: "to", type: "date" }
  ];

  /** Params for estimator-turnaround: from, to, estimatorId */
  const estimatorTurnaroundParams = [
    { name: "from", type: "date" },
    { name: "to", type: "date" },
    { name: "estimatorId", type: "string" }
  ];

  /** Params for asset-utilisation-snapshot: none */
  const noParams: Array<{ name: string; type: string }> = [];

  it("all 'applied' when bar has all values and definition accepts all", () => {
    const barFilters = { from: "2026-01-01", to: "2026-09-15", clientId: "c1", estimatorId: "e1" };
    const reach = deriveReachability(fullParams, barFilters);
    expect(reach.from).toBe("applied");
    expect(reach.to).toBe("applied");
    expect(reach.clientId).toBe("applied");
    expect(reach.estimatorId).toBe("applied");
  });

  it("all 'available' when bar is empty but definition accepts all params", () => {
    const reach = deriveReachability(fullParams, {});
    expect(reach.from).toBe("available");
    expect(reach.to).toBe("available");
    expect(reach.clientId).toBe("available");
    expect(reach.estimatorId).toBe("available");
  });

  it("tender-win-rate: clientId and estimatorId are 'not-a-parameter'", () => {
    // tender-win-rate only accepts from / to.
    const barFilters = { from: "2026-01-01", to: "2026-09-15", clientId: "c1", estimatorId: "e1" };
    const reach = deriveReachability(tenderWinRateParams, barFilters);
    expect(reach.from).toBe("applied");
    expect(reach.to).toBe("applied");
    expect(reach.clientId).toBe("not-a-parameter");
    expect(reach.estimatorId).toBe("not-a-parameter");
  });

  it("estimator-turnaround: estimatorId is 'applied', clientId is 'not-a-parameter'", () => {
    // estimator-turnaround accepts from, to, estimatorId — not clientId.
    const barFilters = { from: "2026-01-01", to: "2026-09-15", clientId: "c1", estimatorId: "e5" };
    const reach = deriveReachability(estimatorTurnaroundParams, barFilters);
    expect(reach.from).toBe("applied");
    expect(reach.to).toBe("applied");
    expect(reach.estimatorId).toBe("applied");
    expect(reach.clientId).toBe("not-a-parameter");
  });

  it("reachability for tender-win-rate vs estimator-turnaround differ on estimatorId", () => {
    const barFilters = { estimatorId: "e5" };
    const twr = deriveReachability(tenderWinRateParams, barFilters);
    const et = deriveReachability(estimatorTurnaroundParams, barFilters);
    // tender-win-rate does not accept estimatorId
    expect(twr.estimatorId).toBe("not-a-parameter");
    // estimator-turnaround does accept it (and it has a value)
    expect(et.estimatorId).toBe("applied");
  });

  it("asset-utilisation-snapshot (no params): all 'not-a-parameter'", () => {
    const barFilters = { from: "2026-01-01", to: "2026-09-15", clientId: "c1", estimatorId: "e1" };
    const reach = deriveReachability(noParams, barFilters);
    expect(reach.from).toBe("not-a-parameter");
    expect(reach.to).toBe("not-a-parameter");
    expect(reach.clientId).toBe("not-a-parameter");
    expect(reach.estimatorId).toBe("not-a-parameter");
  });

  it("empty bar with estimation-turnaround: from/to/estimatorId are 'available', clientId 'not-a-parameter'", () => {
    const reach = deriveReachability(estimatorTurnaroundParams, {});
    expect(reach.from).toBe("available");
    expect(reach.to).toBe("available");
    expect(reach.estimatorId).toBe("available");
    expect(reach.clientId).toBe("not-a-parameter");
  });

  it("returns the correct ReachabilityChip union type for all four fields", () => {
    const reach: FilterReachability = deriveReachability(tenderWinRateParams, { from: "2026-01-01" });
    const validChips = new Set(["applied", "available", "not-a-parameter"]);
    expect(validChips.has(reach.from)).toBe(true);
    expect(validChips.has(reach.to)).toBe(true);
    expect(validChips.has(reach.clientId)).toBe(true);
    expect(validChips.has(reach.estimatorId)).toBe(true);
  });
});

// ── hasWidgetOverride ─────────────────────────────────────────────────────────

describe("hasWidgetOverride", () => {
  it("returns false when widgetFilters is undefined", () => {
    expect(hasWidgetOverride(undefined, { clientId: "c1" })).toBe(false);
  });

  it("returns false when widgetFilters is empty", () => {
    expect(hasWidgetOverride({}, { clientId: "c1" })).toBe(false);
  });

  it("returns false when widget and bar values match", () => {
    expect(hasWidgetOverride({ clientId: "c1" }, { clientId: "c1" })).toBe(false);
  });

  it("returns true when widget value differs from bar value on any key", () => {
    expect(hasWidgetOverride({ clientId: "c2" }, { clientId: "c1" })).toBe(true);
  });

  it("returns true when widget has explicit empty string that clears bar value (plan §5 rule 2)", () => {
    // Explicit empty string in widgetFilters is an override — it clears the
    // dashboard-level filter so the widget runs unfiltered.
    expect(hasWidgetOverride({ clientId: "" }, { clientId: "c1" })).toBe(true);
  });

  it("returns true when widget has a key the bar does not (undefined !== value)", () => {
    expect(hasWidgetOverride({ projectId: "p1" }, { clientId: "c1" })).toBe(true);
  });

  it("returns false when widgetFilters contains keys that match all bar values", () => {
    const barFilters = { from: "2026-01-01", to: "2026-09-15", clientId: "c1" };
    const widgetFilters = { from: "2026-01-01", to: "2026-09-15", clientId: "c1" };
    expect(hasWidgetOverride(widgetFilters, barFilters)).toBe(false);
  });
});
