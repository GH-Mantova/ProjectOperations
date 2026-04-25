import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { AdvanceStatusModal } from "./AdvanceStatusModal";
import { GanttChart, type GanttTask } from "./GanttChart";

type Person = { id: string; firstName: string; lastName: string; email?: string } | null;

type ProjectDetail = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  contractValue: string;
  budget: string;
  actualCost: string;
  variance: string;
  proposedStartDate: string | null;
  actualStartDate: string | null;
  practicalCompletionDate: string | null;
  closedDate: string | null;
  siteAddressLine1: string;
  siteAddressLine2: string | null;
  siteAddressSuburb: string;
  siteAddressState: string;
  siteAddressPostcode: string;
  estimateSnapshot: { snapshotAt?: string; estimate?: unknown };
  client: { id: string; name: string };
  sourceTender: { id: string; tenderNumber: string; title: string } | null;
  projectManager: Person;
  supervisor: Person;
  estimator: Person;
  whsOfficer: Person;
  scopeItems: Array<{ id: string; scopeCode: string; description: string; quantity: string; unit: string }>;
  milestones: Array<{ id: string; name: string; plannedDate: string | null; status: string; order: number }>;
  activityLog: Array<{
    id: string;
    action: string;
    details: Record<string, unknown>;
    createdAt: string;
    user: Person;
  }>;
};

type ActivityResponse = {
  items: Array<ProjectDetail["activityLog"][number]>;
  total: number;
  page: number;
  limit: number;
};

type Tab = "overview" | "scope" | "schedule" | "documents" | "team" | "activity";

const STATUS_LABEL: Record<string, string> = {
  MOBILISING: "Mobilising",
  ACTIVE: "Active",
  PRACTICAL_COMPLETION: "Practical Completion",
  DEFECTS: "Defects",
  CLOSED: "Closed"
};

const ACTION_LABEL: Record<string, string> = {
  PROJECT_CREATED: "Project created",
  STATUS_CHANGED: "Status changed",
  TEAM_CHANGED: "Team updated",
  CONTRACT_VALUE_CHANGED: "Contract value changed",
  BUDGET_CHANGED: "Budget changed",
  DOCUMENT_ADDED: "Document added",
  DOCUMENT_REMOVED: "Document removed",
  WORKER_ALLOCATED: "Worker allocated",
  ASSET_ALLOCATED: "Asset allocated"
};

