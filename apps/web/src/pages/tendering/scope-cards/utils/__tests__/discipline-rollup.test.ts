// SCOPE_STAGE_AWARE_V1 — the STAGE model of the discipline roll-up, pinned.
//
// A discipline is an ordered list of STAGES; a stage holds one or more
// cards. Cards in the same stage run at the same time, stages run one
// after another:
//
//   figure       within a stage   across stages
//   Peak crew    sum              max
//   Peak plant   sum              max
//   Duration     max              sum
//   everything   sum              sum
//   else
//
// Every card is its own stage today, so every figure must come out
// IDENTICAL to the pre-stage flat fold. That is what the first describe
// block proves — not by restating the numbers, but by running the flat
// fold that shipped on main (copied verbatim into `flatFoldAsShippedOnMain`
// below) alongside the stage-aware fold and comparing field by field,
// plantSummary included.
//
// The flat-fold figures themselves stay pinned, unedited, in
// ../../__tests__/discipline-rollup.test.ts. If this slice had moved a
// figure, that file would have failed rather than this one.
//
// The web workspace has no jsdom (see card-display.test.ts); every test
// here is over exported pure functions.

import { describe, expect, it } from "vitest";
import {
  cardPersonDays,
  groupCardsIntoStages,
  rollUpDiscipline,
  rollUpDisciplineStages,
  round1,
  type CardRollupInput,
  type DisciplineRollup,
  type RollupPlantGroup
} from "../discipline-rollup";

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

// ── The reference implementation ────────────────────────────────────────
//
// `rollUpDiscipline` exactly as it shipped on main before this slice: a
// flat fold with peak crew as a max, duration as a sum, and plant peakQty
// as a max per (category, variant). Copied verbatim so the equivalence
// below is a comparison against real prior behaviour rather than against
// numbers a test author typed out and could have typed wrong.

function flatFoldAsShippedOnMain(cards: readonly CardRollupInput[]): DisciplineRollup {
  type VariantAccum = { variant: string | null; peakQty: number; totalDays: number };
  const plant = new Map<string, Map<string, VariantAccum>>();
  const seen = new Set<string>();

  let cardCount = 0;
  let itemCount = 0;
  let peakCrew = 0;
  let personDays = 0;
  let labourDays = 0;
  let duration = 0;
  let subtotal = 0;
  let subtotalWithMarkup = 0;

  for (const card of cards) {
    if (seen.has(card.cardId)) continue;
    seen.add(card.cardId);
    cardCount += 1;

    itemCount += card.itemCount;
    // max — NEVER a sum.
    if (card.peakCrew > peakCrew) peakCrew = card.peakCrew;
    personDays += cardPersonDays(card.peakCrew, card.labourDays);
    labourDays += card.labourDays;
    duration += card.duration;
    subtotal += card.subtotal;
    subtotalWithMarkup += card.subtotalWithMarkup;

    for (const group of card.plantSummary ?? []) {
      let variants = plant.get(group.category);
      if (!variants) {
        variants = new Map<string, VariantAccum>();
        plant.set(group.category, variants);
      }
      for (const item of group.items ?? []) {
        const key = item.variant ?? "";
        const accum = variants.get(key) ?? { variant: item.variant, peakQty: 0, totalDays: 0 };
        if (item.peakQty > accum.peakQty) accum.peakQty = item.peakQty;
        accum.totalDays += item.peakDays;
        variants.set(key, accum);
      }
    }
  }

  const plantSummary: RollupPlantGroup[] = [...plant.keys()].sort().map((category) => {
    const variants = plant.get(category)!;
    return {
      category,
      items: [...variants.keys()].sort().map((key) => {
        const accum = variants.get(key)!;
        return { variant: accum.variant, peakQty: accum.peakQty, peakDays: round1(accum.totalDays) };
      })
    };
  });

  return {
    cardCount,
    itemCount,
    peakCrew,
    personDays: round1(personDays),
    labourDays: round1(labourDays),
    duration: round1(duration),
    plantSummary,
    subtotal,
    subtotalWithMarkup
  };
}

