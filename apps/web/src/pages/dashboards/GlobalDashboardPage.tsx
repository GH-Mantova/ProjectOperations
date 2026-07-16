import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type DataPoint = { label: string; value: number };

type WidgetRender =
  | { type: "kpi"; title: string; metricKey: string; value: number | string; trend: string | null; trendValue: string | null }
  | { type: "bar_chart" | "line_chart" | "donut_chart"; title: string; metricKey: string; data: DataPoint[] }
  | { type: string; title?: string; metricKey?: string };

type WidgetEntry = {
  id: string;
  title: string;
  type: string;
  data: WidgetRender;
};

type DashboardRender = {
  id: string;
  name: string;
  description: string | null;
  scope: "GLOBAL" | "ROLE" | "USER";
  widgets: WidgetEntry[];
};

function renderKpi(value: number | string, trend: string | null, trendValue: string | null) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 32, fontWeight: 600 }}>{value}</span>
      {trendValue ? (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {trend ? `${trend} · ` : ""}{trendValue}
        </span>
      ) : null}
    </div>
  );
}

function renderChart(data: DataPoint[]) {
  if (!data || data.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No data.</p>;
  }
  const max = Math.max(...data.map((p) => Math.abs(p.value)), 1);
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      {data.map((point) => (
        <li key={point.label} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 8, alignItems: "center", fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>{point.label}</span>
          <span
            style={{
              display: "inline-block",
              height: 8,
              background: "var(--accent, #4a76c9)",
              width: `${Math.max(4, Math.round((Math.abs(point.value) / max) * 100))}%`,
              borderRadius: 4
            }}
          />
          <strong>{point.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function renderWidgetBody(data: WidgetRender) {
  if (data.type === "kpi") {
    const w = data as Extract<WidgetRender, { type: "kpi" }>;
    return renderKpi(w.value, w.trend, w.trendValue);
  }
  if (data.type === "bar_chart" || data.type === "line_chart" || data.type === "donut_chart") {
    const w = data as Extract<WidgetRender, { data: DataPoint[] }>;
    return renderChart(w.data);
  }
  return (
    <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
      Widget type <code>{data.type}</code> not renderable here.
    </p>
  );
}

export function GlobalDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardRender | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/dashboards/${encodeURIComponent(id)}/render`);
      if (!response.ok) throw new Error(await response.text());
      setDashboard((await response.json()) as DashboardRender);
    } catch (err) {
      setError((err as Error).message || "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!id) return null;

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h1 className="s7-type-page-heading" style={{ margin: 0 }}>
            {dashboard?.name ?? (loading ? "Loading…" : "Dashboard")}
          </h1>
          {dashboard?.description ? (
            <p style={{ color: "var(--text-muted)", marginTop: 4, marginBottom: 0, fontSize: 13 }}>
              {dashboard.description}
            </p>
          ) : null}
        </div>
        <Link to="/account" style={{ fontSize: 13 }}>
          Change default dashboard
        </Link>
      </header>

      {error ? (
        <p style={{ color: "var(--text-danger, #b3261e)" }}>{error}</p>
      ) : loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : dashboard && dashboard.widgets.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12
          }}
        >
          {dashboard.widgets.map((widget) => (
            <div key={widget.id} className="s7-card" style={{ padding: 16 }}>
              <h3 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>
                {widget.title}
              </h3>
              {renderWidgetBody(widget.data)}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>This dashboard has no widgets yet.</p>
      )}
    </div>
  );
}
