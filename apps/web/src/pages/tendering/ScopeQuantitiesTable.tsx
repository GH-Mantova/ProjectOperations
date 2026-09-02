import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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
  // SCOPE_WBS_MANPOWER_V1 — shift is an existing DB field surfaced in
  // the Shift column of the manpower group. Nullable; null renders as
  // "Day" (the server default). Values: "Day" | "Night" | "Weekend".
  shift?: string | null;
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

// SCOPE_WBS_MANPOWER_V1 — shape from GET /estimate-rates/labour.
// dayRate is the per-man-day rate for this labour role. Used as the
// placeholder in the Day rate override cell and as the resolved rate
// when no override is active. The existing endpoint is consumed without
// any modification to the route, service, or DTO.
type LabourRate = {
  id: string;
  role: string;
  dayRate: string | number;
  nightRate: string | number;
  weekendRate: string | number;
  isActive: boolean;
  sortOrder: number;
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

// SCOPE_WBS_MANPOWER_V1 — per-row manpower local state.
// Slice 3 stores Type, Day-rate override, and additional-row Qty/Days/Shift
// in local state. Row 0's Qty/Days/Shift write through to the item's
// men/days/shift fields via patchItem; additional rows are local-only
// until slice 3b wires them to dedicated DB records.
type RowManpowerState = {
  /** Selected labour role id (null = "- none -"). */
  labourTypeId: string | null;
  /** User-entered day rate override in $. Null = use catalogue rate. */
  dayRateOverride: number | null;
  /** Qty (men) for rows > 0. Row 0 uses item.men. */
  qty: string;
  /** Days for rows > 0. Row 0 uses item.days. */
  days: string;
  /** Shift for rows > 0. Row 0 uses item.shift. "Day" | "Night" | "Weekend". */
  shift: string;
};

/** Key: `${itemId}:${rowIdx}` → per-row manpower state. */
type ItemManpowerRows = Map<string, RowManpowerState>;

// SCOPE_WBS_PLANT_V1 — per-row plant local state.
// Slice 4 stores Type (plantRateId or custom description), Day-rate override,
// Qty, and Days in local state. Each row is keyed by `${itemId}:${rowIdx}`.
// Custom plant (no plantRateId) has no locked rate; its Day rate cell is an
// override by definition with placeholder "rate".
type RowPlantState = {
  /** Selected plant rate id from catalogue (null = no catalogue pick). */
  plantRateId: string | null;
  /** Free-typed custom machine name when the estimator drops out of the list. */
  customDescription: string | null;
  /** User-entered day rate override in $. Null = use catalogue rate. */
  dayRateOverride: number | null;
  /** Qty for this row. */
  qty: string;
  /** Days for this row. */
  days: string;
};

/** Key: `${itemId}:${rowIdx}` → per-row plant state. */
type ItemPlantRows = Map<string, RowPlantState>;

// ── SCOPE_WBS_MANPOWER_V1 exported pure helpers (tested by wbs-manpower-columns.test.tsx) ──

/** Shift options for the Shift dropdown in the Manpower column group. */
export const SHIFT_OPTIONS = ["Day", "Night", "Weekend"] as const;
export type ShiftOption = (typeof SHIFT_OPTIONS)[number];

/**
 * True when a day-rate value is considered overridden (user typed a value
 * different from the catalogue rate).
 * Both values must be finite numbers to compare; null override → not overridden.
 */
export function isDayRateOverridden(
  override: number | null,
  catalogueRate: number | null
): boolean {
  if (override === null) return false;
  if (catalogueRate === null) return true;
  return override !== catalogueRate;
}

/**
 * Effective day rate for display: the local override when active,
 * otherwise the catalogue rate for the selected labour type (null = no type).
 */
export function effectiveDayRate(
  override: number | null,
  catalogueRate: number | null
): number | null {
  if (override !== null) return override;
  return catalogueRate;
}

/**
 * Manpower row total for the read-only Total cell.
 * Returns null (renders as "—") when any of qty/days/rate are absent
 * or the row has no type set.
 */
export function manpowerRowTotal(
  qty: number | null,
  days: number | null,
  dayRate: number | null
): number | null {
  if (qty === null || days === null || dayRate === null) return null;
  if (!Number.isFinite(qty) || !Number.isFinite(days) || !Number.isFinite(dayRate)) return null;
  return qty * days * dayRate;
}

/** Render a manpower total as currency or an em dash when absent. */
export function fmtManpowerTotal(total: number | null): string {
  if (total === null) return "—"; // em dash
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(total);
}

// ── SCOPE_WBS_PLANT_V1 exported pure helpers (tested by wbs-plant-columns.test.tsx) ──

/**
 * True when a plant day-rate is considered overridden by the user.
 * A custom machine (no plantRateId) always has an override-by-definition rate —
 * there is no locked catalogue rate to compare against, so any typed value is
 * returned as-is (isCustomPlant callers handle this case separately).
 * For catalogue machines: null override → not overridden.
 */
export function isPlantRateOverridden(
  override: number | null,
  catalogueRate: number | null
): boolean {
  if (override === null) return false;
  if (catalogueRate === null) return true; // custom plant or no type
  return override !== catalogueRate;
}

/**
 * Effective plant day rate for display: the local override when active,
 * otherwise the catalogue rate for the selected plant type (null = no type).
 */
export function effectivePlantRate(
  override: number | null,
  catalogueRate: number | null
): number | null {
  if (override !== null) return override;
  return catalogueRate;
}

/**
 * Plant row total: qty × days × dayRate.
 * Returns null (renders as "—") when any of qty/days/rate are absent.
 * A row with no plant type renders "—", never "$0.00".
 */
export function plantRowTotal(
  qty: number | null,
  days: number | null,
  dayRate: number | null
): number | null {
  if (qty === null || days === null || dayRate === null) return null;
  if (!Number.isFinite(qty) || !Number.isFinite(days) || !Number.isFinite(dayRate)) return null;
  return qty * days * dayRate;
}

/** Render a plant total as currency or an em dash when absent. */
export function fmtPlantTotal(total: number | null): string {
  if (total === null) return "—"; // em dash — NEVER "$0.00" for an unset row
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(total);
}

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
  // SCOPE_WBS_MANPOWER_V1 — labour rates catalogue for the Type dropdown
  // and Day rate placeholder. Fetched once from the existing endpoint;
  // no new API routes or service methods added.
  const [labourRates, setLabourRates] = useState<LabourRate[]>([]);
  // SCOPE_WBS_MANPOWER_V1 — per-row manpower local state.
  const [itemManpowerRows, setItemManpowerRows] = useState<ItemManpowerRows>(new Map());
  // SCOPE_WBS_PLANT_V1 — per-row plant local state.
  const [itemPlantRows, setItemPlantRows] = useState<ItemPlantRows>(new Map());

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

  // SCOPE_WBS_MANPOWER_V1 — helpers to read and write per-row manpower state.
  const defaultRowManpower = useCallback(
    (item: ScopeItem, rowIdx: number): RowManpowerState => ({
      labourTypeId: null,
      dayRateOverride: null,
      qty: rowIdx === 0 ? (item.men ?? "") : "",
      days: rowIdx === 0 ? (item.days ?? "") : "",
      shift: rowIdx === 0 ? (item.shift ?? "Day") : "Day"
    }),
    []
  );

  const getRowManpower = useCallback(
    (item: ScopeItem, rowIdx: number): RowManpowerState => {
      const key = `${item.id}:${rowIdx}`;
      return itemManpowerRows.get(key) ?? defaultRowManpower(item, rowIdx);
    },
    [itemManpowerRows, defaultRowManpower]
  );

  const setRowManpower = useCallback(
    (itemId: string, rowIdx: number, patch: Partial<RowManpowerState>) => {
      const key = `${itemId}:${rowIdx}`;
      setItemManpowerRows((prev) => {
        const next = new Map(prev);
        const current = prev.get(key) ?? {
          labourTypeId: null,
          dayRateOverride: null,
          qty: "",
          days: "",
          shift: "Day"
        };
        next.set(key, { ...current, ...patch });
        return next;
      });
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plantRes, wasteRes, densityRes, labourRes] = await Promise.all([
          authFetch("/estimate-rates/plant"),
          authFetch("/estimate-rates/waste"),
          authFetch("/estimate-rates/material-densities"),
          // SCOPE_WBS_MANPOWER_V1 — existing endpoint; no modifications to
          // the route, service, or DTO.
          authFetch("/estimate-rates/labour")
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
        if (labourRes.ok) {
          const body = (await labourRes.json()) as LabourRate[];
          setLabourRates(body.filter((r) => r.isActive));
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

  // SCOPE_WBS_MANPOWER_V1 — labour type options for the Type dropdown.
  // The "- none -" sentinel is prepended; its value is "" so a cleared
  // TooltipSelect returns null which maps to labourTypeId = null.
  const labourTypeOptions = useMemo<TooltipSelectOption<string>[]>(
    () => [
      { value: "", label: "- none -" },
      ...labourRates.map((r) => ({ value: r.id, label: r.role }))
    ],
    [labourRates]
  );

  // Map labourRate.id → dayRate number for O(1) lookup in cells.
  const labourRateById = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of labourRates) map.set(r.id, Number(r.dayRate));
    return map;
  }, [labourRates]);

  // SCOPE_WBS_PLANT_V1 — plant type options for the Type dropdown (grouped by
  // category). The "- none -" sentinel is prepended so a cleared select maps
  // to plantRateId = null.
  const plantTypeOptions = useMemo<TooltipSelectOption<string>[]>(() => {
    const nonTransport = plantRates.filter((p) => !isTransportPlant(p));
    // Group by category; uncategorised items surface under their own name.
    const grouped = new Map<string, PlantRate[]>();
    for (const p of nonTransport) {
      const cat = p.category ?? "Other";
      const arr = grouped.get(cat) ?? [];
      arr.push(p);
      grouped.set(cat, arr);
    }
    const result: TooltipSelectOption<string>[] = [{ value: "", label: "- none -" }];
    for (const [cat, items] of grouped) {
      for (const p of items) {
        result.push({ value: p.id, label: `${cat}: ${p.item}` });
      }
    }
    return result;
  }, [plantRates]);

  // Map plantRate.id → { rate, unit } for O(1) lookup in cells.
  const plantRateById = useMemo(() => {
    const map = new Map<string, { rate: number; unit: string; item: string }>();
    for (const r of plantRates) map.set(r.id, { rate: Number(r.rate), unit: r.unit, item: r.item });
    return map;
  }, [plantRates]);

  // SCOPE_WBS_PLANT_V1 — helpers to read and write per-row plant state.
  const defaultRowPlant = useCallback((): RowPlantState => ({
    plantRateId: null,
    customDescription: null,
    dayRateOverride: null,
    qty: "",
    days: ""
  }), []);

  const getRowPlant = useCallback(
    (itemId: string, rowIdx: number): RowPlantState => {
      const key = `${itemId}:${rowIdx}`;
      return itemPlantRows.get(key) ?? defaultRowPlant();
    },
    [itemPlantRows, defaultRowPlant]
  );

  const setRowPlant = useCallback(
    (itemId: string, rowIdx: number, patch: Partial<RowPlantState>) => {
      const key = `${itemId}:${rowIdx}`;
      setItemPlantRows((prev) => {
        const next = new Map(prev);
        const current = prev.get(key) ?? {
          plantRateId: null,
          customDescription: null,
          dayRateOverride: null,
          qty: "",
          days: ""
        };
        next.set(key, { ...current, ...patch });
        return next;
      });
    },
    []
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
           width constraint so it takes all slack.
           SCOPE_WBS_MANPOWER_V1 — The Manpower group now occupies 6
           discrete columns (Type/Qty/Days/Shift/Day rate/Total) instead
           of the single spanning cell from slice 2.
           SCOPE_WBS_PLANT_V1 — Plant group now occupies 5 discrete
           columns (Type/Qty/Days/Day rate/Total) instead of the single
           spanning cell from slices 2-3. Measurement stays in its own
           spanning cell until slice 5 moves it. */
        <table style={subtblStyle} aria-label="WBS items">
          <colgroup>
            {/* Remove slot — always reserved so money column keeps one right edge */}
            <col />
            {/* WBS code */}
            <col />
            {/* Description — expands */}
            <col style={{ width: "100%" }} />
            {/* SCOPE_WBS_MANPOWER_V1 — Manpower group: 6 fit columns */}
            <col />{/* Type */}
            <col />{/* Qty */}
            <col />{/* Days */}
            <col />{/* Shift */}
            <col />{/* Day rate */}
            <col />{/* Total */}
            {/* SCOPE_WBS_PLANT_V1 — Plant group: 5 fit columns */}
            <col />{/* Type */}
            <col />{/* Qty */}
            <col />{/* Days */}
            <col />{/* Day rate */}
            <col />{/* Total */}
            {/* Measurement — spanning cell; slice 5 will split */}
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
              {/* SCOPE_WBS_MANPOWER_V1 — Manpower group header spans 6 columns */}
              <th
                colSpan={6}
                style={{ ...thStyle, textAlign: "center", borderBottom: "1px solid var(--border-default, #e5e7eb)" }}
              >
                Manpower
              </th>
              {/* SCOPE_WBS_PLANT_V1 — Plant group header spans 5 columns */}
              <th
                colSpan={5}
                style={{ ...thStyle, textAlign: "center", borderBottom: "1px solid var(--border-default, #e5e7eb)" }}
              >
                Plant
              </th>
              {/* Measurement header — single spanning cell; slice 5 will split */}
              <th style={{ ...thStyle, textAlign: "center" }}>Measurement</th>
              <th style={thStyle}>Markup</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Item total</th>
            </tr>
            {/* SCOPE_WBS_MANPOWER_V1 — sub-header row for individual manpower columns */}
            {/* SCOPE_WBS_PLANT_V1 — sub-header row extended with plant columns */}
            <tr>
              <th style={thStyle} aria-label="Remove" />
              <th style={thStyle} />
              <th style={thDescStyle} />
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Qty</th>
              <th style={thStyle}>Days</th>
              <th style={thStyle}>Shift</th>
              <th style={thStyle}>Day rate</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
              {/* SCOPE_WBS_PLANT_V1 — plant sub-headers */}
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Qty</th>
              <th style={thStyle}>Days</th>
              <th style={thStyle}>Day rate</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
              <th style={thStyle} />
              <th style={thStyle} />
              <th style={thStyle} />
            </tr>
          </thead>
          {wbsSortedVisible.map((item) => {
              const rowCount = itemRowCounts.get(item.id) ?? 1;
              const localMarkup = itemMarkupOverrides.get(item.id) ?? null;
              const overridden = isMarkupOverridden(localMarkup, cardMarkup);
              const displayMarkup = effectiveMarkup(localMarkup, cardMarkup);
              const isAi = item.aiProposed && item.status !== "confirmed";
              const confidence = item.aiConfidence ? CONFIDENCE_STYLE[item.aiConfidence] : null;
              const isPending = pendingIds.has(item.id);

              // Render rowCount <tr> elements; identity columns span all.
              const rows = Array.from({ length: rowCount }, (_, rowIdx) => {
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
                            placeholder="Notes for this item…"
                          />
                        </div>
                      </td>
                    ) : null}

                    {/* ── SCOPE_WBS_MANPOWER_V1 — Manpower column group (6 cells per row) ── */}
                    <ManpowerRowCells
                      item={item}
                      rowIdx={rowIdx}
                      rowState={getRowManpower(item, rowIdx)}
                      labourTypeOptions={labourTypeOptions}
                      labourRateById={labourRateById}
                      isAi={isAi}
                      onLabourTypeChange={(typeId) => setRowManpower(item.id, rowIdx, { labourTypeId: typeId })}
                      onQtyBlur={(v) => {
                        setRowManpower(item.id, rowIdx, { qty: v });
                        if (rowIdx === 0) void patchItem(item.id, { men: v === "" ? null : Number(v) });
                      }}
                      onDaysBlur={(v) => {
                        setRowManpower(item.id, rowIdx, { days: v });
                        if (rowIdx === 0) void patchItem(item.id, { days: v === "" ? null : Number(v) });
                      }}
                      onShiftChange={(v) => {
                        setRowManpower(item.id, rowIdx, { shift: v });
                        if (rowIdx === 0) void patchItem(item.id, { shift: v });
                      }}
                      onDayRateOverride={(v) => setRowManpower(item.id, rowIdx, { dayRateOverride: v })}
                    />
                    {/* ── SCOPE_WBS_PLANT_V1 — Plant column group (5 cells per row) ── */}
                    <PlantRowCells
                      item={item}
                      rowIdx={rowIdx}
                      rowState={getRowPlant(item.id, rowIdx)}
                      plantTypeOptions={plantTypeOptions}
                      plantRateById={plantRateById}
                      isAi={isAi}
                      onPlantTypeChange={(plantRateId) =>
                        setRowPlant(item.id, rowIdx, {
                          plantRateId,
                          customDescription: null,
                          dayRateOverride: null
                        })
                      }
                      onCustomDescription={(desc) =>
                        setRowPlant(item.id, rowIdx, { plantRateId: null, customDescription: desc })
                      }
                      onRevertToList={() =>
                        setRowPlant(item.id, rowIdx, {
                          plantRateId: null,
                          customDescription: null,
                          dayRateOverride: null
                        })
                      }
                      onQtyBlur={(v) => setRowPlant(item.id, rowIdx, { qty: v })}
                      onDaysBlur={(v) => setRowPlant(item.id, rowIdx, { days: v })}
                      onDayRateOverride={(v) => setRowPlant(item.id, rowIdx, { dayRateOverride: v })}
                    />
                    {/* ── Measurement spanning cell (per-row) — slice 5 will extract ── */}
                    <td style={{ ...fitCellStyle, ...tdBorderStyle }}>
                      <ItemMeasurementCell
                        item={item}
                        rowIdx={rowIdx}
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

              // SCOPE_WBS_TABLE_V1 — one <tbody> per WBS item. The rowspan
              // already asserts that these <tr>s are a single item; giving
              // each item its own tbody makes that grouping addressable to
              // assistive tech and to the acceptance suite, which until this
              // slice scoped itself to the card <article> that the table
              // replaced. Multiple tbody elements in one table are valid.
              //
              // The description renders into an <input>, and an input's value
              // is not text content — so neither a screen reader walking the
              // group nor a test can find an item by the words in it. Carry
              // it on the group as data-item-description.
              return (
                <tbody
                  key={item.id}
                  data-testid="wbs-item"
                  data-wbs-code={item.wbsCode}
                  data-item-description={item.description}
                >
                  {rows}
                </tbody>
              );
            })}
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

// ── SCOPE_WBS_MANPOWER_V1 — ManpowerRowCells ────────────────────────────
// Renders the 6 per-row manpower columns:
//   Type · Qty · Days · Shift · Day rate · Total
// Each column is a separate <td> (not a single spanning cell).
// When Type is unset, Qty / Days / Shift are disabled but the cells
// are still rendered at full width so column widths are stable.

type ManpowerRowCellsProps = {
  item: ScopeItem;
  rowIdx: number;
  rowState: RowManpowerState;
  labourTypeOptions: TooltipSelectOption<string>[];
  labourRateById: Map<string, number>;
  isAi: boolean;
  onLabourTypeChange: (typeId: string | null) => void;
  onQtyBlur: (v: string) => void;
  onDaysBlur: (v: string) => void;
  onShiftChange: (v: string) => void;
  onDayRateOverride: (v: number | null) => void;
};

function ManpowerRowCells({
  item,
  rowIdx,
  rowState,
  labourTypeOptions,
  labourRateById,
  isAi,
  onLabourTypeChange,
  onQtyBlur,
  onDaysBlur,
  onShiftChange,
  onDayRateOverride
}: ManpowerRowCellsProps) {
  const hasType = rowState.labourTypeId !== null;
  // Catalogue rate for the selected type (null = no type selected).
  const catalogueRate = rowState.labourTypeId ? (labourRateById.get(rowState.labourTypeId) ?? null) : null;
  const rateIsOverridden = isDayRateOverridden(rowState.dayRateOverride, catalogueRate);
  const resolvedRate = effectiveDayRate(rowState.dayRateOverride, catalogueRate);

  // Qty / Days raw values: row 0 reads from item.men / item.days; extra rows from rowState.
  const qtyValue = rowIdx === 0 ? (item.men ?? "") : rowState.qty;
  const daysValue = rowIdx === 0 ? (item.days ?? "") : rowState.days;
  const shiftValue = rowIdx === 0 ? (item.shift ?? "Day") : rowState.shift;

  const qtyNum = qtyValue === "" ? null : Number(qtyValue);
  const daysNum = daysValue === "" ? null : Number(daysValue);
  const rowTotal = manpowerRowTotal(qtyNum, daysNum, resolvedRate);

  // Controlled local qty / days so the user can type freely before blur.
  const [localQty, setLocalQty] = useState(String(qtyValue));
  const [localDays, setLocalDays] = useState(String(daysValue));

  // Sync when the item prop changes (server reload after patchItem).
  useEffect(() => {
    setLocalQty(String(rowIdx === 0 ? (item.men ?? "") : rowState.qty));
  }, [item.men, rowState.qty, rowIdx]);
  useEffect(() => {
    setLocalDays(String(rowIdx === 0 ? (item.days ?? "") : rowState.days));
  }, [item.days, rowState.days, rowIdx]);

  // Local day-rate input controlled state.
  const [localDayRate, setLocalDayRate] = useState(
    rowState.dayRateOverride !== null ? String(rowState.dayRateOverride) : ""
  );
  useEffect(() => {
    setLocalDayRate(rowState.dayRateOverride !== null ? String(rowState.dayRateOverride) : "");
  }, [rowState.dayRateOverride]);

  const shiftOptions: TooltipSelectOption<string>[] = SHIFT_OPTIONS.map((s) => ({ value: s, label: s }));

  const cellSt: CSSProperties = { ...fitCellStyle, ...tdBorderStyle, verticalAlign: "top" };

  return (
    <>
      {/* Type */}
      <td style={cellSt} data-manpower-col="type">
        <TooltipSelect
          value={rowState.labourTypeId ?? ""}
          options={labourTypeOptions}
          onChange={(v) => onLabourTypeChange(v === "" ? null : (v ?? null))}
          disabled={isAi}
          ariaLabel={`Labour type for row ${rowIdx + 1}`}
          style={{ height: 28, minWidth: 140 }}
        />
      </td>

      {/* Qty (men) */}
      <td style={cellSt} data-manpower-col="qty">
        <input
          className="s7-input"
          type="number"
          step="0.01"
          value={localQty}
          disabled={isAi || !hasType}
          aria-label={`Qty for row ${rowIdx + 1}`}
          title={hasType ? "Number of men" : "Select a Type first"}
          style={{ width: 54, height: 28, padding: "0 4px" }}
          onChange={(e) => setLocalQty(e.target.value)}
          onBlur={() => onQtyBlur(localQty)}
        />
      </td>

      {/* Days */}
      <td style={cellSt} data-manpower-col="days">
        <input
          className="s7-input"
          type="number"
          step="0.5"
          value={localDays}
          disabled={isAi || !hasType}
          aria-label={`Days for row ${rowIdx + 1}`}
          title={hasType ? "Number of days" : "Select a Type first"}
          style={{ width: 54, height: 28, padding: "0 4px" }}
          onChange={(e) => setLocalDays(e.target.value)}
          onBlur={() => onDaysBlur(localDays)}
        />
      </td>

      {/* Shift */}
      <td style={cellSt} data-manpower-col="shift">
        <TooltipSelect
          value={shiftValue}
          options={shiftOptions}
          onChange={(v) => onShiftChange(v ?? "Day")}
          disabled={isAi || !hasType}
          ariaLabel={`Shift for row ${rowIdx + 1}`}
          style={{ height: 28, minWidth: 80 }}
        />
      </td>

      {/* Day rate — OverrideField following the card-level markup override pattern */}
      <td style={cellSt} data-manpower-col="day-rate">
        <OverrideField
          isOverridden={rateIsOverridden}
          onRevert={() => {
            onDayRateOverride(null);
            setLocalDayRate("");
          }}
          affordance={false}
        >
          <input
            className="s7-input"
            type="number"
            step="0.01"
            value={localDayRate}
            placeholder={catalogueRate !== null ? String(catalogueRate) : "—"}
            disabled={isAi}
            aria-label={`Day rate for row ${rowIdx + 1}`}
            title={
              rateIsOverridden
                ? `Rate override active. Locked rate: $${catalogueRate != null ? catalogueRate : "—"}/day`
                : catalogueRate !== null
                  ? `Locked rate: $${catalogueRate}/day`
                  : "Select a Type to see the rate"
            }
            style={{ width: 72, height: 28, padding: "0 4px" }}
            onChange={(e) => setLocalDayRate(e.target.value)}
            onBlur={() => {
              if (localDayRate === "") {
                onDayRateOverride(null);
              } else {
                const n = Number(localDayRate);
                if (Number.isFinite(n)) onDayRateOverride(n);
              }
            }}
          />
        </OverrideField>
      </td>

      {/* Total — read-only, right-aligned, tabular-nums; em dash when no manpower */}
      <td
        style={{ ...cellSt, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        data-manpower-col="total"
        aria-label={`Manpower total for row ${rowIdx + 1}`}
        title="Qty x Days x Day rate (display only; server is authoritative)"
      >
        {fmtManpowerTotal(rowTotal)}
      </td>
    </>
  );
}

// ── SCOPE_WBS_PLANT_V1 — PlantRowCells ──────────────────────────────────────
// Renders the 5 per-row plant columns:
//   Type · Qty · Days · Day rate · Total
// Each column is a separate <td> (not a single spanning cell), mirroring
// ManpowerRowCells exactly. Type is a grouped catalogue select; the estimator
// can drop out to a free-text custom machine. A custom machine has NO locked
// rate — its Day rate cell is an override-by-definition, placeholder "rate".
// When Type is unset, Qty / Days are disabled but rendered at full width so
// column widths are stable (same rule as ManpowerRowCells).

type PlantRowCellsProps = {
  item: ScopeItem;
  rowIdx: number;
  rowState: RowPlantState;
  plantTypeOptions: TooltipSelectOption<string>[];
  plantRateById: Map<string, { rate: number; unit: string; item: string }>;
  isAi: boolean;
  onPlantTypeChange: (plantRateId: string | null) => void;
  onCustomDescription: (desc: string) => void;
  onRevertToList: () => void;
  onQtyBlur: (v: string) => void;
  onDaysBlur: (v: string) => void;
  onDayRateOverride: (v: number | null) => void;
};

function PlantRowCells({
  item: _item,
  rowIdx,
  rowState,
  plantTypeOptions,
  plantRateById,
  isAi,
  onPlantTypeChange,
  onCustomDescription,
  onRevertToList,
  onQtyBlur,
  onDaysBlur,
  onDayRateOverride
}: PlantRowCellsProps) {
  const isCustom = rowState.customDescription !== null;
  const hasType = rowState.plantRateId !== null || isCustom;

  // Catalogue rate for the selected type (null = no type or custom machine).
  const catalogueEntry = rowState.plantRateId ? plantRateById.get(rowState.plantRateId) : null;
  const catalogueRate = catalogueEntry ? catalogueEntry.rate : null;
  const catalogueUnit = catalogueEntry ? catalogueEntry.unit : null;

  // Custom machines have no locked rate — override is by definition.
  const rateIsOverridden = isCustom
    ? rowState.dayRateOverride !== null
    : isPlantRateOverridden(rowState.dayRateOverride, catalogueRate);
  const resolvedRate = isCustom
    ? rowState.dayRateOverride
    : effectivePlantRate(rowState.dayRateOverride, catalogueRate);

  const qtyNum = rowState.qty === "" ? null : Number(rowState.qty);
  const daysNum = rowState.days === "" ? null : Number(rowState.days);
  const rowTotal = plantRowTotal(qtyNum, daysNum, resolvedRate);

  // Controlled local inputs.
  const [localQty, setLocalQty] = useState(rowState.qty);
  const [localDays, setLocalDays] = useState(rowState.days);
  const [localDayRate, setLocalDayRate] = useState(
    rowState.dayRateOverride !== null ? String(rowState.dayRateOverride) : ""
  );
  const [localCustomDesc, setLocalCustomDesc] = useState(rowState.customDescription ?? "");

  useEffect(() => { setLocalQty(rowState.qty); }, [rowState.qty]);
  useEffect(() => { setLocalDays(rowState.days); }, [rowState.days]);
  useEffect(() => {
    setLocalDayRate(rowState.dayRateOverride !== null ? String(rowState.dayRateOverride) : "");
  }, [rowState.dayRateOverride]);
  useEffect(() => {
    setLocalCustomDesc(rowState.customDescription ?? "");
  }, [rowState.customDescription]);

  const cellSt: CSSProperties = { ...fitCellStyle, ...tdBorderStyle, verticalAlign: "top" };

  return (
    <>
      {/* Type — catalogue select or custom text input */}
      <td style={cellSt} data-plant-col="type">
        {isCustom ? (
          /* Custom machine: free-text input + revert control */
          <OverrideField
            isOverridden={true}
            onRevert={onRevertToList}
            affordance={false}
          >
            <input
              className="s7-input"
              type="text"
              value={localCustomDesc}
              disabled={isAi}
              aria-label={`Custom plant description for row ${rowIdx + 1}`}
              title="Custom machine — not in catalogue. Click revert to return to the list."
              style={{ width: 140, height: 28, padding: "0 4px" }}
              onChange={(e) => setLocalCustomDesc(e.target.value)}
              onBlur={() => onCustomDescription(localCustomDesc)}
            />
          </OverrideField>
        ) : (
          <TooltipSelect
            value={rowState.plantRateId ?? ""}
            options={plantTypeOptions}
            onChange={(v) => {
              if (v === "" || v == null) {
                onPlantTypeChange(null);
              } else if (v === "__custom__") {
                onCustomDescription("");
              } else {
                onPlantTypeChange(v);
              }
            }}
            disabled={isAi}
            ariaLabel={`Plant type for row ${rowIdx + 1}`}
            style={{ height: 28, minWidth: 140 }}
          />
        )}
      </td>

      {/* Qty */}
      <td style={cellSt} data-plant-col="qty">
        <input
          className="s7-input"
          type="number"
          step="0.01"
          value={localQty}
          disabled={isAi || !hasType}
          aria-label={`Plant qty for row ${rowIdx + 1}`}
          title={hasType ? "Quantity" : "Select a Type first"}
          style={{ width: 54, height: 28, padding: "0 4px" }}
          onChange={(e) => setLocalQty(e.target.value)}
          onBlur={() => onQtyBlur(localQty)}
        />
      </td>

      {/* Days */}
      <td style={cellSt} data-plant-col="days">
        <input
          className="s7-input"
          type="number"
          step="0.5"
          value={localDays}
          disabled={isAi || !hasType}
          aria-label={`Plant days for row ${rowIdx + 1}`}
          title={hasType ? "Number of days" : "Select a Type first"}
          style={{ width: 54, height: 28, padding: "0 4px" }}
          onChange={(e) => setLocalDays(e.target.value)}
          onBlur={() => onDaysBlur(localDays)}
        />
      </td>

      {/* Day rate — for catalogue picks uses OverrideField (amber when overridden,
          revert restores locked rate); for custom machines the input is plain
          (no locked rate to revert to). Rate unit badge shows /day, /hr etc. */}
      <td style={cellSt} data-plant-col="day-rate">
        {isCustom ? (
          /* Custom machine: plain rate input, no locked rate, no revert */
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <input
              className="s7-input"
              type="number"
              step="0.01"
              value={localDayRate}
              placeholder="rate"
              disabled={isAi}
              aria-label={`Plant day rate for row ${rowIdx + 1}`}
              title="Custom machine — no locked rate. Enter rate manually."
              style={{ width: 72, height: 28, padding: "0 4px" }}
              onChange={(e) => setLocalDayRate(e.target.value)}
              onBlur={() => {
                if (localDayRate === "") {
                  onDayRateOverride(null);
                } else {
                  const n = Number(localDayRate);
                  if (Number.isFinite(n)) onDayRateOverride(n);
                }
              }}
            />
          </div>
        ) : (
          /* Catalogue pick: OverrideField shows amber when rate differs from locked */
          <OverrideField
            isOverridden={rateIsOverridden}
            onRevert={() => {
              onDayRateOverride(null);
              setLocalDayRate("");
            }}
            affordance={false}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                value={localDayRate}
                placeholder={
                  catalogueRate !== null
                    ? String(catalogueRate)
                    : "—"
                }
                disabled={isAi}
                aria-label={`Plant day rate for row ${rowIdx + 1}`}
                title={
                  rateIsOverridden
                    ? `Rate override active. Locked rate: $${catalogueRate != null ? catalogueRate : "—"}/${catalogueUnit ?? "day"}`
                    : catalogueRate !== null
                      ? `Locked rate: $${catalogueRate}/${catalogueUnit ?? "day"}`
                      : "Select a Type to see the rate"
                }
                style={{ width: 72, height: 28, padding: "0 4px" }}
                onChange={(e) => setLocalDayRate(e.target.value)}
                onBlur={() => {
                  if (localDayRate === "") {
                    onDayRateOverride(null);
                  } else {
                    const n = Number(localDayRate);
                    if (Number.isFinite(n)) onDayRateOverride(n);
                  }
                }}
              />
              {/* Rate unit badge — shows /day, /hr, /week etc. as the catalogue records it */}
              {catalogueUnit ? (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted, #6b7280)",
                    whiteSpace: "nowrap",
                    userSelect: "none"
                  }}
                  title={`Rate unit: ${catalogueUnit}`}
                >
                  /{catalogueUnit}
                </span>
              ) : null}
            </div>
          </OverrideField>
        )}
      </td>

      {/* Total — read-only, right-aligned, tabular-nums; em dash when no plant */}
      <td
        style={{ ...cellSt, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        data-plant-col="total"
        aria-label={`Plant total for row ${rowIdx + 1}`}
        title="Qty x Days x Day rate (display only; server is authoritative)"
      >
        {fmtPlantTotal(rowTotal)}
      </td>
    </>
  );
}

// ── ItemMeasurementCell ────────────────────────────────────────────────────
// Per-row measurement cell. Slice 4 extracted plant into discrete columns;
// this cell retains the full measurement section until slice 5 moves it.

type ItemMeasurementCellProps = {
  item: ScopeItem;
  rowIdx: number;
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, MaterialLookup>;
  isAi: boolean;
  onPatch: (body: Record<string, unknown>) => void;
};

function ItemMeasurementCell({
  item,
  rowIdx,
  wasteGroupOptions,
  wasteItemsByGroup,
  materialOptions,
  materialDensityMap,
  isAi,
  onPatch
}: ItemMeasurementCellProps) {
  // Only row 0 has measurement data; additional rows show a placeholder
  // until slice 5 handles them.
  if (rowIdx > 0) {
    return null;
  }

  return (
    <ItemBodyInputs
      item={item}
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
// Measurement-only block for a scope item's first row. Slice 4 extracted
// plant into PlantRowCells; this component retains the measurement section
// (L/H/D, material, waste) until slice 5 moves it.

type ItemBodyInputsProps = {
  item: ScopeItem;
  wasteGroupOptions: TooltipSelectOption<string>[];
  wasteItemsByGroup: Map<string, string[]>;
  materialOptions: TooltipSelectOption<string>[];
  materialDensityMap: Map<string, MaterialLookup>;
  isAi: boolean;
  onPatch: (body: Record<string, unknown>) => void;
};

function ItemBodyInputs({
  item,
  wasteGroupOptions,
  wasteItemsByGroup,
  materialOptions,
  materialDensityMap,
  isAi,
  onPatch
}: ItemBodyInputsProps) {
  // PR feat/scope-each-factor — active kind for row 1.
  const row1Kind: "VOLUME" | "AREA" | "EACH" | "FACTOR" = (item.materialKind as "VOLUME" | "AREA" | "EACH" | "FACTOR") ?? "VOLUME";

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
      {/* SCOPE_WBS_PLANT_V1 — plant section extracted to PlantRowCells columns. */}
      {/* Measurement — stays exactly where it is until slice 5 */}
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
              // kg/m³ → t/m³ (÷1000); kg/m² is stored as-is (the sqm fallback
              // in computeDerivedDimensions already divides by 1000 for sheets).
              // NOTE: these unit strings are DATA, not copy - they must match the
              // values seeded in apps/api/prisma/seed-initial-services.ts exactly,
              // superscripts included. A flattened ASCII form never matches, silently
              // skips the ÷1000 and overstates tonnage 1000x.
              const newDensity = lookup
                ? (lookup.unit === "kg/m³"
                    ? Number(lookup.density) / 1000
                    : Number(lookup.density))
                : null;
              const newKind = lookup?.kind ?? "VOLUME";
              const isSheet = lookup?.unit === "kg/m²";
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
              title="Factor: tonnes = sqm × factor"
              onChange={(e) => setRow1Factor(e.target.value)}
              onBlur={persistDims}
            />
          </FieldCell>
        ) : (
          <FieldCell label={row1Kind === "EACH" ? "kg/item" : "Density (t/m³)"} width={80}>
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
                    ? "Per-item weight in kg (tonnes = qty × kg/1000)"
                    : "Manual density (tonnes per m³)"
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
              title="Number of items (tonnes = qty × kg/item ÷ 1000)"
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
              title="Auto = length × height. Type to override."
              onChange={(e) => setDim("sqm", e.target.value)}
              onBlur={persistDims}
            />
          </OverrideField>
        </FieldCell>
        <FieldCell label="M³" width={80}>
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
              title="Auto = sqm × depth. Type to override."
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
              title="Auto = m³ × density or sqm × density / 1000. Type to override."
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
              // kg/m³ → t/m³ (÷1000); kg/m² is stored as-is (the sqm fallback
              // in computeDerivedDimensions already divides by 1000 for sheets).
              // NOTE: these unit strings are DATA, not copy - they must match the
              // values seeded in apps/api/prisma/seed-initial-services.ts exactly,
              // superscripts included. A flattened ASCII form never matches, silently
              // skips the ÷1000 and overstates tonnage 1000x.
              const newDensity = lookup
                ? lookup.unit === "kg/m³"
                  ? Number(lookup.density) / 1000
                  : Number(lookup.density)
                : null;
              const newKind = lookup?.kind ?? "VOLUME";
              const isSheet = lookup?.unit === "kg/m²";
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
              title="Factor: tonnes = sqm × factor"
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
          <FieldCell label={matKind === "EACH" ? "kg/item" : "Density (t/m³)"} width={80}>
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
                    ? "Per-item weight in kg (tonnes = qty × kg/1000)"
                    : "Manual density (tonnes per m³)"
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
              title="Number of items (tonnes = qty × kg/item ÷ 1000)"
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
            title="Auto = length × height. Type to override."
            onBlur={(e) => onChange({ sqm: numOrNull(e.target.value) })}
          />
        </FieldCell>
        <FieldCell label="M³" width={80}>
          <input
            className="s7-input"
            type="number"
            step="0.01"
            defaultValue={strOf(entry.m3 ?? derived.m3)}
            placeholder={derived.m3 == null ? "" : String(derived.m3)}
            disabled={disabled}
            style={{ width: 80, height: 32 }}
            title="Auto = sqm × depth. Type to override."
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
            title="Auto = m³ × density or sqm × density / 1000. Type to override."
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
      title="Task hours: persons × days × 8h"
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
