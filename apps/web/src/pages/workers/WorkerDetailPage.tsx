import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type WorkerDetail = {
  id: string;
  employeeCode?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  employmentType?: string | null;
  status: string;
  notes?: string | null;
  resourceType?: { id: string; name: string } | null;
  competencies: Array<{
    id: string;
    competencyId: string;
    achievedAt?: string | null;
    expiresAt?: string | null;
    notes?: string | null;
    competency: { id: string; name: string; code?: string | null; description?: string | null };
  }>;
  availabilityWindows: Array<{ id: string; startAt: string; endAt: string; status: string; notes?: string | null }>;
  roleSuitabilities: Array<{ id: string; roleLabel: string; suitability: string; notes?: string | null }>;
  shiftAssignments: Array<{
    id: string;
    roleLabel?: string | null;
    shift: {
      id: string;
      title: string;
      startAt: string;
      endAt: string;
      status: string;
      job: { id: string; jobNumber: string; name: string };
      activity: { id: string; name: string };
      conflicts: Array<{ id: string; severity: string; code: string; message: string }>;
    };
  }>;
};

type DocumentItem = {
  id: string;
  title: string;
  category: string;
  versionLabel?: string | null;
  description?: string | null;
  fileLink?: { name: string; webUrl: string } | null;
};

type Tab = "profile" | "competencies" | "availability" | "shifts" | "documents";

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function availabilityStatus(worker: WorkerDetail): "ok" | "leave" {
  const now = new Date();
  const onLeave = worker.availabilityWindows.some((w) => {
    const start = new Date(w.startAt);
    const end = new Date(w.endAt);
    return w.status === "UNAVAILABLE" && start <= now && now <= end;
  });
  if (worker.status === "ON_LEAVE" || onLeave) return "leave";
  return "ok";
}

