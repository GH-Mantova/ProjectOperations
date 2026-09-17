// SCOPE_QD_UI_SECTIONS_V1 / SCOPE_OTHER_COSTS_V1 / SCOPE_OPERATIONAL_COSTS_PRICED_V1
// — tests for the "Other operational costs" section.
//
// The web workspace has no jsdom and no @testing-library (see
// discipline-summary-bar.test.tsx). Anything that is a claim about a NUMBER is
// tested against the exported pure helpers; anything that is a claim about the
// DOM — "the days input is disabled", "the revert control names the rate it
// returns to" — uses renderToStaticMarkup from react-dom/server, which needs
// no DOM. Anything that is a claim about STRUCTURE — "the section sits between
// the WBS table and Waste" — is asserted against the mount point's source,
// because with no renderer there is no other way to pin an ordering.
//
// SCOPE_OPERATIONAL_COSTS_PRICED_V1 (S1): the section NO LONGER prices lines
// in the browser. It reads the server's `lineTotalWithMarkup` off each row.
// Source assertions confirm there is no `qty *` or `* rate` expression left in
// OtherOperationalCosts.tsx.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DURATION_BEARING_UNITS,
  OperationalCostRow,
  RateLibraryItemPicker,
  UNIT_OPTIONS,
  computeOperationalFourWay,
  daysForUnit,
  isDurationBearingUnit,
  isRateOverridden,
  operationalDestNote,
  resolveLineRate,
  rowLineTotalWithMarkup,
  computeOperationalTotals,
  toNum,
  type OperationalCostLine,
  type OperationalFourWay,
  type OperationalSectionTotals,
  type RateLibraryItem
} from "../OtherOperationalCosts";
import { DESTINATION_NOTE } from "../QuoteDestinationSelect";
import { computeCardBarStats } from "../DisciplineSummaryBar";
import { rollUpDiscipline, toCardRollupInput } from "../utils/discipline-rollup";
import type { ScopeItem } from "../../ScopeQuantitiesTable";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

function makeLine(overrides: Partial<OperationalCostLine> = {}): OperationalCostLine {
  return {
    id: "line-1",
    cardId: "card-1",
    description: "Traffic control",
    qty: "1",
    unit: "day",
    days: "1",
    rate: "100",
    rateOverride: null,
    plantRateId: null,
    sortOrder: 0,
    ...overrides
  };
}

function makeItem(lineTotal: number, lineTotalWithMarkup: number, id: string): ScopeItem {
  return {
    id,
    tenderId: "t1",
    cardId: "card-1",
    wbsCode: "DEM1.1",
    itemNumber: 1,
    description: "Test item",
    status: "confirmed",
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
    lineTotal,
    lineTotalWithMarkup
  } as ScopeItem;
}

// ───────────────────────────────────────────────────────────────────────
// 1. The lump-sum rule is ONE list, mirrored from #1665 — not a second one
// ───────────────────────────────────────────────────────────────────────

