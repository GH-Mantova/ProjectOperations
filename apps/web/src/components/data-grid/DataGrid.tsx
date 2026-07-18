import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  applyView,
  defaultColumnState,
  matchesQuery,
  moveItem,
  reconcileColumnState,
  type DataGridColumn,
  type DataGridColumnState,
  type DataGridSort,
  type DataGridViewState
} from "./dataGridModel";

const BORDER = "var(--border-subtle, #E5E7EB)";
const BRAND = "var(--brand-primary, #005B61)";
const MUTED = "var(--text-muted, #64748b)";
const ACCENT = "var(--text-accent, #EA580C)";

export type DataGridSavedView = {
  id: string;
  ownerId: string;
  entityType: string;
  name: string;
  filters: Record<string, string> | null;
  columns: DataGridColumnState[] | null;
  sort: DataGridSort;
  isDefault: boolean;
};

export type DataGridInlineEdit<Row> = {
  onSave: (row: Row, key: string, value: string) => Promise<void> | void;
};

export type DataGridProps<Row extends Record<string, unknown>> = {
  entityType: string;
  columns: DataGridColumn<Row>[];
  rows: Row[];
  rowId: (row: Row) => string;
  inlineEdit?: DataGridInlineEdit<Row>;
  testIdPrefix: string;
  emptyState?: ReactNode;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function loadViews(authFetch: FetchLike, entityType: string) {
  const response = await authFetch(`/saved-views?entityType=${encodeURIComponent(entityType)}`);
  if (!response.ok) throw new Error("Could not load saved views.");
  return (await response.json()) as DataGridSavedView[];
}

function toViewState(view: DataGridSavedView | null): DataGridViewState {
  return {
    filters: view?.filters ?? {},
    columns: view?.columns ?? [],
    sort: view?.sort ?? null
  };
}

/**
 * Generic personalisable table. Reads user-specific saved views from the
 * `/saved-views?entityType=…` endpoint, applies them, and lets the user
 * save, switch and default them. Inline edit is opt-in — pass `inlineEdit`
 * with an `onSave` callback and mark the specific columns editable.
 */
export function DataGrid<Row extends Record<string, unknown>>({
  entityType,
  columns,
  rows,
  rowId,
  inlineEdit,
  testIdPrefix,
  emptyState
}: DataGridProps<Row>) {
  const { authFetch } = useAuth();

  const [views, setViews] = useState<DataGridSavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<DataGridSort>(null);
  const [colState, setColState] = useState<DataGridColumnState[]>(() => defaultColumnState(columns));
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDefault, setSaveDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ rowId: string; key: string; value: string } | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Column mutations must stay in sync with the column definitions the caller
  // passed in — key changes and additions are common in dev, and a saved view
  // may reference a key that no longer exists.
  useEffect(() => {
    setColState((prev) => reconcileColumnState(columns, prev));
  }, [columns]);

  useEffect(() => {
    let cancelled = false;
    void loadViews(authFetch, entityType)
      .then((list) => {
        if (cancelled) return;
        setViews(list);
        const preferred = list.find((v) => v.isDefault) ?? null;
        if (preferred) {
          setActiveViewId(preferred.id);
          applyViewState(preferred);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, authFetch, columns]);

  function applyViewState(view: DataGridSavedView) {
    const state = toViewState(view);
    setFilters(state.filters);
    setSort(state.sort);
    setColState(reconcileColumnState(columns, state.columns));
  }

  const visibleColumns = useMemo(
    () =>
      colState
        .filter((c) => c.visible)
        .map((c) => columns.find((col) => col.key === c.key))
        .filter((c): c is DataGridColumn<Row> => Boolean(c)),
    [colState, columns]
  );

  const displayed = useMemo(() => {
    const filtered = rows.filter((r) => matchesQuery(r, columns, query));
    return applyView(filtered, columns, { filters, columns: colState, sort });
  }, [rows, columns, colState, query, filters, sort]);

  const activeView = views.find((v) => v.id === activeViewId) ?? null;

  const canClear =
    query.trim() !== "" ||
    Object.values(filters).some((v) => v && v.trim() !== "") ||
    sort !== null;

  function clearAll() {
    setQuery("");
    setFilters({});
    setSort(null);
    setColState(defaultColumnState(columns));
    setActiveViewId(null);
  }

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function toggleColumn(key: string) {
    setColState((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    );
  }

  function moveColumn(key: string, delta: number) {
    setColState((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx < 0) return prev;
      return moveItem(prev, idx, idx + delta);
    });
  }

  async function saveNewView() {
    if (!saveName.trim()) return;
    try {
      const response = await authFetch("/saved-views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entityType,
          name: saveName.trim(),
          filters,
          columns: colState,
          sort,
          isDefault: saveDefault
        })
      });
      if (!response.ok) throw new Error("Could not save view.");
      const created = (await response.json()) as DataGridSavedView;
      const list = await loadViews(authFetch, entityType);
      setViews(list);
      setActiveViewId(created.id);
      setSaveName("");
      setSaveDefault(false);
      setSaveOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function selectView(view: DataGridSavedView) {
    setActiveViewId(view.id);
    applyViewState(view);
    setViewsMenuOpen(false);
  }

  async function makeDefault(view: DataGridSavedView) {
    try {
      const response = await authFetch(`/saved-views/${view.id}/default`, { method: "POST" });
      if (!response.ok) throw new Error("Could not set default view.");
      const list = await loadViews(authFetch, entityType);
      setViews(list);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteView(view: DataGridSavedView) {
    if (!confirm(`Delete view "${view.name}"?`)) return;
    try {
      const response = await authFetch(`/saved-views/${view.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete view.");
      const list = await loadViews(authFetch, entityType);
      setViews(list);
      if (activeViewId === view.id) setActiveViewId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function commitEdit() {
    if (!editing || !inlineEdit) return;
    const row = rows.find((r) => rowId(r) === editing.rowId);
    if (!row) {
      setEditing(null);
      return;
    }
    try {
      await inlineEdit.onSave(row, editing.key, editing.value);
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div data-testid={`${testIdPrefix}-grid`}>
      {error ? (
        <div className="s7-alert s7-alert--error" role="alert" style={{ marginBottom: 8 }}>
          {error}
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            style={{ marginLeft: 8 }}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <Toolbar
        query={query}
        onQuery={setQuery}
        canClear={canClear}
        onClear={clearAll}
        matches={displayed.length}
        total={rows.length}
        activeView={activeView}
        views={views}
        onSelectView={selectView}
        onOpenViews={() => setViewsMenuOpen((v) => !v)}
        viewsMenuOpen={viewsMenuOpen}
        onCloseViews={() => setViewsMenuOpen(false)}
        onOpenSave={() => setSaveOpen(true)}
        onMakeDefault={makeDefault}
        onDeleteView={deleteView}
        onOpenColumns={() => setColumnsOpen((v) => !v)}
        columnsOpen={columnsOpen}
        columnsMenu={
          <ColumnsMenu
            columns={columns}
            state={colState}
            onToggle={toggleColumn}
            onMove={moveColumn}
            onReset={() => setColState(defaultColumnState(columns))}
            testIdPrefix={testIdPrefix}
          />
        }
        testIdPrefix={testIdPrefix}
      />

      {saveOpen ? (
        <div
          role="dialog"
          aria-label="Save view"
          data-testid={`${testIdPrefix}-save-dialog`}
          style={{
            padding: 12,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            marginBottom: 8,
            background: "var(--surface, #fff)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <input
            className="s7-input"
            placeholder="View name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            data-testid={`${testIdPrefix}-save-name`}
            style={{ minWidth: 220 }}
          />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={saveDefault}
              onChange={(e) => setSaveDefault(e.target.checked)}
              data-testid={`${testIdPrefix}-save-default`}
            />
            Set as default
          </label>
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => void saveNewView()}
            disabled={!saveName.trim()}
            data-testid={`${testIdPrefix}-save-confirm`}
          >
            Save
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => {
              setSaveOpen(false);
              setSaveName("");
              setSaveDefault(false);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div style={{ overflowX: "auto", position: "relative" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <colgroup>
            {visibleColumns.map((col) => {
              const state = colState.find((c) => c.key === col.key);
              const width = state?.width ?? col.minWidth ?? null;
              return (
                <col
                  key={col.key}
                  style={{ width: width ? `${width}px` : undefined, minWidth: col.minWidth }}
                />
              );
            })}
          </colgroup>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>
              {visibleColumns.map((col) => {
                const isSorted = sort?.key === col.key;
                const align = col.align ?? (col.kind === "text" ? "left" : "right");
                const filterVal = filters[col.key] ?? "";
                return (
                  <th
                    key={col.key}
                    style={{
                      padding: "8px 12px",
                      textAlign: align,
                      position: "sticky",
                      top: 0,
                      background: "var(--surface, #fff)",
                      zIndex: 1
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          font: "inherit",
                          color: "inherit",
                          fontWeight: 600,
                          textAlign: align
                        }}
                        data-testid={`${testIdPrefix}-header-${col.key}`}
                      >
                        {col.label}
                        {isSorted ? (
                          <span aria-hidden> {sort!.dir === "asc" ? "↑" : "↓"}</span>
                        ) : null}
                      </button>
                      <input
                        className="s7-input s7-input--sm"
                        placeholder="Filter…"
                        value={filterVal}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))
                        }
                        data-testid={`${testIdPrefix}-filter-${col.key}`}
                        style={{
                          fontSize: 12,
                          padding: "2px 6px",
                          color: filterVal ? ACCENT : undefined
                        }}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  style={{ padding: 24, textAlign: "center", color: MUTED }}
                  data-testid={`${testIdPrefix}-empty`}
                >
                  {emptyState ?? "No rows match the current filters."}
                </td>
              </tr>
            ) : (
              displayed.map((row) => {
                const id = rowId(row);
                return (
                  <tr
                    key={id}
                    style={{ borderBottom: "1px solid var(--border-subtle, #F1F5F9)" }}
                  >
                    {visibleColumns.map((col) => {
                      const align = col.align ?? (col.kind === "text" ? "left" : "right");
                      const isEditingCell =
                        editing && editing.rowId === id && editing.key === col.key;
                      const canEdit = Boolean(inlineEdit && col.editable);
                      const raw = row[col.key];
                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: "8px 12px",
                            textAlign: align,
                            verticalAlign: "middle",
                            cursor: canEdit && !isEditingCell ? "text" : undefined
                          }}
                          onDoubleClick={() => {
                            if (!canEdit) return;
                            setEditing({
                              rowId: id,
                              key: col.key,
                              value: raw === null || raw === undefined ? "" : String(raw)
                            });
                          }}
                          data-testid={`${testIdPrefix}-cell-${col.key}-${id}`}
                        >
                          {isEditingCell ? (
                            <input
                              autoFocus
                              className="s7-input s7-input--sm"
                              value={editing!.value}
                              onChange={(e) =>
                                setEditing({
                                  rowId: id,
                                  key: col.key,
                                  value: e.target.value
                                })
                              }
                              onBlur={() => void commitEdit()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void commitEdit();
                                if (e.key === "Escape") setEditing(null);
                              }}
                              data-testid={`${testIdPrefix}-edit-${col.key}-${id}`}
                            />
                          ) : col.render ? (
                            col.render(row)
                          ) : raw === null || raw === undefined || raw === "" ? (
                            "—"
                          ) : (
                            String(raw)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // Columns picker is a compact popover — kept inline so it can share
  // state (colState / setColState) without threading callbacks through
  // yet another prop layer.
  // ─────────────────────────────────────────────────────────────────
}

function Toolbar({
  query,
  onQuery,
  canClear,
  onClear,
  matches,
  total,
  activeView,
  views,
  onSelectView,
  onOpenViews,
  viewsMenuOpen,
  onCloseViews,
  onOpenSave,
  onMakeDefault,
  onDeleteView,
  onOpenColumns,
  columnsOpen,
  columnsMenu,
  testIdPrefix
}: {
  query: string;
  onQuery: (q: string) => void;
  canClear: boolean;
  onClear: () => void;
  matches: number;
  total: number;
  activeView: DataGridSavedView | null;
  views: DataGridSavedView[];
  onSelectView: (v: DataGridSavedView) => void;
  onOpenViews: () => void;
  viewsMenuOpen: boolean;
  onCloseViews: () => void;
  onOpenSave: () => void;
  onMakeDefault: (v: DataGridSavedView) => void;
  onDeleteView: (v: DataGridSavedView) => void;
  onOpenColumns: () => void;
  columnsOpen: boolean;
  columnsMenu: ReactNode;
  testIdPrefix: string;
}) {
  const viewsRef = useRef<HTMLDivElement | null>(null);
  const colsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!viewsRef.current) return;
      if (!viewsRef.current.contains(e.target as Node)) onCloseViews();
    };
    if (viewsMenuOpen) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
    return undefined;
  }, [viewsMenuOpen, onCloseViews]);

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: 8
      }}
    >
      <input
        type="search"
        className="s7-input"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search…"
        style={{ flex: "1 1 220px", minWidth: 200, maxWidth: 360 }}
        data-testid={`${testIdPrefix}-search`}
      />

      <div style={{ position: "relative" }} ref={viewsRef}>
        <button
          type="button"
          className="s7-btn s7-btn--sm"
          onClick={onOpenViews}
          aria-expanded={viewsMenuOpen}
          data-testid={`${testIdPrefix}-views-btn`}
          style={{
            minHeight: 36,
            fontWeight: 500,
            borderColor: activeView ? BRAND : undefined,
            color: activeView ? BRAND : undefined
          }}
        >
          Views: {activeView?.name ?? "Default"} ▾
        </button>
        {viewsMenuOpen ? (
          <div
            role="menu"
            data-testid={`${testIdPrefix}-views-menu`}
            style={{
              position: "absolute",
              top: "100%",
              marginTop: 4,
              left: 0,
              zIndex: 10,
              background: "var(--surface, #fff)",
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
              padding: 6,
              minWidth: 260
            }}
          >
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={onOpenSave}
              style={{ width: "100%", justifyContent: "flex-start", minHeight: 32 }}
              data-testid={`${testIdPrefix}-views-save`}
            >
              Save current as view…
            </button>
            <hr
              style={{ margin: "6px 0", border: "none", borderTop: `1px solid ${BORDER}` }}
            />
            {views.length === 0 ? (
              <div style={{ padding: "6px 8px", color: MUTED, fontSize: 12 }}>
                No saved views yet.
              </div>
            ) : (
              views.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 4px"
                  }}
                >
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    onClick={() => onSelectView(v)}
                    style={{
                      flex: 1,
                      justifyContent: "flex-start",
                      minHeight: 30,
                      fontWeight: v.isDefault ? 600 : 400
                    }}
                    data-testid={`${testIdPrefix}-views-select-${v.id}`}
                  >
                    {v.name}
                    {v.isDefault ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          color: BRAND,
                          fontWeight: 600
                        }}
                      >
                        DEFAULT
                      </span>
                    ) : null}
                  </button>
                  {!v.isDefault ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      title="Set as default"
                      onClick={() => onMakeDefault(v)}
                      style={{ minHeight: 30, padding: "0 8px" }}
                    >
                      ★
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    title="Delete view"
                    onClick={() => onDeleteView(v)}
                    style={{ minHeight: 30, padding: "0 8px", color: ACCENT }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div style={{ position: "relative" }} ref={colsRef}>
        <button
          type="button"
          className="s7-btn s7-btn--sm"
          onClick={onOpenColumns}
          aria-expanded={columnsOpen}
          data-testid={`${testIdPrefix}-columns-btn`}
          style={{ minHeight: 36 }}
        >
          Columns ▾
        </button>
        {columnsOpen ? columnsMenu : null}
      </div>

      <button
        type="button"
        className="s7-btn s7-btn--ghost s7-btn--sm"
        onClick={onClear}
        disabled={!canClear}
        data-testid={`${testIdPrefix}-clear`}
        style={{ minHeight: 36 }}
      >
        Clear
      </button>

      <span
        style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}
        data-testid={`${testIdPrefix}-count`}
      >
        {matches === total ? `${total} rows` : `${matches} of ${total} rows`}
      </span>
    </div>
  );
}

function ColumnsMenu<Row extends Record<string, unknown>>({
  columns,
  state,
  onToggle,
  onMove,
  onReset,
  testIdPrefix
}: {
  columns: DataGridColumn<Row>[];
  state: DataGridColumnState[];
  onToggle: (key: string) => void;
  onMove: (key: string, delta: number) => void;
  onReset: () => void;
  testIdPrefix: string;
}) {
  return (
    <div
      role="menu"
      data-testid={`${testIdPrefix}-columns-menu`}
      style={{
        position: "absolute",
        top: "100%",
        marginTop: 4,
        left: 0,
        zIndex: 10,
        background: "var(--surface, #fff)",
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
        padding: 8,
        minWidth: 240,
        maxHeight: 320,
        overflowY: "auto"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {state.map((s, idx) => {
          const col = columns.find((c) => c.key === s.key);
          if (!col) return null;
          const hideable = col.hideable !== false;
          return (
            <div
              key={s.key}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
            >
              <label
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 0"
                }}
              >
                <input
                  type="checkbox"
                  checked={s.visible}
                  disabled={!hideable}
                  onChange={() => onToggle(s.key)}
                  data-testid={`${testIdPrefix}-col-toggle-${s.key}`}
                />
                {col.label}
              </label>
              <button
                type="button"
                title="Move up"
                onClick={() => onMove(s.key, -1)}
                disabled={idx === 0}
                className="s7-btn s7-btn--ghost s7-btn--sm"
                style={{ minHeight: 26, padding: "0 6px" }}
              >
                ↑
              </button>
              <button
                type="button"
                title="Move down"
                onClick={() => onMove(s.key, 1)}
                disabled={idx === state.length - 1}
                className="s7-btn s7-btn--ghost s7-btn--sm"
                style={{ minHeight: 26, padding: "0 6px" }}
              >
                ↓
              </button>
            </div>
          );
        })}
      </div>
      <hr style={{ margin: "8px 0", border: "none", borderTop: `1px solid ${BORDER}` }} />
      <button
        type="button"
        className="s7-btn s7-btn--ghost s7-btn--sm"
        onClick={onReset}
        style={{ width: "100%", justifyContent: "center", minHeight: 30 }}
        data-testid={`${testIdPrefix}-col-reset`}
      >
        Reset columns
      </button>
    </div>
  );
}