// ── A realistic demolition discipline ───────────────────────────────────
//
// Four stages of one demolition programme. Chosen so the fold is not
// trivial: a plant category shared by three cards, a second category that
// appears on only some of them, a null-variant line, and a card carrying
// fractional days so the 1dp rounding is exercised.

const DEM1 = makeCard({
  cardId: "dem1",
  itemCount: 4,
  peakCrew: 6,
  labourDays: 5,
  duration: 5,
  subtotal: 40_000,
  subtotalWithMarkup: 46_000,
  plantSummary: [{ category: "Excavator", items: [{ variant: "20t", peakQty: 2, peakDays: 5 }] }]
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
  plantSummary: [{ category: "Excavator", items: [{ variant: "20t", peakQty: 1, peakDays: 6 }] }]
});
const DEM4 = makeCard({
  cardId: "dem4",
  itemCount: 2,
  peakCrew: 7,
  labourDays: 2.5,
  duration: 2.5,
  subtotal: 15_000,
  subtotalWithMarkup: 17_250,
  plantSummary: [
    { category: "Excavator", items: [{ variant: "5t", peakQty: 2, peakDays: 2.5 }] },
    { category: "Truck", items: [{ variant: null, peakQty: 2, peakDays: 2.5 }] }
  ]
});

const DEM_DISCIPLINE = [DEM1, DEM2, DEM3, DEM4];

/** Assert two roll-ups are equal field by field, so a failure names the
 *  field that moved instead of dumping two objects. */
function expectSameRollup(actual: DisciplineRollup, expected: DisciplineRollup): void {
  expect(actual.cardCount).toBe(expected.cardCount);
  expect(actual.itemCount).toBe(expected.itemCount);
  expect(actual.peakCrew).toBe(expected.peakCrew);
  expect(actual.personDays).toBe(expected.personDays);
  expect(actual.labourDays).toBe(expected.labourDays);
  expect(actual.duration).toBe(expected.duration);
  expect(actual.subtotal).toBe(expected.subtotal);
  expect(actual.subtotalWithMarkup).toBe(expected.subtotalWithMarkup);
  expect(actual.plantSummary).toEqual(expected.plantSummary);
}

