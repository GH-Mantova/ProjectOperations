import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { readApiErrorMessage } from "../../lib/api-errors";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";
import { NotesField, OverrideField, TooltipSelect, type TooltipSelectOption } from "../../components";
import { computeDerivedDimensions, isDimensionOverride } from "./scopeItemDimensions";

// SCOPE_WBS_TABLE_V1 — slice 2 of scope-card-redesign. Replaces the
// loose-field card stack with a table whose identity columns (WBS,
// Description, Markup, Item total) span all rows of a multi-row item.
// Manpower and plant keep their current inputs in the spanning middle
// cell. Measurement fields stay in place until slice 5 moves them.

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

// PR feat/scope-multi-material — additional material row on a scope item.
// Row 1 stays on the flat materialType + L/H/D + density/sqm/m3/tonnes
// columns of ScopeOfWorksItem; entries in `materials` are rows 2..N and
// carry the same shape/units. The item's total tonnes/m3 is the SUM
// across row 1 + every entry here.
export type ScopeMaterialEntry = {
  material?: string | null;
  // PR feat/scope-each-factor — kind drives formula; quantity for EACH;
  // factor for FACTOR.
  kind?: "VOLUME" | "AREA" | "EACH" | "FACTOR" | null;
  quantity?: number | null;
  factor?: number | null;
  length?: number | null;
  height?: number | null;
  depth?: number | null;
  density?: number | null;
  sqm?: number | null;
  m3?: number | null;
  tonnes?: number | null;
  // PR feat/scope-material-inline-waste — waste classification moved
  // per-material so a mixed item can attribute each material's tonnage
  // to a different (wasteGroup, wasteItem). Material 1 uses the item's
  // flat wasteGroup/wasteItem/wasteIncluded/cuttingIncluded columns;
  // Material 2..N carry their own here.
  wasteGroup?: string | null;
  wasteItem?: string | null;
  wasteIncluded?: boolean;
  cuttingIncluded?: boolean;
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
  // PR feat/scope-multi-material — rows 2..N (row 1 lives on the flat
  // dimension columns above). Null/undefined = no extra materials.
  materials?: ScopeMaterialEntry[] | null;
  // PR feat/scope-each-factor — row-1 kind/quantity/factor.
  materialKind?: "VOLUME" | "AREA" | "EACH" | "FACTOR" | null;
  quantity?: string | null;
  factor?: string | null;
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
  category: string | null;
};

// Transport items (trucks, tipper, floats) are moving to a separate
// "Transport Fees" surface. Exclude them from the plant picker.
// Trucks/tipper have category === "Truck"; plant floats have unit === "each way".
function isTransportPlant(p: PlantRate): boolean {
  return p.category === "Truck" || p.unit === "each way";
}

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
  // PR feat/scope-each-factor — kind drives which formula is used.
  kind?: "VOLUME" | "AREA" | "EACH" | "FACTOR" | null;
  category: string | null;
  // PR feat/scope-material-waste-autofill — default waste classification.
  // When present, the scope row's wasteGroup/wasteItem are auto-set from
  // these when the user picks the material, and the pickers are hidden.
  defaultWasteGroup?: string | null;
  defaultWasteItem?: string | null;
  isActive: boolean;
};

// Lookup shape used by the material dropdowns to derive density + waste
// defaults in a single map read.
type MaterialLookup = {
  density: string;
  unit: string;
  kind: "VOLUME" | "AREA" | "EACH" | "FACTOR";
  defaultWasteGroup: string | null;
  defaultWasteItem: string | null;
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

// ── Table layout helpers ─────────────────────────────────────────────────
// SCOPE_WBS_TABLE_V1 — AutoFit layout rule from the mock-up.
// "AutoFit to contents" then "AutoFit to window": every column shrinks
// to its content, the description column takes the slack.
const subtblStyle: CSSProperties = {
  width: "100%",
  tableLayout: "auto",
  borderCollapse: "collapse",
  fontSize: 13
};

// Fit cells shrink to content; description cells expand (no fit class).
const fitCellStyle: CSSProperties = {
  width: "1%",
  whiteSpace: "nowrap",
  padding: "6px 8px",
  verticalAlign: "top"
};

const descCellStyle: CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "top"
};

const thStyle: CSSProperties = {
  ...fitCellStyle,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted, #6b7280)",
  borderBottom: "1px solid var(--border-default, #e5e7eb)",
  textAlign: "left"
};

const thDescStyle: CSSProperties = {
  ...descCellStyle,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted, #6b7280)",
  borderBottom: "1px solid var(--border-default, #e5e7eb)",
  textAlign: "left"
};

const tdBorderStyle: CSSProperties = {
  borderBottom: "1px solid var(--border-default, #e5e7eb)"
};

// ── Exported pure helpers (tested by wbs-table-shell.test.tsx) ───────────

/** True when an item with rowCount rows should show the per-row remove button. */
export function shouldShowPerRowRemove(rowCount: number): boolean {
  return rowCount > 1;
}

/** True when a markup value differs from the card default (override active). */
export function isMarkupOverridden(
  localMarkup: number | null,
  cardMarkup: number
): boolean {
  return localMarkup !== null && localMarkup !== cardMarkup;
}

/** Compute the effective markup for display: local override or card default. */
export function effectiveMarkup(
  localMarkup: number | null,
  cardMarkup: number
): number {
  return localMarkup !== null ? localMarkup : cardMarkup;
}

// ── Component state types ────────────────────────────────────────────────

/** Per-item row count (slice 2 shell: stored in local state). */
type ItemRowCounts = Map<string, number>;

/** Per-item local markup override (null = inheriting card default). */
type ItemMarkupOverrides = Map<string, number | null>;

type Props = {
  tenderId: string;
  cardId: string;
  discipline: Discipline;
  items: ScopeItem[];
  /** Effective card-level markup percent (used as the inherited default). */
  cardMarkup?: number;
  onItemsChanged: () => Promise<void> | void;
};

