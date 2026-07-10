import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { EmptyState, SkeletonList } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import {
  blankRowCells,
  consumerTypeLabel,
  groupBindings,
  validateColumnStructure,
  validateRowCells,
  whereUsedBlockerMessage,
  type ListBinding,
  type ListBindingConsumerType,
  type RateColumn,
  type RateColumnDataType,
  type RateColumnRole,
  type RateRow
} from "./ratesListsHelpers";

// ── Types coming off the API ─────────────────────────────────────────────

type RateTableCategory = "INITIAL_SERVICES" | "SUBCONTRACTOR";

type RateTableSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: RateTableCategory;
  subcontractorType: string | null;
  supplierId: string | null;
  isSystem: boolean;
  isReference: boolean;
  columns: RateColumn[];
};

type RateTableFull = RateTableSummary & { rows: RateRow[] };

type ListSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "STATIC" | "DYNAMIC";
  sourceModule: string | null;
  isSystem: boolean;
  itemCount: number | null;
};

type ListItem = {
  id: string;
  value: string;
  label: string;
  metadata: unknown;
  sortOrder: number;
  isArchived: boolean;
};

type ResolvedList = ListSummary & { items: ListItem[] };

type WhereUsed = {
  listId: string;
  listSlug: string;
  count: number;
  bindings: ListBinding[];
};

// ── Top-level page ───────────────────────────────────────────────────────

type TopTab = "rates" | "lists";

export function RatesListsAdminPage() {
  const { user } = useAuth();
  const canManageRates = user?.permissions.includes("rates.manage") ?? false;
  const canManageLists = user?.permissions.includes("lists.manage") ?? false;

  const [tab, setTab] = useState<TopTab>(canManageRates ? "rates" : "lists");

  if (!user) return null;
  if (!canManageRates && !canManageLists) return <Navigate to="/" replace />;

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>
        Rates &amp; Lists
      </h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        Flexible rate tables (typed columns, KEY / VALUE / INFO roles) and the reference-data lists
        that feed dropdowns across the ERP.
      </p>

      <div
        role="tablist"
        aria-label="Rates and Lists"
        style={{ display: "flex", gap: 4, marginTop: 20, borderBottom: "1px solid var(--border, #e5e7eb)" }}
      >
        {canManageRates ? (
          <TopTabButton active={tab === "rates"} onClick={() => setTab("rates")}>
            Rate tables
          </TopTabButton>
        ) : null}
        {canManageLists ? (
          <TopTabButton active={tab === "lists"} onClick={() => setTab("lists")}>
            Lists
          </TopTabButton>
        ) : null}
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === "rates" && canManageRates ? <RateTablesPanel /> : null}
        {tab === "lists" && canManageLists ? <ListsPanel /> : null}
      </div>
    </div>
  );
}

function TopTabButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: "0 20px",
        background: "transparent",
        border: "none",
        borderBottom: active ? "3px solid var(--brand-primary, #005B61)" : "3px solid transparent",
        color: active ? "var(--brand-primary, #005B61)" : "var(--text)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        fontSize: 14
      }}
    >
      {children}
    </button>
  );
}

// ── Rate tables panel ────────────────────────────────────────────────────

