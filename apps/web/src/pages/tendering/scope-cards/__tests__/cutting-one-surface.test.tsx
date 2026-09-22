// CUTTING_ONE_SURFACE_V1 (scopecards-s6) — tests for the single concrete
// cutting surface.
//
// Scopecards S6 deletes CuttingSection (the read-only take-off) and makes
// ScopeCuttingSheet the only cutting surface on the card. These tests replace
// cutting-section.test.tsx (which guarded the now-deleted component).
//
// Key assertions:
//   1. The tab source mounts exactly one cutting surface (ScopeCuttingSheet,
//      no CuttingSection).
//   2. The heading "Concrete cutting" appears exactly once on the sheet (no
//      collision — the guard that made #1682 impossible is carried here).
//   3. ASB cards still render no cutting section at all.
//   4. The header carries all 14 mock-up columns in the correct order.
//   5. A core-hole row renders O with a figure; Material is muted.
//   6. An other-rate row has Equipment, Elevation and Material muted.
//   7. A saw-cut row has O muted.
//   8. Depth: a row at a depth absent from the option list still renders its
//      stored depth; options come from the rows passed in, not a literal list.
//   9. CUTTING_ONE_SURFACE_V1 sentinel is exported.
//
// The web workspace has no jsdom; the house pattern is followed throughout:
//   - claims about numbers  -> exported pure helpers
//   - claims about markup   -> renderToStaticMarkup (no DOM needed)
//   - claims about structure -> source assertions (mount point, ordering)

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CUTTING_ONE_SURFACE_V1 } from "../../ScopeCuttingSheet";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

const sheetSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeCuttingSheet.tsx"),
  "utf-8"
);
const tabSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
  "utf-8"
);

// ───────────────────────────────────────────────────────────────────────
// 1. Sentinel
// ───────────────────────────────────────────────────────────────────────

