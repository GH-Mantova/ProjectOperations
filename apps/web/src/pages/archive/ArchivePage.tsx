import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type ArchiveItem = {
  id: string;
  jobNumber: string;
  name: string;
  clientName: string;
  closedAt: string | null;
  archivedAt: string | null;
  status: string;
};

type ArchiveListResponse = {
  items: ArchiveItem[];
  total: number;
  page: number;
  pageSize: number;
};

type ClientOption = { id: string; name: string };

type StatusFilter = "ALL" | "CLOSED" | "ARCHIVED";

const PAGE_SIZE = 20;

export function ArchivePage() {
  const { authFetch } = useAuth();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const response = await authFetch("/master-data/clients?page=1&pageSize=100");
        if (response.ok) {
          const data = await response.json();
          setClients((data.items ?? []).map((client: ClientOption) => ({ id: client.id, name: client.name })));
        }
      } catch (err) {
        // Non-fatal: dropdown just remains empty.
        console.warn("Failed to load clients for archive filter", err);
      }
    })();
  }, [authFetch]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (clientId) params.set("clientId", clientId);
        if (year) params.set("year", String(year));
        if (status !== "ALL") params.set("status", status);
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));

        const response = await authFetch(`/archive?${params.toString()}`);
        if (!response.ok) throw new Error("Unable to load archive.");
        const data: ArchiveListResponse = await response.json();
        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch, search, clientId, year, status, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const yearOptions = useMemo(() => {
    const now = new Date().getUTCFullYear();
    return Array.from({ length: 6 }, (_, index) => now - index);
  }, []);

  const exportCsv = () => {
    const header = ["Job #", "Name", "Client", "Closed", "Archived", "Status"];
    const rows = items.map((item) => [
      item.jobNumber,
      item.name,
      item.clientName,
      item.closedAt ?? "",
      item.archivedAt ?? "",
      item.status
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `archive-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <AppCard
      title="Archive"
      subtitle="Read-only register of closed and archived jobs"
      actions={
        <button type="button" onClick={exportCsv} style={{ minHeight: 44, padding: "8px 16px" }}>
          Export CSV
        </button>
      }
    >
      <div className="compact-filter-grid compact-filter-grid--four" style={{ marginBottom: 16 }}>
        <label>
          Search
          <input
            placeholder="Job #, name, or client"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
        </label>
        <label>
          Client
          <select
            value={clientId}
            onChange={(event) => {
              setPage(1);
              setClientId(event.target.value);
            }}
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <select
            value={year === "" ? "" : String(year)}
            onChange={(event) => {
              setPage(1);
              setYear(event.target.value === "" ? "" : Number(event.target.value));
            }}
          >
            <option value="">All years</option>
            {yearOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as StatusFilter);
            }}
          >
            <option value="ALL">All</option>
            <option value="CLOSED">Closed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <table className="data-table">
        <thead>
          <tr>
            <th>Job #</th>
            <th>Name</th>
            <th>Client</th>
            <th>Closed</th>
            <th>Status</th>
            <th aria-label="View" />
          </tr>
        </thead>
        <tbody>
          {loading && items.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted-text">
                Loading archive...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted-text">
                No archived jobs match the current filters.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>{item.jobNumber}</td>
                <td>{item.name}</td>
                <td>{item.clientName}</td>
                <td>
                  {item.closedAt
                    ? new Date(item.closedAt).toLocaleDateString()
                    : item.archivedAt
                    ? new Date(item.archivedAt).toLocaleDateString()
                    : "—"}
                </td>
                <td>
                  <span className="pill pill--amber">{item.status}</span>
                </td>
                <td>
                  <Link to={`/archive/${item.id}`} style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                    View
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {total > PAGE_SIZE ? (
        <div className="pagination" style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </button>
          <span className="muted-text">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </AppCard>
  );
}
