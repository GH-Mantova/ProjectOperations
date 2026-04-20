import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChartWidget,
  DonutChartWidget,
  EmptyState,
  KpiCard,
  LineChartWidget,
  Skeleton
} from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type WidgetDataPoint = { label: string; value: number; color?: string };

type RenderedWidget =
  | {
      type: "kpi";
      title: string;
      metricKey: string;
      value: number | string;
      trend: "up" | "down" | "flat" | null;
      trendValue: string | null;
    }
  | { type: "bar_chart"; title: string; metricKey: string; data: WidgetDataPoint[] }
  | { type: "line_chart"; title: string; metricKey: string; data: WidgetDataPoint[] }
  | { type: "donut_chart"; title: string; metricKey: string; data: WidgetDataPoint[] }
  | { type: "table"; title: string; metricKey: string; columns: string[]; rows: string[][] }
  | { type: "unsupported"; title: string; metricKey: string };

type DashboardWidget = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  position: number;
  width: number;
  height: number;
  data?: RenderedWidget;
};

type DashboardListItem = {
  id: string;
  name: string;
  description?: string | null;
  scope: string;
  isDefault: boolean;
  ownerUserId?: string | null;
  ownerRoleId?: string | null;
  widgets: DashboardWidget[];
};

type DashboardRenderResponse = DashboardListItem & {
  widgets: Array<DashboardWidget & { data: RenderedWidget }>;
};

const TREND_ACCENT: Record<string, string> = {
  up: "var(--status-active, #005B61)",
  down: "var(--status-danger, #EF4444)",
  flat: "var(--status-info, #3B82F6)"
};

const TENDER_STATUS_COLOURS: Record<string, string> = {
  DRAFT: "#94A3B8",
  IDENTIFIED: "#94A3B8",
  IN_PROGRESS: "#FEAA6D",
  SUBMITTED: "#005B61",
  AWARDED: "#22C55E",
  CONTRACT_ISSUED: "#22C55E",
  LOST: "#EF4444",
  WITHDRAWN: "#E2E8F0",
  CONVERTED: "#242424"
};

const CURRENCY_METRIC_KEYS = new Set(["revenue.monthly", "tenders.pipelineValue", "revenue.pipeline"]);
const DAYS_METRIC_KEYS = new Set(["maintenance.upcoming"]);

function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

function colouriseDonut(metricKey: string, data: WidgetDataPoint[]): WidgetDataPoint[] {
  if (metricKey !== "tenders.byStatus" && metricKey !== "tenders.byStage") return data;
  return data.map((slice) => ({
    ...slice,
    color: slice.color ?? TENDER_STATUS_COLOURS[slice.label.toUpperCase()] ?? slice.color
  }));
}

const HIDDEN_KEY = "project-ops.dashboard.hidden-widgets";

function readHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeHidden(set: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function DashboardPlaceholderPage() {
  const { authFetch, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardRenderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(readHidden);

  useEffect(() => {
    writeHidden(hidden);
  }, [hidden]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const listResponse = await authFetch("/dashboards");
        if (!listResponse.ok) throw new Error("Could not load dashboards.");
        const list = (await listResponse.json()) as DashboardListItem[];
        const selected =
          list.find((item) => item.isDefault && item.ownerUserId && item.ownerUserId === user?.id) ??
          list.find((item) => item.isDefault && item.ownerUserId) ??
          list.find((item) => item.id === "seed-admin-dashboard") ??
          list[0];
        if (!selected) {
          if (!cancelled) setDashboard(null);
          return;
        }
        const renderResponse = await authFetch(`/dashboards/${selected.id}/render`);
        if (!renderResponse.ok) throw new Error("Could not render dashboard.");
        const data = (await renderResponse.json()) as DashboardRenderResponse;
        if (!cancelled) setDashboard(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, user?.id]);

  const visibleWidgets = useMemo(
    () => dashboard?.widgets.filter((widget) => !hidden.has(widget.id)) ?? [],
    [dashboard, hidden]
  );

  const kpis = visibleWidgets.filter((widget) => widget.type === "kpi");
  const charts = visibleWidgets.filter((widget) => widget.type !== "kpi" && widget.type !== "table");
  const tables = visibleWidgets.filter((widget) => widget.type === "table");

  const toggle = (widgetId: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(widgetId)) next.delete(widgetId);
      else next.add(widgetId);
      return next;
    });
  };

  const resetHidden = () => setHidden(new Set());

  return (
    <div className="dash-page">
      <header className="dash-page__header">
        <div>
          <p className="s7-type-label">Dashboard</p>
          <h1 className="s7-type-page-title dash-page__title">
            {dashboard?.name ?? "Operations Overview"}
          </h1>
          {dashboard?.description ? (
            <p className="dash-page__subtitle">{dashboard.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--secondary"
          onClick={() => setCustomiseOpen(true)}
          aria-label="Customise dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 6h10M4 12h7M4 18h13" />
            <circle cx="17" cy="6" r="2" />
            <circle cx="14" cy="12" r="2" />
            <circle cx="19" cy="18" r="2" />
          </svg>
          Customise
        </button>
      </header>

      {error ? (
        <div className="dash-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="dash-page__kpis" aria-label="Key performance indicators">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`kpi-skeleton-${index}`} className="dash-page__kpi-skeleton">
                <Skeleton width="40%" height={12} />
                <Skeleton width="70%" height={30} style={{ marginTop: 10 }} />
                <Skeleton width="50%" height={12} style={{ marginTop: 10 }} />
              </div>
            ))}
          </>
        ) : kpis.length === 0 ? (
          <EmptyState
            heading="No KPIs yet"
            subtext="Use the Customise panel to enable metric widgets, or add some to the seeded dashboard."
          />
        ) : (
          kpis.map((widget) => {
            const data = widget.data;
            if (!data || data.type !== "kpi") return null;
            const accent = data.trend ? TREND_ACCENT[data.trend] : "var(--brand-accent, #FEAA6D)";
            return (
              <KpiCard
                key={widget.id}
                label={data.title ?? widget.title}
                value={data.value ?? "—"}
                trend={data.trend ?? undefined}
                trendValue={data.trendValue ?? undefined}
                color={accent}
              />
            );
          })
        )}
      </section>

      <section className="dash-page__charts" aria-label="Chart widgets">
        {loading ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`chart-skeleton-${index}`} className="dash-page__chart-skeleton">
                <Skeleton width="50%" height={14} />
                <Skeleton width="100%" height={200} style={{ marginTop: 12 }} />
              </div>
            ))}
          </>
        ) : charts.length === 0 ? (
          <EmptyState
            heading="No charts enabled"
            subtext="Enable chart widgets from the Customise panel to see jobs, tenders, revenue, and maintenance visualisations."
          />
        ) : (
          charts.map((widget) => {
            const data = widget.data;
            if (!data) return null;
            if (data.type === "bar_chart") {
              const isCurrency = CURRENCY_METRIC_KEYS.has(data.metricKey);
              const isDays = DAYS_METRIC_KEYS.has(data.metricKey);
              return (
                <BarChartWidget
                  key={widget.id}
                  title={data.title ?? widget.title}
                  data={data.data}
                  unit={isDays ? "days" : undefined}
                  yAxisFormatter={isCurrency ? formatCompactCurrency : undefined}
                  tooltipFormatter={
                    isCurrency
                      ? formatFullCurrency
                      : isDays
                        ? (value: number) => `${value} ${value === 1 ? "day" : "days"}`
                        : undefined
                  }
                />
              );
            }
            if (data.type === "line_chart") {
              const isCurrency = CURRENCY_METRIC_KEYS.has(data.metricKey);
              return (
                <LineChartWidget
                  key={widget.id}
                  title={data.title ?? widget.title}
                  data={data.data}
                  yAxisFormatter={isCurrency ? formatCompactCurrency : undefined}
                  tooltipFormatter={isCurrency ? formatFullCurrency : undefined}
                />
              );
            }
            if (data.type === "donut_chart") {
              return (
                <DonutChartWidget
                  key={widget.id}
                  title={data.title ?? widget.title}
                  data={colouriseDonut(data.metricKey, data.data)}
                />
              );
            }
            return null;
          })
        )}
      </section>

      {tables.length ? (
        <section className="dash-page__tables" aria-label="Table widgets">
          {tables.map((widget) => {
            const data = widget.data;
            if (!data || data.type !== "table") return null;
            return (
              <div key={widget.id} className="s7-card">
                <h3 className="s7-type-card-title" style={{ marginTop: 0, marginBottom: 12 }}>
                  {data.title ?? widget.title}
                </h3>
                <div className="s7-table-scroll">
                  <table className="s7-table">
                    <thead>
                      <tr>
                        {data.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, rowIndex) => (
                        <tr key={`${widget.id}-row-${rowIndex}`}>
                          {row.map((cell, cellIndex) => (
                            <td key={`${widget.id}-row-${rowIndex}-cell-${cellIndex}`}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <CustomiseSlideOver
        open={customiseOpen}
        onClose={() => setCustomiseOpen(false)}
        widgets={dashboard?.widgets ?? []}
        hidden={hidden}
        onToggle={toggle}
        onReset={resetHidden}
      />
    </div>
  );
}

type CustomiseSlideOverProps = {
  open: boolean;
  onClose: () => void;
  widgets: DashboardWidget[];
  hidden: Set<string>;
  onToggle: (widgetId: string) => void;
  onReset: () => void;
};

function CustomiseSlideOver({ open, onClose, widgets, hidden, onToggle, onReset }: CustomiseSlideOverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="slide-over-overlay" role="dialog" aria-label="Customise dashboard" aria-modal="true" onClick={onClose}>
      <div
        ref={panelRef}
        className="slide-over"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Customise dashboard</h2>
            <p className="slide-over__subtitle">Toggle widgets on or off. Preferences are saved to this browser.</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>

        <div className="slide-over__body">
          {widgets.length === 0 ? (
            <p className="s7-type-body" style={{ color: "var(--text-secondary)" }}>
              No widgets available on this dashboard yet.
            </p>
          ) : (
            <ul className="slide-over__list">
              {widgets.map((widget) => {
                const isOn = !hidden.has(widget.id);
                return (
                  <li key={widget.id} className="slide-over__row">
                    <div className="slide-over__row-meta">
                      <span className="slide-over__row-title">{widget.title}</span>
                      {widget.description ? (
                        <span className="slide-over__row-subtitle">{widget.description}</span>
                      ) : null}
                      <span className="slide-over__row-type">{widget.type.replace(/_/g, " ")}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn}
                      className={isOn ? "slide-over__toggle slide-over__toggle--on" : "slide-over__toggle"}
                      onClick={() => onToggle(widget.id)}
                    >
                      <span className="slide-over__toggle-thumb" />
                      <span className="slide-over__toggle-label">{isOn ? "On" : "Off"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="slide-over__footer">
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onReset}>
            Reset to defaults
          </button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
