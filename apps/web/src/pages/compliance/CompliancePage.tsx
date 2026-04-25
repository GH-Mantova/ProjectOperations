import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type ExpiryRow = {
  id: string;
  itemType: "licence" | "insurance" | "qualification";
  type: string;
  number: string | null;
  expiryDate: string | null;
  status: "not_set" | "active" | "expiring_30" | "expiring_7" | "expired";
  daysUntilExpiry: number | null;
  entityType: "client" | "subcontractor" | "worker";
  entityId: string;
  entityName: string;
};

type DashboardData = {
  licences: ExpiryRow[];
  insurances: ExpiryRow[];
  qualifications: ExpiryRow[];
};

type BlockedSub = {
  id: string;
  name: string;
  complianceBlockReason: string | null;
  complianceBlockedAt: string | null;
};

const DAY_OPTIONS = [7, 14, 30, 60, 90];
const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "licence", label: "Licences" },
  { value: "insurance", label: "Insurances" },
  { value: "qualification", label: "Qualifications" }
];
const ENTITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "client", label: "Clients" },
  { value: "subcontractor", label: "Subcontractors" },
  { value: "worker", label: "Workers" }
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function statusTone(status: ExpiryRow["status"]): { bg: string; label: string } {
  if (status === "expired") return { bg: "#dc2626", label: "Expired" };
  if (status === "expiring_7") return { bg: "#f97316", label: "Expiring soon" };
  if (status === "expiring_30") return { bg: "#eab308", label: "Expiring soon" };
  if (status === "active") return { bg: "#16a34a", label: "Active" };
  return { bg: "#94A3B8", label: "Not set" };
}

function daysCellTone(days: number | null): string {
  if (days === null) return "var(--text-muted)";
  if (days < 0) return "#dc2626";
  if (days <= 7) return "#f97316";
  if (days <= 30) return "#eab308";
  return "var(--text-default)";
}

export function CompliancePage() {
  const { authFetch, user } = useAuth();
  const isAdmin = Boolean(user?.isSuperUser) || Boolean(user?.permissions?.includes("compliance.admin"));

  const [days, setDays] = useState<number>(30);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [showExpired, setShowExpired] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [blocked, setBlocked] = useState<BlockedSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r1, r2] = await Promise.all([
        authFetch(`/compliance/expiring?days=${days}`),
        authFetch("/compliance/blocked-subcontractors")
      ]);
      if (!r1.ok) throw new Error(await r1.text());
      setData((await r1.json()) as DashboardData);
      if (r2.ok) setBlocked((await r2.json()) as BlockedSub[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const allRows = useMemo<ExpiryRow[]>(() => {
    if (!data) return [];
    return [...data.licences, ...data.insurances, ...data.qualifications];
  }, [data]);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (typeFilter !== "all" && r.itemType !== typeFilter) return false;
      if (entityFilter !== "all" && r.entityType !== entityFilter) return false;
      if (!showExpired && r.status === "expired") return false;
      return true;
    });
  }, [allRows, typeFilter, entityFilter, showExpired]);

  const counts = useMemo(() => {
    let expired = 0;
    let expiring7 = 0;
    let expiring30 = 0;
    for (const r of allRows) {
      if (r.status === "expired") expired += 1;
      else if (r.status === "expiring_7") expiring7 += 1;
      else if (r.status === "expiring_30") expiring30 += 1;
    }
    return { expired, expiring7, expiring30, blocked: blocked.length };
  }, [allRows, blocked.length]);

  const unblock = async (id: string) => {
    if (!isAdmin) return;
    const response = await authFetch(`/compliance/subcontractors/${id}/block`, {
      method: "PATCH",
      body: JSON.stringify({ blocked: false })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 className="s7-type-page-heading" style={{ margin: 0 }}>Compliance</h1>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 13 }}>
          Licence, insurance and qualification expiry tracking.
        </p>
      </header>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
        <SummaryCard label="Expired now" value={counts.expired} bg="#dc2626" />
        <SummaryCard label="Expiring within 7 days" value={counts.expiring7} bg="#f97316" />
        <SummaryCard label="Expiring within 30 days" value={counts.expiring30} bg="#eab308" />
        <SummaryCard label="Compliance blocked" value={counts.blocked} bg="#7f1d1d" />
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          padding: 10,
          background: "var(--surface-subtle, rgba(0,0,0,0.02))",
          borderRadius: 6,
          marginBottom: 12
        }}
      >
        <FilterChips
          label="Days ahead"
          value={String(days)}
          options={DAY_OPTIONS.map((d) => ({ value: String(d), label: String(d) }))}
          onChange={(v) => setDays(Number(v))}
        />
        <FilterChips
          label="Type"
          value={typeFilter}
          options={TYPE_OPTIONS}
          onChange={setTypeFilter}
        />
        <FilterChips
          label="Entity"
          value={entityFilter}
          options={ENTITY_OPTIONS}
          onChange={setEntityFilter}
        />
        <label style={{ fontSize: 13, display: "inline-flex", gap: 4, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showExpired}
            onChange={(e) => setShowExpired(e.target.checked)}
          />
          Show expired
        </label>
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : filteredRows.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No items match the current filters.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
              <tr>
                {["Entity", "Type", "Item", "Expiry", "Days", "Status"].map((h) => (
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
              {filteredRows.map((r) => {
                const tone = statusTone(r.status);
                return (
                  <tr key={`${r.itemType}-${r.id}`} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={{ padding: "6px 8px" }}>
                      <strong>{r.entityName}</strong>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>
                        {r.entityType}
                      </div>
                    </td>
                    <td style={{ padding: "6px 8px", textTransform: "capitalize", fontSize: 12 }}>
                      {r.itemType}
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>
                      {r.type.replace(/_/g, " ")}
                      {r.number ? <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.number}</div> : null}
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{fmtDate(r.expiryDate)}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12, color: daysCellTone(r.daysUntilExpiry) }}>
                      {r.daysUntilExpiry === null ? "—" : `${r.daysUntilExpiry} days`}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          background: tone.bg,
                          color: "#fff",
                          borderRadius: 999,
                          textTransform: "uppercase"
                        }}
                      >
                        {tone.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {blocked.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <h2 className="s7-type-section-heading" style={{ marginBottom: 6 }}>
            Blocked subcontractors ({blocked.length})
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
                <tr>
                  {["Name", "Reason", "Blocked at", ""].map((h) => (
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
                {blocked.map((b) => (
                  <tr key={b.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={{ padding: "6px 8px" }}>
                      <strong>{b.name}</strong>
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{b.complianceBlockReason ?? "—"}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{fmtDate(b.complianceBlockedAt)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="s7-btn s7-btn--secondary s7-btn--sm"
                          onClick={() => void unblock(b.id)}
                        >
                          Unblock
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, bg }: { label: string; value: number; bg: string }) {
  return (
    <div
      className="s7-card"
      style={{
        padding: 12,
        borderLeft: `4px solid ${bg}`,
        display: "flex",
        flexDirection: "column",
        gap: 4
      }}
    >
      <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: 0.4 }}>
        {label}
      </span>
      <strong style={{ fontSize: 28, color: bg }}>{value}</strong>
    </div>
  );
}

function FilterChips({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}:</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={
            value === opt.value
              ? "s7-btn s7-btn--secondary s7-btn--sm"
              : "s7-btn s7-btn--ghost s7-btn--sm"
          }
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