export function WorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch(`/resources/workers/${id}`);
        if (!response.ok) throw new Error("Worker not found.");
        const data = (await response.json()) as WorkerDetail;
        if (!cancelled) setWorker(data);
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
      const response = await authFetch(`/documents/entity/Worker/${id}`);
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

  if (loading && !worker) {
    return (
      <div className="worker-detail">
        <Skeleton width="30%" height={14} />
        <Skeleton width="60%" height={22} style={{ marginTop: 12 }} />
        <Skeleton width="100%" height={160} style={{ marginTop: 24 }} />
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="worker-detail">
        <EmptyState
          heading="Worker not found"
          subtext={error ?? "This worker doesn't exist or has been removed."}
          action={<Link to="/resources" className="s7-btn s7-btn--primary">← Back to workers</Link>}
        />
      </div>
    );
  }

  const avail = availabilityStatus(worker);

  return (
    <div className="worker-detail">
      <Link to="/resources" className="tender-detail__back">← Back to workers</Link>

      <header className="worker-detail__header">
        <span className="worker-detail__avatar">{initials(worker.firstName, worker.lastName)}</span>
        <div className="worker-detail__meta">
          <p className="s7-type-label">{worker.employeeCode ?? "No employee code"}</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>
            {worker.firstName} {worker.lastName}
          </h1>
          <p className="worker-detail__role">
            {worker.resourceType?.name ?? "Unassigned role"}
            {worker.employmentType ? ` · ${worker.employmentType.replace(/_/g, " ").toLowerCase()}` : ""}
          </p>
        </div>
        <div className="worker-detail__badges">
          <span className={avail === "leave" ? "s7-badge s7-badge--warning" : "s7-badge s7-badge--active"}>
            {avail === "leave" ? "On leave" : "Available"}
          </span>
        </div>
      </header>

      <nav className="tender-detail__tabs job-detail__tabs" role="tablist">
        {([
          ["profile", "Profile"],
          ["competencies", `Competencies (${worker.competencies.length})`],
          ["availability", `Availability (${worker.availabilityWindows.length})`],
          ["shifts", `Assigned shifts (${worker.shiftAssignments.length})`],
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

      {tab === "profile" ? (
        <section className="s7-card">
          <dl className="tender-detail__dl">
            <div>
              <dt>Email</dt>
              <dd>{worker.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{worker.phone ?? "—"}</dd>
            </div>
            <div>
              <dt>Resource type</dt>
              <dd>{worker.resourceType?.name ?? "—"}</dd>
            </div>
            <div>
              <dt>Employment type</dt>
              <dd>{worker.employmentType ?? "—"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{worker.status}</dd>
            </div>
            <div>
              <dt>Employee code</dt>
              <dd>{worker.employeeCode ?? "—"}</dd>
            </div>
          </dl>
          {worker.notes ? (
            <>
              <h3 className="s7-type-section-heading" style={{ marginTop: 20 }}>Notes</h3>
              <p>{worker.notes}</p>
            </>
          ) : null}
          {worker.roleSuitabilities.length > 0 ? (
            <>
              <h3 className="s7-type-section-heading" style={{ marginTop: 20 }}>Role suitability</h3>
              <ul className="worker-detail__suitabilities">
                {worker.roleSuitabilities.map((s) => (
                  <li key={s.id}>
                    <strong>{s.roleLabel}</strong>
                    <span
                      className={
                        s.suitability === "SUITABLE"
                          ? "s7-badge s7-badge--active"
                          : s.suitability === "UNSUITABLE"
                          ? "s7-badge s7-badge--danger"
                          : "s7-badge s7-badge--neutral"
                      }
                    >
                      {s.suitability}
                    </span>
                    {s.notes ? <span className="worker-detail__note">{s.notes}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {tab === "competencies" ? (
        <section className="s7-card">
          {worker.competencies.length === 0 ? (
            <EmptyState heading="No competencies" subtext="Link competencies to this worker to unlock eligible shifts." />
          ) : (
            <ul className="worker-detail__competencies">
              {worker.competencies.map((wc) => (
                <li key={wc.id}>
                  <div>
                    <strong>{wc.competency.name}</strong>
                    {wc.competency.code ? <span className="worker-detail__tag">{wc.competency.code}</span> : null}
                    {wc.competency.description ? <p className="worker-detail__note">{wc.competency.description}</p> : null}
                  </div>
                  <div className="worker-detail__comp-dates">
                    <span>Achieved {formatDate(wc.achievedAt)}</span>
                    {wc.expiresAt ? <span>· Expires {formatDate(wc.expiresAt)}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "availability" ? (
        <section className="s7-card">
          {worker.availabilityWindows.length === 0 ? (
            <EmptyState heading="No availability windows" subtext="Availability and leave windows will appear here." />
          ) : (
            <ul className="worker-detail__avail">
              {worker.availabilityWindows.map((window) => (
                <li key={window.id}>
                  <span
                    className={
                      window.status === "UNAVAILABLE"
                        ? "s7-badge s7-badge--warning"
                        : "s7-badge s7-badge--active"
                    }
                  >
                    {window.status}
                  </span>
                  <span>
                    {formatDate(window.startAt)} – {formatDate(window.endAt)}
                  </span>
                  {window.notes ? <span className="worker-detail__note">{window.notes}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "shifts" ? (
        <section className="s7-card">
          {worker.shiftAssignments.length === 0 ? (
            <EmptyState heading="No assigned shifts" subtext="This worker isn't scheduled on any shifts yet." />
          ) : (
            <div className="s7-table-scroll">
              <table className="s7-table">
                <thead>
                  <tr>
                    <th>Shift</th>
                    <th>Job</th>
                    <th>Activity</th>
                    <th>When</th>
                    <th>Status</th>
                    <th>Conflicts</th>
                  </tr>
                </thead>
                <tbody>
                  {worker.shiftAssignments.map((sa) => {
                    const s = sa.shift;
                    return (
                      <tr key={sa.id}>
                        <td>
                          <Link to="/scheduler">{s.title}</Link>
                        </td>
                        <td>
                          <Link to={`/jobs/${s.job.id}`}>
                            {s.job.jobNumber}
                          </Link>
                        </td>
                        <td>{s.activity.name}</td>
                        <td>{formatDateTime(s.startAt)} – {new Date(s.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td><span className="s7-badge s7-badge--neutral">{s.status}</span></td>
                        <td>
                          {s.conflicts.length === 0 ? "—" : (
                            <span className="s7-badge s7-badge--danger" title={s.conflicts.map((c) => `${c.severity}: ${c.message}`).join("\n")}>
                              {s.conflicts.length}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
            <EmptyState heading="No documents" subtext="Certificates, licences, and records linked to this worker appear here." />
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
