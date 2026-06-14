import type { CSSProperties } from "react";

// Canonical Recharts tooltip styling: light surface + dark text regardless of
// series colour. Recharts defaults render item text in the series colour,
// which is illegible for dark series (e.g. brand teal on the status donut).
// Fallback hexes mirror tokens.css for contexts where the tokens aren't loaded.
export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  background: "var(--surface-card, #FFFFFF)",
  color: "var(--text-primary, #111827)",
  border: "1px solid var(--border-default, #E5E7EB)",
  borderRadius: "var(--radius-md, 8px)",
  padding: "8px 12px",
  boxShadow: "var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.08))",
  fontSize: 12,
  lineHeight: 1.4
};

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "var(--text-primary, #111827)",
  fontWeight: 500,
  marginBottom: 4
};

export const TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: "var(--text-primary, #111827)"
};
