// SCOPE_DISCBAR_V1 — unit tests for computeCardBarStats.
// SCOPE_DISCIPLINE_STACK_V1 — plus the rebuilt bar's own markup.
// SCOPE_PROVISIONAL_SPLIT_V1 — provisional split: computeCardBarStats,
//   DisciplineRollup, and the bar's three-figure render.
//
// The web workspace has no @testing-library / jsdom set up (all existing
// tests follow the no-render pattern; see card-display.test.ts). The stats
// half of this file tests the pure helper that drives the bar's per-card
// numbers. Where markup itself has to be asserted — "the roll-up bar is no
// longer keyed by a card id" is a claim about the DOM, not about a number —
// renderToStaticMarkup from react-dom/server is used, which needs no DOM.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DisciplineSummaryBar,
  computeCardBarStats,
  durationTitle,
  hasConcurrentStages,
  peakCrewTitle,
  type CardBarStats
} from "../DisciplineSummaryBar";
import { rollUpDiscipline, type CardRollupInput } from "../utils/discipline-rollup";
import type { ScopeItem } from "../../ScopeQuantitiesTable";

// ── Minimal factory — fill only fields needed for computeCardBarStats ──
function makeItem(
  overrides: {
    status?: "draft" | "confirmed" | "excluded";
    lineTotal?: number | null;
    lineTotalWithMarkup?: number | null;
    isProvisional?: boolean | null;
  } = {}
): ScopeItem {
  return {
    id: "test-id",
    tenderId: "t1",
    cardId: "c1",
    wbsCode: "DEM1.1",
    itemNumber: 1,
    description: "Test item",
    status: overrides.status ?? "confirmed",
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
    isProvisional: overrides.isProvisional ?? null,
    lineTotal: overrides.lineTotal ?? null,
    lineTotalWithMarkup: overrides.lineTotalWithMarkup ?? null
  };
}

describe("computeCardBarStats", () => {
  it("returns zeros for an empty items array", () => {
    const stats: CardBarStats = computeCardBarStats([]);
    expect(stats.itemCount).toBe(0);
    expect(stats.subtotal).toBe(0);
    expect(stats.subtotalWithMarkup).toBe(0);
    expect(stats.provisionalSubtotal).toBe(0);
    expect(stats.provisionalWithMarkup).toBe(0);
  });

  it("counts only non-excluded items", () => {
    const items = [
      makeItem({ status: "confirmed", lineTotal: 100, lineTotalWithMarkup: 115 }),
      makeItem({ status: "draft",     lineTotal: 200, lineTotalWithMarkup: 230 }),
      makeItem({ status: "excluded",  lineTotal: 999, lineTotalWithMarkup: 1150 })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.itemCount).toBe(2);
    expect(stats.subtotal).toBe(300);
    expect(stats.subtotalWithMarkup).toBe(345);
  });

  it("sums lineTotal and lineTotalWithMarkup across all non-excluded items", () => {
    const items = [
      makeItem({ lineTotal: 500,  lineTotalWithMarkup: 575 }),
      makeItem({ lineTotal: 1200, lineTotalWithMarkup: 1380 }),
      makeItem({ lineTotal: 300,  lineTotalWithMarkup: 345 })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.subtotal).toBe(2000);
    expect(stats.subtotalWithMarkup).toBe(2300);
  });

  it("treats null lineTotal / lineTotalWithMarkup as 0 (old API rows)", () => {
    const items = [
      makeItem({ lineTotal: null, lineTotalWithMarkup: null }),
      makeItem({ lineTotal: 400,  lineTotalWithMarkup: 460 })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.itemCount).toBe(2);
    expect(stats.subtotal).toBe(400);
    expect(stats.subtotalWithMarkup).toBe(460);
  });

  it("treats string-coerced totals correctly (API returns number | string)", () => {
    const items = [
      makeItem({ lineTotal: "750" as unknown as number, lineTotalWithMarkup: "862.5" as unknown as number })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.subtotal).toBeCloseTo(750);
    expect(stats.subtotalWithMarkup).toBeCloseTo(862.5);
  });

  it("matches ScopeQuantitiesTable footer formula exactly for a mixed card", () => {
    // This test is the byte-identical-totals check called out in the PR spec.
    // Card: 2 confirmed items (one with markup override applied server-side),
    //       1 excluded item (must NOT appear in either total).
    // lineTotal / lineTotalWithMarkup are the server-computed values — the bar
    // must NOT recompute them from rates; it sums exactly what the table sums.
    const items = [
      makeItem({ status: "confirmed",  lineTotal: 1000,  lineTotalWithMarkup: 1150 }), // 15% markup
      makeItem({ status: "confirmed",  lineTotal: 2500,  lineTotalWithMarkup: 2750 }), // 10% markup override
      makeItem({ status: "excluded",   lineTotal: 5000,  lineTotalWithMarkup: 5750 })  // excluded — not summed
    ];
    // ScopeQuantitiesTable footer formula:
    const visible = items.filter((i) => i.status !== "excluded");
    const expectedSubtotal = visible.reduce(
      (sum, i) => sum + (i.lineTotal != null ? Number(i.lineTotal) : 0),
      0
    );
    const expectedWithMarkup = visible.reduce(
      (sum, i) => sum + (i.lineTotalWithMarkup != null ? Number(i.lineTotalWithMarkup) : 0),
      0
    );

    const stats = computeCardBarStats(items);
    expect(stats.subtotal).toBe(expectedSubtotal);        // bar === footer "Subtotal"
    expect(stats.subtotalWithMarkup).toBe(expectedWithMarkup); // bar === footer "with markup"
    // Concrete values for the PR body evidence:
    expect(stats.subtotal).toBe(3500);
    expect(stats.subtotalWithMarkup).toBe(3900);
  });

  it("handles a card with all items excluded (all-excluded card is zero)", () => {
    const items = [
      makeItem({ status: "excluded", lineTotal: 1000, lineTotalWithMarkup: 1150 }),
      makeItem({ status: "excluded", lineTotal: 500,  lineTotalWithMarkup: 575 })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.itemCount).toBe(0);
    expect(stats.subtotal).toBe(0);
    expect(stats.subtotalWithMarkup).toBe(0);
  });

  it("itemCount reflects visible (non-excluded) rows only", () => {
    const items = [
      makeItem({ status: "confirmed" }),
      makeItem({ status: "confirmed" }),
      makeItem({ status: "confirmed" }),
      makeItem({ status: "excluded" }),
      makeItem({ status: "excluded" })
    ];
    expect(computeCardBarStats(items).itemCount).toBe(3);
  });
});

