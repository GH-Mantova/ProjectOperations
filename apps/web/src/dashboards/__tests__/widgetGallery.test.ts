import { describe, expect, it } from "vitest";
import { CUSTOM_WIDGET_TYPE } from "../customWidget";
import {
  GALLERY_KIND_ORDER,
  buildEntry,
  canProceed,
  configurableFields,
  defaultFiltersFor,
  galleryKindFor,
  galleryKinds,
  galleryReducer,
  hasDeferredFields,
  initialGalleryState,
  insertWidgetAt,
  searchWidgets,
  sizeOptionsFor,
  sortWidgets,
  widgetsForKind,
  type GalleryState
} from "../widgetGallery";
import { WIDGETS, WIDGET_BY_TYPE } from "../widgetRegistry";
import type { WidgetMeta, WidgetConfigEntry } from "../types";

const entry = (id: string, order: number): WidgetConfigEntry => ({
  id,
  type: "ops_active_jobs_kpi",
  visible: true,
  order,
  config: {}
});

describe("galleryKindFor", () => {
  it("classifies every registered widget into a rail category", () => {
    for (const meta of WIDGETS) {
      expect(GALLERY_KIND_ORDER).toContain(galleryKindFor(meta));
    }
  });

  it("uses the kpi size tag for KPI cards regardless of type name", () => {
    expect(galleryKindFor(WIDGET_BY_TYPE.compliance_expiring_items)).toBe("kpi");
    expect(galleryKindFor(WIDGET_BY_TYPE.safety_incidents_open)).toBe("kpi");
    expect(galleryKindFor(WIDGET_BY_TYPE.ops_active_jobs_kpi)).toBe("kpi");
  });

  it("resolves chart kinds that the type name alone cannot infer", () => {
    expect(galleryKindFor(WIDGET_BY_TYPE.ten_win_rate_chart)).toBe("bar");
    expect(galleryKindFor(WIDGET_BY_TYPE.ten_win_rate_by_client)).toBe("bar");
    expect(galleryKindFor(WIDGET_BY_TYPE.ten_pipeline_by_estimator)).toBe("donut");
    expect(galleryKindFor(WIDGET_BY_TYPE.ten_loss_reasons)).toBe("donut");
    expect(galleryKindFor(WIDGET_BY_TYPE[CUSTOM_WIDGET_TYPE])).toBe("custom");
  });

  it("falls back to list for table/list panels", () => {
    expect(galleryKindFor(WIDGET_BY_TYPE.ten_due_this_week)).toBe("list");
    expect(galleryKindFor(WIDGET_BY_TYPE.compliance_expiry_list)).toBe("list");
  });

  it("only surfaces categories with at least one registered type, in rail order", () => {
    const kinds = galleryKinds(WIDGETS);
    expect(kinds).toEqual(GALLERY_KIND_ORDER.filter((k) => kinds.includes(k)));
    for (const kind of kinds) {
      expect(widgetsForKind(WIDGETS, kind).length).toBeGreaterThan(0);
    }
  });
});

describe("gallery state machine", () => {
  const meta = WIDGET_BY_TYPE.ten_due_this_week;

  it("cannot advance to configure without an explicit selection", () => {
    const state = initialGalleryState();
    expect(canProceed(state)).toBe(false);
    const next = galleryReducer(state, { type: "next" });
    expect(next.step).toBe("choose");
  });

  it("select then next reaches configure with seeded defaults", () => {
    let state = galleryReducer(initialGalleryState(), { type: "select", meta });
    expect(state.selectedTypeId).toBe("ten_due_this_week");
    expect(state.filters).toEqual({ daysAhead: 7 });
    expect(canProceed(state)).toBe(true);
    state = galleryReducer(state, { type: "next" });
    expect(state.step).toBe("configure");
  });

  it("back returns to step 1 but keeps the selection and its config", () => {
    let state = galleryReducer(initialGalleryState(), { type: "select", meta });
    state = galleryReducer(state, { type: "next" });
    state = galleryReducer(state, { type: "setFilters", filters: { daysAhead: 14 } });
    state = galleryReducer(state, { type: "back" });
    expect(state.step).toBe("choose");
    expect(state.selectedTypeId).toBe("ten_due_this_week");
    expect(state.filters).toEqual({ daysAhead: 14 });
  });

  it("config changes produce a new filters object — the debounced preview refetch trigger", () => {
    const before = galleryReducer(initialGalleryState(), { type: "select", meta });
    const after = galleryReducer(before, { type: "setFilters", filters: { daysAhead: 3 } });
    expect(after.filters).not.toBe(before.filters);
    expect(after.filters.daysAhead).toBe(3);
  });

  it("selecting a widget resolves its default span", () => {
    const state = galleryReducer(initialGalleryState(), { type: "select", meta });
    // ten_due_this_week is size "half" → 2 × 2
    expect(state.colSpan).toBe(2);
    expect(state.rowSpan).toBe(2);
  });

  it("reset clears the selection but keeps the active rail category", () => {
    let state = galleryReducer(initialGalleryState("bar"), { type: "select", meta });
    state = galleryReducer(state, { type: "reset" });
    expect(state.selectedTypeId).toBeNull();
    expect(state.kind).toBe("bar");
  });
});

