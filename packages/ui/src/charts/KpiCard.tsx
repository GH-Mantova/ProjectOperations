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
  const accent = color ?? "var(--brand-primary, #1f4bff)";
  return (
    <div
      className="kpi-card"
      style={{
        background: "var(--surface-card, #ffffff)",
        border: "1px solid var(--surface-border, #e5e7eb)",
        borderRadius: "var(--radius-lg, 12px)",
        padding: "16px 18px",
        minHeight: 44,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)"
      }}
    >
      <span
        className="kpi-card__label"
        style={{
          color: "var(--text-muted, #6b7280)",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.4
        }}
      >
        {label}
      </span>
      <strong
        className="kpi-card__value"
        style={{
          color: accent,
          fontSize: 28,
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
