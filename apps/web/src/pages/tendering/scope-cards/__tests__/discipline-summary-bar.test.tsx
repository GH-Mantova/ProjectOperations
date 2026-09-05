// SCOPE_DISCBAR_V1 — unit tests for computeCardBarStats.
// SCOPE_DISCIPLINE_STACK_V1 — plus the rebuilt bar's own markup.
//
// The web workspace has no @testing-library / jsdom set up (all existing
// tests follow the no-render pattern; see card-display.test.ts). The stats
// half of this file tests the pure helper that drives the bar's per-card
// numbers. Where markup itself has to be asserted — "the roll-up bar is no
// longer keyed by a card id" is a claim about the DOM, not about a number —
// renderToStaticMarkup from react-dom/server is used, which needs no DOM.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DisciplineSummaryBar, computeCardBarStats, type CardBarStats } from "../DisciplineSummaryBar";
import { rollUpDiscipline, type CardRollupInput } from "../utils/discipline-rollup";
import type { ScopeItem } from "../../ScopeQuantitiesTable";

// ── Minimal factory — fill only fields needed for computeCardBarStats ──
function makeItem(
  overrides: {
    status?: "draft" | "confirmed" | "excluded";
    lineTotal?: number | null;
    lineTotalWithMarkup?: number | null;
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