describe("the duration-bearing unit list mirrors the API's, exactly", () => {
  // PR #1665 shipped DURATION_BEARING_UNITS in the API DTO and enforces the
  // lump-sum rule server-side. The web section pins and greys the days field
  // against the SAME list. Two lists that can disagree is the defect this test
  // exists to make impossible: if the server list is edited without editing
  // the web mirror, this goes red.
  //
  // The DTO is read off disk rather than imported: it pulls in class-validator
  // and class-transformer, which are apps/api dependencies and do not resolve
  // from apps/web.
  const dtoPath = repoFile("apps/api/src/modules/tendering/dto/scope-costs.dto.ts");
  const dtoSource = readFileSync(dtoPath, "utf-8");

  function serverUnits(): string[] {
    const match = dtoSource.match(
      /export const DURATION_BEARING_UNITS:\s*readonly string\[\]\s*=\s*\[([\s\S]*?)\]/
    );
    if (!match) throw new Error(`DURATION_BEARING_UNITS not found in ${dtoPath}`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }

  it("finds the server list (guards the parser itself)", () => {
    expect(serverUnits().length).toBeGreaterThan(0);
  });

  it("is identical to the server list, in the same order", () => {
    expect([...DURATION_BEARING_UNITS]).toEqual(serverUnits());
  });

  it("names Ea and Lump sum as carrying no duration, as #1665 does", () => {
    expect(dtoSource).toContain("Lump sum");
    expect(isDurationBearingUnit("Ea")).toBe(false);
    expect(isDurationBearingUnit("Lump sum")).toBe(false);
  });

  it("is default-deny: an unrecognised or absent unit carries no duration", () => {
    expect(isDurationBearingUnit("scaffold-week")).toBe(false);
    expect(isDurationBearingUnit(null)).toBe(false);
    expect(isDurationBearingUnit(undefined)).toBe(false);
  });

  it("matches case-insensitively and trims, as the API does", () => {
    expect(isDurationBearingUnit(" DAY ")).toBe(true);
    expect(isDurationBearingUnit("Week")).toBe(true);
  });

  it("offers no dropdown unit that claims a duration the server would deny", () => {
    // Every offered unit is classified by the mirrored predicate, so the
    // dropdown cannot introduce a duration-bearing spelling of its own.
    for (const unit of UNIT_OPTIONS) {
      if (isDurationBearingUnit(unit)) {
        expect(DURATION_BEARING_UNITS).toContain(unit.trim().toLowerCase());
      }
    }
    expect(UNIT_OPTIONS).toContain("Ea");
    expect(UNIT_OPTIONS).toContain("Lump sum");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 2. A lump-sum line cannot be given days; Total comes from the server
// ───────────────────────────────────────────────────────────────────────

describe("a lump-sum line", () => {
  it("pins days at 1 whatever the stored value was", () => {
    expect(daysForUnit("Lump sum", 7)).toBe(1);
    expect(daysForUnit("Ea", 3)).toBe(1);
    expect(daysForUnit("Lump sum", null)).toBe(1);
  });

  it("leaves days alone for a unit that does carry a duration", () => {
    expect(daysForUnit("day", 7)).toBe(7);
    expect(daysForUnit("week", 2)).toBe(2);
    expect(daysForUnit("day", null)).toBe(null);
  });

  it("renders its days field disabled, read-only and pinned at 1", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ unit: "Lump sum", days: "1", qty: "1", rate: "1200" })}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    const daysInput = html.match(/<input[^>]*data-testid="other-cost-days"[^>]*>/)?.[0] ?? "";
    expect(daysInput).not.toBe("");
    expect(daysInput).toContain('value="1"');
    expect(daysInput).toContain("disabled");
    expect(daysInput).toContain("readOnly");
    expect(daysInput).toContain('data-days-pinned="true"');
  });

  it("renders an Ea line's days field pinned the same way", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ unit: "Ea", days: "4", qty: "2", rate: "375" })}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    const daysInput = html.match(/<input[^>]*data-testid="other-cost-days"[^>]*>/)?.[0] ?? "";
    // Stored 4 is never shown; the pinned 1 is.
    expect(daysInput).toContain('value="1"');
    expect(daysInput).not.toContain('value="4"');
    expect(daysInput).toContain("disabled");
  });

  it("leaves the days field editable for a day-rated line", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ unit: "day", days: "3", qty: "1", rate: "850" })}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    const daysInput = html.match(/<input[^>]*data-testid="other-cost-days"[^>]*>/)?.[0] ?? "";
    expect(daysInput).toContain('value="3"');
    expect(daysInput).not.toContain("disabled");
    expect(daysInput).toContain('data-days-pinned="false"');
  });

  // SCOPE_OPERATIONAL_COSTS_PRICED_V1: the row reads the server's
  // `lineTotalWithMarkup`; the browser never multiplies qty x rate.
  it("shows the server's lineTotalWithMarkup in the Total cell", () => {
    // Server has priced a 4 x $1,200 lump sum (includes markup) as $5,280.
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ unit: "Lump sum", qty: "4", days: "1", rate: "1200", lineTotalWithMarkup: 5280 })}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    expect(html).toContain("$5,280.00");
  });

  it("shows a dash when lineTotalWithMarkup is absent (row not yet priced by S1 API)", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ unit: "Lump sum", qty: "4", days: "1", rate: "1200" })}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    // No lineTotalWithMarkup: shows em-dash, never $4,800 (the pre-S1 computation).
    expect(html).toContain("—");
    expect(html).not.toContain("$4,800");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 3. The rate override pattern
// ───────────────────────────────────────────────────────────────────────

