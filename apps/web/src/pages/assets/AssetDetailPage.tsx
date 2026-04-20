import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type MaintenancePlan = {
  id: string;
  title: string;
  intervalDays: number;
  lastCompletedAt?: string | null;
  nextDueAt?: string | null;
  status: string;
};

type MaintenanceEvent = {
  id: string;
  eventType: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  status: string;
  notes?: string | null;
};

type Inspection = {
  id: string;
  inspectionType: string;
  inspectedAt: string;
  status: string;
  notes?: string | null;
};

type Breakdown = {
  id: string;
  reportedAt: string;
  resolvedAt?: string | null;
  severity: string;
  status: string;
  summary: string;
  notes?: string | null;
};

type ShiftAssignment = {
  id: string;
  assignedAt: string;
  shift: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
    job: { id: string; jobNumber: string; name: string; status: string };
  };
};

type Asset = {
  id: string;
  name: string;
  assetCode: string;
  serialNumber?: string | null;
  status: string;
  homeBase?: string | null;
  currentLocation?: string | null;
  notes?: string | null;
  category?: { id: string; name: string } | null;
  resourceType?: { id: string; name: string } | null;
  maintenancePlans: MaintenancePlan[];
  maintenanceEvents: MaintenanceEvent[];
  inspections: Inspection[];
  breakdowns: Breakdown[];
  statusHistory: Array<{ id: string; fromStatus?: string | null; toStatus: string; note?: string | null; changedAt: string }>;
  shiftAssignments: ShiftAssignment[];
};

type DocumentItem = {
  id: string;
  title: string;
  category: string;
  versionLabel?: string | null;
  description?: string | null;
  fileLink?: { name: string; webUrl: string } | null;
};

type Tab = "overview" | "maintenance" | "shifts" | "documents";

