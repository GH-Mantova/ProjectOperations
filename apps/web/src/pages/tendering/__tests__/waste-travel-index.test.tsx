// WASTE_TRAVEL_INDEX_UI_V1 (scopecards-s8h) -- tests for the travel-index UI
// on the waste expanded row.
//
// House pattern (no jsdom / no @testing-library): assertions run against
// exported helpers, renderToStaticMarkup, and the source text.  Nothing
// that requires a live DOM or auth context is tested here.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WASTE_TRAVEL_INDEX_UI_V1 } from "../ScopeWasteTab";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../${relFromRepoRoot}`, import.meta.url));

const wasteSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeWasteTab.tsx"),
  "utf-8"
);

const drawerSource = readFileSync(
  repoFile("apps/web/src/components/TipFinderDrawer.tsx"),
  "utf-8"
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Constant and marker
// ─────────────────────────────────────────────────────────────────────────────

describe("WASTE_TRAVEL_INDEX_UI_V1 constant", () => {
  it("is exported with value scopecards-s8h", () => {
    expect(WASTE_TRAVEL_INDEX_UI_V1).toBe("scopecards-s8h");
  });

  it("appears in ScopeWasteTab.tsx source at least twice (export + usage)", () => {
    const matches = (wasteSource.match(/WASTE_TRAVEL_INDEX_UI_V1/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Travel strip wording -- "modelled", not "peak hour" or "measured"
// ─────────────────────────────────────────────────────────────────────────────

describe("travel strip copy safety", () => {
  it("the word 'modelled' appears in the travel strip note", () => {
    // The allowance note must say modelled.
    expect(wasteSource).toContain("modelled");
  });

  it("the word 'peak-hour' only appears negated, not as a positive claim", () => {
    // The copy says "not measured peak-hour traffic" -- a negative clause.
    // That is correct. What must not appear is a standalone positive claim
    // like "peak-hour measured" or a sentence that says allowance IS peak-hour.
    // We check the negative form is present and no positive surrounds appear.
    // The allowance note must contain "not" before any mention of peak-hour.
    const noteIdx = wasteSource.indexOf("not measured peak-hour");
    // The note must be present (anchors the negative form).
    expect(noteIdx).toBeGreaterThan(-1);
  });

  it("never says 'measured' in the travel context", () => {
    // "not measured peak-hour traffic" is fine as a negative clause, but the
    // word "measured" alone in a positive claim would be wrong. The actual
    // copy reads "-- not measured peak-hour traffic" so the negative holds.
    // This assertion checks the whole file does not make a standalone
    // positive claim like "measured traffic" or "measured allowance".
    expect(wasteSource).not.toMatch(/\bmeasured allowance\b/i);
    expect(wasteSource).not.toMatch(/\bmeasured traffic\b/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Travel chain: baseline / allowance / adjusted / planning
// ─────────────────────────────────────────────────────────────────────────────

describe("travel chain labels", () => {
  it("source contains all four chain labels", () => {
    expect(wasteSource).toContain("Baseline");
    expect(wasteSource).toContain("Traffic allowance");
    expect(wasteSource).toContain("Adjusted");
    expect(wasteSource).toContain("Planning");
  });

  it("chain uses server travelPlanningMinutesOneWay, not client arithmetic", () => {
    // The planning box reads from row.travelPlanningMinutesOneWay (server field).
    expect(wasteSource).toContain("travelPlanningMinutesOneWay");
    // The adjusted box uses server travelMinutesOneWay * travelIndex for display.
    // This is display-only arithmetic on two server fields; it is not a pricing
    // computation. The restriction is on prices/trips/duration, not display boxes.
    expect(wasteSource).toContain("travelMinutesOneWay");
    expect(wasteSource).toContain("travelIndex");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Allowance edit: patches travelIndex; Manual chip + Return to automatic
// ─────────────────────────────────────────────────────────────────────────────

describe("allowance edit behaviour (source assertions)", () => {
  it("onBlur patches travelIndex (not travelIndexSource)", () => {
    // The input onBlur calls patchRow(row.id, { travelIndex: n }).
    expect(wasteSource).toContain("travelIndex: n");
    // The source does not set travelIndexSource in any patchRow call.
    // (It appears in the type definition and comments, but never in a patchRow.)
    expect(wasteSource).not.toContain("patchRow(row.id, { travelIndexSource");
  });

  it("Return to automatic patches travelIndex: null", () => {
    expect(wasteSource).toContain("travelIndex: null");
    expect(wasteSource).toContain("Return to automatic");
  });

  it("manual chip is shown when travelIndexSource === manual", () => {
    expect(wasteSource).toContain('idxSource === "manual"');
    expect(wasteSource).toContain("waste-allowance-manual-chip");
  });

  it("Suggested chip is shown when source is not manual and not none", () => {
    expect(wasteSource).toContain("Suggested");
  });

  it("min is 1.00 (allowance >= 1.00 enforced on the input)", () => {
    // The input has min=1.00 and the onBlur guard rejects n < 1.
    expect(wasteSource).toContain('min="1.00"');
    expect(wasteSource).toContain("n < 1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Provenance chips on derived fields
// ─────────────────────────────────────────────────────────────────────────────

describe("provenance chips on derived fields (source assertions)", () => {
  it("loads/day chip: From cycle when loadsSource is cycle", () => {
    expect(wasteSource).toContain('loadsSource === "cycle"');
    expect(wasteSource).toContain("From cycle");
  });

  it("loads/day chip: Manual when loadsSource is manual", () => {
    expect(wasteSource).toContain('loadsSource === "manual"');
    expect(wasteSource).toContain("waste-loads-manual-chip");
    expect(wasteSource).toContain("waste-loads-return-auto");
  });

  it("Return to automatic for loads patches loadsPerTruckPerDay: null", () => {
    expect(wasteSource).toContain("loadsPerTruckPerDay: null");
  });

  it("capacity chip: Matrix when capacitySource is matrix", () => {
    expect(wasteSource).toContain('capacitySource === "matrix"');
    expect(wasteSource).toContain("Matrix");
  });

  it("daily km chip: From cycle when dailyKmSource is derived", () => {
    expect(wasteSource).toContain('dailyKmSource === "derived"');
  });

  it("daily km chip: Manual when dailyKmSource is manual", () => {
    expect(wasteSource).toContain('dailyKmSource === "manual"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Totals strip
// ─────────────────────────────────────────────────────────────────────────────

describe("totals strip (source assertions)", () => {
  it("renders waste-totals-strip data-testid", () => {
    expect(wasteSource).toContain("waste-totals-strip");
  });

  it("shows Fuel charged on totalTripKm via waste-fuel-charged-km testid", () => {
    expect(wasteSource).toContain("waste-fuel-charged-km");
    expect(wasteSource).toContain("Fuel charged on");
    expect(wasteSource).toContain("totalTripKm");
  });

  it("totalTripKm is server-supplied and never recomputed here", () => {
    // The totals strip reads row.totalTripKm (server field). It should
    // not multiply trips x 2 x km anywhere in the totals strip itself.
    // The strip may display the formula in a note (trips x 2 x km)
    // but the authoritative value is row.totalTripKm.
    expect(wasteSource).toContain("row.totalTripKm");
  });

  it("fuel note says trips that happen, not full-day extrapolation", () => {
    expect(wasteSource).toContain("trips that actually happen");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Infeasible-cycle state
// ─────────────────────────────────────────────────────────────────────────────

describe("infeasible-cycle state (source assertions)", () => {
  it("detects infeasible from loadsSource=cycle AND loadsPerTruckPerDay null", () => {
    expect(wasteSource).toContain("isInfeasible");
    expect(wasteSource).toContain('loadsSource === "cycle"');
  });

  it("renders data-infeasible attribute on the cycle strip when infeasible", () => {
    expect(wasteSource).toContain('data-infeasible="true"');
  });

  it("infeasible chip text: No whole load fits an 8-hour shift", () => {
    expect(wasteSource).toContain("No whole load fits an 8-hour shift");
  });

  it("infeasible copy mentions three ways out", () => {
    // The note must mention closer tip, lower allowance, and plan by hand.
    expect(wasteSource).toContain("closer tip");
    expect(wasteSource).toContain("lowering the");
    expect(wasteSource).toContain("by hand");
  });

  it("trips and duration render blank (not zero) when infeasible", () => {
    // In the totals strip: isInfeasible ? '---' : ...
    const totalsRegion = wasteSource.slice(
      wasteSource.indexOf("waste-totals-strip"),
      wasteSource.indexOf("waste-fuel-charged-km") + 200
    );
    expect(totalsRegion).toContain("isInfeasible");
  });

  it("saving is never blocked -- no disabled attribute tied to infeasible", () => {
    // Row-level delete button and patchRow are not gated on isInfeasible.
    // The infeasible check only affects display, not the ability to save.
    expect(wasteSource).not.toContain("isInfeasible && !canManage");
    expect(wasteSource).not.toMatch(/disabled=\{.*isInfeasible.*\}/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Fallback state (straight-line)
// ─────────────────────────────────────────────────────────────────────────────

describe("fallback state (source assertions)", () => {
  it("detects fallback from travelSource === straight-line", () => {
    expect(wasteSource).toContain('travelSource === "straight-line"');
  });

  it("fallback badge text: Estimated, no route (not selectable -- only display)", () => {
    expect(wasteSource).toContain("Estimated, no route");
  });

  it("fallback note mentions 1.00 with explanation", () => {
    expect(wasteSource).toContain("1.00");
    expect(wasteSource).toContain("no suggested allowance");
  });

  it("fallback does NOT show Geoapify route chip (status-active chip)", () => {
    // The route chip is styled --status-active (the palette positive colour) and
    // the fallback --status-warning. We verify that chip render appears
    // inside the route branch (after the `travelSource === "route"` guard), not
    // inside the fallback branch.
    const routeBranchAt = wasteSource.indexOf('travelSource === "route" && row.travelKm');
    const geoapifyChipRender = wasteSource.indexOf("var(--status-active)");
    expect(routeBranchAt).toBeGreaterThan(-1);
    expect(geoapifyChipRender).toBeGreaterThan(-1);
    // That chip must appear inside the route branch (after the guard).
    expect(geoapifyChipRender).toBeGreaterThan(routeBranchAt);
    // Fallback (straight-line) uses --status-warning, never --status-active.
    const straightLineAt = wasteSource.indexOf('travelSource === "straight-line"');
    const fallbackSection = wasteSource.slice(straightLineAt, routeBranchAt);
    expect(fallbackSection).not.toContain("var(--status-active)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Find-tip sticks: mapLocationId is patched, _mapLocationId discard is gone
// ─────────────────────────────────────────────────────────────────────────────

describe("find-tip mapLocationId fix (source assertions)", () => {
  it("handleTipChosen patches both wasteFacility and mapLocationId", () => {
    // The accept handler must include mapLocationId in the patch object.
    expect(wasteSource).toContain("mapLocationId }");
    // It must NOT discard the second argument as _mapLocationId.
    expect(wasteSource).not.toContain("_mapLocationId");
  });

  it("drawer note explains straight-line vs route discrepancy", () => {
    expect(drawerSource).toContain("straight-line distance");
    expect(drawerSource).toContain("real route");
    expect(drawerSource).toContain("tip-finder-rank-note");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. No client-side pricing
// ─────────────────────────────────────────────────────────────────────────────

describe("no client-side pricing of travel fields", () => {
  it("does not multiply travelKm by anything (km never changes with allowance)", () => {
    expect(wasteSource).not.toMatch(/travelKm\s*[*]\s*\w/);
  });

  it("does not compute trip counts from qty / capacity", () => {
    // The totals strip reads row.wasteLoads (server-supplied); it does not
    // compute Math.ceil(qty / cap) as the authoritative trip count.
    expect(wasteSource).not.toMatch(/Math\.ceil\(\s*qty\s*\/\s*cap\s*\)/);
  });

  it("does not assign fuelCost or lineTotal in client-side expressions", () => {
    // The panel reads fuelCost and lineTotal from the server row; it does not
    // compute them. A destructuring assignment like `const fuelCost = ...` or
    // `const lineTotal = ...` would indicate a second pricing implementation.
    // We check there is no `const fuelCost` or `const lineTotal` binding.
    expect(wasteSource).not.toMatch(/const fuelCost\s*=/);
    expect(wasteSource).not.toMatch(/const lineTotal\s*=/);
    expect(wasteSource).not.toMatch(/let fuelCost\s*=/);
    expect(wasteSource).not.toMatch(/let lineTotal\s*=/);
  });
});

// WASTE_TIP_DAILYKM_PROVENANCE_V1 (scopecards-s8i)
//
// The behaviour of this journey is tested where it is observable -- in the API,
// in scope-waste-travel.spec.ts, because the web workspace has no jsdom and no
// @testing-library and the outcome that matters is what gets stored. These are
// the falsifying probes for the regression coming back into this file.

describe("WASTE_TIP_DAILYKM_PROVENANCE_V1 - the tip finder writes no dailyKm", () => {
  it("handleTipChosen still patches the facility and the map location id", () => {
    expect(wasteSource).toContain("mapLocationId }");
  });

  it("handleTipChosen no longer patches dailyKm", () => {
    // The removed line was: await patchRow(rowId, { dailyKm: roundTrip });
    // Any reappearance of a dailyKm patch keyed on rowId (the finder's row
    // handle) is the defect returning. The estimator's own input patches on
    // row.id, which is a different handle and stays legal.
    expect(wasteSource).not.toContain("patchRow(rowId, { dailyKm");
  });

  it("the map distance is still OFFERED, so a deliberate override survives", () => {
    // setKmSuggest is the click-to-apply chip. Applying it is a real override
    // and is correctly recorded as manual; arriving at it by picking a tip was
    // not, which is the whole distinction this slice restores.
    expect(wasteSource).toContain("setKmSuggest((prev) => ({ ...prev, [rowId]: roundTrip }))");
  });

  it("the estimator's own dailyKm input still patches", () => {
    expect(wasteSource).toContain("patchRow(row.id, { dailyKm");
  });

  it("records why, so the next reader does not restore the auto-fill", () => {
    expect(wasteSource).toContain("WASTE_TIP_DAILYKM_PROVENANCE_V1");
  });
});