// ── SCOPE_DISCIPLINE_STACK_V1 — the rebuilt bar ────────────────────────

function stageCard(overrides: Partial<CardRollupInput> & { cardId: string }): CardRollupInput {
  return {
    itemCount: 0,
    peakCrew: 0,
    labourDays: 0,
    duration: 0,
    subtotal: 0,
    subtotalWithMarkup: 0,
    provisionalSubtotal: 0,
    provisionalWithMarkup: 0,
    plantSummary: [],
    ...overrides
  };
}

// The same three sequential demolition stages the roll-up spec works through.
const DEM_STAGES: CardRollupInput[] = [
  stageCard({
    cardId: "dem1", itemCount: 4, peakCrew: 6, labourDays: 5, duration: 5,
    subtotal: 40_000, subtotalWithMarkup: 46_000,
    plantSummary: [{ category: "Excavator", items: [{ variant: "20t", peakQty: 2, peakDays: 5 }] }]
  }),
  stageCard({
    cardId: "dem2", itemCount: 3, peakCrew: 10, labourDays: 4, duration: 4,
    subtotal: 60_000, subtotalWithMarkup: 69_000,
    plantSummary: [{ category: "Excavator", items: [{ variant: "20t", peakQty: 3, peakDays: 4 }] }]
  }),
  stageCard({
    cardId: "dem3", itemCount: 5, peakCrew: 8, labourDays: 6, duration: 6,
    subtotal: 30_000, subtotalWithMarkup: 34_500,
    plantSummary: [{ category: "Excavator", items: [{ variant: "20t", peakQty: 1, peakDays: 6 }] }]
  })
];

function renderBar(cards: CardRollupInput[]): string {
  return renderToStaticMarkup(
    <DisciplineSummaryBar
      disciplineCode="DEM"
      disciplineLabel="Demolition"
      rollup={rollUpDiscipline(cards)}
    />
  );
}

