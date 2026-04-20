import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useAuth } from "../../auth/AuthContext";

type TenderRecord = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  submittedAt?: string | null;
  wonAt?: string | null;
  lostAt?: string | null;
  probability?: number | null;
  estimatedValue?: string | null;
  dueDate?: string | null;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{
    isAwarded: boolean;
    contractIssued?: boolean;
    client?: { id: string; name: string } | null;
  }>;
  tenderNotes: Array<{ body?: string; createdAt?: string | null }>;
};

type ProbabilityBucket = "hot" | "warm" | "cold" | "unknown";

const BUCKET_STYLE: Record<ProbabilityBucket, { background: string; color: string }> = {
  hot: { background: "#FEAA6D", color: "#3E1C00" },
  warm: { background: "#FED7AA", color: "#3E2A00" },
  cold: { background: "#E2E8F0", color: "#0F172A" },
  unknown: { background: "rgba(0,0,0,0.08)", color: "#6B7280" }
};

function bucketForProbability(value: number | null | undefined): ProbabilityBucket {
  if (value === null || value === undefined) return "unknown";
  if (value >= 70) return "hot";
  if (value >= 30) return "warm";
  return "cold";
}

const TERMINAL_STATUSES = new Set(["LOST", "WITHDRAWN", "CONVERTED", "AWARDED", "CONTRACT_ISSUED"]);
const ACTIVE_STATUSES = new Set(["DRAFT", "IN_PROGRESS", "SUBMITTED"]);
const WON_STATUSES = new Set(["AWARDED", "CONTRACT_ISSUED", "CONVERTED"]);

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400_000;

const IS_PALETTE = ["#FEAA6D", "#005B61", "#94A3B8", "#242424", "#FED7AA", "#22C55E"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

function formatValue(raw: string | null | undefined): string {
  return formatCurrency(Number(raw ?? 0));
}

function isComplianceArtifact(tender: TenderRecord): boolean {
  return tender.tenderNumber.startsWith("TEN-COMP-") || tender.title.startsWith("Compliance Tender");
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY);
}

function daysUntil(iso?: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return daysBetween(new Date(), new Date(iso));
}

function dueColor(days: number): string {
  if (days <= 2) return "#EF4444";
  if (days <= 5) return "#F59E0B";
  return "inherit";
}

function estimatorName(tender: TenderRecord): string {
  if (!tender.estimator) return "Unassigned";
  return `${tender.estimator.firstName} ${tender.estimator.lastName}`;
}

function clientProjectLabel(tender: TenderRecord): string {
  const client = tender.tenderClients[0]?.client?.name ?? "No client";
  return `${client} — ${tender.title}`;
}

function relativeDate(iso?: string | null): string {
  if (!iso) return "—";
  const target = new Date(iso);
  const diff = daysBetween(target, new Date());
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 30) return `${diff}d ago`;
  return target.toLocaleDateString();
}

