// SCOPE_OTHER_COSTS_V1 — tests for the "Other operational costs" section.
//
// The web workspace has no jsdom and no @testing-library (see
// discipline-summary-bar.test.tsx). Anything that is a claim about a NUMBER is
// tested against the exported pure helpers; anything that is a claim about the
// DOM — "the days input is disabled", "the revert control names the rate it
// returns to" — uses renderToStaticMarkup from react-dom/server, which needs
// no DOM. Anything that is a claim about STRUCTURE — "the section sits between
// the WBS table and Waste" — is asserted against the mount point's source,
// because with no renderer there is no other way to pin an ordering.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DURATION_BEARING_UNITS,
  OperationalCostRow,
  RateLibraryItemPicker,
  UNIT_OPTIONS,
  daysForUnit,
  isDurationBearingUnit,
  isRateOverridden,
  operationalLineTotal,
  resolveLineRate,
  sumOperationalLines,
  toNum,
  type OperationalCostLine,
  type RateLibraryItem
} from "../OtherOperationalCosts";
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
// 2. A lump-sum line cannot be given days, and totals rate x qty
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

  it("totals rate x qty — days is not a factor", () => {
    // 4 x $1,200 lump sum = $4,800, whatever days says.
    expect(operationalLineTotal(4, 1200, null)).toBe(4800);
    // The same line with a (pinned) 1 day and with an illegal 7 days would
    // price identically, because days is not in the formula at all.
    const line = makeLine({ unit: "Lump sum", qty: "4", days: "7", rate: "1200" });
    expect(
      operationalLineTotal(toNum(line.qty), toNum(line.rate), toNum(line.rateOverride))
    ).toBe(4800);
  });

  it("shows that total in the row's Total cell", () => {
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
    expect(html).toContain("$4,800.00");
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

  it("prices the line at the override once one is typed", () => {
    const line = makeLine({ qty: "2", rate: "375", rateOverride: "400", unit: "Ea" });
    expect(
      operationalLineTotal(toNum(line.qty), toNum(line.rate), toNum(line.rateOverride))
    ).toBe(800);
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
// 5. The money reconciles — one sum, two displays
// ───────────────────────────────────────────────────────────────────────

describe("the section total rolls into the card subtotal and the slice-1 bar", () => {
  // The production path, reproduced exactly:
  //   items          -> computeCardBarStats            (the ONE card-money fn)
  //   + section total-> statsByCard fold in ScopeCardsTab
  //   -> toCardRollupInput -> rollUpDiscipline         (the slice-1 bar)
  // Nothing here re-derives a card subtotal; the section only contributes its
  // own total to the existing fold.
  const items = [makeItem(12500, 12500, "i1"), makeItem(4000, 4000, "i2")];

  const sectionLines: OperationalCostLine[] = [
    makeLine({ id: "l1", description: "Traffic control", qty: "3", unit: "day", days: "1", rate: "850" }),
    makeLine({ id: "l2", description: "Site establishment fee", qty: "1", unit: "Lump sum", days: "1", rate: "1200" }),
    makeLine({ id: "l3", description: "Council permits", qty: "2", unit: "Ea", days: "1", rate: "375", rateOverride: "400" })
  ];

  const fold = (sectionTotal: number) => {
    const fromItems = computeCardBarStats(items);
    return {
      itemCount: fromItems.itemCount,
      subtotal: fromItems.subtotal + sectionTotal,
      subtotalWithMarkup: fromItems.subtotalWithMarkup + sectionTotal
    };
  };

  const barSubtotal = (sectionTotal: number) =>
    rollUpDiscipline([toCardRollupInput("card-1", null, fold(sectionTotal))]).subtotal;

  it("gives the three figures, and they reconcile", () => {
    const subtotalBefore = fold(0).subtotal;
    const sectionTotal = sumOperationalLines(sectionLines);
    const subtotalAfter = fold(sectionTotal).subtotal;

    // 1. Subtotal before      $16,500.00   (12,500 + 4,000 WBS items)
    // 2. Section total         $4,550.00   (2,550 + 1,200 + 800)
    // 3. Subtotal after       $21,050.00
    expect(subtotalBefore).toBe(16500);
    expect(sectionTotal).toBe(4550);
    expect(subtotalAfter).toBe(21050);
    expect(subtotalBefore + sectionTotal).toBe(subtotalAfter);
  });

  it("moves the slice-1 summary bar by exactly the same amount", () => {
    const sectionTotal = sumOperationalLines(sectionLines);
    expect(barSubtotal(0)).toBe(16500);
    expect(barSubtotal(sectionTotal)).toBe(21050);
    expect(barSubtotal(sectionTotal) - barSubtotal(0)).toBe(sectionTotal);
  });

  it("moves the card total and the bar by exactly the added line, when ONE line is added", () => {
    const twoLines = sectionLines.slice(0, 2);
    const before = sumOperationalLines(twoLines);
    const after = sumOperationalLines(sectionLines);
    const added = after - before;

    expect(before).toBe(3750);
    expect(added).toBe(800); // Council permits: 2 x $400 override
    expect(after).toBe(4550);

    expect(fold(after).subtotal - fold(before).subtotal).toBe(added);
    expect(barSubtotal(after) - barSubtotal(before)).toBe(added);
  });

  it("contributes nothing for an unpriceable line rather than NaN", () => {
    const total = sumOperationalLines([
      makeLine({ id: "x1", qty: null, rate: "100" }),
      makeLine({ id: "x2", qty: "2", rate: null, rateOverride: null })
    ]);
    expect(total).toBe(0);
    expect(Number.isNaN(total)).toBe(false);
  });

  it("has an empty section move nothing", () => {
    expect(sumOperationalLines([])).toBe(0);
    expect(fold(sumOperationalLines([])).subtotal).toBe(16500);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 6. Where the section sits, and what this slice did not touch
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
    expect(tabSource).toContain("subtotal: fromItems.subtotal + otherCosts");
    expect(tabSource).toContain("subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCosts");
  });

  it("carries the slice marker", () => {
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx"),
      "utf-8"
    );
    expect(componentSource).toContain("SCOPE_OTHER_COSTS_V1");
  });
});
