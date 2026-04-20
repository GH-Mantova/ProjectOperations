import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type TenderRecord = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  estimatedValue?: string | null;
  dueDate?: string | null;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{
    isAwarded: boolean;
    contractIssued?: boolean;
    contractIssuedAt?: string | null;
    client?: { id: string; name: string } | null;
  }>;
  outcomes?: Array<{ outcomeType?: string }>;
};

type Tab = "estimators" | "pipeline" | "clients";

const STAGE_ORDER: Array<{ key: string; label: string; color: string }> = [
  { key: "DRAFT", label: "Draft", color: "#94A3B8" },
  { key: "IN_PROGRESS", label: "Estimating", color: "#FEAA6D" },
  { key: "SUBMITTED", label: "Submitted", color: "#005B61" },
  { key: "AWARDED", label: "Awarded", color: "#22C55E" },
  { key: "CONTRACT_ISSUED", label: "Contract", color: "#22C55E" },
  { key: "LOST", label: "Lost", color: "#EF4444" },
  { key: "WITHDRAWN", label: "Withdrawn", color: "#E2E8F0" }
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function isWon(tender: TenderRecord): boolean {
  return tender.status === "AWARDED" || tender.tenderClients.some((c) => c.isAwarded);
}

function isSubmittedOrResolved(tender: TenderRecord): boolean {
  return ["SUBMITTED", "AWARDED", "LOST"].includes(tender.status);
}

export function TenderingReportsPage() {
  const { authFetch } = useAuth();
  const [tenders, setTenders] = useState<TenderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("estimators");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const response = await authFetch("/tenders?page=1&pageSize=100");
        if (!response.ok) throw new Error("Could not load tenders.");
        const body = await response.json();
        setTenders(body.items ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

  const estimatorRows = useMemo(() => {
    const map = new Map<string, {
      estimatorId: string;
      name: string;
      submitted: number;
      won: number;
      lost: number;
      wonValue: number;
      submittedValue: number;
      leadTimes: number[];
    }>();
    for (const t of tenders) {
      if (!isSubmittedOrResolved(t)) continue;
      const key = t.estimator?.id ?? "unassigned";
      const name = t.estimator ? `${t.estimator.firstName} ${t.estimator.lastName}` : "Unassigned";
      const entry = map.get(key) ?? {
        estimatorId: key,
        name,
        submitted: 0,
        won: 0,
        lost: 0,
        wonValue: 0,
        submittedValue: 0,
        leadTimes: [] as number[]
      };
      entry.submitted += 1;
      entry.submittedValue += Number(t.estimatedValue ?? 0);
      if (isWon(t)) {
        entry.won += 1;
        entry.wonValue += Number(t.estimatedValue ?? 0);
      }
      if (t.status === "LOST") entry.lost += 1;
      if (t.createdAt && t.updatedAt) {
        entry.leadTimes.push(daysBetween(new Date(t.createdAt), new Date(t.updatedAt)));
      }
      map.set(key, entry);
    }
    return Array.from(map.values()).map((row) => ({
      ...row,
      winRate: row.submitted > 0 ? (row.won / row.submitted) * 100 : 0,
      avgTenderValue: row.submitted > 0 ? row.submittedValue / row.submitted : 0,
      avgLeadTime: row.leadTimes.length > 0 ? row.leadTimes.reduce((s, x) => s + x, 0) / row.leadTimes.length : 0
    })).sort((a, b) => b.wonValue - a.wonValue);
  }, [tenders]);

  const stageRows = useMemo(() => {
    return STAGE_ORDER.map((stage) => {
      const rows = tenders.filter((t) => t.status === stage.key);
      const value = rows.reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);
      return { ...stage, count: rows.length, value };
    });
  }, [tenders]);

  const clientRows = useMemo(() => {
    const map = new Map<string, {
      clientId: string;
      name: string;
      submitted: number;
      won: number;
      wonValue: number;
    }>();
    for (const t of tenders) {
      if (!isSubmittedOrResolved(t)) continue;
      const client = t.tenderClients[0]?.client;
      const key = client?.id ?? "unknown";
      const name = client?.name ?? "Unknown client";
      const entry = map.get(key) ?? { clientId: key, name, submitted: 0, won: 0, wonValue: 0 };
      entry.submitted += 1;
      if (isWon(t)) {
        entry.won += 1;
        entry.wonValue += Number(t.estimatedValue ?? 0);
      }
      map.set(key, entry);
    }
    return Array.from(map.values())
      .map((row) => ({ ...row, winRate: row.submitted > 0 ? (row.won / row.submitted) * 100 : 0 }))
      .sort((a, b) => b.wonValue - a.wonValue);
  }, [tenders]);

  const maxEstimatorSubmitted = Math.max(...estimatorRows.map((r) => r.submitted), 1);
  const maxEstimatorWonValue = Math.max(...estimatorRows.map((r) => r.wonValue), 1);
  const totalStageCount = stageRows.reduce((sum, s) => sum + s.count, 0) || 1;
  const maxStageValue = Math.max(...stageRows.map((s) => s.value), 1);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">Tendering</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Estimating reports</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Scorecard views across estimators, pipeline stages, and clients.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/tenders/dashboard" className="s7-btn s7-btn--secondary s7-btn--sm">← Back to dashboard</Link>
        </div>
      </header>

      {error ? <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>{error}</div> : null}

      <nav className="admin-page__tabs" role="tablist">
        {([
          { key: "estimators", label: "Estimator scorecard" },
          { key: "pipeline", label: "Pipeline" },
          { key: "clients", label: "Clients" }
        ] as Array<{ key: Tab; label: string }>).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="s7-card"><Skeleton width="100%" height={200} /></div>
      ) : tab === "estimators" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Win rate by estimator</h3>
            {estimatorRows.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No submitted tenders yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {estimatorRows.map((row) => (
                  <div key={row.estimatorId}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span>{row.name}</span>
                      <strong>{row.won}/{row.submitted} · {row.winRate.toFixed(0)}%</strong>
                    </div>
                    <div style={{ height: 10, background: "rgba(0,0,0,0.06)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${(row.submitted / maxEstimatorSubmitted) * 100}%`,
                          background: "rgba(59, 130, 246, 0.3)"
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${(row.won / maxEstimatorSubmitted) * 100}%`,
                          background: "#10B981"
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Won $ by estimator</h3>
            {estimatorRows.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>—</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {estimatorRows.map((row) => (
                  <div key={row.estimatorId}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span>{row.name}</span>
                      <strong>{formatCurrency(row.wonValue)}</strong>
                    </div>
                    <div style={{ height: 10, background: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(row.wonValue / maxEstimatorWonValue) * 100}%`,
                          background: "var(--brand-accent, #FEAA6D)"
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Detail</h3>
            <table className="admin-page__table">
              <thead>
                <tr>
                  <th>Estimator</th>
                  <th>Submitted</th>
                  <th>Won</th>
                  <th>Lost</th>
                  <th>Win rate</th>
                  <th>Won $</th>
                  <th>Avg tender $</th>
                  <th>Avg lead time</th>
                </tr>
              </thead>
              <tbody>
                {estimatorRows.map((row) => (
                  <tr key={row.estimatorId}>
                    <td>{row.name}</td>
                    <td>{row.submitted}</td>
                    <td>{row.won}</td>
                    <td>{row.lost}</td>
                    <td>{row.winRate.toFixed(1)}%</td>
                    <td>{formatCurrency(row.wonValue)}</td>
                    <td>{formatCurrency(row.avgTenderValue)}</td>
                    <td>{row.avgLeadTime.toFixed(1)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : tab === "pipeline" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Tender count by stage</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
              {stageRows.map((stage) => (
                <div key={stage.key} style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>{stage.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: stage.color }}>{stage.count}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{((stage.count / totalStageCount) * 100).toFixed(0)}% of pipeline</div>
                </div>
              ))}
            </div>
          </section>

          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Pipeline $ by stage</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stageRows.map((stage) => (
                <div key={stage.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span>{stage.label}</span>
                    <strong>{formatCurrency(stage.value)}</strong>
                  </div>
                  <div style={{ height: 10, background: "rgba(0,0,0,0.06)", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(stage.value / maxStageValue) * 100}%`,
                        background: stage.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="s7-card">
          <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Clients</h3>
          {clientRows.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No submitted tenders yet.</p>
          ) : (
            <table className="admin-page__table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Submitted</th>
                  <th>Won</th>
                  <th>Win rate</th>
                  <th>Won $</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map((row) => (
                  <tr key={row.clientId}>
                    <td>{row.name}</td>
                    <td>{row.submitted}</td>
                    <td>{row.won}</td>
                    <td>{row.winRate.toFixed(1)}%</td>
                    <td>{formatCurrency(row.wonValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
