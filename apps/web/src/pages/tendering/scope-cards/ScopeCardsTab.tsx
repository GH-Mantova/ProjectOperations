import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { readApiErrorMessage } from "../../../lib/api-errors";
import { Skeleton } from "@project-ops/ui";
import { useAuth } from "../../../auth/AuthContext";
import { useConfirm } from "../../../hooks/useConfirm";
import { OverrideField } from "../../../components";
import { ScopeCardTabsRow } from "./ScopeCardTabsRow";
import { ScopeCardEmptyState, ScopeCardRatesRequiredEmptyState } from "./ScopeCardEmptyState";
import { ChangeDisciplineModal } from "./ChangeDisciplineModal";
import { getRateSet, lockRateSet } from "../ratesTabApi";
import { useScopeCards, type ScopeCard, type ScopeCardSummary } from "./useScopeCards";
import { useTenderEstimate } from "./useTenderEstimate";
import {
  ScopeQuantitiesTable,
  resolveCardMarkup,
  showsCuttingColumn,
  type Discipline as TableDiscipline,
  type ScopeItem as TableItem
} from "../ScopeQuantitiesTable";
import { ScopeWasteTab } from "../ScopeWasteTab";
import { ScopeCuttingSheet } from "../ScopeCuttingSheet";
import { OtherOperationalCosts } from "./OtherOperationalCosts";
import {
  DISCIPLINE_CODES,
  DISCIPLINE_LABELS,
  formatCardCode,
  formatPlantSummary,
  type PlantSummaryGroup
} from "./utils/card-display";
import {
  DisciplineSummaryBar,
  computeCardBarStats,
  fmtCurrency,
  type CardBarStats
} from "./DisciplineSummaryBar";
import {
  cardsInDiscipline,
  groupWithPreviousPatches,
  nextStageGroup,
  resolveDisciplineFromParam,
  rollUpDiscipline,
  sharesStageWithPrevious,
  toCardRollupInput,
  ungroupPatches
} from "./utils/discipline-rollup";

// SCOPE_DISCIPLINE_STACK_V1 — main Scope of Works container.
//
// Marco, 2026-09-04, Decision 4(a): one tab per DISCIPLINE; every card in
// that discipline stacks down the page, each card independently collapsible,
// with a discipline roll-up bar above the stack and a card total on each
// card. This replaces PR B1.5's one-tab-per-card / one-card-visible screen —
// an estimator could not see the three stages of one demolition programme
// together, and nothing told them what the discipline as a whole cost.
//
// The domain fact the roll-up rests on: cards inside a discipline are STAGES
// OF THE SAME JOB and run ALWAYS SEQUENTIALLY. Peak crew and peak plant are
// therefore a MAX across the stack and never a sum; days and money are sums.
// The arithmetic lives in utils/discipline-rollup.ts as a pure function so it
// is unit-testable without rendering, and this file only feeds it.
//
// The existing ScopeQuantitiesTable, ScopeWasteTab and ScopeCuttingSheet are
// still reused as-is, scoped per card via cardId / wbsRef filtering — now
// once per card in the stack instead of once for the single active card.

type ListResponse = {
  items: Array<TableItem & { cardId: string | null; card?: { discipline: string } | null }>;
  summary: unknown;
};

// SCOPE_QUOTE_DESTINATION_UI_V1 — Option-letter cascade pure helper.
//
// Cost options are lettered Opt A, B, C across all four sections in card order.
// This pure function assigns letters to ONE card's OPTION items from a flat
// list (items in the order the table renders them). WBS items feed it here;
// the same letter sequence applies across sections because WBS items are
// FIRST and the sections share the same card-level counter.
//
// Exported for unit tests. The useMemo below is the only caller in production.
//
// Letter encoding: index 0 → "A", 1 → "B", …, 25 → "Z", 26 → "AA", 27 → "AB", …
export function buildOptionLettersForItems(
  items: ReadonlyArray<{ id: string; quoteDestination?: string | null; status?: string }>
): ReadonlyMap<string, string> {
  const optionItems = items.filter(
    (i) => (i.quoteDestination ?? "PRICE") === "OPTION" && i.status !== "excluded"
  );
  const letters = new Map<string, string>();
  optionItems.forEach((item, idx) => {
    letters.set(item.id, idx < 26
      ? String.fromCharCode(65 + idx)
      : String.fromCharCode(65 + (idx % 26)) + String.fromCharCode(65 + Math.floor(idx / 26) - 1));
  });
  return letters;
}

