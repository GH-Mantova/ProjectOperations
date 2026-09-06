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
  groupWithPreviousPatches,
  nextStageGroup,
  rollUpDiscipline,
  rollUpDisciplineStages,
  round1,
  sharesStageWithPrevious,
  stageKeyForGroup,
  toCardRollupInput,
  ungroupPatches,
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
    provisionalSubtotal: 0,
    provisionalWithMarkup: 0,
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
    // SCOPE_STAGE_GROUP_V1 — `stageCount` is new on DisciplineRollup and is
    // NOT a figure: no money, crew, day or plant quantity depends on it.
    // The flat fold had EVERY card in its own stage, so the stage count it
    // would have reported is exactly its card count — which is the same
    // claim the module makes for an ungrouped discipline. Stating it here
    // rather than deleting the whole-object assertion below keeps that
    // assertion STRICT, so a real figure still cannot escape it.
    stageCount: cardCount,
    itemCount,
    peakCrew,
    personDays: round1(personDays),
    labourDays: round1(labourDays),
    duration: round1(duration),
    plantSummary,
    subtotal,
    subtotalWithMarkup,
    // SCOPE_PROVISIONAL_SPLIT_V1 — the test data carries no provisional
    // figures (all zeros by makeCard's default), so both sides are 0 and
    // the whole-object comparison in "matches it whole-object too" remains
    // strict: a field left out of either return would fail that assertion.
    provisionalSubtotal: 0,
    provisionalWithMarkup: 0
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
  expect(actual.stageCount).toBe(expected.stageCount);
  expect(actual.itemCount).toBe(expected.itemCount);
  expect(actual.peakCrew).toBe(expected.peakCrew);
  expect(actual.personDays).toBe(expected.personDays);
  expect(actual.labourDays).toBe(expected.labourDays);
  expect(actual.duration).toBe(expected.duration);
  expect(actual.subtotal).toBe(expected.subtotal);
  expect(actual.subtotalWithMarkup).toBe(expected.subtotalWithMarkup);
  // SCOPE_PROVISIONAL_SPLIT_V1 — the equivalence this module's header demands
  // covers these new fields: an ungrouped discipline must fold field for field
  // to the pre-stage figures, provisional figures included.
  expect(actual.provisionalSubtotal).toBe(expected.provisionalSubtotal);
  expect(actual.provisionalWithMarkup).toBe(expected.provisionalWithMarkup);
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

// ── SCOPE_STAGE_GROUP_V1 — a stage that holds MORE THAN ONE card ───────
//
// Slice 1 shipped the stage arithmetic with every card in a stage of its
// own, so no figure could move. This slice adds `ScopeCard.stageGroup` —
// the one thing that lets a stage hold two cards — so from here the fold
// has a second branch to pin: what happens when a human says two cards run
// at the same time.
//
// The discipline below is the FIRST THREE cards of DEM_DISCIPLINE above.
// It is folded twice: ungrouped (which must equal the flat fold, exactly
// as it does today) and with DEM1 and DEM2 sharing one stage. Every figure
// is written out longhand so the arithmetic is checkable by eye, and the
// two folds are diffed field by field so nothing moves that should not.

const THREE_CARD_DEM = [DEM1, DEM2, DEM3];

/** The same three cards with DEM1 and DEM2 in ONE stage — a human has said
 *  they run at the same time — and DEM3 still in a stage of its own. */
const TWO_OF_THREE_GROUPED: CardRollupInput[] = [
  { ...DEM1, stageKey: "g1" },
  { ...DEM2, stageKey: "g1" },
  { ...DEM3, stageKey: null }
];

