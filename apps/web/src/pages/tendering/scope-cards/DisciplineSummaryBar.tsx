// SCOPE_DISCBAR_V1 — Slice 1 of the scope-card redesign.
// Presentational bar that sits on --brand-primary with white text:
//   Left:   card code (Syne 800) + card name + muted meta line
//   Middle: stat chips (item count, manpower days, plant days)
//   Right:  discipline total (label above, figure below in tabular-nums)
//
// Design rules (permanent — sot/01 §5):
//   - Brand tokens ONLY. No hardcoded colour values.
//   - The one permitted rgba literal is rgba(255,255,255,.14) for chip
//     backgrounds (white-on-brand-primary wash). If a token is added for
//     this in future, prefer the token.
//   - Bar background is --brand-primary, text is --text-inverse (#FFFFFF).
//     Dark theme does NOT lighten --status-active; brand palette is locked.

import type { CSSProperties } from "react";
import { formatCardCode } from "./utils/card-display";
import type { ScopeCard } from "./useScopeCards";
import type { ScopeItem } from "../ScopeQuantitiesTable";

// ── Pure computation helper ─────────────────────────────────────────────
// Re-implements ONLY the aggregation that ScopeQuantitiesTable's footer
// already does: sum lineTotal + lineTotalWithMarkup across non-excluded
// items.  A second implementation of the cost *calculation* (rates × qty)
// is the source of divergence described in the design requirement — this
// function does NOT do that; it sums the server-computed per-row totals
// already present on every item.

export type CardBarStats = {
  /** Number of non-excluded items (matches the visible-row count in the table). */
  itemCount: number;
  /** Sum of lineTotal across non-excluded items — same value as footer "Subtotal". */
  subtotal: number;
  /** Sum of lineTotalWithMarkup — same value as footer "with markup". */
  subtotalWithMarkup: number;
};

export function computeCardBarStats(items: ScopeItem[]): CardBarStats {
  const visible = items.filter((i) => i.status !== "excluded");
  const subtotal = visible.reduce(
    (sum, i) => sum + (i.lineTotal != null ? Number(i.lineTotal) : 0),
    0
  );
  const subtotalWithMarkup = visible.reduce(
    (sum, i) => sum + (i.lineTotalWithMarkup != null ? Number(i.lineTotalWithMarkup) : 0),
    0
  );
  return { itemCount: visible.length, subtotal, subtotalWithMarkup };
}

// ── Formatting helpers ──────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(n);
}

// ── Sub-components ──────────────────────────────────────────────────────

const CHIP_BG = "rgba(255,255,255,.14)";

function StatChip({ label, value }: { label: string; value: string }) {
  const chipStyle: CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    padding: "4px 10px",
    borderRadius: "var(--radius-sm)",
    background: CHIP_BG,
    flexShrink: 0
  };
  return (
    <div style={chipStyle}>
      <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.78, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export type DisciplineSummaryBarProps = {
  card: ScopeCard;
  /** Non-excluded item count + totals — call computeCardBarStats(cardItems). */
  stats: CardBarStats;
  /** Computed manpower (labour) days from the card summary API. */
  labourDays: number;
  /** Computed duration (plant days) from the card summary API. */
  plantDays: number;
  /** Human-readable discipline label (e.g. "Demolition"). */
  disciplineLabel: string;
};

export function DisciplineSummaryBar({
  card,
  stats,
  labourDays,
  plantDays,
  disciplineLabel
}: DisciplineSummaryBarProps) {
  const cardCode = formatCardCode(card.discipline, card.cardNumber);

  const barStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 16px",
    borderRadius: "var(--radius-md)",
    background: "var(--brand-primary)",
    color: "var(--text-inverse)",
    marginBottom: 8,
    flexWrap: "wrap",
    minWidth: 0
  };

  // Left section: card code + name + meta line
  const leftStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
    flex: "1 1 160px"
  };

  const codeStyle: CSSProperties = {
    fontFamily: "Syne, sans-serif",
    fontWeight: 800,
    fontSize: 16,
    lineHeight: 1,
    letterSpacing: "-0.01em",
    whiteSpace: "nowrap"
  };

  const nameStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 6
  };

  const metaStyle: CSSProperties = {
    fontSize: 11,
    opacity: 0.7,
    whiteSpace: "nowrap"
  };

  // Middle section: chips
  const chipsStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
    flexWrap: "nowrap"
  };

  // Right section: total
  const rightStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 1,
    flex: "0 0 auto",
    flexShrink: 0
  };

  const totalLabelStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
    opacity: 0.78,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap"
  };

  const totalFigureStyle: CSSProperties = {
    fontFamily: "Syne, sans-serif",
    fontWeight: 800,
    fontSize: 18,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap"
  };

  return (
    <div className="discbar" style={barStyle} data-card-id={card.id} data-testid="discipline-summary-bar">
      {/* Left: identity */}
      <div style={leftStyle}>
        <div style={codeStyle}>{cardCode}</div>
        <div style={nameStyle} title={card.name}>
          {card.name}
        </div>
        <div style={metaStyle}>{disciplineLabel}</div>
      </div>

      {/* Middle: stat chips */}
      <div style={chipsStyle}>
        <StatChip label="Items" value={String(stats.itemCount)} />
        <StatChip label="Manpower days" value={labourDays === 0 ? "—" : String(labourDays)} />
        <StatChip label="Plant days" value={plantDays === 0 ? "—" : String(plantDays)} />
      </div>

      {/* Right: card total */}
      <div style={rightStyle}>
        <span style={totalLabelStyle}>Discipline total</span>
        <span style={totalFigureStyle}>{fmtCurrency(stats.subtotalWithMarkup)}</span>
      </div>
    </div>
  );
}
