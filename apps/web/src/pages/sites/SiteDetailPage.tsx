import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { SiteFormModal, type SiteFormClientOption } from "./SiteFormModal";
import {
  formatSiteAddress,
  formatSiteDate,
  projectStatusBadgeClass,
  tenderStatusBadgeClass
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

export function SiteDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [detail, setDetail] = useState<SiteDetail | null>(null);
  const [clients, setClients] = useState<SiteFormClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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

  // Render the error banner whenever an error occurred — do NOT gate on
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
          {detail.createdAt ? (
            <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 12 }}>
              Created {formatSiteDate(detail.createdAt)}
            </p>
          ) : null}
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
        </div>
      </header>

      {detail.notes ? (
        <section className="s7-card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 className="s7-type-section-heading" style={{ margin: "0 0 8px" }}>Access notes / hazards</h3>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13 }}>{detail.notes}</p>
        </section>
      ) : null}

      <section className="s7-card" style={{ padding: 16, marginBottom: 16 }}>
        <header style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Linked tenders</h3>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{detail.tenders.length}</span>
        </header>
        {detail.tenders.length === 0 ? (
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
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tenders/${t.id}`)}
                    style={ROW_STYLE}
                  >
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

      <section className="s7-card" style={{ padding: 16 }}>
        <header style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Linked projects</h3>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{detail.projects.length}</span>
        </header>
        {detail.projects.length === 0 ? (
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
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    style={ROW_STYLE}
                  >
                    <td style={{ ...CELL_STYLE, fontWeight: 600 }}>{p.projectNumber}</td>
                    <td style={CELL_STYLE}>{p.name}</td>
                    <td style={CELL_STYLE}>
                      <span className={projectStatusBadgeClass(p.status)}>{p.status.replace(/_/g, " ")}</span>
                    </td>
                    <td style={{ ...CELL_STYLE, color: "var(--text-muted)" }}>{formatSiteDate(p.plannedStartDate)}</td>
                    <td style={{ ...CELL_STYLE, textAlign: "right", color: "var(--text-muted)" }}>→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
