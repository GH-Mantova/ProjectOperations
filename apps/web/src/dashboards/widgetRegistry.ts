import type { WidgetMeta } from "./types";
import {
  ActiveJobsKpi,
  FormSubmissionsBar,
  JobsByStatusDonut,
  MaintenanceBar,
  MonthlyRevenueLine,
  OpenIssuesKpi,
  TenderPipelineDonut,
  TenderPipelineKpi,
  UpcomingMaintenanceKpi
} from "./widgets/ops";
import {
  ActivePipelineKpi,
  AvgLeadTimeKpi,
  DueThisWeekPanel,
  FollowUpQueuePanel,
  PipelineByEstimatorDonut,
  RecentWinsPanel,
  SubmittedMtdKpi,
  WinRateChart,
  WinRateYtdKpi
} from "./widgets/tendering";
import {
  ActiveJobsCountKpi,
  CompletionRateKpi,
  JobsByStageBar,
  OpenIssuesKpi as JobsOpenIssuesKpi
} from "./widgets/jobs";
import { BreakdownCountKpi, OverdueCountKpi, UpcomingBar } from "./widgets/maintenance";
import { ByTemplateBar, SubmissionsKpi } from "./widgets/forms";

export const WIDGETS: WidgetMeta[] = [
  // ── Operations ────────────────────────────────────────────
  { type: "ops_active_jobs_kpi", name: "Active jobs", category: "operations", description: "Count of jobs currently ACTIVE.", component: ActiveJobsKpi },
  { type: "ops_tender_pipeline_kpi", name: "Tender pipeline value", category: "operations", description: "Sum value of non-terminal tenders.", component: TenderPipelineKpi },
  { type: "ops_open_issues_kpi", name: "Open issues", category: "operations", description: "Job issues with status OPEN across all jobs.", component: OpenIssuesKpi },
  { type: "ops_upcoming_maintenance_kpi", name: "Upcoming maintenance", category: "operations", description: "Maintenance plans due in the next 7 days.", component: UpcomingMaintenanceKpi },
  { type: "ops_jobs_by_status_donut", name: "Jobs by status", category: "operations", description: "Donut chart of jobs grouped by status.", component: JobsByStatusDonut },
  { type: "ops_tender_pipeline_donut", name: "Tender pipeline by stage", category: "operations", description: "Donut chart of tenders grouped by stage using IS brand palette.", component: TenderPipelineDonut },
  { type: "ops_monthly_revenue_line", name: "Monthly revenue", category: "operations", description: "Line chart of won tender value by month (period-aware).", component: MonthlyRevenueLine },
  { type: "ops_form_submissions_bar", name: "Form submissions by week", category: "operations", description: "Bar chart of form submissions grouped by week (period-aware).", component: FormSubmissionsBar },
  { type: "ops_maintenance_bar", name: "Upcoming maintenance by asset", category: "operations", description: "Bar chart of days-until-due per asset (next 30 days).", component: MaintenanceBar },

  // ── Tendering ─────────────────────────────────────────────
  { type: "ten_active_pipeline_kpi", name: "Active pipeline", category: "tendering", description: "Sum value of all non-terminal tenders.", component: ActivePipelineKpi },
  { type: "ten_submitted_mtd_kpi", name: "Submitted MTD", category: "tendering", description: "Tenders submitted this calendar month + value.", component: SubmittedMtdKpi },
  { type: "ten_win_rate_kpi", name: "Win rate YTD", category: "tendering", description: "Won / (Won + Lost) year-to-date.", component: WinRateYtdKpi },
  { type: "ten_avg_lead_time_kpi", name: "Avg lead time", category: "tendering", description: "Average days from invited to submitted.", component: AvgLeadTimeKpi },
  { type: "ten_due_this_week", name: "Due this week", category: "tendering", description: "Tenders with due date within the next 7 days.", component: DueThisWeekPanel },
  { type: "ten_follow_up_queue", name: "Follow-up queue", category: "tendering", description: "Submitted tenders >7 days old with no outcome yet.", component: FollowUpQueuePanel },
  { type: "ten_win_rate_chart", name: "Win rate — last 6 months", category: "tendering", description: "Grouped bar chart: submitted vs won per month.", component: WinRateChart },
  { type: "ten_pipeline_by_estimator", name: "Pipeline by estimator", category: "tendering", description: "Donut of open tender $ value per estimator.", component: PipelineByEstimatorDonut },
  { type: "ten_recent_wins", name: "Recent wins", category: "tendering", description: "Tenders won in the selected period (default 90 days).", component: RecentWinsPanel },

  // ── Jobs ──────────────────────────────────────────────────
  { type: "jobs_active_count_kpi", name: "Active jobs", category: "jobs", description: "Count of jobs currently ACTIVE.", component: ActiveJobsCountKpi },
  { type: "jobs_completion_rate_kpi", name: "Completion rate", category: "jobs", description: "Percentage of jobs marked COMPLETE.", component: CompletionRateKpi },
  { type: "jobs_open_issues_kpi", name: "Open issues", category: "jobs", description: "Sum of issues with status OPEN across all jobs.", component: JobsOpenIssuesKpi },
  { type: "jobs_stage_progress_bar", name: "Jobs by stage", category: "jobs", description: "Bar chart of stage counts across all jobs.", component: JobsByStageBar },

  // ── Maintenance ───────────────────────────────────────────
  { type: "maint_overdue_count_kpi", name: "Overdue maintenance", category: "maintenance", description: "Count of active plans past their due date.", component: OverdueCountKpi },
  { type: "maint_upcoming_bar", name: "Upcoming maintenance", category: "maintenance", description: "Days-until-due per asset (next 30 days).", component: UpcomingBar },
  { type: "maint_breakdown_count_kpi", name: "Open breakdowns", category: "maintenance", description: "Active breakdown plans.", component: BreakdownCountKpi },

  // ── Forms ─────────────────────────────────────────────────
  { type: "forms_submissions_kpi", name: "Form submissions", category: "forms", description: "Count of form submissions in the selected period.", component: SubmissionsKpi },
  { type: "forms_by_template_bar", name: "Submissions by template", category: "forms", description: "Bar chart of submissions grouped by template.", component: ByTemplateBar }
];

export const WIDGET_BY_TYPE: Record<string, WidgetMeta> = Object.fromEntries(
  WIDGETS.map((w) => [w.type, w])
);

export function widgetsByCategory(): Array<{ category: string; items: WidgetMeta[] }> {
  const groups = new Map<string, WidgetMeta[]>();
  for (const w of WIDGETS) {
    const group = groups.get(w.category) ?? [];
    group.push(w);
    groups.set(w.category, group);
  }
  const order = ["operations", "tendering", "jobs", "maintenance", "forms"];
  return order
    .filter((cat) => groups.has(cat))
    .map((cat) => ({ category: cat, items: groups.get(cat)! }));
}