export function ScopeQuantitiesTable({
  tenderId,
  cardId,
  discipline: _discipline,
  items,
  cardMarkup = 0,
  onItemsChanged
}: Props) {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [deleteWarning, setDeleteWarning] = useState<ScopeItem | null>(null);
  const [plantRates, setPlantRates] = useState<PlantRate[]>([]);
  const [wasteRates, setWasteRates] = useState<WasteRate[]>([]);
  const [materialDensities, setMaterialDensities] = useState<MaterialDensityRate[]>([]);

  // SCOPE_WBS_TABLE_V1 — per-item row counts (slice 2: local state only;
  // slices 3/4 will bind each row to an actual manpower/plant record).
  // Initialised to 1 for every item. When items changes (add/delete),
  // merge: preserve existing counts for surviving items, seed new ones at 1.
  const [itemRowCounts, setItemRowCounts] = useState<ItemRowCounts>(new Map());

  // SCOPE_WBS_TABLE_V1 — per-item markup override (null = inherit card).
  const [itemMarkupOverrides, setItemMarkupOverrides] = useState<ItemMarkupOverrides>(new Map());

  // Sync row counts when items list changes.
  useEffect(() => {
    setItemRowCounts((prev) => {
      const next = new Map<string, number>();
      for (const item of items) {
        next.set(item.id, prev.get(item.id) ?? 1);
      }
      return next;
    });
    setItemMarkupOverrides((prev) => {
      const next = new Map<string, number | null>();
      for (const item of items) {
        if (prev.has(item.id)) next.set(item.id, prev.get(item.id) ?? null);
      }
      return next;
    });
  }, [items]);

  const addRowToItem = useCallback((itemId: string) => {
    setItemRowCounts((prev) => {
      const next = new Map(prev);
      next.set(itemId, (prev.get(itemId) ?? 1) + 1);
      return next;
    });
  }, []);

  const removeRowFromItem = useCallback((itemId: string) => {
    setItemRowCounts((prev) => {
      const next = new Map(prev);
      const current = prev.get(itemId) ?? 1;
      if (current > 1) next.set(itemId, current - 1);
      return next;
    });
  }, []);

  const setItemMarkup = useCallback((itemId: string, value: number | null) => {
    setItemMarkupOverrides((prev) => {
      const next = new Map(prev);
      next.set(itemId, value);
      return next;
    });
  }, []);

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

  // Distinct waste groups + group -> items lookup.
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
    () => plantRates.filter((p) => !isTransportPlant(p)).map((p) => ({ value: p.id, label: p.item })),
    [plantRates]
  );

  const materialOptions = useMemo<TooltipSelectOption<string>[]>(
    () => materialDensities.map((d) => ({ value: d.materialName, label: `${d.materialName} (${d.density} ${d.unit})` })),
    [materialDensities]
  );

  // Map materialName -> density/unit/kind + default waste for quick lookup.
  const materialDensityMap = useMemo(() => {
    const map = new Map<string, MaterialLookup>();
    for (const d of materialDensities) {
      map.set(d.materialName, {
        density: d.density,
        unit: d.unit,
        kind: (d.kind ?? "VOLUME") as "VOLUME" | "AREA" | "EACH" | "FACTOR",
        defaultWasteGroup: d.defaultWasteGroup ?? null,
        defaultWasteItem: d.defaultWasteItem ?? null
      });
    }
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
        if (!response.ok) throw new Error(await readApiErrorMessage(response));
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
      setError(await readApiErrorMessage(response));
      return;
    }
    await onItemsChanged();
  };
  const excludeItem = async (id: string) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/items/${id}/exclude`, { method: "POST" });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await onItemsChanged();
  };

  const finalDelete = async (item: ScopeItem) => {
    setDeleteWarning(null);
    const response = await authFetch(`/tenders/${tenderId}/scope/items/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await onItemsChanged();
  };
  const deleteItem = async (item: ScopeItem) => {
    if (item.estimateItemId) {
      setDeleteWarning(item);
    } else {
      const ok = await confirm({
        title: "Delete scope item",
        message: `Delete ${item.wbsCode}?`,
        confirmLabel: "Delete",
        variant: "danger"
      });
      if (!ok) return;
      void finalDelete(item);
    }
  };

  // SCOPE_WBS_TABLE_V1 — "+ Add WBS item" replaces the old "+ Add row".
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
      setError(await readApiErrorMessage(response));
      return;
    }
    await onItemsChanged();
  };

  const visible = useMemo(() => items.filter((i) => i.status !== "excluded"), [items]);
  const excluded = useMemo(() => items.filter((i) => i.status === "excluded"), [items]);
  // PR B2 — footer self-sums from the per-row totals.
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
            x
          </button>
        </div>
      ) : null}

      {wbsSortedVisible.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-muted)",
            border: "1px dashed var(--border-default, #e5e7eb)",
            borderRadius: 8,
            marginBottom: 10
          }}
        >
          No items yet. Click <strong>+ Add WBS item</strong> below to start.
        </div>
      ) : (
        /* SCOPE_WBS_TABLE_V1 — AutoFit table (Word "AutoFit to contents"
           then "AutoFit to window"): table-layout:auto, fit columns use
           width:1%+nowrap so they shrink to content; description has no
           width constraint so it takes all slack. */
        <table style={subtblStyle} aria-label="WBS items">
          <colgroup>
            {/* Remove slot — always reserved so money column keeps one right edge */}
            <col />
            {/* WBS code */}
            <col />
            {/* Description — expands */}
            <col style={{ width: "100%" }} />
            {/* Manpower + Plant spanning cell */}
            <col />
            {/* Markup */}
            <col />
            {/* Item total */}
            <col />
          </colgroup>
          <thead>
            <tr>
              {/* Remove slot header — empty, always reserved */}
              <th style={thStyle} aria-label="Remove" />
              <th style={thStyle}>WBS</th>
              <th style={thDescStyle}>Description</th>
              <th style={{ ...thStyle, textAlign: "center" }}>
                <span>Manpower</span>
                {/* Plant header is co-located; slice 4 will split these */}
                <span style={{ marginLeft: 16 }}>Plant</span>
              </th>
              <th style={thStyle}>Markup</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Item total</th>
            </tr>
          </thead>
          <tbody>
            {wbsSortedVisible.map((item) => {
              const rowCount = itemRowCounts.get(item.id) ?? 1;
              const localMarkup = itemMarkupOverrides.get(item.id) ?? null;
              const overridden = isMarkupOverridden(localMarkup, cardMarkup);
              const displayMarkup = effectiveMarkup(localMarkup, cardMarkup);
              const isAi = item.aiProposed && item.status !== "confirmed";
              const confidence = item.aiConfidence ? CONFIDENCE_STYLE[item.aiConfidence] : null;
              const isPending = pendingIds.has(item.id);

              // Render rowCount <tr> elements; identity columns span all.
              return Array.from({ length: rowCount }, (_, rowIdx) => {
                const isFirstRow = rowIdx === 0;
                const rowKey = `${item.id}-row-${rowIdx}`;
                const showPerRowRemove = shouldShowPerRowRemove(rowCount);

                // Last row of the item gets a bottom border to visually
                // separate items.
                const isLastRow = rowIdx === rowCount - 1;
                const rowStyle: CSSProperties = isLastRow
                  ? { borderBottom: "2px solid var(--border-default, #e5e7eb)" }
                  : {};

                return (
                  <tr key={rowKey} style={rowStyle}>
                    {/* ── Remove slot (always reserved) ─────────────────── */}
                    <td style={{ ...fitCellStyle, ...tdBorderStyle, verticalAlign: "middle" }}>
                      {showPerRowRemove ? (
                        <button
                          type="button"
                          aria-label={`Remove row ${rowIdx + 1} from ${item.wbsCode}`}
                          title="Remove this row"
                          onClick={() => removeRowFromItem(item.id)}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            border: "1px solid var(--border-default, #e5e7eb)",
                            background: "transparent",
                            color: "var(--status-danger, #EF4444)",
                            cursor: "pointer",
                            fontSize: 11,
                            lineHeight: 1,
                            padding: 0
                          }}
                        >
                          x
                        </button>
                      ) : (
                        /* Always reserve the slot so money column keeps one right edge */
                        <span style={{ display: "inline-block", width: 18 }} />
                      )}
                    </td>

                    {/* ── WBS cell — rowspan across all item rows ──────── */}
                    {isFirstRow ? (
                      <td
                        rowSpan={rowCount}
                        style={{
                          ...fitCellStyle,
                          ...tdBorderStyle,
                          verticalAlign: "top",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 12,
                          color: "#005B61",
                          fontWeight: 500
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          {isAi ? (
                            <span
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
                          <span title={item.wbsCode}>{item.wbsCode}</span>
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
                          {/* Per-item remove button on the WBS cell */}
                          {isAi ? (
                            <div style={{ display: "inline-flex", gap: 4, marginTop: 2 }}>
                              <button
                                type="button"
                                className="s7-btn s7-btn--primary s7-btn--sm"
                                onClick={() => void confirmItem(item.id)}
                                title="Confirm into estimate"
                              >
                                ok
                              </button>
                              <button
                                type="button"
                                className="s7-btn s7-btn--ghost s7-btn--sm"
                                onClick={() => void excludeItem(item.id)}
                                style={{ color: "var(--status-danger, #EF4444)" }}
                                title="Exclude"
                              >
                                x
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost s7-btn--sm"
                              onClick={() => void deleteItem(item)}
                              aria-label={`Remove item ${item.wbsCode}`}
                              title="Remove WBS item"
                              style={{ color: "var(--status-danger, #EF4444)", fontSize: 11, padding: "2px 4px" }}
                            >
                              Remove
                            </button>
                          )}
                          {/* Add row to this item */}
                          {!isAi ? (
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost s7-btn--sm"
                              onClick={() => addRowToItem(item.id)}
                              title="Add a manpower/plant row to this item"
                              style={{ fontSize: 10, padding: "2px 4px" }}
                            >
                              + Row
                            </button>
                          ) : null}
                          {isPending ? <span style={{ color: "var(--text-muted)", fontSize: 10 }}>...</span> : null}
                        </div>
                      </td>
                    ) : null}

                    {/* ── Description cell — rowspan, free-text input ──── */}
                    {isFirstRow ? (
                      <td rowSpan={rowCount} style={{ ...descCellStyle, ...tdBorderStyle }}>
                        <input
                          className="s7-input"
                          defaultValue={item.description}
                          disabled={isAi}
                          placeholder="Description"
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v !== item.description) void patchItem(item.id, { description: v });
                          }}
                          style={{ width: "100%", minWidth: 160 }}
                          aria-label={`Description for ${item.wbsCode}`}
                        />
                        {/* Notes are co-located with description in the table layout */}
                        <div style={{ marginTop: 6 }}>
                          <NotesField
                            value={item.notes}
                            onSave={(v) => void patchItem(item.id, { notes: v })}
                            disabled={isAi}
                            placeholder="Notes for this item..."
                          />
                        </div>
                      </td>
                    ) : null}

                    {/* ── Manpower + Plant spanning cell (per-row) ──────── */}
                    <td style={{ ...fitCellStyle, ...tdBorderStyle }}>
                      <ItemManpowerPlantCell
                        item={item}
                        rowIdx={rowIdx}
                        plantOptions={plantOptions}
                        plantRates={plantRates}
                        wasteGroupOptions={wasteGroupOptions}
                        wasteItemsByGroup={wasteItemsByGroup}
                        materialOptions={materialOptions}
                        materialDensityMap={materialDensityMap}
                        isAi={isAi}
                        onPatch={(body) => void patchItem(item.id, body)}
                      />
                    </td>

                    {/* ── Markup cell — rowspan ─────────────────────────── */}
                    {isFirstRow ? (
                      <td rowSpan={rowCount} style={{ ...fitCellStyle, ...tdBorderStyle }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="s7-type-label" style={labelStyle}>
                            Markup %
                          </span>
                          <OverrideField
                            isOverridden={overridden}
                            onRevert={() => setItemMarkup(item.id, null)}
                            affordance
                          >
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={localMarkup !== null ? localMarkup : ""}
                              placeholder={String(cardMarkup)}
                              className="s7-input"
                              style={{ width: 64, padding: "2px 6px" }}
                              aria-label={`Markup for ${item.wbsCode}`}
                              title={
                                overridden
                                  ? "Item markup override active"
                                  : `Inheriting card markup (${cardMarkup}%)`
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === "") {
                                  setItemMarkup(item.id, null);
                                } else {
                                  const n = Number(raw);
                                  if (Number.isFinite(n)) setItemMarkup(item.id, n);
                                }
                              }}
                            />
                          </OverrideField>
                          {overridden ? (
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              Card: {cardMarkup}%
                            </span>
                          ) : null}
                          <span
                            style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}
                            title="Effective markup percent for this item"
                          >
                            {displayMarkup}%
                          </span>
                        </div>
                      </td>
                    ) : null}

                    {/* ── Item total cell — rowspan ─────────────────────── */}
                    {isFirstRow ? (
                      <td
                        rowSpan={rowCount}
                        style={{
                          ...fitCellStyle,
                          ...tdBorderStyle,
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--text)"
                        }}
                        title="Line total (with markup)"
                      >
                        {item.lineTotalWithMarkup == null
                          ? "—"
                          : fmtCurrency(Number(item.lineTotalWithMarkup))}
                      </td>
                    ) : null}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      )}

      {/* SCOPE_WBS_TABLE_V1 — "+ Add WBS item" below the table */}
      <button
        type="button"
        className="s7-btn s7-btn--ghost s7-btn--sm"
        onClick={() => void addItem()}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "10px 12px",
          border: "1px dashed var(--border-default, #e5e7eb)",
          marginTop: 8
        }}
      >
        + Add WBS item
      </button>

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
        <CenteredModal
          title={`Delete ${deleteWarning.wbsCode}?`}
          onClose={() => setDeleteWarning(null)}
          maxWidth={460}
          footer={
            <>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setDeleteWarning(null)}>
                Cancel
              </button>
              <button type="button" className="s7-btn s7-btn--primary" onClick={() => void finalDelete(deleteWarning)}>
                Delete scope item only
              </button>
            </>
          }
        >
          <p style={{ color: "var(--text-muted)" }}>
            This item has a linked estimate entry. The scope item will be deleted but the estimate line will remain.
          </p>
        </CenteredModal>
      ) : null}
    </section>
  );
}

