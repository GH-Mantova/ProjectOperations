import type { ReactNode } from "react";

export function KpiTile({
  label,
  value,
  subtitle,
  accent
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div
      className="td-v2__kpi"
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}
    >
      <span className="td-v2__kpi-label">{label}</span>
      <strong className="td-v2__kpi-value">{value}</strong>
      {subtitle ? <span className="td-v2__kpi-subtitle">{subtitle}</span> : null}
    </div>
  );
}

export function PanelCard({
  title,
  actions,
  children
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="s7-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>{title}</h3>
        {actions ?? null}
      </div>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p style={{ color: "var(--text-muted)" }}>{children}</p>;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

export function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
