// SCOPE_STAGE_AWARE_V1 — pure discipline roll-up arithmetic.
//
// THE MODEL. A discipline is an ordered list of STAGES. A stage holds one
// or more cards. Cards in the SAME stage run AT THE SAME TIME; stages run
// ONE AFTER ANOTHER. Every rule below follows from that single idea:
//
//   figure                   within a stage          across stages
//   ---------------------------------------------------------------------
//   Peak crew                SUM — they are on       MAX — the stages
//                            site together            never coincide
//   Peak plant, per          SUM — two jobs at       MAX — the machine
//     (category, variant)    once need two            moves stage to stage
//                            machines
//   Duration                 MAX — concurrent        SUM — the stages run
//                            cards finish when        end to end
//                            the longest does
//   Person-days              SUM                     SUM
//   Labour days              SUM                     SUM
//   Plant days               SUM                     SUM
//   Money                    SUM                     SUM
//
// Plant DAYS are a duration, not a peak, so they sum in BOTH directions:
// one excavator moving through three stages is on hire for the three
// stages' days added together, while only ever being ONE excavator.
//
// WHERE THE MODEL CAME FROM.
//   Marco, 2026-09-04 (Decision 4): cards inside one discipline are stages
//     of the same job and they run ALWAYS SEQUENTIALLY. DEM1, DEM2, DEM3
//     are one demolition programme in sequence, not three parallel work
//     fronts. Peak crew was therefore a flat max across the cards and
//     duration a flat sum, and concurrency was explicitly not built for.
//   Marco, 2026-09-05: that is NO LONGER a permanent property of the
//     domain. Jobs may run concurrently at some point, and the arithmetic
//     should be able to say so now rather than be retrofitted onto a live
//     estimate later. Sequential is still what happens today — it is just
//     no longer welded into the fold.
//
// WHAT IS TRUE TODAY: EVERY CARD IS ITS OWN STAGE. Nothing in the schema,
// the API or the UI can put two cards into one stage yet, so every stage
// is a singleton. SUM within a singleton stage is just that card's own
// figure, and the table above collapses to exactly the 2026-09-04
// behaviour: peak crew is a MAX over the cards, duration a sum over them.
// That equivalence is pinned field by field, including plantSummary, in
// utils/__tests__/discipline-rollup.test.ts, and it must stay true for as
// long as nothing can group cards. Read this before changing any figure
// below: getting the arithmetic wrong here misprices a tender.
//
// Stage ORDER is not a separate concept and needs no field of its own: it
// is the card order the caller already passes (the tender's sortOrder).
//
// This module is deliberately dependency-free (no React, no API client) so
// the table above is checkable by unit test without rendering anything —
// see __tests__/discipline-rollup.test.ts for the pinned flat-fold figures
// and utils/__tests__/discipline-rollup.test.ts for the stage model.

/** One plant line as `getCardSummary` returns it: per (category, variant). */
export type RollupPlantItem = {
  variant: string | null;
  peakQty: number;
  peakDays: number;
};

/** A plant category group as `getCardSummary` returns it. */
export type RollupPlantGroup = {
  category: string;
  items: RollupPlantItem[];
};

/** The `computed` half of a card summary. Structural — matches
 *  `useScopeCards.getCardSummary`'s return without importing it. */
export type CardComputedSummary = {
  peakCrew: number;
  labourDays: number;
  plantSummary: RollupPlantGroup[];
  duration: number;
};

/** The `overrides` half of a card summary. */
export type CardSummaryOverrides = {
  peakCrewOverride: number | null;
  labourDaysOverride: number | null;
  plantSummaryOverride: string | null;
  durationOverride: number | null;
};

export type CardSummaryEnvelope = {
  computed: CardComputedSummary;
  overrides: CardSummaryOverrides;
};

/** Money + item count for one card — exactly what `computeCardBarStats`
 *  already produces from the items the screen has loaded. */
export type CardMoneyStats = {
  itemCount: number;
  subtotal: number;
  subtotalWithMarkup: number;
};

/**
 * One card's contribution to its discipline. Every figure here is already
 * RESOLVED — the user's override has been applied — so the fold below is
 * pure arithmetic with no precedence rules left in it.
 */
