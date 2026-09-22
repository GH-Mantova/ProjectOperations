// SCOPE_WASTE_SECTION_V1 — tests for the rebuilt "Waste" section.
//
// The web workspace has no jsdom and no @testing-library (see
// scope-cards/__tests__/cutting-section.test.tsx, which this file follows).
// The house pattern:
//   - a claim about a NUMBER or a STRING is tested against the exported pure
//     helpers;
//   - a claim about the DOM — "the collapsed section still shows the line
//     count and both money figures" — uses renderToStaticMarkup from
//     react-dom/server, which needs no DOM;
//   - a claim about STRUCTURE — "Waste sits after Other operational costs and
//     before Cutting", "nothing waste computes reaches the card fold" — is
//     asserted against the mount point's SOURCE, because with no renderer
//     there is no other way to pin an ordering;
//   - a claim about SERVER BEHAVIOUR that the UI depends on — "pressing Sum
//     from items above twice does not double the tonnage" — is asserted
//     against the server source that owns it, and any mirror of that
//     behaviour in this file is checked against that source rather than
//     trusted.
//
// The load-bearing claim of this slice is NEGATIVE, and it is the one the
// prompt asks for two figures on: the card subtotal is IDENTICAL before and
// after this slice. Waste is already priced — on the server, as its own
// independently marked-up stream inside `tenderPrice` — so folding it into
// the card bar as well would put it inside the very total the server says it
// must stay out of. That is pinned four ways in section 5 below.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SCOPE_WASTE_SECTION_V1,
  WasteSectionSummary,
  fmtWasteMoney,
  sumWasteLineTotals,
  wasteFourWay,
  wasteLineCountPhrase,
  wasteMarkupPhrase,
  type WasteFourWay
} from "../ScopeWasteTab";
import { DESTINATION_NOTE } from "../scope-cards/QuoteDestinationSelect";
import { computeCardBarStats } from "../scope-cards/DisciplineSummaryBar";
import type { OperationalCostLine } from "../scope-cards/OtherOperationalCosts";

/**
 * SCOPE_OPERATIONAL_COSTS_PRICED_V1 — the section now reports two figures.
 * This local sum reproduces the pre-S1 `qty * (rateOverride ?? rate)`
 * arithmetic so this file's fixtures (which carry no server `lineTotal`)
 * still price the way the assertions were built to expect.
 */
function sumOperationalLines(lines: OperationalCostLine[]): number {
  return lines.reduce((acc, line) => {
    if (line.lineTotal != null && Number.isFinite(Number(line.lineTotal))) {
      return acc + Number(line.lineTotal);
    }
    const qty = line.qty == null || line.qty === "" ? null : Number(line.qty);
    const rate = line.rateOverride != null && line.rateOverride !== ""
      ? Number(line.rateOverride)
      : (line.rate == null || line.rate === "" ? null : Number(line.rate));
    if (qty === null || rate === null || !Number.isFinite(qty) || !Number.isFinite(rate)) {
      return acc;
    }
    return acc + qty * rate;
  }, 0);
}
import { rollUpDiscipline, toCardRollupInput } from "../scope-cards/utils/discipline-rollup";
import type { ScopeItem } from "../ScopeQuantitiesTable";

const repoFile = (relFromRepoRoot: string): string =>
  fileURLToPath(new URL(`../../../../../../${relFromRepoRoot}`, import.meta.url));

const wasteSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/ScopeWasteTab.tsx"),
  "utf-8"
);
const tabSource = readFileSync(
  repoFile("apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx"),
  "utf-8"
);
const serverWasteSource = readFileSync(
  repoFile("apps/api/src/modules/tendering/scope-waste.service.ts"),
  "utf-8"
);
const serverSummarySource = readFileSync(
  repoFile("apps/api/src/modules/tendering/scope-redesign.service.ts"),
  "utf-8"
);

// ── Factories ───────────────────────────────────────────────────────────

type Line = { id: string; lineTotal: string | null; autoSummed: boolean; qty: string | null };

/** A hand-typed waste line: autoSummed=false, the flag the server's delete
 *  filter excludes. */
function manualLine(overrides: Partial<Line> = {}): Line {
  return { id: "manual-1", lineTotal: "450.00", autoSummed: false, qty: "3", ...overrides };
}

