import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../../auth/AuthContext";
import { ScopeCardTabsRow } from "./ScopeCardTabsRow";
import { ScopeCardEmptyState } from "./ScopeCardEmptyState";
import { ChangeDisciplineModal } from "./ChangeDisciplineModal";
import { useScopeCards, type ScopeCard } from "./useScopeCards";
import {
  ScopeQuantitiesTable,
  type Discipline as TableDiscipline,
  type ScopeItem as TableItem
} from "../ScopeQuantitiesTable";
import { ScopeWasteTab } from "../ScopeWasteTab";
import { ScopeCuttingSheet } from "../ScopeCuttingSheet";
import { DISCIPLINE_CODES, DISCIPLINE_LABELS } from "./utils/card-display";

// PR B1.5 — main Scope of Works container. Replaces the legacy
// ScopeOfWorksTab + ScopeDisciplineBar combo. Card tabs drive the
// active filter; the existing ScopeQuantitiesTable, ScopeWasteTab,
// and ScopeCuttingSheet components are reused as-is, scoped per card
// via cardId / wbsRef filtering.

type ListResponse = {
  items: Array<TableItem & { cardId: string | null; card?: { discipline: string } | null }>;
  summary: unknown;
};

type SummaryStat = { itemCount: number; subtotal: number; withMarkup: number };
type SummaryResponse = {
  DEM: SummaryStat;
  CIV: SummaryStat;
  ASB: SummaryStat;
  Other: SummaryStat;
  cutting: { itemCount: number; subtotal: number };
  tenderPrice: number;
};

export function ScopeCardsTab({
  tenderId,
  tenderTitle
}: {
  tenderId: string;
  tenderTitle: string;
}) {
  const { authFetch } = useAuth();
  const {
    cards,
    loading: cardsLoading,
    error: cardsError,
    reload: reloadCards,
    createCard,
    renameCard,
    changeDiscipline,
    deleteCard,
    reorderCards
  } = useScopeCards(tenderId);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeCardIdFromUrl = searchParams.get("card");

  const [items, setItems] = useState<ListResponse["items"]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [disciplineChange, setDisciplineChange] = useState<{
    card: ScopeCard;
    newDiscipline: string;
  } | null>(null);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        authFetch(`/tenders/${tenderId}/scope/items`),
        authFetch(`/tenders/${tenderId}/scope/summary`)
      ]);
      if (!listRes.ok) throw new Error(await listRes.text());
      const body = (await listRes.json()) as ListResponse;
      setItems(body.items);
      if (summaryRes.ok) setSummary((await summaryRes.json()) as SummaryResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingItems(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Resolve the active card. Prefer the URL param; fall back to the first
  // card in sort order. If the URL points at a deleted/missing card, fall
  // back gracefully.
  const activeCard = useMemo<ScopeCard | null>(() => {
    if (cards.length === 0) return null;
    if (activeCardIdFromUrl) {
      const found = cards.find((c) => c.id === activeCardIdFromUrl);
      if (found) return found;
    }
    return cards[0] ?? null;
  }, [cards, activeCardIdFromUrl]);

  const setActiveCard = useCallback(
    (cardId: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("card", cardId);
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
    await Promise.all([loadItems(), reloadCards()]);
  }, [loadItems, reloadCards]);

  // Items filtered to the active card. Synthesize a `discipline` field on
  // each item from the card's discipline (the legacy ScopeQuantitiesTable
  // type still references item.discipline; populating it here keeps the
  // table happy without an internal rewrite).
  const cardItems = useMemo<TableItem[]>(() => {
    if (!activeCard) return [];
    return items
      .filter((i) => i.cardId === activeCard.id)
      .map((i) => ({
        ...(i as TableItem),
        discipline: activeCard.discipline
      }));
  }, [items, activeCard]);

  const cardWbsRefs = useMemo(() => cardItems.map((i) => i.wbsCode), [cardItems]);

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

  if (cards.length === 0) {
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
              const card = await createCard(name, discipline);
              setActiveCard(card.id);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      </div>
    );
  }

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

      <ScopeCardTabsRow
        cards={cards}
        activeCardId={activeCard?.id ?? null}
        onSelectCard={setActiveCard}
        onCreateCard={async (name, discipline) => {
          try {
            const card = await createCard(name, discipline);
            setActiveCard(card.id);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
        onRenameCard={renameCard}
        onDeleteCard={async (cardId) => {
          try {
            await deleteCard(cardId);
            // After delete, if the active card is gone, switch to first.
            if (cardId === activeCard?.id) {
              const next = cards.find((c) => c.id !== cardId);
              if (next) setActiveCard(next.id);
            }
            setToast("Card deleted");
          } catch (err) {
            setToast((err as Error).message);
          }
        }}
        onReorder={async (ids) => {
          try {
            await reorderCards(ids);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />

      {activeCard ? (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>{activeCard.name}</h3>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Discipline:&nbsp;
              <select
                value={activeCard.discipline}
                onChange={(e) => {
                  const newDiscipline = e.target.value;
                  if (newDiscipline === activeCard.discipline) return;
                  setDisciplineChange({ card: activeCard, newDiscipline });
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

          {loadingItems && cardItems.length === 0 ? (
            <Skeleton width="100%" height={140} />
          ) : cardItems.length === 0 ? (
            <div className="s7-card" style={{ padding: 40, textAlign: "center" }}>
              <EmptyState
                heading="No items in this card"
                subtext="Add scope items manually or ask Claude to propose scope from your uploaded documents."
              />
            </div>
          ) : (
            <ScopeQuantitiesTable
              tenderId={tenderId}
              discipline={activeCard.discipline as TableDiscipline}
              items={cardItems}
              subtotal={summary ? summary[activeCard.discipline as TableDiscipline]?.subtotal ?? 0 : 0}
              subtotalWithMarkup={
                summary ? summary[activeCard.discipline as TableDiscipline]?.withMarkup ?? 0 : 0
              }
              onItemsChanged={reloadEverything}
            />
          )}

          <ScopeWasteTab
            tenderId={tenderId}
            discipline={activeCard.discipline}
            wbsRefs={cardWbsRefs}
            canManage={true}
          />

          {activeCard.discipline !== "ASB" ? (
            <ScopeCuttingSheet tenderId={tenderId} wbsRefs={cardWbsRefs} canManage={true} />
          ) : null}
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
            background: "#005B61",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 4,
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
