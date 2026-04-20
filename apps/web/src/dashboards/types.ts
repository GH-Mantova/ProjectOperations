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
};

export type WidgetConfigEntry = {
  id: string;
  type: string;
  visible: boolean;
  order: number;
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
};

export type WidgetMeta = {
  type: string;
  name: string;
  category: WidgetCategory;
  description: string;
  component: (props: WidgetProps) => ReactNode;
};

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