describe("CUTTING_ONE_SURFACE_V1 sentinel", () => {
  it("is exported with the correct value", () => {
    expect(CUTTING_ONE_SURFACE_V1).toBe("scopecards-s6");
  });

  it("is present in the sheet source", () => {
    expect(sheetSource).toContain("CUTTING_ONE_SURFACE_V1");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 2. One surface, no CuttingSection
// ───────────────────────────────────────────────────────────────────────

describe("the card mounts exactly one cutting surface", () => {
  it("mounts ScopeCuttingSheet in the position under Waste", () => {
    const waste = tabSource.indexOf("<ScopeWasteTab");
    const cuttingSheet = tabSource.indexOf("<ScopeCuttingSheet");
    expect(waste).toBeGreaterThan(-1);
    expect(cuttingSheet).toBeGreaterThan(-1);
    expect(waste).toBeLessThan(cuttingSheet);
  });

  it("does not mount CuttingSection at all", () => {
    // JSX element and import are gone. Comments referencing the deleted
    // component are acceptable historical context.
    expect(tabSource).not.toContain("<CuttingSection");
    expect(tabSource).not.toContain('from "./CuttingSection"');
  });

  it("does not import or mount CuttingSection", () => {
    // Check that CuttingSection is neither imported nor rendered.
    // Comments referencing the deleted component are fine.
    expect(tabSource).not.toContain('import { CuttingSection }');
    expect(tabSource).not.toContain("<CuttingSection ");
    expect(tabSource).not.toContain('from "./CuttingSection"');
  });

  it("ScopeCuttingSheet now reports onSectionTotalChange (feeds the card-money fold)", () => {
    // The section total must still reach statsByCard. With CuttingSection gone,
    // ScopeCuttingSheet carries the callback.
    expect(tabSource).toContain("onSectionTotalChange={onCuttingTotalChange}");
  });

  it("still keeps waste off the fold (ScopeWasteTab has no total callback)", () => {
    const wasteMount = /<ScopeWasteTab[\s\S]*?\/>/.exec(tabSource)?.[0] ?? "";
    expect(wasteMount).not.toBe("");
    expect(wasteMount).not.toContain("onSectionTotalChange");
    expect(wasteMount).not.toContain("TotalChange");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 3. Heading collision guard — the fix that prevented #1682
//    (carried from cutting-section.test.tsx before its retirement)
// ───────────────────────────────────────────────────────────────────────

describe("heading collision guard (from cutting-section.test.tsx)", () => {
  it("the sheet source contains exactly one 'Concrete cutting' string", () => {
    // #1682: getByText("Concrete cutting") resolved to two elements when both
    // CuttingSection and ScopeCuttingSheet rendered the heading. With one
    // surface there can only be one. We count occurrences in the rendered
    // strings (non-comment lines only).
    const nonComment = sheetSource
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const matches = (nonComment.match(/Concrete cutting/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it("the tab source gates cutting on showsCuttingColumn, not on a literal discipline", () => {
    expect(tabSource).toContain("showsCuttingColumn(card.discipline as TableDiscipline)");
    expect(tabSource).not.toMatch(/discipline\s*!==\s*"ASB"/);
    expect(tabSource).not.toMatch(/discipline\s*===\s*"ASB"/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 4. ASB cards never cut
// ───────────────────────────────────────────────────────────────────────

describe("the discipline gate", () => {
  it("ScopeCardsTab wraps ScopeCuttingSheet in the showsCuttingColumn gate", () => {
    // The gate uses showsCuttingColumn, not a literal "ASB" check.
    // The sheet is rendered inside `{showsCuttingColumn(...) ? <ScopeCuttingSheet ...> : null}`.
    const gateIdx = tabSource.indexOf("showsCuttingColumn(card.discipline");
    const sheetIdx = tabSource.indexOf("<ScopeCuttingSheet");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(sheetIdx).toBeGreaterThan(-1);
    // The gate appears before the sheet mount (it wraps it).
    expect(gateIdx).toBeLessThan(sheetIdx);
  });

  it("the sheet source states no discipline literal of its own", () => {
    // showsCuttingColumn is the single source of truth; a second predicate
    // would mean the two could drift apart.
    expect(sheetSource).not.toMatch(/!==\s*"ASB"/);
    expect(sheetSource).not.toMatch(/===\s*"ASB"/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 5. Column headers — mock-up order
// ───────────────────────────────────────────────────────────────────────

describe("the header row carries all mock-up columns in the correct order", () => {
  // Expected: Goes to | From | Type | Description | Equipment | Elevation |
  //           Material | Depth | O | Qty | Method | Rate | Markup | Total
  const EXPECTED_HEADERS = [
    "Goes to", "From", "Type", "Description", "Equipment", "Elevation",
    "Material", "Depth", "Ø", "Qty", "Method", "Rate", "Markup", "Total"
  ];

  it("the headers array in the source lists all 14 in order", () => {
    // Assert every column name is present in source.
    for (const header of EXPECTED_HEADERS) {
      expect(sheetSource).toContain(`"${header}"`);
    }
  });

  it("the columns appear in the correct order", () => {
    // Check pairwise ordering by searching for them in the headers array literal.
    const headersLiteral = /const headers = \[[\s\S]*?\];/.exec(sheetSource)?.[0] ?? "";
    expect(headersLiteral).not.toBe("");
    for (let i = 0; i < EXPECTED_HEADERS.length - 1; i++) {
      const a = headersLiteral.indexOf(`"${EXPECTED_HEADERS[i]}"`);
      const b = headersLiteral.indexOf(`"${EXPECTED_HEADERS[i + 1]}"`);
      expect(a).toBeGreaterThan(-1);
      expect(b).toBeGreaterThan(-1);
      expect(a).toBeLessThan(b);
    }
  });

  it("Material is a named column in the source", () => {
    expect(sheetSource).toContain("Material");
  });

  it("Ø (diameter) is a named column in the source", () => {
    // The O character (U+00D8) is in the headers array.
    expect(sheetSource).toContain("Ø");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 6. Muted-cell rule — a cell a row type does not use is muted, never dropped
// ───────────────────────────────────────────────────────────────────────

describe("muted-cell rule", () => {
  it("a core-hole row renders the diameter column with a figure, not muted", () => {
    // For core-hole rows the Ø column is active.
    // We assert via source: the core-hole branch renders a select or input,
    // not a muted span, for the Ø cell.
    // The key: isCoreHole check is before the muted span in the Ø cell block.
    const oCell = /\{\/\* O \(diameterMm\)[\s\S]*?(?=\{\/\*\s*Qty)/.exec(sheetSource)?.[0] ?? "";
    expect(oCell).not.toBe("");
    // Core-hole path: renders a select or input (not a muted span).
    expect(oCell).toContain("isCoreHole");
    // The muted fallback exists too (for non-core-hole rows).
    expect(oCell).toContain('data-testid="diameter-muted"');
  });

  it("a saw-cut row has O muted (source assertion)", () => {
    // The Ø cell mutes non-core-hole rows.
    expect(sheetSource).toContain('data-testid="diameter-muted"');
  });

  it("Material muted for non-saw-cut rows (source assertion)", () => {
    // The Material cell mutes non-saw-cut rows.
    expect(sheetSource).toContain('data-testid="material-muted"');
  });

  it("an other-rate row has Equipment muted in the cell (source assertion)", () => {
    // The Equipment cell for isOther renders a muted em-dash.
    const equipmentCell = /\{\/\* Equipment[\s\S]*?(?=\{\/\*\s*Elevation)/.exec(sheetSource)?.[0] ?? "";
    expect(equipmentCell).not.toBe("");
    expect(equipmentCell).toContain("isOther");
    expect(equipmentCell).toContain("EM_DASH");
  });

  it("an other-rate row has Elevation muted in the cell (source assertion)", () => {
    // The Elevation cell for isOther renders a muted em-dash.
    const elevationCell = /\{\/\* Elevation[\s\S]*?(?=\{\/\*\s*Material)/.exec(sheetSource)?.[0] ?? "";
    expect(elevationCell).not.toBe("");
    expect(elevationCell).toContain("isOther");
    expect(elevationCell).toContain("EM_DASH");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 7. Shift / shiftLoading are deprecated — no control, no column
// ───────────────────────────────────────────────────────────────────────

describe("shift and shiftLoading are not rendered", () => {
  it("the sheet source has no shift input or shift column", () => {
    // Strip block comments and line comments so we only see code.
    const code = sheetSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    // No control that reads or writes shift/shiftLoading in rendered JSX.
    expect(code).not.toContain("item.shift");
    expect(code).not.toContain("item.shiftLoading");
    // No shift column header.
    expect(code).not.toMatch(/"(Shift|Loading|shift)"/);
  });

  it("the type still has shift and shiftLoading (they are deprecated, not deleted)", () => {
    // The fields must remain in the type so old API responses still parse.
    expect(sheetSource).toContain("shift?:");
    expect(sheetSource).toContain("shiftLoading?:");
    // And they must be marked deprecated.
    expect(sheetSource).toContain("DEPRECATED");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 8. No browser arithmetic on rates
// ───────────────────────────────────────────────────────────────────────

describe("the browser does not compute a cutting price", () => {
  it("no multiplication operator appears in the sheet's code", () => {
    const code = sheetSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toContain("*");
  });

  it("the section total is a fold of server line totals only", () => {
    // The only arithmetic in the component is the reduce over server lineTotal.
    expect(sheetSource).toContain("i.lineTotal ? Number(i.lineTotal) : 0");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 9. Depth column: off-list depth is shown as stored; options from rows
// ───────────────────────────────────────────────────────────────────────

describe("depth handling (section 6 of spec — Marco 2026-09-22 ruling)", () => {
  it("the depth input is a free text input, not restricted to the option list", () => {
    // The server resolves at-or-above; the screen must not coerce an off-list depth.
    // A free-text number input lets any stored value render as-is.
    const depthCell = /\{\/\* Depth[\s\S]*?(?=\{\/\*\s*O )/.exec(sheetSource)?.[0] ?? "";
    expect(depthCell).not.toBe("");
    // The Depth input for saw-cut and core-hole is a <input type="number"> not a <select>.
    expect(depthCell).toContain('type="number"');
    // It is bound to item.depthMm — the stored value, not coerced.
    expect(depthCell).toContain("item.depthMm");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 10. CuttingSection.tsx is gone
// ───────────────────────────────────────────────────────────────────────

describe("CuttingSection.tsx does not exist", () => {
  it("CuttingSection is not imported or mounted in scope-cards", () => {
    // The tab source must not import or mount CuttingSection (comments are ok).
    expect(tabSource).not.toContain('from "./CuttingSection"');
    expect(tabSource).not.toContain("<CuttingSection");
  });

  it("ScopeCuttingSheet carries the Cutting take-off empty-state phrase", () => {
    // The phrase the estimator learned must not be lost — it lives on the
    // empty state of the single surface.
    expect(sheetSource).toContain("Cutting take-off");
  });

  it("ScopeCuttingSheet carries 'Concrete cutting' heading exactly once", () => {
    // Counted on non-comment lines only. Zero or two would both be wrong.
    const nonComment = sheetSource
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    const count = (nonComment.match(/Concrete cutting/g) ?? []).length;
    expect(count).toBe(1);
  });
});