describe("DisciplineSummaryBar markup", () => {
  const html = renderBar(DEM_STAGES);

  it("carries NO data-card-id — it is not a card bar any more", () => {
    // Finding 9.3.5: the bar used to be keyed data-card-id={card.id} while
    // wearing a "Discipline total" label.
    expect(html).not.toContain("data-card-id");
  });

  it("is identified by data-discipline instead", () => {
    expect(html).toContain('data-discipline="DEM"');
    expect(html).toContain('data-testid="discipline-summary-bar"');
  });

  it("shows the discipline label and the stage count", () => {
    expect(html).toContain("Demolition");
    expect(html).toContain("3 stages");
    expect(renderBar([DEM_STAGES[0]])).toContain("1 stage");
  });

  it("renders the DISCIPLINE total — the sum of the three card totals", () => {
    // 46,000 + 69,000 + 34,500 = 149,500.
    expect(html).toContain("Discipline total");
    expect(html).toContain("$149,500");
    // ...and not any single card's total.
    expect(html).not.toContain("$69,000");
  });

  it("renders peak crew as the MAX of the stages, never the sum", () => {
    expect(html).toContain("Peak crew");
    expect(html).toContain(">10<"); // max(6, 10, 8)
    expect(html).not.toContain(">24<"); // 6 + 10 + 8
  });

  it("renders duration as the sum and person-days as the sum", () => {
    expect(html).toContain("Duration");
    expect(html).toContain("Person-days");
    expect(html).toContain(">118<"); // 6x5 + 10x4 + 8x6
  });

  it("labels the plant chip as a peak, and carries the peak quantity in its title", () => {
    // The old bar had a "Plant days" chip that was being handed the card's
    // DURATION. The chip is now Peak plant, with max(peakQty) = 3.
    expect(html).toContain("Peak plant");
    expect(html).not.toContain("Plant days");
    expect(html).toContain("Excavator 20t: 3");
  });

  it("renders an all-zero discipline without crashing or inventing figures", () => {
    const empty = renderBar([]);
    expect(empty).toContain('data-discipline="DEM"');
    expect(empty).toContain("$0");
    expect(empty).toContain("0 stages");
  });

  it("is unaffected by which cards a viewer has collapsed", () => {
    // Collapse is local UI state in the container and is NOT an input to the
    // fold, so the same stack yields the same bar however it is displayed.
    expect(renderBar([...DEM_STAGES])).toBe(html);
  });
});

// ── SCOPE_STAGE_GROUP_V1 — the chips must say what the figure IS ───────
//
// Peak crew and Duration used to carry `title` text asserting the
// sequential rule ("stages run sequentially, so this is a max, not a sum").
// Cards of one discipline can now share a stage, which RAISES peak crew and
// LOWERS duration — figures an estimator may already have quoted from — so
// both tooltips now state how many stages the cards actually formed and, if
// any stage holds more than one card, that concurrent cards SUM.
//
// The same three DEM cards as above, with DEM1 and DEM2 grouped into one
// stage. Peak crew 10 -> 16, duration 15 -> 11, excavators 3 -> 5.

const DEM_STAGES_GROUPED: CardRollupInput[] = [
  { ...DEM_STAGES[0], stageKey: "g1" },
  { ...DEM_STAGES[1], stageKey: "g1" },
  { ...DEM_STAGES[2], stageKey: null }
];

describe("chip tooltips describe the stage model that is actually in force", () => {
  const sequential = rollUpDiscipline(DEM_STAGES);
  const concurrent = rollUpDiscipline(DEM_STAGES_GROUPED);

  it("knows which discipline has concurrency and which does not", () => {
    expect(hasConcurrentStages(sequential)).toBe(false);
    expect(hasConcurrentStages(concurrent)).toBe(true);
  });

  it("the ungrouped Peak crew tooltip names 3 stages and calls the figure a max", () => {
    const title = peakCrewTitle(sequential);
    expect(title).toContain("3 stages");
    expect(title).toContain("a max, not a sum");
  });

  it("the grouped Peak crew tooltip names 2 stages, 3 cards, and says crews SUM", () => {
    const title = peakCrewTitle(concurrent);
    expect(title).toContain("2 stages");
    expect(title).toContain("3 cards");
    expect(title).toContain("SUM");
    // The stale claim must be gone: it is no longer true that the figure
    // can only ever be a max over individual cards.
    expect(title).not.toContain("a max, not a sum");
  });

  it("the ungrouped Duration tooltip names 3 stages running end to end", () => {
    const title = durationTitle(sequential);
    expect(title).toContain("3 stages");
    expect(title).toContain("end to end");
  });

  it("the grouped Duration tooltip names 2 stages, 3 cards, and says the stage counts ONCE", () => {
    const title = durationTitle(concurrent);
    expect(title).toContain("2 stages");
    expect(title).toContain("3 cards");
    expect(title).toContain("ONCE");
  });

  it("says 'stage' not 'stages' for a one-card discipline", () => {
    const single = rollUpDiscipline([DEM_STAGES[0]]);
    expect(peakCrewTitle(single)).toContain("1 stage.");
    expect(durationTitle(single)).toContain("1 stage ");
  });
});

