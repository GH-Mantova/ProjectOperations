// NAV-3: read-only Tenders register at /crm/register.
// Lists every tender across every status with client + status columns +
// search / status / client filters. Reuses the loop-paginated fetch shipped
// with Tendering S1 so the register isn't capped at the API's 100-per-page
// ceiling. Row click opens the tender detail page (same target as the
// Tenders-page register view).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { fetchAllPages, type FiltersForQuery } from "../tendering/tenderingPage.helpers";
import {
  TENDER_STATUSES,
  TENDER_STATUS_LABEL,
  type TenderStatus
} from "../tendering/tenderStatusLabels";

type TenderRow = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  updatedAt: string;
  tenderClients: Array<{ id: string; clientId: string; client: { id: string; name: string } }>;
};

const EMPTY_FILTERS: FiltersForQuery = {
  search: "",
  status: [],
  estimatorId: null,
  clientId: null,
  probability: [],
  valueMin: "",
  valueMax: "",
  dueDateFrom: "",
  dueDateTo: "",
  discipline: [],
  sortBy: null,
  sortDir: "desc"
};

export function TendersRegisterPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAllPages<TenderRow>(authFetch, EMPTY_FILTERS);
        if (cancelled) return;
        setTenders(result.items);
        setTotal(result.total);
        setTruncated(result.truncated);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tenders) {
      for (const tc of t.tenderClients) map.set(tc.client.id, tc.client.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tenders]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tenders.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (clientFilter && !t.tenderClients.some((tc) => tc.client.id === clientFilter)) return false;
      if (needle) {
        const inTitle = t.title.toLowerCase().includes(needle);
        const inNumber = t.tenderNumber.toLowerCase().includes(needle);
        if (!inTitle && !inNumber) return false;
      }
      return true;
    });
  }, [tenders, search, statusFilter, clientFilter]);

  return (
    <div style={{ padding: "24px 32px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 className="s7-type-page-title" style={{ margin: 0 }}>Tenders register</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-muted, #666)", fontSize: 13 }}>
          Read-only view of every tender across all statuses.
        </p>
      </header>

      <div
        style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          type="search"
          placeholder="Search tender # or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search tenders"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            minWidth: 260,
            minHeight: 36
          }}
        />
        <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--text-muted, #666)" }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 36 }}
          >
            <option value="">All statuses</option>
            {TENDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TENDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--text-muted, #666)" }}>
          Client
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            aria-label="Filter by client"
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", minHeight: 36 }}
          >
            <option value="">All clients</option>
            {clients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted, #666)" }} aria-live="polite">
          {loading
            ? "Loading…"
            : `${filtered.length} of ${tenders.length} shown${truncated ? ` (of ${total} total)` : ""}`}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            color: "#dc2626",
            padding: 12,
            background: "#fef2f2",
            borderRadius: 6,
            marginBottom: 16
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="s7-table-scroll">
        <table className="s7-table">
          <thead>
            <tr>
              <th>Tender #</th>
              <th>Title</th>
              <th>Client</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td><Skeleton height={14} /></td>
                  <td><Skeleton height={14} /></td>
                  <td><Skeleton height={14} /></td>
                  <td><Skeleton height={14} /></td>
                  <td><Skeleton height={14} /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    heading="No tenders match these filters"
                    subtext="Adjust filters or clear them to see more results."
                  />
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const primaryClient = t.tenderClients[0]?.client.name ?? "—";
                const label = TENDER_STATUS_LABEL[t.status as TenderStatus] ?? t.status;
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tenders/${t.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{t.tenderNumber}</td>
                    <td>{t.title}</td>
                    <td>{primaryClient}</td>
                    <td>{label}</td>
                    <td>{new Date(t.updatedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
