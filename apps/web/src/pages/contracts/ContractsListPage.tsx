import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type ContractRow = {
  id: string;
  contractNumber: string;
  contractValue: string;
  retentionPct: string;
  status: "ACTIVE" | "PRACTICAL_COMPLETION" | "DEFECTS" | "CLOSED";
  createdAt: string;
  project: { id: string; projectNumber: string; name: string; client: { id: string; name: string } | null };
};

const STATUS_LABEL: Record<ContractRow["status"], string> = {
  ACTIVE: "Active",
  PRACTICAL_COMPLETION: "Practical completion",
  DEFECTS: "Defects liability",
  CLOSED: "Closed"
};
const STATUS_COLOR: Record<ContractRow["status"], string> = {
  ACTIVE: "#005B61",
  PRACTICAL_COMPLETION: "#3B82F6",
  DEFECTS: "#F59E0B",
  CLOSED: "#9CA3AF"
};

function fmtCurrency(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

export function ContractsListPage() {
  const { authFetch, user } = useAuth();
  const canManage = useMemo(
    () => user?.permissions.includes("finance.manage") ?? false,
    [user]
  );
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<ContractRow["status"] | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter === "ALL" ? "/contracts" : `/contracts?status=${statusFilter}`;
      const response = await authFetch(url);
      if (!response.ok) throw new Error(await response.text());
      setContracts((await response.json()) as ContractRow[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>Contracts</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
            One contract per project. Tracks variations, progress claims, retention, and payment status.
          </p>
        </div>
        {canManage ? (
          <Link to="/contracts/new" className="s7-btn s7-btn--primary">+ New contract</Link>
        ) : null}
      </header>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {(["ALL", "ACTIVE", "PRACTICAL_COMPLETION", "DEFECTS", "CLOSED"] as const).map((s) => {
          const active = s === statusFilter;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: active ? "2px solid #005B61" : "1px solid var(--border, #e5e7eb)",
                background: active ? "rgba(0,91,97,0.08)" : "transparent",
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              {s === "ALL" ? "All" : STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : contracts.length === 0 ? (
        <div className="s7-card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          No contracts yet.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
            <tr>
              {["Contract #", "Project", "Client", "Status", "Contract value", "Retention", "Created"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                  <Link to={`/contracts/${c.id}`} style={{ color: "#005B61" }}>{c.contractNumber}</Link>
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <Link to={`/projects/${c.project.id}`}>{c.project.projectNumber}</Link>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.project.name}</div>
                </td>
                <td style={{ padding: "8px 10px" }}>{c.project.client?.name ?? "—"}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{
                    padding: "1px 8px",
                    borderRadius: 999,
                    background: STATUS_COLOR[c.status],
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600
                  }}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td style={{ padding: "8px 10px" }}>{fmtCurrency(c.contractValue)}</td>
                <td style={{ padding: "8px 10px" }}>{Number(c.retentionPct).toFixed(1)}%</td>
                <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>
                  {new Date(c.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
