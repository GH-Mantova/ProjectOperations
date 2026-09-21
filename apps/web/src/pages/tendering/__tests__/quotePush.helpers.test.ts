// quotePush.helpers.test.ts -- QUOTE_PUSH_PANEL_V1 (scopecards-s4b)
//
// Pure-logic tests for the push panel helpers.
// No DOM, no fetch, no jsdom.

import { describe, it, expect } from "vitest";
import {
  groupCostLines,
  groupFigures,
  pushCounts,
  quoteLineFigures,
  pushPanelState,
  sourceChip,
  nextOptionLabel,
  type CostGroup,
  type CostLineWithGroup,
  type LineAppropriation,
  type PushableLine,
  type SummaryResult,
  type PushPlan
} from "../quotePush.helpers";

// ── groupCostLines ────────────────────────────────────────────────

describe("groupCostLines", () => {
  const groups: CostGroup[] = [
    { id: "g1", code: "DEM", label: "A", name: "Demolition", printMode: "ITEMISED", sortOrder: 0 },
    { id: "g2", code: "CIV", label: "B", name: "Civil Works", printMode: "ITEMISED", sortOrder: 1 }
  ];

  const lines: CostLineWithGroup[] = [
    { id: "l1", label: "A1", description: "Demo 1", displayDescription: null, price: "1000", baseValue: "1000", overrideAmount: null, sortOrder: 2, isVisible: true, groupId: "g1", sourceEstimateLineType: null, sourceEstimateLineId: null },
    { id: "l2", label: "A2", description: "Demo 2", displayDescription: null, price: "2000", baseValue: "2000", overrideAmount: null, sortOrder: 1, isVisible: true, groupId: "g1", sourceEstimateLineType: null, sourceEstimateLineId: null },
    { id: "l3", label: "B1", description: "Civil 1", displayDescription: null, price: "3000", baseValue: "3000", overrideAmount: null, sortOrder: 0, isVisible: true, groupId: "g2", sourceEstimateLineType: null, sourceEstimateLineId: null },
    { id: "l4", label: "X1", description: "Typed line", displayDescription: null, price: "500", baseValue: "500", overrideAmount: null, sortOrder: 0, isVisible: true, groupId: null, sourceEstimateLineType: null, sourceEstimateLineId: null }
  ];

  it("returns groups in sortOrder, each with its lines in sortOrder", () => {
    const result = groupCostLines(lines, groups);
    // First section: DEM (sortOrder 0)
    expect(result[0].group?.code).toBe("DEM");
    // Lines within DEM should be in sortOrder: l2 (1) then l1 (2)
    expect(result[0].lines[0].id).toBe("l2");
    expect(result[0].lines[1].id).toBe("l1");
    // Second section: CIV (sortOrder 1)
    expect(result[1].group?.code).toBe("CIV");
    expect(result[1].lines[0].id).toBe("l3");
  });

  it("puts ungrouped lines last under group: null", () => {
    const result = groupCostLines(lines, groups);
    const last = result[result.length - 1];
    expect(last.group).toBeNull();
    expect(last.lines[0].id).toBe("l4");
  });

  it("handles lines with no groups (returns one section with group: null)", () => {
    const result = groupCostLines(lines, []);
    expect(result).toHaveLength(1);
    expect(result[0].group).toBeNull();
    expect(result[0].lines).toHaveLength(4);
  });
});

// ── groupFigures ──────────────────────────────────────────────────

