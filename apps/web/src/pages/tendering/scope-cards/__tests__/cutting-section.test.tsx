// SCOPE_CUTTING_V1 — tests for the "Cutting take-off" section.
//
// The web workspace has no jsdom and no @testing-library (see
// discipline-summary-bar.test.tsx and other-operational-costs.test.tsx).
// The house pattern is followed here:
//   - a claim about a NUMBER is tested against the exported pure helpers;
//   - a claim about the DOM — "a Roadsaw wall cut says so in words instead of
//     showing a price" — uses renderToStaticMarkup from react-dom/server,
//     which needs no DOM;
//   - a claim about STRUCTURE — "the section sits directly under Waste",
//     "the card total is summed in exactly one place" — is asserted against
//     the mount point's source, because with no renderer there is no other
//     way to pin an ordering.
//
// The load-bearing claim of this slice is NEGATIVE: the browser must not
// re-derive a cutting price. That is tested three ways below — the rendered
// figure is byte-for-byte the server's, the source carries no multiplication
// operator, and the rig-capability mirror is checked against the server
// function it mirrors.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CuttingTakeOff,
  CuttingTakeOffRowView,
  SAW_ELEVATIONS_BY_RIG,
  countCannotCut,
  countUnpriced,
  fmtCuttingMoney,
  rigCannotCut,
  sawCutTakeOff,
  sumCuttingTakeOff,
  takeOffRowState,
  takeOffRowTotal,
  type CuttingTakeOffRow
} from "../CuttingSection";
import { computeCardBarStats } from "../DisciplineSummaryBar";
import { sumOperationalLines, type OperationalCostLine } from "../OtherOperationalCosts";
import { rollUpDiscipline, toCardRollupInput } from "../utils/discipline-rollup";
import type { ScopeItem } from "../../ScopeQuantitiesTable";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../../${relFromRepoRoot}`, import.meta.url));

// ── Factories ───────────────────────────────────────────────────────────

function makeRow(overrides: Partial<CuttingTakeOffRow> = {}): CuttingTakeOffRow {
  return {
    id: "cut-1",
    wbsRef: "DEM1.1",
    description: "Slab saw cut",
    itemType: "saw-cut",
    equipment: "Demosaw",
    elevation: "Floor",
    material: "Concrete",
    depthMm: 150,
    quantityLm: "10",
    method: "Fuel",
    ratePerM: "40.00",
    lineTotal: "400.00",
    autoCopied: true,
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
    cuttingIncluded: true,
    plantItems: null,
    estimateItemId: null,
    provisionalAmount: null,
    lineTotal,
    lineTotalWithMarkup
  } as ScopeItem;
}

// The card's take-off as the server returns it. Every rate and every line
// total below is a FIGURE THE SERVER PRODUCED; nothing in the suite (and
// nothing in the component) derives one from the other.
//
// Row 2 is the #1437 regression in a single line: Demosaw at Wall is priced
// off the sheet's own wall row at $48.60/m, so 12.5 Lm is $607.50. The
// double-loaded figure the old x1.1 produced would be $668.25. The component
// prints whichever number the server sent, so it can only ever print $607.50.
const TAKE_OFF: CuttingTakeOffRow[] = [
  makeRow({
    id: "c1",
    wbsRef: "DEM1.1",
    description: "Roadsaw slab cut, carpark",
    equipment: "Roadsaw",
    elevation: "Floor",
    material: "Asphalt",
    method: "Fuel",
    depthMm: 200,
    quantityLm: "24",
    ratePerM: "36.00",
    lineTotal: "864.00"
  }),
  makeRow({
    id: "c2",
    wbsRef: "DEM1.2",
    description: "Demosaw wall penetration",
    equipment: "Demosaw",
    elevation: "Wall",
    material: "Concrete",
    method: "High-Freq",
    depthMm: 150,
    quantityLm: "12.5",
    ratePerM: "48.60",
    lineTotal: "607.50"
  }),
  makeRow({
    id: "c3",
    wbsRef: "DEM1.3",
    description: "Ringsaw wall cut",
    equipment: "Ringsaw",
    elevation: "Wall",
    material: "Concrete",
    method: "High-Freq",
    depthMm: 300,
    quantityLm: "8",
    ratePerM: "93.50",
    lineTotal: "748.00"
  }),
  // A wall cut asked of a Roadsaw. The server pins Roadsaw to Floor before it
  // resolves a rate, so the $216.00 it stored is a FLOOR price against a WALL
  // cut — a price that cannot be bought.
  makeRow({
    id: "c4",
    wbsRef: "DEM1.4",
    description: "Roadsaw wall cut",
    equipment: "Roadsaw",
    elevation: "Wall",
    material: "Concrete",
    method: "Fuel",
    depthMm: 250,
    quantityLm: "6",
    ratePerM: "36.00",
    lineTotal: "216.00"
  }),
  // Ticked for cutting and copied down, but no rig picked yet, so the server
  // has not priced it.
  makeRow({
    id: "c5",
    wbsRef: "DEM1.5",
    description: "Stair core wall, rig TBC",
    equipment: null,
    elevation: null,
    method: null,
    depthMm: 180,
    quantityLm: "4",
    ratePerM: null,
    lineTotal: null
  })
];

// ───────────────────────────────────────────────────────────────────────
// 1. What a rig can do mirrors the server, and is not a second rate rule
// ───────────────────────────────────────────────────────────────────────

describe("the rig capability table mirrors the server's, and prices nothing", () => {
  const serviceSource = readFileSync(
    repoFile("apps/api/src/modules/tendering/scope-redesign.service.ts"),
    "utf-8"
  );

  it("finds the server's saw-elevation rule (guards the check itself)", () => {
    expect(serviceSource).toContain("function sanitiseSawElevation");
  });

  it("agrees with the server that Roadsaw is floor-only", () => {
    // Server: `if (equipment === "Roadsaw") return "Floor";`
    expect(serviceSource).toMatch(/equipment === "Roadsaw"\)\s*return "Floor";/);
    expect(SAW_ELEVATIONS_BY_RIG.Roadsaw).toEqual(["Floor"]);
  });

  it("covers exactly the rigs the server knows, and no others", () => {
    // The server's per-equipment method allowlist is the rig roster.
    const block = /const METHODS_BY_EQUIPMENT[\s\S]*?\n};/.exec(serviceSource)?.[0] ?? "";
    expect(block).not.toBe("");
    const serverRigs = [...block.matchAll(/^\s+"?([A-Za-z-]+)"?:\s*new Set/gm)].map((m) => m[1]);
    expect(serverRigs.length).toBeGreaterThan(0);
    expect([...serverRigs].sort()).toEqual(Object.keys(SAW_ELEVATIONS_BY_RIG).sort());
  });

  it("names the impossible combination in words, and says which rig", () => {
    const reason = rigCannotCut("Roadsaw", "Wall");
    expect(reason).not.toBeNull();
    expect(reason).toContain("Roadsaw");
    expect(reason).toContain("Wall");
    expect(reason).toContain("floor-only");
  });

  it("lets every rig with wall rows cut a wall", () => {
    expect(rigCannotCut("Demosaw", "Wall")).toBeNull();
    expect(rigCannotCut("Ringsaw", "Wall")).toBeNull();
    expect(rigCannotCut("Flush-cut", "Wall")).toBeNull();
    expect(rigCannotCut("Tracksaw", "Wall")).toBeNull();
    expect(rigCannotCut("Roadsaw", "Floor")).toBeNull();
  });

  it("is default-permissive on the unknown — the server stays the authority", () => {
    expect(rigCannotCut(null, "Wall")).toBeNull();
    expect(rigCannotCut("Roadsaw", null)).toBeNull();
    expect(rigCannotCut("Wiresaw", "Wall")).toBeNull();
    expect(rigCannotCut("", "")).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────
// 2. A Roadsaw wall cut renders its cannot-cut state, not a price
// ───────────────────────────────────────────────────────────────────────

describe("a cut the rig cannot make", () => {
  const roadsawWall = TAKE_OFF[3];

  it("is classified cannot-cut even though the server stored a figure", () => {
    expect(roadsawWall.lineTotal).toBe("216.00");
    expect(takeOffRowState(roadsawWall)).toBe("cannot-cut");
  });

  it("renders the reason in words and NO price at all", () => {
    const html = renderToStaticMarkup(<CuttingTakeOffRowView row={roadsawWall} />);

    expect(html).toContain("cutting-row-cannot-cut");
    expect(html).toContain("Roadsaw cannot cut at Wall");
    expect(html).toContain("floor-only");

    // The unbuyable figure, and the rate behind it, appear nowhere.
    expect(html).not.toContain("216");
    expect(html).not.toContain("36.00");
    expect(html).not.toContain("cutting-row-total");
    expect(html).not.toContain("cutting-row-rate");
  });

  it("still shows the rig, elevation, depth and length that were asked for", () => {
    const html = renderToStaticMarkup(<CuttingTakeOffRowView row={roadsawWall} />);
    expect(html).toContain("Roadsaw");
    expect(html).toContain("Wall");
    expect(html).toContain("250");
    expect(html).toContain("DEM1.4");
  });

  it("contributes nothing to the section total", () => {
    expect(takeOffRowTotal(roadsawWall)).toBe(0);
  });

  it("is counted and called out under the table", () => {
    const html = renderToStaticMarkup(<CuttingTakeOff discipline="DEM" rows={TAKE_OFF} />);
    expect(countCannotCut(TAKE_OFF)).toBe(1);
    expect(html).toContain("cutting-section-cannot-cut-note");
    expect(html).toContain("add nothing to the card total");
  });

  it("does not swallow a legitimate Roadsaw floor cut", () => {
    const floor = TAKE_OFF[0];
    expect(takeOffRowState(floor)).toBe("priced");
    const html = renderToStaticMarkup(<CuttingTakeOffRowView row={floor} />);
    expect(html).toContain("cutting-row-total");
    expect(html).toContain("$864.00");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 3. Every figure is the server's, printed unchanged
// ───────────────────────────────────────────────────────────────────────

describe("the figures are the server's", () => {
  it("prints the Demosaw wall total the sheet's own wall row gives — not x1.1 of it", () => {
    const demosawWall = TAKE_OFF[1];
    const html = renderToStaticMarkup(<CuttingTakeOffRowView row={demosawWall} />);
    // The server's stored line total, byte for byte.
    expect(html).toContain("$607.50");
    expect(html).toContain("$48.60");
    // The double-loaded figures the pre-#1437 client arithmetic produced.
    expect(html).not.toContain("668.25");
    expect(html).not.toContain("53.46");
  });

  it("prints the Ringsaw wall total as stored — the premium is already in it", () => {
    const html = renderToStaticMarkup(<CuttingTakeOffRowView row={TAKE_OFF[2]} />);
    expect(html).toContain("$748.00");
    expect(html).toContain("$93.50");
    expect(html).not.toContain("822.80"); // 748.00 loaded a second time
  });

  it("shows an unpriced row as unpriced rather than as zero dollars", () => {
    const html = renderToStaticMarkup(<CuttingTakeOffRowView row={TAKE_OFF[4]} />);
    expect(takeOffRowState(TAKE_OFF[4])).toBe("unpriced");
    expect(html).toContain("cutting-row-unpriced");
    expect(html).toContain("pick a rig");
    expect(html).not.toContain("$0.00");
  });

  it("counts the rows still waiting on a rig", () => {
    expect(countUnpriced(TAKE_OFF)).toBe(1);
    const html = renderToStaticMarkup(<CuttingTakeOff discipline="DEM" rows={TAKE_OFF} />);
    expect(html).toContain("cutting-section-unpriced-note");
  });

  it("treats a non-numeric line total as unpriced rather than NaN", () => {
    const bad = makeRow({ id: "bad", lineTotal: "not-a-number" });
    expect(takeOffRowState(bad)).toBe("unpriced");
    expect(takeOffRowTotal(bad)).toBe(0);
    expect(Number.isNaN(sumCuttingTakeOff([bad]))).toBe(false);
  });

  it("shows the rig, method, depth and length the take-off carries", () => {
    const html = renderToStaticMarkup(<CuttingTakeOff discipline="DEM" rows={TAKE_OFF} />);
    for (const header of ["Rig", "Method", "Elevation", "Depth (mm)", "Length (Lm)", "Total"]) {
      expect(html).toContain(header);
    }
    expect(html).toContain("Demosaw");
    expect(html).toContain("High-Freq");
    expect(html).toContain("12.5");
  });

  it("lists only the saw-cut rows the Cutting? tick produces", () => {
    const mixed = [
      ...TAKE_OFF,
      makeRow({ id: "core", itemType: "core-hole", lineTotal: "999.00" }),
      makeRow({ id: "other", itemType: "other-rate", lineTotal: "111.00" })
    ];
    expect(sawCutTakeOff(mixed).map((r) => r.id)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
    const html = renderToStaticMarkup(<CuttingTakeOff discipline="DEM" rows={mixed} />);
    expect(html).not.toContain("$999.00");
    expect(html).not.toContain("$111.00");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 4. Asbestos cards never cut
// ───────────────────────────────────────────────────────────────────────

describe("the discipline gate", () => {
  it("renders nothing at all on an asbestos card", () => {
    const html = renderToStaticMarkup(<CuttingTakeOff discipline="ASB" rows={TAKE_OFF} />);
    expect(html).toBe("");
  });

  it("renders the section on demolition, civil and Other", () => {
    for (const discipline of ["DEM", "CIV", "Other"] as const) {
      const html = renderToStaticMarkup(<CuttingTakeOff discipline={discipline} rows={TAKE_OFF} />);
      expect(html).toContain("scope-cutting-section");
      expect(html).toContain("Cutting take-off");
    }
  });

  it("does not collide with the cutting sheet's own heading", () => {
    // WHAT BROKE `tendering-e2e` ON #1682. ScopeCuttingSheet renders a heading
    // reading exactly "Concrete cutting"; this section used to as well, so
    // `getByText("Concrete cutting")` resolved to two elements on every
    // non-ASB card. Playwright's getByText is SUBSTRING matching by default,
    // so "Concrete cutting take-off" would not have fixed it either — the
    // phrase must not appear in this section's markup at all.
    //
    // Asserted on the rendered markup, not on the source, because an
    // aria-label or a title attribute collides just as an <h3> does.
    const html = renderToStaticMarkup(<CuttingTakeOff discipline="DEM" rows={TAKE_OFF} />);
    expect(html).not.toContain("Concrete cutting");
    expect(html).toContain("Cutting take-off");
  });

  it("still collides with nothing when the take-off is empty or erroring", () => {
    for (const props of [
      { rows: [] },
      { rows: TAKE_OFF, loading: true },
      { rows: TAKE_OFF, error: "boom" }
    ]) {
      const html = renderToStaticMarkup(<CuttingTakeOff discipline="DEM" {...props} />);
      expect(html).not.toContain("Concrete cutting");
    }
  });

  it("keeps the phrase the sheet owns on the sheet, and off this section", () => {
    // The sheet below is untouched by this slice and keeps its name; that is
    // what makes this section's name have to differ.
    const sheetSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/ScopeCuttingSheet.tsx"),
      "utf-8"
    );
    expect(sheetSource).toContain("Concrete cutting");
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx"),
      "utf-8"
    );
    // Only prose may mention it — never a rendered string.
    const renderedStrings = componentSource
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));
    expect(renderedStrings.join("\n")).not.toContain("Concrete cutting");
  });

  it("asks showsCuttingColumn and states no discipline code of its own", () => {
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx"),
      "utf-8"
    );
    expect(componentSource).toContain("showsCuttingColumn");
    // Not a second predicate: the literal is written nowhere in this file.
    expect(componentSource).not.toMatch(/!==\s*"ASB"/);
    expect(componentSource).not.toMatch(/===\s*"ASB"/);
  });

  it("leaves no discipline literal behind at the mount point either", () => {
    const tabSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
      "utf-8"
    );
    expect(tabSource).not.toMatch(/discipline\s*!==\s*"ASB"/);
    expect(tabSource).toContain("showsCuttingColumn(card.discipline as TableDiscipline)");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 5. No arithmetic on a rate — a scan of the component's own source
// ───────────────────────────────────────────────────────────────────────

describe("the browser does not re-derive a cutting price", () => {
  const componentPath = "apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx";
  const raw = readFileSync(repoFile(componentPath), "utf-8");
  // Strip block comments then line comments, so the scan below sees CODE only
  // and is not satisfied (or tripped) by prose.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("strips comments and still has the component's code (guards the scan)", () => {
    expect(code).toContain("export function sumCuttingTakeOff");
    expect(code).toContain("export function rigCannotCut");
    expect(code.length).toBeGreaterThan(1000);
  });

  it("contains no multiplication operator anywhere in its code", () => {
    // A multiplier applied in TypeScript is exactly the #1437 defect. There is
    // no `*` left in this file once comments are gone.
    expect(code).not.toContain("*");
  });

  it("names no rate multiplier and no rate constant", () => {
    expect(code).not.toMatch(/[Mm]ultiplier/);
    expect(code).not.toContain("1.25");
    expect(code).not.toContain("1.1");
    expect(code).not.toContain("2.0");
    // No rate table, no rig row re-selection.
    expect(code).not.toMatch(/RATE|rateRow|baseRate|finalRate/);
  });

  it("never puts a rate on either side of an operator", () => {
    for (const line of code.split("\n")) {
      if (!/ratePerM|lineTotal|ratePerHole/.test(line)) continue;
      // Assignment, property access, comparison and formatting only — never
      // an additive or multiplicative operator applied to the value itself.
      expect(line).not.toMatch(/(ratePerM|ratePerHole)\s*[+\-*/]/);
      expect(line).not.toMatch(/[+\-*/]\s*(row\.)?(ratePerM|ratePerHole)/);
    }
  });

  it("adds only server line totals, and only in the section fold", () => {
    // `sum + takeOffRowTotal(row)` is the single additive expression, and
    // takeOffRowTotal returns the server's own lineTotal or zero.
    expect(code).toContain("sum + takeOffRowTotal(row)");
    const additions = code.match(/\+(?!\+)/g) ?? [];
    expect(additions.length).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 6. The money reconciles — one sum, two displays
// ───────────────────────────────────────────────────────────────────────

describe("the section total rolls into the card subtotal and the slice-1 bar", () => {
  // The production path, reproduced exactly:
  //   items           -> computeCardBarStats            (the ONE card-money fn)
  //   + other costs   -> statsByCard fold in ScopeCardsTab   (slice 6, #1681)
  //   + cutting       -> the SAME fold                       (this slice)
  //   -> toCardRollupInput -> rollUpDiscipline           (the slice-1 bar)
  const items = [makeItem(12500, 12500, "i1"), makeItem(4000, 4000, "i2")];

  const otherCostLines: OperationalCostLine[] = [
    {
      id: "l1",
      cardId: "card-1",
      description: "Traffic control",
      qty: "3",
      unit: "day",
      days: "1",
      rate: "850",
      rateOverride: null,
      plantRateId: null,
      sortOrder: 0
    },
    {
      id: "l2",
      cardId: "card-1",
      description: "Site establishment fee",
      qty: "1",
      unit: "Lump sum",
      days: "1",
      rate: "1200",
      rateOverride: null,
      plantRateId: null,
      sortOrder: 1
    },
    {
      id: "l3",
      cardId: "card-1",
      description: "Council permits",
      qty: "2",
      unit: "Ea",
      days: "1",
      rate: "375",
      rateOverride: "400",
      plantRateId: null,
      sortOrder: 2
    }
  ];

  // Waste does not report a section total to the fold on main — ScopeWasteTab
  // is mounted with no total callback, and slice 8 is the slice that gives it
  // one. Its contribution to the card subtotal today is therefore exactly
  // zero, and that is asserted below rather than assumed.
  const WASTE_CONTRIBUTION = 0;

  const fold = (otherCosts: number, cutting: number) => {
    const fromItems = computeCardBarStats(items);
    return {
      itemCount: fromItems.itemCount,
      subtotal: fromItems.subtotal + otherCosts + cutting,
      subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCosts + cutting
    };
  };

  const barSubtotal = (otherCosts: number, cutting: number) =>
    rollUpDiscipline([toCardRollupInput("card-1", null, fold(otherCosts, cutting))]).subtotal;

  it("gives the five figures, and they reconcile exactly", () => {
    const wbsTotal = computeCardBarStats(items).subtotal;
    const otherCostsTotal = sumOperationalLines(otherCostLines);
    const wasteTotal = WASTE_CONTRIBUTION;
    const cuttingTotal = sumCuttingTakeOff(sawCutTakeOff(TAKE_OFF));
    const cardSubtotal = fold(otherCostsTotal, cuttingTotal).subtotal;

    // 1. WBS items          $16,500.00   (12,500 + 4,000)
    // 2. Other op. costs     $4,550.00   (2,550 + 1,200 + 800)
    // 3. Waste                   $0.00   (not folded until slice 8)
    // 4. Cutting take-off    $2,219.50   (864.00 + 607.50 + 748.00)
    // 5. Card subtotal      $23,269.50
    expect(wbsTotal).toBe(16500);
    expect(otherCostsTotal).toBe(4550);
    expect(wasteTotal).toBe(0);
    expect(cuttingTotal).toBe(2219.5);
    expect(cardSubtotal).toBe(23269.5);

    expect(wbsTotal + otherCostsTotal + wasteTotal + cuttingTotal).toBe(cardSubtotal);
    expect(fmtCuttingMoney(cardSubtotal)).toBe("$23,269.50");
  });

  it("pins the waste contribution at zero, from the mount point itself", () => {
    const tabSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
      "utf-8"
    );
    // Waste is mounted without any section-total callback, so nothing waste
    // reports can reach the fold. When slice 8 gives it one, this assertion
    // fails and the five figures above are restated with a real waste number.
    const wasteMount = /<ScopeWasteTab[\s\S]*?\/>/.exec(tabSource)?.[0] ?? "";
    expect(wasteMount).not.toBe("");
    expect(wasteMount).not.toContain("onSectionTotalChange");
    expect(wasteMount).not.toContain("TotalChange");
  });

  it("moves the slice-1 summary bar by exactly the cutting total", () => {
    const otherCostsTotal = sumOperationalLines(otherCostLines);
    const cuttingTotal = sumCuttingTakeOff(sawCutTakeOff(TAKE_OFF));
    expect(barSubtotal(otherCostsTotal, 0)).toBe(21050);
    expect(barSubtotal(otherCostsTotal, cuttingTotal)).toBe(23269.5);
    expect(barSubtotal(otherCostsTotal, cuttingTotal) - barSubtotal(otherCostsTotal, 0)).toBe(
      cuttingTotal
    );
  });

  it("leaves slice 6's figures untouched when the card has no cutting", () => {
    const otherCostsTotal = sumOperationalLines(otherCostLines);
    expect(sumCuttingTakeOff([])).toBe(0);
    expect(fold(otherCostsTotal, sumCuttingTakeOff([])).subtotal).toBe(21050);
  });

  it("moves the card total and the bar by exactly one row, when one is added", () => {
    const before = sumCuttingTakeOff(sawCutTakeOff(TAKE_OFF.slice(0, 2)));
    const after = sumCuttingTakeOff(sawCutTakeOff(TAKE_OFF.slice(0, 3)));
    expect(before).toBe(1471.5);
    expect(after - before).toBe(748); // the Ringsaw wall row, at the server's figure
    expect(fold(0, after).subtotal - fold(0, before).subtotal).toBe(after - before);
    expect(barSubtotal(0, after) - barSubtotal(0, before)).toBe(after - before);
  });

  it("shows the same section total in the section heading as it folds", () => {
    const cuttingTotal = sumCuttingTakeOff(sawCutTakeOff(TAKE_OFF));
    const html = renderToStaticMarkup(<CuttingTakeOff discipline="DEM" rows={TAKE_OFF} />);
    expect(html).toContain("cutting-section-total");
    expect(html).toContain(fmtCuttingMoney(cuttingTotal));
    expect(fmtCuttingMoney(cuttingTotal)).toBe("$2,219.50");
  });

  it("renders an empty take-off as empty, not as a zero-dollar row", () => {
    const html = renderToStaticMarkup(<CuttingTakeOff discipline="DEM" rows={[]} />);
    expect(html).toContain("cutting-section-empty");
    expect(html).toContain("Nothing ticked for cutting on this card yet.");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 7. Where the section sits, and the one place card money is computed
// ───────────────────────────────────────────────────────────────────────

describe("the mount point", () => {
  const tabSource = readFileSync(
    repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
    "utf-8"
  );

  it("mounts the section directly under Waste, per the mock-up's order", () => {
    const wbsTable = tabSource.indexOf("<ScopeQuantitiesTable");
    const otherCosts = tabSource.indexOf("<OtherOperationalCosts");
    const waste = tabSource.indexOf("<ScopeWasteTab");
    const cuttingSection = tabSource.indexOf("<CuttingSection");
    const cuttingSheet = tabSource.indexOf("<ScopeCuttingSheet");

    for (const i of [wbsTable, otherCosts, waste, cuttingSection, cuttingSheet]) {
      expect(i).toBeGreaterThan(-1);
    }

    // WBS items -> Other operational costs -> Waste -> Concrete cutting
    expect(wbsTable).toBeLessThan(otherCosts);
    expect(otherCosts).toBeLessThan(waste);
    expect(waste).toBeLessThan(cuttingSection);
    // The take-off heads the cutting area; the editable Cutrite sheet the
    // estimator picks rigs in stays where it was, directly below it.
    expect(cuttingSection).toBeLessThan(cuttingSheet);
  });

  it("folds the cutting total into the ONE place card money is computed", () => {
    // The guarantee slice 6 pinned, now extended to cover this section: a
    // second call site is how the card total and the discipline bar start
    // disagreeing about what a card is worth.
    const calls = tabSource.match(/computeCardBarStats\(/g) ?? [];
    expect(calls.length).toBe(1);
    expect(tabSource).toContain("subtotal: fromItems.subtotal + otherCosts + cutting");
    expect(tabSource).toContain(
      "subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCosts + cutting"
    );
  });

  it("keeps the section's total on the single upward-reporting path", () => {
    // The section reports its total; the tab folds it. There is exactly one
    // place the cutting figure enters card money.
    expect(tabSource).toContain("onSectionTotalChange={onCuttingTotalChange}");
    const folds = tabSource.match(/cuttingTotals\[card\.id\]/g) ?? [];
    expect(folds.length).toBe(1);
  });

  it("adds no API call the card did not already make", () => {
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx"),
      "utf-8"
    );
    const sheetSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/ScopeCuttingSheet.tsx"),
      "utf-8"
    );
    // The one endpoint this section reads is the one the card already fetches
    // through the cutting sheet below it, and it is read-only.
    expect(componentSource).toContain("scope/cutting-items?cardId=");
    expect(sheetSource).toContain("scope/cutting-items?cardId=");
    expect(componentSource).not.toMatch(/method:\s*"(POST|PATCH|PUT|DELETE)"/);
  });

  it("carries the slice marker", () => {
    const componentSource = readFileSync(
      repoFile("apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx"),
      "utf-8"
    );
    expect(componentSource).toContain("SCOPE_CUTTING_V1");
  });
});
