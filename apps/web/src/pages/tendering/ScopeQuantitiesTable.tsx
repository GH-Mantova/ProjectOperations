import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { AiProviderSelector, type AvailableProvider } from "../../components/ai/AiProviderSelector";
import { ScopeColumnManager, labelFor } from "./ScopeColumnManager";
import { ScopeListDropdown } from "./ScopeListDropdown";

export type Discipline = "SO" | "Str" | "Asb" | "Civ" | "Prv";

export type ScopeItem = {
  id: string;
  tenderId: string;
  wbsCode: string;
  discipline: string;
  itemNumber: number;
  rowType: string;
  description: string;
  status: "draft" | "confirmed" | "excluded";
  aiProposed: boolean;
  aiConfidence: string | null;
  sortOrder: number;
  notes: string | null;
  men: string | null;
  days: string | null;
  shift: string | null;
  measurementQty: string | null;
  measurementUnit: string | null;
  material: string | null;
  plantAssetId: string | null;
  wasteGroup: string | null;
  wasteType: string | null;
  wasteFacility: string | null;
  wasteTonnes: string | null;
  wasteLoads: number | null;
  provisionalAmount: string | null;
  estimateItemId: string | null;
};

type RowTypeListItem = {
  value: string;
  label: string;
  metadata: { disciplines?: string[] } | null;
};

type ColumnsResponse = { available: string[]; required: string[] };
type ViewConfigResponse = { discipline: string; columns: string[] };

const DEFAULT_COLUMNS_BY_DISCIPLINE: Record<Discipline, string[]> = {
  SO: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  Str: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  Asb: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  Civ: ["men", "days", "shift", "plantAssetId", "measurementQty", "measurementUnit", "material", "notes"],
  Prv: ["notes"]
};

const CONFIDENCE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  high: { bg: "#DCFCE7", fg: "#166534", label: "High" },
  medium: { bg: "#FEF3C7", fg: "#854F0B", label: "Medium" },
  low: { bg: "#FEE2E2", fg: "#991B1B", label: "Low" }
};

// Client-side mirror of the server's row-type → columns matrix. Used as a
// fallback when a row carries a legacy rowType that isn't in the filtered
// list registry (otherwise the rowCols lookup returns [] and every cell
// renders as "—", which looks like a read-only bug).
const FALLBACK_COLUMNS_BY_ROW_TYPE: Record<string, string[]> = {
  demolition: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  "asbestos-removal": ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  enclosure: ["men", "days", "measurementQty", "measurementUnit", "material", "notes"],
  excavation: ["men", "days", "shift", "plantAssetId", "measurementQty", "measurementUnit", "material", "notes"],
  earthworks: ["men", "days", "shift", "plantAssetId", "measurementQty", "measurementUnit", "material", "notes"],
  "waste-disposal": ["wasteGroup", "wasteType", "wasteFacility", "wasteTonnes", "wasteLoads", "notes"],
  "plant-only": ["plantAssetId", "days", "notes"],
  "general-labour": ["men", "days", "shift", "notes"],
  cutting: ["notes"],
  asbestos: ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "notes"],
  waste: ["wasteGroup", "wasteType", "wasteFacility", "wasteTonnes", "wasteLoads", "notes"],
  general: ["men", "days", "shift", "notes"]
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

type Props = {
  tenderId: string;
  discipline: Discipline;
  items: ScopeItem[];
  subtotal: number;
  subtotalWithMarkup: number;
  onItemsChanged: () => Promise<void> | void;
};

