// SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3) — per-line markup override
// cell, shared by CuttingSection, ScopeWasteTab and OtherOperationalCosts.
//
// Visual contract:
//   - Dashed border + placeholder = inherited value (phrase from inheritedPhrase prop).
//   - Amber fill (--surface-override) when overridden.
//   - "%" suffix always shown.
//   - "↺" pip titled "Reset to section default (N%)" — PATCHes { markupOverride: null }.
//   - PATCH body has exactly one key (markupOverride).
//
// Pricing: this cell sends a single-key patch to the parent's onPatch handler.
// It never prices anything itself. The server returns effectiveMarkup on every
// list/create/update response.

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";

export type LineMarkupCellProps = {
  /** The line's stored override, or null if inheriting. */
  markupOverride: number | null | undefined;
  /** The effective markup % the server computed for this line. */
  effectiveMarkup: number;
  /** Phrase for the placeholder tooltip, e.g. "the card's cutting markup". */
  inheritedPhrase: string;
  /** Called with `{ markupOverride: number | null }` on change. */
  onPatch: (patch: { markupOverride: number | null }) => void;
  disabled?: boolean;
};

export const SCOPE_LINE_MARKUP_ALL_TYPES_V1 = "scopecards-s3";

/** True when the line carries its own override (identity, not value comparison). */
export function hasLineMarkupOverride(markupOverride: number | null | undefined): boolean {
  return markupOverride !== null && markupOverride !== undefined;
}

/**
 * SCOPE_LINE_MARKUP_ALL_TYPES_V1 — per-line markup override cell.
 *
 * Pure presentation — no context, no fetching. Sends exactly one key
 * `markupOverride` in every patch.
 */
export function LineMarkupCell({
  markupOverride,
  effectiveMarkup,
  inheritedPhrase,
  onPatch,
  disabled
}: LineMarkupCellProps) {
  const overridden = hasLineMarkupOverride(markupOverride);
  const [localVal, setLocalVal] = useState<string>(
    overridden ? String(markupOverride) : ""
  );

  // Keep local state in sync when props change (e.g. after a server round-trip).
  useEffect(() => {
    setLocalVal(overridden ? String(markupOverride) : "");
  }, [markupOverride, overridden]);

  const containerStyle: CSSProperties = overridden
    ? {
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        background: "var(--surface-override)",
        borderRadius: "var(--radius-sm)",
        padding: "0 2px"
      }
    : {
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "0 2px"
      };

  const inputStyle: CSSProperties = overridden
    ? {
        width: 52,
        height: 24,
        padding: "0 2px",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        border: "none",
        background: "transparent",
        fontSize: 12
      }
    : {
        width: 52,
        height: 24,
        padding: "0 2px",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
        border: "1px dashed var(--border-default)",
        background: "transparent",
        fontSize: 12
      };

  return (
    <div style={containerStyle} data-testid="line-markup-cell" data-overridden={overridden ? "true" : "false"}>
      <input
        className="s7-input"
        type="number"
        min={0}
        step="0.01"
        value={localVal}
        disabled={disabled}
        placeholder={String(effectiveMarkup)}
        aria-label="Per-line markup override"
        title={
          overridden
            ? `Line markup override active (${markupOverride}%). ↺ to reset to ${inheritedPhrase}.`
            : `Inheriting ${inheritedPhrase} (${effectiveMarkup}%). Type to override.`
        }
        style={inputStyle}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => {
          if (localVal === "") {
            // Clear: send null (inherit)
            if (overridden) onPatch({ markupOverride: null });
            return;
          }
          const n = Number(localVal);
          if (!Number.isFinite(n) || n < 0) {
            setLocalVal(overridden ? String(markupOverride) : "");
            return;
          }
          onPatch({ markupOverride: n });
        }}
      />
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>%</span>
      {overridden && !disabled ? (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          data-testid="line-markup-reset"
          aria-label={`Reset to section default (${effectiveMarkup}%)`}
          title={`Reset to ${inheritedPhrase} (${effectiveMarkup}%)`}
          onClick={() => {
            setLocalVal("");
            onPatch({ markupOverride: null });
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "1px solid var(--border-default)",
            background: "var(--surface-card)",
            cursor: "pointer",
            fontSize: 11,
            lineHeight: 1,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ↺
        </button>
      ) : null}
    </div>
  );
}
