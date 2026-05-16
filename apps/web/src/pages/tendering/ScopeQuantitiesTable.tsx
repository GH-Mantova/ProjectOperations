import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// PR A1 (2026-05-16) — 4-code discipline system (DEM/CIV/ASB/Other).
export type Discipline = "DEM" | "CIV" | "ASB" | "Other";

// PR B1.6 — canonical items table per docs/Designs/scope-of-works-redesign.md.
// Fixed column set; no row-type, no per-discipline column toggle, no
// view-config endpoint. Each row has: WBS / Description / Men / Days /
// Plant 1...N / Waste group / Waste item / Unit / Value / Waste? /
// Notes / Delete.

// PR B1.6 — Plant cells are stored on ScopeOfWorksItem.plantItems as
// a dense array with explicit columnIndex. Plant 1 has columnIndex 1.
// Plant N reads plantItems.find(p => p.columnIndex === N).
export type ScopePlantEntry = {
  columnIndex: number;
  plantRateId?: string;
  description?: string;
  qty?: number;
  days?: number;
  unit?: string;
};

export type ScopeItem = {
  id: string;
  tenderId: string;
  cardId: string | null;
  wbsCode: string;
  itemNumber: number;
  description: string;
  status: "draft" | "confirmed" | "excluded";
  aiProposed: boolean;
  aiConfidence: string | null;
  sortOrder: number;
  notes: string | null;
  men: string | null;
  days: string | null;
  // B1.6 — new canonical columns
  unit: string | null;
  value: string | null;
  wasteGroup: string | null;
  wasteItem: string | null;
  wasteIncluded: boolean;
  // B1.5.2 — multi-plant JSON array
  plantItems: ScopePlantEntry[] | null;
  // Legacy fields still in the API response (hidden in B1.6 UI)
  estimateItemId: string | null;
  provisionalAmount: string | null;
};

// PR B1.6 — Unit dropdown values are hardcoded per design doc line 309.
const UNIT_OPTIONS = ["m²", "m³", "t", "ea"] as const;

// PlantRate shape from /estimate-rates/plant (decision #4 in B1.6
// investigation: use rate-card source, not the Asset GlobalList).
type PlantRate = {
  id: string;
  name: string;
  category: string | null;
  ratePerDay: string | number | null;
  unit: string | null;
  isActive: boolean;
};

// WasteRate shape from /estimate-rates/waste. Distinct values of
// wasteGroup / wasteType drive the two dropdowns (decision #5).
type WasteRate = {
  id: string;
  wasteGroup: string;
  wasteType: string;
  facility: string;
  unit: string;
  isActive: boolean;
};

const CONFIDENCE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  high: { bg: "#DCFCE7", fg: "#166534", label: "High" },
  medium: { bg: "#FEF3C7", fg: "#854F0B", label: "Medium" },
  low: { bg: "#FEE2E2", fg: "#991B1B", label: "Low" }
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

type Props = {
  tenderId: string;
  cardId: string;
  /** PR B1.6 — Plant column count from parent ScopeCard. Min 1. */
  plantColumnCount: number;
  discipline: Discipline;
  items: ScopeItem[];
  subtotal: number;
  subtotalWithMarkup: number;
  onItemsChanged: () => Promise<void> | void;
  /** PR B1.6 — invoked when user clicks "+" or "×" on a Plant column. */
  onPlantColumnCountChange: (next: number) => Promise<void>;
};

