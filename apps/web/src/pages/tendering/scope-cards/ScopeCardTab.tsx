import type { CSSProperties } from "react";
import { disciplineColor } from "./utils/card-display";

// SCOPE_DISCIPLINE_STACK_V1 — one tab in the tab strip. The tab is now a
// DISCIPLINE, not a card: every card in the discipline stacks down the page
// behind it, so there is no longer one tab per card.
//
// This replaces the PR B1.5 card tab. Inline rename and the delete-X moved
// with the thing they act on — they are per-card affordances and now live on
// each card's own header inside the stack (ScopeCardsTab). A discipline is
// not a row in a table; it has no name to rename and nothing to delete.

type Props = {
  /** Discipline code, e.g. "DEM". */
  code: string;
  /** Human-readable label, e.g. "Demolition". */
  label: string;
  /** How many cards (stages) this discipline holds. */
  cardCount: number;
  /** Total scope items across those cards. */
  itemCount: number;
  active: boolean;
  onSelect: () => void;
};

export function ScopeCardTab({ code, label, cardCount, itemCount, active, onSelect }: Props) {
  const containerStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderLeft: `3px solid ${disciplineColor(code)}`,
    borderTop: "1px solid var(--border-default)",
    borderRight: "1px solid var(--border-default)",
    borderBottom: active ? "3px solid var(--brand-primary)" : "1px solid var(--border-default)",
    borderRadius: "6px 6px 0 0",
    background: active ? "var(--surface-card)" : "var(--surface-subtle)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--brand-primary)" : "var(--text-primary)",
    userSelect: "none"
  };

  return (
    <button
      type="button"
      data-testid="scope-discipline-tab"
      data-discipline={code}
      aria-pressed={active}
      title={`${label} — ${cardCount} card${cardCount === 1 ? "" : "s"}, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      style={containerStyle}
      onClick={onSelect}
    >
      <span
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 11,
          color: "var(--text-muted)",
          fontWeight: 500
        }}
      >
        {code}
      </span>
      <span>{label}</span>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        ({cardCount}/{itemCount})
      </span>
    </button>
  );
}
