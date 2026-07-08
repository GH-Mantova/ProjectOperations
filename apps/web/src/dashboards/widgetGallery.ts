/**
 * Add-widget gallery — pure logic.
 *
 * Visual-kind classification, the two-step gallery state machine, size
 * options, and placement insertion. Keep this file logic-only (no React/JSX)
 * so it can be unit-tested cheaply — same pattern as customWidget.ts.
 */

import { CUSTOM_WIDGET_TYPE, DATA_SOURCE_BY_KEY, chartsForMetric, defaultTitle, metricsForSource } from "./customWidget";
import { resolveSpan, type ConfigField, type WidgetConfigEntry, type WidgetFilters, type WidgetMeta, type WidgetPeriod } from "./types";

// ── Visual kinds (gallery left rail) ─────────────────────────

export type GalleryKind = "kpi" | "bar" | "line" | "donut" | "list" | "custom";

export const GALLERY_KIND_ORDER: GalleryKind[] = ["kpi", "bar", "line", "donut", "list", "custom"];

export const GALLERY_KIND_LABELS: Record<GalleryKind, string> = {
  kpi: "KPI cards",
  bar: "Bar charts",
  line: "Line & trend",
  donut: "Donut & share",
  list: "Tables & lists",
  custom: "Custom"
};

export const GALLERY_KIND_ICONS: Record<GalleryKind, string> = {
  kpi: "▦",
  bar: "▍",
  line: "∿",
  donut: "◔",
  list: "☰",
  custom: "✚"
};

// Types whose visual shape can't be inferred from the size tag or type name.
const KIND_OVERRIDES: Record<string, GalleryKind> = {
  ten_win_rate_chart: "bar",
  ten_win_rate_by_client: "bar",
  ten_pipeline_by_estimator: "donut",
  ten_loss_reasons: "donut",
  // Program snapshot renders horizontal task bars over a time window — bar
  // rail is the closest match; the heatmap is grid/table-shaped so belongs
  // with tables & lists.
  ops_project_timeline: "bar",
  ops_program_snapshot: "bar",
  ops_availability_heatmap: "list",
  // Static annotation widgets — rendered from the "custom" rail so users find
  // them alongside the free-form Custom widget builder.
  annot_text_heading: "custom",
  annot_text_note: "custom",
  [CUSTOM_WIDGET_TYPE]: "custom"
};

export function galleryKindFor(meta: WidgetMeta): GalleryKind {
  const override = KIND_OVERRIDES[meta.type];
  if (override) return override;
  if (meta.size === "kpi") return "kpi";
  if (meta.type.includes("bar")) return "bar";
  if (meta.type.includes("line")) return "line";
  if (meta.type.includes("donut")) return "donut";
  return "list";
}

/** Kinds that have at least one registered widget, in rail order. */
export function galleryKinds(widgets: ReadonlyArray<WidgetMeta>): GalleryKind[] {
  const present = new Set(widgets.map(galleryKindFor));
  return GALLERY_KIND_ORDER.filter((kind) => present.has(kind));
}

export function widgetsForKind(widgets: ReadonlyArray<WidgetMeta>, kind: GalleryKind): WidgetMeta[] {
  return widgets.filter((w) => galleryKindFor(w) === kind);
}

/** Case-insensitive substring match across name + description. Empty/whitespace
 *  query returns the full input list unchanged. */
export function searchWidgets(widgets: ReadonlyArray<WidgetMeta>, query: string): WidgetMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...widgets];
  return widgets.filter((w) => {
    const name = (w.name ?? "").toLowerCase();
    const desc = (w.description ?? "").toLowerCase();
    return name.includes(q) || desc.includes(q);
  });
}

/** Stable localeCompare sort by name. */
export function sortWidgets(widgets: ReadonlyArray<WidgetMeta>, dir: "asc" | "desc"): WidgetMeta[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...widgets].sort((a, b) => a.name.localeCompare(b.name) * factor);
}

// ── Step-2 config fields ─────────────────────────────────────

/** Config fields renderable in the gallery's configure step. Fields backed
 *  by dynamic option fetches (estimators, form templates) are refined via
 *  the widget's settings popover after adding. */
export function configurableFields(meta: WidgetMeta): ConfigField[] {
  return (meta.configSchema ?? []).filter((f) => !f.dynamicOptions);
}

export function hasDeferredFields(meta: WidgetMeta): boolean {
  return (meta.configSchema ?? []).some((f) => Boolean(f.dynamicOptions));
}

/** Seed a filters bag from configSchema defaults; custom widgets get a
 *  valid source/metric/chart combination so the preview renders instantly. */
export function defaultFiltersFor(meta: WidgetMeta): WidgetFilters {
  if (meta.type === CUSTOM_WIDGET_TYPE) {
    const source = DATA_SOURCE_BY_KEY.tenders;
    const metric = metricsForSource(source)[0];
    return {
      title: defaultTitle(source, metric),
      dataSource: source.key,
      metric,
      chartType: chartsForMetric(metric)[0]
    };
  }
  const filters: WidgetFilters = {};
  for (const field of configurableFields(meta)) {
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      filters[field.key] = field.defaultValue;
    }
  }
  return filters;
}

// ── Size options ─────────────────────────────────────────────

export type SizeOption = { colSpan: number; rowSpan: number; label: string; isDefault: boolean };

const SIZE_CANDIDATES: Array<[number, number]> = [
  [1, 1],
  [2, 1],
  [2, 2],
  [3, 2],
  [4, 2]
];

