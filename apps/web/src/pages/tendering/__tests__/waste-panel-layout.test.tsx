// WASTE_PANEL_LAYOUT_V1 (scopecards-s8j) -- Tests for the expanded waste panel
// layout: one tip control, one Find tip button, restructured km figures.
//
// House pattern (no jsdom / no @testing-library): source text assertions and
// pure helper assertions. No DOM renderer needed.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WASTE_PANEL_LAYOUT_V1 } from "../ScopeWasteTab";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../${relFromRepoRoot}`, import.meta.url));

const wasteSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeWasteTab.tsx"),
  "utf-8"
);

// ─────────────────────────────────────────────────────────────────────────────
// Slice marker
// ─────────────────────────────────────────────────────────────────────────────

describe("WASTE_PANEL_LAYOUT_V1 slice marker", () => {
  it("is exported with value scopecards-s8j", () => {
    expect(WASTE_PANEL_LAYOUT_V1).toBe("scopecards-s8j");
  });

  it("appears in ScopeWasteTab source at least twice", () => {
    const matches = (wasteSource.match(/WASTE_PANEL_LAYOUT_V1/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: one tip control, one Find tip button (FAILS on origin/main)
// The old code had two drawer openings (mode "find" and mode "map") and a
// separate "Tip (map location)" select. After S8j: one tip control, one button.
// ─────────────────────────────────────────────────────────────────────────────

describe("one tip control, one Find tip button (test 2 -- fails on origin/main)", () => {
  it('no element opens the drawer in "map" mode', () => {
    // Before S8j: mode: "map" existed; now it is gone.
    expect(wasteSource).not.toContain('mode: "map"');
  });

  it('"Tip (map location)" label is absent', () => {
    // Before S8j: a separate "Tip (map location)" label/select existed.
    expect(wasteSource).not.toContain("Tip (map location)");
  });

  it("exactly one Find tip button pattern in the table row (waste-find-tip-btn testid)", () => {
    // The table row now has one data-testid="waste-find-tip-btn" per row.
    expect(wasteSource).toContain('data-testid="waste-find-tip-btn"');
    // Only one such testid (not two buttons with different modes).
    const matches = (wasteSource.match(/waste-find-tip-btn/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it("the tip select uses waste-tip-select testid", () => {
    expect(wasteSource).toContain('data-testid="waste-tip-select"');
  });

  it("the Map button is not present", () => {
    // Before S8j: a "Map" button opened mode "map". After: removed.
    // The word "Map" may appear in comments but not as a button label
    // inside the row renderer expanding section.
    expect(wasteSource).not.toContain('setTipDrawer({ rowId: row.id, mode: "map"');
    expect(wasteSource).not.toContain('>\\nMap\\n<');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: tip patch has wasteFacility + mapLocationId, no dailyKm key
// (FAILS on origin/main -- old code only patched wasteFacility on select change)
// ─────────────────────────────────────────────────────────────────────────────

describe("tip patch contains wasteFacility + mapLocationId, no dailyKm (test 3 -- fails on origin/main)", () => {
  it("the tip select onChange includes mapLocationId in the patchRow call", () => {
    // New: the tip select writes both wasteFacility and mapLocationId.
    expect(wasteSource).toContain("wasteFacility: next");
    expect(wasteSource).toContain("mapLocationId: matchedTip");
  });

  it("handleTipChosen includes both wasteFacility and mapLocationId", () => {
    expect(wasteSource).toContain("wasteFacility: facilityName, mapLocationId");
  });

  it("handleTipChosen has no dailyKm key in the patchRow call", () => {
    // Extract the handleTipChosen function body
    const handlerStart = wasteSource.indexOf("const handleTipChosen");
    const handlerEnd = wasteSource.indexOf("\n  );", handlerStart) + 5;
    const handler = wasteSource.slice(handlerStart, handlerEnd);
    expect(handler).not.toContain("dailyKm:");
    expect(handler).not.toContain("dailyKmSource:");
  });

  it("the tip select onChange has no dailyKm key", () => {
    // Find the tip select onChange block
    const tipSelectIdx = wasteSource.indexOf("data-testid=\"waste-tip-select\"");
    const onChangeIdx = wasteSource.indexOf("void patchRow(row.id", tipSelectIdx);
    const onChangeBraceEnd = wasteSource.indexOf("});", onChangeIdx) + 3;
    const onChangeBlock = wasteSource.slice(onChangeIdx, onChangeBraceEnd);
    expect(onChangeBlock).not.toContain("dailyKm");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: map chip applies manual override with dailyKmSource "manual"
// ─────────────────────────────────────────────────────────────────────────────

describe("map chip applies dailyKmSource manual override (test 4)", () => {
  it("the apply chip click includes dailyKmSource: manual", () => {
    expect(wasteSource).toContain('dailyKmSource: "manual"');
  });

  it("the apply chip is in the daily km block of the Trip plan", () => {
    expect(wasteSource).toContain('data-testid="waste-map-chip-apply"');
  });

  it("after a tip change dailyKmSource is derived (server sets it; no manual override in tip patch)", () => {
    // Neither the tip select nor handleTipChosen sends dailyKmSource.
    // The server re-resolves the route and writes dailyKmSource "derived".
    // Verify neither patch carries dailyKmSource.
    const tipSelectIdx = wasteSource.indexOf("data-testid=\"waste-tip-select\"");
    const onChangeIdx = wasteSource.indexOf("void patchRow(row.id", tipSelectIdx);
    const patchEnd = wasteSource.indexOf("});", onChangeIdx) + 3;
    const tipPatch = wasteSource.slice(onChangeIdx, patchEnd);
    expect(tipPatch).not.toContain("dailyKmSource");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: all four figures present and separately labelled
// ─────────────────────────────────────────────────────────────────────────────

describe("four figures present and separately labelled (test 5)", () => {
  it("trips figure is present", () => {
    expect(wasteSource).toContain('data-testid="waste-trips-value"');
  });

  it("loads per truck per day figure is present in strip", () => {
    expect(wasteSource).toContain('data-testid="waste-loads-per-day-strip"');
  });

  it("Total route km: the whole job label is present", () => {
    expect(wasteSource).toContain("Total route km: the whole job");
  });

  it("Daily km: one truck, one full day label is present", () => {
    expect(wasteSource).toContain("Daily km: one truck, one full day");
  });

  it("waste-total-route-km-block testid present", () => {
    expect(wasteSource).toContain('data-testid="waste-total-route-km-block"');
  });

  it("waste-daily-km-block testid present", () => {
    expect(wasteSource).toContain('data-testid="waste-daily-km-block"');
  });

  it("trips and loads per day are different named figures (not merged)", () => {
    // The trip plan has both separately labelled -- never folded.
    const tripsIdx = wasteSource.indexOf("waste-trips-value");
    const loadsIdx = wasteSource.indexOf("waste-loads-per-day-strip");
    expect(tripsIdx).toBeGreaterThan(-1);
    expect(loadsIdx).toBeGreaterThan(-1);
    // Both exist and are separate entries.
    expect(tripsIdx).not.toBe(loadsIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: arithmetic identity -- server figures are folded, not recomputed
// ─────────────────────────────────────────────────────────────────────────────

describe("layout does not touch arithmetic (test 6)", () => {
  it("totalTripKm is read from server, never recomputed here", () => {
    // The file must read row.totalTripKm but not multiply trips x 2 x km
    // to produce a new value. Displaying the formula as a note is allowed.
    expect(wasteSource).toContain("row.totalTripKm");
    // No assignment that computes totalTripKm from parts.
    expect(wasteSource).not.toMatch(/totalTripKm\s*=\s*\w/);
  });

  it("lineTotal is server-supplied, not recomputed", () => {
    expect(wasteSource).not.toMatch(/qty\s*\*\s*ratePerTonne/);
  });

  it("fuel is charged on totalTripKm (source contains the note)", () => {
    expect(wasteSource).toContain("fuel is charged on this");
  });

  it("waste-fuel-charged-km testid still present (regression from s8h)", () => {
    expect(wasteSource).toContain('data-testid="waste-fuel-charged-km"');
  });

  it("stale dailyKmSource comment is fixed to real server derivation", () => {
    // The old comment said "totalTripKm / trucks" which is wrong.
    // After S8j it says "loadsPerTruckPerDay x 2 x one-way km".
    expect(wasteSource).not.toContain("totalTripKm / trucks");
    expect(wasteSource).toContain("loadsPerTruckPerDay");
  });
});
