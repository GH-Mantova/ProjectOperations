import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "../../auth/AuthContext";
import { NotesField, TooltipSelect, type TooltipSelectOption } from "../../components";
import { computeDerivedDimensions, isDimensionOverride } from "./scopeItemDimensions";

// PR A1 (2026-05-16) — 4-code discipline system (DEM/CIV/ASB/Other).
export type Discipline = "DEM" | "CIV" | "ASB" | "Other";

// PR B1.6 — Plant cells live on ScopeOfWorksItem.plantItems as a dense
// array with explicit columnIndex. Plant N reads
// plantItems.find(p => p.columnIndex === N).
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
  // @deprecated PR B4a — legacy canonical fields; no longer surfaced
  // or written. Retained on the type so the listItems response still
  // parses cleanly for old rows.
  unit: string | null;
  value: string | null;
  wasteGroup: string | null;
  wasteItem: string | null;
  wasteIncluded: boolean;
  // PR B4a — dimension/quantification fields. sqm/m3/tonnes are
  // derived server-side; the user can override any of the three by
  // typing directly. chargeBy is the preferred billing unit for the
  // waste aggregator (null = inherit facility rate.unit).
  // cuttingIncluded mirrors wasteIncluded for the cutting subtable
  // (aggregator wired in B4b; UI shipped in B4a).
  length: string | null;
  height: string | null;
  depth: string | null;
  sqm: string | null;
  m3: string | null;
  density: string | null;
  tonnes: string | null;
  chargeBy: string | null;
  materialType: string | null;
  cuttingIncluded: boolean;
  plantItems: ScopePlantEntry[] | null;
  estimateItemId: string | null;
  provisionalAmount: string | null;
  // PR B1.7.1 — per-row totals computed server-side in listItems.
  // Both fields are optional so older API responses don't break the
  // type; the header renders "—" when either is null/undefined.
  lineTotal?: number | string | null;
  lineTotalWithMarkup?: number | string | null;
};

// PR B1.7 — actual shape from GET /estimate-rates/plant matches the
// EstimatePlantRate model. The previous PR B1.6 type used fictional
// field names (name/category/ratePerDay) which caused empty options.
type PlantRate = {
  id: string;
  item: string;
  unit: string;
  rate: string;
  fuelRate: string;
  isActive: boolean;
};

type WasteRate = {
  id: string;
  wasteGroup: string | null;
  wasteType: string;
  facility: string;
  unit: string;
  isActive: boolean;
};

type MaterialDensityRate = {
  id: string;
  materialName: string;
  density: string;
  unit: string;
  category: string | null;
  isActive: boolean;
};

const CONFIDENCE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  high: { bg: "#DCFCE7", fg: "#166534", label: "High" },
  medium: { bg: "#FEF3C7", fg: "#854F0B", label: "Medium" },
  low: { bg: "#FEE2E2", fg: "#991B1B", label: "Low" }
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(n);
}

type Props = {
  tenderId: string;
  cardId: string;
  plantColumnCount: number;
  discipline: Discipline;
  items: ScopeItem[];
  onItemsChanged: () => Promise<void> | void;
  onPlantColumnCountChange: (next: number) => Promise<void>;
};

