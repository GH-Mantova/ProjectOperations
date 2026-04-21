import type { ReactNode } from "react";

export type WidgetPeriod = "7d" | "30d" | "90d" | "6m" | "12m";

export const PERIOD_LABELS: Record<WidgetPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "12m": "Last 12 months"
};

export const PERIOD_ORDER: WidgetPeriod[] = ["7d", "30d", "90d", "6m", "12m"];

export type WidgetFilters = Record<string, unknown>;

export type WidgetSubConfig = {
  period?: WidgetPeriod | null;
  filters?: WidgetFilters;
  /** Ordered list of field keys to show. When unset, widgets fall back to
   *  their registry's defaultVisible fields. */
  fields?: string[];
};

export type WidgetConfigEntry = {
  id: string;
  type: string;
  visible: boolean;
  order: number;
  /** Grid span (1–4). Optional — falls back to registry defaults then to size. */
  colSpan?: number;
  /** Grid span (1–4). */
  rowSpan?: number;
  config: WidgetSubConfig;
};

export type UserDashboardConfig = {
  period: WidgetPeriod;
  widgets: WidgetConfigEntry[];
};

export type UserDashboard = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  isSystem: boolean;
  isDefault: boolean;
  config: UserDashboardConfig;
  createdAt: string;
  updatedAt: string;
};

export type WidgetCategory = "operations" | "tendering" | "jobs" | "maintenance" | "forms";

export type WidgetProps = {
  config: WidgetSubConfig;
  globalPeriod: WidgetPeriod;
  onConfigChange?: (config: WidgetSubConfig) => void;
  /** Current grid span of the widget. Widgets use these to scale their
   *  content (font sizes, row counts) to available space. */
  colSpan?: number;
  rowSpan?: number;
};

export type WidgetSize = "kpi" | "half" | "full";

/** Grid row height in pixels — used for rowSpan calculations. */
export const GRID_ROW_HEIGHT_PX = 150;
/** Approximate list-row height for calculating availableRows from rowSpan. */
export const LIST_ROW_HEIGHT_PX = 48;

export type WidgetField = {
  key: string;
  label: string;
  defaultVisible: boolean;
  type: "currency" | "text" | "date" | "number" | "badge";
};

export type AggregationOp = "Sum" | "Count" | "Average" | "Max" | "Min";

export type ConfigFieldOption = { value: string; label: string };

export type ConfigFieldType = "select" | "multiselect" | "period" | "number";

export type ConfigField = {
  key: string;
  label: string;
  type: ConfigFieldType;
  options?: ConfigFieldOption[];
  dynamicOptions?: "estimators" | "formTemplates";
  defaultValue?: string | number | string[] | null;
  min?: number;
  max?: number;
  step?: number;
};

export type WidgetMeta = {
  type: string;
  name: string;
  category: WidgetCategory;
  description: string;
  /** Legacy size tag — still used by the registry; resolveSpan() translates
   *  it into colSpan/rowSpan when new fields are absent. */
  size: WidgetSize;
  defaultColSpan?: number;
  defaultRowSpan?: number;
  minColSpan?: number;
  minRowSpan?: number;
  maxColSpan?: number;
  maxRowSpan?: number;
  fieldSchema?: WidgetField[];
  configSchema?: ConfigField[];
  component: (props: WidgetProps) => ReactNode;
};

/** Resolve colSpan/rowSpan for a widget entry, falling back through
 *  registry defaults → size tag → sensible defaults. */
export function resolveSpan(meta: WidgetMeta | undefined, entry: WidgetConfigEntry): { colSpan: number; rowSpan: number } {
  const sizeToSpan = (size: WidgetSize | undefined): { colSpan: number; rowSpan: number } => {
    if (size === "kpi") return { colSpan: 1, rowSpan: 1 };
    if (size === "half") return { colSpan: 2, rowSpan: 2 };
    if (size === "full") return { colSpan: 4, rowSpan: 2 };
    return { colSpan: 2, rowSpan: 2 };
  };
  const fromSize = sizeToSpan(meta?.size);
  const col = entry.colSpan ?? meta?.defaultColSpan ?? fromSize.colSpan;
  const row = entry.rowSpan ?? meta?.defaultRowSpan ?? fromSize.rowSpan;
  const minCol = meta?.minColSpan ?? 1;
  const maxCol = meta?.maxColSpan ?? 4;
  const minRow = meta?.minRowSpan ?? 1;
  const maxRow = meta?.maxRowSpan ?? 4;
  return {
    colSpan: Math.max(minCol, Math.min(maxCol, col)),
    rowSpan: Math.max(minRow, Math.min(maxRow, row))
  };
}

/** Resolve the visible field keys, preserving user order when set, else
 *  falling back to registry defaults in schema order. */
export function resolveVisibleFields(meta: WidgetMeta | undefined, entry: WidgetConfigEntry): string[] {
  const schema = meta?.fieldSchema ?? [];
  if (schema.length === 0) return [];
  const userFields = entry.config.fields;
  if (userFields && userFields.length > 0) {
    const allowed = new Set(schema.map((f) => f.key));
    return userFields.filter((k) => allowed.has(k));
  }
  return schema.filter((f) => f.defaultVisible).map((f) => f.key);
}

export function resolvePeriod(config: WidgetSubConfig, globalPeriod: WidgetPeriod): WidgetPeriod {
  return config.period ?? globalPeriod;
}

export function periodStart(period: WidgetPeriod): Date {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 86_400_000);
    case "30d":
      return new Date(now.getTime() - 30 * 86_400_000);
    case "90d":
      return new Date(now.getTime() - 90 * 86_400_000);
    case "6m":
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case "12m":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }
}
