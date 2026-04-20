import { BarChartWidget, Skeleton } from "@project-ops/ui";
import { useFormSubmissions } from "../hooks";
import { periodStart, resolvePeriod, type WidgetProps } from "../types";
import { KpiTile } from "./shared";

export function SubmissionsKpi(props: WidgetProps) {
  const period = resolvePeriod(props.config, props.globalPeriod);
  const since = periodStart(period);
  const { data, isLoading } = useFormSubmissions();
  if (isLoading) return <KpiTile label="Form submissions" value="—" />;
  const count = (data ?? []).filter((s) => s.submittedAt && new Date(s.submittedAt) >= since).length;
  return <KpiTile label="Form submissions" value={count} accent="#005B61" />;
}

export function ByTemplateBar(_props: WidgetProps) {
  const { data, isLoading } = useFormSubmissions();
  if (isLoading) return <Skeleton width="100%" height={240} />;
  const counts = new Map<string, number>();
  for (const s of data ?? []) {
    const label = s.template?.name ?? "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const points = Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  return <BarChartWidget title="Submissions by template" data={points} color="#FEAA6D" />;
}
