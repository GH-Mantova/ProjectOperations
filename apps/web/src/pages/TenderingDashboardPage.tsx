import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { Link } from "react-router-dom";
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
  tenderClients: Array<{ isAwarded: boolean; contractIssued?: boolean; contractIssuedAt?: string | null }>;
  tenderNotes: Array<{ createdAt?: string | null; updatedAt?: string | null }>;
  clarifications: Array<{ status: string; dueDate?: string | null; createdAt?: string | null; updatedAt?: string | null }>;
  followUps: Array<{ status: string; dueAt?: string | null; createdAt?: string | null; updatedAt?: string | null }>;
  outcomes?: Array<{ createdAt?: string | null; updatedAt?: string | null }>;
  tenderDocuments?: Array<{ createdAt?: string | null; updatedAt?: string | null }>;
};

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
  const [tenders, setTenders] = useState<TenderDashboardRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/tenders?page=1&pageSize=100")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load tender dashboard data.");
        }

        const body = await response.json();
        setTenders(body.items ?? []);
      })
      .catch((loadError) => setError((loadError as Error).message));
  }, [authFetch]);

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

  return (
    <div className="tendering-dashboard">
      {error ? <p className="error-text">{error}</p> : null}

      <div className="tendering-kpi-row">
        <div className="tendering-kpi-card">
          <span>Total live tenders</span>
          <strong>{tenders.length}</strong>
        </div>
        <div className="tendering-kpi-card">
          <span>Pipeline value</span>
          <strong>{formatCurrency(String(dashboard.totalValue))}</strong>
        </div>
        <div className="tendering-kpi-card">
          <span>Submitted value</span>
          <strong>{formatCurrency(String(dashboard.submittedValue))}</strong>
        </div>
        <div className="tendering-kpi-card">
          <span>Open follow-ups</span>
          <strong>{dashboard.openFollowUps}</strong>
        </div>
        <div className="tendering-kpi-card">
          <span>Pending clarifications</span>
          <strong>{dashboard.openClarifications}</strong>
        </div>
      </div>

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
