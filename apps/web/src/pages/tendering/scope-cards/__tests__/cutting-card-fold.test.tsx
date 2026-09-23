// CUTTING_IN_THE_FOLD_V1 (scopecards-s7b) — tests for the cutting price-slice fold.
//
// S7b upgrades the cutting section's upward report from a single number at cost
// to { subtotal, withMarkup }, filtering to PRICE (or null) destination rows only.
// This aligns cutting with the operational-costs section on exactly the same terms.
//
// Test coverage:
//   1. A card with PRICE + markup-override, PRICE + no markup, INTERNAL, OPTION rows:
//      subtotal contains only the two PRICE rows; withMarkup uses lineTotalWithMarkup.
//   2. A row with null quoteDestination counts as PRICE.
//   3. A card with no cutting rows reports { subtotal: 0, withMarkup: 0 }.
//   4. lineTotalWithMarkup falls back to lineTotal when absent (legacy rows).
//   5. Source: the stale "no per-line markup" comment is gone from ScopeCardsTab.
//   6. Source: cuttingTotals is Record<string, { subtotal; withMarkup }>, not a number.
//
// All number claims are tested against the exported pure helper
// computeCuttingPriceTotals — no DOM, no jsdom, no renderer needed.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CUTTING_IN_THE_FOLD_V1,
  computeCuttingPriceTotals,
  type CuttingRowForFold
} from "../../ScopeCuttingSheet";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

const tabSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
  "utf-8"
);

// ───────────────────────────────────────────────────────────────────────
// Sentinel
// ───────────────────────────────────────────────────────────────────────

describe("CUTTING_IN_THE_FOLD_V1 sentinel", () => {
  it("is exported with the correct value", () => {
    expect(CUTTING_IN_THE_FOLD_V1).toBe("scopecards-s7b");
  });
});

// ───────────────────────────────────────────────────────────────────────
// computeCuttingPriceTotals — the pure fold helper
// ───────────────────────────────────────────────────────────────────────

