import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

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
  activities: JobActivity[];
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

type Tab = "overview" | "stages" | "issues" | "variations" | "progress" | "documents" | "history";

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

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);

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
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openIssueCount = useMemo(() => job?.issues.filter((issue) => issue.status === "OPEN").length ?? 0, [job]);
  const variationsTotal = useMemo(
    () => (job?.variations ?? []).reduce((sum, v) => sum + Number(v.amount ?? 0), 0),
    [job]
  );
  const totalActivities = job?.activities.length ?? 0;
  const completedActivities = (job?.activities ?? []).filter((a) => a.status === "COMPLETE").length;
  const progress = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

  const toggleActivity = async (activityId: string, currentStatus: string) => {
    if (!job) return;
    const next = ACTIVITY_NEXT[currentStatus] ?? "IN_PROGRESS";
    // Optimistic
    setJob({
      ...job,
      activities: job.activities.map((a) => (a.id === activityId ? { ...a, status: next } : a))
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

  if (!job) return null;

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
      ) : null}

      {tab === "stages" ? (
        <section className="s7-card">
          {job.stages.length === 0 ? (
            <EmptyState heading="No stages defined" subtext="Define the job's stages to start tracking activities." />
          ) : (
            <ul className="job-tree">
              {job.stages.map((stage) => {
                const stageActivities = job.activities
                  .filter((activity) => activity.jobStageId === stage.id)
                  .sort((a, b) => a.activityOrder - b.activityOrder);
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
      ) : null}

      {tab === "issues" ? (
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
      ) : null}

      {tab === "variations" ? (
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
      ) : null}

      {tab === "progress" ? (
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
      ) : null}

      {tab === "documents" ? (
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
      ) : null}

      {tab === "history" ? (
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
      ) : null}
    </div>
  );
}