describe("EVERY CARD IN ITS OWN STAGE == the flat fold that shipped on main", () => {
  // This is the whole safety argument for the slice. Nothing can group two
  // cards yet, so every stage is a singleton, `sum` within a stage is the
  // card's own figure, and every number must be bit-for-bit what it was.
  const flat = flatFoldAsShippedOnMain(DEM_DISCIPLINE);
  const staged = rollUpDiscipline(DEM_DISCIPLINE);

  it("matches the flat fold FIELD BY FIELD, plantSummary included", () => {
    expectSameRollup(staged, flat);
  });

  it("matches it whole-object too, so no field escapes the comparison", () => {
    expect(staged).toEqual(flat);
  });

  it("still reports the figures the discipline bar shows today", () => {
    // Spelled out so a reader can check the arithmetic by hand, and so a
    // silent change to BOTH folds at once would still be caught.
    expect(staged.cardCount).toBe(4);
    expect(staged.itemCount).toBe(14); // 4 + 3 + 5 + 2
    expect(staged.peakCrew).toBe(10); // max(6, 10, 8, 7) — not 31
    expect(staged.personDays).toBe(135.5); // 30 + 40 + 48 + 17.5
    expect(staged.labourDays).toBe(17.5); // 5 + 4 + 6 + 2.5
    expect(staged.duration).toBe(17.5); // 5 + 4 + 6 + 2.5, end to end
    expect(staged.subtotal).toBe(145_000);
    expect(staged.subtotalWithMarkup).toBe(166_750);
    expect(staged.plantSummary).toEqual([
      {
        category: "Excavator",
        items: [
          { variant: "20t", peakQty: 3, peakDays: 15 }, // max(2,3,1), days 5+4+6
          { variant: "5t", peakQty: 2, peakDays: 2.5 }
        ]
      },
      { category: "Truck", items: [{ variant: null, peakQty: 2, peakDays: 6.5 }] } // max(1,2), 4+2.5
    ]);
  });

  it("peak crew is still the MAX and never the sum of the singleton stages", () => {
    expect(staged.peakCrew).toBe(Math.max(...DEM_DISCIPLINE.map((c) => c.peakCrew)));
    expect(staged.peakCrew).not.toBe(31);
  });

  it("duration is still the SUM of the singleton stages", () => {
    expect(staged.duration).toBe(
      round1(DEM_DISCIPLINE.reduce((total, c) => total + c.duration, 0))
    );
  });

  it("an explicit null stage key is the same as no stage key at all", () => {
    const explicitlyOwnStage = DEM_DISCIPLINE.map((card) => ({ ...card, stageKey: null }));
    expectSameRollup(rollUpDiscipline(explicitlyOwnStage), flat);
  });

  it("holds through the explicit stage-list entry point too", () => {
    const stages = DEM_DISCIPLINE.map((card) => [card]);
    expectSameRollup(rollUpDisciplineStages(stages), flat);
  });

  it("holds card for card, one singleton stage at a time", () => {
    for (const card of DEM_DISCIPLINE) {
      expectSameRollup(rollUpDiscipline([card]), flatFoldAsShippedOnMain([card]));
    }
  });

  it("holds for the empty discipline and for figure-less cards", () => {
    expectSameRollup(rollUpDiscipline([]), flatFoldAsShippedOnMain([]));
    const blanks = [makeCard({ cardId: "a" }), makeCard({ cardId: "b" })];
    expectSameRollup(rollUpDiscipline(blanks), flatFoldAsShippedOnMain(blanks));
  });

  it("holds when a card id is duplicated — still folded exactly once", () => {
    const doubled = [...DEM_DISCIPLINE, DEM2];
    expectSameRollup(rollUpDiscipline(doubled), flat);
    expect(rollUpDiscipline(doubled).subtotalWithMarkup).toBe(166_750);
  });

  it("holds for a card listing the same (category, variant) twice", () => {
    // Two lines of the same machine on ONE card are that card's own peak,
    // so they max rather than add — as they did before stages existed.
    const twice = [
      makeCard({
        cardId: "dup",
        plantSummary: [
          { category: "Excavator", items: [{ variant: "20t", peakQty: 2, peakDays: 3 }] },
          { category: "Excavator", items: [{ variant: "20t", peakQty: 5, peakDays: 4 }] }
        ]
      })
    ];
    expectSameRollup(rollUpDiscipline(twice), flatFoldAsShippedOnMain(twice));
    expect(rollUpDiscipline(twice).plantSummary[0].items[0]).toEqual({
      variant: "20t",
      peakQty: 5, // max(2, 5) — not 7
      peakDays: 7 // 3 + 4
    });
  });

  it("holds for day figures that reintroduce float noise when summed", () => {
    const noisy = [
      makeCard({
        cardId: "a",
        peakCrew: 1,
        labourDays: 0.1,
        duration: 0.1,
        plantSummary: [
          { category: "Bobcat", items: [{ variant: null, peakQty: 1, peakDays: 0.1 }] }
        ]
      }),
      makeCard({
        cardId: "b",
        peakCrew: 1,
        labourDays: 0.2,
        duration: 0.2,
        plantSummary: [
          { category: "Bobcat", items: [{ variant: null, peakQty: 2, peakDays: 0.2 }] }
        ]
      })
    ];
    expectSameRollup(rollUpDiscipline(noisy), flatFoldAsShippedOnMain(noisy));
    expect(rollUpDiscipline(noisy).duration).toBe(0.3);
    expect(rollUpDiscipline(noisy).plantSummary[0].items[0].peakDays).toBe(0.3);
  });
});