function RateTablesPanel() {
  const { authFetch } = useAuth();
  const [tables, setTables] = useState<RateTableSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<RateTableFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTableOpen, setNewTableOpen] = useState(false);

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/rates/tables");
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load rate tables."));
      const body = (await res.json()) as RateTableSummary[];
      setTables(body);
      if (!selectedId && body.length > 0) setSelectedId(body[0].id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, selectedId]);

  const loadSelected = useCallback(
    async (id: string) => {
      setLoadingSelected(true);
      try {
        const res = await authFetch(`/rates/tables/${id}`);
        if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load rate table."));
        setSelected((await res.json()) as RateTableFull);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingSelected(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (selectedId) void loadSelected(selectedId);
  }, [selectedId, loadSelected]);

  const handleCreateTable = async (payload: {
    name: string;
    slug: string;
    category: RateTableCategory;
    description?: string;
  }) => {
    const res = await authFetch("/rates/tables", { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await readApiErrorMessage(res, "Create failed."));
    const created = (await res.json()) as RateTableSummary;
    setNewTableOpen(false);
    setSelectedId(created.id);
    await loadTables();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
      <aside className="s7-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Tables</strong>
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => setNewTableOpen(true)}
            style={{ minHeight: 32 }}
          >
            + New
          </button>
        </div>
        {loading ? (
          <SkeletonList count={5} rowHeight={20} />
        ) : tables.length === 0 ? (
          <EmptyState
            icon="📋"
            heading="No rate tables yet"
            subtext="Create your first flexible rate table."
          />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {tables.map((t) => {
              const active = t.id === selectedId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      minHeight: 44,
                      padding: "8px 10px",
                      border: "none",
                      borderRadius: 6,
                      background: active ? "rgba(0,91,97,0.08)" : "transparent",
                      color: active ? "var(--brand-primary, #005B61)" : "var(--text)",
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{t.name}</span>
                      {t.isReference ? <ReferenceBadge /> : null}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {t.category === "SUBCONTRACTOR" ? "Sub / supplier" : "Initial Services"} · {t.slug}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section>
        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
        {loadingSelected ? (
          <SkeletonList count={4} rowHeight={24} />
        ) : selected ? (
          <RateTableDetail
            table={selected}
            onChanged={async () => {
              await loadSelected(selected.id);
              await loadTables();
            }}
          />
        ) : (
          <EmptyState
            icon="👈"
            heading="Pick a rate table"
            subtext="Or create one from the sidebar."
          />
        )}
      </section>

      {newTableOpen ? (
        <NewRateTableModal onClose={() => setNewTableOpen(false)} onSubmit={handleCreateTable} />
      ) : null}
    </div>
  );
}

// ── Rate table detail ────────────────────────────────────────────────────

function RateTableDetail({ table, onChanged }: { table: RateTableFull; onChanged: () => Promise<void> }) {
  const { authFetch } = useAuth();
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState<Record<string, unknown> | null>(null);

  const columnErrors = useMemo(() => validateColumnStructure(table.columns), [table.columns]);
  const rowErrors = useMemo(
    () => (rowDraft ? validateRowCells(table.columns, rowDraft) : []),
    [table.columns, rowDraft]
  );

  const handleAddColumn = async (col: {
    name: string;
    dataType: RateColumnDataType;
    role: RateColumnRole;
    unit?: string;
    listSlug?: string;
    required?: boolean;
  }) => {
    setPendingError(null);
    const res = await authFetch(`/rates/tables/${table.id}/columns`, {
      method: "POST",
      body: JSON.stringify(col)
    });
    if (!res.ok) {
      setPendingError(await readApiErrorMessage(res, "Add column failed."));
      return;
    }
    await onChanged();
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!window.confirm("Delete this column? Any values stored for it will be dropped.")) return;
    setPendingError(null);
    const res = await authFetch(`/rates/tables/${table.id}/columns/${columnId}`, { method: "DELETE" });
    if (!res.ok) {
      setPendingError(await readApiErrorMessage(res, "Delete column failed."));
      return;
    }
    await onChanged();
  };

  const startAddRow = () => setRowDraft(blankRowCells(table.columns));
  const cancelAddRow = () => setRowDraft(null);

  const commitRow = async () => {
    if (!rowDraft) return;
    setPendingError(null);
    const res = await authFetch(`/rates/tables/${table.id}/rows`, {
      method: "POST",
      body: JSON.stringify({ cells: rowDraft })
    });
    if (!res.ok) {
      setPendingError(await readApiErrorMessage(res, "Add row failed."));
      return;
    }
    setRowDraft(null);
    await onChanged();
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!window.confirm("Deactivate this row? It is soft-deleted; snapshots keep resolving.")) return;
    setPendingError(null);
    const res = await authFetch(`/rates/tables/${table.id}/rows/${rowId}`, { method: "DELETE" });
    if (!res.ok) {
      setPendingError(await readApiErrorMessage(res, "Delete row failed."));
      return;
    }
    await onChanged();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="s7-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2
              className="s7-type-section-heading"
              style={{ marginTop: 0, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}
            >
              <span>{table.name}</span>
              {table.isReference ? <ReferenceBadge /> : null}
            </h2>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              slug <code>{table.slug}</code> ·{" "}
              {table.category === "SUBCONTRACTOR" ? "Subcontractor / supplier" : "Initial Services"}
              {table.subcontractorType ? ` · ${table.subcontractorType}` : ""}
              {table.isSystem ? " · system" : ""}
              {table.isReference ? " · reference (excluded from tender pricing)" : ""}
            </div>
            {table.description ? (
              <p style={{ marginTop: 8, color: "var(--text-muted)" }}>{table.description}</p>
            ) : null}
          </div>
        </div>

        {columnErrors.length > 0 ? (
          <ValidationBanner
            title="Structure issues"
            hint="Fix these before adding rows — the server will reject writes until the structure is valid."
            items={columnErrors}
          />
        ) : null}

        {pendingError ? <ErrorBanner message={pendingError} onDismiss={() => setPendingError(null)} /> : null}
      </div>

      <ColumnsCard columns={table.columns} onAdd={handleAddColumn} onDelete={handleDeleteColumn} />

      <RowsCard
        columns={table.columns}
        rows={table.rows}
        rowDraft={rowDraft}
        rowErrors={rowErrors}
        onStartAdd={startAddRow}
        onCancelAdd={cancelAddRow}
        onCommitAdd={commitRow}
        onChangeDraft={(next) => setRowDraft(next)}
        onDeleteRow={handleDeleteRow}
      />
    </div>
  );
}

function ColumnsCard({
  columns,
  onAdd,
  onDelete
}: {
  columns: RateColumn[];
  onAdd: (col: {
    name: string;
    dataType: RateColumnDataType;
    role: RateColumnRole;
    unit?: string;
    listSlug?: string;
    required?: boolean;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<RateColumnDataType>("TEXT");
  const [role, setRole] = useState<RateColumnRole>("KEY");
  const [unit, setUnit] = useState("");
  const [listSlug, setListSlug] = useState("");
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSave = name.trim().length > 0 && (role !== "VALUE" || unit.trim().length > 0) && (dataType !== "LIST_REF" || listSlug.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    try {
      await onAdd({
        name: name.trim(),
        dataType,
        role,
        unit: unit.trim() || undefined,
        listSlug: listSlug.trim() || undefined,
        required
      });
      setName("");
      setUnit("");
      setListSlug("");
      setRequired(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="s7-card">
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Columns</h3>
      {columns.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No columns yet — add KEY, VALUE, and INFO columns below.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)", color: "var(--text-muted)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Name</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Role</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Type</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Unit / list</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Req?</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                <td style={{ padding: "6px 8px" }}>{c.name}</td>
                <td style={{ padding: "6px 8px" }}>
                  <RoleBadge role={c.role} />
                </td>
                <td style={{ padding: "6px 8px" }}>{c.dataType}</td>
                <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>
                  {c.unit ?? c.listSlug ?? "—"}
                </td>
                <td style={{ padding: "6px 8px" }}>{c.required ? "yes" : "—"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    onClick={() => void onDelete(c.id)}
                    style={{ minHeight: 32 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border, #e5e7eb)" }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)" }}>
          Add column
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 140px 1fr auto", gap: 8, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Name</span>
            <input
              className="s7-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Equipment"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Role</span>
            <select
              className="s7-select"
              value={role}
              onChange={(e) => setRole(e.target.value as RateColumnRole)}
            >
              <option value="KEY">KEY</option>
              <option value="VALUE">VALUE ($)</option>
              <option value="INFO">INFO</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Type</span>
            <select
              className="s7-select"
              value={dataType}
              onChange={(e) => setDataType(e.target.value as RateColumnDataType)}
            >
              <option value="TEXT">TEXT</option>
              <option value="NUMBER">NUMBER</option>
              <option value="CURRENCY">CURRENCY</option>
              <option value="DATE">DATE</option>
              <option value="BOOL">BOOL</option>
              <option value="LIST_REF">LIST_REF</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {dataType === "LIST_REF" ? "List slug (e.g. cutting-materials)" : role === "VALUE" ? "Unit (e.g. hr, m, tonne)" : "Unit (optional)"}
            </span>
            {dataType === "LIST_REF" ? (
              <input
                className="s7-input"
                value={listSlug}
                onChange={(e) => setListSlug(e.target.value)}
                placeholder="cutting-materials"
              />
            ) : (
              <input
                className="s7-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={role === "VALUE" ? "hr" : ""}
              />
            )}
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              Required
            </label>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={!canSave || busy}
              onClick={() => void submit()}
              style={{ minHeight: 36 }}
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferenceBadge() {
  return (
    <span
      title="Reference table — resolvable by calculators but excluded from tender rate-set snapshots."
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(59,130,246,0.12)",
        color: "#2563eb",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        textTransform: "uppercase"
      }}
    >
      Reference
    </span>
  );
}

function RoleBadge({ role }: { role: RateColumnRole }) {
  const bg = role === "VALUE" ? "rgba(22,163,74,0.12)" : role === "KEY" ? "rgba(0,91,97,0.10)" : "rgba(148,163,184,0.15)";
  const color = role === "VALUE" ? "#16a34a" : role === "KEY" ? "var(--brand-primary, #005B61)" : "#64748b";
  return (
    <span style={{ padding: "2px 8px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 600 }}>
      {role}
    </span>
  );
}

function RowsCard({
  columns,
  rows,
  rowDraft,
  rowErrors,
  onStartAdd,
  onCancelAdd,
  onCommitAdd,
  onChangeDraft,
  onDeleteRow
}: {
  columns: RateColumn[];
  rows: RateRow[];
  rowDraft: Record<string, unknown> | null;
  rowErrors: Array<{ columnId: string; message: string }>;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onCommitAdd: () => Promise<void>;
  onChangeDraft: (next: Record<string, unknown>) => void;
  onDeleteRow: (id: string) => Promise<void>;
}) {
  const errorByColumn = useMemo(() => {
    const m = new Map<string, string>();
    rowErrors.forEach((e) => m.set(e.columnId, e.message));
    return m;
  }, [rowErrors]);

  const canAdd = columns.length > 0;

  return (
    <div className="s7-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Rows</h3>
        {rowDraft ? null : (
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={onStartAdd}
            disabled={!canAdd}
            style={{ minHeight: 36 }}
          >
            + Add row
          </button>
        )}
      </div>

      {columns.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Add columns before you add rows.</p>
      ) : rows.length === 0 && !rowDraft ? (
        <EmptyState icon="📊" heading="No rows yet" subtext="Add rows to build this rate table." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)", color: "var(--text-muted)" }}>
                {columns.map((c) => (
                  <th key={c.id} style={{ textAlign: "left", padding: "6px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {c.name}
                      <RoleBadge role={c.role} />
                    </div>
                  </th>
                ))}
                <th style={{ width: 88 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                  {columns.map((c) => (
                    <td key={c.id} style={{ padding: "6px 8px" }}>
                      {renderCellDisplay(c, row.cells[c.id])}
                    </td>
                  ))}
                  <td style={{ textAlign: "right", padding: "6px 8px" }}>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      onClick={() => void onDeleteRow(row.id)}
                      style={{ minHeight: 32 }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rowDraft ? (
                <tr style={{ borderBottom: "1px solid var(--border, #f1f5f9)", background: "rgba(254,170,109,0.06)" }}>
                  {columns.map((c) => {
                    const err = errorByColumn.get(c.id);
                    return (
                      <td key={c.id} style={{ padding: "6px 8px", verticalAlign: "top" }}>
                        <CellEditor
                          column={c}
                          value={rowDraft[c.id]}
                          onChange={(v) => onChangeDraft({ ...rowDraft, [c.id]: v })}
                        />
                        {err ? (
                          <div style={{ marginTop: 4, fontSize: 11, color: "var(--status-danger, #ef4444)" }}>{err}</div>
                        ) : null}
                      </td>
                    );
                  })}
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button
                        type="button"
                        className="s7-btn s7-btn--primary s7-btn--sm"
                        disabled={rowErrors.length > 0}
                        onClick={() => void onCommitAdd()}
                        style={{ minHeight: 32 }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={onCancelAdd}
                        style={{ minHeight: 32 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderCellDisplay(column: RateColumn, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.dataType === "BOOL") return value ? "yes" : "no";
  if (column.dataType === "CURRENCY") {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const formatted = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
    return column.unit ? `${formatted} / ${column.unit}` : formatted;
  }
  if (column.dataType === "NUMBER") {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return column.unit ? `${n} ${column.unit}` : String(n);
  }
  return String(value);
}

function CellEditor({
  column,
  value,
  onChange
}: {
  column: RateColumn;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (column.dataType === "BOOL") {
    return (
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {value ? "yes" : "no"}
      </label>
    );
  }
  if (column.dataType === "DATE") {
    return (
      <input
        type="date"
        className="s7-input"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (column.dataType === "NUMBER" || column.dataType === "CURRENCY") {
    return (
      <input
        type="number"
        inputMode="decimal"
        className="s7-input"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (column.dataType === "LIST_REF") {
    return (
      <ListRefCellEditor
        listSlug={column.listSlug ?? ""}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    );
  }
  return (
    <input
      className="s7-input"
      value={typeof value === "string" ? value : String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ListRefCellEditor({
  listSlug,
  value,
  onChange
}: {
  listSlug: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<ListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!listSlug) return;
    void authFetch(`/lists/${listSlug}/items`).then(async (res) => {
      if (!res.ok) return;
      const body = (await res.json()) as ListItem[];
      if (!cancelled) setItems(body.filter((i) => !i.isArchived));
    });
    return () => {
      cancelled = true;
    };
  }, [authFetch, listSlug]);

  return (
    <select className="s7-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {(items ?? []).map((i) => (
        <option key={i.id} value={i.value}>
          {i.label}
        </option>
      ))}
    </select>
  );
}

// ── New rate table modal ─────────────────────────────────────────────────

function NewRateTableModal({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    slug: string;
    category: RateTableCategory;
    description?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState<RateTableCategory>("INITIAL_SERVICES");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && slug.trim().length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        category,
        description: description.trim() || undefined
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New rate table"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40
      }}
      onClick={onClose}
    >
      <div
        className="s7-card"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 420, maxWidth: 520, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>New rate table</h3>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Name</span>
          <input className="s7-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Slug (lower-kebab, e.g. plant-hire-2026)</span>
          <input className="s7-input" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Category</span>
          <select
            className="s7-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as RateTableCategory)}
          >
            <option value="INITIAL_SERVICES">Initial Services</option>
            <option value="SUBCONTRACTOR">Subcontractor / supplier</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Description (optional)</span>
          <textarea
            className="s7-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </label>
        {error ? <div style={{ color: "var(--status-danger, #ef4444)", fontSize: 12 }}>{error}</div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} style={{ minHeight: 40 }}>
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            disabled={!canSave || busy}
            onClick={() => void submit()}
            style={{ minHeight: 40 }}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lists panel (JotForm-style tabs) ─────────────────────────────────────

type ListInnerTab = "items" | "linked" | "settings";

function ListsPanel() {
  const { authFetch } = useAuth();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResolvedList | null>(null);
  const [innerTab, setInnerTab] = useState<ListInnerTab>("items");
  const [loading, setLoading] = useState(true);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newListOpen, setNewListOpen] = useState(false);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/lists");
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load lists."));
      const body = (await res.json()) as ListSummary[];
      setLists(body);
      if (!selectedSlug && body.length > 0) setSelectedSlug(body[0].slug);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, selectedSlug]);

  const loadSelected = useCallback(
    async (slug: string) => {
      setLoadingSelected(true);
      try {
        const res = await authFetch(`/lists/${slug}`);
        if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load list."));
        setSelected((await res.json()) as ResolvedList);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingSelected(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (selectedSlug) void loadSelected(selectedSlug);
  }, [selectedSlug, loadSelected]);

  const createList = async (payload: { name: string; slug: string; description?: string }) => {
    const res = await authFetch("/lists", { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await readApiErrorMessage(res, "Create list failed."));
    setNewListOpen(false);
    setSelectedSlug(payload.slug);
    await loadLists();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
      <aside className="s7-card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>Lists</strong>
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => setNewListOpen(true)}
            style={{ minHeight: 32 }}
          >
            + New
          </button>
        </div>
        {loading ? (
          <SkeletonList count={6} rowHeight={20} />
        ) : lists.length === 0 ? (
          <EmptyState icon="📋" heading="No lists yet" subtext="Create your first list." />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {lists.map((l) => {
              const active = l.slug === selectedSlug;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(l.slug)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      minHeight: 44,
                      padding: "8px 10px",
                      border: "none",
                      borderRadius: 6,
                      background: active ? "rgba(0,91,97,0.08)" : "transparent",
                      color: active ? "var(--brand-primary, #005B61)" : "var(--text)",
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer"
                    }}
                  >
                    <div>{l.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {l.slug} · {l.itemCount ?? "?"} items{l.isSystem ? " · system" : ""}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section>
        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
        {loadingSelected ? (
          <SkeletonList count={4} rowHeight={24} />
        ) : selected ? (
          <>
            <div
              role="tablist"
              aria-label="List details"
              style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border, #e5e7eb)", marginBottom: 16 }}
            >
              <TopTabButton active={innerTab === "items"} onClick={() => setInnerTab("items")}>
                Items
              </TopTabButton>
              <TopTabButton active={innerTab === "linked"} onClick={() => setInnerTab("linked")}>
                Linked to
              </TopTabButton>
              <TopTabButton active={innerTab === "settings"} onClick={() => setInnerTab("settings")}>
                Settings
              </TopTabButton>
            </div>

            {innerTab === "items" ? (
              <ListItemsTab list={selected} onChanged={() => void loadSelected(selected.slug)} />
            ) : null}
            {innerTab === "linked" ? <ListLinkedTab listId={selected.id} listSlug={selected.slug} /> : null}
            {innerTab === "settings" ? <ListSettingsTab list={selected} /> : null}
          </>
        ) : (
          <EmptyState icon="👈" heading="Pick a list" subtext="Or create one from the sidebar." />
        )}
      </section>

      {newListOpen ? <NewListModal onClose={() => setNewListOpen(false)} onSubmit={createList} /> : null}
    </div>
  );
}

function ListItemsTab({ list, onChanged }: { list: ResolvedList; onChanged: () => void }) {
  const { authFetch } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleItems = list.items.filter((i) => showArchived || !i.isArchived);
  const isDynamic = list.type === "DYNAMIC";

  const addItem = async () => {
    if (!newLabel.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/lists/${list.slug}/items`, {
        method: "POST",
        body: JSON.stringify({
          label: newLabel.trim(),
          value: newValue.trim() || undefined
        })
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "Add item failed."));
      setNewLabel("");
      setNewValue("");
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const archiveItem = async (itemId: string) => {
    if (!window.confirm("Archive this item? It stays on historical records but disappears from dropdowns.")) return;
    setError(null);
    const res = await authFetch(`/lists/${list.slug}/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readApiErrorMessage(res, "Archive failed."));
      return;
    }
    onChanged();
  };

  return (
    <div className="s7-card">
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>{list.name}</h3>
      {list.description ? <p style={{ color: "var(--text-muted)" }}>{list.description}</p> : null}
      {isDynamic ? (
        <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
          Dynamic list — items are sourced from {list.sourceModule ?? "another module"} and edited there.
        </p>
      ) : null}
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {!isDynamic ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 180 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>New item label</span>
            <input className="s7-input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, width: 180 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Value (optional slug)</span>
            <input className="s7-input" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          </label>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            disabled={!newLabel.trim() || busy}
            onClick={() => void addItem()}
            style={{ minHeight: 40 }}
          >
            {busy ? "Adding…" : "Add item"}
          </button>
        </div>
      ) : null}

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 8 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>

      {visibleItems.length === 0 ? (
        <EmptyState icon="📄" heading="No items" subtext="Add the first item above." />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)", color: "var(--text-muted)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Label</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Value</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((i) => (
              <tr key={i.id} style={{ borderBottom: "1px solid var(--border, #f1f5f9)", opacity: i.isArchived ? 0.55 : 1 }}>
                <td style={{ padding: "6px 8px" }}>{i.label}</td>
                <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>
                  <code>{i.value}</code>
                </td>
                <td style={{ padding: "6px 8px" }}>{i.isArchived ? "archived" : "active"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>
                  {!i.isArchived && !isDynamic ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      onClick={() => void archiveItem(i.id)}
                      style={{ minHeight: 32 }}
                    >
                      Archive
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ListLinkedTab({ listId, listSlug }: { listId: string; listSlug: string }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<WhereUsed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void authFetch(`/list-bindings/where-used/${listId}`).then(async (res) => {
      if (!res.ok) {
        setError(await readApiErrorMessage(res, "Failed to load where-used."));
        setLoading(false);
        return;
      }
      setData((await res.json()) as WhereUsed);
      setLoading(false);
    });
  }, [authFetch, listId]);

  const grouped = useMemo(() => (data ? groupBindings(data.bindings) : []), [data]);

  if (loading) return <SkeletonList count={3} rowHeight={20} />;
  if (error) return <ErrorBanner message={error} onDismiss={() => setError(null)} />;
  if (!data) return null;

  return (
    <div className="s7-card">
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Linked to</h3>
      <p style={{ color: "var(--text-muted)" }}>
        <strong>{data.count}</strong> binding{data.count === 1 ? "" : "s"} depend on{" "}
        <code>{listSlug}</code>. Bindings must be removed before this list can be hard-deleted.
      </p>
      {grouped.length === 0 ? (
        <EmptyState icon="🔗" heading="No consumers" subtext="Nothing depends on this list yet." />
      ) : (
        grouped.map((group) => (
          <section key={group.type} style={{ marginTop: 12 }}>
            <h4 style={{ margin: "0 0 6px", fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)" }}>
              {group.label} ({group.items.length})
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {group.items.map((b) => (
                <li
                  key={b.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    borderBottom: "1px solid var(--border, #f1f5f9)",
                    fontSize: 13
                  }}
                >
                  <span>
                    <code>{b.consumerRef}</code>
                    {b.label ? <span style={{ color: "var(--text-muted)" }}> — {b.label}</span> : null}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{consumerTypeLabel(b.consumerType)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function ListSettingsTab({ list }: { list: ResolvedList }) {
  const { authFetch } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    void authFetch(`/list-bindings/where-used/${list.id}`).then(async (res) => {
      if (!res.ok) return;
      const body = (await res.json()) as WhereUsed;
      setCount(body.count);
    });
  }, [authFetch, list.id]);

  return (
    <div className="s7-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Settings</h3>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Name</div>
        <div>{list.name}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Slug</div>
        <code>{list.slug}</code>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Type</div>
        <div>
          {list.type}
          {list.sourceModule ? ` · ${list.sourceModule}` : ""}
        </div>
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 6,
          border: "1px solid var(--border, #e5e7eb)",
          background: "var(--surface-muted, #F6F6F6)"
        }}
      >
        <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Delete list</h4>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)" }}>
          Restricted to Sean and Marco (routed through the authority seam). A list with active bindings
          cannot be hard-deleted — remove them from the <em>Linked to</em> tab first, or prefer archive.
        </p>
        <div style={{ fontSize: 12, color: count && count > 0 ? "var(--status-danger, #ef4444)" : "var(--text-muted)" }}>
          {count === null ? "Checking…" : whereUsedBlockerMessage(count)}
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--ghost"
          disabled
          title="Whole-list delete lands in a follow-up slice; archive individual items for now."
          style={{ minHeight: 40, marginTop: 8 }}
        >
          Delete list
        </button>
      </div>
    </div>
  );
}

function NewListModal({
  onClose,
  onSubmit
}: {
  onClose: () => void;
  onSubmit: (payload: { name: string; slug: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && slug.trim().length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), slug: slug.trim().toLowerCase(), description: description.trim() || undefined });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New list"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 40
      }}
      onClick={onClose}
    >
      <div
        className="s7-card"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 420, maxWidth: 520, display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>New list</h3>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Name</span>
          <input className="s7-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Slug (lower-kebab)</span>
          <input className="s7-input" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Description (optional)</span>
          <textarea
            className="s7-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </label>
        {error ? <div style={{ color: "var(--status-danger, #ef4444)", fontSize: 12 }}>{error}</div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} style={{ minHeight: 40 }}>
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            disabled={!canSave || busy}
            onClick={() => void submit()}
            style={{ minHeight: 40 }}
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small building blocks ────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        padding: 10,
        borderRadius: 6,
        background: "rgba(239,68,68,0.08)",
        borderLeft: "3px solid var(--status-danger, #ef4444)",
        color: "var(--status-danger, #ef4444)",
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 12
      }}
    >
      <span style={{ fontSize: 13 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}
      >
        ×
      </button>
    </div>
  );
}

function ValidationBanner({
  title,
  hint,
  items
}: {
  title: string;
  hint?: string;
  items: string[];
}) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 10,
        borderRadius: 6,
        background: "rgba(245,158,11,0.08)",
        borderLeft: "3px solid #f59e0b",
        fontSize: 13
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      {hint ? <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>{hint}</div> : null}
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {items.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