export function ScopeCardsTab({
  tenderId,
  tenderTitle
}: {
  tenderId: string;
  tenderTitle: string;
}) {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const {
    cards,
    loading: cardsLoading,
    error: cardsError,
    reload: reloadCards,
    createCard,
    renameCard,
    setCardNotes,
    setCardMarkupOverride,
    setCardSectionMarkupOverride,
    resetAllCardMarkup,
    changeDiscipline,
    deleteCard,
    reorderCards,
    updateCardHeaderOverrides,
    setStageGroups,
    getCardSummary
  } = useScopeCards(tenderId);
  const { markup: tenderMarkup, saveMarkup: saveTenderMarkup } = useTenderEstimate(tenderId);

  const [searchParams, setSearchParams] = useSearchParams();
  const cardParam = searchParams.get("card");

  const [items, setItems] = useState<ListResponse["items"]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Rates-gate state. null = not yet loaded; undefined = fetch failed (treated
  // same as no set for safety — do not block on a transient error).
  const [rateSet, setRateSet] = useState<{ id: string } | null | undefined>(undefined);
  const [rateSetLoading, setRateSetLoading] = useState(true);
  const [lockingRates, setLockingRates] = useState(false);
  const [disciplineChange, setDisciplineChange] = useState<{
    card: ScopeCard;
    newDiscipline: string;
  } | null>(null);
  // Per-card collapse. Local UI state, per card and per viewer — it is never
  // sent to the server and no card model field backs it.
  const [collapsedCardIds, setCollapsedCardIds] = useState<Record<string, boolean>>({});

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setError(null);
    try {
      // PR B2 — /scope/summary no longer fetched here. The per-card
      // footer in ScopeQuantitiesTable computes its own subtotal from
      // the items it already has (each item carries lineTotal +
      // lineTotalWithMarkup via /scope/items). Whole-tender totals
      // moved to other surfaces.
      const listRes = await authFetch(`/tenders/${tenderId}/scope/items`);
      if (!listRes.ok) throw new Error(await readApiErrorMessage(listRes));
      const body = (await listRes.json()) as ListResponse;
      setItems(body.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingItems(false);
    }
  }, [authFetch, tenderId]);

  // Rates-gate: fetch the rate set alongside items on every reload.
  // getRateSet returns null when none exists (tender has no locked snapshot).
  // On error, treat as null — we show the gate rather than hiding it on a
  // transient fetch failure, which is the conservative/safe direction.
  // SCOPE_RATES_GATE_NO_REFETCH_FLASH_V1 - only the FIRST fetch shows the
  // skeleton (rateSetLoading starts true). Later reloads - after an item PATCH,
  // a lock, a card change - keep the last known answer on screen; flipping the
  // flag back to true unmounted the whole card stack and closed every open
  // expandable mid-edit (batch3-scope-items e2e, PR 1891).
  const loadRateSet = useCallback(async () => {
    try {
      const set = await getRateSet(authFetch, tenderId);
      setRateSet(set);
    } catch {
      setRateSet(null);
    } finally {
      setRateSetLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void loadItems();
    void loadRateSet();
  }, [loadItems, loadRateSet]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Resolve the visible DISCIPLINE. `?card=` used to name a card; it now
  // selects a discipline, and a card id is still accepted as an inbound
  // value so an existing deep link lands on that card's discipline rather
  // than on an empty screen.
  const activeDiscipline = useMemo(
    () => resolveDisciplineFromParam(cardParam, cards, DISCIPLINE_CODES),
    [cardParam, cards]
  );

  const setActiveDiscipline = useCallback(
    (discipline: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("card", discipline);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Reload both items and cards when items change (e.g. add/delete affects
  // itemCount on the parent card).
  const reloadEverything = useCallback(async () => {
    await Promise.all([loadItems(), reloadCards(), loadRateSet()]);
  }, [loadItems, reloadCards, loadRateSet]);

  // Rates-gate — lock rates from the Scope of Works tab. On success, re-fetch
  // the rate set (so the gate clears) and reload cards (now unlocked for
  // creation). No page reload required.
  const lockRatesFromTab = useCallback(async () => {
    setLockingRates(true);
    try {
      await lockRateSet(authFetch, tenderId);
      await Promise.all([loadRateSet(), reloadCards()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLockingRates(false);
    }
  }, [authFetch, tenderId, loadRateSet, reloadCards]);

  // ── The stack: every card in the visible discipline, in sort order ────
  const disciplineCards = useMemo(
    () => (activeDiscipline ? cardsInDiscipline(cards, activeDiscipline) : []),
    [cards, activeDiscipline]
  );
  // Stable primitive key so the summary effect re-runs when the SET of cards
  // changes but not on every re-render that rebuilds the array identity.
  const disciplineCardIdKey = useMemo(
    () => disciplineCards.map((c) => c.id).join(","),
    [disciplineCards]
  );

  // ── One summary per card in the visible discipline ───────────────────
  // getCardSummary used to be fetched for the active card only. The roll-up
  // needs every stage's figures, so one call per card in the discipline is
  // folded client-side. NO-OP: no new endpoint — `gate_allow` is `none`, and
  // a batch route would be an API change this slice is not allowed to make.
  const [cardSummaries, setCardSummaries] = useState<Record<string, ScopeCardSummary>>({});
  useEffect(() => {
    const ids = disciplineCardIdKey ? disciplineCardIdKey.split(",") : [];
    if (ids.length === 0) {
      setCardSummaries({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await getCardSummary(id)] as const;
        } catch {
          return [id, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, ScopeCardSummary> = {};
      for (const [id, summary] of entries) if (summary) next[id] = summary;
      setCardSummaries(next);
    });
    return () => {
      cancelled = true;
    };
  }, [disciplineCardIdKey, getCardSummary, items]);

  const refreshCardSummary = useCallback(
    async (cardId: string) => {
      try {
        const fresh = await getCardSummary(cardId);
        setCardSummaries((prev) => ({ ...prev, [cardId]: fresh }));
      } catch {
        /* leave the previous figures in place rather than blanking the card */
      }
    },
    [getCardSummary]
  );

  // Items bucketed per card — one pass over `items` for the whole stack
  // instead of one filter for one active card. The card's discipline reaches
  // ScopeQuantitiesTable through its own `discipline` prop, so nothing is
  // stamped onto the items themselves.
  const itemsByCard = useMemo(() => {
    const byCard = new Map<string, TableItem[]>();
    for (const card of disciplineCards) byCard.set(card.id, []);
    for (const item of items) {
      if (!item.cardId) continue;
      byCard.get(item.cardId)?.push(item as TableItem);
    }
    return byCard;
  }, [items, disciplineCards]);

  // SCOPE_OPERATIONAL_COSTS_PRICED_V1 — each card's "Other operational costs"
  // section reports { subtotal, withMarkup } up to here. The section does NOT
  // compute card money; this map holds the section figures, per card.
  //
  // A collapsed card unmounts its section, and its entry is deliberately NOT
  // cleared: collapsing a card hides its body and moves no figure, which is
  // the rule the roll-up already states for collapse.
  const [otherCostTotals, setOtherCostTotals] = useState<Record<string, { subtotal: number; withMarkup: number }>>({});
  const handleOtherCostTotal = useCallback((cardId: string, totals: { subtotal: number; withMarkup: number }) => {
    setOtherCostTotals((prev) => {
      const existing = prev[cardId];
      if (existing && existing.subtotal === totals.subtotal && existing.withMarkup === totals.withMarkup) {
        return prev;
      }
      return { ...prev, [cardId]: totals };
    });
  }, []);

  // CUTTING_IN_THE_FOLD_V1 (scopecards-s7b) — the same arrangement for the
  // concrete cutting section. ScopeCuttingSheet reports the PRICE slice of the
  // server's own per-row totals, markup included, on the same terms as
  // operational costs. An asbestos card has no cutting section, so it reports
  // nothing and its entry stays absent, which reads as 0 in the fold below.
  const [cuttingTotals, setCuttingTotals] = useState<Record<string, { subtotal: number; withMarkup: number }>>({});
  const handleCuttingTotal = useCallback((cardId: string, totals: { subtotal: number; withMarkup: number }) => {
    setCuttingTotals((prev) => {
      const existing = prev[cardId];
      if (existing && existing.subtotal === totals.subtotal && existing.withMarkup === totals.withMarkup) {
        return prev;
      }
      return { ...prev, [cardId]: totals };
    });
  }, []);

  // THE ONE PLACE CARD MONEY IS COMPUTED.
  //
  // `computeCardBarStats` sums the server-computed per-row item totals; this
  // fold is the only consumer of it, and BOTH the card header's "Card total"
  // AND the slice-1 DisciplineSummaryBar read the result. Adding the
  // operational-cost section here — rather than summing it a second time next
  // to either display — is what stops the card and the bar from ever
  // disagreeing about what the card is worth.
  //
  // SCOPE_OPERATIONAL_COSTS_PRICED_V1: the section now carries its own markup,
  // server-computed. `subtotal` gets the section's bare subtotal; `subtotalWithMarkup`
  // gets the section's marked-up total. The two figures can differ when a line
  // carries a markup override or the card/tender markup is non-zero.
  //
  // CUTTING_IN_THE_FOLD_V1 (scopecards-s7b) — cutting now joins on the SAME
  // terms as operational costs: the section reports the PRICE slice of the
  // server's per-row totals, markup included. `subtotal` gets the bare cost of
  // PRICE cutting rows; `subtotalWithMarkup` gets the marked-up total.
  // No cutting price, multiplier or rig selection is computed here or in
  // ScopeCuttingSheet — the server already decided those figures.
  const statsByCard = useMemo(() => {
    const byCard = new Map<string, CardBarStats>();
    for (const card of disciplineCards) {
      // SCOPE_QUOTE_DESTINATION_UI_V1 — partition by quoteDestination column.
      // The discipline parameter and isProvisional flag are retired; S2a
      // backfilled quoteDestination for all existing rows.
      const fromItems = computeCardBarStats(itemsByCard.get(card.id) ?? []);
      const otherCostsEntry = otherCostTotals[card.id];
      const otherCostsSubtotal = otherCostsEntry?.subtotal ?? 0;
      const otherCostsWithMarkup = otherCostsEntry?.withMarkup ?? 0;
      const cuttingEntry = cuttingTotals[card.id];
      const cuttingSubtotal = cuttingEntry?.subtotal ?? 0;
      const cuttingWithMarkup = cuttingEntry?.withMarkup ?? 0;
      // ScopeCardsTab fold — sections report their PRICE money only:
      //   - WBS items are already partitioned into four piles by computeCardBarStats.
      //   - OtherOperationalCosts: subtotal/withMarkup carries the PRICE slice.
      //     (Section S2b-b reports the full section total, which is the PRICE
      //     portion; option/internal from that section are not yet propagated
      //     and are not added by this slice — Waste money is not in the card
      //     fold today and is not added by this slice.)
      //   - Cutting: reports the PRICE slice of the server's per-row totals,
      //     markup included, on the same terms as operational costs.
      byCard.set(card.id, {
        itemCount: fromItems.itemCount,
        subtotal: fromItems.subtotal + otherCostsSubtotal + cuttingSubtotal,
        subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCostsWithMarkup + cuttingWithMarkup,
        provisionalSubtotal: fromItems.provisionalSubtotal,
        provisionalWithMarkup: fromItems.provisionalWithMarkup,
        optionSubtotal: fromItems.optionSubtotal,
        optionWithMarkup: fromItems.optionWithMarkup,
        internalSubtotal: fromItems.internalSubtotal,
        internalWithMarkup: fromItems.internalWithMarkup
      });
    }
    return byCard;
  }, [disciplineCards, itemsByCard, otherCostTotals, cuttingTotals]);

  // SCOPE_QUOTE_DESTINATION_UI_V1 — Option letter cascade.
  //
  // Cost options are lettered Opt A, B, C in card order across all four
  // sections (items, operational, waste, cutting), in row order.
  // Computed ONCE per card here so no section can independently start at A.
  // Only WBS items are available in this component; operational/waste/cutting
  // load their own data and their rows are not accessible here. WBS items
  // come FIRST in the cascade order, so their letters are correct even when
  // later sections add more option rows.
  //
  // The pure helper buildOptionLettersForItems (above) contains the alphabet
  // encoding and is exported for unit tests.
  const optionLettersByCard = useMemo(() => {
    const byCard = new Map<string, ReadonlyMap<string, string>>();
    for (const card of disciplineCards) {
      const cardItemsList = itemsByCard.get(card.id) ?? [];
      byCard.set(card.id, buildOptionLettersForItems(cardItemsList));
    }
    return byCard;
  }, [disciplineCards, itemsByCard]);

  // ── The roll-up ──────────────────────────────────────────────────────
  // Peak crew and peak plant are a MAX across the stack; days and money are
  // sums. See utils/discipline-rollup.ts for why, and for the tests that pin
  // it. Collapse state is deliberately NOT an input here: collapsing a card
  // hides its body and moves no figure in the bar.
  const rollup = useMemo(
    () =>
      rollUpDiscipline(
        disciplineCards.map((card) =>
          toCardRollupInput(
            card.id,
            cardSummaries[card.id],
            statsByCard.get(card.id) ?? {
              itemCount: 0, subtotal: 0, subtotalWithMarkup: 0,
              provisionalSubtotal: 0, provisionalWithMarkup: 0,
              optionSubtotal: 0, optionWithMarkup: 0,
              internalSubtotal: 0, internalWithMarkup: 0
            },
            // SCOPE_STAGE_GROUP_V1 — the card's stage. null on every card
            // until a human groups two, and null is "a stage of its own",
            // so an ungrouped discipline folds exactly as it did before.
            card.stageGroup
          )
        )
      ),
    [disciplineCards, cardSummaries, statsByCard]
  );

  const toggleCollapsed = useCallback((cardId: string) => {
    setCollapsedCardIds((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  }, []);

  /**
   * Move a card one place earlier or later inside its discipline.
   *
   * The stack IS the stage sequence, so reorder had to survive the tab
   * strip losing its @dnd-kit sortable. Cards of one discipline keep their
   * relative order inside the tender's global list, so swapping the two
   * cards' GLOBAL positions swaps them inside the discipline too. The full
   * tender card-id list is sent: reorderCards rebuilds its state from
   * exactly the ids it is handed, so a partial list would drop the rest.
   */
  const moveCardWithinDiscipline = useCallback(
    async (cardId: string, delta: -1 | 1) => {
      const globalIndex = cards.findIndex((c) => c.id === cardId);
      if (globalIndex < 0) return;
      const siblings = cardsInDiscipline(cards, cards[globalIndex].discipline);
      const withinIndex = siblings.findIndex((c) => c.id === cardId);
      const neighbour = siblings[withinIndex + delta];
      if (!neighbour) return;
      const neighbourIndex = cards.findIndex((c) => c.id === neighbour.id);
      if (neighbourIndex < 0) return;
      const nextOrder = cards.map((c) => c.id);
      nextOrder[globalIndex] = neighbour.id;
      nextOrder[neighbourIndex] = cardId;
      try {
        await reorderCards(nextOrder);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [cards, reorderCards]
  );

  /**
   * SCOPE_STAGE_GROUP_V1 — say that a card does, or no longer does, run at
   * the same time as the card directly above it in its discipline.
   *
   * This is the whole grouping feature. It is deliberately a toggle on ONE
   * adjacency and not a stage editor: the decision procedure lives in
   * utils/discipline-rollup.ts (`groupWithPreviousPatches` /
   * `ungroupPatches`) and is unit-tested there, so this callback only
   * chooses which of the two to ask for and hands the result to the hook.
   */
  const toggleStageGroupWithPrevious = useCallback(
    async (cardId: string) => {
      const siblings = cardsInDiscipline(cards, activeDiscipline ?? "");
      const patches = sharesStageWithPrevious(siblings, cardId)
        ? ungroupPatches(siblings, cardId)
        : groupWithPreviousPatches(siblings, cardId, nextStageGroup(cards));
      try {
        await setStageGroups(patches);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [cards, activeDiscipline, setStageGroups]
  );

  if (cardsLoading && cards.length === 0) {
    return (
      <div className="s7-card">
        <Skeleton width="100%" height={220} />
      </div>
    );
  }

  if (cardsError && cards.length === 0) {
    return (
      <div
        className="s7-card"
        role="alert"
        style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}
      >
        {cardsError}
      </div>
    );
  }

  // Rates-gate: derive the gate state once so every branch below can read it.
  // rateSetLoading=true means we haven't heard back yet — show a skeleton rather
  // than briefly flashing the unlocked state.
  const ratesLocked = !rateSetLoading && rateSet != null;
  const gateState: "locked" | "unlocked-empty" | "unlocked-readonly" = ratesLocked
    ? "locked"
    : cards.length === 0
    ? "unlocked-empty"
    : "unlocked-readonly";

  if (!ratesLocked) {
    if (rateSetLoading) {
      return (
        <div className="s7-card">
          <Skeleton width="100%" height={220} />
        </div>
      );
    }

    if (gateState === "unlocked-empty") {
      return (
        <div
          className="sow-tab"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
          data-testid="scope-cards-rates-gate"
          data-state="unlocked-empty"
        >
          <header className="sow-tab__header">
            <div>
              <h2 className="s7-type-page-title" style={{ margin: 0, fontSize: 24 }}>
                Scope of Works
              </h2>
              <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{tenderTitle}</p>
            </div>
          </header>
          <ScopeCardRatesRequiredEmptyState
            onLockRates={lockRatesFromTab}
            locking={lockingRates}
          />
        </div>
      );
    }
  }

  if (ratesLocked && cards.length === 0) {
    return (
      <div className="sow-tab" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <header className="sow-tab__header">
          <div>
            <h2 className="s7-type-page-title" style={{ margin: 0, fontSize: 24 }}>
              Scope of Works
            </h2>
            <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{tenderTitle}</p>
          </div>
        </header>
        <ScopeCardEmptyState
          onCreate={async (name, discipline) => {
            try {
              await createCard(name, discipline);
              setActiveDiscipline(discipline);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      </div>
    );
  }

  // Unlocked-readonly: cards exist but no rate set. The stack is visible but
  // inert. The "New card" affordance (inside ScopeCardTabsRow) is suppressed.
  const isReadOnly = gateState === "unlocked-readonly";

  return (
    <div
      className="sow-tab"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      data-testid="scope-cards-rates-gate"
      data-state={gateState}
    >
      <header
        className="sow-tab__header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}
      >
        <div>
          <h2 className="s7-type-page-title" style={{ margin: 0, fontSize: 24 }}>
            Scope of Works
          </h2>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{tenderTitle}</p>
        </div>
        {!isReadOnly ? (
          <TenderMarkupPicker
            markup={tenderMarkup}
            onSave={async (next) => {
              try {
                await saveTenderMarkup(next);
                await reloadEverything();
              } catch (err) {
                setError((err as Error).message);
              }
            }}
            onResetAll={async () => {
              const scopeCount = cards.filter((c) => c.markupOverride != null).length;
              const wasteCount = cards.filter((c) => c.wasteMarkupOverride != null).length;
              const cuttingCount = cards.filter((c) => c.cuttingMarkupOverride != null).length;
              const total = scopeCount + wasteCount + cuttingCount;
              if (total > 0) {
                const ok = await confirm({
                  title: "Reset markup overrides",
                  message: `Reset every markup override back to the tender default? This affects ${scopeCount} scope card(s), ${wasteCount} waste section(s), and ${cuttingCount} cutting section(s).`,
                  confirmLabel: "Reset",
                  variant: "danger"
                });
                if (!ok) return;
              }
              try {
                const { cardsReset, wasteSectionsReset, cuttingSectionsReset } = await resetAllCardMarkup();
                await reloadEverything();
                setToast(
                  `Cleared: ${cardsReset} scope, ${wasteSectionsReset} waste, ${cuttingSectionsReset} cutting`
                );
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          />
        ) : null}
      </header>

      {/* Unlocked-readonly banner — rates were deleted after cards were priced. */}
      {isReadOnly ? (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "10px 16px",
            background: "color-mix(in srgb, var(--status-warning) 15%, transparent)",
            border: "1px solid var(--status-warning)",
            borderRadius: "var(--radius-sm)",
            flexWrap: "wrap"
          }}
        >
          <span style={{ fontSize: 14 }}>
            Rates are unlocked — these cards are read-only until rates are locked again.
          </span>
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => void lockRatesFromTab()}
            disabled={lockingRates}
          >
            {lockingRates ? "Locking…" : "Lock rates"}
          </button>
        </div>
      ) : null}

      {/* Tab strip — the "+ New card" affordance is hidden while unlocked. */}
      <ScopeCardTabsRow
        cards={cards}
        activeDiscipline={activeDiscipline}
        onSelectDiscipline={setActiveDiscipline}
        onCreateCard={isReadOnly ? undefined : async (name, discipline) => {
          try {
            await createCard(name, discipline);
            setActiveDiscipline(discipline);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />

      {activeDiscipline ? (
        <div>
          {/* One roll-up bar above the stack. Not a card bar: it carries no
              card id, and its "Discipline total" is finally the discipline's. */}
          <DisciplineSummaryBar
            disciplineCode={activeDiscipline}
            disciplineLabel={DISCIPLINE_LABELS[activeDiscipline] ?? activeDiscipline}
            rollup={rollup}
          />

          {/* Unlocked-readonly: wrap the entire card stack in a fieldset so
              every native input/button/select inside it is inert. The fieldset
              also carries aria-disabled and pointer-events:none for elements
              (like divs with onClick) that the browser does not honour disabled
              on natively. */}
          <fieldset
            disabled={isReadOnly}
            aria-disabled={isReadOnly ? "true" : undefined}
            style={{
              border: "none",
              margin: 0,
              padding: 0,
              pointerEvents: isReadOnly ? "none" : undefined
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {disciplineCards.map((card, index) => (
                <ScopeCardStackEntry
                  key={card.id}
                  card={card}
                  stageIndex={index}
                  stageCount={disciplineCards.length}
                  collapsed={collapsedCardIds[card.id] === true}
                  onToggleCollapsed={() => toggleCollapsed(card.id)}
                  onMove={(delta) => void moveCardWithinDiscipline(card.id, delta)}
                  concurrentWithPrevious={sharesStageWithPrevious(disciplineCards, card.id)}
                  onToggleStageGroup={() => void toggleStageGroupWithPrevious(card.id)}
                  stats={statsByCard.get(card.id) ?? { itemCount: 0, subtotal: 0, subtotalWithMarkup: 0, provisionalSubtotal: 0, provisionalWithMarkup: 0, optionSubtotal: 0, optionWithMarkup: 0, internalSubtotal: 0, internalWithMarkup: 0 }}
                  optionLetters={optionLettersByCard.get(card.id) ?? new Map()}
                  summary={cardSummaries[card.id] ?? null}
                  cardItems={itemsByCard.get(card.id) ?? []}
                  loadingItems={loadingItems}
                  tenderId={tenderId}
                  tenderMarkup={tenderMarkup}
                  onOtherCostTotalChange={handleOtherCostTotal}
                  onCuttingTotalChange={handleCuttingTotal}
                  onRename={async (name) => {
                    try {
                      await renameCard(card.id, name);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await deleteCard(card.id);
                      setToast("Card deleted");
                    } catch (err) {
                      setToast((err as Error).message);
                    }
                  }}
                  onRequestDisciplineChange={(newDiscipline) =>
                    setDisciplineChange({ card, newDiscipline })
                  }
                  onSetMarkupOverride={async (next) => {
                    try {
                      await setCardMarkupOverride(card.id, next);
                      await reloadEverything();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                  onHeaderOverride={async (patch) => {
                    try {
                      await updateCardHeaderOverrides(card.id, patch);
                      await refreshCardSummary(card.id);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                  onSetCardNotes={async (patch) => {
                    await setCardNotes(card.id, patch);
                  }}
                  onSetSectionMarkup={async (section, next) => {
                    await setCardSectionMarkupOverride(card.id, section, next);
                    await reloadEverything();
                  }}
                  onItemsChanged={reloadEverything}
                />
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {error ? (
        <div
          className="s7-card"
          role="alert"
          style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ marginLeft: 12, background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--brand-primary)",
            color: "var(--text-inverse)",
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            zIndex: 200
          }}
        >
          {toast}
        </div>
      ) : null}

      {disciplineChange ? (
        <ChangeDisciplineModal
          card={disciplineChange.card}
          newDiscipline={disciplineChange.newDiscipline}
          itemCount={disciplineChange.card.itemCount}
          onCancel={() => setDisciplineChange(null)}
          onConfirm={async () => {
            try {
              const result = await changeDiscipline(
                disciplineChange.card.id,
                disciplineChange.newDiscipline
              );
              setToast(
                `Card changed to ${disciplineChange.newDiscipline}. ${result.itemsRenumbered} item${
                  result.itemsRenumbered === 1 ? "" : "s"
                } renumbered.`
              );
              await reloadEverything();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setDisciplineChange(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

// ── One card in the discipline stack ───────────────────────────────────

type StackEntryProps = {
  card: ScopeCard;
  stageIndex: number;
  stageCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onMove: (delta: -1 | 1) => void;
  /** SCOPE_STAGE_GROUP_V1 — true when this card shares a stage with, and so
   *  runs at the same time as, the card directly above it. */
  concurrentWithPrevious: boolean;
  /** Join this card to the stage above, or take it back out. */
  onToggleStageGroup: () => void;
  stats: CardBarStats;
  summary: ScopeCardSummary | null;
  cardItems: TableItem[];
  loadingItems: boolean;
  tenderId: string;
  tenderMarkup: number;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onRequestDisciplineChange: (discipline: string) => void;
  onSetMarkupOverride: (next: number | null) => Promise<void>;
  onHeaderOverride: (patch: Record<string, number | string | null>) => Promise<void>;
  onSetCardNotes: (patch: { cuttingNotes?: string | null; wasteNotes?: string | null }) => Promise<void>;
  onSetSectionMarkup: (section: "waste" | "cutting", next: number | null) => Promise<void>;
  onItemsChanged: () => Promise<void>;
  /** SCOPE_OPERATIONAL_COSTS_PRICED_V1 — reports the card's operational-cost
   *  section { subtotal, withMarkup } up to the single card-money fold.
   *  Must be referentially stable. */
  onOtherCostTotalChange: (cardId: string, totals: { subtotal: number; withMarkup: number }) => void;
  /** CUTTING_IN_THE_FOLD_V1 (scopecards-s7b) — reports the card's concrete
   *  cutting section { subtotal, withMarkup } (PRICE slice) up to that same fold.
   *  Must be referentially stable. */
  onCuttingTotalChange: (cardId: string, totals: { subtotal: number; withMarkup: number }) => void;
  /**
   * SCOPE_QUOTE_DESTINATION_UI_V1 — Opt A/B/C letters for OPTION items on
   * this card's WBS table. Computed once per card in ScopeCardsTab from the
   * loaded WBS items in row order; never per section.
   */
  optionLetters: ReadonlyMap<string, string>;
};

function ScopeCardStackEntry({
  card,
  stageIndex,
  stageCount,
  collapsed,
  onToggleCollapsed,
  onMove,
  concurrentWithPrevious,
  onToggleStageGroup,
  stats,
  summary,
  cardItems,
  loadingItems,
  tenderId,
  tenderMarkup,
  onRename,
  onDelete,
  onRequestDisciplineChange,
  onSetMarkupOverride,
  onHeaderOverride,
  onSetCardNotes,
  onSetSectionMarkup,
  onItemsChanged,
  onOtherCostTotalChange,
  onCuttingTotalChange,
  optionLetters
}: StackEntryProps) {
  const cardWbsRefs = useMemo(() => cardItems.map((i) => i.wbsCode), [cardItems]);
  const cardCode = formatCardCode(card.discipline, card.cardNumber);
  const bodyId = `scope-card-body-${card.id}`;

  const shellStyle: CSSProperties = {
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    background: "var(--surface-card)",
    overflow: "hidden"
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "10px 12px",
    background: "var(--surface-subtle)",
    borderBottom: collapsed ? "none" : "1px solid var(--border-default)"
  };

  return (
    <section style={shellStyle} data-testid="scope-card-stack-entry" data-card-id={card.id}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            aria-label={`${collapsed ? "Expand" : "Collapse"} card ${cardCode}`}
            title={collapsed ? "Expand this card" : "Collapse this card"}
            style={{
              border: "1px solid var(--border-default)",
              background: "var(--surface-card)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              color: "var(--text-secondary)",
              width: 24,
              height: 24,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0
            }}
          >
            {collapsed ? "▸" : "▾"}
          </button>
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap"
            }}
          >
            {cardCode}
          </span>
          <CardNameHeading name={card.name} onRename={onRename} />
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Stage {stageIndex + 1} of {stageCount} · {stats.itemCount} item
            {stats.itemCount === 1 ? "" : "s"}
          </span>
          {(summary?.computed?.internalLinesLeftOut ?? 0) > 0 ? (
            <span
              data-testid="scope-card-nomine-chip"
              title={`${summary!.computed.internalLinesLeftOut} internal only item${summary!.computed.internalLinesLeftOut === 1 ? "" : "s"} — not in these figures`}
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
                fontStyle: "italic"
              }}
            >
              −{summary!.computed.internalLinesLeftOut} internal only
            </span>
          ) : null}
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}
            >
              Card total
            </span>
            <span
              data-testid="scope-card-total"
              style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
            >
              {fmtCurrency(stats.subtotalWithMarkup)}
            </span>
          </div>
          {/* SCOPE_STAGE_GROUP_V1 — the whole grouping control: one toggle
              on one adjacency. Hidden on the first card of a discipline,
              which has nothing above it to run with. Grouping RAISES the
              discipline's peak crew and LOWERS its duration, so the label
              and the tooltip both say so before the click. */}
          {stageIndex > 0 ? (
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={onToggleStageGroup}
              aria-pressed={concurrentWithPrevious}
              data-testid="stage-group-toggle"
              aria-label={
                concurrentWithPrevious
                  ? `Make card ${cardCode} run after the card above it instead of at the same time`
                  : `Make card ${cardCode} run at the same time as the card above it`
              }
              title={
                concurrentWithPrevious
                  ? "Runs at the same time as the card above. Click to put it back in sequence — the discipline's peak crew falls and its duration grows."
                  : "Runs after the card above. Click to run them at the same time — their crews add, so the discipline's peak crew rises and its duration falls."
              }
            >
              {concurrentWithPrevious ? "⇉ Concurrent" : "⇢ Sequential"}
            </button>
          ) : null}
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => onMove(-1)}
              disabled={stageIndex === 0}
              aria-label={`Move card ${cardCode} earlier in the sequence`}
              title="Move this stage earlier"
            >
              ↑
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => onMove(1)}
              disabled={stageIndex === stageCount - 1}
              aria-label={`Move card ${cardCode} later in the sequence`}
              title="Move this stage later"
            >
              ↓
            </button>
          </div>
          {card.itemCount === 0 ? (
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => void onDelete()}
              aria-label={`Delete card ${card.name}`}
              title="Delete empty card"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      {collapsed ? null : (
        <div id={bodyId} style={{ padding: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              marginBottom: 12,
              gap: 16,
              flexWrap: "wrap"
            }}
          >
            <CardMarkupOverride
              value={card.markupOverride}
              tenderMarkup={tenderMarkup}
              onSave={onSetMarkupOverride}
            />
            {card.markupOverride != null ? (
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => void onSetMarkupOverride(null)}
                title="Clear this card's markup override (inherit tender markup)"
              >
                Reset this card
              </button>
            ) : null}
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Discipline:&nbsp;
              <select
                value={card.discipline}
                onChange={(e) => {
                  const newDiscipline = e.target.value;
                  if (newDiscipline === card.discipline) return;
                  onRequestDisciplineChange(newDiscipline);
                }}
                style={{ padding: "2px 6px" }}
              >
                {DISCIPLINE_CODES.map((d) => (
                  <option key={d} value={d}>
                    {DISCIPLINE_LABELS[d]} ({d})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {summary ? <CardHeaderSummary summary={summary} onOverride={onHeaderOverride} /> : null}

          {loadingItems && cardItems.length === 0 ? (
            <Skeleton width="100%" height={140} />
          ) : (
            <ScopeQuantitiesTable
              tenderId={tenderId}
              cardId={card.id}
              discipline={card.discipline as TableDiscipline}
              items={cardItems}
              /* SCOPE_WBS_INPUTS_V2 — cardMarkup was never passed, so every WBS
                 row read the prop's old `= 0` default and claimed to inherit
                 0%. Both halves of the chain were already here: the card's own
                 override, then the tender markup — the same order CardMarkupOverride
                 states in its "Inherits tender markup (N%)" tooltip below. */
              cardMarkup={resolveCardMarkup(card.markupOverride, tenderMarkup)}
              onItemsChanged={onItemsChanged}
              optionLetters={optionLetters}
            />
          )}

          {/* SCOPE_OTHER_COSTS_V1 — the mock-up fixes the order inside a card:
              WBS items -> Other operational costs -> Waste -> Concrete cutting
              -> + Add WBS item -> subtotal. This is the second of those, and
              it sits here, between the WBS table above and Waste below. */}
          <OtherOperationalCosts
            tenderId={tenderId}
            cardId={card.id}
            canManage={true}
            onSectionTotalChange={onOtherCostTotalChange}
          />

          {/* SCOPE_WASTE_SECTION_V1 — third in the mock-up's fixed order,
              between Other operational costs above and Concrete cutting below.

              THIS MOUNT TAKES NO SECTION-TOTAL CALLBACK, AND THAT IS DELIBERATE.
              Do not add one to "finish" the pattern the two sections either
              side of it follow. Waste is not missing from the tender price —
              it is priced as its OWN independently marked-up cost stream, on
              the server, in scope-redesign.service.ts summary():

                wasteWithMarkup += <ScopeWasteItem.lineTotal per card>
                                   * (1 + (card.wasteMarkupOverride ?? tenderMarkup)/100)
                tenderPrice = scopeWithMarkupTotal + cuttingWithMarkup + wasteWithMarkup

              and the service states the invariant in the same breath: waste
              and cutting are independent cost streams "NEVER folded into the
              scope discipline total". summary-section-markup.spec.ts pins it
              with asymmetric markups so a combined base cannot coincide.

              The fold below is that scope-discipline total. Adding waste to it
              would put waste inside the one total the server keeps it out of,
              and would run money that already carries the waste section's own
              rate through the scope markup chain a second time. The card
              subtotal is therefore identical with and without waste lines —
              by design, not by omission. See the header of ScopeWasteTab.tsx. */}
          <ScopeWasteTab
            tenderId={tenderId}
            discipline={card.discipline}
            wbsRefs={cardWbsRefs}
            canManage={true}
            wasteNotes={card.wasteNotes}
            onWasteNotesChange={async (v) => {
              await onSetCardNotes({ wasteNotes: v });
            }}
            cardId={card.id}
            tenderMarkup={tenderMarkup}
            sectionMarkupOverride={card.wasteMarkupOverride}
            onSectionMarkupChange={async (next) => {
              await onSetSectionMarkup("waste", next);
            }}
          />

          {/* CUTTING_ONE_SURFACE_V1 (scopecards-s6) — one concrete cutting
              section. Asbestos cards never cut; the gate is
              showsCuttingColumn(discipline) in ScopeQuantitiesTable.tsx — the
              ERP's single source of truth for which disciplines cut, and the
              same function that gates the `Cutting?` tick. Directly under
              Waste, per the mock-up's card order:
                WBS items -> Other operational costs -> Waste ->
                Concrete cutting -> + Add WBS item -> subtotal.
              CuttingSection (the read-only take-off) is gone; ScopeCuttingSheet
              is the only cutting surface and now also reports the section total
              upward via onSectionTotalChange so the fold below stays correct. */}
          {showsCuttingColumn(card.discipline as TableDiscipline) ? (
            <ScopeCuttingSheet
              tenderId={tenderId}
              wbsRefs={cardWbsRefs}
              canManage={true}
              cuttingNotes={card.cuttingNotes}
              onCuttingNotesChange={async (v) => {
                await onSetCardNotes({ cuttingNotes: v });
              }}
              cardId={card.id}
              tenderMarkup={tenderMarkup}
              sectionMarkupOverride={card.cuttingMarkupOverride}
              onSectionMarkupChange={async (next) => {
                await onSetSectionMarkup("cutting", next);
              }}
              onSectionTotalChange={onCuttingTotalChange}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

/** The card's name in its stack header. Double-click to rename — the same
 *  affordance the card TAB carried before the tabs became disciplines.
 *
 *  SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3): pencil glyph ✎ added:
 *  - aria-hidden on the glyph; aria-label="Rename card" on the wrapper.
 *  - Brand-muted color; visible on hover AND keyboard focus.
 *  - Click opens the editor (same handler as double-click).
 *  - title="Double-click to rename" retained.
 */
function CardNameHeading({
  name,
  onRename
}: {
  name: string;
  onRename: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      setSaving(true);
      try {
        await onRename(trimmed);
      } finally {
        setSaving(false);
      }
    } else {
      setDraft(name);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        disabled={saving}
        aria-label="Card name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        style={{
          fontSize: 14,
          padding: "2px 4px",
          border: "1px solid var(--brand-primary)",
          borderRadius: "var(--radius-sm)",
          minWidth: 120
        }}
      />
    );
  }

  return (
    <h3
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename"
      style={{
        margin: 0,
        fontSize: 15,
        fontWeight: 600,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "text",
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }}
    >
      {name}
      {/* SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3): pencil affordance.
          aria-hidden on the glyph so screen readers hear "Rename card" once. */}
      <button
        type="button"
        aria-label="Rename card"
        title="Double-click to rename"
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className="card-name-rename-btn"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "pointer",
          color: "var(--brand-muted, var(--text-muted))",
          fontSize: 13,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          opacity: 0,
          transition: "opacity 0.15s"
        }}
      >
        <span aria-hidden="true">&#9998;</span>
      </button>
    </h3>
  );
}

// ── PR B2 — Markup picker UI helpers ───────────────────────────────────

function TenderMarkupPicker({
  markup,
  onSave,
  onResetAll
}: {
  markup: number;
  onSave: (next: number) => Promise<void> | void;
  onResetAll: () => Promise<void> | void;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
      <label style={{ fontSize: 12, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
        Markup:
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={markup}
          key={`tender-markup-${markup}`}
          onBlur={(e) => {
            const raw = e.target.value;
            if (raw === "") return;
            const n = Math.max(0, Math.min(100, Number(raw)));
            if (Number.isFinite(n) && n !== markup) void onSave(n);
          }}
          style={{ width: 70, padding: "2px 6px" }}
          aria-label="Tender markup percent"
        />
        %
      </label>
      <button
        type="button"
        className="s7-btn s7-btn--ghost s7-btn--sm"
        onClick={() => void onResetAll()}
        title="Reset every card's markup override back to the tender default"
      >
        Reset all
      </button>
    </div>
  );
}

function CardMarkupOverride({
  value,
  tenderMarkup,
  onSave
}: {
  // PR B2.1 — accept undefined too in case an older cached response
  // is missing the field. `value != null` handles both null and
  // undefined the same way.
  value: number | null | undefined;
  tenderMarkup: number;
  onSave: (next: number | null) => Promise<void> | void;
}) {
  const hasOverride = value != null;
  return (
    <label
      style={{
        fontSize: 12,
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }}
    >
      Markup:
      <input
        type="number"
        min={0}
        max={100}
        step="0.01"
        placeholder={String(tenderMarkup)}
        defaultValue={value ?? ""}
        key={`card-markup-${value ?? "inherit"}-${tenderMarkup}`}
        onBlur={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            if (hasOverride) void onSave(null);
            return;
          }
          const n = Math.max(0, Math.min(100, Number(raw)));
          if (!Number.isFinite(n)) return;
          if (n !== value) void onSave(n);
        }}
        style={{
          width: 70,
          padding: "2px 6px",
          borderColor: hasOverride ? "var(--brand-accent)" : undefined,
          borderStyle: hasOverride ? "solid" : undefined,
          borderWidth: hasOverride ? 1 : undefined
        }}
        aria-label="Card markup override percent"
        title={hasOverride ? "Override active — click × to clear" : `Inherits tender markup (${tenderMarkup}%)`}
      />
      %
      {hasOverride ? (
        <button
          type="button"
          aria-label="Clear card markup override"
          title="Clear override (inherit tender markup)"
          onClick={() => void onSave(null)}
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 11,
            lineHeight: 1,
            padding: 0
          }}
        >
          ×
        </button>
      ) : null}
    </label>
  );
}

// ── Card-header summary with override highlights ─────────────────────
type SummaryData = {
  computed: {
    peakCrew: number;
    labourDays: number;
    plantSummary: PlantSummaryGroup[];
    duration: number;
  };
  overrides: {
    peakCrewOverride: number | null;
    labourDaysOverride: number | null;
    plantSummaryOverride: string | null;
    durationOverride: number | null;
  };
};

function CardHeaderSummary({
  summary,
  onOverride
}: {
  summary: SummaryData;
  onOverride: (patch: Record<string, number | string | null>) => Promise<void>;
}) {
  const { computed, overrides } = summary;
  const cellStyle = { fontSize: 12, padding: "4px 8px" } as const;
  const labelStyle = { ...cellStyle, color: "var(--text-muted)" } as const;
  const valStyle = { ...cellStyle, fontWeight: 600, fontVariantNumeric: "tabular-nums" } as const;

  const plantLines = formatPlantSummary(computed.plantSummary);
  const plantText = plantLines.join("\n");

  return (
    <div
      data-testid="scope-card-header-summary"
      style={{
        display: "grid",
        // Duration joins Peak crew / Labour days / Plant. It was missing even
        // though computed.duration was already in this component's data and
        // has its own durationOverride field — and the discipline bar's old
        // "Plant days" chip was quietly showing it instead.
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 4,
        background: "var(--surface-subtle)",
        borderRadius: "var(--radius-sm)",
        padding: 6,
        marginBottom: 12,
        fontSize: 12
      }}
    >
      <div style={labelStyle}>Peak crew</div>
      <div style={labelStyle}>Labour days</div>
      <div style={labelStyle}>Duration</div>
      <div style={labelStyle}>Plant</div>

      <div style={valStyle}>
        <OverrideField
          isOverridden={overrides.peakCrewOverride != null}
          onRevert={() => void onOverride({ peakCrewOverride: null })}
          affordance
        >
          <EditableNum
            value={overrides.peakCrewOverride ?? computed.peakCrew}
            placeholder={String(computed.peakCrew)}
            onCommit={(v) => void onOverride({ peakCrewOverride: v })}
          />
        </OverrideField>
      </div>
      <div style={valStyle}>
        <OverrideField
          isOverridden={overrides.labourDaysOverride != null}
          onRevert={() => void onOverride({ labourDaysOverride: null })}
          affordance
        >
          <EditableNum
            value={overrides.labourDaysOverride ?? computed.labourDays}
            placeholder={String(computed.labourDays)}
            onCommit={(v) => void onOverride({ labourDaysOverride: v })}
          />
        </OverrideField>
      </div>
      <div style={valStyle}>
        <OverrideField
          isOverridden={overrides.durationOverride != null}
          onRevert={() => void onOverride({ durationOverride: null })}
          affordance
        >
          <EditableNum
            value={overrides.durationOverride ?? computed.duration}
            placeholder={String(computed.duration)}
            onCommit={(v) => void onOverride({ durationOverride: v })}
          />
        </OverrideField>
      </div>
      <div style={valStyle}>
        <OverrideField
          isOverridden={overrides.plantSummaryOverride != null}
          onRevert={() => void onOverride({ plantSummaryOverride: null })}
          affordance
        >
          <EditablePlant
            override={overrides.plantSummaryOverride}
            autoText={plantText}
            autoLines={plantLines}
            onCommit={(v) => void onOverride({ plantSummaryOverride: v })}
          />
        </OverrideField>
      </div>
    </div>
  );
}

function EditablePlant({
  override,
  autoText,
  autoLines,
  onCommit
}: {
  override: string | null;
  autoText: string;
  autoLines: string[];
  onCommit: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const displayText = override ?? autoText;

  if (editing) {
    const lineCount = Math.max((displayText.match(/\n/g) ?? []).length + 1, 2);
    return (
      <textarea
        autoFocus
        defaultValue={displayText}
        rows={lineCount}
        onBlur={(e) => {
          setEditing(false);
          const v = e.target.value.trim();
          if (v === "" || v === autoText) {
            onCommit(null);
          } else if (v !== (override ?? autoText)) {
            onCommit(v);
          }
        }}
        style={{
          width: "100%",
          padding: "1px 4px",
          border: "1px solid var(--border-default)",
          borderRadius: 3,
          background: "var(--surface-card)",
          fontWeight: 600,
          fontSize: 12,
          fontFamily: "inherit",
          resize: "vertical",
          lineHeight: 1.4
        }}
        className="s7-input"
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title={displayText}
      style={{ cursor: "text", lineHeight: 1.4 }}
    >
      {(override ? override.split("\n") : autoLines).map((line, i) => (
        <div key={i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function EditableNum({
  value,
  placeholder,
  onCommit
}: {
  value: number;
  placeholder: string;
  onCommit: (v: number) => void;
}) {
  return (
    <input
      type="number"
      step="0.01"
      defaultValue={value}
      placeholder={placeholder}
      key={`ednum-${value}`}
      onBlur={(e) => {
        const raw = e.target.value;
        if (raw === "") return;
        const n = Number(raw);
        if (Number.isFinite(n) && n !== value) onCommit(n);
      }}
      style={{
        width: 70,
        padding: "1px 4px",
        border: "1px solid transparent",
        background: "transparent",
        fontWeight: 600,
        fontSize: 12
      }}
      className="s7-input"
    />
  );
}
