// SCOPE_QD_UI_ITEMS_V1 — the single control that says where a line goes on
// the client quote.
//
// This is the S2b-a "items" slice: the four-option select, its rail classes,
// its note text, and the Opt-A pill. No API is touched; the value arrives on
// ScopeItem.quoteDestination (S2a) and is written back via the item PATCH
// route the table already owns.
//
// DESIGN CONTRACT (Discipline Cards mock-up v26, destSel() / destCell()):
//   - Four options: In the price · Provisional · Cost option · Internal only
//   - Values: PRICE | PROVISIONAL | OPTION | INTERNAL
//   - Classes: destsel d-price | d-prov | d-option | d-internal
//   - Provisional = accent border on the override surface
//   - Option     = primary border on the primary-light surface
//   - Internal   = dashed border, muted text
//   - Opt A pill (`.optlbl`) beside the select when optionLetter is set
//   - Title text verbatim from destSel()
//
// BRAND TOKENS ONLY. Nothing hard-coded.

import type { CSSProperties } from "react";

/** The four quote-destination values as the API stores them. */
export type QuoteDestination = "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";

/** Display label for each value. */
export const DESTINATION_LABELS: Record<QuoteDestination, string> = {
  PRICE: "In the price",
  PROVISIONAL: "Provisional",
  OPTION: "Cost option",
  INTERNAL: "Internal only"
};

/** The note shown below the total for non-PRICE destinations. */
export const DESTINATION_NOTE: Partial<Record<QuoteDestination, string>> = {
  PROVISIONAL: "provisional sum",
  OPTION: "cost option",
  INTERNAL: "internal only"
};

/** The CSS class added to the row `<tbody>` for each destination. */
export const DESTINATION_ROW_CLASS: Record<QuoteDestination, string> = {
  PRICE: "d-price",
  PROVISIONAL: "d-prov",
  OPTION: "d-option",
  INTERNAL: "d-internal"
};

// ── Styles ──────────────────────────────────────────────────────────────
// Brand tokens only; nothing hard-coded. The same colour tokens that the
// destination rail uses (tokens.css) govern the select border and surface.

const baseSelectStyle: CSSProperties = {
  height: 26,
  fontSize: 11,
  padding: "2px 4px",
  borderRadius: "var(--radius-sm)",
  fontFamily: "inherit",
  cursor: "pointer"
};

const selectStyleByDest: Record<QuoteDestination, CSSProperties> = {
  PRICE: {
    ...baseSelectStyle,
    border: "1px solid var(--border-default)",
    background: "var(--surface)"
  },
  PROVISIONAL: {
    ...baseSelectStyle,
    border: "1px solid var(--status-accent, var(--brand-secondary))",
    background: "var(--surface-override, var(--surface-subtle))"
  },
  OPTION: {
    ...baseSelectStyle,
    border: "1px solid var(--brand-primary)",
    background: "var(--surface-primary-light, var(--surface-subtle))"
  },
  INTERNAL: {
    ...baseSelectStyle,
    border: "1px dashed var(--border-default)",
    background: "var(--surface)",
    color: "var(--text-muted)"
  }
};

const optLblStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 5px",
  borderRadius: "var(--radius-sm)",
  background: "var(--brand-primary)",
  color: "var(--text-inverse)",
  fontSize: 10,
  fontWeight: 600,
  whiteSpace: "nowrap",
  marginLeft: 4
};

/**
 * SCOPE_QD_UI_ITEMS_V1 — the four-option destination select.
 *
 * Presentational and auth-free: every write goes up through `onChange` to the
 * caller (ScopeQuantitiesTable), which owns authFetch and the PATCH route.
 *
 * Props:
 *   value      — current destination ("PRICE" when the field is null/undefined)
 *   onChange   — called with the new destination when the user picks one
 *   optionLetter — when set, renders the Opt A/B/C pill beside the select.
 *                  Omit the prop entirely when not applicable — never pass undefined.
 */
export function QuoteDestinationSelect({
  value,
  onChange,
  optionLetter
}: {
  value: QuoteDestination;
  onChange: (next: QuoteDestination) => void;
  /**
   * When set (e.g. "A"), renders an "Opt A" pill beside the select.
   * Omit entirely when not applicable.
   */
  optionLetter?: string | null;
}) {
  const dest = value ?? "PRICE";
  const style = selectStyleByDest[dest] ?? baseSelectStyle;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
      <select
        className={`destsel d-${dest.toLowerCase()} s7-input`}
        value={dest}
        style={style}
        title="Where this line goes on the client quote. It is priced either way - the destination only decides where the money lands."
        onChange={(e) => {
          const next = e.target.value as QuoteDestination;
          onChange(next);
        }}
      >
        {(["PRICE", "PROVISIONAL", "OPTION", "INTERNAL"] as const).map((v) => (
          <option key={v} value={v}>
            {DESTINATION_LABELS[v]}
          </option>
        ))}
      </select>
      {optionLetter ? (
        <span
          className="optlbl"
          style={optLblStyle}
          title={`Grouped as Option ${optionLetter} on the quote`}
        >
          Opt {optionLetter}
        </span>
      ) : null}
    </div>
  );
}
