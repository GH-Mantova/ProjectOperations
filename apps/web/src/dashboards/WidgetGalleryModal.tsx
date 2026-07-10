import { useEffect, useMemo, useReducer, useState, type Dispatch } from "react";
import { BarChartWidget, CenteredModal, DonutChartWidget, KpiCard, LineChartWidget } from "@project-ops/ui";
import {
  CUSTOM_WIDGET_TYPE,
  DATA_SOURCES,
  DATA_SOURCE_BY_KEY,
  chartsForMetric,
  defaultTitle,
  metricsForSource,
  type CustomChartType,
  type CustomMetric,
  type DataSourceKey
} from "./customWidget";
import {
  GALLERY_KIND_ICONS,
  GALLERY_KIND_LABELS,
  buildEntry,
  canProceed,
  configurableFields,
  galleryKindFor,
  galleryKinds,
  galleryModules,
  galleryReducer,
  hasDeferredFields,
  initialGalleryState,
  searchWidgets,
  sizeOptionsFor,
  sortWidgets,
  widgetsForKind,
  widgetsForModule,
  type GalleryAction,
  type GalleryGroupMode,
  type GalleryKind,
  type GalleryState
} from "./widgetGallery";
import { WIDGETS, WIDGET_BY_TYPE } from "./widgetRegistry";
import {
  PERIOD_LABELS,
  PERIOD_ORDER,
  type ConfigField,
  type WidgetConfigEntry,
  type WidgetFilters,
  type WidgetMeta,
  type WidgetPeriod,
  type WidgetSubConfig
} from "./types";

type Props = {
  globalPeriod: WidgetPeriod;
  onClose: () => void;
  /** Called with the configured entry — the canvas then enters placement mode. */
  onAdd: (entry: WidgetConfigEntry) => void;
};

const PREVIEW_DEBOUNCE_MS = 250;