describe("the bar renders the moved figures and counts STAGES, not cards", () => {
  const html = renderBar(DEM_STAGES_GROUPED);

  it("counts two stages over three cards, and says some are concurrent", () => {
    expect(html).toContain("2 stages");
    expect(html).toContain("3 cards, some concurrent");
    expect(html).not.toContain("3 stages");
    // "sequential" is only claimed when it is true.
    expect(html).not.toContain("sequential");
  });

  it("shows peak crew RISEN to 16 — the grouped crews added", () => {
    expect(html).toContain(">16<"); // 6 + 10, on site together
    expect(renderBar(DEM_STAGES)).toContain(">10<"); // was max(6, 10, 8)
    expect(html).not.toContain(">24<"); // still not a flat sum of all three
  });

  it("shows duration FALLEN to 11 — the grouped stage counts once", () => {
    expect(html).toContain(">11<"); // max(5, 4) + 6
    expect(renderBar(DEM_STAGES)).toContain(">15<"); // was 5 + 4 + 6
  });

  it("shows the peak plant quantity RISEN to 5 concurrent 20t excavators", () => {
    expect(html).toContain("Excavator 20t: 5"); // 2 + 3 at once
    expect(renderBar(DEM_STAGES)).toContain("Excavator 20t: 3"); // was max(2, 3, 1)
  });

  it("leaves the discipline total exactly where it was — grouping is not a price", () => {
    expect(html).toContain("$149,500");
    expect(renderBar(DEM_STAGES)).toContain("$149,500");
  });

  it("leaves person-days exactly where they were — the work is still done", () => {
    expect(html).toContain(">118<");
    expect(renderBar(DEM_STAGES)).toContain(">118<");
  });

  it("still says 'sequential' for a discipline nobody has grouped", () => {
    const ungrouped = renderBar(DEM_STAGES);
    expect(ungrouped).toContain("3 stages");
    expect(ungrouped).toContain("sequential");
  });
});

// ── SCOPE_PROVISIONAL_SPLIT_V1 — computeCardBarStats provisional partition ──
//
// The predicate is: a line is provisional if isProvisional===true OR
// discipline==="Other" (schema.prisma §3697, reproduced in computeCardBarStats).
// Excluded items are in neither pile.