describe("the rate override", () => {
  it("inherits the locked rate when no override is stored", () => {
    expect(resolveLineRate(850, null)).toBe(850);
    expect(isRateOverridden(null, 850)).toBe(false);
  });

  it("treats a stored 0 as a real value, not an absence", () => {
    expect(resolveLineRate(850, 0)).toBe(0);
    expect(isRateOverridden(0, 850)).toBe(true);
  });

  it("is not an override when it equals the locked rate", () => {
    expect(isRateOverridden(850, 850)).toBe(false);
  });

  it("shows the locked rate as the input's placeholder", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ rate: "850", rateOverride: null })}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    const rateInput = html.match(/<input[^>]*data-testid="other-cost-rate"[^>]*>/)?.[0] ?? "";
    expect(rateInput).toContain('placeholder="850"');
    expect(rateInput).toContain('value=""');
    // No revert control while nothing is overridden.
    expect(html).not.toContain('data-testid="other-cost-rate-revert"');
  });

  it("offers a revert control that NAMES the rate it returns to", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ rate: "850", rateOverride: "900" })}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    expect(html).toContain('data-testid="other-cost-rate-revert"');
    // The point of the test: the control says $850.00, not "auto-derived value".
    expect(html).toContain("Revert to the locked rate $850.00");
    expect(html).not.toContain("auto-derived value");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 4. One picker, shared with slice 8's subcontract quote
// ───────────────────────────────────────────────────────────────────────

describe("the shared rate-library item picker", () => {
  const options: RateLibraryItem[] = [
    { id: "p1", item: "20t excavator", unit: "day", rate: "1450", category: "Excavation" },
    { id: "p2", item: "Traffic control crew", unit: "day", rate: "850", category: "Traffic" },
    { id: "p3", item: "Retired float", unit: "each way", rate: "300", category: "Transport", isActive: false }
  ];

  it("is exported on its own, with no operational-cost vocabulary in its props", () => {
    // Slice 8 imports THIS component for a subcontract quote rather than
    // growing a second one. The contract it depends on is the prop list, so
    // the prop list is what is pinned here.
    const html = renderToStaticMarkup(
      <RateLibraryItemPicker
        selectedId={null}
        description="Scaffolding hire"
        options={options}
        ariaLabelPrefix="Item for subcontract quote row 1"
        onPick={() => undefined}
        onDescriptionChange={() => undefined}
      />
    );
    expect(html).toContain("Item for subcontract quote row 1 — pick from the rate library");
    expect(html).toContain("Item for subcontract quote row 1 — description");
    expect(html).toContain("Scaffolding hire");
  });

  it("groups library rows by category and drops inactive ones", () => {
    const html = renderToStaticMarkup(
      <RateLibraryItemPicker
        selectedId="p2"
        description="Traffic control crew"
        options={options}
        ariaLabelPrefix="Item for operational cost row 1"
        onPick={() => undefined}
        onDescriptionChange={() => undefined}
      />
    );
    expect(html).toContain('label="Excavation"');
    expect(html).toContain('label="Traffic"');
    expect(html).not.toContain("Retired float");
    expect(html).toContain("Custom item");
  });

  it("falls back to the custom option when the line's library row is gone", () => {
    // plantRateId is SetNull on the schema, and a line can also point at a row
    // this catalogue no longer returns. Neither may blank the description.
    const html = renderToStaticMarkup(
      <RateLibraryItemPicker
        selectedId="deleted-row"
        description="Council permit"
        options={options}
        ariaLabelPrefix="Item for operational cost row 1"
        onPick={() => undefined}
        onDescriptionChange={() => undefined}
      />
    );
    expect(html).toContain('value="__custom__" selected');
    expect(html).toContain("Council permit");
  });

  it("is the picker the operational-cost row itself renders", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ plantRateId: "p2", description: "Traffic control crew" })}
            index={1}
            rateOptions={options}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    expect(html).toContain("Item for operational cost row 2 — pick from the rate library");
    expect(html).toContain('value="p2" selected');
  });
});

// ───────────────────────────────────────────────────────────────────────
// 5. SCOPE_OPERATIONAL_COSTS_PRICED_V1 — server-side totals, two figures
// ───────────────────────────────────────────────────────────────────────

