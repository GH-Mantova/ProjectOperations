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

// ── KPIs (PR for Monday presentation) ────────────────────────────────────

function useComplianceDashboard() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  useEffect(() => {
    let cancelled = false;
    void authFetch("/compliance/dashboard")
      .then(async (r) => {
        if (cancelled || !r.ok) return;
        setData((await r.json()) as DashboardData);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authFetch]);
  return data;
}

function flatten(data: DashboardData | null): ExpiryRow[] {
  if (!data) return [];
  return [...data.licences, ...data.insurances, ...data.qualifications];
}

function ComplianceKpi({
  label,
  value,
  tone,
  to
}: {
  label: string;
  value: number | string;
  tone: "danger" | "warning" | "default";
  to: string;
}) {
  const colour =
    tone === "danger" ? "#dc2626" : tone === "warning" ? "#f97316" : "var(--text-default, #242424)";
  return (
    <div className="s7-card" style={{ padding: 14, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
          {label}
        </span>
        <Link to={to} style={{ fontSize: 11 }}>
          View
        </Link>
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6, color: colour }}>{value}</div>
    </div>
  );
}

export function ComplianceExpiringKpi() {
  const data = useComplianceDashboard();
  const all = flatten(data);
  const count = all.filter(
    (r) => r.status === "expiring_30" || r.status === "expiring_7"
  ).length;
  return (
    <ComplianceKpi
      label="Expiring (30d)"
      value={data ? count : "…"}
      tone={count > 0 ? "warning" : "default"}
      to="/compliance"
    />
  );
}

export function ComplianceExpiredKpi() {
  const data = useComplianceDashboard();
  const all = flatten(data);
  const count = all.filter((r) => r.status === "expired").length;
  return (
    <ComplianceKpi
      label="Expired"
      value={data ? count : "…"}
      tone={count > 0 ? "danger" : "default"}
      to="/compliance"
    />
  );
}

type BlockedRow = { id: string; name: string; reason?: string };

export function ComplianceBlockedSubcontractorsKpi() {
  const { authFetch } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void authFetch("/compliance/blocked-subcontractors")
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          // Endpoint may 404 in older deploys — degrade gracefully to 0.
          setCount(0);
          return;
        }
        const body = await r.json();
        const list = Array.isArray(body) ? body : body.items ?? [];
        setCount((list as BlockedRow[]).length);
      })
      .catch(() => setCount(0));
    return () => {
      cancelled = true;
    };
  }, [authFetch]);
  return (
    <ComplianceKpi
      label="Blocked subbies"
      value={count === null ? "…" : count}
      tone={(count ?? 0) > 0 ? "danger" : "default"}
      to="/directory/subcontractors"
    />
  );
}

export function ComplianceExpiryListWidget() {
  const data = useComplianceDashboard();
  const rows = flatten(data)
    .filter((r) => r.status !== "active" && r.status !== "not_set")
    .sort((a, b) => (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999));

  return (
    <div className="s7-card" style={{ padding: 14, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Expiry alerts</strong>
        <Link to="/compliance" style={{ fontSize: 11 }}>
          View all
        </Link>
      </div>
      {!data ? (
        <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#16a34a", fontSize: 13 }}>All compliance items are current ✓</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Entity", "Type", "Item", "Expiry", "Days"].map((h) => (
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
            {rows.map((r) => (
              <tr
                key={`${r.itemType}-${r.id}`}
                style={{ borderTop: "1px solid var(--border, #e5e7eb)", background: rowTone(r.status) }}
              >
                <td style={{ padding: "4px 6px" }}>{r.entityName}</td>
                <td style={{ padding: "4px 6px", textTransform: "capitalize" }}>{r.itemType}</td>
                <td style={{ padding: "4px 6px", textTransform: "capitalize" }}>
                  {r.type.replace(/_/g, " ")}
                </td>
                <td style={{ padding: "4px 6px" }}>{fmtDate(r.expiryDate)}</td>
                <td style={{ padding: "4px 6px" }}>
                  {r.daysUntilExpiry === null ? "—" : `${r.daysUntilExpiry}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