function formatDueDate(iso?: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function TenderingDashboardPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [tenders, setTenders] = useState<TenderRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logCallPending, setLogCallPending] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await authFetch("/tenders?page=1&pageSize=100");
      if (!response.ok) throw new Error("Unable to load tender dashboard data.");
      const body = await response.json();
      setTenders(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tendersClean = useMemo(() => tenders.filter((t) => !isComplianceArtifact(t)), [tenders]);

  const logCall = async (tenderId: string) => {
    const note = window.prompt("Log a call / follow-up note:");
    if (!note || !note.trim()) return;
    setLogCallPending(tenderId);
    try {
      const response = await authFetch(`/tenders/${tenderId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: `[Call logged] ${note.trim()}` })
      });
      if (!response.ok) throw new Error("Could not log call.");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLogCallPending(null);
    }
  };

  // ── KPIs ────────────────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const activePipelineValue = tendersClean
    .filter((t) => !TERMINAL_STATUSES.has(t.status) || t.status === "AWARDED" || t.status === "CONTRACT_ISSUED")
    .filter((t) => t.status !== "LOST" && t.status !== "WITHDRAWN" && t.status !== "CONVERTED")
    .reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);

  const submittedMtd = tendersClean.filter((t) => t.submittedAt && new Date(t.submittedAt) >= monthStart);
  const submittedMtdValue = submittedMtd.reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);

  const wonYtd = tendersClean.filter((t) => t.wonAt && new Date(t.wonAt) >= yearStart);
  const lostYtd = tendersClean.filter((t) => t.lostAt && new Date(t.lostAt) >= yearStart);
  const resolvedYtd = wonYtd.length + lostYtd.length;
  const winRateYtd = resolvedYtd > 0 ? (wonYtd.length / resolvedYtd) * 100 : 0;

  const leadTimeTenders = tendersClean.filter((t) => t.submittedAt && t.createdAt);
  const avgLeadTime = leadTimeTenders.length > 0
    ? leadTimeTenders.reduce(
        (sum, t) => sum + daysBetween(new Date(t.createdAt!), new Date(t.submittedAt!)),
        0
      ) / leadTimeTenders.length
    : 0;

  // ── Due this week ───────────────────────────────────────
  const dueThisWeek = tendersClean
    .filter((t) => {
      if (!t.dueDate) return false;
      if (!ACTIVE_STATUSES.has(t.status)) return false;
      const d = daysUntil(t.dueDate);
      return d <= 7;
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  // ── Follow-up queue ─────────────────────────────────────
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY);
  const followUpQueue = tendersClean
    .filter(
      (t) =>
        t.status === "SUBMITTED" &&
        t.submittedAt &&
        new Date(t.submittedAt) < sevenDaysAgo &&
        !t.wonAt &&
        !t.lostAt
    )
    .map((t) => {
      const sortedNotes = [...(t.tenderNotes ?? [])].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      return {
        tender: t,
        daysWaiting: t.submittedAt ? daysBetween(new Date(t.submittedAt), now) : 0,
        lastNote: sortedNotes[0]?.body ?? null
      };
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting)
    .slice(0, 5);
  const followUpQueueValue = followUpQueue.reduce((sum, item) => sum + Number(item.tender.estimatedValue ?? 0), 0);

  // ── Win rate last 6 months ──────────────────────────────
  const sixMonthBuckets: Array<{ monthKey: string; label: string; submitted: number; won: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    sixMonthBuckets.push({
      monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_SHORT[d.getMonth()],
      submitted: 0,
      won: 0
    });
  }
  const bucketByMonth = new Map(sixMonthBuckets.map((b) => [b.monthKey, b]));

  for (const t of tendersClean) {
    if (t.submittedAt) {
      const d = new Date(t.submittedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = bucketByMonth.get(key);
      if (bucket) bucket.submitted += 1;
    }
    if (t.wonAt) {
      const d = new Date(t.wonAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = bucketByMonth.get(key);
      if (bucket) bucket.won += 1;
    }
  }

  // ── Pipeline by estimator donut ─────────────────────────
  const estimatorMap = new Map<string, { name: string; value: number }>();
  for (const t of tendersClean) {
    if (!ACTIVE_STATUSES.has(t.status)) continue;
    const value = Number(t.estimatedValue ?? 0);
    if (value <= 0) continue;
    const key = t.estimator?.id ?? "unassigned";
    const name = estimatorName(t);
    const entry = estimatorMap.get(key) ?? { name, value: 0 };
    entry.value += value;
    estimatorMap.set(key, entry);
  }
  const pipelineByEstimator = Array.from(estimatorMap.values()).sort((a, b) => b.value - a.value);

  // ── Recent wins ─────────────────────────────────────────
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY);
  const recentWins = tendersClean
    .filter((t) => t.wonAt && new Date(t.wonAt) >= ninetyDaysAgo)
    .sort((a, b) => new Date(b.wonAt!).getTime() - new Date(a.wonAt!).getTime())
    .slice(0, 4);

  return (
    <div className="td-v2">
      {error ? <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>{error}</div> : null}

      <header className="td-v2__header">
        <div>
          <p className="s7-type-label">Tendering</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Tender dashboard</h1>
        </div>
        <Link to="/tenders/reports" className="s7-btn s7-btn--secondary s7-btn--sm">Reports →</Link>
      </header>

      <section className="td-v2__kpis" aria-label="Key performance indicators">
        <KpiTile label="Active pipeline" value={formatCurrency(activePipelineValue)} />
        <KpiTile
          label="Submitted MTD"
          value={String(submittedMtd.length)}
          subtitle={formatCurrency(submittedMtdValue)}
        />
        <KpiTile
          label="Win rate YTD"
          value={`${winRateYtd.toFixed(0)}%`}
          subtitle={`${wonYtd.length}/${resolvedYtd}`}
        />
        <KpiTile label="Avg lead time" value={`${avgLeadTime.toFixed(1)}d`} />
      </section>

      <div className="td-v2__body">
        <div className="td-v2__col td-v2__col--left">
          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Due this week</h3>
            {dueThisWeek.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Nothing due this week.</p>
            ) : (
              <ul className="td-v2__rows">
                {dueThisWeek.map((t) => {
                  const days = daysUntil(t.dueDate);
                  const color = dueColor(days);
                  return (
                    <li key={t.id} className="td-v2__row" onClick={() => navigate(`/tenders/${t.id}`)}>
                      <strong className="td-v2__tnum">{t.tenderNumber}</strong>
                      <div className="td-v2__row-body">
                        <div className="td-v2__row-title">{clientProjectLabel(t)}</div>
                        <div className="td-v2__row-meta">{estimatorName(t)} · {labelForStatus(t.status)}</div>
                      </div>
                      <span style={{ color, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : days === 1 ? "due tomorrow" : formatDueDate(t.dueDate)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="s7-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Follow-up queue</h3>
              {followUpQueue.length > 0 ? (
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {followUpQueue.length} · {formatCurrency(followUpQueueValue)}
                </span>
              ) : null}
            </div>
            {followUpQueue.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No tenders awaiting follow-up.</p>
            ) : (
              <ul className="td-v2__rows">
                {followUpQueue.map(({ tender, daysWaiting, lastNote }) => {
                  const bucket = bucketForProbability(tender.probability);
                  return (
                    <li key={tender.id} className="td-v2__row td-v2__row--followup">
                      <strong className="td-v2__tnum" onClick={() => navigate(`/tenders/${tender.id}`)} style={{ cursor: "pointer" }}>
                        {tender.tenderNumber}
                      </strong>
                      <div className="td-v2__row-body" onClick={() => navigate(`/tenders/${tender.id}`)} style={{ cursor: "pointer" }}>
                        <div className="td-v2__row-title">{clientProjectLabel(tender)}</div>
                        <div className="td-v2__row-meta">
                          Submitted {daysWaiting}d ago{lastNote ? ` · ${lastNote.slice(0, 80)}` : ""}
                        </div>
                      </div>
                      <span
                        className="s7-badge"
                        style={{ background: BUCKET_STYLE[bucket].background, color: BUCKET_STYLE[bucket].color }}
                      >
                        {bucket === "unknown" ? "—" : bucket[0].toUpperCase() + bucket.slice(1)}
                      </span>
                      <strong style={{ whiteSpace: "nowrap" }}>{formatValue(tender.estimatedValue)}</strong>
                      <button
                        type="button"
                        className="s7-btn s7-btn--secondary s7-btn--sm"
                        onClick={() => void logCall(tender.id)}
                        disabled={logCallPending === tender.id}
                      >
                        Log call
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="td-v2__col td-v2__col--right">
          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Win rate — last 6 months</h3>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={sixMonthBuckets} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, rgba(0,0,0,0.08))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                    allowDecimals={false}
                    domain={[0, "auto"]}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="submitted" name="Submitted" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="won" name="Won" fill="#FEAA6D" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Pipeline by estimator</h3>
            {pipelineByEstimator.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No active pipeline.</p>
            ) : (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pipelineByEstimator}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {pipelineByEstimator.map((slice, index) => (
                        <Cell key={slice.name} fill={IS_PALETTE[index % IS_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Recent wins</h3>
            {recentWins.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No wins in the last 90 days.</p>
            ) : (
              <ul className="td-v2__rows">
                {recentWins.map((t) => (
                  <li key={t.id} className="td-v2__row" onClick={() => navigate(`/tenders/${t.id}`)}>
                    <div className="td-v2__row-body">
                      <div className="td-v2__row-title">{clientProjectLabel(t)}</div>
                      <div className="td-v2__row-meta">{estimatorName(t)} · {relativeDate(t.wonAt)}</div>
                    </div>
                    <strong style={{ color: "#065F46", whiteSpace: "nowrap" }}>{formatValue(t.estimatedValue)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="td-v2__kpi">
      <span className="td-v2__kpi-label">{label}</span>
      <strong className="td-v2__kpi-value">{value}</strong>
      {subtitle ? <span className="td-v2__kpi-subtitle">{subtitle}</span> : null}
    </div>
  );
}

function labelForStatus(status: string): string {
  switch (status) {
    case "DRAFT": return "Identified";
    case "IN_PROGRESS": return "Estimating";
    case "SUBMITTED": return "Submitted";
    case "AWARDED": return "Awarded";
    case "CONTRACT_ISSUED": return "Contract";
    case "CONVERTED": return "Converted";
    case "LOST": return "Lost";
    case "WITHDRAWN": return "Withdrawn";
    default: return status;
  }
}