describe("TWO CARDS SHARING ONE STAGE — the behaviour that does not exist yet", () => {
  // Same two cards, now declared concurrent. Nothing in the schema, the API
  // or the UI can set a stage key today; this pins the arithmetic for when
  // something can.
  const concurrent = [
    { ...DEM1, stageKey: "dem-stage-1" },
    { ...DEM2, stageKey: "dem-stage-1" }
  ];
  const rollup = rollUpDiscipline(concurrent);
  const sequential = rollUpDiscipline([DEM1, DEM2]);

  it("folds them into ONE stage", () => {
    const stages = groupCardsIntoStages(concurrent);
    expect(stages).toHaveLength(1);
    expect(stages[0].map((c) => c.cardId)).toEqual(["dem1", "dem2"]);
  });

  it("PEAK CREW SUMS — both crews are on site at the same time", () => {
    expect(rollup.peakCrew).toBe(16); // 6 + 10
    expect(sequential.peakCrew).toBe(10); // max(6, 10) when they are stages
  });

  it("DURATION MAXES — the stage ends when its longest card ends", () => {
    expect(rollup.duration).toBe(5); // max(5, 4)
    expect(sequential.duration).toBe(9); // 5 + 4 when they run end to end
  });

  it("PLANT QUANTITY SUMS within the stage — two jobs at once need two machines", () => {
    const excavator = rollup.plantSummary.find((g) => g.category === "Excavator");
    const twentyTonne = excavator!.items.find((i) => i.variant === "20t");
    expect(twentyTonne!.peakQty).toBe(5); // 2 + 3
    // Days are a duration, not a peak: they sum under both models.
    expect(twentyTonne!.peakDays).toBe(9); // 5 + 4
    const sequentialTwentyTonne = sequential.plantSummary[0].items[0];
    expect(sequentialTwentyTonne.peakQty).toBe(3); // max(2, 3)
    expect(sequentialTwentyTonne.peakDays).toBe(9); // unchanged
  });

  it("keeps plant that only one card in the stage carries", () => {
    const truck = rollup.plantSummary.find((g) => g.category === "Truck");
    expect(truck!.items).toEqual([{ variant: null, peakQty: 1, peakDays: 4 }]);
  });

  it("leaves person-days, labour days, money and counts EXACTLY as they were", () => {
    // Concurrency changes when the work happens, not how much of it there
    // is. These figures must not move when two cards share a stage.
    expect(rollup.personDays).toBe(sequential.personDays);
    expect(rollup.personDays).toBe(70); // 6x5 + 10x4
    expect(rollup.labourDays).toBe(sequential.labourDays);
    expect(rollup.labourDays).toBe(9);
    expect(rollup.subtotal).toBe(sequential.subtotal);
    expect(rollup.subtotalWithMarkup).toBe(sequential.subtotalWithMarkup);
    expect(rollup.subtotalWithMarkup).toBe(115_000);
    expect(rollup.cardCount).toBe(2);
    expect(rollup.itemCount).toBe(7);
  });

  it("does not re-derive labour days from person-days and the summed crew", () => {
    // 70 / 16 = 4.375 would badly understate nine days of work.
    expect(rollup.labourDays).not.toBeCloseTo(rollup.personDays / rollup.peakCrew);
  });
});

