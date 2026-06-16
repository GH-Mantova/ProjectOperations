import { useMemo, useState } from "react";
import { CustomBuilderWidget } from "./CustomBuilderWidget";
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
import type { WidgetConfigEntry, WidgetFilters, WidgetSubConfig } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (entry: WidgetConfigEntry) => void;
};

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

export function CustomWidgetBuilderModal({ open, onClose, onCreate }: Props) {
  const [dataSource, setDataSource] = useState<DataSourceKey>("tenders");
  const source = DATA_SOURCE_BY_KEY[dataSource];
  const metricOptions = useMemo(() => metricsForSource(source), [source]);
  const [metric, setMetric] = useState<CustomMetric>(metricOptions[0]);
  const chartOptions = useMemo(() => chartsForMetric(metric), [metric]);
  const [chartType, setChartType] = useState<CustomChartType>(chartOptions[0]);
  const [title, setTitle] = useState<string>(defaultTitle(source, metric));
  const [statusInclude, setStatusInclude] = useState<string[]>([]);

  if (!open) return null;

  const onSourceChange = (next: DataSourceKey) => {
    const nextSource = DATA_SOURCE_BY_KEY[next];
    const nextMetrics = metricsForSource(nextSource);
    const nextMetric = nextMetrics[0];
    const nextChart = chartsForMetric(nextMetric)[0];
    setDataSource(next);
    setMetric(nextMetric);
    setChartType(nextChart);
    setTitle(defaultTitle(nextSource, nextMetric));
    setStatusInclude([]);
  };

  const onMetricChange = (next: CustomMetric) => {
    const nextChart = chartsForMetric(next)[0];
    setMetric(next);
    setChartType(nextChart);
    setTitle(defaultTitle(source, next));
  };

  const toggleStatus = (status: string) => {
    setStatusInclude((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const filters: WidgetFilters = {
    title: title.trim() || defaultTitle(source, metric),
    dataSource,
    metric,
    chartType,
    ...(statusInclude.length > 0 ? { statusInclude } : {})
  };

  const previewConfig: WidgetSubConfig = { period: null, filters };

  const submit = () => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: WidgetConfigEntry = {
      id,
      type: CUSTOM_WIDGET_TYPE,
      visible: true,
      order: 0,
      config: { period: null, filters }
    };
    onCreate(entry);
    onClose();
  };

  return (
    <div
      className="slide-over-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add custom widget"
      onClick={onClose}
      data-testid="custom-widget-builder-modal"
    >
      <div className="slide-over" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <header className="slide-over__header">
          <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Add custom widget</h2>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="slide-over__body">
          <label className="estimate-editor__field">
            <span>Title</span>
            <input
              className="s7-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="custom-widget-title"
            />
          </label>

          <label className="estimate-editor__field" style={{ marginTop: 12 }}>
            <span>Data source</span>
            <select
              className="s7-input"
              value={dataSource}
              onChange={(e) => onSourceChange(e.target.value as DataSourceKey)}
              data-testid="custom-widget-source"
            >
              {DATA_SOURCES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="estimate-editor__field" style={{ marginTop: 12 }}>
            <span>Metric</span>
            <select
              className="s7-input"
              value={metric}
              onChange={(e) => onMetricChange(e.target.value as CustomMetric)}
              data-testid="custom-widget-metric"
            >
              {metricOptions.map((m) => (
                <option key={m} value={m}>{METRIC_LABEL[m]}</option>
              ))}
            </select>
          </label>

          <label className="estimate-editor__field" style={{ marginTop: 12 }}>
            <span>Chart type</span>
            <select
              className="s7-input"
              value={chartType}
              onChange={(e) => setChartType(e.target.value as CustomChartType)}
              data-testid="custom-widget-chart"
            >
              {chartOptions.map((c) => (
                <option key={c} value={c}>{CHART_LABEL[c]}</option>
              ))}
            </select>
          </label>

          <fieldset style={{ border: "none", padding: 0, marginTop: 16 }}>
            <legend style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Status filter (optional)
            </legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {source.statusOptions.map((status) => {
                const on = statusInclude.includes(status);
                return (
                  <button
                    type="button"
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={on ? "toggle-pill on" : "toggle-pill"}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      border: "1px solid var(--border-subtle, rgba(0,0,0,0.12))",
                      background: on ? "#FEAA6D" : "var(--surface-card, white)",
                      color: on ? "#242424" : "var(--text-muted, #6B7280)",
                      cursor: "pointer"
                    }}
                  >
                    {source.statusLabels[status] ?? status}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div style={{ marginTop: 20 }}>
            <h3 className="s7-type-section-heading" style={{ fontSize: 14, margin: "0 0 8px 0" }}>Preview</h3>
            <div
              style={{
                padding: 12,
                background: "var(--surface-subtle, #F8FAFC)",
                borderRadius: 8,
                border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))"
              }}
              data-testid="custom-widget-preview"
            >
              <CustomBuilderWidget config={previewConfig} globalPeriod="30d" />
            </div>
          </div>
        </div>

        <footer className="slide-over__footer">
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={submit}
            data-testid="custom-widget-save"
          >
            Add to dashboard
          </button>
        </footer>
      </div>
    </div>
  );
}
