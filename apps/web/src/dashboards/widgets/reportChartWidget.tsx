/**
 * ReportChartWidget — generic dashboard widget that renders one BI report as a
 * bar chart. The reportKey and chartSpec are bound at registration time via
 * makeReportChartWidget(); the widget itself is stateless beyond the per-instance
 * WidgetSubConfig.filters.
 *
 * Design notes (plan §6.1 — widget bootstrap timing):
 * - `reportKey` and `chartSpec` are closed over at factory time, so there is no
 *   import-time async; each widget instance is an ordinary React component.
 * - Filters are read from `config.filters` (WidgetSubConfig.filters), which is
 *   the SLICE 5 composition slot.
 * - Per plan §6.3: unknown chart types render a friendly stub rather than
 *   throwing. If def.chart is absent the factory will not emit a chart widget,
 *   but the component handles that case too for defense in depth.
 *
 * EA-2b: adds a chart/table toggle. The table face reuses ReportTable from
 * reportTableWidget — never a second renderer (formatCell semantics, totals row,
 * and Generated… line must not drift).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChartWidget, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { resolveEffectiveFilters, type WidgetProps } from "../types";
import { ReportWidgetChrome } from "./reportWidgetChrome";
import { ReportTable } from "./reportTableWidget";

// ── Shared types (mirrors reporting.service.ts, local to avoid cross-layer
//   import — see plan §7 "out of scope: rewriting the BI reporting layer")

type ReportColumnSpec = {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: "text" | "number" | "currency" | "percent" | "date";
};

export type ChartSpec = {
  type: string;
  xKey: string;
  yKey: string;
  title: string;
  unit?: string;
};

type ReportRunResponse = {
  key: string;
  title: string;
  description: string;
  columns: ReportColumnSpec[];
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string | number>;
  generatedAt: string;
};

type ReportParamName = "from" | "to" | "projectId" | "clientId";

const VALID_PARAMS = new Set<ReportParamName>(["from", "to", "projectId", "clientId"]);

function buildQuery(filters: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (!VALID_PARAMS.has(k as ReportParamName)) continue;
    if (v !== undefined && v !== null && v !== "") {
      search.set(k, String(v));
    }
  }
  const q = search.toString();
  return q ? `?${q}` : "";
}

type ReportChartState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ok"; data: ReportRunResponse };

function ReportChart({
  reportKey,
  chartSpec,
  config,
  dashboardFilters,
  onLoadingChange
}: {
  reportKey: string;
  chartSpec: ChartSpec;
  config: WidgetProps["config"];
  dashboardFilters?: WidgetProps["dashboardFilters"];
  /** Notifies the parent wrapper when loading state changes (SLICE 6). */
  onLoadingChange?: (loading: boolean) => void;
}) {
  const { authFetch } = useAuth();
  const [state, setState] = useState<ReportChartState>({ status: "loading" });

  // SLICE 5: resolve effective filters — widget overrides dashboard (plan §5).
  const effectiveFilters = resolveEffectiveFilters(dashboardFilters, config.filters);
  const query = buildQuery(effectiveFilters);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    onLoadingChange?.(true);
    authFetch(`/reporting/${reportKey}${query}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text().catch(() => "Unknown error");
          setState({ status: "error", message: text });
          onLoadingChange?.(false);
          return;
        }
        const data = (await res.json()) as ReportRunResponse;
        if (cancelled) return;
        setState(
          data.rows.length === 0
            ? { status: "empty" }
            : { status: "ok", data }
        );
        onLoadingChange?.(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: (err as Error).message });
        onLoadingChange?.(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, reportKey, query, onLoadingChange]);

  const chartData = useMemo(() => {
    if (state.status !== "ok") return [];
    const { xKey, yKey } = chartSpec;
    return state.data.rows.map((row) => ({
      label: String(row[xKey] ?? ""),
      value: Number(row[yKey] ?? 0)
    }));
  }, [state, chartSpec]);

  if (state.status === "loading") {
    return (
      <div style={{ padding: 14 }}>
        <Skeleton height={32} />
        <Skeleton height={160} style={{ marginTop: 8 }} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p
        role="alert"
        style={{ padding: 14, color: "var(--status-danger, #dc2626)", fontSize: 13 }}
      >
        {state.message}
      </p>
    );
  }

  if (state.status === "empty") {
    return (
      <p style={{ padding: 14, color: "var(--text-muted, #6b7280)", fontSize: 13 }}>
        No rows for this filter set.
      </p>
    );
  }

  // Per plan §6.3: unknown chart types get a friendly stub.
  if (chartSpec.type !== "bar") {
    return (
      <p
        data-testid={`report-chart-unsupported-${reportKey}`}
        style={{ padding: 14, color: "var(--text-muted, #6b7280)", fontSize: 13 }}
      >
        Chart type &ldquo;{chartSpec.type}&rdquo; is not yet supported.
      </p>
    );
  }

  return (
    <div
      style={{ padding: 14 }}
    >
      <BarChartWidget
        title={chartSpec.title}
        data={chartData}
        unit={chartSpec.unit}
        yAxisFormatter={
          chartSpec.unit
            ? (value: number) =>
                `${value}${chartSpec.unit === "%" ? "%" : ` ${chartSpec.unit}`}`
            : undefined
        }
        tooltipFormatter={
          chartSpec.unit
            ? (value: number) =>
                `${value}${chartSpec.unit === "%" ? "%" : ` ${chartSpec.unit}`}`
            : undefined
        }
      />
    </div>
  );
}

/** Factory — binds a fixed reportKey and chartSpec into a WidgetProps-compatible
 *  component. Called by reportRegistry.ts at registration time; each report that
 *  has a chart gets its own component instance with key and spec closed over.
 *
 *  Defense in depth: if chartSpec is missing (def.chart was absent), renders a
 *  friendly message rather than crashing. The registry will not call this factory
 *  for definitions without a chart, but the component is defensive anyway.
 *
 *  SLICE 5: dashboardFilters is forwarded so the widget can resolve
 *  effectiveFilters = { ...dashboardFilters, ...config.filters } (plan §5).
 *  SLICE 6: mounts ReportWidgetChrome (export buttons) below the chart;
 *  disabled while the chart is loading.
 *  EA-2b: chart/table toggle — table face reuses ReportTable from
 *  reportTableWidget (single shared renderer, formatCell semantics preserved). */
export function makeReportChartWidget(reportKey: string, chartSpec: ChartSpec | undefined) {
  // Named component (uppercase) so react-hooks/rules-of-hooks recognises it.
  function ReportChartWithChrome({ config, dashboardFilters }: WidgetProps) {
    const [loading, setLoading] = useState(true);
    const [showTable, setShowTable] = useState(false);
    // Stable callback so the child's useEffect dependency array stays stable.
    const handleLoadingChange = useRef((v: boolean) => setLoading(v)).current;

    const effectiveFilters = resolveEffectiveFilters(dashboardFilters, config.filters);

    if (!chartSpec) {
      return (
        <p style={{ padding: 14, color: "var(--text-muted, #6b7280)", fontSize: 13 }}>
          This report has no chart configured.
        </p>
      );
    }
    return (
      <div
        data-testid={`report-chart-${reportKey}`}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Chart / Table toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 14px",
            borderBottom: "1px solid var(--surface-border)"
          }}
        >
          <button
            type="button"
            className={showTable ? "s7-btn s7-btn--ghost s7-btn--sm" : "s7-btn s7-btn--secondary s7-btn--sm"}
            onClick={() => setShowTable(false)}
            aria-pressed={!showTable}
            data-testid={`chart-toggle-chart-${reportKey}`}
          >
            Chart
          </button>
          <button
            type="button"
            className={showTable ? "s7-btn s7-btn--secondary s7-btn--sm" : "s7-btn s7-btn--ghost s7-btn--sm"}
            onClick={() => setShowTable(true)}
            aria-pressed={showTable}
            data-testid={`chart-toggle-table-${reportKey}`}
          >
            Table
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {showTable ? (
            /* Table face — reuses the shared renderer from reportTableWidget.
             * Must never be a separate reimplementation: formatCell semantics,
             * totals row, and Generated… line must not drift. */
            <ReportTable
              reportKey={reportKey}
              config={config}
              dashboardFilters={dashboardFilters}
              onLoadingChange={handleLoadingChange}
            />
          ) : (
            <ReportChart
              reportKey={reportKey}
              chartSpec={chartSpec}
              config={config}
              dashboardFilters={dashboardFilters}
              onLoadingChange={handleLoadingChange}
            />
          )}
        </div>
        <ReportWidgetChrome
          reportKey={reportKey}
          filters={effectiveFilters}
          disabled={loading}
        />
      </div>
    );
  }
  ReportChartWithChrome.displayName = `ReportChartWidget(${reportKey})`;
  return ReportChartWithChrome;
}