export function ScopeQuantitiesTable({
  tenderId,
  discipline,
  items,
  subtotal,
  subtotalWithMarkup,
  onItemsChanged
}: Props) {
  const { authFetch } = useAuth();
  const [rowTypes, setRowTypes] = useState<RowTypeListItem[]>([]);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS_BY_DISCIPLINE[discipline]);
  const [available, setAvailable] = useState<string[]>([]);
  const [columnsByRowType, setColumnsByRowType] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<ScopeItem | null>(null);

  // Load row-types (filtered by discipline) + view config + available cols.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rtRes, cfgRes] = await Promise.all([
          authFetch("/lists/row-types/items"),
          authFetch(`/tenders/${tenderId}/scope/view-config?discipline=${discipline}`)
        ]);
        if (!cancelled) {
          if (rtRes.ok) {
            const body = (await rtRes.json()) as RowTypeListItem[];
            setRowTypes(body.filter((rt) => rt.metadata?.disciplines?.includes(discipline)));
          }
          if (cfgRes.ok) {
            const cfg = (await cfgRes.json()) as ViewConfigResponse;
            setColumns(cfg.columns.length > 0 ? cfg.columns : DEFAULT_COLUMNS_BY_DISCIPLINE[discipline]);
          }
        }
      } catch {
        // Non-fatal — fall back to defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, tenderId, discipline]);

  // When row-types become known, resolve each one's available-column set
  // once so the cell visibility matrix doesn't require a round-trip per row.
  // Include legacy rowTypes that appear on existing items even if the current
  // discipline's registry doesn't list them (otherwise their cells render as
  // read-only "—" placeholders).
  useEffect(() => {
    const registryTypes = rowTypes.map((rt) => rt.value);
    const itemTypes = Array.from(new Set(items.map((i) => i.rowType).filter(Boolean)));
    const allTypes = Array.from(new Set([...registryTypes, ...itemTypes]));
    if (allTypes.length === 0) return;
    let cancelled = false;
    (async () => {
      const byRowType: Record<string, string[]> = {};
      const allAvailable = new Set<string>();
      for (const rt of allTypes) {
        try {
          const response = await authFetch(`/tenders/${tenderId}/scope/columns?rowType=${encodeURIComponent(rt)}`);
          if (!response.ok) {
            const fb = FALLBACK_COLUMNS_BY_ROW_TYPE[rt];
            if (fb) {
              byRowType[rt] = fb;
              fb.forEach((c) => allAvailable.add(c));
            }
            continue;
          }
          const body = (await response.json()) as ColumnsResponse;
          byRowType[rt] = body.available;
          body.available.forEach((c) => allAvailable.add(c));
        } catch {
          const fb = FALLBACK_COLUMNS_BY_ROW_TYPE[rt];
          if (fb) {
            byRowType[rt] = fb;
            fb.forEach((c) => allAvailable.add(c));
          }
        }
      }
      if (!cancelled) {
        setColumnsByRowType(byRowType);
        setAvailable(Array.from(allAvailable));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, tenderId, rowTypes, items]);

  const saveViewConfig = async (nextColumns: string[]) => {
    setColumns(nextColumns);
    try {
      await authFetch(`/tenders/${tenderId}/scope/view-config`, {
        method: "PATCH",
        body: JSON.stringify({ discipline, columns: nextColumns })
      });
    } catch {
      // Non-fatal — config will re-fetch from server on next load.
    }
  };

  const patchItem = async (id: string, body: Record<string, unknown>) => {
    setPendingIds((s) => new Set(s).add(id));
    try {
      const response = await authFetch(`/tenders/${tenderId}/scope/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      await onItemsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const confirmItem = async (id: string) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/items/${id}/confirm`, { method: "POST" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await onItemsChanged();
  };
  const excludeItem = async (id: string) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/items/${id}/exclude`, { method: "POST" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await onItemsChanged();
  };

  const duplicateItem = async (item: ScopeItem) => {
    const body: Record<string, unknown> = {
      discipline,
      rowType: item.rowType,
      description: `${item.description} (copy)`
    };
    for (const k of ["men", "days", "shift", "measurementQty", "measurementUnit", "material", "plantAssetId", "wasteGroup", "wasteType", "wasteFacility", "wasteTonnes", "wasteLoads", "notes"] as const) {
      const v = item[k];
      if (v !== null && v !== undefined && v !== "") body[k] = typeof v === "string" && !Number.isNaN(Number(v)) ? Number(v) : v;
    }
    const response = await authFetch(`/tenders/${tenderId}/scope/items`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await onItemsChanged();
  };

  const finalDelete = async (item: ScopeItem) => {
    setDeleteWarning(null);
    const response = await authFetch(`/tenders/${tenderId}/scope/items/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await onItemsChanged();
  };
  const deleteItem = (item: ScopeItem) => {
    if (item.estimateItemId) {
      setDeleteWarning(item);
    } else {
      if (!window.confirm(`Delete ${item.wbsCode}?`)) return;
      void finalDelete(item);
    }
  };

  const addItem = async () => {
    const defaultRowType = rowTypes.find((rt) => rt.value === "general-labour")?.value ?? rowTypes[0]?.value ?? "general-labour";
    const response = await authFetch(`/tenders/${tenderId}/scope/items`, {
      method: "POST",
      body: JSON.stringify({
        discipline,
        rowType: defaultRowType,
        description: ""
      })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await onItemsChanged();
  };

  const requestDraft = () => setPickerOpen(true);
  const runDraft = async (providerId: string | null) => {
    try {
      const response = await authFetch(`/tenders/${tenderId}/draft-scope`, {
        method: "POST",
        body: JSON.stringify(providerId ? { selectedProviderId: providerId } : {})
      });
      if (!response.ok) throw new Error(await response.text());
      await onItemsChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const visible = useMemo(() => items.filter((i) => i.status !== "excluded"), [items]);
  const excluded = useMemo(() => items.filter((i) => i.status === "excluded"), [items]);
  const wbsSortedVisible = useMemo(
    () => [...visible].sort((a, b) => a.itemNumber - b.itemNumber || a.sortOrder - b.sortOrder),
    [visible]
  );

  const columnsForRow = useCallback(
    (rowType: string): string[] => columnsByRowType[rowType] ?? FALLBACK_COLUMNS_BY_ROW_TYPE[rowType] ?? [],
    [columnsByRowType]
  );

  const notesEnabled = columns.includes("notes");
  const headerColumns = columns.filter((c) => c !== "notes" && c !== "measurementUnit");

  return (
    <section className="s7-card" style={{ padding: 16 }}>
      <ScopeColumnManager enabled={columns} available={available} onChange={(next) => void saveViewConfig(next)} />

      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: "6px 10px",
            border: "1px solid var(--status-danger)",
            color: "var(--status-danger)",
            borderRadius: 4,
            fontSize: 13
          }}
        >
          {error}
        </div>
      ) : null}

      {wbsSortedVisible.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ marginTop: 0 }}>No {discipline} items yet</p>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void addItem()}>
            + Add {discipline} item
          </button>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #F6F6F6)", position: "sticky", top: 0 }}>
              <tr>
                <th style={thStyle}>WBS</th>
                <th style={{ ...thStyle, minWidth: 200 }}>Description</th>
                <th style={thStyle}>Row type</th>
                {headerColumns.map((c) => (
                  <th key={c} style={thStyle}>{labelFor(c)}</th>
                ))}
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {wbsSortedVisible.map((item) => (
                <QuantityRow
                  key={item.id}
                  item={item}
                  columns={columns}
                  headerColumns={headerColumns}
                  rowTypes={rowTypes}
                  columnsForRow={columnsForRow}
                  notesEnabled={notesEnabled}
                  isPending={pendingIds.has(item.id)}
                  onPatch={(body) => void patchItem(item.id, body)}
                  onConfirm={() => void confirmItem(item.id)}
                  onExclude={() => void excludeItem(item.id)}
                  onDuplicate={() => void duplicateItem(item)}
                  onDelete={() => deleteItem(item)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void addItem()}>
            + Add {discipline} item
          </button>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={requestDraft}>
            Draft with AI
          </button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Subtotal: <strong style={{ color: "var(--text)" }}>{fmtCurrency(subtotal)}</strong>
          {" · "}with markup: <strong style={{ color: "var(--text)" }}>{fmtCurrency(subtotalWithMarkup)}</strong>
        </div>
      </div>

      {excluded.length > 0 ? (
        <details style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
          <summary>Excluded ({excluded.length})</summary>
          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
            {excluded.map((i) => (
              <li key={i.id} style={{ textDecoration: "line-through" }}>
                {i.wbsCode} — {i.description}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {pickerOpen ? (
        <AiProviderSelector
          actionLabel="Draft scope"
          onCancel={() => setPickerOpen(false)}
          onProviderSelected={(providerId: string | null, _meta?: AvailableProvider) => {
            setPickerOpen(false);
            void runDraft(providerId);
          }}
        />
      ) : null}

      {deleteWarning ? (
        <div
          className="slide-over-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteWarning(null)}
        >
          <div className="s7-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delete {deleteWarning.wbsCode}?</h3>
            <p style={{ color: "var(--text-muted)" }}>
              This item has a linked estimate entry. The scope item will be deleted but the estimate line will remain.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setDeleteWarning(null)}>Cancel</button>
              <button type="button" className="s7-btn s7-btn--primary" onClick={() => void finalDelete(deleteWarning)}>
                Delete scope item only
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 6px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  color: "var(--text-muted)",
  letterSpacing: "0.05em"
};

type RowProps = {
  item: ScopeItem;
  columns: string[];
  headerColumns: string[];
  rowTypes: RowTypeListItem[];
  columnsForRow: (rowType: string) => string[];
  notesEnabled: boolean;
  isPending: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onConfirm: () => void;
  onExclude: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function QuantityRow({
  item,
  columns,
  headerColumns,
  rowTypes,
  columnsForRow,
  notesEnabled,
  isPending,
  onPatch,
  onConfirm,
  onExclude,
  onDuplicate,
  onDelete
}: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const debouncedPatchRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const rowCols = columnsForRow(item.rowType);
  const isAi = item.aiProposed && item.status !== "confirmed";
  const confidence = item.aiConfidence ? CONFIDENCE_STYLE[item.aiConfidence] : null;
  const baseBg = isAi ? "#FEF3C7" : undefined;

  const debouncedPatch = (key: string, body: Record<string, unknown>) => {
    const prev = debouncedPatchRef.current[key];
    if (prev) clearTimeout(prev);
    debouncedPatchRef.current[key] = setTimeout(() => onPatch(body), 300);
  };

  return (
    <>
      <tr style={{ borderTop: "1px solid var(--border, #e5e7eb)", background: baseBg }}>
        <td style={{ padding: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {isAi ? (
              <span
                title="AI-proposed"
                style={{
                  fontSize: 9,
                  padding: "1px 5px",
                  background: "#FEAA6D",
                  color: "#fff",
                  borderRadius: 999,
                  fontWeight: 700
                }}
              >
                AI
              </span>
            ) : null}
            <input
              className="s7-input"
              defaultValue={item.wbsCode}
              disabled={isAi}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== item.wbsCode) onPatch({ wbsCode: v });
              }}
              style={{ width: 56, color: "#005B61", fontWeight: 500 }}
            />
            {isPending ? <span style={{ color: "var(--text-muted)", fontSize: 10 }}>···</span> : null}
          </div>
        </td>
        <td style={{ padding: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="s7-input"
              defaultValue={item.description}
              disabled={isAi}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== item.description) onPatch({ description: v });
              }}
              style={{ flex: 1 }}
            />
            {confidence ? (
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  background: confidence.bg,
                  color: confidence.fg,
                  borderRadius: 999,
                  whiteSpace: "nowrap"
                }}
              >
                {confidence.label}
              </span>
            ) : null}
          </div>
        </td>
        <td style={{ padding: 4 }}>
          <select
            className="s7-input"
            value={item.rowType}
            disabled={isAi}
            onChange={(e) => onPatch({ rowType: e.target.value })}
            style={{ width: 150 }}
          >
            {!rowTypes.some((rt) => rt.value === item.rowType) ? (
              <option value={item.rowType}>{item.rowType}</option>
            ) : null}
            {rowTypes.map((rt) => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </select>
        </td>
        {item.discipline === "Prv" ? (
          <td colSpan={Math.max(1, headerColumns.length)} style={{ padding: 4 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                Provisional amount $
              </span>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                defaultValue={item.provisionalAmount ?? ""}
                disabled={isAi}
                style={{ width: 140 }}
                onBlur={(e) => {
                  const n = e.target.value === "" ? null : Number(e.target.value);
                  onPatch({ provisionalAmount: n });
                }}
              />
            </label>
          </td>
        ) : (
          headerColumns.map((col) => (
            <td key={col} style={{ padding: 4 }}>
              {rowCols.includes(col) ? (
                <CellInput
                  col={col}
                  item={item}
                  disabled={isAi}
                  onPatch={onPatch}
                  debouncedPatch={debouncedPatch}
                />
              ) : (
                <span style={{ color: "var(--text-muted)" }}>—</span>
              )}
            </td>
          ))
        )}
        <td style={{ padding: 4, textAlign: "right" }}>
          {isAi ? (
            <div style={{ display: "inline-flex", gap: 4 }}>
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                onClick={onConfirm}
                title="Confirm into estimate"
              >
                ✓ Confirm
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={onExclude}
                style={{ color: "var(--status-danger, #EF4444)" }}
              >
                ✕ Exclude
              </button>
            </div>
          ) : (
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                aria-label="Row actions"
                onClick={() => setMenuOpen((v) => !v)}
              >
                ⋮
              </button>
              {menuOpen ? (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    background: "var(--surface, #fff)",
                    border: "1px solid var(--border, #e5e7eb)",
                    borderRadius: 6,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    zIndex: 20,
                    minWidth: 140
                  }}
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    type="button"
                    style={menuItemStyle}
                    onClick={() => {
                      setMenuOpen(false);
                      onDuplicate();
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    style={{ ...menuItemStyle, color: "var(--status-danger, #EF4444)" }}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </td>
      </tr>
      {notesEnabled && rowCols.includes("notes") ? (
        <tr style={{ background: baseBg }}>
          <td colSpan={headerColumns.length + 4} style={{ padding: "0 6px 6px" }}>
            <textarea
              className="s7-input"
              placeholder="Notes"
              defaultValue={item.notes ?? ""}
              disabled={isAi}
              rows={2}
              style={{ width: "100%", minHeight: 48, resize: "vertical" }}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (item.notes ?? "")) onPatch({ notes: v });
              }}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 12px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 13
};

function CellInput({
  col,
  item,
  disabled,
  onPatch,
  debouncedPatch
}: {
  col: string;
  item: ScopeItem;
  disabled: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  debouncedPatch: (key: string, body: Record<string, unknown>) => void;
}) {
  switch (col) {
    case "men":
    case "days":
      return (
        <input
          className="s7-input"
          type="number"
          step="0.01"
          defaultValue={item[col as "men" | "days"] ?? ""}
          disabled={disabled}
          style={{ width: 64 }}
          onBlur={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onPatch({ [col]: n });
          }}
        />
      );
    case "shift":
      return (
        <select
          className="s7-input"
          value={item.shift ?? ""}
          disabled={disabled}
          style={{ width: 100 }}
          onChange={(e) => onPatch({ shift: e.target.value || null })}
        >
          <option value="">—</option>
          <option value="Day">Day</option>
          <option value="Night">Night</option>
          <option value="Weekend">Weekend</option>
        </select>
      );
    case "measurementQty":
      return (
        <div style={{ display: "inline-flex", gap: 4 }}>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={item.measurementQty ?? ""}
            disabled={disabled}
            style={{ width: 64 }}
            onBlur={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              onPatch({ measurementQty: n });
            }}
          />
          <ScopeListDropdown
            slug="measurement-units"
            value={item.measurementUnit}
            disabled={disabled}
            width={84}
            onChange={(v) => onPatch({ measurementUnit: v })}
          />
        </div>
      );
    case "measurementUnit":
      // Rendered alongside measurementQty — skip standalone cell.
      return null;
    case "material":
      return (
        <ScopeListDropdown
          slug="materials"
          value={item.material}
          disabled={disabled}
          width={140}
          onChange={(v) => onPatch({ material: v })}
        />
      );
    case "plantAssetId":
      return (
        <ScopeListDropdown
          slug="plant"
          value={item.plantAssetId}
          disabled={disabled}
          width={160}
          allowAdd={false}
          placeholder="Choose asset…"
          onChange={(v) => onPatch({ plantAssetId: v })}
        />
      );
    case "wasteGroup":
    case "wasteType":
    case "wasteFacility":
      return (
        <input
          className="s7-input"
          defaultValue={item[col as keyof ScopeItem] as string | null ?? ""}
          disabled={disabled}
          style={{ width: 120 }}
          onBlur={(e) => {
            const v = e.target.value || null;
            debouncedPatch(col, { [col]: v });
          }}
        />
      );
    case "wasteTonnes":
      return (
        <input
          className="s7-input"
          type="number"
          step="0.01"
          defaultValue={item.wasteTonnes ?? ""}
          disabled={disabled}
          style={{ width: 80 }}
          onBlur={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onPatch({ wasteTonnes: n });
          }}
        />
      );
    case "wasteLoads":
      return (
        <input
          className="s7-input"
          type="number"
          defaultValue={item.wasteLoads ?? ""}
          disabled={disabled}
          style={{ width: 60 }}
          onBlur={(e) => {
            const n = e.target.value === "" ? null : parseInt(e.target.value, 10);
            onPatch({ wasteLoads: Number.isNaN(n) ? null : n });
          }}
        />
      );
    default:
      return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
}
