import { BarChartWidget, DonutChartWidget, LineChartWidget, Skeleton } from "@project-ops/ui";
import { isComplianceTender, useJobs, useMaintenancePlans, useProjects, useTenders, useFormSubmissions } from "../hooks";
import { periodStart, resolvePeriod, type AggregationOp, type WidgetProps } from "../types";
import { EmptyNote, KpiTile, PanelCard, formatCompactCurrency, formatCurrency } from "./shared";

function aggFrom(config: WidgetProps["config"]): AggregationOp {
  const raw = config.filters?.aggregation;
  if (raw === "Sum" || raw === "Count" || raw === "Average" || raw === "Max" || raw === "Min") return raw;
  return "Sum";
}

function applyAgg(values: number[], op: AggregationOp): number {
  if (values.length === 0) return 0;
  if (op === "Count") return values.length;
  if (op === "Sum") return values.reduce((sum, v) => sum + v, 0);
  if (op === "Average") return values.reduce((sum, v) => sum + v, 0) / values.length;
  if (op === "Max") return Math.max(...values);
  if (op === "Min") return Math.min(...values);
  return 0;
}

const ACTIVE_TENDER = new Set(["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED"]);
const MS_PER_DAY = 86_400_000;

const TENDER_STATUS_COLOURS: Record<string, string> = {
  DRAFT: "#94A3B8",
  IN_PROGRESS: "#FEAA6D",
  SUBMITTED: "#005B61",
  AWARDED: "#22C55E",
  CONTRACT_ISSUED: "#22C55E",
  LOST: "#EF4444",
  WITHDRAWN: "#E2E8F0",
  CONVERTED: "#242424"
};

function labelForTender(status: string): string {
  switch (status) {
    case "DRAFT": return "Identified";
    case "IN_PROGRESS": return "Estimating";
    case "SUBMITTED": return "Submitted";
    case "AWARDED": return "Awarded";
    case "CONTRACT_ISSUED": return "Contract";
    case "CONVERTED": return "Converted";
    case "LOST": return "Lost";
    case "WITHDRAWN": return "Withdrawn";
    default: return status;
  }
}

export function ActiveJobsKpi(_props: WidgetProps) {
  const { data: jobs, isLoading } = useJobs();
  if (isLoading) return <KpiTile label="Active jobs" value="—" />;
  const count = (jobs ?? []).filter((j) => j.status === "ACTIVE").length;
  return <KpiTile label="Active jobs" value={count} accent="#005B61" />;
}

const ACTIVE_PROJECT_STATUSES = new Set(["MOBILISING", "ACTIVE", "PRACTICAL_COMPLETION", "DEFECTS"]);

export function ActiveProjectsKpi(props: WidgetProps) {
  const { data: projects, isLoading } = useProjects();
  const op = aggFrom(props.config);
  const fields = props.config.fields && props.config.fields.length > 0 ? props.config.fields : ["count"];
  if (isLoading) return <KpiTile label="Active projects" value="—" />;
  const active = (projects ?? []).filter((p) => ACTIVE_PROJECT_STATUSES.has(p.status));
  const values = active.map((p) => Number(p.contractValue ?? 0));
  const showValue = fields.includes("totalValue");
  const count = active.length;
  if (showValue) {
    const raw = applyAgg(values, op);
    const subtitle =
      op === "Count"
        ? `${count} active`
        : `${count} active · ${op === "Sum" ? "total" : op.toLowerCase()}`;
    return (
      <KpiTile
        label="Active projects"
        value={op === "Count" ? count : formatCurrency(raw)}
        subtitle={subtitle}
        accent="#005B61"
      />
    );
  }
  return <KpiTile label="Active projects" value={count} accent="#005B61" />;
}

export function TenderPipelineKpi(_props: WidgetProps) {
  const { data: tenders, isLoading } = useTenders();
  if (isLoading) return <KpiTile label="Tender pipeline value" value="—" />;
  const total = (tenders ?? [])
    .filter((t) => !isComplianceTender(t) && ACTIVE_TENDER.has(t.status))
    .reduce((sum, t) => sum + Number(t.estimatedValue ?? 0), 0);
  return <KpiTile label="Tender pipeline value" value={formatCurrency(total)} accent="#FEAA6D" />;
}

export function OpenIssuesKpi(_props: WidgetProps) {
  const { data: jobs, isLoading } = useJobs();
  if (isLoading) return <KpiTile label="Open issues" value="—" />;
  const count = (jobs ?? []).reduce(
    (sum, j) => sum + (j.issues ?? []).filter((i) => i.status === "OPEN").length,
    0
  );
  return <KpiTile label="Open issues" value={count} accent="#EF4444" />;
}

export function UpcomingMaintenanceKpi(_props: WidgetProps) {
  const { data, isLoading } = useMaintenancePlans();
  if (isLoading) return <KpiTile label="Upcoming maintenance" value="—" />;
  const weekAhead = Date.now() + 7 * MS_PER_DAY;
  const count = (data ?? []).filter(
    (p) => p.status === "ACTIVE" && p.nextDueAt && new Date(p.nextDueAt).getTime() <= weekAhead
  ).length;
  return <KpiTile label="Upcoming maintenance" value={count} accent="#F59E0B" />;
}