export type CardRollupInput = {
  cardId: string;
  itemCount: number;
  /** Effective peak crew for this card (override ?? computed). */
  peakCrew: number;
  /** Effective labour days for this card (override ?? computed). */
  labourDays: number;
  /** Effective duration in days for this card (override ?? computed). */
  duration: number;
  subtotal: number;
  subtotalWithMarkup: number;
  plantSummary: RollupPlantGroup[];
  /**
   * Which stage this card runs in. Cards that share a stage key run AT THE
   * SAME TIME as one another; `null` — or the field being absent, which is
   * the only thing that happens today — means "a stage of its own".
   *
   * Optional on purpose: nothing can set it to a non-null value yet, so
   * leaving it off means every existing caller keeps compiling and keeps
   * getting exactly the figures it got before. See the header.
   */
  stageKey?: string | null;
};

/** One stage: the cards that run at the same time, in card order. */
export type DisciplineStage = readonly CardRollupInput[];

export type DisciplineRollup = {
  /** How many cards were folded — the stack's length. */
  cardCount: number;
  /** Non-excluded items across every card in the discipline. */
  itemCount: number;
  /** MAX over the stages of the sum of the crews within each stage. With
   *  every card in its own stage — which is every card today — that is
   *  exactly the max of the per-card peak crews. Never a flat sum. */
  peakCrew: number;
  /** Sum of (card peak crew × card labour days). Person-days is not on the
   *  API surface; per card it is exactly peakCrew × labourDays because
   *  getCardSummary defines labourDays = totalPersonDays / peakCrew.
   *  Accumulated per CARD, never per stage: the work is really done under
   *  either model, so this figure is identical in both. */
  personDays: number;
  /** Sum of the per-card labourDays the API already returned. Deliberately
   *  NOT re-derived as personDays / peakCrew — dividing a discipline's
   *  person-days by the discipline's peak crew understates the days
   *  badly. The stage model does not change that. */
  labourDays: number;
  /** Sum over the stages of the MAX duration within each stage. With every
   *  card in its own stage that is exactly the sum of the per-card
   *  durations. */
  duration: number;
  /** Per (category, variant): peakQty is the MAX over stages of the sum
   *  within a stage; peakDays is a plain sum (days are a duration). */
  plantSummary: RollupPlantGroup[];
  subtotal: number;
  subtotalWithMarkup: number;
};

/** Day figures come off the API already rounded to 1dp; summing them can
 *  reintroduce binary-float noise (0.1 + 0.2 = 0.30000000000000004), so
 *  every day figure is re-rounded the same way the API rounds. Money is
 *  NOT rounded here — the bar formats it. Per-stage subtotals are left
 *  UNROUNDED and only the discipline figure is rounded, so introducing a
 *  stage boundary can never add a rounding step the flat fold did not
 *  have. */
export function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

/**
 * Person-days for a single card.
 *
 * `getCardSummary` accumulates `totalPersonDays` and then returns only
 * `labourDays = totalPersonDays / peakCrew` (scope-of-works.service.ts).
 * Person-days is therefore recoverable exactly, per card, as
 * peakCrew × labourDays. It is derived web-side on purpose: adding an API
 * field is outside this slice's gate (`gate_allow: none`).
 */
export function cardPersonDays(peakCrew: number, labourDays: number): number {
  if (!Number.isFinite(peakCrew) || !Number.isFinite(labourDays)) return 0;
  return round1(peakCrew * labourDays);
}

/**
 * Resolve one card's summary + money stats into a `CardRollupInput`,
 * applying the user's per-card overrides.
 *
 * `plantSummaryOverride` is deliberately not folded: it is free text
 * ("2 x 20t excavator, 1 x tip truck"), not a structured (category,
 * variant, peakQty) shape, so there is nothing to take a max of. The
 * discipline plant figure is therefore the max over the COMPUTED plant
 * summaries; a card that overrides its plant text still contributes its
 * computed plant to the roll-up rather than dropping out of it.
 *
 * A missing summary (still loading, or the fetch failed) contributes zero
 * crew/day figures but keeps its money, which comes from items the screen
 * has already loaded and does not depend on the summary call.
 *
 * No `stageKey` is set: nothing can group cards yet, and an absent key
 * already means "a stage of its own".
 */
export function toCardRollupInput(
  cardId: string,
  summary: CardSummaryEnvelope | null | undefined,
  stats: CardMoneyStats
): CardRollupInput {
  const computed = summary?.computed;
  const overrides = summary?.overrides;
  return {
    cardId,
    itemCount: stats.itemCount,
    peakCrew: overrides?.peakCrewOverride ?? computed?.peakCrew ?? 0,
    labourDays: overrides?.labourDaysOverride ?? computed?.labourDays ?? 0,
    duration: overrides?.durationOverride ?? computed?.duration ?? 0,
    subtotal: stats.subtotal,
    subtotalWithMarkup: stats.subtotalWithMarkup,
    plantSummary: computed?.plantSummary ?? []
  };
}