describe("computeCardBarStats — provisional split", () => {
  it("splits a mixed card: flagged rows go to provisional, unflagged to priced", () => {
    const items = [
      makeItem({ lineTotal: 1000, lineTotalWithMarkup: 1150, isProvisional: false }),
      makeItem({ lineTotal: 500,  lineTotalWithMarkup: 575,  isProvisional: true  }),
      makeItem({ lineTotal: 200,  lineTotalWithMarkup: 230,  isProvisional: true  })
    ];
    const stats = computeCardBarStats(items);
    // The two flagged rows are the provisional slice.
    expect(stats.provisionalSubtotal).toBe(700);          // 500 + 200
    expect(stats.provisionalWithMarkup).toBe(805);        // 575 + 230
    // Total is unaffected — same as without the split.
    expect(stats.subtotal).toBe(1700);
    expect(stats.subtotalWithMarkup).toBe(1955);
    // in the quote = total - provisional, by construction.
    expect(stats.subtotalWithMarkup - stats.provisionalWithMarkup).toBe(1150);
  });

  it("discipline 'Other' makes every non-excluded row provisional even with the flag false", () => {
    const items = [
      makeItem({ lineTotal: 300, lineTotalWithMarkup: 345, isProvisional: false }),
      makeItem({ lineTotal: 400, lineTotalWithMarkup: 460, isProvisional: false })
    ];
    const stats = computeCardBarStats(items, "Other");
    // Both rows are provisional because the discipline is "Other".
    expect(stats.provisionalSubtotal).toBe(700);
    expect(stats.provisionalWithMarkup).toBe(805);
    expect(stats.subtotal).toBe(700);
    expect(stats.subtotalWithMarkup).toBe(805);
  });

  it("an excluded row is in neither pile", () => {
    const items = [
      makeItem({ lineTotal: 1000, lineTotalWithMarkup: 1150, isProvisional: true,  status: "excluded" }),
      makeItem({ lineTotal: 500,  lineTotalWithMarkup: 575,  isProvisional: true  }),
      makeItem({ lineTotal: 200,  lineTotalWithMarkup: 230,  isProvisional: false })
    ];
    const stats = computeCardBarStats(items);
    // Excluded row must not appear in either total or provisional.
    expect(stats.subtotal).toBe(700);
    expect(stats.subtotalWithMarkup).toBe(805);
    expect(stats.provisionalSubtotal).toBe(500);
    expect(stats.provisionalWithMarkup).toBe(575);
  });

  it("provisional <= total, always — on a mixed card", () => {
    const items = [
      makeItem({ lineTotal: 1000, lineTotalWithMarkup: 1150, isProvisional: false }),
      makeItem({ lineTotal: 500,  lineTotalWithMarkup: 575,  isProvisional: true  })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.provisionalWithMarkup).toBeLessThanOrEqual(stats.subtotalWithMarkup);
    expect(stats.provisionalSubtotal).toBeLessThanOrEqual(stats.subtotal);
  });

  it("provisional <= total, always — on an all-provisional card", () => {
    const items = [
      makeItem({ lineTotal: 300, lineTotalWithMarkup: 345, isProvisional: true }),
      makeItem({ lineTotal: 200, lineTotalWithMarkup: 230, isProvisional: true })
    ];
    const stats = computeCardBarStats(items);
    expect(stats.provisionalWithMarkup).toBeLessThanOrEqual(stats.subtotalWithMarkup);
    // For an all-provisional card they are equal.
    expect(stats.provisionalWithMarkup).toBe(stats.subtotalWithMarkup);
    expect(stats.provisionalSubtotal).toBe(stats.subtotal);
  });

  it("omitting discipline means flag-only — an unflagged item is NOT provisional", () => {
    const items = [
      makeItem({ lineTotal: 100, lineTotalWithMarkup: 115, isProvisional: false })
    ];
    const stats = computeCardBarStats(items); // no discipline
    expect(stats.provisionalSubtotal).toBe(0);
    expect(stats.provisionalWithMarkup).toBe(0);
  });
});

// ── SCOPE_PROVISIONAL_SPLIT_V1 — bar renders three figures when provisional ──

function makeProvisionalRollup(
  subtotalWithMarkup: number,
  provisionalWithMarkup: number
) {
  return rollUpDiscipline([
    stageCard({
      cardId: "c1",
      subtotal: subtotalWithMarkup,
      subtotalWithMarkup,
      provisionalSubtotal: provisionalWithMarkup,
      provisionalWithMarkup
    })
  ]);
}

describe("DisciplineSummaryBar provisional split render", () => {
  it("renders all three figures when there is provisional money", () => {
    const rollup = makeProvisionalRollup(75_920, 16_120);
    const html = renderToStaticMarkup(
      <DisciplineSummaryBar disciplineCode="SUB" disciplineLabel="Subcontracted" rollup={rollup} />
    );
    expect(html).toContain("In the quote");
    expect(html).toContain("Provisional");
    expect(html).toContain("Discipline total");
    // in the quote = 75920 - 16120 = 59800
    expect(html).toContain("$59,800");
    expect(html).toContain("$16,120");
    expect(html).toContain("$75,920");
  });

  it("the total is unchanged from the no-provisional render of the same total", () => {
    const withProvisional = makeProvisionalRollup(75_920, 16_120);
    const withoutProvisional = makeProvisionalRollup(75_920, 0);
    const htmlWith = renderToStaticMarkup(
      <DisciplineSummaryBar disciplineCode="SUB" disciplineLabel="Subcontracted" rollup={withProvisional} />
    );
    const htmlWithout = renderToStaticMarkup(
      <DisciplineSummaryBar disciplineCode="SUB" disciplineLabel="Subcontracted" rollup={withoutProvisional} />
    );
    // The total figure must appear in both renders.
    expect(htmlWith).toContain("$75,920");
    expect(htmlWithout).toContain("$75,920");
  });

  it("renders exactly one money figure when there is no provisional money", () => {
    const rollup = makeProvisionalRollup(75_920, 0);
    const html = renderToStaticMarkup(
      <DisciplineSummaryBar disciplineCode="DEM" disciplineLabel="Demolition" rollup={rollup} />
    );
    // No split shown — same as before this slice.
    expect(html).toContain("Discipline total");
    expect(html).not.toContain("In the quote");
    expect(html).not.toContain("Provisional");
    expect(html).toContain("$75,920");
  });
});
