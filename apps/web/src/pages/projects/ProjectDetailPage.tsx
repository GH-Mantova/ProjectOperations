import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { AdvanceStatusModal } from "./AdvanceStatusModal";

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
  DOCUMENT_REMOVED: "Document removed"
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
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="s7-card" style={{ padding: 32, textAlign: "center" }}>
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>📅 Gantt view coming in PR #41</h3>
        <p style={{ color: "var(--text-muted)" }}>
          Milestone-level scheduling and activity planning are on the next delivery PR.
        </p>
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

function TeamTab({ project: _project }: { project: ProjectDetail }) {
  return (
    <section className="s7-card" style={{ padding: 32, textAlign: "center" }}>
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>👥 Resource allocation coming in PR #40</h3>
      <p style={{ color: "var(--text-muted)" }}>
        Worker assignments, crew rosters, and shift planning will surface here.
      </p>
    </section>
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