const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: "s7-badge s7-badge--active",
  IN_USE: "s7-badge s7-badge--info",
  MAINTENANCE: "s7-badge s7-badge--warning",
  OUT_OF_SERVICE: "s7-badge s7-badge--danger"
};

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch(`/assets/${id}`);
        if (!response.ok) throw new Error("Asset not found.");
        const data = (await response.json()) as Asset;
        if (!cancelled) setAsset(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, id]);

  useEffect(() => {
    if (tab !== "documents" || !id) return;
    let cancelled = false;
    (async () => {
      const response = await authFetch(`/documents/entity/Asset/${id}`);
      if (!response.ok) {
        if (!cancelled) setDocuments([]);
        return;
      }
      if (!cancelled) setDocuments(await response.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, id, tab]);

  const { lastService, nextService, totalDowntimeDays } = useMemo(() => {
    if (!asset) return { lastService: null as string | null, nextService: null as string | null, totalDowntimeDays: 0 };
    const completed = asset.maintenanceEvents
      .filter((event) => event.status === "COMPLETED" && event.completedAt)
      .map((event) => new Date(event.completedAt!).getTime());
    const lastFromPlan = asset.maintenancePlans
      .map((plan) => (plan.lastCompletedAt ? new Date(plan.lastCompletedAt).getTime() : 0))
      .filter((t) => t > 0);
    const allCompleted = [...completed, ...lastFromPlan];
    const last = allCompleted.length > 0 ? new Date(Math.max(...allCompleted)).toISOString() : null;

    const scheduled = asset.maintenanceEvents
      .filter((event) => (event.status === "SCHEDULED" || event.status === "OVERDUE") && event.scheduledAt)
      .map((event) => new Date(event.scheduledAt!).getTime());
    const scheduledFromPlan = asset.maintenancePlans
      .map((plan) => (plan.nextDueAt ? new Date(plan.nextDueAt).getTime() : 0))
      .filter((t) => t > 0);
    const allScheduled = [...scheduled, ...scheduledFromPlan];
    const next = allScheduled.length > 0 ? new Date(Math.min(...allScheduled)).toISOString() : null;

    // Total downtime = sum of breakdown durations (resolved breakdowns only; open ones counted to today).
    const now = Date.now();
    const downtimeMs = asset.breakdowns.reduce((sum, breakdown) => {
      const start = new Date(breakdown.reportedAt).getTime();
      const end = breakdown.resolvedAt ? new Date(breakdown.resolvedAt).getTime() : now;
      return sum + Math.max(0, end - start);
    }, 0);
    const downtimeDays = Math.round(downtimeMs / (24 * 60 * 60 * 1000));

    return { lastService: last, nextService: next, totalDowntimeDays: downtimeDays };
  }, [asset]);

  if (loading && !asset) {
    return (
      <div className="worker-detail">
        <Skeleton width="30%" height={14} />
        <Skeleton width="60%" height={22} style={{ marginTop: 12 }} />
        <Skeleton width="100%" height={160} style={{ marginTop: 24 }} />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="worker-detail">
        <EmptyState
          heading="Asset not found"
          subtext={error ?? "This asset doesn't exist or has been removed."}
          action={<Link to="/assets" className="s7-btn s7-btn--primary">← Back to assets</Link>}
        />
      </div>
    );
  }

  const history: Array<
    | { kind: "service"; id: string; at: string; title: string; body?: string | null }
    | { kind: "inspection"; id: string; at: string; title: string; status: string; body?: string | null }
    | { kind: "breakdown"; id: string; at: string; title: string; severity: string; status: string; body?: string | null }
  > = [
    ...asset.maintenanceEvents.map((event) => ({
      kind: "service" as const,
      id: event.id,
      at: event.completedAt ?? event.scheduledAt ?? new Date().toISOString(),
      title: `${event.eventType} · ${event.status}`,
      body: event.notes
    })),
    ...asset.inspections.map((inspection) => ({
      kind: "inspection" as const,
      id: inspection.id,
      at: inspection.inspectedAt,
      title: inspection.inspectionType,
      status: inspection.status,
      body: inspection.notes
    })),
    ...asset.breakdowns.map((breakdown) => ({
      kind: "breakdown" as const,
      id: breakdown.id,
      at: breakdown.reportedAt,
      title: breakdown.summary,
      severity: breakdown.severity,
      status: breakdown.status,
      body: breakdown.notes
    }))
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="worker-detail">
      <Link to="/assets" className="tender-detail__back">← Back to assets</Link>

      <header className="asset-detail__header">
        <div className="asset-detail__photo" aria-hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l9 5v10l-9 5-9-5V7z" />
          </svg>
        </div>
        <div>
          <p className="s7-type-label">{asset.assetCode}</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>{asset.name}</h1>
          <p className="worker-detail__role">
            {asset.category?.name ?? "Uncategorised"}
            {asset.homeBase ? ` · ${asset.homeBase}` : ""}
          </p>
        </div>
        <div className="worker-detail__badges">
          <span className={STATUS_CLASS[asset.status] ?? "s7-badge s7-badge--neutral"}>
            {asset.status.replace(/_/g, " ")}
          </span>
        </div>
      </header>

      <nav className="tender-detail__tabs job-detail__tabs" role="tablist">
        {([
          ["overview", "Overview"],
          ["maintenance", `Maintenance history (${asset.maintenanceEvents.length + asset.inspections.length + asset.breakdowns.length})`],
          ["shifts", `Assigned shifts (${asset.shiftAssignments.length})`],
          ["documents", "Documents"]
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
            <span className="s7-type-label">Last service</span>
            <strong className="job-detail__overview-value">{lastService ? formatDate(lastService) : "—"}</strong>
          </div>
          <div className="s7-card job-detail__overview-kpi">
            <span className="s7-type-label">Next service due</span>
            <strong className="job-detail__overview-value">{nextService ? formatDate(nextService) : "—"}</strong>
          </div>
          <div className="s7-card job-detail__overview-kpi">
            <span className="s7-type-label">Total downtime</span>
            <strong className="job-detail__overview-value">{totalDowntimeDays} days</strong>
            <span className="s7-type-body" style={{ color: "var(--text-secondary)" }}>
              {asset.breakdowns.length} breakdowns
            </span>
          </div>
          <div className="s7-card job-detail__overview-kpi">
            <span className="s7-type-label">Current location</span>
            <strong className="job-detail__overview-value" style={{ fontSize: 20 }}>
              {asset.currentLocation ?? asset.homeBase ?? "—"}
            </strong>
          </div>
          {asset.notes ? (
            <div className="s7-card job-detail__overview-description">
              <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Notes</h3>
              <p>{asset.notes}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "maintenance" ? (
        <section className="s7-card">
          {history.length === 0 ? (
            <EmptyState heading="No maintenance history" subtext="Services, inspections, and breakdowns will appear here." />
          ) : (
            <ul className="tender-timeline">
              {history.map((entry) => {
                const kindClass =
                  entry.kind === "breakdown"
                    ? "tender-timeline__item tender-timeline__item--clarification"
                    : entry.kind === "inspection"
                    ? "tender-timeline__item tender-timeline__item--follow-up"
                    : "tender-timeline__item tender-timeline__item--outcome";
                return (
                  <li key={`${entry.kind}-${entry.id}`} className={kindClass}>
                    <span className="tender-timeline__marker" aria-hidden />
                    <div className="tender-timeline__body">
                      <div className="tender-timeline__head">
                        <strong>
                          {entry.kind === "service" ? "Service" : entry.kind === "inspection" ? "Inspection" : "Breakdown"} · {entry.title}
                        </strong>
                        <span className="tender-timeline__time">{formatDateTime(entry.at)}</span>
                      </div>
                      {"status" in entry ? (
                        <p className="tender-timeline__text">
                          Status: {entry.status}
                          {"severity" in entry ? ` · Severity: ${entry.severity}` : ""}
                        </p>
                      ) : null}
                      {entry.body ? <p className="tender-timeline__text">{entry.body}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "shifts" ? (
        <section className="s7-card">
          {asset.shiftAssignments.length === 0 ? (
            <EmptyState heading="No assigned shifts" subtext="Scheduled shifts using this asset will appear here." />
          ) : (
            <div className="s7-table-scroll">
              <table className="s7-table">
                <thead>
                  <tr>
                    <th>Shift</th>
                    <th>Job</th>
                    <th>When</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {asset.shiftAssignments.map((sa) => (
                    <tr key={sa.id}>
                      <td>
                        <Link to="/scheduler">{sa.shift.title}</Link>
                      </td>
                      <td>
                        <Link to={`/jobs/${sa.shift.job.id}`}>{sa.shift.job.jobNumber}</Link>
                      </td>
                      <td>{formatDateTime(sa.shift.startAt)}</td>
                      <td><span className="s7-badge s7-badge--neutral">{sa.shift.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "documents" ? (
        <section className="s7-card">
          {documents === null ? (
            <Skeleton width="60%" height={14} />
          ) : documents.length === 0 ? (
            <EmptyState heading="No documents" subtext="Registration, calibration, and service records linked to this asset appear here." />
          ) : (
            <ul className="tender-docs">
              {documents.map((doc) => (
                <li key={doc.id} className="tender-docs__item">
                  <div>
                    <strong>{doc.title}</strong>
                    <p className="tender-docs__meta">
                      {doc.category}
                      {doc.versionLabel ? ` · ${doc.versionLabel}` : ""}
                      {doc.description ? ` · ${doc.description}` : ""}
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
    </div>
  );
}