describe("computeCuttingPriceTotals", () => {
  // Fixture: four rows representing the worked example from the spec.
  //
  // Before/after example (10% cutting markup, one Internal-only row):
  //
  //   Row A: PRICE, lineTotal=500, lineTotalWithMarkup=550  (10% markup)
  //   Row B: PRICE, lineTotal=200, lineTotalWithMarkup=200  (no override, 0% effective markup)
  //   Row C: INTERNAL, lineTotal=300, lineTotalWithMarkup=330
  //   Row D: OPTION, lineTotal=100, lineTotalWithMarkup=110
  //
  // Before S7b: card total = 500 + 200 + 300 + 100 = 1100 (all rows, at cost, no markup)
  // After  S7b: subtotal = 700 (rows A+B only), withMarkup = 750 (550 + 200)
  //
  // The Internal row (C) is excluded from what the card reports to the tender price.
  // The Option row (D) is excluded too — options are not in the price.

  const ROW_A: CuttingRowForFold = {
    quoteDestination: "PRICE",
    lineTotal: "500",
    lineTotalWithMarkup: 550
  };
  const ROW_B: CuttingRowForFold = {
    quoteDestination: "PRICE",
    lineTotal: "200",
    lineTotalWithMarkup: 200
  };
  const ROW_C: CuttingRowForFold = {
    quoteDestination: "INTERNAL",
    lineTotal: "300",
    lineTotalWithMarkup: 330
  };
  const ROW_D: CuttingRowForFold = {
    quoteDestination: "OPTION",
    lineTotal: "100",
    lineTotalWithMarkup: 110
  };

  it("subtotal contains only the two PRICE rows", () => {
    const result = computeCuttingPriceTotals([ROW_A, ROW_B, ROW_C, ROW_D]);
    expect(result.subtotal).toBe(700); // 500 + 200; excludes INTERNAL (300) and OPTION (100)
  });

  it("withMarkup uses the server's lineTotalWithMarkup for PRICE rows", () => {
    const result = computeCuttingPriceTotals([ROW_A, ROW_B, ROW_C, ROW_D]);
    expect(result.withMarkup).toBe(750); // 550 + 200; excludes INTERNAL and OPTION
  });

  it("INTERNAL row is excluded from both subtotal and withMarkup", () => {
    const result = computeCuttingPriceTotals([ROW_C]);
    expect(result.subtotal).toBe(0);
    expect(result.withMarkup).toBe(0);
  });

  it("OPTION row is excluded from both subtotal and withMarkup", () => {
    const result = computeCuttingPriceTotals([ROW_D]);
    expect(result.subtotal).toBe(0);
    expect(result.withMarkup).toBe(0);
  });

  it("a null quoteDestination counts as PRICE", () => {
    const nullDest: CuttingRowForFold = {
      quoteDestination: null,
      lineTotal: "400",
      lineTotalWithMarkup: 440
    };
    const result = computeCuttingPriceTotals([nullDest]);
    expect(result.subtotal).toBe(400);
    expect(result.withMarkup).toBe(440);
  });

  it("an absent quoteDestination (undefined) also counts as PRICE", () => {
    const noDest: CuttingRowForFold = {
      lineTotal: "150",
      lineTotalWithMarkup: 165
    };
    const result = computeCuttingPriceTotals([noDest]);
    expect(result.subtotal).toBe(150);
    expect(result.withMarkup).toBe(165);
  });

  it("a card with no cutting rows reports { subtotal: 0, withMarkup: 0 }", () => {
    const result = computeCuttingPriceTotals([]);
    expect(result.subtotal).toBe(0);
    expect(result.withMarkup).toBe(0);
  });

  it("falls back to lineTotal when lineTotalWithMarkup is absent (legacy rows)", () => {
    const legacyRow: CuttingRowForFold = {
      quoteDestination: "PRICE",
      lineTotal: "600",
      lineTotalWithMarkup: null
    };
    const result = computeCuttingPriceTotals([legacyRow]);
    expect(result.subtotal).toBe(600);
    // Falls back to lineTotal (600) since lineTotalWithMarkup is null.
    expect(result.withMarkup).toBe(600);
  });

  it("falls back to lineTotal when lineTotalWithMarkup is undefined", () => {
    const legacyRow: CuttingRowForFold = {
      quoteDestination: "PRICE",
      lineTotal: "250"
      // lineTotalWithMarkup not set
    };
    const result = computeCuttingPriceTotals([legacyRow]);
    expect(result.subtotal).toBe(250);
    expect(result.withMarkup).toBe(250);
  });

  it("handles a null lineTotal gracefully (treats as 0)", () => {
    const noTotal: CuttingRowForFold = {
      quoteDestination: "PRICE",
      lineTotal: null,
      lineTotalWithMarkup: null
    };
    const result = computeCuttingPriceTotals([noTotal]);
    expect(result.subtotal).toBe(0);
    expect(result.withMarkup).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────
// Source assertions — ScopeCardsTab fold shape
// ───────────────────────────────────────────────────────────────────────

describe("ScopeCardsTab fold shape (source assertions)", () => {
  it("cuttingTotals is Record<string, { subtotal; withMarkup }>, not a bare number", () => {
    expect(tabSource).toContain('Record<string, { subtotal: number; withMarkup: number }>');
    // The old single-number Record is gone.
    expect(tabSource).not.toContain('Record<string, number>');
  });

  it("the fold adds cuttingSubtotal to subtotal", () => {
    expect(tabSource).toContain("cuttingSubtotal");
    expect(tabSource).toContain("cuttingWithMarkup");
  });

  it("the stale 'no per-line markup; goes to both figures at cost' comment is removed", () => {
    expect(tabSource).not.toContain("no per-line markup; goes to both figures at cost");
  });

  it("CUTTING_IN_THE_FOLD_V1 appears in the tab source as the governing comment", () => {
    expect(tabSource).toContain("CUTTING_IN_THE_FOLD_V1");
  });
});
