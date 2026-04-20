import { BarChartWidget, Skeleton } from "@project-ops/ui";
import { useMaintenancePlans } from "../hooks";
import type { WidgetProps } from "../types";
import { KpiTile } from "./shared";

const MS_PER_DAY = 86_400_000;

export function OverdueCountKpi(_props: WidgetProps) {
  const { data, isLoading } = useMaintenancePlans();
  if (isLoading) return <KpiTile label="Overdue maintenance" value="—" />;
  const now = Date.now();
  const count = (data ?? []).filter(
    (p) => p.status === "ACTIVE" && p.nextDueAt && new Date(p.nextDueAt).getTime() < now
  ).length;
  return <KpiTile label="Overdue maintenance" value={count} accent="#EF4444" />;
}

export function BreakdownCountKpi(_props: WidgetProps) {
  // No dedicated breakdown endpoint — approximate with OVERDUE plans flagged as breakdown
  const { data, isLoading } = useMaintenancePlans();
  if (isLoading) return <KpiTile label="Open breakdowns" value="—" />;
  const count = (data ?? []).filter((p) => p.status === "BREAKDOWN").length;
  return <KpiTile label="Open breakdowns" value={count} accent="#F59E0B" />;
}

export function UpcomingBar(_props: WidgetProps) {
  const { data, isLoading } = useMaintenancePlans();
  if (isLoading) return <Skeleton width="100%" height={240} />;
  const windowEnd = Date.now() + 30 * MS_PER_DAY;
  const points = (data ?? [])
    .filter((p) => p.status === "ACTIVE" && p.nextDueAt && new Date(p.nextDueAt).getTime() <= windowEnd)
    .map((p) => ({
      label: p.asset?.assetCode ?? p.title,
      value: p.nextDueAt
        ? Math.max(0, Math.round((new Date(p.nextDueAt).getTime() - Date.now()) / MS_PER_DAY))
        : 0
    }));
  return <BarChartWidget title="Upcoming maintenance" data={points} unit="days" color="#F59E0B" />;
}
