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
  // SCOPE_PROVISIONAL_SPLIT_V1 — provisional slice of the same non-excluded rows,
  // partitioned by the same predicate the server uses in scope-redesign.service.ts:
  //   line is provisional if isProvisional===true OR discipline==="Other"
  // These are the same server-computed numbers the totals are made of, sorted into
  // two piles — never a recomputed figure.
  /** Sum of lineTotal across non-excluded PROVISIONAL items. */
  provisionalSubtotal: number;
  /** Sum of lineTotalWithMarkup across non-excluded PROVISIONAL items. */
  provisionalWithMarkup: number;
};

/**
 * Compute the bar stats for one card.
 *
 * THE ONE PLACE CARD MONEY IS COMPUTED — see the note in ScopeCardsTab.tsx.
 *
 * `discipline` is needed for the "Other" half of the provisional predicate:
 * schema.prisma states "line is provisional if isProvisional===true OR
 * discipline==='Other'". Omitting it (or passing undefined) means "flag only",
 * which is safe for every existing caller that does not know the discipline.
 */
export function computeCardBarStats(items: ScopeItem[], discipline?: string): CardBarStats {
  const visible = items.filter((i) => i.status !== "excluded");
  const subtotal = visible.reduce(
    (sum, i) => sum + (i.lineTotal != null ? Number(i.lineTotal) : 0),
    0
  );
  const subtotalWithMarkup = visible.reduce(
    (sum, i) => sum + (i.lineTotalWithMarkup != null ? Number(i.lineTotalWithMarkup) : 0),
    0
  );
  // Provisional partition: same numbers the totals are made of, filtered by the
  // server's predicate. Passing `discipline` is what makes a card in "Other"
  // correctly treat every one of its lines as provisional without a flag.
  const isOtherDiscipline = discipline === "Other";
  const provisional = visible.filter(
    (i) => i.isProvisional === true || isOtherDiscipline
  );
  const provisionalSubtotal = provisional.reduce(
    (sum, i) => sum + (i.lineTotal != null ? Number(i.lineTotal) : 0),
    0
  );
  const provisionalWithMarkup = provisional.reduce(
    (sum, i) => sum + (i.lineTotalWithMarkup != null ? Number(i.lineTotalWithMarkup) : 0),
    0
  );
  return { itemCount: visible.length, subtotal, subtotalWithMarkup, provisionalSubtotal, provisionalWithMarkup };
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

// ── Chip tooltips: what the figure actually is ─────────────────────────
//
// SCOPE_STAGE_GROUP_V1. Peak crew and Duration used to describe a rule the
// domain no longer guarantees ("stages run sequentially, so this is a max,
// not a sum"). Cards of one discipline CAN now share a stage and run
// concurrently, which RAISES peak crew and LOWERS duration — and those are
// figures an estimator may already have quoted from, so they must not move
// without the bar saying why.
//
// Both tooltips therefore state how many stages the cards actually formed
// and, when any of them holds more than one card, that concurrent cards
// SUM. A discipline nobody has grouped has one card per stage and reads as
// the sequential rule it always did.
//
// Exported and pure so the wording is unit-testable: the web workspace has
// no jsdom, so a claim about a string belongs in a function, not a render.

/** "3 stages" / "1 stage". */
function stagesPhrase(stageCount: number): string {
  return `${stageCount} ${stageCount === 1 ? "stage" : "stages"}`;
}

/** True when at least one stage holds more than one card, i.e. something
 *  in this discipline actually runs concurrently. */
export function hasConcurrentStages(rollup: DisciplineRollup): boolean {
  return rollup.stageCount < rollup.cardCount;
}

/** Tooltip for the Peak crew chip. */
export function peakCrewTitle(rollup: DisciplineRollup): string {
  const stages = stagesPhrase(rollup.stageCount);
  if (!hasConcurrentStages(rollup)) {
    return (
      `Largest single stage's crew, over ${stages}. ` +
      `Every card is its own stage here, so this is the largest card's crew — a max, not a sum. ` +
      `Group two cards and their crews would ADD into one stage, raising this figure.`
    );
  }
  return (
    `Largest single stage's crew, over ${stages} holding ${rollup.cardCount} cards. ` +
    `Cards grouped into one stage are on site together, so their crews SUM; ` +
    `the stages never coincide, so the discipline takes the biggest stage rather than the total.`
  );
}

/** Tooltip for the Duration chip. */
export function durationTitle(rollup: DisciplineRollup): string {
  const stages = stagesPhrase(rollup.stageCount);
  if (!hasConcurrentStages(rollup)) {
    return (
      `Sum of every stage's duration, over ${stages} — the stages run end to end. ` +
      `Every card is its own stage here, so this is the sum of the card durations. ` +
      `Group two cards and they would run at once, counting once as the longer of the two.`
    );
  }
  return (
    `Sum of every stage's duration, over ${stages} holding ${rollup.cardCount} cards — ` +
    `the stages run end to end. Cards grouped into one stage run at the same time, so that ` +
    `stage is counted ONCE, as its longest card, which shortens this figure.`
  );
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

  // The stack's meta line counts STAGES, not cards. They are the same
  // number for a discipline nobody has grouped; once two cards share a
  // stage it names the cards separately rather than silently reporting a
  // smaller stack.
  const stageWord = rollup.stageCount === 1 ? "stage" : "stages";
  const concurrent = hasConcurrentStages(rollup);

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
          {rollup.stageCount} {stageWord} ·{" "}
          {concurrent ? `${rollup.cardCount} cards, some concurrent` : "sequential"}
        </div>
      </div>

      {/* Middle: roll-up chips. Peak crew and peak plant are MAX across the
          stages (they never run at once); days and money are sums. */}
      <div style={chipsStyle}>
        <StatChip label="Items" value={String(rollup.itemCount)} />
        <StatChip
          label="Peak crew"
          value={fmtFigure(rollup.peakCrew)}
          title={peakCrewTitle(rollup)}
        />
        <StatChip label="Person-days" value={fmtFigure(rollup.personDays)} />
        <StatChip label="Labour days" value={fmtFigure(rollup.labourDays)} />
        <StatChip
          label="Duration"
          value={fmtFigure(rollup.duration)}
          title={durationTitle(rollup)}
        />
        <StatChip
          label="Peak plant"
          value={plantChipValue}
          title={`Peak quantity per plant type across the stages (a max, not a sum):\n${plantText}`}
        />
      </div>

      {/* Right: the discipline total and, when any line is provisional, the
          in-quote / provisional split.
          SCOPE_PROVISIONAL_SPLIT_V1:
            in the quote = subtotalWithMarkup − provisionalWithMarkup
            provisional  = provisionalWithMarkup
            total        = subtotalWithMarkup   ← unchanged from today
          Deriving "in the quote" by subtraction rather than as a third sum
          means `in the quote + provisional === total` by construction, so
          the three figures on the bar can never disagree with one another.
          It also means this slice cannot move a figure an estimator has
          already quoted from: the total is exactly what it was before.
          The split is shown only when there is provisional money — a bar
          with none would otherwise read "in the quote $X · provisional $0
          · total $X" on every discipline. */}
      <div style={rightStyle}>
        {rollup.provisionalWithMarkup > 0 ? (
          <>
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "flex-end",
                flexWrap: "wrap",
                justifyContent: "flex-end"
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={totalLabelStyle}>In the quote</span>
                <span style={{ ...totalFigureStyle, fontSize: 14 }}>
                  {fmtCurrency(rollup.subtotalWithMarkup - rollup.provisionalWithMarkup)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={totalLabelStyle}>Provisional</span>
                <span style={{ ...totalFigureStyle, fontSize: 14 }}>
                  {fmtCurrency(rollup.provisionalWithMarkup)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={totalLabelStyle}>Discipline total</span>
                <span style={totalFigureStyle}>{fmtCurrency(rollup.subtotalWithMarkup)}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <span style={totalLabelStyle}>Discipline total</span>
            <span style={totalFigureStyle}>{fmtCurrency(rollup.subtotalWithMarkup)}</span>
          </>
        )}
      </div>
    </div>
  );
}
