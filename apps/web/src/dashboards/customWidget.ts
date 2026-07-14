/**
 * Custom dashboard widget builder.
 *
 * Allowlisted data sources, metric/chart compatibility rules, and pure
 * aggregation helpers used by CustomBuilderWidget and the builder modal.
 * Keep this file logic-only (no React/JSX) so it can be unit-tested cheaply.
 */

import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS
} from "../constants/statuses";

export type DataSourceKey =
  | "tenders"
  | "jobs"
  | "projects"
  | "formSubmissions"
  | "maintenancePlans";

export type CustomMetric = "count" | "count_by_status" | "sum_value";

export type CustomChartType = "kpi" | "bar" | "donut" | "line";

export type DataSourceMeta = {
  key: DataSourceKey;
  label: string;
  /** Status enum field name on the records of this source. */
  statusField: string;
  /** Human labels for known statuses (fallback: the raw value). */
  statusLabels: Record<string, string>;
  /** Allowlisted statuses surfaced in the filter dropdown. */
  statusOptions: string[];
  /** Field carrying a monetary value, if any. */
  valueField?: string;
  /** Timestamp field used for "over time" line aggregation. */
  timeField?: string;
};

export const DATA_SOURCES: DataSourceMeta[] = [
  {
    key: "tenders",
    label: "Tenders",
    statusField: "status",
    statusLabels: {
      DRAFT: "Identified",
      IN_PROGRESS: "In progress",
      SUBMITTED: "Submitted",
      AWARDED: "Awarded",
      CONTRACT_ISSUED: "Contract issued",
      CONVERTED: "Converted",
      LOST: "Lost",
      WITHDRAWN: "Withdrawn"
    },
    statusOptions: ["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "LOST", "WITHDRAWN"],
    valueField: "estimatedValue",
    timeField: "createdAt"
  },
  {
    key: "jobs",
    label: "Jobs",
    statusField: "status",
    statusLabels: { ...JOB_STATUS_LABELS },
    statusOptions: [...JOB_STATUSES],
    timeField: "createdAt"
  },
  {
    key: "projects",
    label: "Projects",
    statusField: "status",
    statusLabels: { ...PROJECT_STATUS_LABELS },
    statusOptions: [...PROJECT_STATUSES],
    valueField: "contractValue"
  },
  {
    key: "formSubmissions",
    label: "Form submissions",
    statusField: "status",
    statusLabels: { DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected" },
    statusOptions: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
    timeField: "submittedAt"
  },
  {
    key: "maintenancePlans",
    label: "Maintenance plans",
    statusField: "status",
    statusLabels: { ACTIVE: "Active", COMPLETE: "Complete", OVERDUE: "Overdue" },
    statusOptions: ["ACTIVE", "COMPLETE", "OVERDUE"]
  }
];

export const DATA_SOURCE_BY_KEY: Record<DataSourceKey, DataSourceMeta> = Object.fromEntries(
  DATA_SOURCES.map((s) => [s.key, s])
) as Record<DataSourceKey, DataSourceMeta>;

export type CustomWidgetConfig = {
  title: string;
  dataSource: DataSourceKey;
  metric: CustomMetric;
  chartType: CustomChartType;
  statusInclude?: string[];
};

const VALID_METRICS: CustomMetric[] = ["count", "count_by_status", "sum_value"];
const VALID_CHARTS: CustomChartType[] = ["kpi", "bar", "donut", "line"];

export function isDataSourceKey(value: unknown): value is DataSourceKey {
  return typeof value === "string" && value in DATA_SOURCE_BY_KEY;
}

export function metricsForSource(source: DataSourceMeta): CustomMetric[] {
  const metrics: CustomMetric[] = ["count", "count_by_status"];
  if (source.valueField) metrics.push("sum_value");
  return metrics;
}

export function chartsForMetric(metric: CustomMetric): CustomChartType[] {
  if (metric === "count") return ["kpi"];
  if (metric === "sum_value") return ["kpi"];
  // count_by_status
  return ["bar", "donut"];
}

/** Parse a widget entry's filters bag into a typed custom-widget config.
 *  Returns null when the bag is missing required fields or references an
 *  unknown data source — the widget then renders a friendly placeholder. */
export function parseCustomConfig(filters: Record<string, unknown> | undefined): CustomWidgetConfig | null {
  if (!filters) return null;
  const dataSource = filters.dataSource;
  if (!isDataSourceKey(dataSource)) return null;
  const source = DATA_SOURCE_BY_KEY[dataSource];
  const rawMetric = filters.metric;
  const metric = VALID_METRICS.find((m) => m === rawMetric);
  if (!metric) return null;
  if (metric === "sum_value" && !source.valueField) return null;
  const rawChart = filters.chartType;
  const chartType = VALID_CHARTS.find((c) => c === rawChart);
  if (!chartType) return null;
  if (!chartsForMetric(metric).includes(chartType)) return null;
  const title = typeof filters.title === "string" && filters.title.trim() ? filters.title.trim() : defaultTitle(source, metric);
  const statusInclude = Array.isArray(filters.statusInclude)
    ? (filters.statusInclude.filter((s): s is string => typeof s === "string"))
    : undefined;
  return { title, dataSource, metric, chartType, statusInclude };
}

export function defaultTitle(source: DataSourceMeta, metric: CustomMetric): string {
  if (metric === "count") return `${source.label} — count`;
  if (metric === "sum_value") return `${source.label} — total value`;
  return `${source.label} by status`;
}

export function statusLabel(source: DataSourceMeta, status: string): string {
  return source.statusLabels[status] ?? status;
}

type RecordWithStatus = Record<string, unknown>;

function readStatus(row: RecordWithStatus, field: string): string | null {
  const value = row[field];
  return typeof value === "string" ? value : null;
}

function readNumber(row: RecordWithStatus, field: string | undefined): number {
  if (!field) return 0;
  const value = row[field];
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function applyStatusFilter(
  rows: RecordWithStatus[],
  source: DataSourceMeta,
  statusInclude: string[] | undefined
): RecordWithStatus[] {
  if (!statusInclude || statusInclude.length === 0) return rows;
  const set = new Set(statusInclude);
  return rows.filter((row) => {
    const s = readStatus(row, source.statusField);
    return s != null && set.has(s);
  });
}

export type GroupedPoint = { label: string; value: number; key: string };

export function computeCount(
  rows: ReadonlyArray<RecordWithStatus>,
  source: DataSourceMeta,
  statusInclude: string[] | undefined
): number {
  return applyStatusFilter([...rows], source, statusInclude).length;
}

export function computeSumValue(
  rows: ReadonlyArray<RecordWithStatus>,
  source: DataSourceMeta,
  statusInclude: string[] | undefined
): number {
  const filtered = applyStatusFilter([...rows], source, statusInclude);
  return filtered.reduce((sum, row) => sum + readNumber(row, source.valueField), 0);
}

export function computeCountByStatus(
  rows: ReadonlyArray<RecordWithStatus>,
  source: DataSourceMeta,
  statusInclude: string[] | undefined
): GroupedPoint[] {
  const filtered = applyStatusFilter([...rows], source, statusInclude);
  const counts = new Map<string, number>();
  for (const row of filtered) {
    const status = readStatus(row, source.statusField);
    if (!status) continue;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  // Preserve allowlist order when no filter is set; otherwise use insertion order.
  const order =
    statusInclude && statusInclude.length > 0
      ? statusInclude
      : source.statusOptions.filter((s) => counts.has(s));
  const seen = new Set(order);
  const result: GroupedPoint[] = order
    .filter((s) => counts.has(s))
    .map((s) => ({ key: s, label: statusLabel(source, s), value: counts.get(s) ?? 0 }));
  for (const [key, value] of counts) {
    if (!seen.has(key)) result.push({ key, label: statusLabel(source, key), value });
  }
  return result;
}

export const CUSTOM_WIDGET_TYPE = "custom_builder";