// ── ItemManpowerPlantCell ────────────────────────────────────────────────
// SCOPE_WBS_TABLE_V1: The manpower + plant inputs rendered inside the
// per-row spanning cell. In this slice they keep their current inputs
// exactly (men, days, plant clusters, measurement fields). Slices 3 & 4
// will wire each row to a dedicated manpower/plant record.

type ManpowerPlantCellProps = {
  item: ScopeItem;
  rowIdx: number;
  plantOptions: TooltipSelectOption<string>[];
  plantRates: PlantRate[];
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, MaterialLookup>;
  isAi: boolean;
  onPatch: (body: Record<string, unknown>) => void;
};

function ItemManpowerPlantCell({
  item,
  rowIdx,
  plantOptions,
  plantRates,
  wasteGroupOptions,
  wasteItemsByGroup,
  materialOptions,
  materialDensityMap,
  isAi,
  onPatch
}: ManpowerPlantCellProps) {
  // Only the first row renders the full manpower/plant/measurement block.
  // Additional rows (rowIdx > 0) will be wired to individual records in
  // slices 3 & 4. For now, placeholder so the table stays coherent.
  if (rowIdx > 0) {
    return (
      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          padding: "4px 0",
          whiteSpace: "nowrap"
        }}
      >
        Row {rowIdx + 1} — Manpower/plant (slice 3/4)
      </div>
    );
  }

  return (
    <ItemBodyInputs
      item={item}
      plantOptions={plantOptions}
      plantRates={plantRates}
      wasteGroupOptions={wasteGroupOptions}
      wasteItemsByGroup={wasteItemsByGroup}
      materialOptions={materialOptions}
      materialDensityMap={materialDensityMap}
      isAi={isAi}
      onPatch={onPatch}
    />
  );
}