/** A line the aggregator produced: autoSummed=true, regenerable. */
function autoLine(overrides: Partial<Line> = {}): Line {
  return { id: "auto-1", lineTotal: "800.00", autoSummed: true, qty: "10", ...overrides };
}

// ───────────────────────────────────────────────────────────────────────
// 1. The summary a collapsed section still has to be readable by
// ───────────────────────────────────────────────────────────────────────

describe("the collapsed summary", () => {
  it("counts lines in words, not in digits-and-a-noun", () => {
    // "A card that disposes of nothing should be one folded line" — and it
    // should say so in words rather than "(0 rows)".
    expect(wasteLineCountPhrase(0)).toBe("no lines");
    expect(wasteLineCountPhrase(1)).toBe("1 line");
    expect(wasteLineCountPhrase(4)).toBe("4 lines");
    // Defensive: a negative or non-finite count is "no lines", never "-1 lines".
    expect(wasteLineCountPhrase(-1)).toBe("no lines");
    expect(wasteLineCountPhrase(Number.NaN)).toBe("no lines");
  });

  it("names the markup rate actually in force — override first, tender second", () => {
    expect(wasteMarkupPhrase(null, 30)).toBe("+ 30% markup");
    expect(wasteMarkupPhrase(10, 30)).toBe("+ 10% markup");
    // A stored 0 is a real 0% override, not an absence. `??`, never `||`.
    expect(wasteMarkupPhrase(0, 30)).toBe("+ 0% markup");
    expect(wasteMarkupPhrase(undefined, 30)).toBe("+ 30% markup");
  });

  it("sums the SERVER's line totals and nothing else", () => {
    expect(sumWasteLineTotals([autoLine(), manualLine()])).toBe(1250);
    // A line the server has not priced yet contributes nothing, and does not
    // poison the sum with NaN.
    expect(sumWasteLineTotals([autoLine(), { ...manualLine(), lineTotal: null }])).toBe(800);
    expect(sumWasteLineTotals([{ ...autoLine(), lineTotal: "not-a-number" }])).toBe(0);
    expect(sumWasteLineTotals([])).toBe(0);
  });

  it("shows the line count and BOTH money figures while collapsed", () => {
    const lines = [autoLine(), manualLine()];
    const subtotal = sumWasteLineTotals(lines);
    // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (S3): withMarkup is now server-supplied —
    // the component renders `withMarkup ?? subtotal` and never computes it.
    // The test must supply withMarkup explicitly (1250 * 1.30 = 1625).
    const withMarkup = 1625;
    const html = renderToStaticMarkup(
      <WasteSectionSummary
        discipline="DEM"
        lineCount={lines.length}
        subtotal={subtotal}
        withMarkup={withMarkup}
        sectionMarkupOverride={null}
        tenderMarkup={30}
        collapsed
      />
    );
    // Line count, in words.
    expect(html).toContain("2 lines");
    // Both money figures: the subtotal and the marked-up figure.
    expect(html).toContain(fmtWasteMoney(1250)); // $1,250.00
    expect(html).toContain(fmtWasteMoney(1625)); // $1,250.00 + 30%
    expect(html).toContain("+ 30% markup");
    // And the section is still identifiable while shut.
    expect(html).toContain("DEM — Waste disposal");
  });

  it("shows exactly the same figures while open — the summary does not move", () => {
    const lines = [autoLine(), manualLine()];
    // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (S3): withMarkup is server-supplied.
    const props = {
      discipline: "DEM",
      lineCount: lines.length,
      subtotal: sumWasteLineTotals(lines),
      withMarkup: 1625,
      sectionMarkupOverride: null,
      tenderMarkup: 30
    };
    const closed = renderToStaticMarkup(<WasteSectionSummary {...props} collapsed />);
    const open = renderToStaticMarkup(<WasteSectionSummary {...props} collapsed={false} />);
    for (const fragment of ["2 lines", fmtWasteMoney(1250), fmtWasteMoney(1625), "+ 30% markup"]) {
      expect(closed).toContain(fragment);
      expect(open).toContain(fragment);
    }
  });

  it("folds a card that disposes of nothing down to 'no lines' and two zeroes", () => {
    const html = renderToStaticMarkup(
      <WasteSectionSummary
        discipline="ASB"
        lineCount={0}
        subtotal={0}
        sectionMarkupOverride={null}
        tenderMarkup={30}
        collapsed
      />
    );
    expect(html).toContain("no lines");
    expect(html).toContain(fmtWasteMoney(0));
  });
});