export const EMPTY_DISCIPLINE_ROLLUP: DisciplineRollup = {
  cardCount: 0,
  itemCount: 0,
  peakCrew: 0,
  personDays: 0,
  labourDays: 0,
  duration: 0,
  plantSummary: [],
  subtotal: 0,
  subtotalWithMarkup: 0
};

/**
 * Group a flat, ordered card list into stages.
 *
 * A card with no `stageKey` — every card today — gets a stage of its own.
 * Cards sharing a non-null key land in ONE stage, which takes the position
 * of the first card carrying that key: stage order is the card order, not
 * a separate field.
 */
export function groupCardsIntoStages(cards: readonly CardRollupInput[]): DisciplineStage[] {
  const stages: CardRollupInput[][] = [];
  const byKey = new Map<string, CardRollupInput[]>();

  for (const card of cards) {
    const key = card.stageKey ?? null;
    if (key === null) {
      stages.push([card]);
      continue;
    }
    const existing = byKey.get(key);
    if (existing) {
      existing.push(card);
      continue;
    }
    const stage = [card];
    byKey.set(key, stage);
    stages.push(stage);
  }

  return stages;
}

/** One (category, variant) line mid-fold. `peakQty` means whatever the
 *  level doing the folding needs it to mean — a card's own peak, a stage's
 *  concurrent total, or the discipline's max across stages. */
type VariantAccum = { variant: string | null; peakQty: number; totalDays: number };

/** category -> (variant ?? "") -> accumulator. Nested rather than a joined
 *  string key so no category/variant pair can ever collide with another. */
type PlantAccumMap = Map<string, Map<string, VariantAccum>>;

/** Find or create the accumulator for one (category, variant). The FIRST
 *  variant value seen for a key wins, which is how the flat fold behaved
 *  when a null variant and an empty-string variant shared a key. */
function plantAccum(
  map: PlantAccumMap,
  category: string,
  variantKey: string,
  variant: string | null
): VariantAccum {
  let variants = map.get(category);
  if (!variants) {
    variants = new Map<string, VariantAccum>();
    map.set(category, variants);
  }
  let accum = variants.get(variantKey);
  if (!accum) {
    accum = { variant, peakQty: 0, totalDays: 0 };
    variants.set(variantKey, accum);
  }
  return accum;
}

/**
 * Fold ONE card's plant summary down to that card's own peak per
 * (category, variant).
 *
 * A card that lists the same (category, variant) twice peaks at the LARGER
 * of the two — that is one card's own peak, not two machines — while its
 * days add. This is precisely what the flat fold did within a single card,
 * pulled out here so that a stage of one card contributes exactly what it
 * contributed before stages existed.
 */
function foldCardPlant(card: CardRollupInput): PlantAccumMap {
  const out: PlantAccumMap = new Map();
  for (const group of card.plantSummary ?? []) {
    for (const item of group.items ?? []) {
      const accum = plantAccum(out, group.category, item.variant ?? "", item.variant);
      if (item.peakQty > accum.peakQty) accum.peakQty = item.peakQty;
      accum.totalDays += item.peakDays;
    }
  }
  return out;
}

/**
 * Fold the STAGES of ONE discipline into a single roll-up. This is the
 * stage-aware core; `rollUpDiscipline` is the flat-list wrapper over it.
 *
 * The caller filters to a discipline first — this function is
 * discipline-agnostic and folds exactly the stages it is handed. A card id
 * that appears twice ANYWHERE in the input is folded once: double-counting
 * a stage is the failure mode this module exists to prevent, and silently
 * doubling a discipline's money is worse than ignoring a duplicate.
 */
