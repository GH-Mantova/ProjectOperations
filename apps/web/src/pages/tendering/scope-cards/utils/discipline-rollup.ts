// SCOPE_DISCIPLINE_STACK_V1 — pure discipline roll-up arithmetic.
//
// THE DOMAIN FACT THIS FILE ENCODES (Marco, 2026-09-04, Decision 4):
// cards inside one discipline are STAGES OF THE SAME JOB and they run
// ALWAYS SEQUENTIALLY. DEM1, DEM2, DEM3 are one demolition programme in
// sequence, not three parallel work fronts. Everything below follows from
// that single fact:
//
//   Peak crew   → max() across the cards. NEVER a sum. The stages never
//                 run at once, so the job never needs more than the
//                 largest stage's crew. Summing a three-stage demolition
//                 claims roughly triple the real peak.
//   Peak plant  → max() of peakQty per (category, variant). Never a sum:
//                 the same machine moves from stage to stage.
//   Person-days → sum. Every stage's work is really done.
//   Labour days → sum.
//   Duration    → sum. Stages run end to end, so the programme is as long
//                 as all of them together.
//   Money       → sum. Money is money.
//
// Plant DAYS are a duration, not a peak, so they follow the Duration rule
// and sum: one excavator moving through three stages is on hire for the
// three stages' days added together, while only ever being ONE excavator.
//
// No stage-order field and no dates are needed — sequence is a property of
// the job, not data to be captured. Overlapping stages are explicitly not
// built for.
//
// This module is deliberately dependency-free (no React, no API client) so
// the table above is checkable by unit test without rendering anything —
// see __tests__/discipline-rollup.test.ts.

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
};

export type DisciplineRollup = {
  /** How many cards were folded — the stack's length. */
  cardCount: number;
  /** Non-excluded items across every card in the discipline. */
  itemCount: number;
  /** MAX of the per-card peak crews. Never a sum. */
  peakCrew: number;
  /** Σ (card peak crew × card labour days). Person-days is not on the API
   *  surface; per card it is exactly peakCrew × labourDays because
   *  getCardSummary defines labourDays = totalPersonDays / peakCrew. */
  personDays: number;
  /** Σ of the per-card labourDays the API already returned. Deliberately
   *  NOT re-derived as personDays / peakCrew — dividing a discipline's
   *  person-days by the discipline's MAX peak crew understates the days
   *  badly. */
  labourDays: number;
  /** Σ of the per-card durations. */
  duration: number;
  /** Per (category, variant): max(peakQty), Σ(peakDays). */
  plantSummary: RollupPlantGroup[];
  subtotal: number;
  subtotalWithMarkup: number;
};

/** Day figures come off the API already rounded to 1dp; summing them can
 *  reintroduce binary-float noise (0.1 + 0.2 = 0.30000000000000004), so
 *  every day figure is re-rounded the same way the API rounds. Money is
 *  NOT rounded here — the bar formats it. */
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
 * Fold every card of ONE discipline into a single roll-up.
 *
 * The caller filters to a discipline first — this function is
 * discipline-agnostic and folds exactly the cards it is handed. A card id
 * that appears twice in the input is folded once: double-counting a stage
 * is the failure mode this slice exists to prevent, and silently doubling
 * a discipline's money is worse than ignoring a duplicate.
 */
export function rollUpDiscipline(cards: readonly CardRollupInput[]): DisciplineRollup {
  if (cards.length === 0) return { ...EMPTY_DISCIPLINE_ROLLUP, plantSummary: [] };

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
    // max — NEVER a sum. See the header comment.
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
        // max — the same machine moves from stage to stage.
        if (item.peakQty > accum.peakQty) accum.peakQty = item.peakQty;
        // sum — the machine is on hire for every stage's days.
        accum.totalDays += item.peakDays;
        variants.set(key, accum);
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
