// SCOPE_DISCIPLINE_STACK_V1 — the bar above a discipline's card stack.
//
// It was SCOPE_DISCBAR_V1, a CARD bar wearing a discipline label: it was
// keyed `data-card-id`, its right-hand figure was one card's
// `subtotalWithMarkup` under the label "Discipline total", and its "Plant
// days" chip was actually being handed the card's DURATION. Finding 9.3.5
// is fixed here rather than in a separate pass, because relabelling the bar
// and then rebuilding around it is two passes over one component for one
// outcome.
//
// It now takes a DisciplineRollup — the fold of every card in the visible
// discipline, computed by the pure function in utils/discipline-rollup.ts —
// and is identified by `data-discipline` (the discipline code), not by a
// card id. Nothing on it belongs to a single card any more.
//
// Design rules (permanent — sot/01 §5):
//   - Brand tokens ONLY. No hardcoded colour values.
//   - The one permitted rgba literal is rgba(255,255,255,.14) for chip
//     backgrounds (white-on-brand-primary wash). If a token is added for
//     this in future, prefer the token.
//   - Bar background is --brand-primary, text is --text-inverse (#FFFFFF).
//     Dark theme does NOT lighten --status-active; brand palette is locked.

import type { CSSProperties } from "react";
import { formatPlantSummary } from "./utils/card-display";
import type { DisciplineRollup } from "./utils/discipline-rollup";
import type { ScopeItem } from "../ScopeQuantitiesTable";

// ── Pure computation helper ─────────────────────────────────────────────
// Re-implements ONLY the aggregation that ScopeQuantitiesTable's footer
// already does: sum lineTotal + lineTotalWithMarkup across non-excluded
// items.  A second implementation of the cost *calculation* (rates × qty)
// is the source of divergence described in the design requirement — this
// function does NOT do that; it sums the server-computed per-row totals
// already present on every item.
//
// It stays a PER-CARD helper. The discipline figure is the fold of these
// per-card stats in utils/discipline-rollup.ts, so a card's total and the
// discipline total can never come from two different formulas.

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

export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(n);
}

/** Day/crew figures: "—" for nothing, otherwise the number without a
 *  trailing ".0" (the API already rounds days to 1dp). */
function fmtFigure(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return String(Math.round(n * 10) / 10);
}

// ── Sub-components ──────────────────────────────────────────────────────

const CHIP_BG = "rgba(255,255,255,.14)";

function StatChip({ label, value, title }: { label: string; value: string; title?: string }) {
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
    <div style={chipStyle} title={title}>
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
  /** Discipline code, e.g. "DEM". Identifies the bar in place of the old
   *  `data-card-id`. */
  disciplineCode: string;
  /** Human-readable discipline label (e.g. "Demolition"). */
  disciplineLabel: string;
  /** The fold of every card in this discipline — rollUpDiscipline(...). */
  rollup: DisciplineRollup;
};

export function DisciplineSummaryBar({
  disciplineCode,
  disciplineLabel,
  rollup
}: DisciplineSummaryBarProps) {
  const barStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 16px",
    borderRadius: "var(--radius-md)",
    background: "var(--brand-primary)",
    color: "var(--text-inverse)",
    marginBottom: 12,
    flexWrap: "wrap",
    minWidth: 0
  };

  // Left section: discipline identity
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
    flex: "0 1 auto",
    flexWrap: "wrap"
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

  const plantLines = formatPlantSummary(rollup.plantSummary);
  const plantText = plantLines.join("\n");
  const plantChipValue = plantLines.length === 1 ? plantLines[0] : `${plantLines.length} types`;

  const stageWord = rollup.cardCount === 1 ? "stage" : "stages";

  return (
    <div
      className="discbar"
      style={barStyle}
      data-discipline={disciplineCode}
      data-testid="discipline-summary-bar"
    >
      {/* Left: identity — the DISCIPLINE, not a card */}
      <div style={leftStyle}>
        <div style={codeStyle}>{disciplineCode}</div>
        <div style={nameStyle} title={disciplineLabel}>
          {disciplineLabel}
        </div>
        <div style={metaStyle}>
          {rollup.cardCount} {stageWord} · sequential
        </div>
      </div>

      {/* Middle: roll-up chips. Peak crew and peak plant are MAX across the
          stages (they never run at once); days and money are sums. */}
      <div style={chipsStyle}>
        <StatChip label="Items" value={String(rollup.itemCount)} />
        <StatChip
          label="Peak crew"
          value={fmtFigure(rollup.peakCrew)}
          title="Largest single stage's crew — stages run sequentially, so this is a max, not a sum."
        />
        <StatChip label="Person-days" value={fmtFigure(rollup.personDays)} />
        <StatChip label="Labour days" value={fmtFigure(rollup.labourDays)} />
        <StatChip
          label="Duration"
          value={fmtFigure(rollup.duration)}
          title="Sum of every stage's duration — the stages run end to end."
        />
        <StatChip
          label="Peak plant"
          value={plantChipValue}
          title={`Peak quantity per plant type across the stages (a max, not a sum):\n${plantText}`}
        />
      </div>

      {/* Right: the discipline total its label has always claimed */}
      <div style={rightStyle}>
        <span style={totalLabelStyle}>Discipline total</span>
        <span style={totalFigureStyle}>{fmtCurrency(rollup.subtotalWithMarkup)}</span>
      </div>
    </div>
  );
}
