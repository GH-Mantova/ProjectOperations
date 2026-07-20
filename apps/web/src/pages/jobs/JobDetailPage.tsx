import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { CorrespondencePanel } from "../../components/correspondence/CorrespondencePanel";
import { Timeline } from "../../components/timeline/Timeline";
import { PunchTab } from "../../components/punch/PunchTab";
import { AssistPanel, useCanUseAssist } from "../../components/AssistPanel";

type JobActivity = {
  id: string;
  jobStageId: string;
  name: string;
  description?: string | null;
  status: string;
  activityOrder: number;
  plannedDate?: string | null;
  owner?: { id: string; firstName: string; lastName: string } | null;
};

type JobStage = {
  id: string;
  name: string;
  stageOrder: number;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  // The API nests activities inside each stage (see jobInclude in
  // apps/api/src/modules/jobs/jobs.service.ts). There is no
  // top-level `activities` array on the response — B01.1.
  activities?: JobActivity[];
};

type JobIssue = {
  id: string;
  title: string;
  description?: string | null;
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  status: string;
  reportedAt: string;
  dueDate?: string | null;
  reportedBy?: { id: string; firstName: string; lastName: string } | null;
};

type JobVariation = {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  status: string;
  amount?: string | null;
  approvedAt?: string | null;
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
};

type JobProgress = {
  id: string;
  entryType: string;
  entryDate: string;
  summary: string;
  percentComplete?: number | null;
  details?: string | null;
  author?: { id: string; firstName: string; lastName: string } | null;
};

type JobStatusEntry = {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  changedAt: string;
  changedBy?: { id: string; firstName: string; lastName: string } | null;
};

type JobDetail = {
  id: string;
  jobNumber: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  site?: { id: string; name: string } | null;
  projectManager?: { id: string; firstName: string; lastName: string } | null;
  supervisor?: { id: string; firstName: string; lastName: string } | null;
  stages: JobStage[];
  issues: JobIssue[];
  variations: JobVariation[];
  progressEntries: JobProgress[];
  statusHistory: JobStatusEntry[];
  closeout?: {
    id: string;
    status: string;
    archivedAt?: string | null;
    summary?: string | null;
  } | null;
};

type Tab = "overview" | "stages" | "issues" | "variations" | "progress" | "punch" | "documents" | "history" | "commitments";

type CommitmentSummaryItem = {
  id: string;
  reference: string;
  description: string;
  type: string;
  status: string;
  supplier: { id: string; name: string } | null;
  originalValue: string;
  approvedChangesSum: string;
  adjustedValue: string;
};

type CommitmentBudgetSummary = {
  jobId: string;
  committedTotal: string;
  approvedTotal: string;
  commitments: CommitmentSummaryItem[];
};

type DocumentItem = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  versionLabel?: string | null;
  fileLink?: { name: string; webUrl: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETE: "Complete"
};
const STATUS_CLASS: Record<string, string> = {
  PLANNING: "s7-badge s7-badge--info",
  ACTIVE: "s7-badge s7-badge--active",
  ON_HOLD: "s7-badge s7-badge--warning",
  COMPLETE: "s7-badge s7-badge--neutral"
};

const STAGE_CLASS: Record<string, string> = {
  PLANNED: "s7-badge s7-badge--neutral",
  ACTIVE: "s7-badge s7-badge--active",
  COMPLETE: "s7-badge s7-badge--info"
};

const ACTIVITY_NEXT: Record<string, string> = {
  NOT_STARTED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETE",
  COMPLETE: "NOT_STARTED",
  PLANNED: "IN_PROGRESS"
};

const SEVERITY_CLASS: Record<string, string> = {
  HIGH: "s7-badge s7-badge--danger",
  MEDIUM: "s7-badge s7-badge--warning",
  LOW: "s7-badge s7-badge--info"
};