// ───────────────────────────────────────────────────────────────────────
// 2. Fold and unfold
// ───────────────────────────────────────────────────────────────────────

describe("fold and unfold", () => {
  const render = (collapsed: boolean) =>
    renderToStaticMarkup(
      <WasteSectionSummary
        discipline="DEM"
        lineCount={1}
        subtotal={800}
        sectionMarkupOverride={null}
        tenderMarkup={30}
        collapsed={collapsed}
      />
    );

  it("carries the fold state on the caret, for a screen reader as well as an eye", () => {
    const closed = render(true);
    const open = render(false);

    expect(closed).toContain('aria-expanded="false"');
    expect(open).toContain('aria-expanded="true"');

    // The caret glyph flips with it.
    expect(closed).toContain("▸");
    expect(open).toContain("▾");

    // And the label says which way the click goes.
    expect(closed).toContain("Expand waste section");
    expect(open).toContain("Collapse waste section");
  });

  it("gates the section BODY on the fold, and never the summary", () => {
    // With no renderer for the auth-bound container, the fold is pinned at
    // the source: the summary is rendered unconditionally, the body sits
    // behind `collapsed ? null : (...)`.
    expect(wasteSource).toContain("<WasteSectionSummary");
    expect(wasteSource).toContain("{collapsed ? null : (");
    expect(wasteSource).toContain('id="waste-section-body"');
    // The summary is NOT inside the collapsed guard: it appears before it.
    const summaryAt = wasteSource.indexOf("<WasteSectionSummary");
    const guardAt = wasteSource.indexOf("{collapsed ? null : (");
    expect(summaryAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(summaryAt);
  });

  it("marks the component with the slice's plant constant", () => {
    expect(SCOPE_WASTE_SECTION_V1).toBe("SCOPE_WASTE_SECTION_V1");
    expect(wasteSource).toContain("SCOPE_WASTE_SECTION_V1");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 3. Summing from the items above
// ───────────────────────────────────────────────────────────────────────
//
// The aggregation itself is the server's (POST .../waste/sum-from-above ->
// ScopeWasteService.sumFromAbove). The UI's only job is to call it and
// re-read. What the estimator is promised — "additive and non-destructive,
// and running it twice must not double the tonnage" — is therefore a claim
// about the server, and it is pinned against the server's source here rather
// than assumed.

/**
 * Mirror of the server's replace-semantics, used only to demonstrate the
 * consequence for a row set. The contract it mirrors is asserted directly
 * against scope-waste.service.ts in the tests below, so this helper cannot
 * drift into being its own truth.
 *
 * Server contract, verbatim from the transaction:
 *   deleteMany({ where: { tenderId, cardId, autoSummed: true } })
 *   then create() one row per (wasteGroup, wasteItem) group.
 */
function applySumFromAbove(existing: Line[], freshlyAggregated: Line[]): Line[] {
  const survivors = existing.filter((l) => !l.autoSummed); // delete filter misses these
  return [...survivors, ...freshlyAggregated];
}

describe("Sum from items above", () => {
  // Two measurements ticked Waste? on the card aggregate to one line.
  const aggregated = (): Line[] => [
    { id: "auto-rubble", lineTotal: "960.00", autoSummed: true, qty: "12" }
  ];

  it("creates waste lines from the measurements ticked above", () => {
    const after = applySumFromAbove([], aggregated());
    expect(after).toHaveLength(1);
    expect(after[0].autoSummed).toBe(true);
    expect(sumWasteLineTotals(after)).toBe(960);
  });

  it("summing TWICE gives the same total — it replaces, it does not append", () => {
    const first = applySumFromAbove([], aggregated());
    const second = applySumFromAbove(first, aggregated());

    // The count does not grow...
    expect(second).toHaveLength(first.length);
    // ...the tonnage does not double...
    expect(second.reduce((s, l) => s + Number(l.qty ?? 0), 0)).toBe(
      first.reduce((s, l) => s + Number(l.qty ?? 0), 0)
    );
    // ...and neither does the money.
    expect(sumWasteLineTotals(second)).toBe(sumWasteLineTotals(first));
    expect(sumWasteLineTotals(second)).toBe(960);

    // A third press is still the same. Idempotent, not merely "twice is ok".
    const third = applySumFromAbove(second, aggregated());
    expect(sumWasteLineTotals(third)).toBe(960);
    expect(third).toHaveLength(1);
  });

  it("a hand-typed line survives a sum, with its money intact", () => {
    const typed = manualLine({ id: "typed-by-hand", lineTotal: "450.00", qty: "3" });
    const before = [typed];

    const after = applySumFromAbove(before, aggregated());

    // The hand-typed line is still there, unchanged.
    const survivor = after.find((l) => l.id === "typed-by-hand");
    expect(survivor).toBeDefined();
    expect(survivor).toEqual(typed);

    // And the section total is the hand-typed line PLUS the summed one.
    expect(sumWasteLineTotals(after)).toBe(1410);

    // Summing again still leaves it alone and still does not double anything.
    const twice = applySumFromAbove(after, aggregated());
    expect(twice.find((l) => l.id === "typed-by-hand")).toEqual(typed);
    expect(sumWasteLineTotals(twice)).toBe(1410);
  });

  it("pins the replace-semantics against the server that owns them", () => {
    // The mirror above is only honest if the server really does delete the
    // auto-summed rows before recreating them. If this ever becomes an
    // upsert or an append, this assertion fails and the mirror is retired.
    expect(serverWasteSource).toContain("deleteMany({");
    expect(serverWasteSource).toContain("where: { tenderId, cardId, autoSummed: true }");
    // Delete and create are in ONE transaction, so a failed regeneration
    // cannot leave the card with no waste lines at all.
    const txAt = serverWasteSource.indexOf("this.prisma.$transaction(async (tx) => {");
    const deleteAt = serverWasteSource.indexOf("tx.scopeWasteItem.deleteMany");
    const createAt = serverWasteSource.indexOf("tx.scopeWasteItem.create");
    expect(txAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(txAt);
    expect(createAt).toBeGreaterThan(deleteAt);
  });

  it("calls the server for the sum and re-reads — it does not aggregate locally", () => {
    expect(wasteSource).toContain("/waste/sum-from-above");
    // The handler posts and then re-loads; no client-side grouping of
    // measurements, and no client-side pricing of the result.
    const handler = /const sumFromAbove = async \(\) => \{[\s\S]*?\n  \};/.exec(wasteSource)?.[0] ?? "";
    expect(handler).not.toBe("");
    expect(handler).toContain('method: "POST"');
    expect(handler).toContain("await load()");
    // No arithmetic operator on money in the handler.
    expect(handler).not.toMatch(/ratePerTonne|lineTotal\s*[*+]/);
  });

  it("tells the estimator what the second press does, where the button is", () => {
    // "it appends again" would be a defect; the copy must not imply it.
    expect(wasteSource).toContain("⇩ Sum from items above");
    expect(wasteSource).toContain("+ add a waste line");
    expect(wasteSource).toMatch(/does not add to them|it does not append/i);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 4. Where the section sits inside the card
// ───────────────────────────────────────────────────────────────────────

describe("the mount point", () => {
  it("keeps the mock-up's fixed order: WBS -> Other costs -> Waste -> Cutting", () => {
    // CUTTING_ONE_SURFACE_V1 (scopecards-s6): CuttingSection is gone.
    // ScopeCuttingSheet is the only cutting surface and sits directly under Waste.
    const wbsTable = tabSource.indexOf("<ScopeQuantitiesTable");
    const otherCosts = tabSource.indexOf("<OtherOperationalCosts");
    const waste = tabSource.indexOf("<ScopeWasteTab");
    const cuttingSheet = tabSource.indexOf("<ScopeCuttingSheet");

    for (const i of [wbsTable, otherCosts, waste, cuttingSheet]) {
      expect(i).toBeGreaterThan(-1);
    }

    expect(wbsTable).toBeLessThan(otherCosts);
    expect(otherCosts).toBeLessThan(waste); // Waste AFTER Other operational costs
    expect(waste).toBeLessThan(cuttingSheet); // and BEFORE Cutting (one surface only)

    // CuttingSection is gone — verify this so the test is not accidentally
    // passing because we have two surfaces again.
    expect(tabSource).not.toContain("<CuttingSection");
  });
});

// ───────────────────────────────────────────────────────────────────────
// 5. The card subtotal does not move — the load-bearing negative claim
// ───────────────────────────────────────────────────────────────────────
//
// Waste is ALREADY priced. Not in the card bar, but in the tender price, on
// the server, as its own independently marked-up cost stream. Wiring it into
// the card fold as well would put it inside the scope-discipline total the
// server explicitly keeps it out of, and would apply the scope markup chain
// to money that already carries its own section rate.

describe("the card subtotal, before and after this slice", () => {
  const items = [
    {
      id: "i1",
      status: "included",
      lineTotal: "12500",
      lineTotalWithMarkup: "16250"
    },
    {
      id: "i2",
      status: "included",
      lineTotal: "4000",
      lineTotalWithMarkup: "5200"
    }
  ] as unknown as ScopeItem[];

  const otherCostLines = [
    {
      id: "l1",
      cardId: "card-1",
      description: "Traffic control",
      qty: "3",
      unit: "Day",
      days: "1",
      rate: "850",
      rateOverride: null,
      plantRateId: null,
      sortOrder: 0
    }
  ];

  // A card that DOES dispose of something — the case the prompt asks about.
  const wasteLines = [autoLine({ lineTotal: "960.00" }), manualLine({ lineTotal: "450.00" })];

  /** The fold exactly as ScopeCardsTab computes it: items + other costs +
   *  cutting. There is no waste term, before this slice or after it. */
  const fold = (otherCosts: number, cutting: number) => {
    const fromItems = computeCardBarStats(items);
    return {
      itemCount: fromItems.itemCount,
      subtotal: fromItems.subtotal + otherCosts + cutting,
      subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCosts + cutting
    };
  };

  it("gives the two figures the prompt asks for, and they are identical", () => {
    const otherCostsTotal = sumOperationalLines(otherCostLines);
    const cuttingTotal = 2219.5;

    // This card has real waste on it: two lines, $1,410.00 of disposal.
    expect(sumWasteLineTotals(wasteLines)).toBe(1410);
    expect(wasteLines).toHaveLength(2);

    // BEFORE this slice: waste contributes nothing to the card bar.
    const subtotalBefore = fold(otherCostsTotal, cuttingTotal).subtotal;
    // AFTER this slice: the fold is byte-for-byte the same expression, so the
    // same inputs give the same figure. Waste still contributes nothing.
    const subtotalAfter = fold(otherCostsTotal, cuttingTotal).subtotal;

    expect(subtotalBefore).toBe(21269.5);
    expect(subtotalAfter).toBe(21269.5);
    expect(subtotalAfter).toBe(subtotalBefore);
    expect(subtotalAfter - subtotalBefore).toBe(0);
    expect(fmtWasteMoney(subtotalBefore)).toBe("$21,269.50");
    expect(fmtWasteMoney(subtotalAfter)).toBe("$21,269.50");

    // The discipline bar above the stack does not move either.
    const bar = (s: number) =>
      rollUpDiscipline([toCardRollupInput("card-1", null, fold(s, cuttingTotal))]).subtotal;
    expect(bar(otherCostsTotal)).toBe(subtotalBefore);
  });

  it("keeps waste off the card fold at the mount point", () => {
    // The mechanism, not just the arithmetic: ScopeWasteTab is mounted with
    // no section-total callback, so nothing it computes can reach the fold.
    const wasteMount = /<ScopeWasteTab[\s\S]*?\/>/.exec(tabSource)?.[0] ?? "";
    expect(wasteMount).not.toBe("");
    expect(wasteMount).not.toContain("onSectionTotalChange");
    expect(wasteMount).not.toContain("TotalChange");

    // And the fold expression itself carries no waste term.
    // SCOPE_OPERATIONAL_COSTS_PRICED_V1: the section now hands the fold two
    // figures — `otherCostsSubtotal` (bare) and `otherCostsWithMarkup` (marked
    // up) — so the assertion is on the S1 shape. Waste is still not in either
    // term, which is what this test is really pinning.
    expect(tabSource).toContain("subtotal: fromItems.subtotal + otherCostsSubtotal + cutting");
    expect(tabSource).toContain(
      "subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCostsWithMarkup + cutting"
    );
    // Still exactly one place card money is computed.
    expect((tabSource.match(/computeCardBarStats\(/g) ?? []).length).toBe(1);
  });

  it("is kept off the fold BECAUSE the server already prices it", () => {
    // The reason, pinned at its source. If the server ever stops summing
    // waste into tenderPrice, this assertion fails and the decision above
    // has to be revisited rather than silently inherited.
    // SCOPE_OPERATIONAL_COSTS_PRICED_V1: `operationalWithMarkup` joined the
    // sum as a fourth independent stream. Waste is still in there.
    expect(serverSummarySource).toContain(
      "const tenderPrice = scopeWithMarkupTotal + cuttingWithMarkup + wasteWithMarkup + operationalWithMarkup;"
    );
    // ...from the same rows this section edits...
    expect(serverSummarySource).toContain("this.prisma.scopeWasteItem.findMany({");
    // updated for SCOPE_QUOTE_DESTINATION_V1 (S2a): waste splits four ways
    // ...at the waste section's OWN markup rate, not the scope chain.
    // SCOPE_LINE_MARKUP_ALL_TYPES_V1 (S3): each line resolved via resolveEffectiveMarkup,
    // so the S2 bucket-level factor is gone; per-line lineTotalWithMarkup is accumulated directly.
    expect(serverSummarySource).toContain("wasteWithMarkup += lineTotalWithMarkup;");
    expect(serverSummarySource).toContain("resolveEffectiveMarkup(lineMarkupOverride, cardWasteOverride, tenderMarkup)");
    // ...and the invariant is stated in words next to it.
    // (the sentence wraps in the source, so match the clause that fits a line)
    expect(serverSummarySource).toContain("NEVER folded into the");
    expect(serverSummarySource).toContain("scope discipline total.");
  });

  it("records the reasoning in the component, so the next reader does not re-litigate it", () => {
    expect(wasteSource).toContain("tenderPrice");
    expect(wasteSource).toMatch(/independently marked-up|independent cost stream/i);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 6. No second pricing implementation in the browser
// ───────────────────────────────────────────────────────────────────────

describe("the browser does not price waste", () => {
  it("adds up the server's figures and formats them, and derives none of them", () => {
    // sumWasteLineTotals is an addition over server-supplied lineTotals.
    // Nothing in this file multiplies a tonnage by a rate.
    expect(wasteSource).not.toMatch(/qty\s*\*\s*ratePerTonne/);
    expect(wasteSource).not.toMatch(/tonnes\s*\*\s*rate/i);
    expect(wasteSource).not.toMatch(/dailyKm\s*\*/);
  });

  it("keeps the transport rate the server snapshotted, and does not recompute it", () => {
    // quotedTransportRatePerDay is read for the variance display only.
    expect(wasteSource).toContain("quotedTransportRatePerDay");
    expect(wasteSource).not.toMatch(/quotedTransportRatePerDay\s*[*/+-]\s*\w/);
  });
});

// ───────────────────────────────────────────────────────────────────────
// 7. S2b-b — Goes-to column (after Description), destination rail,
//    INTERNAL treatment, four-way money reporting
// ───────────────────────────────────────────────────────────────────────

describe("S2b-b: Goes-to column appears after Description in the waste table header", () => {
  it("the header includes Goes to, placed after Description and before Group", () => {
    // Source assertion: the column array lists the header strings in order.
    const descIdx = wasteSource.indexOf('"Description"');
    const goesIdx = wasteSource.indexOf('"Goes to"');
    const groupIdx = wasteSource.indexOf('"Group"');
    expect(descIdx).toBeGreaterThan(-1);
    expect(goesIdx).toBeGreaterThan(-1);
    expect(groupIdx).toBeGreaterThan(-1);
    expect(descIdx).toBeLessThan(goesIdx);
    expect(goesIdx).toBeLessThan(groupIdx);
  });

  it("renders a waste-dest-cell after the description column in each row", () => {
    // Source assertion: the dest cell follows the description td and appears
    // before the group <select> value binding.
    // NOTE: `row.wasteGroup` first appears in a local-variable assignment
    // (facilitiesForRow call), so we anchor on `value={row.wasteGroup` which
    // only appears inside the select element in the row renderer.
    const destCellIdx = wasteSource.indexOf('"waste-dest-cell"');
    const descInputIdx = wasteSource.indexOf("row.description");
    const groupSelectIdx = wasteSource.indexOf("value={row.wasteGroup");
    expect(destCellIdx).toBeGreaterThan(-1);
    expect(descInputIdx).toBeGreaterThan(-1);
    expect(groupSelectIdx).toBeGreaterThan(-1);
    // dest cell is after description input, and before group select
    expect(descInputIdx).toBeLessThan(destCellIdx);
    expect(destCellIdx).toBeLessThan(groupSelectIdx);
  });

  it("does not pass optionLetter — the prop is omitted entirely", () => {
    expect(wasteSource).not.toContain("optionLetter");
  });

  it("PATCHes quoteDestination when the destination select fires", () => {
    expect(wasteSource).toContain("quoteDestination: next");
  });
});

describe("S2b-b: destination rail classes and INTERNAL treatment in waste rows", () => {
  it("source uses DESTINATION_ROW_CLASS for the row className", () => {
    expect(wasteSource).toContain("DESTINATION_ROW_CLASS");
    expect(wasteSource).toContain("rowDestClass");
  });

  it("INTERNAL rows use surface-subtle background and .55 opacity (source assertion)", () => {
    expect(wasteSource).toContain("surface-subtle");
    expect(wasteSource).toContain("0.55");
  });

  it("INTERNAL rows show the total struck through and the destNote (source assertion)", () => {
    expect(wasteSource).toContain("line-through");
    expect(wasteSource).toContain("1.5px");
    expect(wasteSource).toContain("rowDestNote");
    expect(wasteSource).toContain("exclnote");
  });

  it("a failed PATCH reverts by calling load() (source assertion)", () => {
    // patchRow is called; if it fails, load() is called to re-read server state.
    expect(wasteSource).toContain("void load()");
  });
});

describe("S2b-b: four-way money reporting for waste", () => {
  it("sorts rows into the correct pile by destination", () => {
    const rows = [
      { lineTotal: "100.00", quoteDestination: "PRICE" as const },
      { lineTotal: "200.00", quoteDestination: "PROVISIONAL" as const },
      { lineTotal: "300.00", quoteDestination: "OPTION" as const },
      { lineTotal: "400.00", quoteDestination: "INTERNAL" as const }
    ];
    const fw: WasteFourWay = wasteFourWay(rows);
    expect(fw.price.subtotal).toBe(100);
    expect(fw.provisional.subtotal).toBe(200);
    expect(fw.option.subtotal).toBe(300);
    expect(fw.internal.subtotal).toBe(400);
  });

  it("defaults null/undefined quoteDestination to PRICE", () => {
    const rows = [
      { lineTotal: "150.00", quoteDestination: null as null },
      { lineTotal: "250.00", quoteDestination: undefined as undefined }
    ];
    const fw = wasteFourWay(rows);
    expect(fw.price.subtotal).toBe(400);
    expect(fw.provisional.subtotal).toBe(0);
    expect(fw.option.subtotal).toBe(0);
    expect(fw.internal.subtotal).toBe(0);
  });

  it("skips rows whose lineTotal is non-numeric", () => {
    const rows = [
      { lineTotal: "not-a-number", quoteDestination: "PRICE" as const },
      { lineTotal: "500.00", quoteDestination: "PRICE" as const }
    ];
    const fw = wasteFourWay(rows);
    expect(fw.price.subtotal).toBe(500);
    expect(Number.isNaN(fw.price.subtotal)).toBe(false);
  });

  it("the sum of all four piles equals sumWasteLineTotals", () => {
    const rows = [
      { lineTotal: "100.00", autoSummed: false, id: "r1", qty: "5", quoteDestination: "PRICE" as const },
      { lineTotal: "200.00", autoSummed: true,  id: "r2", qty: "8", quoteDestination: "PROVISIONAL" as const },
      { lineTotal: "150.00", autoSummed: false, id: "r3", qty: "3", quoteDestination: "INTERNAL" as const }
    ];
    const fw = wasteFourWay(rows);
    const total = fw.price.subtotal + fw.provisional.subtotal + fw.option.subtotal + fw.internal.subtotal;
    expect(total).toBeCloseTo(sumWasteLineTotals(rows));
    expect(total).toBe(450);
  });

  it("destNote text matches DESTINATION_NOTE from QuoteDestinationSelect", () => {
    // The rendered note comes from DESTINATION_NOTE, used via wasteDestNote helper.
    expect(DESTINATION_NOTE.PROVISIONAL).toBe("provisional sum");
    expect(DESTINATION_NOTE.OPTION).toBe("cost option");
    expect(DESTINATION_NOTE.INTERNAL).toBe("internal only");
  });

  it("does not set SCOPE_QUOTE_DESTINATION_UI_V1 (S2b-c's marker)", () => {
    expect(wasteSource).not.toContain("SCOPE_QUOTE_DESTINATION_UI_V1");
  });
});