// ── ItemBodyInputs ───────────────────────────────────────────────────────
// The full manpower + plant + measurement block for a scope item's first
// row. Extracted from the old ItemCard to keep the table cell lean.

type ItemBodyInputsProps = {
  item: ScopeItem;
  plantOptions: TooltipSelectOption<string>[];
  plantRates: PlantRate[];
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, MaterialLookup>;
  isAi: boolean;
  onPatch: (body: Record<string, unknown>) => void;
};

function ItemBodyInputs({
  item,
  plantOptions,
  plantRates,
  wasteGroupOptions,
  wasteItemsByGroup,
  materialOptions,
  materialDensityMap,
  isAi,
  onPatch
}: ItemBodyInputsProps) {
  // PR feat/scope-each-factor — active kind for row 1.
  const row1Kind: "VOLUME" | "AREA" | "EACH" | "FACTOR" = (item.materialKind as "VOLUME" | "AREA" | "EACH" | "FACTOR") ?? "VOLUME";

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

  const itemPlantEntries: ScopePlantEntry[] = Array.isArray(item.plantItems)
    ? [...item.plantItems].sort((a, b) => a.columnIndex - b.columnIndex)
    : [];

  const addPlant = () => {
    const maxIndex = itemPlantEntries.reduce((m, p) => Math.max(m, p.columnIndex), 0);
    const newEntry: ScopePlantEntry = { columnIndex: maxIndex + 1 };
    onPatch({ plantItems: [...(item.plantItems ?? []), newEntry] });
  };

  const removePlant = (columnIndex: number) => {
    const next = (item.plantItems ?? []).filter((p) => p.columnIndex !== columnIndex);
    onPatch({ plantItems: next });
  };

  const itemMaterialEntries: ScopeMaterialEntry[] = Array.isArray(item.materials)
    ? item.materials
    : [];

  const addMaterial = () => {
    onPatch({ materials: [...itemMaterialEntries, {}] });
  };

  const updateMaterial = (index: number, patch: Partial<ScopeMaterialEntry>) => {
    const next = itemMaterialEntries.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onPatch({ materials: next });
  };

  const removeMaterial = (index: number) => {
    const next = itemMaterialEntries.filter((_, i) => i !== index);
    onPatch({ materials: next });
  };

  const wasteItemOptions: TooltipSelectOption<string>[] = item.wasteGroup
    ? (wasteItemsByGroup.get(item.wasteGroup) ?? []).map((w) => ({ value: w, label: w }))
    : [];

  const row1MaterialLookup = item.materialType ? materialDensityMap.get(item.materialType) : undefined;
  const row1WasteAutofilled =
    !!row1MaterialLookup?.defaultWasteGroup &&
    !!row1MaterialLookup?.defaultWasteItem &&
    item.wasteGroup === row1MaterialLookup.defaultWasteGroup &&
    item.wasteItem === row1MaterialLookup.defaultWasteItem;

  // PR B4a.5 — controlled state for the 7 dimension fields.
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
  const [dirty, setDirty] = useState({ sqm: false, m3: false, tonnes: false });
  const [row1Quantity, setRow1Quantity] = useState(initDim(item.quantity ?? null));
  const [row1Factor, setRow1Factor] = useState(initDim(item.factor ?? null));

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
    setRow1Quantity(initDim(item.quantity ?? null));
    setRow1Factor(initDim(item.factor ?? null));

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
  }, [item.id, item.length, item.height, item.depth, item.sqm, item.m3, item.density, item.tonnes, item.quantity, item.factor]);

  const setDim = (k: DimKey, v: string) => {
    setDims((s) => ({ ...s, [k]: v }));
    setDirty((d) => {
      const next = { ...d };
      if (k === "sqm" || k === "m3" || k === "tonnes") {
        next[k] = true;
      }
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

  const parsed = useMemo(
    () => ({
      length: dims.length === "" ? null : Number(dims.length),
      height: dims.height === "" ? null : Number(dims.height),
      depth: dims.depth === "" ? null : Number(dims.depth),
      density: dims.density === "" ? null : Number(dims.density),
      sqm: dirty.sqm && dims.sqm !== "" ? Number(dims.sqm) : null,
      m3: dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : null,
      tonnes: dirty.tonnes && dims.tonnes !== "" ? Number(dims.tonnes) : null,
      kind: row1Kind,
      quantity: row1Quantity === "" ? null : Number(row1Quantity),
      factor: row1Factor === "" ? null : Number(row1Factor)
    }),
    [dims, dirty, row1Kind, row1Quantity, row1Factor]
  );
  const derived = useMemo(() => computeDerivedDimensions(parsed), [parsed]);

  const persistDims = () => {
    const sqmToSave = dirty.sqm && dims.sqm !== "" ? Number(dims.sqm) : derived.sqm;
    const m3ToSave = dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : derived.m3;
    const tonnesToSave = dirty.tonnes && dims.tonnes !== "" ? Number(dims.tonnes) : derived.tonnes;

    const MAX_DIM = 9999999;
    const MAX_DENSITY = 99999;
    const MAX_DERIVED = 99999999;
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
      tonnes: tonnesToSave,
      materialKind: row1Kind,
      quantity: parsed.quantity,
      factor: parsed.factor
    });
  };

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 360 }}>
      {/* Section A: labour + plant */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <FieldCell label="Men" width={72}>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={item.men ?? ""}
            disabled={isAi}
            style={{ width: 72, height: 32 }}
            onBlur={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              onPatch({ men: n });
            }}
          />
        </FieldCell>
        <FieldCell label="Days" width={72}>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={item.days ?? ""}
            disabled={isAi}
            style={{ width: 72, height: 32 }}
            onBlur={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              onPatch({ days: n });
            }}
          />
        </FieldCell>
        <TaskHoursHint men={item.men} days={item.days} />

        {itemPlantEntries.map((entry) => (
          <PlantCluster
            key={`plant-${entry.columnIndex}`}
            index={entry.columnIndex}
            cell={entry}
            plantOptions={plantOptions}
            plantRates={plantRates}
            disabled={isAi}
            onChange={(patch) => updatePlant(entry.columnIndex, patch)}
            onRemove={() => removePlant(entry.columnIndex)}
          />
        ))}
        {!isAi ? (
          <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={addPlant}
              title="Add plant to this item"
              style={{ whiteSpace: "nowrap", fontSize: 11, padding: "4px 8px", height: 32 }}
            >
              + Plant
            </button>
          </div>
        ) : null}
      </div>

      <Divider />

      {/* Section B: Measurement — stays exactly where it is until slice 5 */}
      <div style={{ display: "flex", flexWrap: "nowrap", gap: 8, alignItems: "flex-end", overflowX: "auto" }}>
        <FieldCell label="Length" width={70}>
          <input
            className="s7-input"
            type="number"
            step="0.001"
            value={dims.length}
            disabled={isAi}
            style={{ width: 70, height: 32 }}
            onChange={(e) => setDim("length", e.target.value)}
            onBlur={persistDims}
          />
        </FieldCell>
        <FieldCell label="Height" width={70}>
          <input
            className="s7-input"
            type="number"
            step="0.001"
            value={dims.height}
            disabled={isAi}
            style={{ width: 70, height: 32 }}
            onChange={(e) => setDim("height", e.target.value)}
            onBlur={persistDims}
          />
        </FieldCell>
        <FieldCell label="Depth" width={70}>
          <input
            className="s7-input"
            type="number"
            step="0.001"
            value={dims.depth}
            disabled={isAi}
            style={{ width: 70, height: 32 }}
            onChange={(e) => setDim("depth", e.target.value)}
            onBlur={persistDims}
          />
        </FieldCell>
        <FieldCell label="Material" width={140}>
          <TooltipSelect
            value={item.materialType}
            options={materialOptions}
            onChange={(v) => {
              const lookup = v ? materialDensityMap.get(v) : undefined;
              const newDensity = lookup
                ? (lookup.unit === "kg/m3"
                    ? Number(lookup.density) / 1000
                    : Number(lookup.density))
                : null;
              const newKind = lookup?.kind ?? "VOLUME";
              const isSheet = lookup?.unit === "kg/m2";
              const newParsed = {
                length: dims.length === "" ? null : Number(dims.length),
                height: dims.height === "" ? null : Number(dims.height),
                depth: isSheet ? null : (dims.depth === "" ? null : Number(dims.depth)),
                density: newDensity,
                sqm: dirty.sqm && dims.sqm !== "" ? Number(dims.sqm) : null,
                m3: isSheet ? null : (dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : null),
                tonnes: null,
                kind: newKind as "VOLUME" | "AREA" | "EACH" | "FACTOR",
                quantity: row1Quantity === "" ? null : Number(row1Quantity),
                factor: row1Factor === "" ? null : Number(row1Factor)
              };
              const rederived = computeDerivedDimensions(newParsed);
              const wasteDefaults = lookup
                ? lookup.defaultWasteGroup && lookup.defaultWasteItem
                  ? { wasteGroup: lookup.defaultWasteGroup, wasteItem: lookup.defaultWasteItem }
                  : {}
                : {};
              onPatch({
                materialType: v,
                materialKind: newKind,
                density: newDensity,
                length: newParsed.length,
                height: newParsed.height,
                depth: newParsed.depth,
                sqm: rederived.sqm,
                m3: rederived.m3,
                tonnes: rederived.tonnes,
                quantity: newKind === "EACH" ? newParsed.quantity : null,
                factor: newKind === "FACTOR" ? newParsed.factor : null,
                ...wasteDefaults
              });
            }}
            disabled={isAi}
            ariaLabel="Material type"
            style={{ height: 32 }}
          />
        </FieldCell>
        {row1Kind === "FACTOR" ? (
          <FieldCell label="Factor" width={80}>
            <input
              className="s7-input"
              type="number"
              step="0.0001"
              value={row1Factor}
              disabled={isAi}
              style={{ width: 80, height: 32 }}
              placeholder="0.0"
              title="Factor: tonnes = sqm x factor"
              onChange={(e) => setRow1Factor(e.target.value)}
              onBlur={persistDims}
            />
          </FieldCell>
        ) : (
          <FieldCell label={row1Kind === "EACH" ? "kg/item" : "Density (t/m3)"} width={80}>
            <input
              className="s7-input"
              type="number"
              step="0.001"
              value={dims.density}
              disabled={isAi || !!item.materialType}
              style={{
                width: 80,
                height: 32,
                ...(item.materialType
                  ? { backgroundColor: "var(--surface-muted, #f3f4f6)", color: "var(--text-muted, #6b7280)" }
                  : {})
              }}
              title={
                item.materialType
                  ? `Auto-set from ${item.materialType}. Clear material to edit manually.`
                  : row1Kind === "EACH"
                    ? "Per-item weight in kg (tonnes = qty x kg/1000)"
                    : "Manual density (tonnes per m3)"
              }
              onChange={(e) => setDim("density", e.target.value)}
              onBlur={persistDims}
            />
          </FieldCell>
        )}
        {row1Kind === "EACH" ? (
          <FieldCell label="Quantity" width={80}>
            <input
              className="s7-input"
              type="number"
              step="1"
              value={row1Quantity}
              disabled={isAi}
              style={{ width: 80, height: 32 }}
              placeholder="0"
              title="Number of items (tonnes = qty x kg/item / 1000)"
              onChange={(e) => setRow1Quantity(e.target.value)}
              onBlur={persistDims}
            />
          </FieldCell>
        ) : null}
        <FieldCell label="Sqm" width={80}>
          <OverrideField
            isOverridden={dirty.sqm}
            onRevert={() => {
              setDim("sqm", "");
              setDirty((d) => ({ ...d, sqm: false }));
            }}
          >
            <input
              className="s7-input"
              type="number"
              step="0.01"
              value={valueFor("sqm")}
              placeholder={placeholderFor("sqm")}
              disabled={isAi}
              style={{ width: 80, height: 32 }}
              title="Auto = length x height. Type to override."
              onChange={(e) => setDim("sqm", e.target.value)}
              onBlur={persistDims}
            />
          </OverrideField>
        </FieldCell>
        <FieldCell label="M3" width={80}>
          <OverrideField
            isOverridden={dirty.m3}
            onRevert={() => {
              setDim("m3", "");
              setDirty((d) => ({ ...d, m3: false }));
            }}
          >
            <input
              className="s7-input"
              type="number"
              step="0.01"
              value={valueFor("m3")}
              placeholder={placeholderFor("m3")}
              disabled={isAi}
              style={{ width: 80, height: 32 }}
              title="Auto = sqm x depth. Type to override."
              onChange={(e) => setDim("m3", e.target.value)}
              onBlur={persistDims}
            />
          </OverrideField>
        </FieldCell>
        <FieldCell label="Tonnes" width={80}>
          <OverrideField
            isOverridden={dirty.tonnes}
            onRevert={() => {
              setDim("tonnes", "");
              setDirty((d) => ({ ...d, tonnes: false }));
            }}
          >
            <input
              className="s7-input"
              type="number"
              step="0.01"
              value={valueFor("tonnes")}
              placeholder={placeholderFor("tonnes")}
              disabled={isAi}
              style={{ width: 80, height: 32 }}
              title="Auto = m3 x density or sqm x density / 1000. Type to override."
              onChange={(e) => setDim("tonnes", e.target.value)}
              onBlur={persistDims}
            />
          </OverrideField>
        </FieldCell>
        {row1WasteAutofilled ? (
          <FieldCell label="Waste" width={160}>
            <div
              style={{
                height: 32,
                display: "flex",
                alignItems: "center",
                fontSize: 11,
                color: "var(--text-muted)"
              }}
              title={`Auto from ${item.materialType}: ${item.wasteGroup} -> ${item.wasteItem}`}
            >
              {item.wasteGroup} {"·"} {item.wasteItem}
            </div>
          </FieldCell>
        ) : (
          <>
            <FieldCell label="Waste group" width={120}>
              <TooltipSelect
                value={item.wasteGroup}
                options={wasteGroupOptions}
                onChange={(v) => onPatch({ wasteGroup: v, wasteItem: null })}
                disabled={isAi}
                ariaLabel="Waste group"
                style={{ height: 32 }}
              />
            </FieldCell>
            <FieldCell label="Waste item" width={140}>
              <TooltipSelect
                value={item.wasteItem}
                options={wasteItemOptions}
                onChange={(v) => onPatch({ wasteItem: v })}
                disabled={isAi || !item.wasteGroup}
                ariaLabel="Waste item"
                style={{ height: 32 }}
              />
            </FieldCell>
            {item.materialType ? (
              <div
                role="note"
                style={{
                  fontSize: 11,
                  color: "var(--status-warning, #B45309)",
                  alignSelf: "flex-end",
                  paddingBottom: 8,
                  maxWidth: 180
                }}
              >
                No default waste mapping for {item.materialType} — set one in Rates &amp; Lists {"→"} Densities.
              </div>
            ) : null}
          </>
        )}
        <FieldCell label="Waste?" width={54}>
          <input
            type="checkbox"
            checked={item.wasteIncluded === true}
            disabled={isAi}
            onChange={(e) => onPatch({ wasteIncluded: e.target.checked })}
            aria-label="Include in waste summary"
            style={{ width: 20, height: 20, marginBottom: 6 }}
          />
        </FieldCell>
        <FieldCell label="Cutting?" width={62}>
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

      {/* PR feat/scope-multi-material — additional material rows (2..N) */}
      {itemMaterialEntries.map((entry, index) => (
        <MaterialCluster
          key={`material-${index}`}
          index={index}
          entry={entry}
          materialOptions={materialOptions}
          materialDensityMap={materialDensityMap}
          wasteGroupOptions={wasteGroupOptions}
          wasteItemsByGroup={wasteItemsByGroup}
          disabled={isAi}
          onChange={(patch) => updateMaterial(index, patch)}
          onRemove={() => removeMaterial(index)}
        />
      ))}

      <ItemMaterialTotals
        row1Tonnes={dirty.tonnes && dims.tonnes !== "" ? Number(dims.tonnes) : derived.tonnes}
        row1M3={dirty.m3 && dims.m3 !== "" ? Number(dims.m3) : derived.m3}
        extras={itemMaterialEntries}
        onAdd={addMaterial}
        disabled={isAi}
      />
    </div>
  );
}