describe("buildEntry", () => {
  it("returns null without a selection", () => {
    expect(buildEntry(initialGalleryState())).toBeNull();
  });

  it("carries type, span, period and filters onto the entry", () => {
    let state: GalleryState = galleryReducer(initialGalleryState(), {
      type: "select",
      meta: WIDGET_BY_TYPE.ten_due_this_week
    });
    state = galleryReducer(state, { type: "setPeriod", period: "90d" });
    state = galleryReducer(state, { type: "setSize", colSpan: 4, rowSpan: 2 });
    const built = buildEntry(state);
    expect(built).not.toBeNull();
    expect(built!.type).toBe("ten_due_this_week");
    expect(built!.visible).toBe(true);
    expect(built!.colSpan).toBe(4);
    expect(built!.rowSpan).toBe(2);
    expect(built!.config).toEqual({ period: "90d", filters: { daysAhead: 7 } });
  });
});

describe("defaultFiltersFor", () => {
  it("gives custom widgets a valid source/metric/chart combination", () => {
    const filters = defaultFiltersFor(WIDGET_BY_TYPE[CUSTOM_WIDGET_TYPE]);
    expect(filters.dataSource).toBe("tenders");
    expect(filters.metric).toBe("count");
    expect(filters.chartType).toBe("kpi");
    expect(typeof filters.title).toBe("string");
  });

  it("seeds only schema defaults for registry widgets", () => {
    expect(defaultFiltersFor(WIDGET_BY_TYPE.ten_follow_up_queue)).toEqual({
      daysThreshold: 7,
      maxRows: 5
    });
    expect(defaultFiltersFor(WIDGET_BY_TYPE.ops_active_jobs_kpi)).toEqual({});
  });
});

describe("configurable fields", () => {
  it("excludes dynamic-option fields from the configure step", () => {
    const fields = configurableFields(WIDGET_BY_TYPE.ten_win_rate_chart);
    expect(fields.map((f) => f.key)).toEqual(["period", "groupBy"]);
    expect(hasDeferredFields(WIDGET_BY_TYPE.ten_win_rate_chart)).toBe(true);
    expect(hasDeferredFields(WIDGET_BY_TYPE.ten_due_this_week)).toBe(false);
  });
});

describe("sizeOptionsFor", () => {
  it("marks the registry default and stays within min/max bounds", () => {
    const options = sizeOptionsFor(WIDGET_BY_TYPE.fin_contracts_summary_kpi); // max 2×2
    expect(options.every((o) => o.colSpan <= 2 && o.rowSpan <= 2)).toBe(true);
    const def = options.find((o) => o.isDefault);
    expect(def).toMatchObject({ colSpan: 1, rowSpan: 1 });
  });

  it("always includes the widget's default span", () => {
    for (const meta of WIDGETS) {
      expect(sizeOptionsFor(meta).some((o) => o.isDefault)).toBe(true);
    }
  });
});