export function ScopeQuantitiesTable({
  tenderId,
  cardId,
  plantColumnCount,
  discipline,
  items,
  subtotal,
  subtotalWithMarkup,
  onItemsChanged,
  onPlantColumnCountChange
}: Props) {
  const { authFetch } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [deleteWarning, setDeleteWarning] = useState<ScopeItem | null>(null);
  const [plantRates, setPlantRates] = useState<PlantRate[]>([]);
  const [wasteRates, setWasteRates] = useState<WasteRate[]>([]);

  // Load plant + waste rate cards once. Both feed dropdown options.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plantRes, wasteRes] = await Promise.all([
          authFetch("/estimate-rates/plant"),
          authFetch("/estimate-rates/waste")
        ]);
        if (!cancelled) {
          if (plantRes.ok) {
            const body = (await plantRes.json()) as PlantRate[];
            setPlantRates(body.filter((p) => p.isActive));
          }
          if (wasteRes.ok) {
            const body = (await wasteRes.json()) as WasteRate[];
            setWasteRates(body.filter((w) => w.isActive));
          }
        }
      } catch {
        // Non-fatal — dropdowns render empty if endpoints fail.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Derived: distinct waste groups and a group → items lookup.
  const wasteGroups = useMemo(
    () => Array.from(new Set(wasteRates.map((w) => w.wasteGroup))).sort(),
    [wasteRates]
  );
  const wasteItemsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of wasteRates) {
      const arr = map.get(r.wasteGroup) ?? [];
      if (!arr.includes(r.wasteType)) arr.push(r.wasteType);
      map.set(r.wasteGroup, arr);
    }
    for (const [k, v] of map) map.set(k, v.sort());
    return map;
  }, [wasteRates]);

  const patchItem = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      setPendingIds((s) => new Set(s).add(id));
      try {
        const response = await authFetch(`/tenders/${tenderId}/scope/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
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
    },
    [authFetch, tenderId, onItemsChanged]
  );

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
    // PR B1.6 — items are created via the card-scoped endpoint.
    // rowType is required by the legacy DTO; default to "general-labour"
    // for now (B1.6 doesn't surface rowType in the UI; A future PR can
    // drop the field entirely).
    const response = await authFetch(`/tenders/${tenderId}/scope/cards/${cardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rowType: "general-labour",
        description: ""
      })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await onItemsChanged();
  };

  // PR B1.6 — Plant column add/remove handlers.
  const addPlantColumn = async () => {
    try {
      await onPlantColumnCountChange(plantColumnCount + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removePlantColumn = async (columnIndex: number) => {
    if (columnIndex < 2) return; // Plant 1 is never removable.
    // Confirm if ANY row in the card has data populated at this columnIndex.
    const rowsWithData = items.filter((i) =>
      Array.isArray(i.plantItems) && i.plantItems.some((p) => p.columnIndex === columnIndex)
    );
    if (rowsWithData.length > 0) {
      const ok = window.confirm(
        `Remove Plant ${columnIndex}? ${rowsWithData.length} row${rowsWithData.length === 1 ? "" : "s"} ` +
          `in this card ${rowsWithData.length === 1 ? "has" : "have"} data in Plant ${columnIndex}. ` +
          `That data will be deleted.`
      );
      if (!ok) return;
      // Strip the column's data from every row.
      for (const row of rowsWithData) {
        const stripped = (row.plantItems ?? []).filter((p) => p.columnIndex !== columnIndex);
        await patchItem(row.id, { plantItems: stripped });
      }
    }
    try {
      await onPlantColumnCountChange(plantColumnCount - 1);
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

  const plantColumns = Array.from({ length: Math.max(1, plantColumnCount) }, (_, i) => i + 1);

  return (
    <section className="s7-card" style={{ padding: 16 }}>
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
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ marginLeft: 8, background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
          >
            ✕
          </button>
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--surface-muted, #F6F6F6)", position: "sticky", top: 0 }}>
            <tr>
              <th style={thStyle}>WBS</th>
              <th style={{ ...thStyle, minWidth: 200 }}>Description</th>
              <th style={thStyle}>Men</th>
              <th style={thStyle}>Days</th>
              {plantColumns.map((n) => (
                <th key={`plant-${n}`} style={{ ...thStyle, minWidth: 180 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Plant {n}
                    {n >= 2 ? (
                      <button
                        type="button"
                        aria-label={`Remove Plant ${n} column`}
                        title={`Remove Plant ${n} column`}
                        onClick={() => void removePlantColumn(n)}
                        style={removePlantBtnStyle}
                      >
                        ×
                      </button>
                    ) : null}
                    {n === plantColumns[plantColumns.length - 1] ? (
                      <button
                        type="button"
                        aria-label="Add Plant column"
                        title="Add Plant column"
                        onClick={() => void addPlantColumn()}
                        style={addPlantBtnStyle}
                      >
                        +
                      </button>
                    ) : null}
                  </span>
                </th>
              ))}
              <th style={thStyle}>Waste group</th>
              <th style={thStyle}>Waste item</th>
              <th style={thStyle}>Unit</th>
              <th style={thStyle}>Value</th>
              <th style={thStyle}>Waste?</th>
              <th style={{ ...thStyle, minWidth: 160 }}>Notes</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {wbsSortedVisible.length === 0 ? (
              <tr>
                <td
                  colSpan={9 + plantColumns.length}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "var(--text-muted)"
                  }}
                >
                  No items yet. Click <strong>+ Add row</strong> below to start.
                </td>
              </tr>
            ) : (
              wbsSortedVisible.map((item) => (
                <QuantityRow
                  key={item.id}
                  item={item}
                  plantColumns={plantColumns}
                  plantRates={plantRates}
                  wasteGroups={wasteGroups}
                  wasteItemsByGroup={wasteItemsByGroup}
                  isPending={pendingIds.has(item.id)}
                  onPatch={(body) => void patchItem(item.id, body)}
                  onConfirm={() => void confirmItem(item.id)}
                  onExclude={() => void excludeItem(item.id)}
                  onDelete={() => deleteItem(item)}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={9 + plantColumns.length} style={{ padding: "8px 4px" }}>
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  onClick={() => void addItem()}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", border: "1px dashed var(--border, #e5e7eb)" }}
                >
                  + Add row
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 12 }}>
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

const addPlantBtnStyle: React.CSSProperties = {
  background: "var(--brand-primary, #005B61)",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  width: 18,
  height: 18,
  fontSize: 12,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0
};

const removePlantBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--text-muted)",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 999,
  width: 16,
  height: 16,
  fontSize: 11,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0
};

type RowProps = {
  item: ScopeItem;
  plantColumns: number[];
  plantRates: PlantRate[];
  wasteGroups: string[];
  wasteItemsByGroup: Map<string, string[]>;
  isPending: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onConfirm: () => void;
  onExclude: () => void;
  onDelete: () => void;
};

function QuantityRow({
  item,
  plantColumns,
  plantRates,
  wasteGroups,
  wasteItemsByGroup,
  isPending,
  onPatch,
  onConfirm,
  onExclude,
  onDelete
}: RowProps) {
  const isAi = item.aiProposed && item.status !== "confirmed";
  const confidence = item.aiConfidence ? CONFIDENCE_STYLE[item.aiConfidence] : null;
  const baseBg = isAi ? "#FEF3C7" : undefined;

  // Lookup helper for plant cell at columnIndex.
  const plantAt = (columnIndex: number): ScopePlantEntry | undefined =>
    Array.isArray(item.plantItems)
      ? item.plantItems.find((p) => p.columnIndex === columnIndex)
      : undefined;

  const updatePlant = (columnIndex: number, patch: Partial<ScopePlantEntry> | null) => {
    const current = Array.isArray(item.plantItems) ? item.plantItems : [];
    let next: ScopePlantEntry[];
    if (patch === null) {
      next = current.filter((p) => p.columnIndex !== columnIndex);
    } else {
      const existing = current.find((p) => p.columnIndex === columnIndex);
      if (existing) {
        next = current.map((p) => (p.columnIndex === columnIndex ? { ...p, ...patch } : p));
      } else {
        next = [...current, { columnIndex, ...patch }];
      }
    }
    onPatch({ plantItems: next });
  };

  const wasteItemOptions = item.wasteGroup ? wasteItemsByGroup.get(item.wasteGroup) ?? [] : [];

  return (
    <tr style={{ borderTop: "1px solid var(--border, #e5e7eb)", background: baseBg }}>
      <td style={tdStyle}>
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
          <span style={{ color: "#005B61", fontWeight: 500, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
            {item.wbsCode}
          </span>
          {isPending ? <span style={{ color: "var(--text-muted)", fontSize: 10 }}>···</span> : null}
        </div>
      </td>
      <td style={tdStyle}>
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
      <td style={tdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.01"
          defaultValue={item.men ?? ""}
          disabled={isAi}
          style={{ width: 64 }}
          onBlur={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onPatch({ men: n });
          }}
        />
      </td>
      <td style={tdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.01"
          defaultValue={item.days ?? ""}
          disabled={isAi}
          style={{ width: 64 }}
          onBlur={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onPatch({ days: n });
          }}
        />
      </td>
      {plantColumns.map((n) => {
        const cell = plantAt(n);
        return (
          <td key={`plant-${n}`} style={tdStyle}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <select
                className="s7-input"
                value={cell?.plantRateId ?? ""}
                disabled={isAi}
                style={{ minWidth: 110, flex: 1 }}
                onChange={(e) => {
                  const rateId = e.target.value;
                  if (!rateId) {
                    updatePlant(n, null);
                    return;
                  }
                  const rate = plantRates.find((p) => p.id === rateId);
                  updatePlant(n, {
                    plantRateId: rateId,
                    description: rate?.name ?? "",
                    unit: rate?.unit ?? "day"
                  });
                }}
              >
                <option value="">—</option>
                {plantRates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                className="s7-input"
                type="number"
                step="1"
                placeholder="qty"
                defaultValue={cell?.qty ?? ""}
                disabled={isAi}
                style={{ width: 48 }}
                onBlur={(e) => {
                  const v = e.target.value === "" ? undefined : Number(e.target.value);
                  if (cell) updatePlant(n, { qty: v });
                }}
                title="Quantity"
              />
              <input
                className="s7-input"
                type="number"
                step="0.5"
                placeholder="days"
                defaultValue={cell?.days ?? ""}
                disabled={isAi}
                style={{ width: 48 }}
                onBlur={(e) => {
                  const v = e.target.value === "" ? undefined : Number(e.target.value);
                  if (cell) updatePlant(n, { days: v });
                }}
                title="Days"
              />
            </div>
          </td>
        );
      })}
      <td style={tdStyle}>
        <select
          className="s7-input"
          value={item.wasteGroup ?? ""}
          disabled={isAi}
          style={{ minWidth: 110 }}
          onChange={(e) => {
            const v = e.target.value || null;
            // Changing group clears item; user re-picks.
            onPatch({ wasteGroup: v, wasteItem: null });
          }}
        >
          <option value="">—</option>
          {wasteGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </td>
      <td style={tdStyle}>
        <select
          className="s7-input"
          value={item.wasteItem ?? ""}
          disabled={isAi || !item.wasteGroup}
          style={{ minWidth: 140 }}
          onChange={(e) => onPatch({ wasteItem: e.target.value || null })}
        >
          <option value="">—</option>
          {wasteItemOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </td>
      <td style={tdStyle}>
        <select
          className="s7-input"
          value={item.unit ?? ""}
          disabled={isAi}
          style={{ width: 64 }}
          onChange={(e) => onPatch({ unit: e.target.value || null })}
        >
          <option value="">—</option>
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>
      <td style={tdStyle}>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          defaultValue={item.value ?? ""}
          disabled={isAi}
          style={{ width: 72 }}
          onBlur={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            onPatch({ value: v });
          }}
        />
      </td>
      <td style={{ ...tdStyle, textAlign: "center" }}>
        <input
          type="checkbox"
          checked={item.wasteIncluded === true}
          disabled={isAi}
          onChange={(e) => onPatch({ wasteIncluded: e.target.checked })}
          aria-label="Include in waste summary"
        />
      </td>
      <td style={tdStyle}>
        <input
          className="s7-input"
          defaultValue={item.notes ?? ""}
          disabled={isAi}
          style={{ width: "100%" }}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (item.notes ?? "")) onPatch({ notes: v || null });
          }}
        />
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        {isAi ? (
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              onClick={onConfirm}
              title="Confirm into estimate"
            >
              ✓
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={onExclude}
              style={{ color: "var(--status-danger, #EF4444)" }}
              title="Exclude"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={onDelete}
            aria-label="Delete row"
            title="Delete row"
            style={{ color: "var(--status-danger, #EF4444)" }}
          >
            🗑
          </button>
        )}
      </td>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding: 4,
  verticalAlign: "middle"
};
