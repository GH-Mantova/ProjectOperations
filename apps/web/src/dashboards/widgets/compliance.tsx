import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type ExpiryRow = {
  id: string;
  itemType: "licence" | "insurance" | "qualification";
  type: string;
  expiryDate: string | null;
  status: "not_set" | "active" | "expiring_30" | "expiring_7" | "expired";
  daysUntilExpiry: number | null;
  entityName: string;
};

type DashboardData = {
  licences: ExpiryRow[];
  insurances: ExpiryRow[];
  qualifications: ExpiryRow[];
};

function rowTone(status: ExpiryRow["status"]): string {
  if (status === "expired") return "rgba(220, 38, 38, 0.10)";
  if (status === "expiring_7") return "rgba(249, 115, 22, 0.10)";
  if (status === "expiring_30") return "rgba(234, 179, 8, 0.08)";
  return "transparent";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

export function ComplianceAlertsWidget() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<ExpiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authFetch("/compliance/dashboard")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await response.text());
          setLoading(false);
          return;
        }
        const body = (await response.json()) as DashboardData;
        const all = [...body.licences, ...body.insurances, ...body.qualifications].sort((a, b) => {
          // Most urgent first — expired (negative days) before soon, before further out.
          const ax = a.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
          const bx = b.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
          return ax - bx;
        });
        setRows(all);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  return (
    <div className="s7-card" style={{ padding: 14, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Compliance alerts</strong>
        <Link to="/compliance" style={{ fontSize: 11 }}>View all</Link>
      </div>
      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{error}</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#16a34a", fontSize: 13 }}>All compliance items are current ✓</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Entity", "Item", "Expiry", "Days"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "4px 6px",
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
            {rows.slice(0, 8).map((r) => (
              <tr
                key={`${r.itemType}-${r.id}`}
                style={{ borderTop: "1px solid var(--border, #e5e7eb)", background: rowTone(r.status) }}
              >
                <td style={{ padding: "4px 6px" }}>{r.entityName}</td>
                <td style={{ padding: "4px 6px", textTransform: "capitalize" }}>
                  {r.itemType} · {r.type.replace(/_/g, " ")}
                </td>
                <td style={{ padding: "4px 6px" }}>{fmtDate(r.expiryDate)}</td>
                <td style={{ padding: "4px 6px" }}>{r.daysUntilExpiry === null ? "—" : `${r.daysUntilExpiry}d`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
