// SCOPE_DISCIPLINE_STACK_V1 — the discipline roll-up arithmetic, pinned.
//
// The whole point of putting the fold in a pure function is that Marco's
// table is checkable without rendering anything:
//
//   Peak crew   → max()  NEVER a sum
//   Peak plant  → max()  NEVER a sum
//   Person-days → sum
//   Labour days → sum
//   Duration    → sum
//   Money       → sum
//
// The web workspace has no jsdom (see card-display.test.ts); every test here
// is over exported pure functions.

import { describe, expect, it } from "vitest";
import {
  EMPTY_DISCIPLINE_ROLLUP,
  cardPersonDays,
  cardsInDiscipline,
  disciplinesWithCards,
  resolveDisciplineFromParam,
  rollUpDiscipline,
  round1,
  toCardRollupInput,
  type CardRollupInput,
  type CardSummaryEnvelope
} from "../utils/discipline-rollup";

const DISCIPLINE_ORDER = ["DEM", "CIV", "ASB", "Other", "SUB"] as const;

function makeCard(overrides: Partial<CardRollupInput> & { cardId: string }): CardRollupInput {
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

/** The worked example from the PR body: one demolition programme, three
 *  sequential stages. Peak crew 6 / 10 / 8. */
const DEM1 = makeCard({
  cardId: "dem1",
  itemCount: 4,
  peakCrew: 6,
  labourDays: 5,
  duration: 5,
  subtotal: 40_000,
  subtotalWithMarkup: 46_000,
  plantSummary: [
    { category: "Excavator", items: [{ variant: "20t", peakQty: 2, peakDays: 5 }] }
  ]
});
const DEM2 = makeCard({
  cardId: "dem2",
  itemCount: 3,
  peakCrew: 10,
  labourDays: 4,
  duration: 4,
  subtotal: 60_000,
  subtotalWithMarkup: 69_000,
  plantSummary: [
    { category: "Excavator", items: [{ variant: "20t", peakQty: 3, peakDays: 4 }] },
    { category: "Truck", items: [{ variant: null, peakQty: 1, peakDays: 4 }] }
  ]
});
const DEM3 = makeCard({
  cardId: "dem3",
  itemCount: 5,
  peakCrew: 8,
  labourDays: 6,
  duration: 6,
  subtotal: 30_000,
  subtotalWithMarkup: 34_500,
  plantSummary: [
    { category: "Excavator", items: [{ variant: "20t", peakQty: 1, peakDays: 6 }] }
  ]
});

describe("round1 / cardPersonDays", () => {
  it("rounds day figures the way the API rounds them", () => {
    expect(round1(0.1 + 0.2)).toBe(0.3);
    expect(round1(4.44)).toBe(4.4);
    expect(round1(4.45)).toBe(4.5);
  });

  it("returns 0 rather than NaN for non-finite input", () => {
    expect(round1(Number.NaN)).toBe(0);
    expect(cardPersonDays(Number.NaN, 3)).toBe(0);
    expect(cardPersonDays(3, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("derives person-days as peakCrew x labourDays", () => {
    // getCardSummary defines labourDays = totalPersonDays / peakCrew, so the
    // product recovers person-days exactly. It is NOT on the API surface.
    expect(cardPersonDays(6, 5)).toBe(30);
    expect(cardPersonDays(10, 4)).toBe(40);
    expect(cardPersonDays(8, 6)).toBe(48);
  });
});

describe("rollUpDiscipline — the empty case", () => {
  it("returns an all-zero roll-up for no cards", () => {
    const rollup = rollUpDiscipline([]);
    expect(rollup).toEqual(EMPTY_DISCIPLINE_ROLLUP);
    expect(rollup.cardCount).toBe(0);
    expect(rollup.peakCrew).toBe(0);
    expect(rollup.duration).toBe(0);
    expect(rollup.subtotalWithMarkup).toBe(0);
    expect(rollup.plantSummary).toEqual([]);
  });

  it("does not hand back the shared EMPTY constant's array to be mutated", () => {
    const rollup = rollUpDiscipline([]);
    expect(rollup.plantSummary).not.toBe(EMPTY_DISCIPLINE_ROLLUP.plantSummary);
  });

  it("folds cards that have no items or figures without inventing any", () => {
    const rollup = rollUpDiscipline([makeCard({ cardId: "empty-1" }), makeCard({ cardId: "empty-2" })]);
    expect(rollup.cardCount).toBe(2);
    expect(rollup.itemCount).toBe(0);
    expect(rollup.peakCrew).toBe(0);
    expect(rollup.subtotalWithMarkup).toBe(0);
  });
});

describe("rollUpDiscipline — a single card", () => {
  it("is the card itself: max of one is the one", () => {
    const rollup = rollUpDiscipline([DEM2]);
    expect(rollup.cardCount).toBe(1);
    expect(rollup.itemCount).toBe(3);
    expect(rollup.peakCrew).toBe(10);
    expect(rollup.labourDays).toBe(4);
    expect(rollup.duration).toBe(4);
    expect(rollup.personDays).toBe(40); // 10 x 4
    expect(rollup.subtotal).toBe(60_000);
    expect(rollup.subtotalWithMarkup).toBe(69_000);
    expect(rollup.plantSummary).toEqual([
      { category: "Excavator", items: [{ variant: "20t", peakQty: 3, peakDays: 4 }] },
      { category: "Truck", items: [{ variant: null, peakQty: 1, peakDays: 4 }] }
    ]);
  });
});

describe("rollUpDiscipline — three sequential stages (DEM1/DEM2/DEM3)", () => {
  const rollup = rollUpDiscipline([DEM1, DEM2, DEM3]);

  it("PEAK CREW IS THE MAX, NEVER THE SUM", () => {
    // cards 6 / 10 / 8 -> discipline 10, not 24.
    expect(rollup.peakCrew).toBe(10);
    expect(rollup.peakCrew).toBe(Math.max(DEM1.peakCrew, DEM2.peakCrew, DEM3.peakCrew));
    expect(rollup.peakCrew).not.toBe(DEM1.peakCrew + DEM2.peakCrew + DEM3.peakCrew);
    expect(rollup.peakCrew).not.toBe(24);
  });

  it("PEAK PLANT IS THE MAX PER (CATEGORY, VARIANT), NEVER THE SUM", () => {
    // Excavator 20t appears on all three cards: 2 / 3 / 1 -> 3, not 6.
    const excavator = rollup.plantSummary.find((g) => g.category === "Excavator");
    expect(excavator).toBeDefined();
    const twentyTonne = excavator!.items.find((i) => i.variant === "20t");
    expect(twentyTonne!.peakQty).toBe(3);
    expect(twentyTonne!.peakQty).not.toBe(6);
    // Days ARE a duration and so they sum: 5 + 4 + 6 = 15 machine-days.
    expect(twentyTonne!.peakDays).toBe(15);
  });

  it("keeps a plant type that appears on only one card", () => {
    const truck = rollup.plantSummary.find((g) => g.category === "Truck");
    expect(truck!.items).toEqual([{ variant: null, peakQty: 1, peakDays: 4 }]);
  });

  it("sorts plant categories and variants the way the API sorts them", () => {
    expect(rollup.plantSummary.map((g) => g.category)).toEqual(["Excavator", "Truck"]);
  });

  it("DURATION IS THE SUM — the stages run end to end", () => {
    // 5 + 4 + 6 = 15 days.
    expect(rollup.duration).toBe(15);
    expect(rollup.duration).toBe(DEM1.duration + DEM2.duration + DEM3.duration);
  });

  it("LABOUR DAYS IS THE SUM of the per-card figures the API returned", () => {
    expect(rollup.labourDays).toBe(15); // 5 + 4 + 6
    // NOT re-derived as personDays / peakCrew — that would be 118 / 10 = 11.8
    // and would understate the days badly.
    expect(rollup.labourDays).not.toBeCloseTo(rollup.personDays / rollup.peakCrew);
  });

  it("PERSON-DAYS IS THE SUM of each card's peakCrew x labourDays", () => {
    // 6x5 + 10x4 + 8x6 = 30 + 40 + 48 = 118.
    expect(rollup.personDays).toBe(118);
  });

  it("MONEY IS THE SUM — the bar's figure is the three card totals added up", () => {
    // 46,000 + 69,000 + 34,500 = 149,500.
    expect(rollup.subtotalWithMarkup).toBe(149_500);
    expect(rollup.subtotalWithMarkup).toBe(
      DEM1.subtotalWithMarkup + DEM2.subtotalWithMarkup + DEM3.subtotalWithMarkup
    );
    expect(rollup.subtotal).toBe(130_000);
  });

  it("counts every stage and every item exactly once", () => {
    expect(rollup.cardCount).toBe(3);
    expect(rollup.itemCount).toBe(12); // 4 + 3 + 5
  });

  it("is order-independent", () => {
    expect(rollUpDiscipline([DEM3, DEM1, DEM2])).toEqual(rollup);
  });

  it("folds a duplicated card id ONCE — double-counting a stage is the failure mode", () => {
    const doubled = rollUpDiscipline([DEM1, DEM2, DEM3, DEM2]);
    expect(doubled).toEqual(rollup);
    expect(doubled.subtotalWithMarkup).toBe(149_500);
  });

});

describe("rollUpDiscipline — float noise in summed day figures", () => {
  it("re-rounds summed days to 1dp the way the API rounds them", () => {
    const rollup = rollUpDiscipline([
      makeCard({ cardId: "a", peakCrew: 1, labourDays: 0.1, duration: 0.1 }),
      makeCard({ cardId: "b", peakCrew: 1, labourDays: 0.2, duration: 0.2 })
    ]);
    expect(rollup.labourDays).toBe(0.3);
    expect(rollup.duration).toBe(0.3);
    expect(rollup.personDays).toBe(0.3);
  });

  it("re-rounds summed plant days too", () => {
    const rollup = rollUpDiscipline([
      makeCard({
        cardId: "a",
        plantSummary: [{ category: "Bobcat", items: [{ variant: null, peakQty: 1, peakDays: 0.1 }] }]
      }),
      makeCard({
        cardId: "b",
        plantSummary: [{ category: "Bobcat", items: [{ variant: null, peakQty: 2, peakDays: 0.2 }] }]
      })
    ]);
    expect(rollup.plantSummary[0].items[0]).toEqual({ variant: null, peakQty: 2, peakDays: 0.3 });
  });
});

describe("a tender whose cards span more than one discipline", () => {
  // The failure mode this guards: figures leaking between disciplines, a
  // discipline vanishing from the strip, or a card being folded into two
  // disciplines at once.
  const tenderCards = [
    { id: "dem1", discipline: "DEM" },
    { id: "civ1", discipline: "CIV" },
    { id: "dem2", discipline: "DEM" },
    { id: "asb1", discipline: "ASB" },
    { id: "dem3", discipline: "DEM" }
  ];

  it("lists one tab per discipline that has a card, in canonical order", () => {
    expect(disciplinesWithCards(tenderCards, DISCIPLINE_ORDER)).toEqual(["DEM", "CIV", "ASB"]);
  });

  it("lists no tab for a discipline with no cards", () => {
    expect(disciplinesWithCards(tenderCards, DISCIPLINE_ORDER)).not.toContain("SUB");
    expect(disciplinesWithCards([], DISCIPLINE_ORDER)).toEqual([]);
  });

  it("APPENDS an unknown discipline rather than dropping it", () => {
    // A discipline that silently disappears takes its money with it.
    const withLegacy = [...tenderCards, { id: "x1", discipline: "LEGACY" }];
    expect(disciplinesWithCards(withLegacy, DISCIPLINE_ORDER)).toEqual([
      "DEM",
      "CIV",
      "ASB",
      "LEGACY"
    ]);
  });

  it("puts every card in exactly one discipline bucket", () => {
    const buckets = disciplinesWithCards(tenderCards, DISCIPLINE_ORDER).map((d) =>
      cardsInDiscipline(tenderCards, d)
    );
    const ids = buckets.flat().map((c) => c.id);
    expect(ids.length).toBe(tenderCards.length);
    expect(new Set(ids).size).toBe(tenderCards.length);
  });

  it("keeps each discipline's cards in tender sort order — the stage sequence", () => {
    expect(cardsInDiscipline(tenderCards, "DEM").map((c) => c.id)).toEqual([
      "dem1",
      "dem2",
      "dem3"
    ]);
  });

  it("never leaks a figure across disciplines, and never drops one", () => {
    const money: Record<string, CardRollupInput> = {
      dem1: makeCard({ cardId: "dem1", peakCrew: 6, labourDays: 5, duration: 5, subtotalWithMarkup: 46_000 }),
      dem2: makeCard({ cardId: "dem2", peakCrew: 10, labourDays: 4, duration: 4, subtotalWithMarkup: 69_000 }),
      dem3: makeCard({ cardId: "dem3", peakCrew: 8, labourDays: 6, duration: 6, subtotalWithMarkup: 34_500 }),
      civ1: makeCard({ cardId: "civ1", peakCrew: 4, labourDays: 3, duration: 3, subtotalWithMarkup: 12_000 }),
      asb1: makeCard({ cardId: "asb1", peakCrew: 2, labourDays: 2, duration: 2, subtotalWithMarkup: 8_000 })
    };
    const byDiscipline = Object.fromEntries(
      disciplinesWithCards(tenderCards, DISCIPLINE_ORDER).map((d) => [
        d,
        rollUpDiscipline(cardsInDiscipline(tenderCards, d).map((c) => money[c.id]))
      ])
    );

    expect(byDiscipline.DEM.peakCrew).toBe(10); // max(6,10,8) — not 24
    expect(byDiscipline.DEM.duration).toBe(15);
    expect(byDiscipline.DEM.subtotalWithMarkup).toBe(149_500);

    expect(byDiscipline.CIV.cardCount).toBe(1);
    expect(byDiscipline.CIV.peakCrew).toBe(4); // CIV is untouched by DEM's 10
    expect(byDiscipline.CIV.subtotalWithMarkup).toBe(12_000);

    expect(byDiscipline.ASB.subtotalWithMarkup).toBe(8_000);

    // Nothing double-counted, nothing dropped: the disciplines add back up
    // to the whole tender.
    const tenderTotal = Object.values(byDiscipline).reduce((s, r) => s + r.subtotalWithMarkup, 0);
    expect(tenderTotal).toBe(46_000 + 69_000 + 34_500 + 12_000 + 8_000);
    expect(tenderTotal).toBe(169_500);
  });
});

describe("toCardRollupInput", () => {
  const summary: CardSummaryEnvelope = {
    computed: {
      peakCrew: 6,
      labourDays: 5,
      duration: 5,
      plantSummary: [{ category: "Excavator", items: [{ variant: "20t", peakQty: 2, peakDays: 5 }] }]
    },
    overrides: {
      peakCrewOverride: null,
      labourDaysOverride: null,
      plantSummaryOverride: null,
      durationOverride: null
    }
  };
  const stats = { itemCount: 4, subtotal: 40_000, subtotalWithMarkup: 46_000 };

  it("uses the computed figures when nothing is overridden", () => {
    expect(toCardRollupInput("dem1", summary, stats)).toEqual({
      cardId: "dem1",
      itemCount: 4,
      peakCrew: 6,
      labourDays: 5,
      duration: 5,
      subtotal: 40_000,
      subtotalWithMarkup: 46_000,
      plantSummary: summary.computed.plantSummary,
      // SCOPE_STAGE_GROUP_V1 — the card's stage, added by this slice. NOT a
      // figure: every number above is untouched. A caller that passes no
      // stageGroup gets null, which means "a stage of its own" and folds
      // exactly as an absent key does (pinned in
      // utils/__tests__/discipline-rollup.test.ts, "an explicit null stage
      // key is the same as no stage key at all").
      stageKey: null
    });
  });

  it("still gives an ungrouped card a stage of its own", () => {
    expect(toCardRollupInput("dem1", summary, stats).stageKey).toBeNull();
    expect(toCardRollupInput("dem1", summary, stats, null).stageKey).toBeNull();
  });

  it("prefers each override over its computed figure", () => {
    const overridden: CardSummaryEnvelope = {
      computed: summary.computed,
      overrides: {
        peakCrewOverride: 12,
        labourDaysOverride: 9,
        durationOverride: 11,
        plantSummaryOverride: "2 x 30t excavator"
      }
    };
    const input = toCardRollupInput("dem1", overridden, stats);
    expect(input.peakCrew).toBe(12);
    expect(input.labourDays).toBe(9);
    expect(input.duration).toBe(11);
    // The plant override is free text, not (category, variant, peakQty), so
    // there is nothing to take a max of: the card still contributes its
    // COMPUTED plant rather than dropping out of the plant roll-up.
    expect(input.plantSummary).toEqual(summary.computed.plantSummary);
  });

  it("treats an override of 0 as an override, not as absent", () => {
    const zeroed: CardSummaryEnvelope = {
      computed: summary.computed,
      overrides: { ...summary.overrides, peakCrewOverride: 0, durationOverride: 0 }
    };
    const input = toCardRollupInput("dem1", zeroed, stats);
    expect(input.peakCrew).toBe(0);
    expect(input.duration).toBe(0);
  });

  it("keeps a card's money when its summary has not loaded yet", () => {
    // Money comes from items the screen already has; the day figures come
    // from the per-card summary fetch. A pending fetch must not blank the
    // discipline total.
    const input = toCardRollupInput("dem1", null, stats);
    expect(input.subtotalWithMarkup).toBe(46_000);
    expect(input.peakCrew).toBe(0);
    expect(input.labourDays).toBe(0);
    expect(input.plantSummary).toEqual([]);
  });

  it("an overridden card still rolls up with the max rule", () => {
    const rollup = rollUpDiscipline([
      toCardRollupInput("dem1", summary, stats),
      toCardRollupInput(
        "dem2",
        { computed: summary.computed, overrides: { ...summary.overrides, peakCrewOverride: 10 } },
        { itemCount: 3, subtotal: 60_000, subtotalWithMarkup: 69_000 }
      )
    ]);
    expect(rollup.peakCrew).toBe(10); // max(6, 10) — not 16
    expect(rollup.subtotalWithMarkup).toBe(115_000);
  });
});

describe("resolveDisciplineFromParam", () => {
  const tenderCards = [
    { id: "dem1", discipline: "DEM" },
    { id: "civ1", discipline: "CIV" },
    { id: "dem2", discipline: "DEM" }
  ];

  it("returns null when the tender has no cards", () => {
    expect(resolveDisciplineFromParam("DEM", [], DISCIPLINE_ORDER)).toBeNull();
  });

  it("accepts a discipline code", () => {
    expect(resolveDisciplineFromParam("CIV", tenderCards, DISCIPLINE_ORDER)).toBe("CIV");
  });

  it("keeps an existing ?card=<card id> deep link working", () => {
    // The parameter used to name a card. It must still land somewhere
    // sensible rather than on an empty screen.
    expect(resolveDisciplineFromParam("dem2", tenderCards, DISCIPLINE_ORDER)).toBe("DEM");
    expect(resolveDisciplineFromParam("civ1", tenderCards, DISCIPLINE_ORDER)).toBe("CIV");
  });

  it("falls back to the first discipline for a missing or unknown value", () => {
    expect(resolveDisciplineFromParam(null, tenderCards, DISCIPLINE_ORDER)).toBe("DEM");
    expect(resolveDisciplineFromParam("deleted-card-id", tenderCards, DISCIPLINE_ORDER)).toBe("DEM");
    expect(resolveDisciplineFromParam("SUB", tenderCards, DISCIPLINE_ORDER)).toBe("DEM");
  });

  it("falls back in canonical order, not insertion order", () => {
    const civOnlyFirst = [
      { id: "civ1", discipline: "CIV" },
      { id: "dem1", discipline: "DEM" }
    ];
    // DEM precedes CIV in DISCIPLINE_CODES, so DEM is the default tab.
    expect(resolveDisciplineFromParam(null, civOnlyFirst, DISCIPLINE_ORDER)).toBe("DEM");
  });
});