// ── PlantCluster ────────────────────────────────────────────────────────

function PlantCluster({
  index,
  cell,
  plantOptions,
  plantRates,
  disabled,
  onChange,
  onRemove
}: {
  index: number;
  cell: ScopePlantEntry | undefined;
  plantOptions: TooltipSelectOption<string>[];
  plantRates: PlantRate[];
  disabled: boolean;
  onChange: (patch: Partial<ScopePlantEntry> | null) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 280 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span className="s7-type-label" style={labelStyle}>
          Plant {index}
        </span>
        {!disabled ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove Plant ${index}`}
            title={`Remove Plant ${index}`}
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
            x
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

// ── MaterialCluster + ItemMaterialTotals ────────────────────────────────

function MaterialCluster({
  index,
  entry,
  materialOptions,
  materialDensityMap,
  wasteGroupOptions,
  wasteItemsByGroup,
  disabled,
  onChange,
  onRemove
}: {
  index: number;
  entry: ScopeMaterialEntry;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, MaterialLookup>;
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  disabled: boolean;
  onChange: (patch: Partial<ScopeMaterialEntry>) => void;
  onRemove: () => void;
}) {
  const matKind: "VOLUME" | "AREA" | "EACH" | "FACTOR" = (entry.kind ?? "VOLUME") as "VOLUME" | "AREA" | "EACH" | "FACTOR";
  const numOrNull = (v: string): number | null => {
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const strOf = (v: number | null | undefined): string =>
    v == null ? "" : String(v);

  const derived = computeDerivedDimensions({
    length: entry.length ?? null,
    height: entry.height ?? null,
    depth: entry.depth ?? null,
    density: entry.density ?? null,
    sqm: entry.sqm ?? null,
    m3: entry.m3 ?? null,
    tonnes: entry.tonnes ?? null,
    kind: matKind,
    quantity: entry.quantity ?? null,
    factor: entry.factor ?? null
  });

  const wasteItemOptions: TooltipSelectOption<string>[] = entry.wasteGroup
    ? (wasteItemsByGroup.get(entry.wasteGroup) ?? []).map((w) => ({ value: w, label: w }))
    : [];

  const entryMaterialLookup = entry.material ? materialDensityMap.get(entry.material) : undefined;
  const entryWasteAutofilled =
    !!entryMaterialLookup?.defaultWasteGroup &&
    !!entryMaterialLookup?.defaultWasteItem &&
    entry.wasteGroup === entryMaterialLookup.defaultWasteGroup &&
    entry.wasteItem === entryMaterialLookup.defaultWasteItem;

  const materialNo = index + 2;

  return (
    <div
      style={{
        border: "1px dashed var(--border-default, #e5e7eb)",
        borderRadius: 6,
        padding: 8,
        background: "var(--surface-muted, #FAFAFA)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span className="s7-type-label" style={{ ...labelStyle, marginBottom: 0 }}>
          Material {materialNo}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "nowrap", gap: 8, alignItems: "flex-end", overflowX: "auto" }}>
        <FieldCell label="Length" width={70}>
          <input
            className="s7-input"
            type="number"
            step="0.001"
            defaultValue={strOf(entry.length)}
            disabled={disabled}
            style={{ width: 70, height: 32 }}
            onBlur={(e) => onChange({ length: numOrNull(e.target.value) })}
          />
        </FieldCell>
        <FieldCell label="Height" width={70}>
          <input
            className="s7-input"
            type="number"
            step="0.001"
            defaultValue={strOf(entry.height)}
            disabled={disabled}
            style={{ width: 70, height: 32 }}
            onBlur={(e) => onChange({ height: numOrNull(e.target.value) })}
          />
        </FieldCell>
        <FieldCell label="Depth" width={70}>
          <input
            className="s7-input"
            type="number"
            step="0.001"
            defaultValue={strOf(entry.depth)}
            disabled={disabled}
            style={{ width: 70, height: 32 }}
            onBlur={(e) => onChange({ depth: numOrNull(e.target.value) })}
          />
        </FieldCell>
        <FieldCell label="Material" width={140}>
          <TooltipSelect
            value={entry.material ?? null}
            options={materialOptions}
            onChange={(v) => {
              const lookup = v ? materialDensityMap.get(v) : undefined;
              const newDensity = lookup
                ? lookup.unit === "kg/m3"
                  ? Number(lookup.density) / 1000
                  : Number(lookup.density)
                : null;
              const newKind = lookup?.kind ?? "VOLUME";
              const isSheet = lookup?.unit === "kg/m2";
              const rederived = computeDerivedDimensions({
                length: entry.length ?? null,
                height: entry.height ?? null,
                depth: isSheet ? null : entry.depth ?? null,
                density: newDensity,
                sqm: null,
                m3: isSheet ? null : entry.m3 ?? null,
                tonnes: null,
                kind: newKind as "VOLUME" | "AREA" | "EACH" | "FACTOR",
                quantity: newKind === "EACH" ? entry.quantity ?? null : null,
                factor: newKind === "FACTOR" ? entry.factor ?? null : null
              });
              const wasteDefaults = lookup
                ? lookup.defaultWasteGroup && lookup.defaultWasteItem
                  ? { wasteGroup: lookup.defaultWasteGroup, wasteItem: lookup.defaultWasteItem }
                  : {}
                : {};
              onChange({
                material: v,
                kind: newKind as "VOLUME" | "AREA" | "EACH" | "FACTOR",
                density: newDensity,
                depth: isSheet ? null : entry.depth ?? null,
                sqm: rederived.sqm,
                m3: rederived.m3,
                tonnes: rederived.tonnes,
                quantity: newKind === "EACH" ? entry.quantity ?? null : null,
                factor: newKind === "FACTOR" ? entry.factor ?? null : null,
                ...wasteDefaults
              });
            }}
            disabled={disabled}
            ariaLabel={`Material ${materialNo} type`}
            style={{ height: 32 }}
          />
        </FieldCell>
        {matKind === "FACTOR" ? (
          <FieldCell label="Factor" width={80}>
            <input
              className="s7-input"
              type="number"
              step="0.0001"
              defaultValue={strOf(entry.factor)}
              disabled={disabled}
              style={{ width: 80, height: 32 }}
              placeholder="0.0"
              title="Factor: tonnes = sqm x factor"
              onBlur={(e) => {
                const newFactor = numOrNull(e.target.value);
                const rederived = computeDerivedDimensions({
                  sqm: entry.sqm ?? null,
                  kind: "FACTOR",
                  factor: newFactor
                });
                onChange({ factor: newFactor, tonnes: rederived.tonnes });
              }}
            />
          </FieldCell>
        ) : (
          <FieldCell label={matKind === "EACH" ? "kg/item" : "Density (t/m3)"} width={80}>
            <input
              className="s7-input"
              type="number"
              step="0.001"
              defaultValue={strOf(entry.density)}
              disabled={disabled || !!entry.material}
              style={{
                width: 80,
                height: 32,
                ...(entry.material
                  ? { backgroundColor: "var(--surface-muted, #f3f4f6)", color: "var(--text-muted, #6b7280)" }
                  : {})
              }}
              title={
                entry.material
                  ? `Auto-set from ${entry.material}. Clear material to edit manually.`
                  : matKind === "EACH"
                    ? "Per-item weight in kg (tonnes = qty x kg/1000)"
                    : "Manual density (tonnes per m3)"
              }
              onBlur={(e) => onChange({ density: numOrNull(e.target.value) })}
            />
          </FieldCell>
        )}
        {matKind === "EACH" ? (
          <FieldCell label="Quantity" width={80}>
            <input
              className="s7-input"
              type="number"
              step="1"
              defaultValue={strOf(entry.quantity)}
              disabled={disabled}
              style={{ width: 80, height: 32 }}
              placeholder="0"
              title="Number of items (tonnes = qty x kg/item / 1000)"
              onBlur={(e) => {
                const newQty = numOrNull(e.target.value);
                const rederived = computeDerivedDimensions({
                  density: entry.density ?? null,
                  kind: "EACH",
                  quantity: newQty
                });
                onChange({ quantity: newQty, tonnes: rederived.tonnes });
              }}
            />
          </FieldCell>
        ) : null}
        <FieldCell label="Sqm" width={80}>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={strOf(entry.sqm ?? derived.sqm)}
            placeholder={derived.sqm == null ? "" : String(derived.sqm)}
            disabled={disabled}
            style={{ width: 80, height: 32 }}
            title="Auto = length x height. Type to override."
            onBlur={(e) => onChange({ sqm: numOrNull(e.target.value) })}
          />
        </FieldCell>
        <FieldCell label="M3" width={80}>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={strOf(entry.m3 ?? derived.m3)}
            placeholder={derived.m3 == null ? "" : String(derived.m3)}
            disabled={disabled}
            style={{ width: 80, height: 32 }}
            title="Auto = sqm x depth. Type to override."
            onBlur={(e) => onChange({ m3: numOrNull(e.target.value) })}
          />
        </FieldCell>
        <FieldCell label="Tonnes" width={80}>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={strOf(entry.tonnes ?? derived.tonnes)}
            placeholder={derived.tonnes == null ? "" : String(derived.tonnes)}
            disabled={disabled}
            style={{ width: 80, height: 32 }}
            title="Auto = m3 x density or sqm x density / 1000. Type to override."
            onBlur={(e) => onChange({ tonnes: numOrNull(e.target.value) })}
          />
        </FieldCell>
        {entryWasteAutofilled ? (
          <FieldCell label="Waste" width={160}>
            <div
              style={{
                height: 32,
                display: "flex",
                alignItems: "center",
                fontSize: 11,
                color: "var(--text-muted)"
              }}
              title={`Auto from ${entry.material}: ${entry.wasteGroup} -> ${entry.wasteItem}`}
            >
              {entry.wasteGroup} {"·"} {entry.wasteItem}
            </div>
          </FieldCell>
        ) : (
          <>
            <FieldCell label="Waste group" width={120}>
              <TooltipSelect
                value={entry.wasteGroup ?? null}
                options={wasteGroupOptions}
                onChange={(v) => onChange({ wasteGroup: v, wasteItem: null })}
                disabled={disabled}
                ariaLabel={`Material ${materialNo} waste group`}
                style={{ height: 32 }}
              />
            </FieldCell>
            <FieldCell label="Waste item" width={140}>
              <TooltipSelect
                value={entry.wasteItem ?? null}
                options={wasteItemOptions}
                onChange={(v) => onChange({ wasteItem: v })}
                disabled={disabled || !entry.wasteGroup}
                ariaLabel={`Material ${materialNo} waste item`}
                style={{ height: 32 }}
              />
            </FieldCell>
            {entry.material ? (
              <div
                role="note"
                style={{
                  fontSize: 11,
                  color: "var(--status-warning, #B45309)",
                  alignSelf: "flex-end",
                  paddingBottom: 8,
                  maxWidth: 180
                }}
              >
                No default waste mapping for {entry.material} — set one in Rates &amp; Lists {"→"} Densities.
              </div>
            ) : null}
          </>
        )}
        <FieldCell label="Waste?" width={54}>
          <input
            type="checkbox"
            checked={entry.wasteIncluded === true}
            disabled={disabled}
            onChange={(e) => onChange({ wasteIncluded: e.target.checked })}
            aria-label={`Material ${materialNo} include in waste summary`}
            style={{ width: 20, height: 20, marginBottom: 6 }}
          />
        </FieldCell>
        <FieldCell label="Cutting?" width={62}>
          <input
            type="checkbox"
            checked={entry.cuttingIncluded === true}
            disabled={disabled}
            onChange={(e) => onChange({ cuttingIncluded: e.target.checked })}
            aria-label={`Material ${materialNo} include in cutting summary`}
            style={{ width: 20, height: 20, marginBottom: 6 }}
          />
        </FieldCell>
        {!disabled ? (
          <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove Material ${materialNo}`}
              title={`Remove Material ${materialNo}`}
              className="s7-btn s7-btn--ghost s7-btn--sm"
              style={{
                color: "var(--status-danger, #EF4444)",
                fontSize: 14,
                padding: "4px 8px",
                height: 32
              }}
            >
              x
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ItemMaterialTotals({
  row1Tonnes,
  row1M3,
  extras,
  onAdd,
  disabled
}: {
  row1Tonnes: number | null;
  row1M3: number | null;
  extras: ScopeMaterialEntry[];
  onAdd: () => void;
  disabled: boolean;
}) {
  const sum = (a: number | null, b: number | null | undefined): number | null => {
    const av = a == null ? 0 : Number(a);
    const bv = b == null ? 0 : Number(b);
    if (a == null && (b == null || !Number.isFinite(bv))) return null;
    return Math.round((av + (Number.isFinite(bv) ? bv : 0)) * 100) / 100;
  };
  let totalTonnes: number | null = row1Tonnes;
  let totalM3: number | null = row1M3;
  for (const m of extras) {
    totalTonnes = sum(totalTonnes, m.tonnes ?? null);
    totalM3 = sum(totalM3, m.m3 ?? null);
  }
  const showTotals = extras.length > 0;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginTop: 4
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {showTotals ? (
          <>
            Item total:{" "}
            <strong style={{ color: "var(--text)" }}>
              {totalTonnes == null ? "—" : `${totalTonnes} t`}
            </strong>
            {" · "}
            <strong style={{ color: "var(--text)" }}>
              {totalM3 == null ? "—" : `${totalM3} m3`}
            </strong>
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
      {!disabled ? (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onAdd}
          title="Add another material row under this item"
          style={{ whiteSpace: "nowrap", fontSize: 11, padding: "4px 8px" }}
        >
          + Material
        </button>
      ) : null}
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

function TaskHoursHint({ men, days }: { men: string | null; days: string | null }) {
  const menNum = men === null || men === "" ? null : Number(men);
  const daysNum = days === null || days === "" ? null : Number(days);
  const hours =
    menNum !== null &&
    daysNum !== null &&
    Number.isFinite(menNum) &&
    Number.isFinite(daysNum) &&
    menNum >= 0 &&
    daysNum >= 0
      ? menNum * daysNum * 8
      : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        paddingBottom: 8,
        fontSize: 11,
        color: "var(--text-muted)",
        whiteSpace: "nowrap"
      }}
      title="Task hours: persons x days x 8h"
    >
      {hours === null ? "—" : `${hours.toFixed(1)} h`}
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
  color: "var(--text-muted, #6b7280)",
  marginBottom: 2
};