describe("SCOPE_OPERATIONAL_COSTS_PRICED_V1 — section reads server money, reports two figures", () => {
  // Source assertion: the section no longer multiplies qty x rate.
  // The old operationalLineTotal() was the only place this happened; S1 removed it.
  const componentSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
    "utf-8"
  );

  it("contains no qty-times-rate multiplication (source assertion)", () => {
    // A multiplication involving qty and rate in the browser would mean the
    // section is pricing lines itself, which S1 explicitly forbids.
    expect(componentSource).not.toMatch(/qty\s*\*/);
    expect(componentSource).not.toMatch(/\*\s*rate/);
  });

  it("reads lineTotalWithMarkup from the server, not a browser formula", () => {
    // The attribute is read in OperationalCostRow.
    expect(componentSource).toContain("lineTotalWithMarkup");
    // The old pre-S1 helper `operationalLineTotal` no longer exists.
    expect(componentSource).not.toContain("operationalLineTotal");
    // The old `sumOperationalLines` no longer exists either.
    expect(componentSource).not.toContain("sumOperationalLines");
  });

  describe("rowLineTotalWithMarkup()", () => {
    it("returns the server figure when present and finite", () => {
      expect(rowLineTotalWithMarkup(makeLine({ lineTotalWithMarkup: 1100 }))).toBe(1100);
      expect(rowLineTotalWithMarkup(makeLine({ lineTotalWithMarkup: 0 }))).toBe(0);
    });

    it("returns 0 for a line without lineTotalWithMarkup (pre-S1 row)", () => {
      expect(rowLineTotalWithMarkup(makeLine())).toBe(0);
      expect(rowLineTotalWithMarkup(makeLine({ lineTotalWithMarkup: null }))).toBe(0);
    });
  });

  describe("computeOperationalTotals()", () => {
    it("sums both server figures independently", () => {
      const lines = [
        makeLine({ id: "l1", lineTotal: 1000, lineTotalWithMarkup: 1100 }),
        makeLine({ id: "l2", lineTotal: 500, lineTotalWithMarkup: 650 })
      ];
      const totals: OperationalSectionTotals = computeOperationalTotals(lines);
      expect(totals.subtotal).toBe(1500);
      expect(totals.withMarkup).toBe(1750);
    });

    it("contributes zero for an unpriceable line rather than NaN", () => {
      const totals = computeOperationalTotals([
        makeLine({ id: "x1", lineTotal: null, lineTotalWithMarkup: null }),
        makeLine({ id: "x2" }) // no server fields at all
      ]);
      expect(totals.subtotal).toBe(0);
      expect(totals.withMarkup).toBe(0);
      expect(Number.isNaN(totals.subtotal)).toBe(false);
      expect(Number.isNaN(totals.withMarkup)).toBe(false);
    });

    it("returns zero for an empty section", () => {
      const totals = computeOperationalTotals([]);
      expect(totals.subtotal).toBe(0);
      expect(totals.withMarkup).toBe(0);
    });

    it("uses subtotal for bare cost and withMarkup for marked-up total (they can differ)", () => {
      const lines = [makeLine({ id: "l1", lineTotal: 1000, lineTotalWithMarkup: 1300 })];
      const totals = computeOperationalTotals(lines);
      expect(totals.subtotal).toBe(1000);
      expect(totals.withMarkup).toBe(1300);
      expect(totals.subtotal).not.toBe(totals.withMarkup);
    });
  });

  describe("two-figure reporting into the card fold", () => {
    // The production path, reproduced exactly:
    //   items          -> computeCardBarStats              (the ONE card-money fn)
    //   + section totals -> statsByCard fold in ScopeCardsTab
    //   -> toCardRollupInput -> rollUpDiscipline           (the slice-1 bar)
    //
    // ScopeCardsTab puts otherCostsSubtotal into `subtotal` and
    // otherCostsWithMarkup into `subtotalWithMarkup` — the two figures go to
    // DIFFERENT destinations.
    const items = [makeItem(12500, 16250, "i1"), makeItem(4000, 5200, "i2")];

    // Mimics the statsByCard fold in ScopeCardsTab with S1 two-figure reporting.
    const fold = (totals: OperationalSectionTotals) => {
      const fromItems = computeCardBarStats(items);
      return {
        itemCount: fromItems.itemCount,
        subtotal: fromItems.subtotal + totals.subtotal,
        subtotalWithMarkup: fromItems.subtotalWithMarkup + totals.withMarkup
      };
    };

    // The DisciplineSummaryBar reads `subtotalWithMarkup` (the marked-up
    // figure) — a section that carries its own markup has to move the bar by
    // its withMarkup total, not the bare cost.
    const barSubtotal = (totals: OperationalSectionTotals) =>
      rollUpDiscipline([toCardRollupInput("card-1", null, fold(totals))]).subtotalWithMarkup;

    it("uses bare subtotal for subtotal and withMarkup for subtotalWithMarkup", () => {
      // Items: subtotal 16,500 / withMarkup 21,450 (30% markup).
      // Section: subtotal 1,000 / withMarkup 1,300.
      const sectionTotals: OperationalSectionTotals = { subtotal: 1000, withMarkup: 1300 };
      const result = fold(sectionTotals);
      expect(result.subtotal).toBe(17500);           // 16500 + 1000
      expect(result.subtotalWithMarkup).toBe(22750); // 21450 + 1300
    });

    it("moves the bar by the marked-up figure, not the bare cost", () => {
      const noSection: OperationalSectionTotals = { subtotal: 0, withMarkup: 0 };
      const withSection: OperationalSectionTotals = { subtotal: 1000, withMarkup: 1300 };
      const barBefore = barSubtotal(noSection);
      const barAfter = barSubtotal(withSection);
      // Bar moves by withMarkup (1300), not subtotal (1000).
      expect(barAfter - barBefore).toBe(1300);
    });

    it("contributes nothing for an empty section", () => {
      const empty: OperationalSectionTotals = { subtotal: 0, withMarkup: 0 };
      const fromItems = computeCardBarStats(items);
      const result = fold(empty);
      expect(result.subtotal).toBe(fromItems.subtotal);
      expect(result.subtotalWithMarkup).toBe(fromItems.subtotalWithMarkup);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────
// 6. ScopeCardsTab folds withMarkup into subtotalWithMarkup (source assertion)
// ───────────────────────────────────────────────────────────────────────

describe("ScopeCardsTab folds the section's withMarkup into subtotalWithMarkup", () => {
  const tabSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
    "utf-8"
  );

  it("uses otherCostsWithMarkup for subtotalWithMarkup, not otherCostsSubtotal", () => {
    // The two-figure reporting invariant: otherCostsSubtotal goes to subtotal,
    // otherCostsWithMarkup goes to subtotalWithMarkup. If someone accidentally
    // uses the same figure for both, this goes red.
    expect(tabSource).toContain("subtotal: fromItems.subtotal + otherCostsSubtotal");
    expect(tabSource).toContain("subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCostsWithMarkup");
  });

  it("extracts the two figures from the entry by field name", () => {
    expect(tabSource).toContain("otherCostsEntry?.subtotal");
    expect(tabSource).toContain("otherCostsEntry?.withMarkup");
  });

  it("carries the SCOPE_OPERATIONAL_COSTS_PRICED_V1 marker", () => {
    expect(tabSource).toContain("SCOPE_OPERATIONAL_COSTS_PRICED_V1");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 7. Where the section sits, and what this slice did not touch
// ───────────────────────────────────────────────────────────────────────

describe("the mount point", () => {
  const tabSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
    "utf-8"
  );

  it("mounts the section between the WBS table and Waste, per the mock-up's order", () => {
    const wbsTable = tabSource.indexOf("<ScopeQuantitiesTable");
    const otherCosts = tabSource.indexOf("<OtherOperationalCosts");
    const waste = tabSource.indexOf("<ScopeWasteTab");
    const cutting = tabSource.indexOf("<ScopeCuttingSheet");

    expect(wbsTable).toBeGreaterThan(-1);
    expect(otherCosts).toBeGreaterThan(-1);
    expect(waste).toBeGreaterThan(-1);
    expect(cutting).toBeGreaterThan(-1);

    // WBS items -> Other operational costs -> Waste -> Concrete cutting
    expect(wbsTable).toBeLessThan(otherCosts);
    expect(otherCosts).toBeLessThan(waste);
    expect(waste).toBeLessThan(cutting);
  });

  it("folds the section total into the ONE place card money is computed", () => {
    // computeCardBarStats is called exactly once, and the section total is
    // added inside that same fold — not next to a display. A second call site
    // is how the card total and the discipline bar start disagreeing.
    const calls = tabSource.match(/computeCardBarStats\(/g) ?? [];
    expect(calls.length).toBe(1);
    expect(tabSource).toContain("subtotal: fromItems.subtotal + otherCostsSubtotal");
    expect(tabSource).toContain("subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCostsWithMarkup");
  });

  it("carries the slice marker", () => {
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
      "utf-8"
    );
    expect(componentSource).toContain("SCOPE_OTHER_COSTS_V1");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 8. S2b-b — Goes-to column (FIRST), destination rail, INTERNAL treatment,
//    four-way money reporting
// ───────────────────────────────────────────────────────────────────────

describe("S2b-b: Goes-to column is FIRST in the table header", () => {
  const componentSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
    "utf-8"
  );

  it("lists Goes to before Item in the COLUMNS array (source assertion)", () => {
    // Mock-up order: "Goes to · From · Item description …"
    const colsIdx = componentSource.indexOf('"Goes to"');
    const itemIdx = componentSource.indexOf('"Item"');
    expect(colsIdx).toBeGreaterThan(-1);
    expect(itemIdx).toBeGreaterThan(-1);
    expect(colsIdx).toBeLessThan(itemIdx);
  });

  it("renders a Goes-to cell as the FIRST td in the row", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine({ quoteDestination: "PRICE" })}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    expect(html).toContain('data-testid="other-cost-dest-cell"');
    // The destination cell appears before the item picker.
    const destIdx = html.indexOf('data-testid="other-cost-dest-cell"');
    const qtyIdx = html.indexOf('data-testid="other-cost-qty"');
    expect(destIdx).toBeLessThan(qtyIdx);
  });

  it("does not pass optionLetter — the prop is omitted entirely", () => {
    expect(componentSource).not.toContain("optionLetter");
  });
});

describe("S2b-b: destination rail classes and INTERNAL row treatment", () => {
  function renderRow(overrides: Partial<OperationalCostLine> = {}): string {
    return renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={makeLine(overrides)}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
  }

  it("a PROVISIONAL row carries d-prov class", () => {
    expect(renderRow({ quoteDestination: "PROVISIONAL" })).toContain("d-prov");
  });

  it("an OPTION row carries d-option class", () => {
    expect(renderRow({ quoteDestination: "OPTION" })).toContain("d-option");
  });

  it("an INTERNAL row carries d-internal class, surface-subtle background and .55 opacity on non-control cells", () => {
    const html = renderRow({ quoteDestination: "INTERNAL" });
    expect(html).toContain("d-internal");
    expect(html).toContain("surface-subtle");
    expect(html).toContain("0.55");
  });

  it("an INTERNAL row shows the total struck through (1.5px) and the destNote", () => {
    const html = renderRow({ quoteDestination: "INTERNAL", lineTotalWithMarkup: 1100 });
    expect(html).toContain("line-through");
    expect(html).toContain("1.5px");
    expect(html).toContain("internal only");
    expect(html).toContain("exclnote");
  });

  it("a PROVISIONAL row shows provisional-sum note", () => {
    const html = renderRow({ quoteDestination: "PROVISIONAL", lineTotalWithMarkup: 500 });
    expect(html).toContain("provisional sum");
    expect(html).toContain("exclnote");
  });

  it("an OPTION row shows cost-option note", () => {
    const html = renderRow({ quoteDestination: "OPTION", lineTotalWithMarkup: 700 });
    expect(html).toContain("cost option");
    expect(html).toContain("exclnote");
  });

  it("a PRICE row shows no destNote", () => {
    const html = renderRow({ quoteDestination: "PRICE", lineTotalWithMarkup: 300 });
    expect(html).not.toContain("exclnote");
    expect(operationalDestNote("PRICE")).toBeNull();
  });

  it("operationalDestNote matches DESTINATION_NOTE from QuoteDestinationSelect", () => {
    expect(operationalDestNote("PROVISIONAL")).toBe(DESTINATION_NOTE.PROVISIONAL);
    expect(operationalDestNote("OPTION")).toBe(DESTINATION_NOTE.OPTION);
    expect(operationalDestNote("INTERNAL")).toBe(DESTINATION_NOTE.INTERNAL);
    expect(operationalDestNote("PRICE")).toBeNull();
  });
});

describe("S2b-b: PATCHes quoteDestination on change", () => {
  it("the source PATCHes { quoteDestination } when the destination select changes", () => {
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
      "utf-8"
    );
    expect(componentSource).toContain("quoteDestination: next");
  });

  it("the onPatch callback receives { quoteDestination } when the select fires", () => {
    // This is a source assertion rather than a live event (no jsdom).
    // The OperationalCostRow renders a QuoteDestinationSelect whose onChange
    // calls onPatch({ quoteDestination: next }). The test above pins the source.
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
      "utf-8"
    );
    expect(componentSource).toContain("onPatch({ quoteDestination: next })");
  });
});

describe("S2b-b: four-way money reporting for operational costs", () => {
  it("sorts lines into the correct pile by destination", () => {
    const lines: OperationalCostLine[] = [
      makeLine({ id: "l1", lineTotal: 100, lineTotalWithMarkup: 110, quoteDestination: "PRICE" }),
      makeLine({ id: "l2", lineTotal: 200, lineTotalWithMarkup: 220, quoteDestination: "PROVISIONAL" }),
      makeLine({ id: "l3", lineTotal: 300, lineTotalWithMarkup: 330, quoteDestination: "OPTION" }),
      makeLine({ id: "l4", lineTotal: 400, lineTotalWithMarkup: 440, quoteDestination: "INTERNAL" })
    ];
    const fw: OperationalFourWay = computeOperationalFourWay(lines);
    expect(fw.price.subtotal).toBe(100);
    expect(fw.price.withMarkup).toBe(110);
    expect(fw.provisional.subtotal).toBe(200);
    expect(fw.provisional.withMarkup).toBe(220);
    expect(fw.option.subtotal).toBe(300);
    expect(fw.option.withMarkup).toBe(330);
    expect(fw.internal.subtotal).toBe(400);
    expect(fw.internal.withMarkup).toBe(440);
  });

  it("defaults null/undefined quoteDestination to PRICE", () => {
    const lines: OperationalCostLine[] = [
      makeLine({ id: "d1", lineTotal: 100, lineTotalWithMarkup: 110, quoteDestination: null }),
      makeLine({ id: "d2", lineTotal: 50, lineTotalWithMarkup: 55, quoteDestination: undefined })
    ];
    const fw = computeOperationalFourWay(lines);
    expect(fw.price.subtotal).toBe(150);
    expect(fw.provisional.subtotal).toBe(0);
    expect(fw.option.subtotal).toBe(0);
    expect(fw.internal.subtotal).toBe(0);
  });

  it("a failed PATCH reverts (the container calls load() on error)", () => {
    // Source assertion: the patchLine catch block calls void load() to re-read
    // the server state, effectively reverting any optimistic change.
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
      "utf-8"
    );
    expect(componentSource).toContain("void load()");
  });

  it("does not set SCOPE_QUOTE_DESTINATION_UI_V1 (S2b-c's marker)", () => {
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
      "utf-8"
    );
    expect(componentSource).not.toContain("SCOPE_QUOTE_DESTINATION_UI_V1");
  });
});


// ── S3: per-line markup column ───────────────────────────────────────────

describe("S3: SCOPE_LINE_MARKUP_ALL_TYPES_V1 — per-line markup column in OtherOperationalCosts", () => {
  const componentSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
    "utf-8"
  );

  it("MARKUP column is present in COLUMNS", () => {
    expect(componentSource).toContain('"Markup"');
  });

  it("source does not contain computeWithMarkup (browser pricing removed)", () => {
    expect(componentSource).not.toContain("computeWithMarkup");
  });

  it("source does not price lines in the browser (* (1 +)", () => {
    expect(componentSource).not.toContain("* (1 +");
  });

  it("row total is server-computed lineTotalWithMarkup", () => {
    const line = makeLine({ lineTotalWithMarkup: 1250, lineTotal: 1000 });
    expect(rowLineTotalWithMarkup(line)).toBe(1250);
  });

  it("renders data-testid other-cost-markup for the markup cell", () => {
    const line = makeLine({ markupOverride: 25, effectiveMarkup: 25, lineTotalWithMarkup: 1250 });
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <OperationalCostRow
            line={line}
            index={0}
            rateOptions={[]}
            onPatch={() => undefined}
            onRemove={() => undefined}
          />
        </tbody>
      </table>
    );
    expect(html).toContain('data-testid="other-cost-markup"');
  });
});
