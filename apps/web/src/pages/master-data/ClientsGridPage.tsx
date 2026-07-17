import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { DataGrid } from "../../components/data-grid/DataGrid";
import type { DataGridColumn } from "../../components/data-grid/dataGridModel";

type Client = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  [key: string]: unknown;
};

type ListResponse<T> = { items: T[]; total: number };

const columns: DataGridColumn<Client>[] = [
  { key: "name", label: "Name", kind: "text", editable: true, minWidth: 200 },
  { key: "code", label: "Code", kind: "text", editable: true, minWidth: 120 },
  { key: "status", label: "Status", kind: "text", editable: true, minWidth: 120 },
  { key: "email", label: "Email", kind: "text", editable: true, minWidth: 200 },
  { key: "phone", label: "Phone", kind: "text", editable: true, minWidth: 140 },
  { key: "notes", label: "Notes", kind: "text", editable: true, minWidth: 200 }
];

/**
 * Reference implementation of the personalisable data grid — Clients list
 * with saved views, hide/reorder columns, and inline cell edit. Drops in
 * anywhere the same shape is available; other list pages can adopt the
 * same <DataGrid /> without inventing anything grid-specific.
 */
export function ClientsGridPage() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/master-data/clients?page=1&pageSize=200");
      if (!response.ok) throw new Error("Could not load clients.");
      const data = (await response.json()) as ListResponse<Client>;
      setRows(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSave = useCallback(
    async (row: Client, key: string, value: string) => {
      const patch = { [key]: value === "" ? null : value };
      const response = await authFetch(`/master-data/clients/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!response.ok) throw new Error("Could not save change.");
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, [key]: value === "" ? null : value } : r))
      );
    },
    [authFetch]
  );

  return (
    <div className="mdata-page">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Data · Grid view</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>
            Clients grid
          </h1>
          <p className="s7-type-body" style={{ color: "var(--text-muted, #64748b)", marginTop: 4 }}>
            Personalise columns, save views, and edit inline. Double-click a cell to edit.
          </p>
        </div>
        <div>
          <Link to="/master-data" className="s7-btn s7-btn--ghost s7-btn--sm">
            ← Master data hub
          </Link>
        </div>
      </header>

      {error ? (
        <div className="tender-page__error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 16 }}>Loading…</div>
      ) : (
        <DataGrid
          entityType="Client"
          columns={columns}
          rows={rows}
          rowId={(r) => r.id}
          inlineEdit={{ onSave }}
          testIdPrefix="clients-grid"
          emptyState="No clients match the current filters."
        />
      )}
    </div>
  );
}
