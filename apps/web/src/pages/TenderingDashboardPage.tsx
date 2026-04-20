import { useCallback, useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { readTenderingLabels } from "../tendering-labels";
import { getTenderingAttentionSummary } from "./tendering-page-helpers";

type TenderDashboardRecord = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  probability?: number | null;
  estimatedValue?: string | null;
  dueDate?: string | null;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{
    isAwarded: boolean;
    contractIssued?: boolean;
    contractIssuedAt?: string | null;
    client?: { id: string; name: string } | null;
  }>;
  tenderNotes: Array<{ createdAt?: string | null; updatedAt?: string | null }>;
  clarifications: Array<{ status: string; dueDate?: string | null; createdAt?: string | null; updatedAt?: string | null }>;
  followUps: Array<{ status: string; dueAt?: string | null; createdAt?: string | null; updatedAt?: string | null }>;
  outcomes?: Array<{ outcomeType?: string; recordedAt?: string | null; createdAt?: string | null; updatedAt?: string | null }>;
  tenderDocuments?: Array<{ createdAt?: string | null; updatedAt?: string | null }>;
};

type ProbabilityBucket = "hot" | "warm" | "cold" | "unknown";
function bucketForProbability(value: number | null | undefined): ProbabilityBucket {
  if (value === null || value === undefined) return "unknown";
  if (value >= 70) return "hot";
  if (value >= 30) return "warm";
  return "cold";
}
const BUCKET_COLOR: Record<ProbabilityBucket, { background: string; color: string }> = {
  hot: { background: "#FEAA6D", color: "#3E1C00" },
  warm: { background: "#FCD34D", color: "#3E2A00" },
  cold: { background: "#94A3B8", color: "#0F172A" },
  unknown: { background: "rgba(0,0,0,0.08)", color: "#6B7280" }
};
const BUCKET_LABEL: Record<ProbabilityBucket, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  unknown: "—"
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function estimatorName(tender: TenderDashboardRecord): string {
  if (!tender.estimator) return "Unassigned";
  return `${tender.estimator.firstName} ${tender.estimator.lastName}`;
}

function clientName(tender: TenderDashboardRecord): string {
  return tender.tenderClients[0]?.client?.name ?? "No client";
}

function relativeDate(iso?: string | null): string {
  if (!iso) return "—";
  const target = new Date(iso);
  const now = new Date();
  const diff = daysBetween(target, now);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff > 1 && diff < 30) return `${diff}d ago`;
  if (diff < 0 && diff > -7) return `in ${Math.abs(diff)}d`;
  return target.toLocaleDateString();
}

function daysUntil(iso?: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return daysBetween(new Date(), new Date(iso));
}

function dueColorForDays(days: number): string {
  if (days <= 1) return "#EF4444";
  if (days <= 5) return "#F59E0B";
  return "inherit";
}

const stageDefinitions = [
  { key: "DRAFT", label: "Draft" },
  { key: "IN_PROGRESS", label: "Estimating" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "AWARDED", label: "Awarded" },
  { key: "CONTRACT_ISSUED", label: "Contract" },
  { key: "CONVERTED", label: "Converted" }
] as const;

function getTenderStage(tender: TenderDashboardRecord) {
  if (tender.status === "CONVERTED") return "CONVERTED";
  if (tender.tenderClients.some((item) => item.contractIssued)) return "CONTRACT_ISSUED";
  if (tender.tenderClients.some((item) => item.isAwarded)) return "AWARDED";
  if (tender.status === "SUBMITTED") return "SUBMITTED";
  if (tender.status === "IN_PROGRESS") return "IN_PROGRESS";
  return "DRAFT";
}

function formatCurrency(value?: string | null) {
  if (!value) return "$0";
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDateLabel(value?: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  });
}

function getDueState(value?: string | null) {
  if (!value) return "none";
  const dueTime = new Date(value).getTime();
  const today = new Date();
  const weekAhead = new Date();
  weekAhead.setDate(today.getDate() + 7);

  if (dueTime < today.getTime()) return "overdue";
  if (dueTime <= weekAhead.getTime()) return "soon";
  return "upcoming";
}

function formatAttentionLabel(needsAttention: boolean, attentionState: "healthy" | "watch" | "rotting") {
  if (attentionState === "rotting") return "Rotting";
  if (needsAttention) return "Needs attention";
  return "On track";
}

