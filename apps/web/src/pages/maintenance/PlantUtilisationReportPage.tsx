import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChartWidget, EmptyState, KpiCard, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import {
  buildChartData,
  defaultDateRange,
  formatHours,
  formatPercent,
  summariseUtilisation,
  type UtilisationRow
} from "./utilisation-report-helpers";

export function PlantUtilisationReportPage() {
  const { authFetch } = useAuth();
  const initial = useMemo(() => defaultDateRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rows, setRows] = useState<UtilisationRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to });
    authFetch(`/maintenance/assets/utilisation?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load utilisation data.");
        const data = (await response.json()) as UtilisationRow[];
        if (!cancelled) setRows(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, from, to]);

  const summary = useMemo(() => summariseUtilisation(rows ?? []), [rows]);
  const chartData = useMemo(() => buildChartData(rows ?? [], 10), [rows]);
  const invalidRange = Boolean(from && to && from > to);

  return (
    <div className="utilisation-report-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Resources</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Plant utilisation report</h1>
          <p className="s7-type-body" style={{ margin: "6px 0 0", color: "var(--text-secondary, #6b7280)" }}>
            Read-only view of asset hours allocated against Mon–Fri × 8h availability for the selected window.
          </p>
        </div>
        <Link to="/maintenance" className="s7-btn s7-btn--ghost" style={{ minHeight: 44, alignSelf: "center" }}>
          Back to maintenance
        </Link>
      </header>

      <section
        className="s7-card"
        style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", padding: 16 }}
        aria-label="Report filters"
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="s7-type-label">From</span>
          <input
            className="s7-input"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            style={{ minHeight: 44 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="s7-type-label">To</span>
          <input
            className="s7-input"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            style={{ minHeight: 44 }}
          />
        </label>
      </section>

      {invalidRange ? (
        <div className="tender-page__error" role="alert">
          From date must be on or before To date.
        </div>
      ) : null}
      {error ? (
        <div className="tender-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <section
        className="utilisation-report-page__kpis"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16
        }}
      >
        {loading && rows === null ? (
          Array.from({ length: 4 }).map((_, idx) => <Skeleton key={`kpi-skel-${idx}`} height={100} />)
        ) : (
          <>
            <KpiCard label="Fleet utilisation" value={formatPercent(summary.fleetUtilisationRate)} />
            <KpiCard label="Assets in window" value={summary.assetCount} />
            <KpiCard label="Hours allocated" value={formatHours(summary.totalHoursAllocated)} />
            <KpiCard
              label="Top asset"
              value={summary.topAsset ? summary.topAsset.assetName : "—"}
              trendValue={summary.topAsset ? formatPercent(summary.topAsset.utilisationRate) : undefined}
            />
          </>
        )}
      </section>

      <section aria-label="Top assets by utilisation">
        {loading && rows === null ? (
          <Skeleton height={260} />
        ) : (
          <BarChartWidget
            title="Top 10 assets by utilisation (%)"
            data={chartData}
            unit="%"
            yAxisFormatter={(value) => `${value}%`}
            tooltipFormatter={(value) => `${value}%`}
          />
        )}
      </section>

      <section className="s7-card" style={{ padding: 0, overflowX: "auto" }} aria-label="Utilisation table">
        {loading && rows === null ? (
          <div style={{ padding: 16 }}>
            <Skeleton height={32} />
            <Skeleton height={24} style={{ marginTop: 8 }} />
            <Skeleton height={24} style={{ marginTop: 8 }} />
          </div>
        ) : rows && rows.length === 0 ? (
          <EmptyState
            heading="No utilisation in this window"
            subtext="Try a wider date range or check that shift allocations exist for these dates."
          />
        ) : (
          <table className="s7-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cellHeader}>Asset</th>
                <th style={cellHeader}>Category</th>
                <th style={cellHeaderRight}>Hours allocated</th>
                <th style={cellHeaderRight}>Hours available</th>
                <th style={cellHeaderRight}>Utilisation</th>
                <th style={cellHeaderRight}>Allocations</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((entry) => (
                <tr key={entry.assetId}>
                  <td style={cellBody}>
                    <Link to={`/assets/${entry.assetId}`} style={{ color: "var(--brand-primary, #005B61)" }}>
                      {entry.assetName}
                    </Link>
                  </td>
                  <td style={cellBody}>{entry.category || "—"}</td>
                  <td style={cellBodyRight}>{formatHours(entry.hoursAllocated)}</td>
                  <td style={cellBodyRight}>{formatHours(entry.hoursAvailable)}</td>
                  <td style={cellBodyRight}>{formatPercent(entry.utilisationRate)}</td>
                  <td style={cellBodyRight}>{entry.allocationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const cellHeader: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  borderBottom: "1px solid var(--surface-border, #e5e7eb)",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-secondary, #6b7280)"
};

const cellHeaderRight: React.CSSProperties = { ...cellHeader, textAlign: "right" };

const cellBody: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--surface-border, #e5e7eb)",
  fontSize: 14,
  color: "var(--text-primary, #111827)"
};

const cellBodyRight: React.CSSProperties = { ...cellBody, textAlign: "right" };
