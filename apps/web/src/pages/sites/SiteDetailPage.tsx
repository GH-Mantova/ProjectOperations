import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CenteredModal, KpiCard } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { SiteFormModal, type SiteFormClientOption } from "./SiteFormModal";
import { SiteHeadcountWidget } from "./SiteHeadcountWidget";
import {
  formatKpiCount,
  formatSiteAddress,
  formatSiteDate,
  projectStatusBadgeClass,
  resolveSiteTab,
  tenderStatusBadgeClass,
  type SiteTab
} from "./site-detail-helpers";

type ClientLite = { id: string; name: string };

type LinkedTender = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  dueDate: string | null;
};

type LinkedProject = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  plannedStartDate: string | null;
};

export type SiteDetail = {
  id: string;
  clientId: string | null;
  client: ClientLite | null;
  name: string;
  code: string | null;
  addressLine1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  tenders: LinkedTender[];
  projects: LinkedProject[];
};

type SiteDocument = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  versionLabel?: string | null;
  fileLink?: { name: string; webUrl: string } | null;
  linkedEntityId?: string | null;
};

type SiteDocumentsResponse = {
  items: SiteDocument[];
  total: number;
  skip: number;
  take: number;
};

const ROW_STYLE: React.CSSProperties = {
  borderTop: "1px solid var(--border-default, #e5e7eb)",
  cursor: "pointer"
};

const CELL_STYLE: React.CSSProperties = { padding: "10px 8px", fontSize: 13, minHeight: 44 };

const HEADER_CELL_STYLE: React.CSSProperties = {
  padding: "8px",
  textAlign: "left",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-muted, #6B7280)",
  fontWeight: 500
};

const TAB_DEFS: ReadonlyArray<[SiteTab, string]> = [
  ["overview", "Overview"],
  ["tenders", "Tenders"],
  ["projects", "Projects"],
  ["documents", "Documents"]
];

function SkeletonBlock({ height, width = "100%" }: { height: number; width?: number | string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        width,
        background: "var(--surface-muted, #f3f4f6)",
        borderRadius: 6,
        animation: "pulse 1.4s ease-in-out infinite"
      }}
    />
  );
}

function SiteDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading site" style={{ padding: 20, display: "grid", gap: 16 }}>
      <SkeletonBlock height={28} width={280} />
      <SkeletonBlock height={16} width={420} />
      <div className="s7-card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <SkeletonBlock height={18} width={160} />
        <SkeletonBlock height={14} />
        <SkeletonBlock height={14} width="80%" />
      </div>
      <div className="s7-card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <SkeletonBlock height={18} width={180} />
        <SkeletonBlock height={14} />
        <SkeletonBlock height={14} />
      </div>
    </div>
  );
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.round(diffMs / day);
  if (days <= 0) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function SiteDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveSiteTab(searchParams.get("tab"));

  const [detail, setDetail] = useState<SiteDetail | null>(null);
  const [clients, setClients] = useState<SiteFormClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [docs, setDocs] = useState<SiteDocumentsResponse | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const setTab = useCallback(
    (next: SiteTab) => {
      const params = new URLSearchParams(searchParams);
      if (next === "overview") params.delete("tab");
      else params.set("tab", next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    // Clear stale detail at the start of every load — without this, a failed
    // refetch (e.g. navigating from site A to site B and B errors) would
    // leave site A's data on screen while the URL says B. Per Codex review
    // on PR #288.
    setDetail(null);
    try {
      const response = await authFetch(`/master-data/sites/${id}`);
      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as SiteDetail | null;
      if (!body) {
        setNotFound(true);
        return;
      }
      setDetail(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void authFetch("/master-data/clients?limit=200").then(async (r) => {
      if (!r.ok || cancelled) return;
      const body = (await r.json()) as { items: SiteFormClientOption[] };
      if (!cancelled) setClients(body.items);
    });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Lazy-load the documents rollup once the user opens the Documents tab.
  // Refetches when site changes; cached across tab toggles within the
  // same site so flipping tabs back and forth doesn't re-hit the API.
  useEffect(() => {
    if (!id) return;
    if (docs !== null) return;
    let cancelled = false;
    setDocsError(null);
    void (async () => {
      try {
        const response = await authFetch(`/documents/sites/${id}/documents`);
        if (!response.ok) {
          if (!cancelled) setDocsError("Couldn’t load documents for this site.");
          return;
        }
        const body = (await response.json()) as SiteDocumentsResponse;
        if (!cancelled) setDocs(body);
      } catch (err) {
        if (!cancelled) setDocsError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, id, docs]);

  // Reset cached docs when the site id changes — otherwise navigating
  // from one site to another would render the previous site's rollup.
  useEffect(() => {
    setDocs(null);
    setDocsError(null);
  }, [id]);

  const handleDelete = useCallback(async () => {
    if (!detail) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await authFetch(`/master-data/sites/${detail.id}`, {
        method: "DELETE"
      });
      if (response.status === 204) {
        setConfirmingDelete(false);
        navigate("/sites", { state: { toast: "Site deleted" } });
        return;
      }
      if (response.status === 404) {
        setConfirmingDelete(false);
        setToast("Site not found");
        navigate("/sites");
        return;
      }
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setDeleteError(
          body?.message ??
            "This site can’t be deleted while tenders or projects are linked to it."
        );
        return;
      }
      setDeleteError("Couldn’t delete site. Please try again.");
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }, [authFetch, detail, navigate]);

  if (loading) {
    return <SiteDetailSkeleton />;
  }

  if (notFound) {
    return (
      <div style={{ padding: 20, display: "grid", gap: 12, maxWidth: 560 }}>
        <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Site not found</h2>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          This site doesn’t exist or has been removed. It may have been merged into another site.
        </p>
        <div>
          <Link to="/sites" className="s7-btn s7-btn--primary s7-btn--sm">← Back to sites</Link>
        </div>
      </div>
    );
  }

  // Renders the error banner whenever an error occurred — do NOT gate on
  // `!detail`. With the `setDetail(null)` at the start of `load` the
  // condition is equivalent in steady state, but dropping the gate is
  // defence-in-depth against future refetch paths that forget to clear
  // detail. Per Codex review on PR #288.
  if (error) {
    return (
      <div style={{ padding: 20, display: "grid", gap: 12, maxWidth: 560 }}>
        <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Couldn’t load site</h2>
        <p style={{ color: "var(--status-danger)", margin: 0 }}>{error}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => void load()}>
            Retry
          </button>
          <Link to="/sites" className="s7-btn s7-btn--ghost s7-btn--sm">← Back to sites</Link>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const address = formatSiteAddress(detail);
  const tendersCount = detail.tenders.length;
  const projectsCount = detail.projects.length;
  const documentsCount = docs?.total ?? null;
  const projectNameById = new Map(detail.projects.map((p) => [p.id, p] as const));

  return (
    <div style={{ padding: 20 }}>
      <nav style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => navigate("/sites")}
          style={{ minHeight: 44, minWidth: 44 }}
        >
          ← Back to sites
        </button>
      </nav>

      {toast ? (
        <div className="s7-card" role="status" style={{ padding: 12, marginBottom: 12 }}>
          {toast}
        </div>
      ) : null}

      <header
        className="s7-card"
        style={{
          padding: 20,
          marginBottom: 16,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start"
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="s7-type-page-heading" style={{ margin: 0 }}>{detail.name}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
            {detail.client ? (
              <span className="s7-badge s7-badge--info">{detail.client.name}</span>
            ) : (
              <span className="s7-badge s7-badge--neutral">No client</span>
            )}
            {detail.code ? <span className="s7-badge s7-badge--neutral">Code · {detail.code}</span> : null}
          </div>
          <p
            style={{
              color: "var(--text-muted)",
              margin: "10px 0 0",
              fontSize: 13
            }}
          >
            {address}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => setEditing(true)}
            style={{ minHeight: 44 }}
          >
            Edit site
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
            style={{ minHeight: 44, color: "var(--status-danger)" }}
            data-testid="site-detail-delete"
          >
            Delete site
          </button>
        </div>
      </header>

      <section
        aria-label="Site KPIs"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16
        }}
      >
        <KpiCard label="Linked tenders" value={formatKpiCount(tendersCount)} />
        <KpiCard label="Linked projects" value={formatKpiCount(projectsCount)} />
        <KpiCard
          label="Documents"
          value={documentsCount === null ? "—" : formatKpiCount(documentsCount)}
        />
        <KpiCard
          label="Created"
          value={formatRelativeDate(detail.createdAt)}
          trendValue={detail.createdAt ? formatSiteDate(detail.createdAt) : undefined}
        />
      </section>

      <nav className="tender-detail__tabs" role="tablist" style={{ marginBottom: 16 }}>
        {TAB_DEFS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => setTab(key)}
          >
            {label}
            {key === "tenders" ? ` (${tendersCount})` : ""}
            {key === "projects" ? ` (${projectsCount})` : ""}
            {key === "documents" && documentsCount !== null ? ` (${documentsCount})` : ""}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <>
          {/* Live on-site headcount + muster starter */}
          <SiteHeadcountWidget siteId={detail.id} />

          {detail.notes ? (
            <section className="s7-card" style={{ padding: 16, marginBottom: 16, marginTop: 16 }}>
              <h3 className="s7-type-section-heading" style={{ margin: "0 0 8px" }}>
                Access notes / hazards
              </h3>
              <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13 }}>{detail.notes}</p>
            </section>
          ) : null}
          <section className="s7-card" style={{ padding: 16, marginTop: detail.notes ? 0 : 16 }}>
            <h3 className="s7-type-section-heading" style={{ margin: "0 0 8px" }}>Summary</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Site at {address} with {projectsCount}{" "}
              {projectsCount === 1 ? "project" : "projects"} and {tendersCount}{" "}
              {tendersCount === 1 ? "tender" : "tenders"} in pipeline.
            </p>
            {detail.createdAt ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Created {formatSiteDate(detail.createdAt)}.
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      {tab === "tenders" ? (
        <section className="s7-card" style={{ padding: 16 }}>
          <header style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Linked tenders</h3>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{tendersCount}</span>
          </header>
          {tendersCount === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
              No tenders linked to this site yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={HEADER_CELL_STYLE}>Tender #</th>
                    <th style={HEADER_CELL_STYLE}>Title</th>
                    <th style={HEADER_CELL_STYLE}>Status</th>
                    <th style={HEADER_CELL_STYLE}>Due date</th>
                    <th style={HEADER_CELL_STYLE} aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {detail.tenders.map((t) => (
                    <tr key={t.id} onClick={() => navigate(`/tenders/${t.id}`)} style={ROW_STYLE}>
                      <td style={{ ...CELL_STYLE, fontWeight: 600 }}>{t.tenderNumber}</td>
                      <td style={CELL_STYLE}>{t.title}</td>
                      <td style={CELL_STYLE}>
                        <span className={tenderStatusBadgeClass(t.status)}>{t.status.replace(/_/g, " ")}</span>
                      </td>
                      <td style={{ ...CELL_STYLE, color: "var(--text-muted)" }}>{formatSiteDate(t.dueDate)}</td>
                      <td style={{ ...CELL_STYLE, textAlign: "right", color: "var(--text-muted)" }}>→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "projects" ? (
        <section className="s7-card" style={{ padding: 16 }}>
          <header style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Linked projects</h3>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{projectsCount}</span>
          </header>
          {projectsCount === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
              No projects linked to this site yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={HEADER_CELL_STYLE}>Project #</th>
                    <th style={HEADER_CELL_STYLE}>Name</th>
                    <th style={HEADER_CELL_STYLE}>Status</th>
                    <th style={HEADER_CELL_STYLE}>Planned start</th>
                    <th style={HEADER_CELL_STYLE} aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {detail.projects.map((p) => (
                    <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} style={ROW_STYLE}>
                      <td style={{ ...CELL_STYLE, fontWeight: 600 }}>{p.projectNumber}</td>
                      <td style={CELL_STYLE}>{p.name}</td>
                      <td style={CELL_STYLE}>
                        <span className={projectStatusBadgeClass(p.status)}>{p.status.replace(/_/g, " ")}</span>
                      </td>
                      <td style={{ ...CELL_STYLE, color: "var(--text-muted)" }}>
                        {formatSiteDate(p.plannedStartDate)}
                      </td>
                      <td style={{ ...CELL_STYLE, textAlign: "right", color: "var(--text-muted)" }}>→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "documents" ? (
        <section className="s7-card" style={{ padding: 16 }}>
          <header style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Documents</h3>
            {docs ? (
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{docs.total}</span>
            ) : null}
          </header>
          {docsError ? (
            <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{docsError}</p>
          ) : docs === null ? (
            <SkeletonBlock height={48} />
          ) : docs.items.length === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
              No documents have been uploaded to projects on this site yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {docs.items.map((doc) => {
                const parent = doc.linkedEntityId ? projectNameById.get(doc.linkedEntityId) ?? null : null;
                return (
                  <li
                    key={doc.id}
                    style={{
                      padding: "10px 0",
                      borderTop: "1px solid var(--border-default, #e5e7eb)",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      minHeight: 44
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {doc.category}
                        {doc.versionLabel ? ` · ${doc.versionLabel}` : ""}
                        {parent ? ` · ${parent.projectNumber} ${parent.name}` : ""}
                      </div>
                    </div>
                    {doc.fileLink ? (
                      <a
                        href={doc.fileLink.webUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="s7-btn s7-btn--secondary s7-btn--sm"
                      >
                        Open
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {confirmingDelete ? (
        <CenteredModal
          title="Delete site?"
          subtitle={`${detail.name} will be permanently removed. This can't be undone.`}
          onClose={() => {
            if (!deleting) setConfirmingDelete(false);
          }}
          busy={deleting}
          dataTestId="site-detail-delete-modal"
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--danger"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete site"}
              </button>
            </>
          }
        >
          {deleteError ? (
            <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{deleteError}</p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Linked tenders or projects will block deletion.
            </p>
          )}
        </CenteredModal>
      ) : null}

      {editing ? (
        <SiteFormModal
          clients={clients}
          existing={detail}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