export function JobsByStatusDonut(props: WidgetProps) {
  const { data: jobs, isLoading } = useJobs();
  const filters = props.config.filters ?? {};
  const statusFilter = Array.isArray(filters.statuses) ? (filters.statuses as string[]) : null;
  const allowed = statusFilter && statusFilter.length > 0 ? new Set(statusFilter) : null;
  const counts = new Map<string, number>();
  for (const j of jobs ?? []) {
    if (allowed && !allowed.has(j.status)) continue;
    counts.set(j.status, (counts.get(j.status) ?? 0) + 1);
  }
  const data = Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
  if (isLoading) return <Skeleton width="100%" height={240} />;
  return <DonutChartWidget title="Jobs by status" data={data} />;
}

export function TenderPipelineDonut(_props: WidgetProps) {
  const { data: tenders, isLoading } = useTenders();
  const counts = new Map<string, number>();
  for (const t of tenders ?? []) {
    if (isComplianceTender(t)) continue;
    counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  }
  const data = Array.from(counts.entries()).map(([status, value]) => ({
    label: labelForTender(status),
    value,
    color: TENDER_STATUS_COLOURS[status]
  }));
  if (isLoading) return <Skeleton width="100%" height={240} />;
  return <DonutChartWidget title="Tender pipeline by stage" data={data} />;
}

export function MonthlyRevenueLine(props: WidgetProps) {
  const filters = props.config.filters ?? {};
  const periodFilter = typeof filters.period === "string" ? filters.period : null;
  const show = typeof filters.show === "string" ? filters.show : "won";
  const monthsBack = periodFilter === "3m" ? 3 : periodFilter === "12m" ? 12 : 6;
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  if (!periodFilter) {
    // fall back to dashboard global period when no filter set
    const mapped = resolvePeriod(props.config, props.globalPeriod);
    since.setTime(periodStart(mapped).getTime());
  }

  const { data: tenders, isLoading } = useTenders();
  const wonSet = new Set(["AWARDED", "CONTRACT_ISSUED", "CONVERTED"]);
  const byMonth = new Map<string, number>();
  for (const t of tenders ?? []) {
    if (isComplianceTender(t)) continue;

    if (show !== "submitted" && wonSet.has(t.status)) {
      const stamp = t.wonAt ?? t.updatedAt;
      if (stamp) {
        const d = new Date(stamp);
        if (d >= since) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.estimatedValue ?? 0));
        }
      }
    }
    if (show !== "won" && t.submittedAt) {
      const d = new Date(t.submittedAt);
      if (d >= since) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.estimatedValue ?? 0));
      }
    }
  }
  const data = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value: Math.round(value) }));
  if (isLoading) return <Skeleton width="100%" height={240} />;
  const title = show === "submitted" ? "Monthly submitted value" : show === "both" ? "Monthly revenue & submitted" : "Monthly revenue";
  return (
    <LineChartWidget
      title={title}
      data={data}
      yAxisFormatter={formatCompactCurrency}
      tooltipFormatter={formatCurrency}
    />
  );
}

export function FormSubmissionsBar(props: WidgetProps) {
  const filters = props.config.filters ?? {};
  const periodFilter = typeof filters.period === "string" ? filters.period : null;
  const templateIds = Array.isArray(filters.templateIds) ? (filters.templateIds as string[]) : null;
  const allowedTemplates = templateIds && templateIds.length > 0 ? new Set(templateIds) : null;
  const weeksBack = periodFilter === "4w" ? 4 : periodFilter === "12w" ? 12 : 6;
  const since = periodFilter
    ? new Date(Date.now() - weeksBack * 7 * 86_400_000)
    : periodStart(resolvePeriod(props.config, props.globalPeriod));

  const { data, isLoading } = useFormSubmissions();
  const byWeek = new Map<string, number>();
  for (const sub of data ?? []) {
    if (!sub.submittedAt) continue;
    if (allowedTemplates && (!sub.template || !allowedTemplates.has(sub.template.id))) continue;
    const date = new Date(sub.submittedAt);
    if (date < since) continue;
    const weekStart = new Date(date);
    const day = weekStart.getUTCDay();
    weekStart.setUTCDate(weekStart.getUTCDate() - day + (day === 0 ? -6 : 1));
    const key = weekStart.toISOString().slice(0, 10);
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  const points = Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
  if (isLoading) return <Skeleton width="100%" height={240} />;
  return <BarChartWidget title="Form submissions by week" data={points} color="#005B61" />;
}

export function MaintenanceBar(props: WidgetProps) {
  const filters = props.config.filters ?? {};
  const daysAhead = typeof filters.daysAhead === "number" && filters.daysAhead > 0 ? filters.daysAhead : 30;
  const { data, isLoading } = useMaintenancePlans();
  if (isLoading) return <Skeleton width="100%" height={240} />;
  const windowEnd = Date.now() + daysAhead * MS_PER_DAY;
  const points = (data ?? [])
    .filter((p) => p.status === "ACTIVE" && p.nextDueAt && new Date(p.nextDueAt).getTime() <= windowEnd)
    .map((p) => ({
      label: p.asset?.assetCode ?? p.title,
      value: p.nextDueAt
        ? Math.max(0, Math.round((new Date(p.nextDueAt).getTime() - Date.now()) / MS_PER_DAY))
        : 0
    }));
  if (points.length === 0) {
    return (
      <PanelCard title="Upcoming maintenance">
        <EmptyNote>Nothing scheduled in the next 30 days.</EmptyNote>
      </PanelCard>
    );
  }
  return <BarChartWidget title="Upcoming maintenance by asset" data={points} unit="days" color="#F59E0B" />;
}
