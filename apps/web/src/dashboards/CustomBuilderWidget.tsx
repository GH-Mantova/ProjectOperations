import { BarChartWidget, DonutChartWidget, Skeleton } from "@project-ops/ui";
import { useFormSubmissions, useJobs, useMaintenancePlans, useProjects, useTenders } from "./hooks";
import { KpiTile, formatCompactCurrency } from "./widgets/shared";
import type { WidgetProps } from "./types";
import {
  DATA_SOURCE_BY_KEY,
  computeCount,
  computeCountByStatus,
  computeSumValue,
  parseCustomConfig,
  type CustomWidgetConfig,
  type DataSourceMeta
} from "./customWidget";

type Loaded = {
  rows: ReadonlyArray<Record<string, unknown>>;
  loading: boolean;
};

function useDataSourceRows(source: DataSourceMeta): Loaded {
  // All five hooks fire unconditionally because hooks cannot be conditional.
  // Each hook is also used elsewhere on dashboards with the same queryKey, so
  // React Query dedupes — the cost is one cache lookup per source, not five
  // network calls.
  const tenders = useTenders();
  const jobs = useJobs();
  const projects = useProjects();
  const formSubmissions = useFormSubmissions();
  const maintenancePlans = useMaintenancePlans();

  switch (source.key) {
    case "tenders":
      return { rows: (tenders.data ?? []) as ReadonlyArray<Record<string, unknown>>, loading: tenders.isLoading };
    case "jobs":
      return { rows: (jobs.data ?? []) as ReadonlyArray<Record<string, unknown>>, loading: jobs.isLoading };
    case "projects":
      return { rows: (projects.data ?? []) as ReadonlyArray<Record<string, unknown>>, loading: projects.isLoading };
    case "formSubmissions":
      return { rows: (formSubmissions.data ?? []) as ReadonlyArray<Record<string, unknown>>, loading: formSubmissions.isLoading };
    case "maintenancePlans":
      return { rows: (maintenancePlans.data ?? []) as ReadonlyArray<Record<string, unknown>>, loading: maintenancePlans.isLoading };
  }
}

export function CustomBuilderWidget(props: WidgetProps) {
  const config = parseCustomConfig(props.config.filters);
  // Use a sentinel source so the hook is always called in the same order;
  // the unconfigured branch ignores the result.
  const source = config ? DATA_SOURCE_BY_KEY[config.dataSource] : DATA_SOURCE_BY_KEY.tenders;
  const { rows, loading } = useDataSourceRows(source);
  if (!config) {
    return (
      <div className="s7-card" style={{ padding: 16 }}>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
          Configure this widget — open settings to pick a data source, metric, and chart type.
        </p>
      </div>
    );
  }
  if (loading) {
    return <Skeleton width="100%" height={config.chartType === "kpi" ? 100 : 240} />;
  }
  return <RenderMetric rows={rows} source={source} config={config} />;
}

function RenderMetric({
  rows,
  source,
  config
}: {
  rows: ReadonlyArray<Record<string, unknown>>;
  source: DataSourceMeta;
  config: CustomWidgetConfig;
}) {
  if (config.metric === "count" && config.chartType === "kpi") {
    const value = computeCount(rows, source, config.statusInclude);
    return <KpiTile label={config.title} value={value} accent="#005B61" />;
  }
  if (config.metric === "sum_value" && config.chartType === "kpi") {
    const value = computeSumValue(rows, source, config.statusInclude);
    return <KpiTile label={config.title} value={formatCompactCurrency(value)} accent="#005B61" />;
  }
  if (config.metric === "count_by_status") {
    const data = computeCountByStatus(rows, source, config.statusInclude);
    if (config.chartType === "donut") {
      return <DonutChartWidget title={config.title} data={data} />;
    }
    return <BarChartWidget title={config.title} data={data} />;
  }
  // Fallback — combination not supported.
  return (
    <div className="s7-card" style={{ padding: 16 }}>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
        This metric/chart combination isn't supported.
      </p>
    </div>
  );
}