function getForecastBucketLabel(value?: string | null) {
  if (!value) return "Unscheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric"
  });
}

export function TenderingDashboardPage() {
  const labels = readTenderingLabels();
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [tenders, setTenders] = useState<TenderDashboardRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logCallTenderId, setLogCallTenderId] = useState<string | null>(null);

  const reloadTenders = useCallback(async () => {
    try {
      const response = await authFetch("/tenders?page=1&pageSize=100");
      if (!response.ok) throw new Error("Unable to load tender dashboard data.");
      const body = await response.json();
      setTenders(body.items ?? []);
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, [authFetch]);

  useEffect(() => {
    void reloadTenders();
  }, [reloadTenders]);

  const logCall = async (tenderId: string) => {
    const note = window.prompt("Log a call / follow-up note:");
    if (!note || !note.trim()) return;
    setLogCallTenderId(tenderId);
    try {
      const response = await authFetch(`/tenders/${tenderId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: `[Call logged] ${note.trim()}` })
      });
      if (!response.ok) throw new Error("Could not log call.");
      await reloadTenders();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLogCallTenderId(null);
    }
  };

  const dashboard = useMemo(() => {
    const attentionSummaries = tenders.map((tender) => ({
      tender,
      attention: getTenderingAttentionSummary({
        stage: getTenderStage(tender),
        createdAt: tender.createdAt,
        updatedAt: tender.updatedAt,
        dueDate: tender.dueDate,
        contractIssuedAt: tender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
        tenderNotes: tender.tenderNotes,
        clarifications: tender.clarifications,
        followUps: tender.followUps,
        tenderDocuments: tender.tenderDocuments,
        outcomes: tender.outcomes
      })
    }));

    const stageCounts = stageDefinitions.map((stage) => {
      const count = tenders.filter((tender) => getTenderStage(tender) === stage.key).length;
      return { ...stage, count };
    });

    const totalValue = tenders.reduce((sum, tender) => sum + Number(tender.estimatedValue ?? 0), 0);
    const submittedValue = tenders
      .filter((tender) => ["SUBMITTED", "AWARDED", "CONTRACT_ISSUED", "CONVERTED"].includes(getTenderStage(tender)))
      .reduce((sum, tender) => sum + Number(tender.estimatedValue ?? 0), 0);
    const openFollowUps = tenders.reduce(
      (sum, tender) => sum + tender.followUps.filter((item) => item.status !== "DONE").length,
      0
    );
    const openClarifications = tenders.reduce(
      (sum, tender) => sum + tender.clarifications.filter((item) => item.status !== "CLOSED").length,
      0
    );
    const overdueFollowUps = tenders.reduce(
      (sum, tender) =>
        sum +
        tender.followUps.filter(
          (item) => item.status !== "DONE" && item.dueAt && new Date(item.dueAt).getTime() < Date.now()
        ).length,
      0
    );

    const dueThisWeek = tenders.filter((tender) => getDueState(tender.dueDate) === "soon").length;
    const highConfidence = tenders.filter((tender) => Number(tender.probability ?? 0) >= 70).length;
    const awardReady = tenders.filter((tender) => getTenderStage(tender) === "SUBMITTED").length;
    const contractsPending = tenders.filter((tender) => getTenderStage(tender) === "AWARDED").length;
    const needsAttention = attentionSummaries.filter((item) => item.attention.needsAttention).length;
    const rotting = attentionSummaries.filter((item) => item.attention.attentionState === "rotting").length;

    const estimatorPressure = stageCounts
      .filter((stage) => ["IN_PROGRESS", "SUBMITTED", "AWARDED"].includes(stage.key))
      .map((stage) => ({
        label: stage.label,
        count: stage.count
      }));

    const spotlightTenders = [...tenders]
      .sort((left, right) => Number(right.estimatedValue ?? 0) - Number(left.estimatedValue ?? 0))
      .slice(0, 3);

    const nextActions = [...attentionSummaries]
      .sort((left, right) => {
        const leftDate = left.attention.nextActionAt ? new Date(left.attention.nextActionAt).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDate = right.attention.nextActionAt ? new Date(right.attention.nextActionAt).getTime() : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      })
      .slice(0, 5);

    const staleTenders = [...attentionSummaries]
      .filter((item) => item.attention.attentionState === "rotting")
      .sort((left, right) => right.attention.stageAgeDays - left.attention.stageAgeDays)
      .slice(0, 5);

    const forecastMap = new Map<string, { label: string; total: number; weighted: number; count: number }>();
    tenders.forEach((tender) => {
      const key = getForecastBucketLabel(tender.dueDate);
      const value = Number(tender.estimatedValue ?? 0);
      const probability = Number(tender.probability ?? 0) / 100;
      const existing = forecastMap.get(key) ?? { label: key, total: 0, weighted: 0, count: 0 };
      existing.total += value;
      existing.weighted += value * probability;
      existing.count += 1;
      forecastMap.set(key, existing);
    });

    const forecastBuckets = [...forecastMap.values()]
      .sort((left, right) => {
        if (left.label === "Unscheduled") return 1;
        if (right.label === "Unscheduled") return -1;
        return new Date(`1 ${left.label}`).getTime() - new Date(`1 ${right.label}`).getTime();
      })
      .slice(0, 6);

    return {
      stageCounts,
      totalValue,
      submittedValue,
      openFollowUps,
      openClarifications,
      overdueFollowUps,
      dueThisWeek,
      highConfidence,
      awardReady,
      contractsPending,
      needsAttention,
      rotting,
      estimatorPressure,
      spotlightTenders,
      nextActions,
      staleTenders,
      forecastBuckets
    };
  }, [tenders]);

  const maxStageCount = Math.max(...dashboard.stageCounts.map((item) => item.count), 1);
  const maxPressureCount = Math.max(...dashboard.estimatorPressure.map((item) => item.count), 1);

  // Estimating-specific KPIs
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const activeStages = new Set(["DRAFT", "IN_PROGRESS", "SUBMITTED"]);
  const activePipelineValue = tenders
    .filter((t) => activeStages.has(getTenderStage(t)))
    .reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);

  const submittedMtd = tenders.filter(
    (t) => t.status === "SUBMITTED" && t.updatedAt && new Date(t.updatedAt) >= monthStart
  );
  const submittedMtdValue = submittedMtd.reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);

  const submittedYtd = tenders.filter(
    (t) => ["SUBMITTED", "AWARDED", "LOST"].includes(t.status) && t.updatedAt && new Date(t.updatedAt) >= yearStart
  );
  const wonYtd = submittedYtd.filter((t) => t.status === "AWARDED" || t.tenderClients.some((c) => c.isAwarded));
  const winRateYtd = submittedYtd.length > 0 ? (wonYtd.length / submittedYtd.length) * 100 : 0;

  const submittedTenders = tenders.filter((t) => t.status === "SUBMITTED" && t.createdAt && t.updatedAt);
  const avgLeadTime = submittedTenders.length > 0
    ? submittedTenders.reduce((sum, t) => sum + daysBetween(new Date(t.createdAt!), new Date(t.updatedAt!)), 0) / submittedTenders.length
    : 0;

  // Due this week
  const dueThisWeek = tenders
    .filter((t) => {
      if (!t.dueDate) return false;
      if (!activeStages.has(getTenderStage(t))) return false;
      const d = daysUntil(t.dueDate);
      return d <= 7;
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  // Follow-up queue: SUBMITTED > 7 days ago, no outcome
  const followUpQueue = tenders
    .filter((t) => {
      if (t.status !== "SUBMITTED") return false;
      if (!t.updatedAt) return false;
      const days = daysBetween(new Date(t.updatedAt), now);
      if (days < 7) return false;
      if (t.outcomes && t.outcomes.length > 0) return false;
      if (t.tenderClients.some((c) => c.isAwarded)) return false;
      return true;
    })
    .map((t) => ({
      tender: t,
      daysWaiting: t.updatedAt ? daysBetween(new Date(t.updatedAt), now) : 0
    }))
    .sort((a, b) => b.daysWaiting - a.daysWaiting);
  const followUpQueueValue = followUpQueue.reduce((sum, item) => sum + Number(item.tender.estimatedValue ?? 0), 0);

  // Recent wins (last 90 days)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentWins = tenders
    .filter((t) => {
      const isWon = t.status === "AWARDED" || t.tenderClients.some((c) => c.isAwarded);
      if (!isWon) return false;
      const when = t.tenderClients.find((c) => c.contractIssuedAt)?.contractIssuedAt ?? t.updatedAt;
      if (!when) return false;
      return new Date(when) >= ninetyDaysAgo;
    })
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 8);

  return (
    <div className="tendering-dashboard">
      {error ? <p className="error-text">{error}</p> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Link to="/tenders/reports" className="s7-btn s7-btn--secondary s7-btn--sm">Reports →</Link>
      </div>

      <div className="tendering-kpi-row">
        <div className="tendering-kpi-card">
          <span>Active pipeline</span>
          <strong>{formatCurrency(String(activePipelineValue))}</strong>
        </div>
        <div className="tendering-kpi-card">
          <span>Submitted MTD</span>
          <strong>{submittedMtd.length}</strong>
          <small style={{ color: "var(--text-muted)" }}>{formatCurrency(String(submittedMtdValue))}</small>
        </div>
        <div className="tendering-kpi-card">
          <span>Win rate YTD</span>
          <strong>{winRateYtd.toFixed(0)}%</strong>
          <small style={{ color: "var(--text-muted)" }}>{wonYtd.length}/{submittedYtd.length}</small>
        </div>
        <div className="tendering-kpi-card">
          <span>Avg lead time</span>
          <strong>{avgLeadTime.toFixed(1)}d</strong>
        </div>
        <div className="tendering-kpi-card">
          <span>Open follow-ups</span>
          <strong>{dashboard.openFollowUps}</strong>
        </div>
      </div>

      <section className="dashboard-grid dashboard-grid--tendering" style={{ marginTop: 20 }}>
        <AppCard title="Due this week" subtitle={`${dueThisWeek.length} tenders due within the next 7 days.`}>
          {dueThisWeek.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Nothing due this week.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {dueThisWeek.map((t) => {
                const days = daysUntil(t.dueDate);
                const color = dueColorForDays(days);
                return (
                  <li
                    key={t.id}
                    onClick={() => navigate(`/tenders/${t.id}`)}
                    style={{
                      cursor: "pointer",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 10,
                      alignItems: "center"
                    }}
                  >
                    <strong>{t.tenderNumber}</strong>
                    <div>
                      <div style={{ fontSize: 13 }}>{clientName(t)} — {t.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{estimatorName(t)} · {stageDefinitions.find((s) => s.key === getTenderStage(t))?.label ?? "Draft"}</div>
                    </div>
                    <span style={{ color, fontWeight: 600, fontSize: 13 }}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : days === 1 ? "due tomorrow" : `${days}d`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </AppCard>

        <AppCard title="Follow-up queue" subtitle={`${followUpQueue.length} tenders · ${formatCurrency(String(followUpQueueValue))} awaiting response.`}>
          {followUpQueue.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No submitted tenders waiting.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {followUpQueue.slice(0, 8).map(({ tender, daysWaiting }) => {
                const bucket = bucketForProbability(tender.probability);
                return (
                  <li
                    key={tender.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      gap: 10,
                      alignItems: "center"
                    }}
                  >
                    <strong style={{ cursor: "pointer" }} onClick={() => navigate(`/tenders/${tender.id}`)}>
                      {tender.tenderNumber}
                    </strong>
                    <div style={{ cursor: "pointer" }} onClick={() => navigate(`/tenders/${tender.id}`)}>
                      <div style={{ fontSize: 13 }}>{clientName(tender)} — {tender.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {daysWaiting}d waiting · {formatCurrency(tender.estimatedValue)}
                      </div>
                    </div>
                    <span
                      className="s7-badge"
                      style={{ background: BUCKET_COLOR[bucket].background, color: BUCKET_COLOR[bucket].color }}
                    >
                      {BUCKET_LABEL[bucket]}
                    </span>
                    <button
                      type="button"
                      className="s7-btn s7-btn--secondary s7-btn--sm"
                      onClick={() => void logCall(tender.id)}
                      disabled={logCallTenderId === tender.id}
                    >
                      Log call
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </AppCard>

        <AppCard title="Recent wins" subtitle={`${recentWins.length} tenders won in the last 90 days.`}>
          {recentWins.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No wins yet in the last 90 days.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {recentWins.map((t) => (
                <li
                  key={t.id}
                  onClick={() => navigate(`/tenders/${t.id}`)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 10,
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13 }}>{clientName(t)} — {t.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{estimatorName(t)}</div>
                  </div>
                  <strong style={{ color: "#065F46" }}>{formatCurrency(t.estimatedValue)}</strong>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{relativeDate(t.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      </section>

      <section className="tendering-dashboard-band">
        <div className="tendering-dashboard-band__intro">
          <span className="tendering-section-label">Tender pulse</span>
          <h2>Where the pipeline needs attention this week</h2>
          <p>
            Live summary of due pressure, win likelihood, and post-submission movement across the seeded tender register.
          </p>
        </div>
        <div className="tendering-dashboard-band__stats">
          <div className="tendering-stat-card">
            <span>Due this week</span>
            <strong>{dashboard.dueThisWeek}</strong>
          </div>
          <div className="tendering-stat-card">
            <span>High confidence</span>
            <strong>{dashboard.highConfidence}</strong>
          </div>
          <div className="tendering-stat-card">
            <span>Award ready</span>
            <strong>{dashboard.awardReady}</strong>
          </div>
          <div className="tendering-stat-card">
            <span>Contracts pending</span>
            <strong>{dashboard.contractsPending}</strong>
          </div>
          <div className="tendering-stat-card">
            <span>Needs attention</span>
            <strong>{dashboard.needsAttention}</strong>
          </div>
          <div className="tendering-stat-card">
            <span>Rotting</span>
            <strong>{dashboard.rotting}</strong>
          </div>
        </div>
      </section>

      <section className="tendering-spotlight">
        <div className="tendering-spotlight__header">
          <div>
            <span className="tendering-section-label">Spotlight</span>
            <h3>Highest-value live tenders</h3>
          </div>
          <p>Quick scan of the most commercially significant opportunities in the current pipeline.</p>
        </div>
        <div className="tendering-spotlight__grid">
          {dashboard.spotlightTenders.map((tender) => (
            <article key={tender.id} className="tendering-spotlight-card">
              <div className="tendering-spotlight-card__top">
                <strong>{tender.tenderNumber}</strong>
                <span className={`pill ${getDueState(tender.dueDate) === "overdue" ? "pill--red" : "pill--blue"}`}>
                  {formatDateLabel(tender.dueDate)}
                </span>
              </div>
              <h4>{tender.title}</h4>
              <div className="tendering-spotlight-card__meta">
                <span>{stageDefinitions.find((stage) => stage.key === getTenderStage(tender))?.label ?? "Draft"}</span>
                <span>{formatCurrency(tender.estimatedValue)}</span>
              </div>
              <div className="tendering-spotlight-card__footer">
                <span>Probability</span>
                <strong>{Math.round(Number(tender.probability ?? 0))}%</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="tendering-stale-panel">
        <div className="tendering-stale-panel__header">
          <div>
            <span className="tendering-section-label">Attention Queue</span>
            <h3>Stale and rotting tenders</h3>
          </div>
          <p>Direct jump list for the opportunities most likely to need intervention in the workspace.</p>
        </div>
        <div className="tendering-stale-panel__list">
          {dashboard.staleTenders.length ? (
            dashboard.staleTenders.map(({ tender, attention }) => (
              <article key={tender.id} className="tendering-stale-card">
                <div className="split-header">
                  <strong>{tender.tenderNumber}</strong>
                  <span className="pill pill--red">Rotting</span>
                </div>
                <h4>{tender.title}</h4>
                <div className="tendering-action-row__meta">
                  <span>{stageDefinitions.find((stage) => stage.key === getTenderStage(tender))?.label ?? "Draft"}</span>
                  <span>{formatCurrency(tender.estimatedValue)}</span>
                  <span>Stage age {attention.stageAgeDays}d</span>
                </div>
                <p className="muted-text">
                  Next action {attention.nextActionAt ? formatDateLabel(attention.nextActionAt) : "not set"}.
                </p>
                <Link className="tendering-inline-link" to={`/tenders/workspace?tenderId=${tender.id}`}>
                  Open in workspace
                </Link>
              </article>
            ))
          ) : (
            <div className="tendering-empty-state">
              <strong>No rotting tenders right now.</strong>
              <p>The current pipeline does not have any tenders flagged at the highest attention state.</p>
            </div>
          )}
        </div>
      </section>

      <section className="tendering-forecast-panel">
        <div className="tendering-stale-panel__header">
          <div>
            <span className="tendering-section-label">Forecast</span>
            <h3>Expected tender flow by due month</h3>
          </div>
          <p>Weighted and total pipeline projection using current tender due dates and probabilities.</p>
        </div>
        <div className="tendering-forecast-grid">
          {dashboard.forecastBuckets.map((bucket) => (
            <article key={bucket.label} className="tendering-forecast-card">
              <span className="muted-text">{bucket.label}</span>
              <strong>{formatCurrency(String(bucket.total))}</strong>
              <div className="tendering-action-row__meta">
                <span>{bucket.count} tenders</span>
                <span>Weighted {formatCurrency(String(bucket.weighted))}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--tendering">
        <AppCard title={labels["dashboard.title"]} subtitle="Live pipeline snapshot across the current tender register.">
          <div className="dashboard-preview dashboard-preview--chart">
            <h3>{labels["dashboard.pipelineOverview"]}</h3>
            <div className="tendering-chart-list">
              {dashboard.stageCounts.map((stage) => (
                <div key={stage.key} className="tendering-chart-row">
                  <div className="tendering-chart-row__label">
                    <span>{stage.label}</span>
                    <strong>{stage.count}</strong>
                  </div>
                  <div className="tendering-chart-bar">
                    <div
                      className="tendering-chart-bar__fill"
                      style={{ width: `${(stage.count / maxStageCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AppCard>

        <AppCard title={labels["dashboard.commercialTrends"]} subtitle="Commercial shape of the current pipeline and estimator workload.">
          <div className="dashboard-preview dashboard-preview--chart">
            <h3>Estimator pressure</h3>
            <div className="tendering-chart-list">
              {dashboard.estimatorPressure.map((item) => (
                <div key={item.label} className="tendering-chart-row">
                  <div className="tendering-chart-row__label">
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <div className="tendering-chart-bar tendering-chart-bar--neutral">
                    <div
                      className="tendering-chart-bar__fill tendering-chart-bar__fill--neutral"
                      style={{ width: `${(item.count / maxPressureCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="tendering-insight-grid">
              <div>
                <span className="muted-text">Average probability</span>
                <strong>
                  {tenders.length
                    ? `${Math.round(
                        tenders.reduce((sum, tender) => sum + Number(tender.probability ?? 0), 0) / tenders.length
                      )}%`
                    : "0%"}
                </strong>
              </div>
              <div>
                <span className="muted-text">Award ready</span>
                <strong>
                  {
                    dashboard.stageCounts.find((item) => item.key === "SUBMITTED")?.count ?? 0
                  }
                </strong>
              </div>
              <div>
                <span className="muted-text">Needs attention</span>
                <strong>{dashboard.needsAttention}</strong>
              </div>
              <div>
                <span className="muted-text">Rotting</span>
                <strong>{dashboard.rotting}</strong>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard title={labels["dashboard.followUpPressure"]} subtitle="Immediate follow-up and clarification workload needing attention.">
          <div className="dashboard-preview dashboard-preview--chart">
            <h3>Action load</h3>
            <div className="tendering-insight-grid">
              <div>
                <span className="muted-text">Overdue follow-ups</span>
                <strong>{dashboard.overdueFollowUps}</strong>
              </div>
              <div>
                <span className="muted-text">Pending clarifications</span>
                <strong>{dashboard.openClarifications}</strong>
              </div>
            </div>
            <div className="tendering-action-list">
              {dashboard.nextActions.length ? (
                dashboard.nextActions.map(({ tender, attention }) => (
                  <div key={tender.id} className="tendering-action-row">
                    <div>
                      <strong>{tender.tenderNumber}</strong>
                      <p className="muted-text">{tender.title}</p>
                      <div className="tendering-action-row__meta">
                        <span>{stageDefinitions.find((stage) => stage.key === getTenderStage(tender))?.label ?? "Draft"}</span>
                        <span>{formatCurrency(tender.estimatedValue)}</span>
                        <span>{Math.round(Number(tender.probability ?? 0))}% probability</span>
                        <span>{formatAttentionLabel(attention.needsAttention, attention.attentionState)}</span>
                      </div>
                    </div>
                    <span
                      className={`pill ${
                        attention.attentionState === "rotting"
                          ? "pill--red"
                          : attention.needsAttention
                            ? "pill--amber"
                            : "pill--blue"
                      }`}
                    >
                      {attention.nextActionAt ? formatDateLabel(attention.nextActionAt) : formatDateLabel(tender.dueDate)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted-text">No tender actions loaded yet.</p>
              )}
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}
