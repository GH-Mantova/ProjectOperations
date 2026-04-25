import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Incident = {
  id: string;
  incidentNumber: string;
  incidentDate: string;
  location: string;
  incidentType: string;
  severity: string;
  description: string;
  status: string;
  reportedBy?: { firstName: string; lastName: string } | null;
};

type Hazard = {
  id: string;
  hazardNumber: string;
  observationDate: string;
  location: string;
  hazardType: string;
  riskLevel: string;
  description: string;
  status: string;
  dueDate: string | null;
  reportedBy?: { firstName: string; lastName: string } | null;
  assignedTo?: { firstName: string; lastName: string } | null;
};

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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function SafetyPage() {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState<"incidents" | "hazards">("incidents");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, i, h] = await Promise.all([
        authFetch("/safety/dashboard"),
        authFetch("/safety/incidents?limit=50"),
        authFetch("/safety/hazards?limit=50")
      ]);
      if (d.ok) setDashboard((await d.json()) as Dashboard);
      if (i.ok) setIncidents(((await i.json()) as { items: Incident[] }).items);
      if (h.ok) setHazards(((await h.json()) as { items: Hazard[] }).items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 className="s7-type-page-heading" style={{ margin: 0 }}>Safety</h1>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 13 }}>
          Incident reports and hazard observations.
        </p>
      </header>

      {dashboard ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginBottom: 14
          }}
        >
          <SummaryCard label="Open incidents" value={dashboard.openIncidents.total} bg="#dc2626" />
          <SummaryCard label="Open hazards" value={dashboard.openHazards.total} bg="#f97316" />
          <SummaryCard label="Overdue hazards" value={dashboard.overdueHazards} bg="#7f1d1d" />
        </div>
      ) : null}

      <nav role="tablist" style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "incidents"}
          className={
            tab === "incidents"
              ? "s7-btn s7-btn--secondary s7-btn--sm"
              : "s7-btn s7-btn--ghost s7-btn--sm"
          }
          onClick={() => setTab("incidents")}
        >
          Incidents ({incidents.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "hazards"}
          className={
            tab === "hazards"
              ? "s7-btn s7-btn--secondary s7-btn--sm"
              : "s7-btn s7-btn--ghost s7-btn--sm"
          }
          onClick={() => setTab("hazards")}
        >
          Hazards ({hazards.length})
        </button>
      </nav>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : tab === "incidents" ? (
        <IncidentsTable rows={incidents} />
      ) : (
        <HazardsTable rows={hazards} />
      )}
    </div>
  );
}

function IncidentsTable({ rows }: { rows: Incident[] }) {
  if (rows.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>No incidents recorded.</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
          <tr>
            {["#", "Date", "Location", "Type", "Severity", "Status", "Description"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "6px 8px",
                  textAlign: "left",
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "var(--text-muted)"
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <td style={{ padding: "6px 8px" }}>
                <strong>{r.incidentNumber}</strong>
              </td>
              <td style={{ padding: "6px 8px", fontSize: 12 }}>{fmtDate(r.incidentDate)}</td>
              <td style={{ padding: "6px 8px", fontSize: 12 }}>{r.location}</td>
              <td style={{ padding: "6px 8px", fontSize: 12, textTransform: "capitalize" }}>
                {r.incidentType.replace(/_/g, " ")}
              </td>
              <td style={{ padding: "6px 8px" }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    background: SEVERITY_TONE[r.severity] ?? "#6b7280",
                    color: "#fff",
                    borderRadius: 999,
                    textTransform: "uppercase"
                  }}
                >
                  {r.severity}
                </span>
              </td>
              <td style={{ padding: "6px 8px", fontSize: 12, textTransform: "capitalize" }}>{r.status}</td>
              <td style={{ padding: "6px 8px", fontSize: 12 }}>
                {r.description.length > 100 ? `${r.description.slice(0, 97)}…` : r.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HazardsTable({ rows }: { rows: Hazard[] }) {
  if (rows.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>No hazards recorded.</p>;
  }
  const now = Date.now();
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
          <tr>
            {["#", "Date", "Location", "Type", "Risk", "Status", "Due", "Description"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "6px 8px",
                  textAlign: "left",
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "var(--text-muted)"
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const overdue =
              r.dueDate && new Date(r.dueDate).getTime() < now && r.status !== "closed";
            return (
              <tr
                key={r.id}
                style={{
                  borderTop: "1px solid var(--border, #e5e7eb)",
                  background: overdue ? "rgba(220,38,38,0.07)" : undefined
                }}
              >
                <td style={{ padding: "6px 8px" }}>
                  <strong>{r.hazardNumber}</strong>
                </td>
                <td style={{ padding: "6px 8px", fontSize: 12 }}>{fmtDate(r.observationDate)}</td>
                <td style={{ padding: "6px 8px", fontSize: 12 }}>{r.location}</td>
                <td style={{ padding: "6px 8px", fontSize: 12, textTransform: "capitalize" }}>{r.hazardType}</td>
                <td style={{ padding: "6px 8px" }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      background: RISK_TONE[r.riskLevel] ?? "#6b7280",
                      color: "#fff",
                      borderRadius: 999,
                      textTransform: "uppercase"
                    }}
                  >
                    {r.riskLevel}
                  </span>
                </td>
                <td style={{ padding: "6px 8px", fontSize: 12, textTransform: "capitalize" }}>{r.status}</td>
                <td style={{ padding: "6px 8px", fontSize: 12, color: overdue ? "#dc2626" : undefined }}>
                  {fmtDate(r.dueDate)}
                  {overdue ? " (overdue)" : ""}
                </td>
                <td style={{ padding: "6px 8px", fontSize: 12 }}>
                  {r.description.length > 100 ? `${r.description.slice(0, 97)}…` : r.description}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ label, value, bg }: { label: string; value: number; bg: string }) {
  return (
    <div
      className="s7-card"
      style={{ padding: 12, borderLeft: `4px solid ${bg}`, display: "flex", flexDirection: "column", gap: 4 }}
    >
      <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 0.4 }}>
        {label}
      </span>
      <strong style={{ fontSize: 28, color: bg }}>{value}</strong>
    </div>
  );
}
