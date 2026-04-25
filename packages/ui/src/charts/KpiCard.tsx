import type { ReactNode } from "react";

export type KpiTrend = "up" | "down" | "flat";

type KpiCardProps = {
  label: string;
  value: ReactNode;
  trend?: KpiTrend;
  trendValue?: string;
  color?: string;
};

const TREND_GLYPH: Record<KpiTrend, string> = {
  up: "▲",
  down: "▼",
  flat: "—"
};

const TREND_COLOR: Record<KpiTrend, string> = {
  up: "var(--status-success, #1b8f4f)",
  down: "var(--status-danger, #c53030)",
  flat: "var(--text-muted, #6b7280)"
};

export function KpiCard({ label, value, trend, trendValue, color }: KpiCardProps) {
  // Initial Services brand teal as the default left-border accent.
  const accent = color ?? "#005B61";
  return (
    <div
      className="kpi-card"
      style={{
        background: "var(--surface-card, #ffffff)",
        border: "1px solid var(--border-default, #E5E7EB)",
        borderLeft: `4px solid ${accent}`,
        borderRadius: "var(--radius-lg, 12px)",
        padding: "16px 20px",
        minHeight: 100,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04))"
      }}
    >
      <span
        className="kpi-card__label"
        style={{
          color: "var(--text-secondary, #6B7280)",
          fontSize: 12,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}
      >
        {label}
      </span>
      <strong
        className="kpi-card__value"
        style={{
          color: "var(--text-primary, #0F1117)",
          fontSize: 30,
          fontWeight: 600,
          lineHeight: 1.1
        }}
      >
        {value}
      </strong>
      {trend || trendValue ? (
        <span
          className="kpi-card__trend"
          style={{
            color: trend ? TREND_COLOR[trend] : "var(--text-muted, #6b7280)",
            fontSize: 13,
            fontWeight: 500
          }}
        >
          {trend ? `${TREND_GLYPH[trend]} ` : ""}
          {trendValue ?? ""}
        </span>
      ) : null}
    </div>
  );
}
