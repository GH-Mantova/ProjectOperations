import { useEffect, useState } from "react";
import { usePortalAuth } from "../PortalAuthContext";

type Dashboard = {
  client: { id: string; name: string; code: string | null };
  counts: { activeProjects: number; openQuotes: number; recentDocuments: number };
};

export function PortalDashboardPage() {
  const { authFetch, user } = usePortalAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/portal/client/dashboard")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, [authFetch]);

  return (
    <div>
      <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Welcome back, {user?.firstName}</h1>
      <p style={{ margin: "0 0 24px", color: "#666", fontSize: 14 }}>
        Snapshot of your projects, jobs, and documents with Initial Services.
      </p>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {data ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <Stat label="Active projects" value={data.counts.activeProjects} />
          <Stat label="Open quotes" value={data.counts.openQuotes} />
          <Stat label="Documents available" value={data.counts.recentDocuments} />
        </div>
      ) : !error ? (
        <p style={{ color: "#999" }}>Loading…</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 6,
        padding: 18
      }}
    >
      <div style={{ fontSize: 12, textTransform: "uppercase", color: "#888", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 600, color: "#005B61", marginTop: 6 }}>{value}</div>
    </div>
  );
}
