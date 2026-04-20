import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type ProjectRow = {
  id: string;
  projectNumber: string;
  name: string;
  client: { id: string; name: string } | null;
  status: string;
  contractValue: string;
  proposedStartDate: string | null;
  projectManager: { id: string; firstName: string; lastName: string } | null;
  sourceTenderId: string | null;
};

type ListResponse = { items: ProjectRow[]; total: number; page: number; limit: number };

const STATUS_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "MOBILISING", label: "Mobilising" },
  { key: "ACTIVE", label: "Active" },
  { key: "PRACTICAL_COMPLETION", label: "Practical Completion" },
  { key: "DEFECTS", label: "Defects" },
  { key: "CLOSED", label: "Closed" }
];

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  MOBILISING: { bg: "#F1EFE8", fg: "#444441", label: "Mobilising" },
  ACTIVE: { bg: "color-mix(in srgb, #005B61 15%, transparent)", fg: "#005B61", label: "Active" },
  PRACTICAL_COMPLETION: { bg: "#FAEEDA", fg: "#854F0B", label: "Practical Completion" },
  DEFECTS: { bg: "#FCEBEB", fg: "#A32D2D", label: "Defects" },
  CLOSED: { bg: "#E2E8F0", fg: "#1F2937", label: "Closed" }
};

function formatCurrency(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function ProjectsListPage() {
  const { authFetch } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusFilter = params.get("status") ?? "";
  const search = params.get("search") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (statusFilter) query.set("status", statusFilter);
      if (search) query.set("search", search);
      const response = await authFetch(`/projects?${query.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      setData((await response.json()) as ListResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = (key: string) => {
    const next = new URLSearchParams(params);
    if (key) next.set("status", key);
    else next.delete("status");
    setParams(next, { replace: true });
  };

  const searchBox = useMemo(
    () => (
      <input
        className="s7-input"
        placeholder="Search project number or name…"
        defaultValue={search}
        style={{ maxWidth: 320 }}
        onBlur={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value.trim()) next.set("search", e.target.value.trim());
          else next.delete("search");
          setParams(next, { replace: true });
        }}
      />
    ),
    [params, search, setParams]
  );

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">Delivery</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Projects</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Active and historical delivery records converted from awarded tenders.
          </p>
        </div>
        {searchBox}
      </header>

      <nav className="admin-page__tabs" role="tablist" aria-label="Status filter">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.key || "all"}
            type="button"
            role="tab"
            aria-selected={statusFilter === opt.key}
            className={statusFilter === opt.key ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
            onClick={() => setStatus(opt.key)}
          >
            {opt.label}
            {data && opt.key ? (
              <span style={{ marginLeft: 6, color: "var(--text-muted)", fontSize: 12 }}>
                ({data.items.filter((r) => r.status === opt.key).length})
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="s7-card"><Skeleton width="100%" height={220} /></div>
      ) : !data || data.items.length === 0 ? (
        <div className="s7-card">
          <EmptyState
            heading="No projects yet"
            subtext={
              statusFilter
                ? `No ${STATUS_STYLE[statusFilter]?.label.toLowerCase() ?? statusFilter} projects.`
                : "Convert an AWARDED tender to create your first project."
            }
          />
        </div>
      ) : (
        <section className="s7-card">
          <table className="admin-page__table">
            <thead>
              <tr>
                <th>Project #</th>
                <th>Name</th>
                <th>Client</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Contract Value</th>
                <th>Proposed Start</th>
                <th>PM</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const statusStyle = STATUS_STYLE[row.status] ?? STATUS_STYLE.MOBILISING;
                return (
                  <tr key={row.id} style={{ cursor: "pointer" }}>
                    <td>
                      <Link to={`/projects/${row.id}`} style={{ color: "var(--brand-accent, #FEAA6D)", fontWeight: 500 }}>
                        {row.projectNumber}
                      </Link>
                      {row.sourceTenderId ? (
                        <Link
                          to={`/tenders/${row.sourceTenderId}`}
                          style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)" }}
                          title="View source tender"
                        >
                          (tender)
                        </Link>
                      ) : null}
                    </td>
                    <td>
                      <Link to={`/projects/${row.id}`} style={{ color: "inherit" }}>{row.name}</Link>
                    </td>
                    <td>{row.client?.name ?? "—"}</td>
                    <td>
                      <span className="type-badge" style={{ background: statusStyle.bg, color: statusStyle.fg }}>
                        {statusStyle.label}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatCurrency(row.contractValue)}
                    </td>
                    <td>{formatDate(row.proposedStartDate)}</td>
                    <td>
                      {row.projectManager
                        ? `${row.projectManager.firstName} ${row.projectManager.lastName}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
            {data.total} project{data.total === 1 ? "" : "s"}
            {statusFilter ? ` · filtered by ${STATUS_STYLE[statusFilter]?.label ?? statusFilter}` : ""}
          </p>
        </section>
      )}
    </div>
  );
}