describe("grouping two of three cards moves exactly the figures the stage model says", () => {
  const before = rollUpDiscipline(THREE_CARD_DEM);
  const after = rollUpDiscipline(TWO_OF_THREE_GROUPED);

  it("BEFORE: three ungrouped cards read exactly as the flat fold does", () => {
    // The regression guard. If this ever needs editing, an ungrouped
    // discipline's figures have moved and the slice is wrong.
    expectSameRollup(before, flatFoldAsShippedOnMain(THREE_CARD_DEM));
    expect(before.cardCount).toBe(3);
    expect(before.stageCount).toBe(3); // three cards, three stages
    expect(before.itemCount).toBe(12); // 4 + 3 + 5
    expect(before.peakCrew).toBe(10); // max(6, 10, 8)
    expect(before.duration).toBe(15); // 5 + 4 + 6, end to end
    expect(before.personDays).toBe(118); // 6x5 + 10x4 + 8x6
    expect(before.labourDays).toBe(15); // 5 + 4 + 6
    expect(before.subtotal).toBe(130_000);
    expect(before.subtotalWithMarkup).toBe(149_500);
    expect(before.plantSummary).toEqual([
      { category: "Excavator", items: [{ variant: "20t", peakQty: 3, peakDays: 15 }] }, // max(2,3,1); 5+4+6
      { category: "Truck", items: [{ variant: null, peakQty: 1, peakDays: 4 }] }
    ]);
  });

  it("AFTER: three cards now form TWO stages", () => {
    expect(after.cardCount).toBe(3); // the cards did not go anywhere
    expect(after.stageCount).toBe(2); // [DEM1 + DEM2], [DEM3]
  });

  it("PEAK CREW RISES 10 -> 16: the grouped cards are on site together", () => {
    // stage 1 = DEM1 + DEM2 = 6 + 10 = 16 crew, on site at once.
    // stage 2 = DEM3        = 8 crew.
    // discipline = max(16, 8) = 16. It is NOT 6 + 10 + 8 = 24: the two
    // stages still never coincide.
    expect(after.peakCrew).toBe(16);
    expect(after.peakCrew).toBeGreaterThan(before.peakCrew);
    expect(after.peakCrew).not.toBe(24);
  });

  it("DURATION FALLS 15 -> 11: the grouped stage is counted once", () => {
    // stage 1 = max(5, 4) = 5 days — DEM2 finishes inside DEM1's window.
    // stage 2 = 6 days.
    // discipline = 5 + 6 = 11, four days shorter than the sequential 15.
    expect(after.duration).toBe(11);
    expect(before.duration - after.duration).toBe(4);
  });

  it("PLANT QUANTITY RISES 3 -> 5: two concurrent jobs need two machines", () => {
    // stage 1 excavators = 2 + 3 = 5 twenty-tonners at once.
    // stage 2 excavators = 1.
    // discipline peak = max(5, 1) = 5.
    // Plant DAYS are a duration, not a peak, so they SUM in both
    // directions and are unchanged at 5 + 4 + 6 = 15 — the machines are on
    // hire for the same total time either way.
    expect(after.plantSummary).toEqual([
      { category: "Excavator", items: [{ variant: "20t", peakQty: 5, peakDays: 15 }] },
      { category: "Truck", items: [{ variant: null, peakQty: 1, peakDays: 4 }] }
    ]);
    const excavatorBefore = before.plantSummary[0].items[0];
    const excavatorAfter = after.plantSummary[0].items[0];
    expect(excavatorBefore.peakQty).toBe(3);
    expect(excavatorAfter.peakQty).toBe(5);
    expect(excavatorAfter.peakDays).toBe(excavatorBefore.peakDays); // 15, unmoved
  });

  it("MONEY DOES NOT MOVE — grouping is a programme fact, not a price", () => {
    expect(after.subtotal).toBe(before.subtotal);
    expect(after.subtotalWithMarkup).toBe(before.subtotalWithMarkup);
    expect(after.subtotal).toBe(130_000);
    expect(after.subtotalWithMarkup).toBe(149_500);
  });

  it("PERSON-DAYS AND LABOUR DAYS DO NOT MOVE — the work is still done", () => {
    // Accumulated per CARD, never per stage. Running two cards at once
    // changes when the work happens, not how much of it there is.
    expect(after.personDays).toBe(before.personDays);
    expect(after.labourDays).toBe(before.labourDays);
    expect(after.personDays).toBe(118);
    expect(after.labourDays).toBe(15);
  });

  it("ITEM COUNT DOES NOT MOVE", () => {
    expect(after.itemCount).toBe(before.itemCount);
    expect(after.itemCount).toBe(12);
  });

  it("moves peak crew, duration and plant quantity AND NOTHING ELSE", () => {
    // The exhaustive version of the six tests above: every field of the
    // roll-up is compared, and exactly the three the stage model predicts
    // are allowed to differ.
    const moved = (Object.keys(before) as Array<keyof DisciplineRollup>).filter(
      (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
    );
    expect(moved.sort()).toEqual(["duration", "peakCrew", "plantSummary", "stageCount"]);
  });

  it("ungrouping the pair again restores every figure exactly", () => {
    const regrouped = TWO_OF_THREE_GROUPED.map((card) => ({ ...card, stageKey: null }));
    expectSameRollup(rollUpDiscipline(regrouped), before);
  });

  it("a group of ONE folds identically to no group at all", () => {
    // A user who ungroups half a pair leaves the other card alone in its
    // group. That must read exactly as null does, or ungrouping would
    // half-work.
    const loner = [{ ...DEM1, stageKey: "g1" }, DEM2, DEM3];
    expectSameRollup(rollUpDiscipline(loner), before);
  });
});

// ── The stageGroup -> stageKey mapping ─────────────────────────────────

describe("stageKeyForGroup", () => {
  it("maps null and undefined to null — a stage of its own", () => {
    expect(stageKeyForGroup(null)).toBeNull();
    expect(stageKeyForGroup(undefined)).toBeNull();
  });

  it("maps equal group ids to the SAME key, so they share a stage", () => {
    expect(stageKeyForGroup(4)).toBe(stageKeyForGroup(4));
    expect(groupCardsIntoStages([
      { ...DEM1, stageKey: stageKeyForGroup(4) },
      { ...DEM2, stageKey: stageKeyForGroup(4) }
    ])).toHaveLength(1);
  });

  it("maps different group ids to different keys", () => {
    expect(stageKeyForGroup(4)).not.toBe(stageKeyForGroup(5));
  });

  it("maps 0 to a real key, not to null — 0 is a group id, not 'ungrouped'", () => {
    expect(stageKeyForGroup(0)).not.toBeNull();
  });
});

describe("toCardRollupInput carries the card's stageGroup through", () => {
  const stats = { itemCount: 1, subtotal: 10, subtotalWithMarkup: 11 };

  it("gives a card with no stageGroup a stage of its own", () => {
    expect(toCardRollupInput("c1", null, stats).stageKey).toBeNull();
    expect(toCardRollupInput("c1", null, stats, null).stageKey).toBeNull();
  });

  it("turns a non-null stageGroup into a shared stage key", () => {
    const a = toCardRollupInput("c1", null, stats, 3);
    const b = toCardRollupInput("c2", null, stats, 3);
    expect(a.stageKey).toBe(b.stageKey);
    expect(groupCardsIntoStages([a, b])).toHaveLength(1);
  });
});

// ── The grouping control's decision procedure ──────────────────────────
//
// "Group this card with the one above it" is the whole feature. These are
// the rules behind that one button.

describe("nextStageGroup", () => {
  it("starts at 1 when nothing is grouped", () => {
    expect(nextStageGroup([{ id: "a" }, { id: "b", stageGroup: null }])).toBe(1);
    expect(nextStageGroup([])).toBe(1);
  });

  it("is one past the largest id in use, tender-wide", () => {
    expect(nextStageGroup([{ id: "a", stageGroup: 3 }, { id: "b", stageGroup: 7 }])).toBe(8);
  });

  it("never reuses an id already held by a card in another discipline", () => {
    const tender = [
      { id: "dem1", stageGroup: 2 },
      { id: "civ1", stageGroup: 9 } // another discipline entirely
    ];
    expect(nextStageGroup(tender)).toBe(10);
  });
});

describe("sharesStageWithPrevious", () => {
  const grouped = [
    { id: "a", stageGroup: 1 },
    { id: "b", stageGroup: 1 },
    { id: "c", stageGroup: null }
  ];

  it("is false for the first card — there is nothing above it", () => {
    expect(sharesStageWithPrevious(grouped, "a")).toBe(false);
  });

  it("is true when this card and the one above hold the same non-null id", () => {
    expect(sharesStageWithPrevious(grouped, "b")).toBe(true);
  });

  it("is false when this card is ungrouped", () => {
    expect(sharesStageWithPrevious(grouped, "c")).toBe(false);
  });

  it("is false when BOTH are null — two nulls are two stages, not one", () => {
    expect(
      sharesStageWithPrevious([{ id: "a" }, { id: "b" }], "b")
    ).toBe(false);
  });

  it("is false when the two ids differ", () => {
    expect(
      sharesStageWithPrevious([{ id: "a", stageGroup: 1 }, { id: "b", stageGroup: 2 }], "b")
    ).toBe(false);
  });
});

describe("groupWithPreviousPatches", () => {
  it("writes BOTH cards when neither is grouped yet", () => {
    const cards = [{ id: "a" }, { id: "b" }];
    expect(groupWithPreviousPatches(cards, "b", 5)).toEqual([
      { cardId: "a", stageGroup: 5 },
      { cardId: "b", stageGroup: 5 }
    ]);
  });

  it("writes only THIS card when the one above already has a group", () => {
    // Adds a third card to an existing pair without disturbing it.
    const cards = [{ id: "a", stageGroup: 2 }, { id: "b", stageGroup: 2 }, { id: "c" }];
    expect(groupWithPreviousPatches(cards, "c", 5)).toEqual([{ cardId: "c", stageGroup: 2 }]);
  });

  it("writes nothing for the first card of a discipline", () => {
    expect(groupWithPreviousPatches([{ id: "a" }, { id: "b" }], "a", 5)).toEqual([]);
  });

  it("writes nothing when the cards already share a stage", () => {
    const cards = [{ id: "a", stageGroup: 1 }, { id: "b", stageGroup: 1 }];
    expect(groupWithPreviousPatches(cards, "b", 5)).toEqual([]);
  });

  it("writes nothing for a card that is not in the discipline", () => {
    expect(groupWithPreviousPatches([{ id: "a" }], "zzz", 5)).toEqual([]);
  });

  it("produces a grouping the fold actually reads as one stage", () => {
    // End to end: the patches this returns, applied to the cards, must make
    // groupCardsIntoStages put the two cards together.
    const cards = [{ id: "dem1" }, { id: "dem2" }, { id: "dem3" }];
    const patches = groupWithPreviousPatches(cards, "dem2", nextStageGroup(cards));
    const byId = new Map(patches.map((p) => [p.cardId, p.stageGroup]));
    const folded = groupCardsIntoStages(
      [DEM1, DEM2, DEM3].map((card) => ({
        ...card,
        stageKey: stageKeyForGroup(byId.get(card.cardId) ?? null)
      }))
    );
    expect(folded.map((stage) => stage.map((c) => c.cardId))).toEqual([
      ["dem1", "dem2"],
      ["dem3"]
    ]);
  });
});

describe("ungroupPatches", () => {
  it("clears only the card asked for", () => {
    const cards = [{ id: "a", stageGroup: 1 }, { id: "b", stageGroup: 1 }];
    expect(ungroupPatches(cards, "b")).toEqual([{ cardId: "b", stageGroup: null }]);
  });

  it("writes nothing for a card that is already ungrouped", () => {
    expect(ungroupPatches([{ id: "a", stageGroup: null }], "a")).toEqual([]);
    expect(ungroupPatches([{ id: "a" }], "a")).toEqual([]);
  });

  it("writes nothing for an unknown card", () => {
    expect(ungroupPatches([{ id: "a", stageGroup: 1 }], "zzz")).toEqual([]);
  });
});

// ── SCOPE_PROVISIONAL_SPLIT_V1 — provisional fields in the roll-up ──────
//
// provisionalSubtotal and provisionalWithMarkup sum per card and across cards
// and across stages (money sums in both directions — no stage logic needed).
// The equivalence this module's header demands — ungrouped == flat fold — is
// already extended to these fields in expectSameRollup above.

const PROV1 = makeCard({
  cardId: "prov1",
  subtotal: 100_000,
  subtotalWithMarkup: 115_000,
  provisionalSubtotal: 30_000,
  provisionalWithMarkup: 34_500
});
const PROV2 = makeCard({
  cardId: "prov2",
  subtotal: 60_000,
  subtotalWithMarkup: 69_000,
  provisionalSubtotal: 10_000,
  provisionalWithMarkup: 11_500
});
const PROV3 = makeCard({
  cardId: "prov3",
  subtotal: 40_000,
  subtotalWithMarkup: 46_000,
  provisionalSubtotal: 40_000,
  provisionalWithMarkup: 46_000 // all-provisional card
});

describe("SCOPE_PROVISIONAL_SPLIT_V1 — provisional fields sum across cards", () => {
  const rollup = rollUpDiscipline([PROV1, PROV2, PROV3]);

  it("provisionalSubtotal sums across cards", () => {
    // 30000 + 10000 + 40000
    expect(rollup.provisionalSubtotal).toBe(80_000);
  });

  it("provisionalWithMarkup sums across cards", () => {
    // 34500 + 11500 + 46000
    expect(rollup.provisionalWithMarkup).toBe(92_000);
  });

  it("provisional <= total — on mixed and all-provisional cards", () => {
    expect(rollup.provisionalWithMarkup).toBeLessThanOrEqual(rollup.subtotalWithMarkup);
    expect(rollup.provisionalSubtotal).toBeLessThanOrEqual(rollup.subtotal);
  });

  it("a card that appears twice is counted ONCE — duplicate guard covers provisional fields", () => {
    const doubled = rollUpDiscipline([PROV1, PROV2, PROV3, PROV2]);
    // PROV2 seen twice — must be folded once.
    expect(doubled.provisionalWithMarkup).toBe(rollup.provisionalWithMarkup);
    expect(doubled.provisionalSubtotal).toBe(rollup.provisionalSubtotal);
  });

  it("provisional fields sum across stages exactly as they do across cards", () => {
    // Group PROV1 and PROV2 into one stage, PROV3 remains its own stage.
    const grouped = [
      { ...PROV1, stageKey: "g1" },
      { ...PROV2, stageKey: "g1" },
      { ...PROV3, stageKey: null }
    ];
    const r = rollUpDiscipline(grouped);
    // Money (including provisional) sums regardless of stage grouping.
    expect(r.provisionalSubtotal).toBe(rollup.provisionalSubtotal);
    expect(r.provisionalWithMarkup).toBe(rollup.provisionalWithMarkup);
  });

  it("an ungrouped discipline folds field for field to the pre-stage figures", () => {
    // The module header's equivalence: every card in its own stage == flat fold.
    // expectSameRollup now covers provisionalSubtotal and provisionalWithMarkup.
    const allSingleton = rollUpDiscipline([PROV1, PROV2, PROV3]);
    const flat = rollUpDisciplineStages([[PROV1], [PROV2], [PROV3]]);
    expectSameRollup(allSingleton, flat);
  });
});