export function WidgetGalleryModal({ globalPeriod, onClose, onAdd }: Props) {
  const kinds = useMemo(() => galleryKinds(WIDGETS), []);
  const [state, dispatch] = useReducer(galleryReducer, undefined, () => initialGalleryState(kinds[0] ?? "kpi"));
  const selectedMeta = state.selectedTypeId ? WIDGET_BY_TYPE[state.selectedTypeId] : null;

  // Debounced preview config so the live preview refetches after the user
  // pauses, not on every keystroke.
  const [previewConfig, setPreviewConfig] = useState<WidgetSubConfig>({ period: null, filters: {} });
  useEffect(() => {
    const timer = window.setTimeout(
      () => setPreviewConfig({ period: state.period, filters: state.filters }),
      PREVIEW_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [state.period, state.filters]);

  const submit = () => {
    const entry = buildEntry(state);
    if (!entry) return;
    onAdd(entry);
  };

  const stepIndicator = (
    <p className="wg-steps" aria-live="polite">
      <b className={state.step === "choose" ? "wg-steps__active" : undefined}>1. Choose type</b>
      {" › "}
      <b className={state.step === "configure" ? "wg-steps__active" : undefined}>2. Configure &amp; preview</b>
    </p>
  );

  const footer =
    state.step === "choose" ? (
      <>
        <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          disabled={!canProceed(state)}
          onClick={() => dispatch({ type: "next" })}
          data-testid="gallery-next"
        >
          Next: choose the data →
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          className="s7-btn s7-btn--ghost"
          onClick={() => dispatch({ type: "back" })}
          data-testid="gallery-back"
        >
          ← Back
        </button>
        <button type="button" className="s7-btn s7-btn--primary" onClick={submit} data-testid="gallery-add">
          Add to dashboard
        </button>
      </>
    );

  return (
    <CenteredModal
      title={selectedMeta && state.step === "configure" ? `Add widget — ${selectedMeta.name}` : "Add widget"}
      onClose={onClose}
      maxWidth={960}
      cardClassName="wg-modal"
      dataTestId="widget-gallery-modal"
      footer={footer}
    >
      {stepIndicator}
      {state.step === "choose" ? (
        <>
          <ChooseToolbar
            query={state.query}
            onQueryChange={(query) => dispatch({ type: "setQuery", query })}
            groupMode={state.groupMode}
            onGroupModeChange={(mode) => dispatch({ type: "setGroupMode", mode })}
          />
          <ChooseBody state={state} dispatch={dispatch} />
        </>
      ) : selectedMeta ? (
        <div className="wg-config">
          <div className="wg-form">
            {selectedMeta.type === CUSTOM_WIDGET_TYPE ? (
              <CustomWidgetFields
                filters={state.filters}
                onChange={(filters) => dispatch({ type: "setFilters", filters })}
              />
            ) : (
              <RegistryWidgetFields
                meta={selectedMeta}
                filters={state.filters}
                onChange={(filters) => dispatch({ type: "setFilters", filters })}
              />
            )}

            <label className="wg-form__label" htmlFor="wg-period">
              Period
            </label>
            <select
              id="wg-period"
              className="s7-input"
              value={state.period ?? "__inherit__"}
              onChange={(e) =>
                dispatch({
                  type: "setPeriod",
                  period: e.target.value === "__inherit__" ? null : (e.target.value as WidgetPeriod)
                })
              }
            >
              <option value="__inherit__">Follow dashboard period ({PERIOD_LABELS[globalPeriod]})</option>
              {PERIOD_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </select>

            <label className="wg-form__label" htmlFor="wg-size">
              Size
            </label>
            <select
              id="wg-size"
              className="s7-input"
              value={`${state.colSpan}x${state.rowSpan}`}
              onChange={(e) => {
                const [c, r] = e.target.value.split("x").map(Number);
                dispatch({ type: "setSize", colSpan: c, rowSpan: r });
              }}
            >
              {sizeOptionsFor(selectedMeta).map((opt) => (
                <option key={`${opt.colSpan}x${opt.rowSpan}`} value={`${opt.colSpan}x${opt.rowSpan}`}>
                  {opt.label}
                </option>
              ))}
            </select>

            {hasDeferredFields(selectedMeta) ? (
              <p className="wg-form__hint">
                More filters (estimators, form templates) are available from the widget&apos;s settings after adding.
              </p>
            ) : null}
          </div>
          <div className="wg-preview" data-testid="gallery-preview">
            <span className="wg-preview__badge">● Live preview — your real data</span>
            <div className="wg-preview__card">
              <selectedMeta.component config={previewConfig} globalPeriod={globalPeriod} colSpan={state.colSpan} rowSpan={state.rowSpan} />
            </div>
          </div>
        </div>
      ) : null}
    </CenteredModal>
  );
}

// ── Step-1 toolbar + body ────────────────────────────────────

function ChooseToolbar({
  query,
  onQueryChange,
  groupMode,
  onGroupModeChange
}: {
  query: string;
  onQueryChange: (query: string) => void;
  groupMode: GalleryGroupMode;
  onGroupModeChange: (mode: GalleryGroupMode) => void;
}) {
  return (
    <div className="wg-toolbar">
      <div className="wg-toolbar__search">
        <input
          type="search"
          className="s7-input"
          placeholder="Search widgets..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search widgets"
          data-testid="gallery-search"
        />
        {query ? (
          <button
            type="button"
            className="wg-toolbar__clear"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            data-testid="gallery-search-clear"
          >
            ×
          </button>
        ) : null}
      </div>
      <div
        className="wg-toolbar__group"
        role="group"
        aria-label="Group widgets by"
        data-testid="gallery-group-toggle"
      >
        <span className="wg-toolbar__group-label">Group by:</span>
        <button
          type="button"
          aria-pressed={groupMode === "type"}
          className={groupMode === "type" ? "wg-pill wg-pill--on" : "wg-pill"}
          onClick={() => onGroupModeChange("type")}
          data-testid="gallery-group-type"
        >
          Type
        </button>
        <button
          type="button"
          aria-pressed={groupMode === "module"}
          className={groupMode === "module" ? "wg-pill wg-pill--on" : "wg-pill"}
          onClick={() => onGroupModeChange("module")}
          data-testid="gallery-group-module"
        >
          Module
        </button>
      </div>
    </div>
  );
}

function ChooseBody({
  state,
  dispatch
}: {
  state: GalleryState;
  dispatch: Dispatch<GalleryAction>;
}) {
  const kinds = useMemo(() => galleryKinds(WIDGETS), []);
  const modules = useMemo(() => galleryModules(WIDGETS), []);
  const isSearching = state.query.trim().length > 0;
  const isModule = state.groupMode === "module";

  // First non-empty module/submodule — used as the initial selection when the
  // user first switches into module view.
  const firstModule = modules[0];
  const firstSubmodule = firstModule?.submodules[0];
  const activeModule = state.selectedModule ?? firstModule?.module ?? null;
  const activeSubmodule = state.selectedSubmodule ?? firstSubmodule?.submodule ?? null;

  const baseList = isSearching
    ? searchWidgets(WIDGETS, state.query)
    : isModule && activeModule && activeSubmodule
    ? widgetsForModule(WIDGETS, activeModule, activeSubmodule)
    : widgetsForKind(WIDGETS, state.kind);
  const list = sortWidgets(baseList, state.sortDir);

  const headerTitle = isSearching
    ? `Results (${list.length})`
    : isModule && activeModule && activeSubmodule
    ? `${activeModule} › ${activeSubmodule}`
    : GALLERY_KIND_LABELS[state.kind];

  return (
    <div className="wg-body">
      {isSearching ? null : isModule ? (
        <nav className="wg-cats wg-cats--modules" aria-label="Widget modules">
          {modules.map((node) => (
            <div key={node.module} className="wg-cat-group">
              <span className="wg-cat-group__label">{node.module}</span>
              {node.submodules.map((sub) => {
                const on =
                  activeModule === node.module && activeSubmodule === sub.submodule;
                return (
                  <button
                    key={`${node.module}-${sub.submodule}`}
                    type="button"
                    className={on ? "wg-cat wg-cat--active" : "wg-cat"}
                    onClick={() =>
                      dispatch({
                        type: "setModule",
                        module: node.module,
                        submodule: sub.submodule
                      })
                    }
                    data-testid={`gallery-module-${node.module}-${sub.submodule}`.replace(/\s+/g, "-").toLowerCase()}
                  >
                    <span>{sub.submodule}</span>
                    <span className="wg-cat__count" aria-hidden>
                      {sub.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      ) : (
        <nav className="wg-cats" aria-label="Widget categories">
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              className={kind === state.kind ? "wg-cat wg-cat--active" : "wg-cat"}
              onClick={() => dispatch({ type: "setKind", kind })}
            >
              <span aria-hidden>{GALLERY_KIND_ICONS[kind]}</span> {GALLERY_KIND_LABELS[kind]}
            </button>
          ))}
        </nav>
      )}
      <div className="wg-gallery-wrap">
        <div className="wg-gallery-header">
          <span className="wg-gallery-header__title">{headerTitle}</span>
          <button
            type="button"
            aria-pressed={state.sortDir === "desc"}
            className={state.sortDir === "desc" ? "wg-pill wg-pill--on" : "wg-pill"}
            onClick={() => dispatch({ type: "toggleSort" })}
            data-testid="gallery-sort-toggle"
            aria-label={`Sort by name, currently ${state.sortDir === "asc" ? "A to Z" : "Z to A"}`}
          >
            {state.sortDir === "asc" ? "A → Z" : "Z → A"}
          </button>
        </div>
        {list.length === 0 ? (
          <div className="wg-gallery-empty" data-testid="gallery-empty">
            No widgets match “{state.query.trim()}”.
          </div>
        ) : (
          <div className="wg-gallery" role="listbox" aria-label="Widget types">
            {list.map((meta) => (
              <button
                key={meta.type}
                type="button"
                role="option"
                aria-selected={state.selectedTypeId === meta.type}
                className={state.selectedTypeId === meta.type ? "wg-gcard wg-gcard--selected" : "wg-gcard"}
                onClick={() => dispatch({ type: "select", meta })}
                data-testid={`gallery-card-${meta.type.replace(/_/g, "-")}`}
              >
                {/* Inner wrapper: buttons are not reliable flex containers in
                    Chrome, so the column layout lives on a child element. */}
                <div className="wg-gcard__body">
                  <div className="wg-thumb" aria-hidden>
                    <GalleryThumb kind={galleryKindFor(meta)} name={meta.name} />
                  </div>
                  <span className="wg-gcard__title">{meta.name}</span>
                  <span className="wg-gcard__desc">{meta.description}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step-2 form fields ───────────────────────────────────────

function RegistryWidgetFields({
  meta,
  filters,
  onChange
}: {
  meta: WidgetMeta;
  filters: WidgetFilters;
  onChange: (filters: WidgetFilters) => void;
}) {
  const fields = configurableFields(meta);

  const setValue = (key: string, value: unknown) => {
    const next = { ...filters };
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  return (
    <>
      <label className="wg-form__label" htmlFor="wg-title">
        Widget title
      </label>
      <input id="wg-title" className="s7-input" value={meta.name} disabled readOnly />
      <p className="wg-form__hint">This widget uses its built-in title.</p>

      {fields.map((field) => (
        <ConfigFieldInput key={field.key} field={field} value={filters[field.key]} onChange={(v) => setValue(field.key, v)} />
      ))}
    </>
  );
}

function ConfigFieldInput({
  field,
  value,
  onChange
}: {
  field: ConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const inputId = `wg-field-${field.key}`;
  if (field.type === "number") {
    return (
      <>
        <label className="wg-form__label" htmlFor={inputId}>
          {field.label}
        </label>
        <input
          id={inputId}
          className="s7-input"
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={typeof value === "number" ? value : typeof field.defaultValue === "number" ? field.defaultValue : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </>
    );
  }
  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? (value.filter((v): v is string => typeof v === "string")) : [];
    const toggle = (option: string) => {
      onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);
    };
    return (
      <fieldset className="wg-form__pills">
        <legend className="wg-form__label">{field.label}</legend>
        <div className="wg-form__pill-row">
          {(field.options ?? []).map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={on}
                className={on ? "wg-pill wg-pill--on" : "wg-pill"}
                onClick={() => toggle(opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }
  if (field.type === "text") {
    return (
      <>
        <label className="wg-form__label" htmlFor={inputId}>
          {field.label}
        </label>
        <input
          id={inputId}
          className="s7-input"
          type="text"
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : (field.defaultValue as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      </>
    );
  }
  if (field.type === "textarea") {
    return (
      <>
        <label className="wg-form__label" htmlFor={inputId}>
          {field.label}
        </label>
        <textarea
          id={inputId}
          className="s7-input"
          rows={4}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : (field.defaultValue as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
        />
      </>
    );
  }
  // select (and the unused "period" type falls back to its static options)
  const current = typeof value === "string" ? value : "";
  return (
    <>
      <label className="wg-form__label" htmlFor={inputId}>
        {field.label}
      </label>
      <select id={inputId} className="s7-input" value={current} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Widget default</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </>
  );
}

const CHART_LABEL: Record<CustomChartType, string> = {
  kpi: "KPI tile",
  bar: "Bar chart",
  donut: "Donut chart",
  line: "Line chart"
};

const METRIC_LABEL: Record<CustomMetric, string> = {
  count: "Count of records",
  count_by_status: "Count by status",
  sum_value: "Sum of value"
};

function CustomWidgetFields({
  filters,
  onChange
}: {
  filters: WidgetFilters;
  onChange: (filters: WidgetFilters) => void;
}) {
  const dataSource = (typeof filters.dataSource === "string" && filters.dataSource in DATA_SOURCE_BY_KEY
    ? filters.dataSource
    : "tenders") as DataSourceKey;
  const source = DATA_SOURCE_BY_KEY[dataSource];
  const metricOptions = metricsForSource(source);
  const metric = metricOptions.find((m) => m === filters.metric) ?? metricOptions[0];
  const chartOptions = chartsForMetric(metric);
  const chartType = chartOptions.find((c) => c === filters.chartType) ?? chartOptions[0];
  const title = typeof filters.title === "string" ? filters.title : "";
  const statusInclude = Array.isArray(filters.statusInclude)
    ? filters.statusInclude.filter((s): s is string => typeof s === "string")
    : [];

  const onSourceChange = (next: DataSourceKey) => {
    const nextSource = DATA_SOURCE_BY_KEY[next];
    const nextMetric = metricsForSource(nextSource)[0];
    onChange({
      title: defaultTitle(nextSource, nextMetric),
      dataSource: next,
      metric: nextMetric,
      chartType: chartsForMetric(nextMetric)[0]
    });
  };

  const onMetricChange = (next: CustomMetric) => {
    onChange({
      ...filters,
      title: defaultTitle(source, next),
      metric: next,
      chartType: chartsForMetric(next)[0]
    });
  };

  const toggleStatus = (status: string) => {
    const nextStatuses = statusInclude.includes(status)
      ? statusInclude.filter((s) => s !== status)
      : [...statusInclude, status];
    const next = { ...filters };
    if (nextStatuses.length > 0) next.statusInclude = nextStatuses;
    else delete next.statusInclude;
    onChange(next);
  };

  return (
    <>
      <label className="wg-form__label" htmlFor="wg-custom-title">
        Widget title
      </label>
      <input
        id="wg-custom-title"
        className="s7-input"
        value={title}
        onChange={(e) => onChange({ ...filters, title: e.target.value })}
        data-testid="gallery-custom-title"
      />

      <label className="wg-form__label" htmlFor="wg-custom-source">
        Data source
      </label>
      <select
        id="wg-custom-source"
        className="s7-input"
        value={dataSource}
        onChange={(e) => onSourceChange(e.target.value as DataSourceKey)}
        data-testid="gallery-custom-source"
      >
        {DATA_SOURCES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      <label className="wg-form__label" htmlFor="wg-custom-metric">
        Measure
      </label>
      <select
        id="wg-custom-metric"
        className="s7-input"
        value={metric}
        onChange={(e) => onMetricChange(e.target.value as CustomMetric)}
        data-testid="gallery-custom-metric"
      >
        {metricOptions.map((m) => (
          <option key={m} value={m}>
            {METRIC_LABEL[m]}
          </option>
        ))}
      </select>

      <label className="wg-form__label" htmlFor="wg-custom-chart">
        Chart type
      </label>
      <select
        id="wg-custom-chart"
        className="s7-input"
        value={chartType}
        onChange={(e) => onChange({ ...filters, chartType: e.target.value as CustomChartType })}
        data-testid="gallery-custom-chart"
      >
        {chartOptions.map((c) => (
          <option key={c} value={c}>
            {CHART_LABEL[c]}
          </option>
        ))}
      </select>

      <fieldset className="wg-form__pills">
        <legend className="wg-form__label">Status filter (optional)</legend>
        <div className="wg-form__pill-row">
          {source.statusOptions.map((status) => {
            const on = statusInclude.includes(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={on}
                className={on ? "wg-pill wg-pill--on" : "wg-pill"}
                onClick={() => toggleStatus(status)}
              >
                {source.statusLabels[status] ?? status}
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}

// ── Thumbnails — the real chart primitives fed hardcoded sample data ──

const SAMPLE_BARS = [
  { label: "Mon", value: 4 },
  { label: "Tue", value: 7 },
  { label: "Wed", value: 5 },
  { label: "Thu", value: 9 },
  { label: "Fri", value: 3 }
];

const SAMPLE_LINE = [
  { label: "Feb", value: 3 },
  { label: "Mar", value: 5 },
  { label: "Apr", value: 4 },
  { label: "May", value: 8 },
  { label: "Jun", value: 11 }
];

const SAMPLE_DONUT = [
  { label: "Active", value: 6 },
  { label: "On hold", value: 2 },
  { label: "Complete", value: 4 }
];

function GalleryThumb({ kind, name }: { kind: GalleryKind; name: string }) {
  if (kind === "kpi") {
    return (
      <div className="wg-thumb__fit">
        <KpiCard label={name} value={3} trend="up" trendValue="8% vs last period" />
      </div>
    );
  }
  if (kind === "bar") {
    return (
      <div className="wg-thumb__scale">
        <BarChartWidget title={name} data={SAMPLE_BARS} />
      </div>
    );
  }
  if (kind === "line") {
    return (
      <div className="wg-thumb__scale">
        <LineChartWidget title={name} data={SAMPLE_LINE} />
      </div>
    );
  }
  if (kind === "donut") {
    return (
      <div className="wg-thumb__scale">
        <DonutChartWidget title={name} data={SAMPLE_DONUT} />
      </div>
    );
  }
  if (kind === "custom") {
    return (
      <div className="wg-thumb__list">
        <span className="wg-thumb__custom-glyph" aria-hidden>
          ✚
        </span>
        <span>Pick a source, measure and chart</span>
      </div>
    );
  }
  return (
    <div className="wg-thumb__list">
      <div className="wg-thumb__row">
        <span>⚠ Overdue</span>
        <b className="wg-thumb__row-danger">2</b>
      </div>
      <div className="wg-thumb__row">
        <span>◷ Due this week</span>
        <b className="wg-thumb__row-warn">5</b>
      </div>
      <div className="wg-thumb__row">
        <span>✓ On track</span>
        <b className="wg-thumb__row-ok">11</b>
      </div>
    </div>
  );
}
