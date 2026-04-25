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
