import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../../auth/AuthContext";
import { OverrideField } from "../../../components";
import { ScopeCardTabsRow } from "./ScopeCardTabsRow";
import { ScopeCardEmptyState } from "./ScopeCardEmptyState";
import { ChangeDisciplineModal } from "./ChangeDisciplineModal";
import { useScopeCards, type ScopeCard } from "./useScopeCards";
import { useTenderEstimate } from "./useTenderEstimate";
import {
  ScopeQuantitiesTable,
  type Discipline as TableDiscipline,
  type ScopeItem as TableItem
} from "../ScopeQuantitiesTable";
import { ScopeWasteTab } from "../ScopeWasteTab";
import { ScopeCuttingSheet } from "../ScopeCuttingSheet";
import { DISCIPLINE_CODES, DISCIPLINE_LABELS, formatPlantSummary, type PlantSummaryGroup } from "./utils/card-display";

// PR B1.5 — main Scope of Works container. Replaces the legacy
// ScopeOfWorksTab + ScopeDisciplineBar combo. Card tabs drive the
// active filter; the existing ScopeQuantitiesTable, ScopeWasteTab,
// and ScopeCuttingSheet components are reused as-is, scoped per card
// via cardId / wbsRef filtering.

type ListResponse = {
  items: Array<TableItem & { cardId: string | null; card?: { discipline: string } | null }>;
  summary: unknown;
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
    setCardNotes,
    setCardMarkupOverride,
    resetAllCardMarkup,
    changeDiscipline,
    deleteCard,
    reorderCards,
    updateCardHeaderOverrides,
    getCardSummary
  } = useScopeCards(tenderId);
  const { markup: tenderMarkup, saveMarkup: saveTenderMarkup } = useTenderEstimate(tenderId);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeCardIdFromUrl = searchParams.get("card");

  const [items, setItems] = useState<ListResponse["items"]>([]);
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
      // PR B2 — /scope/summary no longer fetched here. The per-card
      // footer in ScopeQuantitiesTable computes its own subtotal from
      // the items it already has (each item carries lineTotal +
      // lineTotalWithMarkup via /scope/items). Whole-tender totals
      // moved to other surfaces.
      const listRes = await authFetch(`/tenders/${tenderId}/scope/items`);
      if (!listRes.ok) throw new Error(await listRes.text());
      const body = (await listRes.json()) as ListResponse;
      setItems(body.items);
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

  // Card-header summary — auto-derived values + user overrides.
  type CardSummaryData = {
    computed: {
      peakCrew: number;
      totalPersonDays: number;
      plantSummary: PlantSummaryGroup[];
      duration: number;
    };
    overrides: {
      peakCrewOverride: number | null;
      totalPersonDaysOverride: number | null;
      plantSummaryOverride: string | null;
      durationOverride: number | null;
    };
  };
  const [cardSummary, setCardSummary] = useState<CardSummaryData | null>(null);
  useEffect(() => {
    if (!activeCard) { setCardSummary(null); return; }
    void getCardSummary(activeCard.id).then(setCardSummary).catch(() => setCardSummary(null));
  }, [activeCard?.id, getCardSummary, items]);

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
            const anyOverridden = cards.some((c) => c.markupOverride != null);
            if (anyOverridden) {
              const ok = window.confirm(
                "Reset every card's markup override back to the tender default? This affects " +
                  cards.filter((c) => c.markupOverride != null).length +
                  " card(s)."
              );
              if (!ok) return;
            }
            try {
              const { cardsReset } = await resetAllCardMarkup();
              await reloadEverything();
              setToast(`${cardsReset} card override${cardsReset === 1 ? "" : "s"} cleared`);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
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
              marginBottom: 12,
              gap: 16,
              flexWrap: "wrap"
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>{activeCard.name}</h3>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <CardMarkupOverride
                value={activeCard.markupOverride}
                tenderMarkup={tenderMarkup}
                onSave={async (next) => {
                  try {
                    await setCardMarkupOverride(activeCard.id, next);
                    await reloadEverything();
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              />
              {activeCard.markupOverride != null ? (
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  onClick={async () => {
                    try {
                      await setCardMarkupOverride(activeCard.id, null);
                      await reloadEverything();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                  title="Clear this card's markup override (inherit tender markup)"
                >
                  Reset this card
                </button>
              ) : null}
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
          </div>

          {cardSummary ? (
            <CardHeaderSummary
              summary={cardSummary}
              onOverride={async (patch) => {
                try {
                  await updateCardHeaderOverrides(activeCard.id, patch);
                  const fresh = await getCardSummary(activeCard.id);
                  setCardSummary(fresh);
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            />
          ) : null}

          {loadingItems && cardItems.length === 0 ? (
            <Skeleton width="100%" height={140} />
          ) : (
            <ScopeQuantitiesTable
              tenderId={tenderId}
              cardId={activeCard.id}
              discipline={activeCard.discipline as TableDiscipline}
              items={cardItems}
              onItemsChanged={reloadEverything}
            />
          )}

          <ScopeWasteTab
            tenderId={tenderId}
            discipline={activeCard.discipline}
            wbsRefs={cardWbsRefs}
            canManage={true}
            wasteNotes={activeCard.wasteNotes}
            onWasteNotesChange={async (v) => {
              await setCardNotes(activeCard.id, { wasteNotes: v });
            }}
            cardId={activeCard.id}
          />

          {activeCard.discipline !== "ASB" ? (
            <ScopeCuttingSheet
              tenderId={tenderId}
              wbsRefs={cardWbsRefs}
              canManage={true}
              cuttingNotes={activeCard.cuttingNotes}
              onCuttingNotesChange={async (v) => {
                await setCardNotes(activeCard.id, { cuttingNotes: v });
              }}
              cardId={activeCard.id}
            />
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
          borderColor: hasOverride ? "var(--brand-accent, #FEAA6D)" : undefined,
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
            border: "1px solid var(--border-default, #e5e7eb)",
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
    totalPersonDays: number;
    plantSummary: PlantSummaryGroup[];
    duration: number;
  };
  overrides: {
    peakCrewOverride: number | null;
    totalPersonDaysOverride: number | null;
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
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 4,
        background: "var(--surface-muted, #F6F6F6)",
        borderRadius: "var(--radius-sm, 4px)",
        padding: 6,
        marginBottom: 12,
        fontSize: 12
      }}
    >
      <div style={labelStyle}>Peak crew</div>
      <div style={labelStyle}>Person-days</div>
      <div style={labelStyle}>Plant</div>
      <div style={labelStyle}>Duration (days)</div>

      <div style={valStyle}>
        <OverrideField
          isOverridden={overrides.peakCrewOverride != null}
          onRevert={() => void onOverride({ peakCrewOverride: null })}
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
          isOverridden={overrides.totalPersonDaysOverride != null}
          onRevert={() => void onOverride({ totalPersonDaysOverride: null })}
        >
          <EditableNum
            value={overrides.totalPersonDaysOverride ?? computed.totalPersonDays}
            placeholder={String(computed.totalPersonDays)}
            onCommit={(v) => void onOverride({ totalPersonDaysOverride: v })}
          />
        </OverrideField>
      </div>
      <div style={valStyle}>
        <OverrideField
          isOverridden={overrides.plantSummaryOverride != null}
          onRevert={() => void onOverride({ plantSummaryOverride: null })}
        >
          <EditablePlant
            override={overrides.plantSummaryOverride}
            autoText={plantText}
            autoLines={plantLines}
            onCommit={(v) => void onOverride({ plantSummaryOverride: v })}
          />
        </OverrideField>
      </div>
      <div style={valStyle}>
        <OverrideField
          isOverridden={overrides.durationOverride != null}
          onRevert={() => void onOverride({ durationOverride: null })}
        >
          <EditableNum
            value={overrides.durationOverride ?? computed.duration}
            placeholder={String(computed.duration)}
            onCommit={(v) => void onOverride({ durationOverride: v })}
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
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 3,
          background: "var(--surface-card, #fff)",
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
