import { BarChartWidget, Skeleton } from "@project-ops/ui";
import { useJobs } from "../hooks";
import type { WidgetProps } from "../types";
import { KpiTile } from "./shared";

export function ActiveJobsCountKpi(_props: WidgetProps) {
  const { data, isLoading } = useJobs();
  if (isLoading) return <KpiTile label="Active jobs" value="—" />;
  const count = (data ?? []).filter((j) => j.status === "ACTIVE").length;
  return <KpiTile label="Active jobs" value={count} accent="#005B61" />;
}

export function CompletionRateKpi(_props: WidgetProps) {
  const { data, isLoading } = useJobs();
  if (isLoading) return <KpiTile label="Completion rate" value="—" />;
  const all = data ?? [];
  const done = all.filter((j) => j.status === "COMPLETE").length;
  const rate = all.length === 0 ? 0 : (done / all.length) * 100;
  return <KpiTile label="Completion rate" value={`${rate.toFixed(0)}%`} subtitle={`${done}/${all.length}`} />;
}

export function OpenIssuesKpi(_props: WidgetProps) {
  const { data, isLoading } = useJobs();
  if (isLoading) return <KpiTile label="Open issues" value="—" />;
  const count = (data ?? []).reduce(
    (sum, j) => sum + (j.issues ?? []).filter((i) => i.status === "OPEN").length,
    0
  );
  return <KpiTile label="Open issues" value={count} accent="#EF4444" />;
}

export function JobsByStageBar(_props: WidgetProps) {
  const { data, isLoading } = useJobs();
  if (isLoading) return <Skeleton width="100%" height={240} />;
  const counts = new Map<string, number>();
  for (const j of data ?? []) {
    for (const s of j.stages ?? []) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  }
  const points = Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  return <BarChartWidget title="Jobs by stage" data={points} color="#FEAA6D" />;
}
