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
 *   the SLICE 5 composition slot. SLICE 4 widgets do not yet merge
 *   dashboard-level filters — that is SLICE 5's job.
 * - Per plan §6.3: unknown chart types render a friendly stub rather than
 *   throwing. If def.chart is absent the factory will not emit a chart widget,
 *   but the component handles that case too for defense in depth.
 */

import { useEffect, useMemo, useState } from "react";
import { BarChartWidget, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { resolveEffectiveFilters, type WidgetProps } from "../types";

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
  dashboardFilters
}: {
  reportKey: string;
  chartSpec: ChartSpec;
  config: WidgetProps["config"];
  dashboardFilters?: WidgetProps["dashboardFilters"];
}) {
  const { authFetch } = useAuth();
  const [state, setState] = useState<ReportChartState>({ status: "loading" });

  // SLICE 5: resolve effective filters — widget overrides dashboard (plan §5).
  const effectiveFilters = resolveEffectiveFilters(dashboardFilters, config.filters);
  const query = buildQuery(effectiveFilters);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    authFetch(`/reporting/${reportKey}${query}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text().catch(() => "Unknown error");
          setState({ status: "error", message: text });
          return;
        }
        const data = (await res.json()) as ReportRunResponse;
        if (cancelled) return;
        setState(
          data.rows.length === 0
            ? { status: "empty" }
            : { status: "ok", data }
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, reportKey, query]);

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
 *  effectiveFilters = { ...dashboardFilters, ...config.filters } (plan §5). */
export function makeReportChartWidget(reportKey: string, chartSpec: ChartSpec | undefined) {
  const component = ({ config, dashboardFilters }: WidgetProps) => {
    if (!chartSpec) {
      return (
        <p style={{ padding: 14, color: "var(--text-muted, #6b7280)", fontSize: 13 }}>
          This report has no chart configured.
        </p>
      );
    }
    return (
      <div style={{ height: "100%", overflow: "auto", padding: 0 }} data-testid={`report-chart-${reportKey}`}>
        <ReportChart reportKey={reportKey} chartSpec={chartSpec} config={config} dashboardFilters={dashboardFilters} />
      </div>
    );
  };
  component.displayName = `ReportChartWidget(${reportKey})`;
  return component;
}