describe("THREE STAGES, THE MIDDLE ONE HOLDING TWO CARDS — both rules in one fold", () => {
  // dem1 | dem2 + dem4 | dem3. Stage order is the card order; no separate
  // order field exists or is needed.
  const mixed = [
    DEM1,
    { ...DEM2, stageKey: "mid" },
    { ...DEM4, stageKey: "mid" },
    DEM3
  ];
  const rollup = rollUpDiscipline(mixed);

  it("builds three stages, in card order, with two cards in the middle", () => {
    const stages = groupCardsIntoStages(mixed);
    expect(stages.map((s) => s.map((c) => c.cardId))).toEqual([
      ["dem1"],
      ["dem2", "dem4"],
      ["dem3"]
    ]);
  });

  it("PEAK CREW: sums inside the middle stage, then maxes across the three", () => {
    // stage crews 6 | 10 + 7 = 17 | 8  ->  17.
    expect(rollup.peakCrew).toBe(17);
    // Not the flat max over cards (10), and not the sum of every card (31).
    expect(rollup.peakCrew).not.toBe(10);
    expect(rollup.peakCrew).not.toBe(31);
  });

  it("DURATION: maxes inside the middle stage, then sums across the three", () => {
    // stage durations 5 | max(4, 2.5) = 4 | 6  ->  15.
    expect(rollup.duration).toBe(15);
    // The flat fold summed all four cards: 17.5. Overlapping dem4 with dem2
    // takes 2.5 days out of the programme.
    expect(rollup.duration).not.toBe(17.5);
  });

  it("PLANT: sums inside the middle stage, then maxes across the three", () => {
    const excavator = rollup.plantSummary.find((g) => g.category === "Excavator");
    const truck = rollup.plantSummary.find((g) => g.category === "Truck");

    // Excavator 20t is on dem1/dem2/dem3, one per stage: 2 | 3 | 1 -> 3.
    expect(excavator!.items.find((i) => i.variant === "20t")).toEqual({
      variant: "20t",
      peakQty: 3,
      peakDays: 15 // 5 + 4 + 6
    });
    // Excavator 5t is only on dem4, alone in its category within the stage.
    expect(excavator!.items.find((i) => i.variant === "5t")).toEqual({
      variant: "5t",
      peakQty: 2,
      peakDays: 2.5
    });
    // Truck is on dem2 AND dem4, which now share a stage: 1 + 2 = 3 at once,
    // where the flat fold peaked at max(1, 2) = 2.
    expect(truck!.items).toEqual([{ variant: null, peakQty: 3, peakDays: 6.5 }]);
  });

  it("keeps the API's category and variant ordering", () => {
    expect(rollup.plantSummary.map((g) => g.category)).toEqual(["Excavator", "Truck"]);
    expect(rollup.plantSummary[0].items.map((i) => i.variant)).toEqual(["20t", "5t"]);
  });

  it("leaves every SUMMED figure identical to the all-singleton fold", () => {
    // Grouping cards changes peaks and duration only. Work, money and
    // counts are the same programme either way.
    const allSingleton = rollUpDiscipline(DEM_DISCIPLINE);
    expect(rollup.cardCount).toBe(allSingleton.cardCount);
    expect(rollup.itemCount).toBe(allSingleton.itemCount);
    expect(rollup.personDays).toBe(allSingleton.personDays);
    expect(rollup.personDays).toBe(135.5);
    expect(rollup.labourDays).toBe(allSingleton.labourDays);
    expect(rollup.labourDays).toBe(17.5);
    expect(rollup.subtotal).toBe(allSingleton.subtotal);
    expect(rollup.subtotalWithMarkup).toBe(allSingleton.subtotalWithMarkup);
    expect(rollup.subtotalWithMarkup).toBe(166_750);
  });

  it("counts a card once even if it is repeated inside a stage", () => {
    const repeated = [
      DEM1,
      { ...DEM2, stageKey: "mid" },
      { ...DEM4, stageKey: "mid" },
      { ...DEM2, stageKey: "mid" },
      DEM3
    ];
    expect(rollUpDiscipline(repeated)).toEqual(rollup);
  });
});

describe("groupCardsIntoStages", () => {
  it("gives every card its own stage when no card carries a key", () => {
    expect(groupCardsIntoStages(DEM_DISCIPLINE).map((s) => s.map((c) => c.cardId))).toEqual([
      ["dem1"],
      ["dem2"],
      ["dem3"],
      ["dem4"]
    ]);
  });

  it("returns no stages for no cards", () => {
    expect(groupCardsIntoStages([])).toEqual([]);
  });

  it("places a shared stage where its FIRST card sits — order is card order", () => {
    const cards = [
      { ...DEM1, stageKey: "a" },
      DEM2,
      { ...DEM3, stageKey: "a" }
    ];
    // dem3 joins dem1's stage, which keeps dem1's position ahead of dem2.
    expect(groupCardsIntoStages(cards).map((s) => s.map((c) => c.cardId))).toEqual([
      ["dem1", "dem3"],
      ["dem2"]
    ]);
  });

  it("keeps different stage keys in different stages", () => {
    const cards = [
      { ...DEM1, stageKey: "a" },
      { ...DEM2, stageKey: "b" }
    ];
    expect(groupCardsIntoStages(cards)).toHaveLength(2);
  });

  it("never merges two cards that both say null", () => {
    const cards = [
      { ...DEM1, stageKey: null },
      { ...DEM2, stageKey: null }
    ];
    expect(groupCardsIntoStages(cards)).toHaveLength(2);
  });
});