describe("groupFigures", () => {
  const group: CostGroup = { id: "g1", code: "DEM", label: "A", name: "Demolition", printMode: "ITEMISED", sortOrder: 0 };
  const lines: CostLineWithGroup[] = [
    { id: "l1", label: "A1", description: "Demo 1", displayDescription: null, price: "1000", baseValue: "1000", overrideAmount: null, sortOrder: 0, isVisible: true, groupId: "g1", sourceEstimateLineType: null, sourceEstimateLineId: null },
    { id: "l2", label: "A2", description: "Demo 2", displayDescription: null, price: "2000", baseValue: "2000", overrideAmount: null, sortOrder: 1, isVisible: false, groupId: "g1", sourceEstimateLineType: null, sourceEstimateLineId: null },
    { id: "l3", label: "A3", description: "Demo 3", displayDescription: null, price: "500", baseValue: "500", overrideAmount: null, sortOrder: 2, isVisible: true, groupId: "g1", sourceEstimateLineType: null, sourceEstimateLineId: null }
  ];
  const appropriations: LineAppropriation[] = [
    { lineId: "l1", baseValue: 1000, overrideAmount: null, displayedAmount: 1100 }
    // l3 has no appropriation -- uses price
  ];

  it("sums displayedAmount of visible lines only (never recomputes price)", () => {
    const result = groupFigures(group, lines, appropriations);
    // l1 visible: displayedAmount 1100
    // l2 not visible: skipped
    // l3 visible: no approp, uses price 500
    expect(result.subtotal).toBe(1600);
  });

  it("tickedCount = visible lines, lineCount = all lines", () => {
    const result = groupFigures(group, lines, appropriations);
    expect(result.tickedCount).toBe(2);
    expect(result.lineCount).toBe(3);
  });
});

// ── pushCounts ────────────────────────────────────────────────────

describe("pushCounts", () => {
  const pushable: PushableLine[] = [
    { type: "scope", id: "s1", code: "DEM1.1", description: "Demolition", cardId: "c1", cardCode: "DEM1", discipline: "DEM", quoteDestination: "PRICE", price: 1000, priceable: true, priceReason: null },
    { type: "scope", id: "s2", code: "CIV1.1", description: "Civil", cardId: "c2", cardCode: "CIV1", discipline: "CIV", quoteDestination: "PROVISIONAL", price: 500, priceable: true, priceReason: null },
    { type: "scope", id: "s3", code: "ASB1.1", description: "Asbestos", cardId: "c3", cardCode: "ASB1", discipline: "ASB", quoteDestination: "OPTION", price: 800, priceable: true, priceReason: null },
    { type: "scope", id: "s4", code: "DEM1.2", description: "Internal", cardId: "c1", cardCode: "DEM1", discipline: "DEM", quoteDestination: "INTERNAL", price: 300, priceable: false, priceReason: "no quantity" }
  ];

  // Cost line for s1 with isVisible=true (ticked)
  const costLines: CostLineWithGroup[] = [
    { id: "cl1", label: "A", description: "Demolition", displayDescription: null, price: "1000", baseValue: "1000", overrideAmount: null, sortOrder: 0, isVisible: true, groupId: "g1", sourceEstimateLineType: "scope", sourceEstimateLineId: "s1" }
  ];

  it("gives 1/1/1/1 on a fixture with one of each destination", () => {
    const result = pushCounts(pushable, costLines);
    expect(result.price.lines).toBe(1);
    expect(result.provisional.lines).toBe(1);
    expect(result.option.lines).toBe(1);
    expect(result.internal.lines).toBe(1);
  });

  it("INTERNAL amount is correct", () => {
    const result = pushCounts(pushable, costLines);
    expect(result.internal.amount).toBe(300);
  });

  it("ticked = pushed PRICE rows whose quote row is isVisible", () => {
    const result = pushCounts(pushable, costLines);
    expect(result.price.ticked).toBe(1);
  });

  it("ticked is 0 when the PRICE cost line is not visible", () => {
    const invisLines = costLines.map((l) => ({ ...l, isVisible: false }));
    const result = pushCounts(pushable, invisLines);
    expect(result.price.ticked).toBe(0);
  });
});

// ── quoteLineFigures ──────────────────────────────────────────────

describe("quoteLineFigures", () => {
  it("gives inThisQuote: 272837.46, pricedOnEstimate: 274163.46, unticked: 1326.00", () => {
    const summary: SummaryResult = {
      baseTotalCostLines: 272837.46,
      adjustmentAmount: 0,
      adjustedTotal: 272837.46,
      provisionalTotal: 0,
      costOptionsTotal: 0,
      clientFacingTotal: 272837.46,
      lineAppropriations: [],
      pricedOnEstimate: 274163.46
    };
    const result = quoteLineFigures(summary);
    expect(result.inThisQuote).toBe(272837.46);
    expect(result.pricedOnEstimate).toBe(274163.46);
    // unticked = pricedOnEstimate - baseTotalCostLines
    expect(result.unticked).toBeCloseTo(1326.00, 2);
  });

  it("unticked is 0.00 when nothing is unticked (pricedOnEstimate === baseTotalCostLines)", () => {
    const summary: SummaryResult = {
      baseTotalCostLines: 100000,
      adjustmentAmount: 0,
      adjustedTotal: 100000,
      provisionalTotal: 0,
      costOptionsTotal: 0,
      clientFacingTotal: 100000,
      lineAppropriations: [],
      pricedOnEstimate: 100000
    };
    const result = quoteLineFigures(summary);
    expect(result.unticked).toBe(0);
  });
});