export function sizeOptionsFor(meta: WidgetMeta): SizeOption[] {
  const def = resolveSpan(meta, { id: "", type: meta.type, visible: true, order: 0, config: {} });
  const minCol = meta.minColSpan ?? 1;
  const maxCol = meta.maxColSpan ?? 4;
  const minRow = meta.minRowSpan ?? 1;
  const maxRow = meta.maxRowSpan ?? 4;
  const candidates = SIZE_CANDIDATES.filter(
    ([c, r]) => c >= minCol && c <= maxCol && r >= minRow && r <= maxRow
  );
  if (!candidates.some(([c, r]) => c === def.colSpan && r === def.rowSpan)) {
    candidates.push([def.colSpan, def.rowSpan]);
    candidates.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  return candidates.map(([colSpan, rowSpan]) => ({
    colSpan,
    rowSpan,
    isDefault: colSpan === def.colSpan && rowSpan === def.rowSpan,
    label: `${colSpan} × ${rowSpan}${colSpan === def.colSpan && rowSpan === def.rowSpan ? " (default)" : ""}`
  }));
}

// ── Two-step state machine ───────────────────────────────────

export type GalleryStep = "choose" | "configure";

export type GalleryState = {
  step: GalleryStep;
  kind: GalleryKind;
  /** Explicit selection — never derived from sibling state. */
  selectedTypeId: string | null;
  /** Cross-category search — non-empty hides the rail and shows a flat list. */
  query: string;
  /** Per-group name sort. Resets to "asc" whenever the active kind changes. */
  sortDir: "asc" | "desc";
  filters: WidgetFilters;
  period: WidgetPeriod | null;
  colSpan: number;
  rowSpan: number;
};

export type GalleryAction =
  | { type: "setKind"; kind: GalleryKind }
  | { type: "select"; meta: WidgetMeta }
  | { type: "next" }
  | { type: "back" }
  | { type: "setFilters"; filters: WidgetFilters }
  | { type: "setPeriod"; period: WidgetPeriod | null }
  | { type: "setSize"; colSpan: number; rowSpan: number }
  | { type: "setQuery"; query: string }
  | { type: "toggleSort" }
  | { type: "reset" };

export function initialGalleryState(kind: GalleryKind = "kpi"): GalleryState {
  return {
    step: "choose",
    kind,
    selectedTypeId: null,
    query: "",
    sortDir: "asc",
    filters: {},
    period: null,
    colSpan: 1,
    rowSpan: 1
  };
}

export function canProceed(state: GalleryState): boolean {
  return state.selectedTypeId !== null;
}

export function galleryReducer(state: GalleryState, action: GalleryAction): GalleryState {
  switch (action.type) {
    case "setKind":
      // Switching group always restarts the sort at A-Z so users get a
      // predictable ordering per rail.
      return { ...state, kind: action.kind, sortDir: "asc" };
    case "select": {
      const def = resolveSpan(action.meta, {
        id: "",
        type: action.meta.type,
        visible: true,
        order: 0,
        config: {}
      });
      return {
        ...state,
        selectedTypeId: action.meta.type,
        filters: defaultFiltersFor(action.meta),
        period: null,
        colSpan: def.colSpan,
        rowSpan: def.rowSpan
      };
    }
    case "next":
      // Guard: cannot advance without an explicit selection.
      if (!canProceed(state)) return state;
      return { ...state, step: "configure" };
    case "back":
      // Returning to step 1 keeps the selection and its config.
      return { ...state, step: "choose" };
    case "setFilters":
      return { ...state, filters: action.filters };
    case "setPeriod":
      return { ...state, period: action.period };
    case "setSize":
      return { ...state, colSpan: action.colSpan, rowSpan: action.rowSpan };
    case "setQuery":
      return { ...state, query: action.query };
    case "toggleSort":
      return { ...state, sortDir: state.sortDir === "asc" ? "desc" : "asc" };
    case "reset":
      return initialGalleryState(state.kind);
  }
}

export function buildEntry(state: GalleryState): WidgetConfigEntry | null {
  if (!state.selectedTypeId) return null;
  const id = `${state.selectedTypeId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    type: state.selectedTypeId,
    visible: true,
    order: 0,
    colSpan: state.colSpan,
    rowSpan: state.rowSpan,
    config: { period: state.period, filters: state.filters }
  };
}

// ── Placement ────────────────────────────────────────────────

/** Insert `entry` at `index` within the order-sorted widget list (null or
 *  out-of-range appends to the end) and renumber the whole list. */
export function insertWidgetAt(
  widgets: ReadonlyArray<WidgetConfigEntry>,
  entry: WidgetConfigEntry,
  index: number | null
): WidgetConfigEntry[] {
  const ordered = [...widgets].sort((a, b) => a.order - b.order);
  const at = index === null || index < 0 || index > ordered.length ? ordered.length : index;
  ordered.splice(at, 0, entry);
  return ordered.map((w, i) => ({ ...w, order: i }));
}

/** Remove the entry with `id` and renumber the remainder so `order` stays
 *  contiguous — the same normalization insertWidgetAt/reorder relies on. */
export function removeWidgetById(
  widgets: ReadonlyArray<WidgetConfigEntry>,
  id: string
): WidgetConfigEntry[] {
  return [...widgets]
    .sort((a, b) => a.order - b.order)
    .filter((w) => w.id !== id)
    .map((w, i) => ({ ...w, order: i }));
}