export function rollUpDisciplineStages(stages: readonly DisciplineStage[]): DisciplineRollup {
  const plant: PlantAccumMap = new Map();
  const seen = new Set<string>();

  let cardCount = 0;
  let itemCount = 0;
  let peakCrew = 0;
  let personDays = 0;
  let labourDays = 0;
  let duration = 0;
  let subtotal = 0;
  let subtotalWithMarkup = 0;

  for (const stage of stages) {
    // WITHIN a stage: crew and plant quantity SUM (the cards are on site
    // together) and duration MAXES (the stage ends when its longest card
    // ends). Every other figure sums the same way within a stage as it
    // does across stages, so it goes straight into the discipline total.
    let stageCrew = 0;
    let stageDuration = 0;
    const stagePlant: PlantAccumMap = new Map();

    for (const card of stage) {
      if (seen.has(card.cardId)) continue;
      seen.add(card.cardId);
      cardCount += 1;

      itemCount += card.itemCount;
      stageCrew += card.peakCrew;
      if (card.duration > stageDuration) stageDuration = card.duration;

      personDays += cardPersonDays(card.peakCrew, card.labourDays);
      labourDays += card.labourDays;
      subtotal += card.subtotal;
      subtotalWithMarkup += card.subtotalWithMarkup;

      for (const [category, variants] of foldCardPlant(card)) {
        for (const [variantKey, cardLine] of variants) {
          const accum = plantAccum(stagePlant, category, variantKey, cardLine.variant);
          // Concurrent cards each need their own machine, so quantities add.
          accum.peakQty += cardLine.peakQty;
          // Days are a duration: they sum within a stage AND across stages.
          accum.totalDays += cardLine.totalDays;
        }
      }
    }

    // ACROSS stages: crew and plant quantity MAX (the stages never
    // coincide, so the job never needs more than its biggest stage) and
    // duration SUMS (the stages run end to end).
    if (stageCrew > peakCrew) peakCrew = stageCrew;
    duration += stageDuration;

    for (const [category, variants] of stagePlant) {
      for (const [variantKey, stageLine] of variants) {
        const accum = plantAccum(plant, category, variantKey, stageLine.variant);
        if (stageLine.peakQty > accum.peakQty) accum.peakQty = stageLine.peakQty;
        accum.totalDays += stageLine.totalDays;
      }
    }
  }

  // Categories and variants sorted the same way the API sorts them, so the
  // discipline bar reads in the same order as a card header.
  const plantSummary: RollupPlantGroup[] = [...plant.keys()].sort().map((category) => {
    const variants = plant.get(category)!;
    return {
      category,
      items: [...variants.keys()].sort().map((key) => {
        const accum = variants.get(key)!;
        return {
          variant: accum.variant,
          peakQty: accum.peakQty,
          peakDays: round1(accum.totalDays)
        };
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

/**
 * Fold every card of ONE discipline into a single roll-up.
 *
 * This is the flat-list signature every call site already uses. It groups
 * the cards into stages by their `stageKey` and defers to
 * `rollUpDisciplineStages`. With no card carrying a stage key — which is
 * every card today — each card becomes its own singleton stage, and this
 * returns field for field exactly what the pre-stage flat fold returned.
 */
export function rollUpDiscipline(cards: readonly CardRollupInput[]): DisciplineRollup {
  return rollUpDisciplineStages(groupCardsIntoStages(cards));
}

// ── Discipline grouping (drives the tab strip) ──────────────────────────

/**
 * The discipline codes that have at least one card, in canonical order.
 *
 * `canonicalOrder` is `DISCIPLINE_CODES` from utils/card-display.ts, itself
 * re-exported from constants/disciplines.ts — the single source of truth.
 * Any discipline present on a card but ABSENT from that tuple (legacy or
 * hand-edited data) is appended, sorted, rather than dropped: a discipline
 * that silently disappears takes its money with it.
 */
export function disciplinesWithCards<T extends { discipline: string }>(
  cards: readonly T[],
  canonicalOrder: readonly string[]
): string[] {
  const present = new Set(cards.map((c) => c.discipline));
  const ordered = canonicalOrder.filter((code) => present.has(code));
  const known = new Set(ordered);
  const extras = [...present].filter((code) => !known.has(code)).sort();
  return [...ordered, ...extras];
}

/** The cards of one discipline, in the order they were given (the tender's
 *  sortOrder) — which is the stage sequence the stack renders. */
export function cardsInDiscipline<T extends { discipline: string }>(
  cards: readonly T[],
  discipline: string
): T[] {
  return cards.filter((c) => c.discipline === discipline);
}

/**
 * Resolve an inbound `?card=` value to a discipline.
 *
 * The parameter used to name a card. Keeping a card id working as an
 * inbound value means an existing deep link still lands on the discipline
 * that contains it rather than on an empty screen. Order of preference:
 * an exact discipline code that has cards → the discipline of a card with
 * that id → the first discipline that has cards.
 */
export function resolveDisciplineFromParam<T extends { id: string; discipline: string }>(
  param: string | null,
  cards: readonly T[],
  canonicalOrder: readonly string[]
): string | null {
  const available = disciplinesWithCards(cards, canonicalOrder);
  if (available.length === 0) return null;
  if (param) {
    if (available.includes(param)) return param;
    const card = cards.find((c) => c.id === param);
    if (card && available.includes(card.discipline)) return card.discipline;
  }
  return available[0] ?? null;
}