function formatCurrency(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function initials(p: Person): string {
  if (!p) return "—";
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

function fullName(p: Person): string {
  if (!p) return "Unassigned";
  return `${p.firstName} ${p.lastName}`;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch, user } = useAuth();
  const canManage = useMemo(() => user?.permissions.includes("projects.manage") ?? false, [user]);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [advanceOpen, setAdvanceOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/projects/${id}`);
      if (!response.ok) throw new Error("Project not found.");
      setProject((await response.json()) as ProjectDetail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <div className="admin-page">
        <Skeleton width="40%" height={24} />
        <Skeleton width="100%" height={200} style={{ marginTop: 12 }} />
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="admin-page">
        <EmptyState heading="Project not found" subtext={error ?? "The project you're looking for doesn't exist."} />
        <Link to="/projects" className="s7-btn s7-btn--primary s7-btn--sm">← Back to projects</Link>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <Link to="/projects" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Projects</Link>
          <p className="s7-type-label" style={{ marginTop: 4 }}>{project.projectNumber}</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>{project.name}</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            {project.client.name}
            {project.sourceTender ? (
              <>
                {" · "}
                <Link to={`/tenders/${project.sourceTender.id}`} style={{ color: "var(--text-muted)" }}>
                  From {project.sourceTender.tenderNumber}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            className="type-badge"
            style={{
              background: project.status === "ACTIVE" ? "color-mix(in srgb, #005B61 15%, transparent)" : "#F1EFE8",
              color: project.status === "ACTIVE" ? "#005B61" : "#444441",
              padding: "4px 12px"
            }}
          >
            {STATUS_LABEL[project.status] ?? project.status}
          </span>
          {canManage && project.status !== "CLOSED" ? (
            <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => setAdvanceOpen(true)}>
              Advance status →
            </button>
          ) : null}
        </div>
      </header>

      <nav className="admin-page__tabs" role="tablist">
        {(["overview", "scope", "schedule", "documents", "team", "activity"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
            onClick={() => setTab(key)}
          >
            {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab project={project} />}
      {tab === "scope" && <ScopeTab project={project} />}
      {tab === "schedule" && <ScheduleTab project={project} />}
      {tab === "documents" && <DocumentsTab project={project} />}
      {tab === "team" && <TeamTab project={project} />}
      {tab === "activity" && <ActivityTab projectId={project.id} initial={project.activityLog} />}

      {advanceOpen ? (
        <AdvanceStatusModal
          project={project}
          onClose={() => setAdvanceOpen(false)}
          onSaved={() => {
            setAdvanceOpen(false);
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}

function OverviewTab({ project }: { project: ProjectDetail }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="s7-card">
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Financials</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Stat label="Contract Value" value={formatCurrency(project.contractValue)} />
          <Stat label="Budget" value={formatCurrency(project.budget)} />
          <Stat label="Actual Cost" value={formatCurrency(project.actualCost)} />
          <Stat
            label="Variance"
            value={formatCurrency(project.variance)}
            accent={Number(project.variance) < 0 ? "#A32D2D" : "#3B6D11"}
          />
        </div>
      </section>

      <section className="s7-card">
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Team</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <PersonCard role="Project Manager" person={project.projectManager} />
          <PersonCard role="Supervisor" person={project.supervisor} />
          <PersonCard role="Estimator" person={project.estimator} />
          <PersonCard role="WHS Officer" person={project.whsOfficer} />
        </div>
      </section>

      <section className="s7-card">
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Key dates</h3>
        <dl className="tender-detail__dl">
          <div><dt>Proposed Start</dt><dd>{formatDate(project.proposedStartDate)}</dd></div>
          <div><dt>Actual Start</dt><dd>{formatDate(project.actualStartDate)}</dd></div>
          <div><dt>Practical Completion</dt><dd>{formatDate(project.practicalCompletionDate)}</dd></div>
          <div><dt>Closed</dt><dd>{formatDate(project.closedDate)}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: accent ?? "inherit", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function PersonCard({ role, person }: { role: string; person: Person }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: 8 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: person ? "var(--brand-accent, #FEAA6D)" : "var(--surface-subtle, rgba(0,0,0,0.05))",
          color: "#3E1C00",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600
        }}
      >
        {initials(person)}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{role}</div>
        <div style={{ fontWeight: 500 }}>{fullName(person)}</div>
      </div>
    </div>
  );
}

function ScopeTab({ project }: { project: ProjectDetail }) {
  const groups = useMemo(() => {
    const map = new Map<string, ProjectDetail["scopeItems"]>();
    for (const item of project.scopeItems) {
      const key = item.scopeCode;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [project.scopeItems]);

  const snapshotAt = project.estimateSnapshot?.snapshotAt;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          padding: "10px 14px",
          background: "color-mix(in srgb, #FEAA6D 12%, transparent)",
          border: "1px solid color-mix(in srgb, #FEAA6D 35%, transparent)",
          borderRadius: 8,
          fontSize: 13
        }}
      >
        Scope and rates are frozen at conversion
        {snapshotAt ? ` — ${new Date(snapshotAt).toLocaleString()}` : ""}.
      </div>
      {groups.length === 0 ? (
        <EmptyState heading="No scope items" subtext="No line items were snapshotted from the source tender." />
      ) : (
        groups.map(([code, items]) => (
          <section key={code} className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>
              {code} <span style={{ color: "var(--text-muted)", fontSize: 14 }}>({items.length} line{items.length === 1 ? "" : "s"})</span>
            </h3>
            <table className="admin-page__table">
              <thead>
                <tr><th>Description</th><th style={{ textAlign: "right" }}>Quantity</th><th>Unit</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Number(item.quantity).toFixed(2)}</td>
                    <td style={{ color: "var(--text-muted)" }}>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}

function ScheduleTab({ project }: { project: ProjectDetail }) {
  const { authFetch, user } = useAuth();
  const canManage = user?.permissions?.includes("projects.manage") ?? false;
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [view, setView] = useState<"gantt" | "list">("gantt");
  const [zoom, setZoom] = useState<"week" | "month" | "quarter">("week");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await authFetch(`/projects/${project.id}/gantt`);
      if (!r.ok) throw new Error(await r.text());
      setTasks((await r.json()) as GanttTask[]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    if (!window.confirm("Generate Gantt tasks from the source tender's scope disciplines?")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch(`/projects/${project.id}/gantt/generate`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="s7-card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Schedule</h3>
          <div role="tablist" style={{ display: "inline-flex", gap: 4, marginLeft: 8 }}>
            <button
              type="button"
              role="tab"
              aria-selected={view === "gantt"}
              className={view === "gantt" ? "s7-btn s7-btn--secondary s7-btn--sm" : "s7-btn s7-btn--ghost s7-btn--sm"}
              onClick={() => setView("gantt")}
            >
              Gantt
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              className={view === "list" ? "s7-btn s7-btn--secondary s7-btn--sm" : "s7-btn s7-btn--ghost s7-btn--sm"}
              onClick={() => setView("list")}
            >
              List
            </button>
          </div>
          {view === "gantt" ? (
            <div style={{ display: "inline-flex", gap: 4, marginLeft: 8 }}>
              {(["week", "month", "quarter"] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  className={zoom === z ? "s7-btn s7-btn--secondary s7-btn--sm" : "s7-btn s7-btn--ghost s7-btn--sm"}
                  onClick={() => setZoom(z)}
                >
                  {z[0].toUpperCase() + z.slice(1)}
                </button>
              ))}
            </div>
          ) : null}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {canManage ? (
              <>
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  onClick={() => void generate()}
                  disabled={busy}
                >
                  {busy ? "Generating…" : "Generate from scope"}
                </button>
                <button
                  type="button"
                  className="s7-btn s7-btn--primary s7-btn--sm"
                  onClick={() => setCreating(true)}
                >
                  + Add task
                </button>
              </>
            ) : null}
          </div>
        </div>

        {error ? <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p> : null}

        {view === "gantt" ? (
          <GanttChart
            projectId={project.id}
            tasks={tasks}
            zoom={zoom}
            canManage={canManage}
            onChanged={() => void load()}
          />
        ) : (
          <GanttListView projectId={project.id} tasks={tasks} canManage={canManage} onChanged={() => void load()} />
        )}

        {creating ? (
          <AddGanttTaskModal
            projectId={project.id}
            existingCount={tasks.length}
            onClose={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              void load();
            }}
          />
        ) : null}
      </section>
      <section className="s7-card">
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Milestones</h3>
        {project.milestones.length === 0 ? (
          <EmptyState heading="No milestones yet" subtext="Milestones will appear here once defined for this project." />
        ) : (
          <table className="admin-page__table">
            <thead>
              <tr><th>Name</th><th>Planned</th><th>Status</th></tr>
            </thead>
            <tbody>
              {project.milestones.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{formatDate(m.plannedDate)}</td>
                  <td>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function DocumentsTab({ project }: { project: ProjectDetail }) {
  const { authFetch } = useAuth();
  const [docs, setDocs] = useState<Array<{ id: string; title: string; category: string; createdAt: string; fileLink?: { name: string; webUrl: string } | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Fetch via the source tender's document list (docs were re-linked at conversion).
        if (project.sourceTender) {
          const response = await authFetch(`/tenders/${project.sourceTender.id}/documents`);
          if (response.ok) {
            setDocs(await response.json());
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch, project.sourceTender]);

  if (loading) return <Skeleton width="100%" height={180} />;
  if (error) return <p style={{ color: "var(--status-danger)" }}>{error}</p>;

  return (
    <section className="s7-card">
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>
        Documents {docs.length > 0 ? <span style={{ color: "var(--text-muted)", fontSize: 14 }}>({docs.length})</span> : null}
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
        Documents linked to the source tender at conversion appear here. Upload + delete will log DOCUMENT_ADDED / DOCUMENT_REMOVED to the project activity feed in a follow-up PR.
      </p>
      {docs.length === 0 ? (
        <EmptyState heading="No documents" subtext="No documents were linked at conversion." />
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => (
            <li key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: 10, border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: 6 }}>
              <div>
                <strong>{d.fileLink?.name ?? d.title}</strong>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.category} · {new Date(d.createdAt).toLocaleDateString()}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type WorkerAllocation = {
  id: string;
  workerProfile: { id: string; firstName: string; lastName: string; role: string } | null;
  roleOnProject: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
};
type AssetAllocation = {
  id: string;
  asset: { id: string; name: string; assetNumber: string; category: string | null } | null;
  roleOnProject: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
};
type AllocationsResponse = { workers: WorkerAllocation[]; assets: AssetAllocation[] };

function TeamTab({ project }: { project: ProjectDetail }) {
  const { authFetch, user } = useAuth();
  const canManageResources = useMemo(
    () => user?.permissions.includes("resources.manage") ?? false,
    [user]
  );
  const [data, setData] = useState<AllocationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/projects/${project.id}/allocations`);
      if (!response.ok) throw new Error(await response.text());
      setData((await response.json()) as AllocationsResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function removeAllocation(allocId: string, label: string) {
    if (!window.confirm(`Remove ${label} from this project?`)) return;
    try {
      const response = await authFetch(`/projects/${project.id}/allocations/${allocId}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading && !data) {
    return <div className="s7-card"><Skeleton width="100%" height={200} /></div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      <section className="s7-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Workers</h3>
          {canManageResources ? (
            <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => setWorkerModalOpen(true)}>
              Add worker
            </button>
          ) : null}
        </div>
        {!data || data.workers.length === 0 ? (
          <EmptyState heading="No workers allocated" subtext="Add workers to build the delivery team." />
        ) : (
          <table className="admin-page__table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role on project</th>
                <th>Start</th>
                <th>End</th>
                {canManageResources ? <th style={{ width: 60 }}></th> : null}
              </tr>
            </thead>
            <tbody>
              {data.workers.map((w) => {
                const name = w.workerProfile
                  ? `${w.workerProfile.firstName} ${w.workerProfile.lastName}`
                  : "(removed)";
                return (
                  <tr key={w.id}>
                    <td>
                      {w.workerProfile ? (
                        <Link to={`/workers/${w.workerProfile.id}`} style={{ color: "var(--brand-accent, #FEAA6D)" }}>
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                      {w.workerProfile ? (
                        <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>
                          ({w.workerProfile.role})
                        </span>
                      ) : null}
                    </td>
                    <td>{w.roleOnProject ?? "—"}</td>
                    <td>{formatDate(w.startDate)}</td>
                    <td>{w.endDate ? formatDate(w.endDate) : "Ongoing"}</td>
                    {canManageResources ? (
                      <td>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          aria-label={`Remove ${name}`}
                          onClick={() => void removeAllocation(w.id, name)}
                        >
                          🗑
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="s7-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Plant &amp; equipment</h3>
          {canManageResources ? (
            <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => setAssetModalOpen(true)}>
              Add asset
            </button>
          ) : null}
        </div>
        {!data || data.assets.length === 0 ? (
          <EmptyState heading="No assets allocated" subtext="Assign plant & equipment to this project." />
        ) : (
          <table className="admin-page__table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Asset number</th>
                <th>Role on project</th>
                <th>Start</th>
                <th>End</th>
                {canManageResources ? <th style={{ width: 60 }}></th> : null}
              </tr>
            </thead>
            <tbody>
              {data.assets.map((a) => {
                const name = a.asset?.name ?? "(removed)";
                return (
                  <tr key={a.id}>
                    <td>
                      {a.asset ? (
                        <Link to={`/assets/${a.asset.id}`} style={{ color: "var(--brand-accent, #FEAA6D)" }}>
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </td>
                    <td>{a.asset?.assetNumber ?? "—"}</td>
                    <td>{a.roleOnProject ?? "—"}</td>
                    <td>{formatDate(a.startDate)}</td>
                    <td>{a.endDate ? formatDate(a.endDate) : "Ongoing"}</td>
                    {canManageResources ? (
                      <td>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          aria-label={`Remove ${name}`}
                          onClick={() => void removeAllocation(a.id, name)}
                        >
                          🗑
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {workerModalOpen ? (
        <AllocateWorkerModal
          projectId={project.id}
          onClose={() => setWorkerModalOpen(false)}
          onAllocated={() => {
            setWorkerModalOpen(false);
            setToast("Worker allocated");
            void load();
          }}
        />
      ) : null}

      {assetModalOpen ? (
        <AllocateAssetModal
          projectId={project.id}
          onClose={() => setAssetModalOpen(false)}
          onAllocated={() => {
            setAssetModalOpen(false);
            setToast("Asset allocated");
            void load();
          }}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#005B61",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)"
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

type WorkerSearchRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

function AllocateWorkerModal({
  projectId,
  onClose,
  onAllocated
}: {
  projectId: string;
  onClose: () => void;
  onAllocated: () => void;
}) {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkerSearchRow[]>([]);
  const [selected, setSelected] = useState<WorkerSearchRow | null>(null);
  const [roleOnProject, setRoleOnProject] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingWarnings, setPendingWarnings] = useState<
    Array<{ projectId: string; projectNumber: string; projectName: string; startDate: string; endDate: string | null }> | null
  >(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: query.trim(), isActive: "true" });
        const response = await authFetch(`/workers?${params.toString()}`);
        if (!response.ok) return;
        const body = (await response.json()) as { items: WorkerSearchRow[] };
        if (!cancelled) setResults(body.items);
      } catch {
        // ignore search errors
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [authFetch, query]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        type: "WORKER",
        workerProfileId: selected.id,
        startDate
      };
      if (roleOnProject.trim()) body.roleOnProject = roleOnProject.trim();
      if (endDate) body.endDate = endDate;
      if (notes.trim()) body.notes = notes.trim();

      const response = await authFetch(`/projects/${projectId}/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as {
        allocation: unknown;
        warnings: Array<{
          projectId: string;
          projectNumber: string;
          projectName: string;
          startDate: string;
          endDate: string | null;
        }>;
      };
      if (payload.warnings.length > 0 && !forceSubmit) {
        setPendingWarnings(payload.warnings);
        setForceSubmit(true);
        return;
      }
      onAllocated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", display: "grid", placeItems: "center", zIndex: 100 }}
      onClick={onClose}
    >
      <div
        className="s7-card"
        style={{ width: "min(520px, 92vw)", padding: 24, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="s7-type-section-title" style={{ margin: 0 }}>Allocate worker</h2>

        {!selected ? (
          <>
            <p style={{ color: "var(--text-muted)", margin: "8px 0" }}>Search by name or role.</p>
            <input
              className="s7-input"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              style={{ width: "100%" }}
            />
            <ul style={{ listStyle: "none", padding: 0, marginTop: 12, maxHeight: 260, overflowY: "auto" }}>
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost"
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px" }}
                    onClick={() => setSelected(r)}
                  >
                    <strong>{r.firstName} {r.lastName}</strong>
                    <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>· {r.role}</span>
                  </button>
                </li>
              ))}
              {query && results.length === 0 ? (
                <li style={{ color: "var(--text-muted)", padding: 12 }}>No matches.</li>
              ) : null}
            </ul>
          </>
        ) : (
          <>
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#F1EFE8", borderRadius: 6 }}>
              Selected: <strong>{selected.firstName} {selected.lastName}</strong>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => {
                  setSelected(null);
                  setPendingWarnings(null);
                  setForceSubmit(false);
                }}
                style={{ marginLeft: 12 }}
              >
                Change
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label>
                <span className="s7-type-label">Role on project</span>
                <input className="s7-input" value={roleOnProject} onChange={(e) => setRoleOnProject(e.target.value)} style={{ width: "100%" }} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <span className="s7-type-label">Start date*</span>
                  <input type="date" className="s7-input" required value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%" }} />
                </label>
                <label>
                  <span className="s7-type-label">End date</span>
                  <input type="date" className="s7-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: "100%" }} />
                </label>
              </div>
              <label>
                <span className="s7-type-label">Notes</span>
                <textarea className="s7-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>

            {pendingWarnings && pendingWarnings.length > 0 ? (
              <div
                role="alert"
                style={{
                  background: "#FAEEDA",
                  color: "#854F0B",
                  padding: "10px 12px",
                  borderRadius: 6,
                  marginTop: 12,
                  fontSize: 13
                }}
              >
                <strong>Warning:</strong> {selected.firstName} {selected.lastName} is already allocated to:
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                  {pendingWarnings.map((w) => (
                    <li key={w.projectId}>
                      {w.projectNumber} — {w.projectName} ({formatDate(w.startDate)} – {w.endDate ? formatDate(w.endDate) : "Ongoing"})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {error ? (
              <div role="alert" style={{ background: "#FCEBEB", color: "#A32D2D", padding: "8px 12px", borderRadius: 6, marginTop: 12, fontSize: 13 }}>
                {error}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="s7-btn s7-btn--primary" onClick={() => void submit()} disabled={submitting}>
                {submitting ? "Allocating…" : pendingWarnings && pendingWarnings.length > 0 ? "Allocate anyway" : "Allocate"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type AssetSearchRow = {
  id: string;
  name: string;
  assetCode: string;
  category?: { name: string } | null;
};

function AllocateAssetModal({
  projectId,
  onClose,
  onAllocated
}: {
  projectId: string;
  onClose: () => void;
  onAllocated: () => void;
}) {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetSearchRow[]>([]);
  const [selected, setSelected] = useState<AssetSearchRow | null>(null);
  const [roleOnProject, setRoleOnProject] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim() });
        const response = await authFetch(`/assets?${params.toString()}`);
        if (!response.ok) return;
        const body = await response.json();
        const items = (body.items ?? body ?? []) as AssetSearchRow[];
        if (!cancelled) setResults(items);
      } catch {
        // ignore search errors
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [authFetch, query]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        type: "ASSET",
        assetId: selected.id,
        startDate
      };
      if (roleOnProject.trim()) body.roleOnProject = roleOnProject.trim();
      if (endDate) body.endDate = endDate;
      if (notes.trim()) body.notes = notes.trim();

      const response = await authFetch(`/projects/${projectId}/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      onAllocated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", display: "grid", placeItems: "center", zIndex: 100 }}
      onClick={onClose}
    >
      <div
        className="s7-card"
        style={{ width: "min(520px, 92vw)", padding: 24, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="s7-type-section-title" style={{ margin: 0 }}>Allocate asset</h2>

        {!selected ? (
          <>
            <p style={{ color: "var(--text-muted)", margin: "8px 0" }}>Search by name or asset number.</p>
            <input
              className="s7-input"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              style={{ width: "100%" }}
            />
            <ul style={{ listStyle: "none", padding: 0, marginTop: 12, maxHeight: 260, overflowY: "auto" }}>
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost"
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px" }}
                    onClick={() => setSelected(r)}
                  >
                    <strong>{r.name}</strong>
                    <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                      · {r.assetCode}
                      {r.category ? ` · ${r.category.name}` : ""}
                    </span>
                  </button>
                </li>
              ))}
              {query && results.length === 0 ? (
                <li style={{ color: "var(--text-muted)", padding: 12 }}>No matches.</li>
              ) : null}
            </ul>
          </>
        ) : (
          <>
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#F1EFE8", borderRadius: 6 }}>
              Selected: <strong>{selected.name}</strong> <span style={{ color: "var(--text-muted)" }}>· {selected.assetCode}</span>
              <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => setSelected(null)} style={{ marginLeft: 12 }}>
                Change
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label>
                <span className="s7-type-label">Role on project</span>
                <input
                  className="s7-input"
                  placeholder='e.g. "Excavator", "Water Cart"'
                  value={roleOnProject}
                  onChange={(e) => setRoleOnProject(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <span className="s7-type-label">Start date*</span>
                  <input type="date" className="s7-input" required value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%" }} />
                </label>
                <label>
                  <span className="s7-type-label">End date</span>
                  <input type="date" className="s7-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: "100%" }} />
                </label>
              </div>
              <label>
                <span className="s7-type-label">Notes</span>
                <textarea className="s7-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>

            {error ? (
              <div role="alert" style={{ background: "#FCEBEB", color: "#A32D2D", padding: "8px 12px", borderRadius: 6, marginTop: 12, fontSize: 13 }}>
                {error}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="s7-btn s7-btn--primary" onClick={() => void submit()} disabled={submitting}>
                {submitting ? "Allocating…" : "Allocate"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActivityTab({
  projectId,
  initial
}: {
  projectId: string;
  initial: ProjectDetail["activityLog"];
}) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadPage = async (nextPage: number) => {
    setLoading(true);
    try {
      const response = await authFetch(`/projects/${projectId}/activity?page=${nextPage}&limit=25`);
      if (!response.ok) return;
      const body = (await response.json()) as ActivityResponse;
      if (nextPage === 1) setItems(body.items);
      else setItems((prev) => [...prev, ...body.items]);
      setTotal(body.total);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage(1);
  }, [projectId]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="s7-card">
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Activity</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((entry) => {
          const isOpen = expanded.has(entry.id);
          return (
            <li key={entry.id} style={{ padding: 10, border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <strong>{ACTION_LABEL[entry.action] ?? entry.action}</strong>
                  <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>
                    by {fullName(entry.user)} · {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => toggle(entry.id)}>
                  {isOpen ? "Hide" : "Details"}
                </button>
              </div>
              {isOpen ? (
                <pre style={{ marginTop: 6, fontSize: 11, background: "var(--surface-subtle, rgba(0,0,0,0.03))", padding: 8, borderRadius: 4, overflow: "auto" }}>
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              ) : null}
            </li>
          );
        })}
      </ul>
      {total !== null && items.length < total ? (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            onClick={() => void loadPage(page + 1)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function GanttListView({
  projectId,
  tasks,
  canManage,
  onChanged
}: {
  projectId: string;
  tasks: GanttTask[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const { authFetch } = useAuth();
  if (tasks.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>No tasks yet.</p>;
  }
  const setProgress = async (id: string, value: number) => {
    if (!canManage) return;
    const r = await authFetch(`/projects/${projectId}/gantt/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ progress: value })
    });
    if (r.ok) onChanged();
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
          <tr>
            {["Task", "Discipline", "Start", "End", "Progress", "Assignee"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "6px 8px",
                  textAlign: "left",
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "var(--text-muted)"
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <td style={{ padding: "6px 8px" }}>
                <strong>{t.title}</strong>
              </td>
              <td style={{ padding: "6px 8px", fontSize: 12 }}>{t.discipline ?? "—"}</td>
              <td style={{ padding: "6px 8px", fontSize: 12 }}>{formatDate(t.startDate)}</td>
              <td style={{ padding: "6px 8px", fontSize: 12 }}>{formatDate(t.endDate)}</td>
              <td style={{ padding: "6px 8px", fontSize: 12 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={t.progress}
                  onChange={(e) => void setProgress(t.id, Number(e.target.value))}
                  disabled={!canManage}
                  style={{ width: 100 }}
                />
                <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>{t.progress}%</span>
              </td>
              <td style={{ padding: "6px 8px", fontSize: 12 }}>
                {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddGanttTaskModal({
  projectId,
  existingCount,
  onClose,
  onCreated
}: {
  projectId: string;
  existingCount: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { authFetch } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "",
    discipline: "" as string,
    startDate: today,
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    colour: "#005B61"
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setErr("Title required");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const r = await authFetch(`/projects/${projectId}/gantt`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          discipline: form.discipline || null,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          colour: form.colour,
          sortOrder: existingCount
        })
      });
      if (!r.ok) throw new Error(await r.text());
      onCreated();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1100,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="s7-card"
        style={{ padding: 20, width: "min(480px, 90vw)" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>New task</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 12, gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Title *</span>
            <input
              className="s7-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Discipline</span>
            <select
              className="s7-select"
              value={form.discipline}
              onChange={(e) => setForm({ ...form, discipline: e.target.value })}
            >
              <option value="">— none —</option>
              <option value="SO">Soft Strip</option>
              <option value="Str">Structural</option>
              <option value="Asb">Asbestos</option>
              <option value="Civ">Civil</option>
              <option value="Prv">Provisional</option>
            </select>
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Colour</span>
            <input
              type="color"
              value={form.colour}
              onChange={(e) => setForm({ ...form, colour: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Start *</span>
            <input
              type="date"
              className="s7-input"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>End *</span>
            <input
              type="date"
              className="s7-input"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </label>
        </div>
        {err ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{err}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
            {submitting ? "Saving…" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}
