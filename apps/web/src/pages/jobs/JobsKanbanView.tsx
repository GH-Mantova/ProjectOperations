/**
 * JobsKanbanView — Kanban board for the Jobs list, grouped by job status.
 *
 * Composed from the same drag-column pattern used in TenderingPage's
 * pipeline kanban. Status moves are persisted via PATCH /jobs/:id.
 *
 * Intentionally not rebuilding the column/card primitives — the
 * styling contracts are shared via the global .tender-column / tender-card
 * CSS but with jobs-specific class overrides where they diverge.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { JOB_STATUS_LABELS, JOB_STATUSES, type JobStatus } from "../../constants/statuses";
import { progressPercent } from "./jobsListLogic";

export type JobListItem = {
  id: string;
  jobNumber: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  site?: { id: string; name: string } | null;
  stages?: Array<{ id: string; activities?: Array<{ id: string; status: string }> }>;
  projectManager?: { id: string; firstName: string; lastName: string } | null;
  supervisor?: { id: string; firstName: string; lastName: string } | null;
};

const STATUS_ACCENT: Record<JobStatus, string> = {
  PLANNING: "#94A3B8",
  ACTIVE: "#22C55E",
  ON_HOLD: "#F59E0B",
  COMPLETE: "#6B7280"
};

function initials(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return "??";
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// JobKanbanCard
// ---------------------------------------------------------------------------

type JobKanbanCardProps = {
  job: JobListItem;
};

function JobKanbanCard({ job }: JobKanbanCardProps) {
  const percent = progressPercent(job);
  return (
    <div
      className="jobs-kanban-card"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/job-id", job.id);
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="jobs-kanban-card__head">
        <span className="jobs-card__number">{job.jobNumber}</span>
        {job.projectManager ? (
          <span
            className="jobs-card__footer-avatar"
            title={`PM: ${job.projectManager.firstName} ${job.projectManager.lastName}`}
          >
            {initials(job.projectManager.firstName, job.projectManager.lastName)}
          </span>
        ) : null}
      </div>
      <Link to={`/jobs/${job.id}`} className="jobs-kanban-card__title">
        {job.name}
      </Link>
      <p className="jobs-card__meta">
        {job.client.name}
        {job.site ? ` · ${job.site.name}` : ""}
      </p>
      <div className="jobs-card__progress" aria-label={`Progress ${percent}%`}>
        <span className="jobs-card__progress-bar" style={{ width: `${percent}%` }} />
      </div>
      <span className="jobs-card__footer-item" style={{ fontSize: 11 }}>
        {percent}% complete
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JobKanbanColumn
// ---------------------------------------------------------------------------

type JobKanbanColumnProps = {
  status: JobStatus;
  jobs: JobListItem[];
  loading: boolean;
  onDrop: (jobId: string, status: JobStatus) => void;
};

function JobKanbanColumn({ status, jobs, loading, onDrop }: JobKanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={dragOver ? "jobs-kanban-col jobs-kanban-col--drag-over" : "jobs-kanban-col"}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const jobId = event.dataTransfer.getData("text/job-id");
        if (jobId) onDrop(jobId, status);
      }}
    >
      <header className="jobs-kanban-col__header">
        <span
          className="jobs-kanban-col__accent"
          style={{ background: STATUS_ACCENT[status] }}
          aria-hidden="true"
        />
        <span className="jobs-kanban-col__title">{JOB_STATUS_LABELS[status]}</span>
        <span className="jobs-kanban-col__count">{jobs.length}</span>
      </header>
      <div className="jobs-kanban-col__body">
        {loading ? (
          Array.from({ length: 2 }).map((_, idx) => (
            <div key={`skel-${status}-${idx}`} className="jobs-kanban-card jobs-kanban-card--skel">
              <Skeleton width="60%" height={12} />
              <Skeleton width="85%" height={16} style={{ marginTop: 8 }} />
              <Skeleton width="50%" height={11} style={{ marginTop: 6 }} />
              <Skeleton width="100%" height={6} style={{ marginTop: 10 }} />
            </div>
          ))
        ) : jobs.length === 0 ? (
          <p className="jobs-kanban-col__empty">No jobs.</p>
        ) : (
          jobs.map((job) => <JobKanbanCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JobsKanbanView (exported)
// ---------------------------------------------------------------------------

type JobsKanbanViewProps = {
  jobs: JobListItem[];
  loading: boolean;
  onJobStatusChanged?: () => void;
};

export function JobsKanbanView({ jobs, loading, onJobStatusChanged }: JobsKanbanViewProps) {
  const { authFetch } = useAuth();
  const [optimistic, setOptimistic] = useState<Record<string, JobStatus>>({});

  const handleDrop = async (jobId: string, newStatus: JobStatus) => {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
    if ((optimistic[jobId] ?? job.status) === newStatus) return;

    // Optimistic update
    setOptimistic((prev) => ({ ...prev, [jobId]: newStatus }));

    try {
      const response = await authFetch(`/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) {
        // Revert on failure
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      } else {
        onJobStatusChanged?.();
      }
    } catch {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  // Apply optimistic status overrides
  const jobsWithOptimistic = jobs.map((job) =>
    optimistic[job.id] ? { ...job, status: optimistic[job.id] } : job
  );

  const byStatus = JOB_STATUSES.reduce<Record<JobStatus, JobListItem[]>>(
    (acc, status) => {
      acc[status] = jobsWithOptimistic.filter((job) => job.status === status);
      return acc;
    },
    {} as Record<JobStatus, JobListItem[]>
  );

  return (
    <div className="jobs-kanban">
      {JOB_STATUSES.map((status) => (
        <JobKanbanColumn
          key={status}
          status={status}
          jobs={byStatus[status]}
          loading={loading}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
