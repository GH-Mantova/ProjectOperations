import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type Dashboard = {
  openIncidents: { total: number; bySeverity: Record<string, number> };
  openHazards: { total: number; byRiskLevel: Record<string, number> };
  overdueHazards: number;
};

const SEVERITY_TONE: Record<string, string> = {
  low: "#16a34a",
  medium: "#eab308",
  high: "#f97316",
  critical: "#dc2626"
};
const RISK_TONE: Record<string, string> = {
  low: "#16a34a",
  medium: "#eab308",
  high: "#f97316",
  extreme: "#dc2626"
};

export function SafetySummaryWidget() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authFetch("/safety/dashboard")
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(await r.text());
          return;
        }
        setData((await r.json()) as Dashboard);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  return (
    <div className="s7-card" style={{ padding: 14, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Safety summary</strong>
        <Link to="/safety" style={{ fontSize: 11 }}>View all</Link>
      </div>
      {error ? (
        <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{error}</p>
      ) : !data ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
          <Row label="Open incidents" total={data.openIncidents.total} parts={data.openIncidents.bySeverity} tones={SEVERITY_TONE} />
          <Row label="Open hazards" total={data.openHazards.total} parts={data.openHazards.byRiskLevel} tones={RISK_TONE} />
          {data.overdueHazards > 0 ? (
            <div style={{ color: "#dc2626" }}>
              <strong>{data.overdueHazards}</strong> hazard{data.overdueHazards === 1 ? "" : "s"} overdue
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── KPIs (PR for Monday presentation) ────────────────────────────────────

function useSafetyDashboard() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => {
    let cancelled = false;
    void authFetch("/safety/dashboard")
      .then(async (r) => {
        if (cancelled || !r.ok) return;
        setData((await r.json()) as Dashboard);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authFetch]);
  return data;
}

function KpiCard({
  label,
  value,
  tone,
  to
}: {
  label: string;
  value: number | string;
  tone?: "danger" | "warning" | "default";
  to?: string;
}) {
  const colour =
    tone === "danger" ? "#dc2626" : tone === "warning" ? "#f97316" : "var(--text-default, #242424)";
  return (
    <div className="s7-card" style={{ padding: 14, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
          {label}
        </span>
        {to ? (
          <Link to={to} style={{ fontSize: 11 }}>
            View
          </Link>
        ) : null}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6, color: colour }}>{value}</div>
    </div>
  );
}

export function SafetyOpenIncidentsKpi() {
  const data = useSafetyDashboard();
  const total = data?.openIncidents.total ?? 0;
  return (
    <KpiCard label="Open incidents" value={data ? total : "…"} tone={total > 0 ? "danger" : "default"} to="/safety" />
  );
}

export function SafetyOpenHazardsKpi() {
  const data = useSafetyDashboard();
  const total = data?.openHazards.total ?? 0;
  return (
    <KpiCard
      label="Open hazards"
      value={data ? total : "…"}
      tone={total > 0 ? "warning" : "default"}
      to="/safety"
    />
  );
}

export function SafetyOverdueHazardsKpi() {
  const data = useSafetyDashboard();
  const total = data?.overdueHazards ?? 0;
  return (
    <KpiCard
      label="Overdue hazards"
      value={data ? total : "…"}
      tone={total > 0 ? "danger" : "default"}
      to="/safety"
    />
  );
}

type RecentIncident = {
  id: string;
  number: string;
  occurredAt: string | null;
  severity: string;
  description: string;
};

export function SafetyRecentIncidentsList() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<RecentIncident[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void authFetch("/safety/incidents?limit=5&sort=-occurredAt")
      .then(async (r) => {
        if (cancelled || !r.ok) return;
        const body = await r.json();
        const list = Array.isArray(body) ? body : body.items ?? [];
        setItems(list as RecentIncident[]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authFetch]);
  return (
    <div className="s7-card" style={{ padding: 14, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Recent incidents</strong>
        <Link to="/safety" style={{ fontSize: 11 }}>
          View all
        </Link>
      </div>
      {!items ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No incidents recorded.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.slice(0, 5).map((i) => (
            <li
              key={i.id}
              style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, alignItems: "baseline" }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong>{i.number}</strong> · {i.description}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  background: SEVERITY_TONE[i.severity?.toLowerCase()] ?? "#6b7280",
                  color: "#fff",
                  borderRadius: 999,
                  textTransform: "uppercase"
                }}
              >
                {i.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  label,
  total,
  parts,
  tones
}: {
  label: string;
  total: number;
  parts: Record<string, number>;
  tones: Record<string, string>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <strong>{total}</strong>
      </div>
      {total > 0 ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {Object.entries(parts)
            .sort()
            .map(([k, v]) => (
              <span
                key={k}
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  background: tones[k] ?? "#6b7280",
                  color: "#fff",
                  borderRadius: 999,
                  textTransform: "uppercase"
                }}
              >
                {k}: {v}
              </span>
            ))}
        </div>
      ) : null}
    </div>
  );
}