describe("searchWidgets", () => {
  const stub = (type: string, name: string, description: string): WidgetMeta => ({
    type,
    name,
    description,
    category: "operations",
    size: "kpi",
    component: () => null
  });

  const list: WidgetMeta[] = [
    stub("a", "Active jobs", "Count of jobs currently active"),
    stub("b", "Compliance expiring", "Documents that expire soon"),
    stub("c", "Tender win rate", "Percentage of tenders won this period"),
    stub("d", "Zebra crossings", "Unrelated safety widget")
  ];

  it("matches on name (case-insensitive) and returns matches only", () => {
    expect(searchWidgets(list, "active").map((w) => w.type)).toEqual(["a"]);
    expect(searchWidgets(list, "ACTIVE").map((w) => w.type)).toEqual(["a"]);
  });

  it("matches on description as well as name", () => {
    expect(searchWidgets(list, "expire").map((w) => w.type)).toEqual(["b"]);
    expect(searchWidgets(list, "tenders").map((w) => w.type)).toEqual(["c"]);
  });

  it("returns all widgets when query is empty or whitespace", () => {
    expect(searchWidgets(list, "").map((w) => w.type)).toEqual(["a", "b", "c", "d"]);
    expect(searchWidgets(list, "   ").map((w) => w.type)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns [] when nothing matches", () => {
    expect(searchWidgets(list, "nonsense-query")).toEqual([]);
  });
});

describe("sortWidgets", () => {
  const stub = (type: string, name: string): WidgetMeta => ({
    type,
    name,
    description: "",
    category: "operations",
    size: "kpi",
    component: () => null
  });

  it("sorts by name ascending via localeCompare", () => {
    const input = [stub("c", "Charlie"), stub("a", "alpha"), stub("b", "Bravo")];
    expect(sortWidgets(input, "asc").map((w) => w.name)).toEqual(["alpha", "Bravo", "Charlie"]);
  });

  it("sorts descending", () => {
    const input = [stub("a", "alpha"), stub("b", "Bravo"), stub("c", "Charlie")];
    expect(sortWidgets(input, "desc").map((w) => w.name)).toEqual(["Charlie", "Bravo", "alpha"]);
  });

  it("is stable for entries with the same name", () => {
    const input = [stub("first", "Same"), stub("second", "Same"), stub("third", "Same")];
    expect(sortWidgets(input, "asc").map((w) => w.type)).toEqual(["first", "second", "third"]);
    expect(sortWidgets(input, "desc").map((w) => w.type)).toEqual(["first", "second", "third"]);
  });

  it("does not mutate the input array", () => {
    const input = [stub("a", "Beta"), stub("b", "Alpha")];
    const snapshot = input.map((w) => w.type);
    sortWidgets(input, "asc");
    expect(input.map((w) => w.type)).toEqual(snapshot);
  });
});

describe("gallery reducer — search + sort", () => {
  it("setQuery / clearing query toggles between flat search and grouped view", () => {
    let state = initialGalleryState();
    expect(state.query).toBe("");
    state = galleryReducer(state, { type: "setQuery", query: "jobs" });
    expect(state.query).toBe("jobs");
    state = galleryReducer(state, { type: "setQuery", query: "" });
    expect(state.query).toBe("");
  });

  it("initial sortDir is asc", () => {
    expect(initialGalleryState().sortDir).toBe("asc");
  });

  it("toggleSort flips asc <-> desc", () => {
    let state = initialGalleryState();
    state = galleryReducer(state, { type: "toggleSort" });
    expect(state.sortDir).toBe("desc");
    state = galleryReducer(state, { type: "toggleSort" });
    expect(state.sortDir).toBe("asc");
  });

  it("setKind resets sortDir to asc", () => {
    let state = initialGalleryState("kpi");
    state = galleryReducer(state, { type: "toggleSort" });
    expect(state.sortDir).toBe("desc");
    state = galleryReducer(state, { type: "setKind", kind: "bar" });
    expect(state.kind).toBe("bar");
    expect(state.sortDir).toBe("asc");
  });
});

describe("insertWidgetAt (placement)", () => {
  const widgets = [entry("a", 0), entry("b", 1), entry("c", 2)];
  const pending = entry("new", 0);

  it("inserts at the chosen index and renumbers", () => {
    const next = insertWidgetAt(widgets, pending, 1);
    expect(next.map((w) => w.id)).toEqual(["a", "new", "b", "c"]);
    expect(next.map((w) => w.order)).toEqual([0, 1, 2, 3]);
  });

  it("appends to the end when index is null (Escape / outside click)", () => {
    const next = insertWidgetAt(widgets, pending, null);
    expect(next.map((w) => w.id)).toEqual(["a", "b", "c", "new"]);
  });

  it("clamps out-of-range indices to the end and never discards the widget", () => {
    expect(insertWidgetAt(widgets, pending, 99).map((w) => w.id)).toEqual(["a", "b", "c", "new"]);
    expect(insertWidgetAt(widgets, pending, -5).map((w) => w.id)).toEqual(["a", "b", "c", "new"]);
    expect(insertWidgetAt([], pending, null).map((w) => w.id)).toEqual(["new"]);
  });

  it("orders by the order field, not array position", () => {
    const shuffled = [entry("c", 2), entry("a", 0), entry("b", 1)];
    const next = insertWidgetAt(shuffled, pending, 0);
    expect(next.map((w) => w.id)).toEqual(["new", "a", "b", "c"]);
  });
});
