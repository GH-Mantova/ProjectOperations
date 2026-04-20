import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type JobListItem = {
  id: string;
  jobNumber: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
  site?: { id: string; name: string } | null;
  activities?: Array<{ id: string; status: string }>;
  projectManager?: { id: string; firstName: string; lastName: string } | null;
  supervisor?: { id: string; firstName: string; lastName: string } | null;
};

type JobListResponse = {
  items: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
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

type View = "cards" | "table";

type Client = { id: string; name: string };
type Site = { id: string; name: string };
type Worker = { id: string; firstName: string; lastName: string };

function progressPercent(job: JobListItem): number {
  const activities = job.activities ?? [];
  if (activities.length === 0) return 0;
  const done = activities.filter((activity) => activity.status === "COMPLETE").length;
  return Math.round((done / activities.length) * 100);
}

function initials(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return "??";
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export function JobsListPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("cards");
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    clientId: "",
    siteId: "",
    workerId: "",
    dateFrom: "",
    dateTo: ""
  });

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/jobs?page=1&pageSize=200");
      if (!response.ok) throw new Error("Could not load jobs.");
      const data = (await response.json()) as JobListResponse;
      setJobs(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [clientsRes, sitesRes, workersRes] = await Promise.all([
          authFetch("/master-data/clients?page=1&pageSize=200"),
          authFetch("/master-data/sites?page=1&pageSize=200"),
          authFetch("/resources/workers?page=1&pageSize=200")
        ]);
        if (clientsRes.ok && !cancelled) {
          const data = await clientsRes.json();
          setClients((data.items ?? []).map((c: Client) => ({ id: c.id, name: c.name })));
        }
        if (sitesRes.ok && !cancelled) {
          const data = await sitesRes.json();
          setSites((data.items ?? []).map((s: Site) => ({ id: s.id, name: s.name })));
        }
        if (workersRes.ok && !cancelled) {
          const data = await workersRes.json();
          setWorkers(
            (data.items ?? []).map((w: Worker) => ({
              id: w.id,
              firstName: w.firstName,
              lastName: w.lastName
            }))
          );
        }
      } catch {
        // non-fatal; dropdowns just won't populate
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (filters.status && job.status !== filters.status) return false;
      if (filters.clientId && job.client.id !== filters.clientId) return false;
      if (filters.siteId && job.site?.id !== filters.siteId) return false;
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom).getTime();
        if (new Date(job.updatedAt).getTime() < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo).getTime() + 24 * 60 * 60 * 1000;
        if (new Date(job.updatedAt).getTime() > to) return false;
      }
      if (filters.search) {
        const needle = filters.search.toLowerCase();
        const hay = [job.jobNumber, job.name, job.client.name, job.site?.name ?? ""].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [jobs, filters]);

  return (
    <div className="jobs-page">
      <header className="jobs-page__header">
        <div>
          <p className="s7-type-label">Jobs</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Delivery workspace</h1>
        </div>
        <div className="jobs-page__header-actions">
          <div className="tender-page__view-toggle" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={view === "cards"}
              className={view === "cards" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("cards")}
            >
              Cards
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "table"}
              className={view === "table" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => setNewOpen(true)}>
            + New job
          </button>
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <div className="jobs-page__filters">
        <input
          className="s7-input"
          placeholder="Search by number, name, client, site"
          value={filters.search}
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
        />
        <select
          className="s7-select"
          value={filters.status}
          onChange={(event) => setFilters({ ...filters, status: event.target.value })}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          className="s7-select"
          value={filters.clientId}
          onChange={(event) => setFilters({ ...filters, clientId: event.target.value })}
        >
          <option value="">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>
        <select
          className="s7-select"
          value={filters.siteId}
          onChange={(event) => setFilters({ ...filters, siteId: event.target.value })}
        >
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
        <select
          className="s7-select"
          value={filters.workerId}
          onChange={(event) => setFilters({ ...filters, workerId: event.target.value })}
          title="Worker filter is applied by the backend when integrated; UI-side it's a client dropdown placeholder"
        >
          <option value="">All workers</option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>{worker.firstName} {worker.lastName}</option>
          ))}
        </select>
        <input
          type="date"
          className="s7-input"
          value={filters.dateFrom}
          onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
          aria-label="From date"
        />
        <input
          type="date"
          className="s7-input"
          value={filters.dateTo}
          onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
          aria-label="To date"
        />
      </div>

      {view === "cards" ? (
        <section className="jobs-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={`job-skel-${index}`} className="s7-card">
                <Skeleton width="40%" height={12} />
                <Skeleton width="80%" height={20} style={{ marginTop: 10 }} />
                <Skeleton width="60%" height={14} style={{ marginTop: 10 }} />
                <Skeleton width="100%" height={8} style={{ marginTop: 14 }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <EmptyState
              heading="No jobs match your filters"
              subtext="Clear the filters or create a new job to get started."
              action={
                <button type="button" className="s7-btn s7-btn--primary" onClick={() => setNewOpen(true)}>
                  + New job
                </button>
              }
            />
          ) : (
            filtered.map((job) => {
              const percent = progressPercent(job);
              return (
                <Link key={job.id} to={`/jobs/${job.id}`} className="jobs-card">
                  <div className="jobs-card__head">
                    <span className="jobs-card__number">{job.jobNumber}</span>
                    <span className={STATUS_CLASS[job.status] ?? "s7-badge s7-badge--neutral"}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </span>
                  </div>
                  <h3 className="jobs-card__title">{job.name}</h3>
                  <p className="jobs-card__meta">{job.client.name}{job.site ? ` · ${job.site.name}` : ""}</p>
                  <div className="jobs-card__progress" aria-label={`Progress ${percent}%`}>
                    <span className="jobs-card__progress-bar" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="jobs-card__footer">
                    <span className="jobs-card__footer-item">{percent}% complete</span>
                    {job.projectManager ? (
                      <span className="jobs-card__footer-avatar" title={`PM: ${job.projectManager.firstName} ${job.projectManager.lastName}`}>
                        {initials(job.projectManager.firstName, job.projectManager.lastName)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })
          )}
        </section>
      ) : (
        <div className="s7-table-scroll">
          <table className="s7-table">
            <thead>
              <tr>
                <th>Job #</th>
                <th>Name</th>
                <th>Client</th>
                <th>Site</th>
                <th>Status</th>
                <th>Progress</th>
                <th>PM</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`row-s-${i}`}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j}><Skeleton height={14} /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      heading="No jobs match your filters"
                      subtext="Clear the filters or create a new job to get started."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((job) => {
                  const percent = progressPercent(job);
                  return (
                    <tr
                      key={job.id}
                      className="s7-table__row--clickable"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      <td><strong>{job.jobNumber}</strong></td>
                      <td>{job.name}</td>
                      <td>{job.client.name}</td>
                      <td>{job.site?.name ?? "—"}</td>
                      <td>
                        <span className={STATUS_CLASS[job.status] ?? "s7-badge s7-badge--neutral"}>
                          {STATUS_LABEL[job.status] ?? job.status}
                        </span>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div className="jobs-card__progress" aria-label={`Progress ${percent}%`}>
                          <span className="jobs-card__progress-bar" style={{ width: `${percent}%` }} />
                        </div>
                      </td>
                      <td>
                        {job.projectManager ? `${job.projectManager.firstName} ${job.projectManager.lastName}` : "—"}
                      </td>
                      <td>{new Date(job.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <NewJobSlideOver
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setNewOpen(false);
          void reload();
          navigate(`/jobs/${id}`);
        }}
        clients={clients}
        sites={sites}
      />
    </div>
  );
}

type NewJobSlideOverProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  clients: Client[];
  sites: Site[];
};

function NewJobSlideOver({ open, onClose, onCreated, clients, sites }: NewJobSlideOverProps) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    jobNumber: "",
    name: "",
    description: "",
    clientId: "",
    siteId: "",
    status: "PLANNING"
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setForm({ jobNumber: "", name: "", description: "", clientId: "", siteId: "", status: "PLANNING" });
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.jobNumber.trim() || !form.name.trim() || !form.clientId) {
      setError("Job number, name, and client are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        jobNumber: form.jobNumber.trim(),
        name: form.name.trim(),
        clientId: form.clientId,
        status: form.status
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.siteId) payload.siteId = form.siteId;
      const response = await authFetch("/jobs", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not create job.");
      }
      const created = await response.json();
      onCreated(created.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Create job" onClick={onClose}>
      <div ref={panelRef} className="slide-over" onClick={(event) => event.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>New job</h2>
            <p className="slide-over__subtitle">Register a job to start planning stages, activities, and resources.</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <form onSubmit={submit} className="slide-over__body tender-form">
          {error ? <div className="login-card__error" role="alert">{error}</div> : null}
          <label className="tender-form__field">
            <span className="s7-type-label">Job number</span>
            <input className="s7-input" value={form.jobNumber} onChange={(event) => setForm({ ...form, jobNumber: event.target.value })} placeholder="J-2025-003" required />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Name</span>
            <input className="s7-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Client</span>
            <select className="s7-select" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} required>
              <option value="">Select a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Site</span>
            <select className="s7-select" value={form.siteId} onChange={(event) => setForm({ ...form, siteId: event.target.value })}>
              <option value="">Site unassigned</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Status</span>
            <select className="s7-select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Description</span>
            <textarea className="s7-textarea" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <footer className="slide-over__footer">
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create job"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