export function ScopeQuantitiesTable({
  tenderId,
  cardId,
  plantColumnCount,
  discipline: _discipline,
  items,
  onItemsChanged,
  onPlantColumnCountChange
}: Props) {
  const { authFetch } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [deleteWarning, setDeleteWarning] = useState<ScopeItem | null>(null);
  const [plantRates, setPlantRates] = useState<PlantRate[]>([]);
  const [wasteRates, setWasteRates] = useState<WasteRate[]>([]);
  const [materialDensities, setMaterialDensities] = useState<MaterialDensityRate[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Items created in the current session — auto-expand them on first render.
  const autoExpandedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plantRes, wasteRes, densityRes] = await Promise.all([
          authFetch("/estimate-rates/plant"),
          authFetch("/estimate-rates/waste"),
          authFetch("/estimate-rates/material-densities")
        ]);
        if (cancelled) return;
        if (plantRes.ok) {
          const body = (await plantRes.json()) as PlantRate[];
          setPlantRates(body.filter((p) => p.isActive));
        }
        if (wasteRes.ok) {
          const body = (await wasteRes.json()) as WasteRate[];
          setWasteRates(body.filter((w) => w.isActive));
        }
        if (densityRes.ok) {
          const body = (await densityRes.json()) as MaterialDensityRate[];
          setMaterialDensities(body.filter((d) => d.isActive));
        }
      } catch {
        // Non-fatal — dropdowns just render empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Distinct waste groups + group → items lookup.
  const wasteGroupOptions = useMemo<TooltipSelectOption<string>[]>(
    () =>
      Array.from(new Set(wasteRates.map((w) => w.wasteGroup).filter((g): g is string => !!g)))
        .sort()
        .map((g) => ({ value: g, label: g })),
    [wasteRates]
  );
  const wasteItemsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of wasteRates) {
      if (!r.wasteGroup) continue;
      const arr = map.get(r.wasteGroup) ?? [];
      if (!arr.includes(r.wasteType)) arr.push(r.wasteType);
      map.set(r.wasteGroup, arr);
    }
    for (const [k, v] of map) map.set(k, v.sort());
    return map;
  }, [wasteRates]);

  const plantOptions = useMemo<TooltipSelectOption<string>[]>(
    () => plantRates.map((p) => ({ value: p.id, label: p.item })),
    [plantRates]
  );

  const materialOptions = useMemo<TooltipSelectOption<string>[]>(
    () => materialDensities.map((d) => ({ value: d.materialName, label: `${d.materialName} (${d.density} ${d.unit})` })),
    [materialDensities]
  );

  // Map materialName → density for quick lookup on select.
  const materialDensityMap = useMemo(() => {
    const map = new Map<string, { density: string; unit: string }>();
    for (const d of materialDensities) map.set(d.materialName, { density: d.density, unit: d.unit });
    return map;
  }, [materialDensities]);

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
    // PR B1.7 — new CreateScopeItemInCardDto accepts an empty body.
    // Server derives discipline from the parent card and defaults
    // rowType to "general-labour".
    const response = await authFetch(`/tenders/${tenderId}/scope/cards/${cardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "" })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    // Best-effort grab of the new id so we can auto-expand it on next render.
    try {
      const created = (await response.json()) as { id?: string } | null;
      if (created?.id) autoExpandedRef.current.add(created.id);
    } catch {
      // Ignore body-parse failure — auto-expand is a nice-to-have.
    }
    await onItemsChanged();
  };

  const addPlantColumn = async () => {
    try {
      await onPlantColumnCountChange(plantColumnCount + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removePlantColumn = async (columnIndex: number) => {
    if (columnIndex < 2) return; // Plant 1 is never removable.
    const rowsWithData = items.filter(
      (i) => Array.isArray(i.plantItems) && i.plantItems.some((p) => p.columnIndex === columnIndex)
    );
    if (rowsWithData.length > 0) {
      const ok = window.confirm(
        `Remove Plant ${columnIndex}? ${rowsWithData.length} row${rowsWithData.length === 1 ? "" : "s"} ` +
          `in this card ${rowsWithData.length === 1 ? "has" : "have"} data in Plant ${columnIndex}. ` +
          `That data will be deleted.`
      );
      if (!ok) return;
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
  // PR B2 — footer self-sums from the per-row totals (already attached
  // by the items API in B1.7.1). Each card now manages its own subtotal
  // independently of the whole-discipline /scope/summary aggregate, so
  // per-card markup overrides reflect immediately and accurately.
  const subtotal = useMemo(
    () => visible.reduce((sum, i) => sum + (i.lineTotal != null ? Number(i.lineTotal) : 0), 0),
    [visible]
  );
  const subtotalWithMarkup = useMemo(
    () =>
      visible.reduce(
        (sum, i) => sum + (i.lineTotalWithMarkup != null ? Number(i.lineTotalWithMarkup) : 0),
        0
      ),
    [visible]
  );
  const wbsSortedVisible = useMemo(
    () => [...visible].sort((a, b) => a.itemNumber - b.itemNumber || a.sortOrder - b.sortOrder),
    [visible]
  );

  // Apply auto-expand on next render after addItem.
  useEffect(() => {
    if (autoExpandedRef.current.size === 0) return;
    const next = new Set(expandedIds);
    let changed = false;
    for (const id of autoExpandedRef.current) {
      if (visible.some((i) => i.id === id) && !next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) setExpandedIds(next);
  }, [visible, expandedIds]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {wbsSortedVisible.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--text-muted)",
              border: "1px dashed var(--border-default, #e5e7eb)",
              borderRadius: 8
            }}
          >
            No items yet. Click <strong>+ Add row</strong> below to start.
          </div>
        ) : (
          wbsSortedVisible.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              expanded={expandedIds.has(item.id)}
              onToggle={() => toggleExpanded(item.id)}
              plantColumns={plantColumns}
              plantOptions={plantOptions}
              plantRates={plantRates}
              wasteGroupOptions={wasteGroupOptions}
              wasteItemsByGroup={wasteItemsByGroup}
              materialOptions={materialOptions}
              materialDensityMap={materialDensityMap}
              isPending={pendingIds.has(item.id)}
              onPatch={(body) => void patchItem(item.id, body)}
              onConfirm={() => void confirmItem(item.id)}
              onExclude={() => void excludeItem(item.id)}
              onDelete={() => deleteItem(item)}
              onAddPlantColumn={addPlantColumn}
              onRemovePlantColumn={removePlantColumn}
            />
          ))
        )}

        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => void addItem()}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            border: "1px dashed var(--border-default, #e5e7eb)"
          }}
        >
          + Add row
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 16 }}>
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
              <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setDeleteWarning(null)}>
                Cancel
              </button>
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

// ── ItemCard ────────────────────────────────────────────────────────────

type ItemCardProps = {
  item: ScopeItem;
  expanded: boolean;
  onToggle: () => void;
  plantColumns: number[];
  plantOptions: TooltipSelectOption<string>[];
  plantRates: PlantRate[];
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, { density: string; unit: string }>;
  isPending: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onConfirm: () => void;
  onExclude: () => void;
  onDelete: () => void;
  onAddPlantColumn: () => void;
  onRemovePlantColumn: (columnIndex: number) => void;
};

function ItemCard({
  item,
  expanded,
  onToggle,
  plantColumns,
  plantOptions,
  plantRates,
  wasteGroupOptions,
  wasteItemsByGroup,
  materialOptions,
  materialDensityMap,
  isPending,
  onPatch,
  onConfirm,
  onExclude,
  onDelete,
  onAddPlantColumn,
  onRemovePlantColumn
}: ItemCardProps) {
  const isAi = item.aiProposed && item.status !== "confirmed";
  const confidence = item.aiConfidence ? CONFIDENCE_STYLE[item.aiConfidence] : null;
  const baseBg = isAi ? "#FEF3C7" : "var(--surface-card, #fff)";

  const plantAt = (columnIndex: number): ScopePlantEntry | undefined =>
    Array.isArray(item.plantItems) ? item.plantItems.find((p) => p.columnIndex === columnIndex) : undefined;

  const updatePlant = (columnIndex: number, patch: Partial<ScopePlantEntry> | null) => {
    const current = Array.isArray(item.plantItems) ? item.plantItems : [];
    let next: ScopePlantEntry[];
    if (patch === null) {
      next = current.filter((p) => p.columnIndex !== columnIndex);
    } else {
      const existing = current.find((p) => p.columnIndex === columnIndex);
      next = existing
        ? current.map((p) => (p.columnIndex === columnIndex ? { ...p, ...patch } : p))
        : [...current, { columnIndex, ...patch }];
    }
    onPatch({ plantItems: next });
  };

  const wasteItemOptions: TooltipSelectOption<string>[] = item.wasteGroup
    ? (wasteItemsByGroup.get(item.wasteGroup) ?? []).map((w) => ({ value: w, label: w }))
    : [];

  // PR B4a / B4a.5 — controlled state for the 7 dimension fields.
  // Held as strings so we can distinguish "" (no value) from "0".
  // Synced from props whenever the upstream `item` changes.
  type DimKey = "length" | "height" | "depth" | "sqm" | "m3" | "density" | "tonnes";
  const initDim = (v: string | null) => (v == null ? "" : String(v));
  const [dims, setDims] = useState({
    length: initDim(item.length),
    height: initDim(item.height),
    depth: initDim(item.depth),
    sqm: initDim(item.sqm),
    m3: initDim(item.m3),
    density: initDim(item.density),
    tonnes: initDim(item.tonnes)
  });
  // Track which derived fields hold an explicit override (saved value
  // differs from what auto-derive would produce from raw inputs alone).
  const [dirty, setDirty] = useState({ sqm: false, m3: false, tonnes: false });

  // Re-sync local state when the upstream row is refreshed.
  useEffect(() => {
    setDims({
      length: initDim(item.length),
      height: initDim(item.height),
      depth: initDim(item.depth),
      sqm: initDim(item.sqm),
      m3: initDim(item.m3),
      density: initDim(item.density),
      tonnes: initDim(item.tonnes)
    });

    const autoDerived = computeDerivedDimensions({
      length: item.length == null ? null : Number(item.length),
      height: item.height == null ? null : Number(item.height),
      depth: item.depth == null ? null : Number(item.depth),
      density: item.density == null ? null : Number(item.density),
      sqm: null,
      m3: null,
      tonnes: null
    });

    setDirty({
      sqm: isDimensionOverride(item.sqm, autoDerived.sqm),
      m3: isDimensionOverride(item.m3, autoDerived.m3),
      tonnes: isDimensionOverride(item.tonnes, autoDerived.tonnes)
    });
  }, [item.id, item.length, item.height, item.depth, item.sqm, item.m3, item.density, item.tonnes]);

  const setDim = (k: DimKey, v: string) => {
    setDims((s) => ({ ...s, [k]: v }));
    setDirty((d) => {
      const next = { ...d };
      // Editing the field itself makes it a new override.
      if (k === "sqm" || k === "m3" || k === "tonnes") {
        next[k] = true;
      }
      // Editing an upstream releases all downstream overrides so the
      // live auto-derive can take over. The user can re-override the
      // downstream by typing into it again afterward.
      if (k === "length" || k === "height") {
        next.sqm = false;
        next.m3 = false;
        next.tonnes = false;
      } else if (k === "depth") {
        next.m3 = false;
        next.tonnes = false;
      } else if (k === "density") {
        next.tonnes = false;
      } else if (k === "sqm") {
        next.m3 = false;
        next.tonnes = false;
      } else if (k === "m3") {
        next.tonnes = false;
      }
      return next;
    });
  };

  // Live-derive sqm/m3/tonnes. Only fields the user has explicitly
  // touched in this session count as overrides; persisted-but-not-
  // edited values are treated as null (= derive) so cascading
  // recompute fires when a raw input changes.
  const parsed = useMemo(
    () => ({
      length: dims.length === "" ? null : Number(dims.length),
      height: dims.height === "" ? null : Number(dims.height),
      depth: dims.depth === "" ? null : Number(dims.depth),
      density: dims.density === "" ? null : Number(dims.density),
      sqm: dirty.sqm && dims.sqm !== "" ? Number(dims.sqm) : null,
      m3: dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : null,
      tonnes: dirty.tonnes && dims.tonnes !== "" ? Number(dims.tonnes) : null
    }),
    [dims, dirty]
  );
  const derived = useMemo(() => computeDerivedDimensions(parsed), [parsed]);

  // PR B4a.5 — send the FULL dimension picture on blur. Backend
  // persists exactly what we ship (no server-side derive); the value
  // we send for each derived field is either the user's explicit
  // override (when dirty) or the live-derived value (when not).
  const persistDims = () => {
    const sqmToSave = dirty.sqm && dims.sqm !== "" ? Number(dims.sqm) : derived.sqm;
    const m3ToSave = dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : derived.m3;
    const tonnesToSave = dirty.tonnes && dims.tonnes !== "" ? Number(dims.tonnes) : derived.tonnes;

    // PR B4a.6 — client-side overflow guard. The Prisma Decimal columns
    // have hard precision limits (length/height/depth = Decimal(10,3);
    // density = Decimal(8,3) after the B4a.6 widening; sqm/m3/tonnes =
    // Decimal(10,2)). A value past those ceilings throws "numeric field
    // overflow" on the server and leaves the row in an unsaveable state.
    // Reject locally instead — the typed value stays in the field so the
    // user can fix it, but no PATCH fires until it's in range.
    const MAX_DIM = 9999999; // Decimal(10,3) ceiling for length/height/depth
    const MAX_DENSITY = 99999; // Decimal(8,3) ceiling for density
    const MAX_DERIVED = 99999999; // Decimal(10,2) ceiling for sqm/m3/tonnes
    const inRange = (v: number | null, max: number) =>
      v == null || (Number.isFinite(v) && Math.abs(v) < max);
    const valid =
      inRange(parsed.length, MAX_DIM) &&
      inRange(parsed.height, MAX_DIM) &&
      inRange(parsed.depth, MAX_DIM) &&
      inRange(parsed.density, MAX_DENSITY) &&
      inRange(sqmToSave, MAX_DERIVED) &&
      inRange(m3ToSave, MAX_DERIVED) &&
      inRange(tonnesToSave, MAX_DERIVED);
    if (!valid) {
      console.warn("Dimension PATCH rejected: value out of Decimal range", {
        parsed,
        sqmToSave,
        m3ToSave,
        tonnesToSave
      });
      return;
    }

    onPatch({
      length: parsed.length,
      height: parsed.height,
      depth: parsed.depth,
      density: parsed.density,
      sqm: sqmToSave,
      m3: m3ToSave,
      tonnes: tonnesToSave
    });
  };

  // PR B4a.5 — when the user hasn't touched a derived field this
  // session, its input shows the LIVE derivation directly (not just
  // as a placeholder) so cascading recompute is visible. When the
  // user has typed an explicit override, dims.X holds their value
  // and gets rendered verbatim.
  const valueFor = (k: "sqm" | "m3" | "tonnes") => {
    if (dirty[k]) return dims[k];
    const d = derived[k];
    return d == null ? "" : String(d);
  };
  const placeholderFor = (k: "sqm" | "m3" | "tonnes") => {
    const v = derived[k];
    return v == null ? "" : String(v);
  };

  return (
    <article
      style={{
        border: "1px solid var(--border-default, #e5e7eb)",
        borderRadius: 8,
        background: baseBg,
        overflow: "hidden"
      }}
    >
      {/* ── Header bar (always visible) ────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: expanded ? "var(--surface-muted, #F6F6F6)" : "transparent",
          borderBottom: expanded ? "1px solid var(--border-default, #e5e7eb)" : "none"
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse item" : "Expand item"}
          title={expanded ? "Collapse" : "Expand"}
          style={{
            width: 24,
            height: 24,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted, #6b7280)",
            padding: 0
          }}
        >
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 120ms ease" }}
          >
            <path d="M9 6l6 6l-6 6" />
          </svg>
        </button>
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
        <span
          style={{
            color: "#005B61",
            fontWeight: 500,
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
            minWidth: 66
          }}
        >
          {item.wbsCode}
        </span>
        {expanded ? (
          <input
            className="s7-input"
            defaultValue={item.description}
            disabled={isAi}
            placeholder="Description"
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== item.description) onPatch({ description: v });
            }}
            style={{ flex: 1 }}
            aria-label="Description"
          />
        ) : (
          <span
            style={{
              flex: 1,
              color: item.description ? "var(--text)" : "var(--text-muted, #9ca3af)",
              fontSize: 14
            }}
          >
            {item.description || "(no description)"}
          </span>
        )}
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
        {isPending ? <span style={{ color: "var(--text-muted)", fontSize: 10 }}>···</span> : null}
        {/* PR B1.7.1 — per-row total wired from the items API. Displays
            the with-markup value to match the table footer's "with
            markup" subtotal; "—" only when the API didn't surface a
            value (older responses, or compute failure). */}
        <span
          style={{
            minWidth: 80,
            textAlign: "right",
            fontSize: 13,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums"
          }}
          title="Line total (with markup)"
        >
          {item.lineTotalWithMarkup == null
            ? "—"
            : fmtCurrency(Number(item.lineTotalWithMarkup))}
        </span>
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
      </header>

      {/* ── Expanded body ───────────────────────────────────────────── */}
      {expanded ? (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Section A: labour + plant. Flex-wrap so Plant N clusters
              wrap onto a new line when the row overflows. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <FieldCell label="Men" width={80}>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                defaultValue={item.men ?? ""}
                disabled={isAi}
                style={{ width: 80, height: 32 }}
                onBlur={(e) => {
                  const n = e.target.value === "" ? null : Number(e.target.value);
                  onPatch({ men: n });
                }}
              />
            </FieldCell>
            <FieldCell label="Days" width={80}>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                defaultValue={item.days ?? ""}
                disabled={isAi}
                style={{ width: 80, height: 32 }}
                onBlur={(e) => {
                  const n = e.target.value === "" ? null : Number(e.target.value);
                  onPatch({ days: n });
                }}
              />
            </FieldCell>

            {plantColumns.map((n) => {
              const cell = plantAt(n);
              const isLast = n === plantColumns[plantColumns.length - 1];
              return (
                <PlantCluster
                  key={`plant-${n}`}
                  index={n}
                  cell={cell}
                  plantOptions={plantOptions}
                  plantRates={plantRates}
                  disabled={isAi}
                  removable={n >= 2}
                  isLast={isLast}
                  onChange={(patch) => updatePlant(n, patch)}
                  onAddColumn={onAddPlantColumn}
                  onRemoveColumn={() => onRemovePlantColumn(n)}
                />
              );
            })}
          </div>

          <Divider />

          {/* PR B4a — Quantification section. Four raw dimension inputs
              (L/H/D/density) drive auto-derivation of sqm/m³/tonnes;
              user can override any derived value by typing. ChargeBy
              toggle picks the preferred billing unit for the waste
              aggregator (null = inherit facility rate.unit). All 8
              fields are controlled and submit a single PATCH on blur. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <FieldCell label="Length" width={80}>
              <input
                className="s7-input"
                type="number"
                step="0.001"
                value={dims.length}
                disabled={isAi}
                style={{ width: 80, height: 32 }}
                onChange={(e) => setDim("length", e.target.value)}
                onBlur={persistDims}
              />
            </FieldCell>
            <FieldCell label="Height" width={80}>
              <input
                className="s7-input"
                type="number"
                step="0.001"
                value={dims.height}
                disabled={isAi}
                style={{ width: 80, height: 32 }}
                onChange={(e) => setDim("height", e.target.value)}
                onBlur={persistDims}
              />
            </FieldCell>
            <FieldCell label="Depth" width={80}>
              <input
                className="s7-input"
                type="number"
                step="0.001"
                value={dims.depth}
                disabled={isAi}
                style={{ width: 80, height: 32 }}
                onChange={(e) => setDim("depth", e.target.value)}
                onBlur={persistDims}
              />
            </FieldCell>
            <FieldCell label="Material" width={160}>
              <TooltipSelect
                value={item.materialType}
                options={materialOptions}
                onChange={(v) => {
                  const lookup = v ? materialDensityMap.get(v) : undefined;
                  const densityTonnes = lookup
                    ? String(Number(lookup.density) / 1000)
                    : "";
                  onPatch({
                    materialType: v,
                    density: v ? Number(densityTonnes) : null
                  });
                }}
                disabled={isAi}
                ariaLabel="Material type"
                style={{ height: 32 }}
              />
            </FieldCell>
            <FieldCell label="Density (t/m³)" width={90}>
              <input
                className="s7-input"
                type="number"
                step="0.001"
                value={dims.density}
                disabled={isAi || !!item.materialType}
                style={{
                  width: 90,
                  height: 32,
                  ...(item.materialType
                    ? { backgroundColor: "var(--surface-muted, #f3f4f6)", color: "var(--text-muted, #6b7280)" }
                    : {})
                }}
                title={item.materialType ? `Auto-set from ${item.materialType}. Clear material to edit manually.` : "Manual density (tonnes per m³)"}
                onChange={(e) => setDim("density", e.target.value)}
                onBlur={persistDims}
              />
            </FieldCell>
            <FieldCell label="Sqm" width={90}>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                value={valueFor("sqm")}
                placeholder={placeholderFor("sqm")}
                disabled={isAi}
                style={{ width: 90, height: 32 }}
                title="Auto = length × height. Type to override."
                onChange={(e) => setDim("sqm", e.target.value)}
                onBlur={persistDims}
              />
            </FieldCell>
            <FieldCell label="M³" width={90}>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                value={valueFor("m3")}
                placeholder={placeholderFor("m3")}
                disabled={isAi}
                style={{ width: 90, height: 32 }}
                title="Auto = sqm × depth. Type to override."
                onChange={(e) => setDim("m3", e.target.value)}
                onBlur={persistDims}
              />
            </FieldCell>
            <FieldCell label="Tonnes" width={90}>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                value={valueFor("tonnes")}
                placeholder={placeholderFor("tonnes")}
                disabled={isAi}
                style={{ width: 90, height: 32 }}
                title="Auto = m³ × density or sqm × density / 1000. Type to override."
                onChange={(e) => setDim("tonnes", e.target.value)}
                onBlur={persistDims}
              />
            </FieldCell>
          </div>

          <Divider />

          {/* PR B4a — Classification section. Group/Item still drive the
              waste aggregator (group key); Waste? and Cutting? checkboxes
              flag the row for the two respective aggregators (cutting
              aggregator wired in B4b). */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto auto",
              gap: 12,
              alignItems: "end"
            }}
          >
            <FieldCell label="Waste group">
              <TooltipSelect
                value={item.wasteGroup}
                options={wasteGroupOptions}
                onChange={(v) => onPatch({ wasteGroup: v, wasteItem: null })}
                disabled={isAi}
                ariaLabel="Waste group"
                style={{ height: 32 }}
              />
            </FieldCell>
            <FieldCell label="Waste item">
              <TooltipSelect
                value={item.wasteItem}
                options={wasteItemOptions}
                onChange={(v) => onPatch({ wasteItem: v })}
                disabled={isAi || !item.wasteGroup}
                ariaLabel="Waste item"
                style={{ height: 32 }}
              />
            </FieldCell>
            <FieldCell label="Waste?">
              <input
                type="checkbox"
                checked={item.wasteIncluded === true}
                disabled={isAi}
                onChange={(e) => onPatch({ wasteIncluded: e.target.checked })}
                aria-label="Include in waste summary"
                style={{ width: 20, height: 20, marginBottom: 6 }}
              />
            </FieldCell>
            <FieldCell label="Cutting?">
              <input
                type="checkbox"
                checked={item.cuttingIncluded === true}
                disabled={isAi}
                onChange={(e) => onPatch({ cuttingIncluded: e.target.checked })}
                aria-label="Include in cutting summary"
                style={{ width: 20, height: 20, marginBottom: 6 }}
              />
            </FieldCell>
          </div>

          <Divider />

          {/* Section C: notes (full width, 4-row textarea + expand modal). */}
          <NotesField
            value={item.notes}
            onSave={(v) => onPatch({ notes: v })}
            disabled={isAi}
            placeholder="Notes for this item…"
          />
        </div>
      ) : null}
    </article>
  );
}

// ── PlantCluster ────────────────────────────────────────────────────────
// 280px-wide cluster of [select rate, qty 44px, days 44px] with optional
// "×" remove button on Plant 2+ and a "+" add-Plant button after the
// trailing cluster.

function PlantCluster({
  index,
  cell,
  plantOptions,
  plantRates,
  disabled,
  removable,
  isLast,
  onChange,
  onAddColumn,
  onRemoveColumn
}: {
  index: number;
  cell: ScopePlantEntry | undefined;
  plantOptions: TooltipSelectOption<string>[];
  plantRates: PlantRate[];
  disabled: boolean;
  removable: boolean;
  isLast: boolean;
  onChange: (patch: Partial<ScopePlantEntry> | null) => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 280 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span className="s7-type-label" style={labelStyle}>
          Plant {index}
        </span>
        {removable ? (
          <button
            type="button"
            onClick={onRemoveColumn}
            aria-label={`Remove Plant ${index} column`}
            title={`Remove Plant ${index} column`}
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              border: "1px solid var(--border-default, #e5e7eb)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 10,
              lineHeight: 1,
              padding: 0
            }}
          >
            ×
          </button>
        ) : null}
        {isLast ? (
          <button
            type="button"
            onClick={onAddColumn}
            aria-label="Add Plant column"
            title="Add Plant column"
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              border: "none",
              background: "var(--brand-primary, #005B61)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 11,
              lineHeight: 1,
              padding: 0
            }}
          >
            +
          </button>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <TooltipSelect
          value={cell?.plantRateId}
          options={plantOptions}
          onChange={(v) => {
            if (!v) {
              onChange(null);
              return;
            }
            const rate = plantRates.find((p) => p.id === v);
            onChange({
              plantRateId: v,
              description: rate?.item ?? "",
              unit: rate?.unit ?? "day"
            });
          }}
          disabled={disabled}
          ariaLabel={`Plant ${index} rate`}
          style={{ flex: 1, minWidth: 0, height: 32 }}
        />
        <input
          className="s7-input"
          type="number"
          step="1"
          placeholder="qty"
          defaultValue={cell?.qty ?? ""}
          disabled={disabled}
          style={{ width: 64, height: 32, padding: "0 6px" }}
          title="Quantity"
          onBlur={(e) => {
            const v = e.target.value === "" ? undefined : Number(e.target.value);
            if (cell) onChange({ qty: v });
          }}
        />
        <input
          className="s7-input"
          type="number"
          step="0.5"
          placeholder="days"
          defaultValue={cell?.days ?? ""}
          disabled={disabled}
          style={{ width: 64, height: 32, padding: "0 6px" }}
          title="Days"
          onBlur={(e) => {
            const v = e.target.value === "" ? undefined : Number(e.target.value);
            if (cell) onChange({ days: v });
          }}
        />
      </div>
    </div>
  );
}

// ── FieldCell + Divider ─────────────────────────────────────────────────

function FieldCell({
  label,
  width,
  children
}: {
  label: string;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width }}>
      <span className="s7-type-label" style={labelStyle}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      role="separator"
      style={{
        height: 0,
        borderTop: "1px dashed var(--border-default, #e5e7eb)",
        margin: "0 -4px"
      }}
    />
  );
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted, #6b7280)"
};