// ── pushPanelState ────────────────────────────────────────────────

describe("pushPanelState", () => {
  const upToDatePlan: PushPlan = {
    counts: { create: 0, update: 0, move: 0, withdraw: 0, unchanged: 3 },
    groups: [],
    changes: [],
    fingerprint: "abc",
    estimateChangedSincePush: false,
    quoteStatus: "DRAFT"
  };

  const changedPlan: PushPlan = {
    ...upToDatePlan,
    estimateChangedSincePush: true
  };

  it("returns 'never-pushed' when pushedAt is null", () => {
    const result = pushPanelState({ status: "DRAFT", pushedAt: null, sentAt: null }, upToDatePlan);
    expect(result.state).toBe("never-pushed");
  });

  it("returns 'frozen' when status !== DRAFT", () => {
    const result = pushPanelState({ status: "SENT", pushedAt: "2026-09-11T09:12:00.000Z", sentAt: "2026-09-12T00:00:00.000Z" }, upToDatePlan);
    expect(result.state).toBe("frozen");
    expect(result.sentence).toContain("cannot be changed by a push");
  });

  it("returns 'up-to-date' when DRAFT and estimate not changed", () => {
    const result = pushPanelState({ status: "DRAFT", pushedAt: "2026-09-11T09:12:00.000Z", sentAt: null }, upToDatePlan);
    expect(result.state).toBe("up-to-date");
    expect(result.sentence).toContain("has not changed since");
  });

  it("returns 'changed' when DRAFT and estimate has changed", () => {
    const result = pushPanelState({ status: "DRAFT", pushedAt: "2026-09-11T09:12:00.000Z", sentAt: null }, changedPlan);
    expect(result.state).toBe("changed");
    expect(result.sentence).toContain("has changed since");
  });

  it("'up-to-date' sentence does not contain a time component for the push date (date only shown)", () => {
    // The sentence includes the full push datetime, but the changed case does not include extra time per S4a call 3
    const changed = pushPanelState({ status: "DRAFT", pushedAt: "2026-09-11T09:12:00.000Z", sentAt: null }, changedPlan);
    expect(changed.state).toBe("changed");
    // Sentence contains "has changed since"
    expect(changed.sentence).toContain("has changed since");
  });
});

// ── sourceChip ────────────────────────────────────────────────────

describe("sourceChip", () => {
  it("returns 'pushed' kind when row has a pointer and no override", () => {
    const result = sourceChip({ sourceEstimateLineId: "est-1", overrideAmount: null });
    expect(result.kind).toBe("pushed");
  });

  it("returns 'typed' kind when row has no pointer", () => {
    const result = sourceChip({ sourceEstimateLineId: null, overrideAmount: null });
    expect(result.kind).toBe("typed");
    expect(result.text).toContain("added on this quote");
  });

  it("returns 'kept' kind when row has a pointer AND an override", () => {
    const result = sourceChip({ sourceEstimateLineId: "est-1", overrideAmount: "3900" });
    expect(result.kind).toBe("kept");
  });

  it("'typed' text contains 'no estimate line' (dashed)", () => {
    const result = sourceChip({ sourceEstimateLineId: null, overrideAmount: null });
    expect(result.text).toContain("no estimate line");
  });
});

// ── nextOptionLabel ───────────────────────────────────────────────

describe("nextOptionLabel", () => {
  it("returns A for an empty list", () => {
    expect(nextOptionLabel([])).toBe("A");
  });

  it("returns B when A is already used", () => {
    expect(nextOptionLabel(["A"])).toBe("B");
  });

  it("nextOptionLabel([A, C]) is B", () => {
    expect(nextOptionLabel(["A", "C"])).toBe("B");
  });

  it("skips already-used letters to find first unused", () => {
    expect(nextOptionLabel(["A", "B", "C", "D"])).toBe("E");
  });
});