function formatCurrency(raw?: string | null): string {
  if (!raw) return "—";
  const value = Number(raw);
  if (Number.isNaN(value)) return raw;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

// Walks a job's nested stages[].activities into a flat list. Pure,
// exported so it can be unit-tested as a regression guard against
// B01.1 (line 207 `job?.activities.length` precedence bug).
// Tolerates a missing `job`, missing `stages`, and stages whose
// `activities` field is absent.
type FlattenInput = {
  stages?: Array<{ activities?: JobActivity[] | null; [k: string]: unknown }>;
} | null | undefined;

export function flattenActivities(job: FlattenInput): JobActivity[] {
  return (job?.stages ?? []).flatMap((s) => s.activities ?? []);
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);
  const [commitmentSummary, setCommitmentSummary] = useState<CommitmentBudgetSummary | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const canUseAssist = useCanUseAssist();

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/jobs/${id}`);
      if (!response.ok) throw new Error("Job not found.");
      const data = (await response.json()) as JobDetail;
      setJob(data);
      if (expandedStages.size === 0) {
        setExpandedStages(new Set(data.stages.map((stage) => stage.id)));
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[JobDetailPage] fetch failed:", err);
      }
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch, id]);

  useEffect(() => {
    if (tab !== "documents" || !id) return;
    let cancelled = false;
    (async () => {
      const response = await authFetch(`/documents/entity/Job/${id}`);
      if (!response.ok) {
        if (!cancelled) setDocuments([]);
        return;
      }
      const data = await response.json();
      if (!cancelled) setDocuments(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, id, authFetch]);

  useEffect(() => {
    if (tab !== "commitments" || !id) return;
    let cancelled = false;
    (async () => {
      const response = await authFetch(`/commitments/budget-summary?jobId=${id}`);
      if (!response.ok) {
        if (!cancelled) setCommitmentSummary({ jobId: id, committedTotal: "0", approvedTotal: "0", commitments: [] });
        return;
      }
      const data = (await response.json()) as CommitmentBudgetSummary;
      if (!cancelled) setCommitmentSummary(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, id, authFetch]);

  // The API nests activities inside each stage (jobInclude shape);
  // there is no top-level activities array on the response. We derive
  // a flat list once and reuse it for the overview KPIs. Was B01.1.
  const allActivities = useMemo<JobActivity[]>(() => flattenActivities(job), [job]);
  const openIssueCount = useMemo(
    () => (job?.issues ?? []).filter((issue) => issue.status === "OPEN").length,
    [job]
  );
  const variationsTotal = useMemo(
    () => (job?.variations ?? []).reduce((sum, v) => sum + Number(v.amount ?? 0), 0),
    [job]
  );
  const totalActivities = allActivities.length;
  const completedActivities = allActivities.filter((a) => a.status === "COMPLETE").length;
  const progress = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

  const toggleActivity = async (activityId: string, currentStatus: string) => {
    if (!job) return;
    const next = ACTIVITY_NEXT[currentStatus] ?? "IN_PROGRESS";
    // Optimistic — activities live inside each stage in the API
    // response, so we walk stages[].activities (B01.1).
    setJob({
      ...job,
      stages: job.stages.map((stage) => ({
        ...stage,
        activities: (stage.activities ?? []).map((a) =>
          a.id === activityId ? { ...a, status: next } : a
        )
      }))
    });
    try {
      const response = await authFetch(`/jobs/${job.id}/activities/${activityId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next })
      });
      if (!response.ok) throw new Error("Could not update activity.");
    } catch (err) {
      setError((err as Error).message);
      void reload();
    }
  };

  const toggleStage = (stageId: string) => {
    setExpandedStages((current) => {
      const next = new Set(current);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  if (loading && !job) {
    return (
      <div className="job-detail">
        <Skeleton width="30%" height={14} />
        <Skeleton width="70%" height={24} style={{ marginTop: 12 }} />
        <Skeleton width="100%" height={200} style={{ marginTop: 24 }} />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="job-detail">
        <EmptyState
          heading="Job not found"
          subtext={error}
          action={<Link to="/jobs" className="s7-btn s7-btn--primary">← Back to jobs</Link>}
        />
      </div>
    );
  }

  // Renders during initial load AND when job fetch returns null.
  // We use EmptyState instead of `return null` so a future bug
  // breaking the fetch path still shows the user SOMETHING
  // (rather than a blank page that requires F12 to diagnose).
  // See B01.1 / docs/diagnostics/2026-05-18-b01-blank-page/REPORT.md
  if (!job) {
    return (
      <div className="job-detail">
        <EmptyState
          heading="Loading job…"
          subtext="If this persists, the job may not exist or you may not have access."
          action={<Link to="/jobs" className="s7-btn s7-btn--secondary">← Back to jobs</Link>}
        />
      </div>
    );
  }

  return (
    <div className="job-detail">
      <Link to="/jobs" className="tender-detail__back">← Back to jobs</Link>

      <header className="job-detail__header">
        <div>
          <p className="s7-type-label">{job.jobNumber}</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 6px" }}>{job.name}</h1>
          <p className="job-detail__meta">
            {job.client.name}
            {job.site ? ` · ${job.site.name}` : ""}
            {job.projectManager ? ` · PM ${job.projectManager.firstName} ${job.projectManager.lastName}` : ""}
            {job.supervisor ? ` · Supervisor ${job.supervisor.firstName} ${job.supervisor.lastName}` : ""}
          </p>
          <p className="job-detail__dates">
            Created {formatDate(job.createdAt)} · Updated {formatDate(job.updatedAt)}
          </p>
        </div>
        <div className="job-detail__quick-actions">
          <span className={STATUS_CLASS[job.status] ?? "s7-badge s7-badge--neutral"}>
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
          {job.closeout ? (
            <Link to={`/archive/${job.id}`} className="s7-btn s7-btn--secondary s7-btn--sm">
              View archive →
            </Link>
          ) : null}
          {canUseAssist ? (
            <button
              type="button"
              className="s7-btn s7-btn--secondary s7-btn--sm"
              onClick={() => setAssistOpen(true)}
              title="Summarise, draft, or explain — powered by your configured AI provider"
            >
              AI assist
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <nav className="tender-detail__tabs job-detail__tabs" role="tablist">
        {([
          ["overview", "Overview"],
          ["stages", `Stages & Activities (${totalActivities})`],
          ["issues", `Issues (${job.issues.length})`],
          ["variations", `Variations (${job.variations.length})`],
          ["progress", `Progress (${job.progressEntries.length})`],
          ["punch", "Punch / Snag"],
          ["commitments", "Commitments"],
          ["documents", "Documents"],
          ["history", `History (${job.statusHistory.length})`]
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <ErrorBoundary sectionName="Overview">
        <section className="job-detail__overview">
          <div className="s7-card job-detail__overview-kpi">
            <span className="s7-type-label">Total activities</span>
            <strong className="job-detail__overview-value">{totalActivities}</strong>
            <span className="s7-type-body" style={{ color: "var(--text-secondary)" }}>
              {completedActivities} complete
            </span>
          </div>
          <div className="s7-card job-detail__overview-kpi">
            <span className="s7-type-label">Open issues</span>
            <strong className="job-detail__overview-value">{openIssueCount}</strong>
            <span className="s7-type-body" style={{ color: "var(--text-secondary)" }}>
              {job.issues.length} total
            </span>
          </div>
          <div className="s7-card job-detail__overview-kpi">
            <span className="s7-type-label">Variations value</span>
            <strong className="job-detail__overview-value">{formatCurrency(String(variationsTotal))}</strong>
            <span className="s7-type-body" style={{ color: "var(--text-secondary)" }}>
              {job.variations.length} variations
            </span>
          </div>
          <div className="s7-card job-detail__overview-kpi">
            <span className="s7-type-label">Progress</span>
            <strong className="job-detail__overview-value">{progress}%</strong>
            <div className="jobs-card__progress" style={{ marginTop: 8 }} aria-hidden>
              <span className="jobs-card__progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {job.description ? (
            <div className="s7-card job-detail__overview-description">
              <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Description</h3>
              <p>{job.description}</p>
            </div>
          ) : null}
        </section>
        </ErrorBoundary>
      ) : null}

      {tab === "stages" ? (
        <ErrorBoundary sectionName="Stages & Activities">
        <section className="s7-card">
          {job.stages.length === 0 ? (
            <EmptyState heading="No stages defined" subtext="Define the job's stages to start tracking activities." />
          ) : (
            <ul className="job-tree">
              {job.stages.map((stage) => {
                // stage.activities come from the API include scoped to
                // this stage; no need to filter by jobStageId (B01.1).
                const stageActivities = [...(stage.activities ?? [])].sort(
                  (a, b) => a.activityOrder - b.activityOrder
                );
                const isOpen = expandedStages.has(stage.id);
                return (
                  <li key={stage.id} className="job-tree__stage">
                    <button
                      type="button"
                      className="job-tree__stage-head"
                      onClick={() => toggleStage(stage.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="job-tree__caret">{isOpen ? "▾" : "▸"}</span>
                      <span className="job-tree__stage-order">{stage.stageOrder}</span>
                      <span className="job-tree__stage-title">{stage.name}</span>
                      <span className={STAGE_CLASS[stage.status] ?? "s7-badge s7-badge--neutral"}>
                        {stage.status}
                      </span>
                      <span className="job-tree__stage-count">
                        {stageActivities.filter((a) => a.status === "COMPLETE").length}/{stageActivities.length}
                      </span>
                    </button>
                    {isOpen ? (
                      <ul className="job-tree__activities">
                        {stageActivities.map((activity) => (
                          <li key={activity.id} className="job-tree__activity">
                            <button
                              type="button"
                              className={activity.status === "COMPLETE" ? "job-tree__check job-tree__check--done" : "job-tree__check"}
                              onClick={() => toggleActivity(activity.id, activity.status)}
                              aria-label={`Toggle activity status (currently ${activity.status})`}
                              title={`Click to advance from ${activity.status}`}
                            >
                              {activity.status === "COMPLETE" ? "✓" : activity.status === "IN_PROGRESS" ? "◐" : "○"}
                            </button>
                            <span className="job-tree__activity-name">{activity.name}</span>
                            <span className="job-tree__activity-meta">
                              {activity.owner ? `${activity.owner.firstName} ${activity.owner.lastName}` : "—"}
                              {activity.plannedDate ? ` · ${formatDate(activity.plannedDate)}` : ""}
                            </span>
                            <span className={STAGE_CLASS[activity.status] ?? "s7-badge s7-badge--neutral"}>
                              {activity.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        </ErrorBoundary>
      ) : null}

      {tab === "issues" ? (
        <ErrorBoundary sectionName="Issues">
        <section className="s7-card">
          {job.issues.length === 0 ? (
            <EmptyState heading="No issues" subtext="Issues raised against this job will appear here with severity and status." />
          ) : (
            <ul className="job-list">
              {job.issues.map((issue) => (
                <li key={issue.id} className="job-list__item">
                  <div className="job-list__head">
                    <strong>{issue.title}</strong>
                    <span className={SEVERITY_CLASS[issue.severity] ?? "s7-badge s7-badge--neutral"}>
                      {issue.severity}
                    </span>
                    <span className="s7-badge s7-badge--neutral">{issue.status}</span>
                  </div>
                  {issue.description ? <p className="job-list__body">{issue.description}</p> : null}
                  <span className="job-list__meta">
                    Reported {formatDate(issue.reportedAt)}
                    {issue.reportedBy ? ` by ${issue.reportedBy.firstName} ${issue.reportedBy.lastName}` : ""}
                    {issue.dueDate ? ` · due ${formatDate(issue.dueDate)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </ErrorBoundary>
      ) : null}

      {tab === "variations" ? (
        <ErrorBoundary sectionName="Variations">
        <section className="s7-card">
          {job.variations.length === 0 ? (
            <EmptyState heading="No variations" subtext="Variations capture scope or value changes against the contract." />
          ) : (
            <div className="s7-table-scroll">
              <table className="s7-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Value</th>
                    <th>Running total</th>
                    <th>Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let running = 0;
                    return job.variations.map((variation) => {
                      running += Number(variation.amount ?? 0);
                      return (
                        <tr key={variation.id}>
                          <td><strong>{variation.reference}</strong></td>
                          <td>{variation.title}</td>
                          <td><span className="s7-badge s7-badge--neutral">{variation.status}</span></td>
                          <td>{formatCurrency(variation.amount)}</td>
                          <td>{formatCurrency(String(running))}</td>
                          <td>
                            {variation.approvedAt ? formatDate(variation.approvedAt) : "—"}
                            {variation.approvedBy ? ` by ${variation.approvedBy.firstName} ${variation.approvedBy.lastName}` : ""}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </ErrorBoundary>
      ) : null}

      {tab === "progress" ? (
        <ErrorBoundary sectionName="Progress">
        <section className="s7-card">
          {job.progressEntries.length === 0 ? (
            <EmptyState heading="No progress entries" subtext="Weekly progress reports will appear here." />
          ) : (
            <ul className="job-list">
              {job.progressEntries.map((entry) => (
                <li key={entry.id} className="job-list__item">
                  <div className="job-list__head">
                    <strong>{formatDate(entry.entryDate)}</strong>
                    <span className="s7-badge s7-badge--info">{entry.entryType}</span>
                    {entry.percentComplete !== null && entry.percentComplete !== undefined ? (
                      <span className="s7-badge s7-badge--active">{entry.percentComplete}%</span>
                    ) : null}
                  </div>
                  <p className="job-list__body">{entry.summary}</p>
                  {entry.details ? <p className="job-list__subbody">{entry.details}</p> : null}
                  {entry.author ? (
                    <span className="job-list__meta">
                      — {entry.author.firstName} {entry.author.lastName}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        </ErrorBoundary>
      ) : null}

      {tab === "punch" ? (
        <ErrorBoundary sectionName="Punch / Snag">
          <PunchTab jobId={job.id} />
        </ErrorBoundary>
      ) : null}

      {tab === "commitments" ? (
        <ErrorBoundary sectionName="Commitments">
        <section className="s7-card">
          {commitmentSummary === null ? (
            <Skeleton width="60%" height={14} />
          ) : (
            <>
              <div className="job-detail__overview" style={{ marginBottom: 20 }}>
                <div className="s7-card job-detail__overview-kpi">
                  <span className="s7-type-label">Committed (incl. drafts)</span>
                  <strong className="job-detail__overview-value">
                    {formatCurrency(commitmentSummary.committedTotal)}
                  </strong>
                </div>
                <div className="s7-card job-detail__overview-kpi">
                  <span className="s7-type-label">Approved commitments</span>
                  <strong className="job-detail__overview-value">
                    {formatCurrency(commitmentSummary.approvedTotal)}
                  </strong>
                </div>
              </div>
              {commitmentSummary.commitments.length === 0 ? (
                <EmptyState
                  heading="No commitments"
                  subtext="Subcontract and purchase order commitments against this job will appear here."
                />
              ) : (
                <div className="s7-table-scroll">
                  <table className="s7-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Supplier</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Original value</th>
                        <th style={{ textAlign: "right" }}>Approved changes</th>
                        <th style={{ textAlign: "right" }}>Adjusted value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commitmentSummary.commitments.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.reference}</strong></td>
                          <td>{c.description}</td>
                          <td><span className="s7-badge s7-badge--neutral">{c.type}</span></td>
                          <td>{c.supplier?.name ?? "—"}</td>
                          <td>
                            <span className={
                              c.status === "APPROVED" ? "s7-badge s7-badge--active" :
                              c.status === "CLOSED" ? "s7-badge s7-badge--info" :
                              c.status === "CANCELLED" ? "s7-badge s7-badge--danger" :
                              "s7-badge s7-badge--neutral"
                            }>
                              {c.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>{formatCurrency(c.originalValue)}</td>
                          <td style={{ textAlign: "right" }}>{formatCurrency(c.approvedChangesSum)}</td>
                          <td style={{ textAlign: "right" }}><strong>{formatCurrency(c.adjustedValue)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
        </ErrorBoundary>
      ) : null}

      {tab === "documents" ? (
        <ErrorBoundary sectionName="Documents">
        <section className="s7-card">
          {documents === null ? (
            <Skeleton width="60%" height={14} />
          ) : documents.length === 0 ? (
            <EmptyState heading="No documents" subtext="Linked SharePoint documents for this job will appear here." />
          ) : (
            <ul className="tender-docs">
              {documents.map((doc) => (
                <li key={doc.id} className="tender-docs__item">
                  <div>
                    <strong>{doc.title}</strong>
                    <p className="tender-docs__meta">
                      {doc.category}{doc.versionLabel ? ` · ${doc.versionLabel}` : ""}{doc.description ? ` · ${doc.description}` : ""}
                    </p>
                  </div>
                  {doc.fileLink ? (
                    <a href={doc.fileLink.webUrl} target="_blank" rel="noreferrer" className="s7-btn s7-btn--secondary s7-btn--sm">
                      Open
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        </ErrorBoundary>
      ) : null}

      {tab === "history" ? (
        <ErrorBoundary sectionName="History">
        <section className="s7-card">
          {job.statusHistory.length === 0 ? (
            <EmptyState heading="No status history" subtext="Status transitions will appear here." />
          ) : (
            <ul className="tender-timeline">
              {job.statusHistory.map((entry) => (
                <li key={entry.id} className="tender-timeline__item">
                  <span className="tender-timeline__marker" aria-hidden />
                  <div className="tender-timeline__body">
                    <div className="tender-timeline__head">
                      <strong>{entry.fromStatus ?? "∅"} → {entry.toStatus}</strong>
                      <span className="tender-timeline__time">{new Date(entry.changedAt).toLocaleString()}</span>
                    </div>
                    {entry.note ? <p className="tender-timeline__text">{entry.note}</p> : null}
                    {entry.changedBy ? <span className="tender-timeline__author">— {entry.changedBy.firstName} {entry.changedBy.lastName}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        </ErrorBoundary>
      ) : null}

      <ErrorBoundary sectionName="Timeline">
        <section className="s7-card">
          <Timeline entityType="Job" entityId={job.id} />
        </section>
      </ErrorBoundary>

      <ErrorBoundary sectionName="Correspondence">
        <section className="s7-card">
          <CorrespondencePanel ownerKind="job" ownerId={job.id} />
        </section>
      </ErrorBoundary>

      <AssistPanel
        open={assistOpen}
        onClose={() => setAssistOpen(false)}
        surface="job"
        subject={`${job.jobNumber} — ${job.name}`}
        getContext={() => buildJobAssistContext(job, totalActivities, completedActivities, openIssueCount)}
      />
    </div>
  );
}

// See TenderDetailPage's buildTenderAssistContext for rationale — this
// mirrors the pattern for jobs: compact plain text summarising what the
// user can see on the page. Counts are passed in from the outer
// component so we don't re-walk stages here.
function buildJobAssistContext(
  job: JobDetail,
  totalActivities: number,
  completedActivities: number,
  openIssueCount: number
): string {
  const lines: string[] = [];
  lines.push(`Job: ${job.jobNumber} — ${job.name}`);
  lines.push(`Status: ${job.status}`);
  lines.push(`Client: ${job.client.name}`);
  if (job.site) lines.push(`Site: ${job.site.name}`);
  if (job.projectManager) {
    lines.push(
      `Project manager: ${job.projectManager.firstName} ${job.projectManager.lastName}`
    );
  }
  if (job.supervisor) {
    lines.push(`Supervisor: ${job.supervisor.firstName} ${job.supervisor.lastName}`);
  }
  if (job.description) lines.push(`Description: ${job.description}`);
  lines.push(`Stages: ${job.stages.length}`);
  lines.push(`Activities: ${totalActivities} (${completedActivities} complete)`);
  lines.push(
    `Issues: ${job.issues.length} total, ${openIssueCount} open`
  );
  lines.push(`Variations: ${job.variations.length}`);
  lines.push(`Progress entries: ${job.progressEntries.length}`);
  if (job.progressEntries[0]) {
    lines.push(`Latest progress: ${job.progressEntries[0].summary}`);
  }
  return lines.join("\n");
}
