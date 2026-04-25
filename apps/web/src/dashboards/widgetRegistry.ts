import type { WidgetField, WidgetMeta } from "./types";

const AGGREGATION_FIELD = {
  key: "aggregation",
  label: "Show as",
  type: "select" as const,
  defaultValue: "Sum",
  options: [
    { value: "Sum", label: "Sum" },
    { value: "Count", label: "Count" },
    { value: "Average", label: "Average" },
    { value: "Max", label: "Max" },
    { value: "Min", label: "Min" }
  ]
};

const FIELDS_FOLLOW_UP: WidgetField[] = [
  { key: "tenderNumber", label: "Tender #", defaultVisible: true, type: "text" },
  { key: "clientName", label: "Client", defaultVisible: true, type: "text" },
  { key: "projectName", label: "Project", defaultVisible: true, type: "text" },
  { key: "daysWaiting", label: "Days waiting", defaultVisible: true, type: "number" },
  { key: "probability", label: "Hot/Warm/Cold", defaultVisible: true, type: "badge" },
  { key: "value", label: "Value", defaultVisible: true, type: "currency" },
  { key: "logCall", label: "Log call button", defaultVisible: true, type: "text" },
  { key: "estimator", label: "Estimator", defaultVisible: false, type: "text" },
  { key: "lastActivity", label: "Last activity", defaultVisible: false, type: "text" }
];

const FIELDS_DUE_THIS_WEEK: WidgetField[] = [
  { key: "tenderNumber", label: "Tender #", defaultVisible: true, type: "text" },
  { key: "clientName", label: "Client", defaultVisible: true, type: "text" },
  { key: "projectName", label: "Project", defaultVisible: true, type: "text" },
  { key: "estimator", label: "Estimator", defaultVisible: true, type: "text" },
  { key: "status", label: "Status", defaultVisible: true, type: "badge" },
  { key: "dueDate", label: "Due date", defaultVisible: true, type: "date" },
  { key: "daysUntilDue", label: "Days until due", defaultVisible: false, type: "number" }
];

const FIELDS_RECENT_WINS: WidgetField[] = [
  { key: "clientName", label: "Client", defaultVisible: true, type: "text" },
  { key: "projectName", label: "Project", defaultVisible: true, type: "text" },
  { key: "value", label: "Value", defaultVisible: true, type: "currency" },
  { key: "estimator", label: "Estimator", defaultVisible: true, type: "text" },
  { key: "wonDate", label: "Won date", defaultVisible: true, type: "date" },
  { key: "tenderNumber", label: "Tender #", defaultVisible: false, type: "text" }
];

const FIELDS_ACTIVE_PROJECTS: WidgetField[] = [
  { key: "count", label: "Count", defaultVisible: true, type: "number" },
  { key: "totalValue", label: "Total value", defaultVisible: false, type: "currency" }
];

const FIELDS_TIMESHEETS_PENDING: WidgetField[] = [
  { key: "count", label: "Count", defaultVisible: true, type: "number" },
  { key: "oldestPendingDate", label: "Oldest pending date", defaultVisible: false, type: "date" }
];
import {
  ActiveJobsKpi,
  ActiveContractsKpi,
  ActiveProjectsKpi,
  FormSubmissionsBar,
  JobsByStatusDonut,
  MaintenanceBar,
  MonthlyRevenueLine,
  OpenIssuesKpi,
  TenderPipelineDonut,
  TenderPipelineKpi,
  TimesheetsPendingKpi,
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
import { ComplianceAlertsWidget } from "./widgets/compliance";
import { SafetySummaryWidget } from "./widgets/safety";
import { ProjectTimelineWidget } from "./widgets/projectTimeline";

const TENDER_STAGE_OPTIONS = [
  { value: "DRAFT", label: "Identified" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "AWARDED", label: "Awarded" }
];

const JOB_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETE", label: "Complete" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" }
];

export const WIDGETS: WidgetMeta[] = [
  // ── Operations ────────────────────────────────────────────
  { type: "ops_active_jobs_kpi", name: "Active jobs", category: "operations", size: "kpi", description: "Count of jobs currently ACTIVE.", component: ActiveJobsKpi },
  {
    type: "ops_active_projects_kpi",
    name: "Active projects",
    category: "operations",
    size: "kpi",
    description: "Projects in MOBILISING / ACTIVE / PRACTICAL_COMPLETION / DEFECTS.",
    fieldSchema: FIELDS_ACTIVE_PROJECTS,
    configSchema: [AGGREGATION_FIELD],
    component: ActiveProjectsKpi
  },
  {
    type: "ops_timesheets_pending_kpi",
    name: "Timesheets pending",
    category: "operations",
    size: "kpi",
    description: "Submitted timesheets awaiting approval — tap to open the approval workspace.",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    minColSpan: 1,
    minRowSpan: 1,
    maxColSpan: 4,
    maxRowSpan: 2,
    fieldSchema: FIELDS_TIMESHEETS_PENDING,
    component: TimesheetsPendingKpi
  },
  { type: "ops_tender_pipeline_kpi", name: "Tender pipeline value", category: "operations", size: "kpi", description: "Sum value of non-terminal tenders.", component: TenderPipelineKpi },
  {
    type: "fin_contracts_summary_kpi",
    name: "Active contracts",
    category: "tendering",
    size: "kpi",
    description: "Count of ACTIVE contracts and their total contract value. Click to open /contracts.",
    defaultColSpan: 1,
    defaultRowSpan: 1,
    minColSpan: 1,
    minRowSpan: 1,
    maxColSpan: 2,
    maxRowSpan: 2,
    component: ActiveContractsKpi
  },
  { type: "ops_open_issues_kpi", name: "Open issues", category: "operations", size: "kpi", description: "Job issues with status OPEN across all jobs.", component: OpenIssuesKpi },
  { type: "ops_upcoming_maintenance_kpi", name: "Upcoming maintenance", category: "operations", size: "kpi", description: "Maintenance plans due in the next 7 days.", component: UpcomingMaintenanceKpi },
  {
    type: "ops_jobs_by_status_donut",
    name: "Jobs by status",
    category: "operations",
    size: "half",
    description: "Donut chart of jobs grouped by status.",
    configSchema: [
      { key: "statuses", label: "Include statuses", type: "multiselect", options: JOB_STATUS_OPTIONS }
    ],
    component: JobsByStatusDonut
  },
  { type: "ops_tender_pipeline_donut", name: "Tender pipeline by stage", category: "operations", size: "half", description: "Donut chart of tenders grouped by stage using IS brand palette.", component: TenderPipelineDonut },
  {
    type: "ops_monthly_revenue_line",
    name: "Monthly revenue",
    category: "operations",
    size: "half",
    description: "Line chart of won tender value by month.",
    configSchema: [
      {
        key: "period",
        label: "Period",
        type: "select",
        options: [
          { value: "3m", label: "Last 3 months" },
          { value: "6m", label: "Last 6 months" },
          { value: "12m", label: "Last 12 months" }
        ]
      },
      {
        key: "show",
        label: "Show",
        type: "select",
        options: [
          { value: "won", label: "Won value" },
          { value: "submitted", label: "Submitted value" },
          { value: "both", label: "Both" }
        ]
      }
    ],
    component: MonthlyRevenueLine
  },
  {
    type: "ops_form_submissions_bar",
    name: "Form submissions by week",
    category: "operations",
    size: "half",
    description: "Bar chart of form submissions grouped by week.",
    configSchema: [
      {
        key: "period",
        label: "Period",
        type: "select",
        options: [
          { value: "4w", label: "Last 4 weeks" },
          { value: "6w", label: "Last 6 weeks" },
          { value: "12w", label: "Last 12 weeks" }
        ]
      },
      { key: "templateIds", label: "Form templates", type: "multiselect", dynamicOptions: "formTemplates" }
    ],
    component: FormSubmissionsBar
  },
  {
    type: "ops_maintenance_bar",
    name: "Upcoming maintenance by asset",
    category: "operations",
    size: "half",
    description: "Bar chart of days-until-due per asset.",
    configSchema: [
      { key: "daysAhead", label: "Days ahead", type: "number", min: 7, max: 180, step: 1, defaultValue: 30 }
    ],
    component: MaintenanceBar
  },

  // ── Tendering ─────────────────────────────────────────────
  {
    type: "ten_active_pipeline_kpi",
    name: "Active pipeline",
    category: "tendering",
    size: "kpi",
    description: "Aggregated value of non-terminal tenders (sum, count, avg, max, min).",
    configSchema: [
      { key: "stages", label: "Include stages", type: "multiselect", options: TENDER_STAGE_OPTIONS },
      AGGREGATION_FIELD
    ],
    component: ActivePipelineKpi
  },
  {
    type: "ten_submitted_mtd_kpi",
    name: "Submitted MTD",
    category: "tendering",
    size: "kpi",
    description: "Tenders submitted this calendar month — aggregated.",
    configSchema: [AGGREGATION_FIELD],
    component: SubmittedMtdKpi
  },
  {
    type: "ten_win_rate_kpi",
    name: "Win rate YTD",
    category: "tendering",
    size: "kpi",
    description: "Won / (Won + Lost) year-to-date — configurable aggregation.",
    configSchema: [AGGREGATION_FIELD],
    component: WinRateYtdKpi
  },
  {
    type: "ten_avg_lead_time_kpi",
    name: "Avg lead time",
    category: "tendering",
    size: "kpi",
    description: "Days from invited to submitted — average by default, configurable.",
    configSchema: [AGGREGATION_FIELD],
    component: AvgLeadTimeKpi
  },
  {
    type: "ten_due_this_week",
    name: "Due this week",
    category: "tendering",
    size: "half",
    description: "Tenders with due date within the next N days.",
    fieldSchema: FIELDS_DUE_THIS_WEEK,
    configSchema: [
      { key: "daysAhead", label: "Days ahead", type: "number", min: 1, max: 30, step: 1, defaultValue: 7 }
    ],
    component: DueThisWeekPanel
  },
  {
    type: "ten_follow_up_queue",
    name: "Follow-up queue",
    category: "tendering",
    size: "full",
    description: "Submitted tenders older than threshold with no outcome yet.",
    fieldSchema: FIELDS_FOLLOW_UP,
    configSchema: [
      { key: "daysThreshold", label: "Days threshold", type: "number", min: 1, max: 60, step: 1, defaultValue: 7 },
      { key: "maxRows", label: "Max rows", type: "number", min: 1, max: 10, step: 1, defaultValue: 5 }
    ],
    component: FollowUpQueuePanel
  },
  {
    type: "ten_win_rate_chart",
    name: "Win rate — last 6 months",
    category: "tendering",
    size: "half",
    description: "Grouped bar chart: submitted vs won.",
    configSchema: [
      {
        key: "period",
        label: "Period",
        type: "select",
        options: [
          { value: "3m", label: "Last 3 months" },
          { value: "6m", label: "Last 6 months" },
          { value: "12m", label: "Last 12 months" }
        ]
      },
      {
        key: "groupBy",
        label: "Group by",
        type: "select",
        options: [
          { value: "month", label: "Month" },
          { value: "quarter", label: "Quarter" }
        ]
      },
      { key: "estimatorIds", label: "Estimator filter", type: "multiselect", dynamicOptions: "estimators" }
    ],
    component: WinRateChart
  },
  {
    type: "ten_pipeline_by_estimator",
    name: "Pipeline by estimator",
    category: "tendering",
    size: "half",
    description: "Donut of open tender $ value per estimator.",
    configSchema: [
      { key: "estimatorIds", label: "Estimators", type: "multiselect", dynamicOptions: "estimators" },
      {
        key: "metric",
        label: "Show",
        type: "select",
        options: [
          { value: "value", label: "Pipeline value ($)" },
          { value: "count", label: "Tender count (#)" }
        ]
      }
    ],
    component: PipelineByEstimatorDonut
  },
  {
    type: "ten_recent_wins",
    name: "Recent wins",
    category: "tendering",
    size: "half",
    description: "Tenders won in the selected period.",
    fieldSchema: FIELDS_RECENT_WINS,
    configSchema: [
      {
        key: "period",
        label: "Period",
        type: "select",
        options: [
          { value: "30d", label: "Last 30 days" },
          { value: "60d", label: "Last 60 days" },
          { value: "90d", label: "Last 90 days" },
          { value: "12m", label: "Last 12 months" }
        ]
      },
      { key: "maxRows", label: "Max rows", type: "number", min: 1, max: 10, step: 1, defaultValue: 4 },
      { key: "estimatorIds", label: "Estimator filter", type: "multiselect", dynamicOptions: "estimators" }
    ],
    component: RecentWinsPanel
  },

  // ── Jobs ──────────────────────────────────────────────────
  { type: "jobs_active_count_kpi", name: "Active jobs", category: "jobs", size: "kpi", description: "Count of jobs currently ACTIVE.", component: ActiveJobsCountKpi },
  { type: "jobs_completion_rate_kpi", name: "Completion rate", category: "jobs", size: "kpi", description: "Percentage of jobs marked COMPLETE.", component: CompletionRateKpi },
  { type: "jobs_open_issues_kpi", name: "Open issues", category: "jobs", size: "kpi", description: "Sum of issues with status OPEN across all jobs.", component: JobsOpenIssuesKpi },
  { type: "jobs_stage_progress_bar", name: "Jobs by stage", category: "jobs", size: "half", description: "Bar chart of stage counts across all jobs.", component: JobsByStageBar },

  // ── Maintenance ───────────────────────────────────────────
  { type: "maint_overdue_count_kpi", name: "Overdue maintenance", category: "maintenance", size: "kpi", description: "Count of active plans past their due date.", component: OverdueCountKpi },
  { type: "maint_upcoming_bar", name: "Upcoming maintenance", category: "maintenance", size: "half", description: "Days-until-due per asset (next 30 days).", component: UpcomingBar },
  { type: "maint_breakdown_count_kpi", name: "Open breakdowns", category: "maintenance", size: "kpi", description: "Active breakdown plans.", component: BreakdownCountKpi },

  // ── Forms ─────────────────────────────────────────────────
  { type: "forms_submissions_kpi", name: "Form submissions", category: "forms", size: "kpi", description: "Count of form submissions in the selected period.", component: SubmissionsKpi },
  { type: "forms_by_template_bar", name: "Submissions by template", category: "forms", size: "half", description: "Bar chart of submissions grouped by template.", component: ByTemplateBar },

  // ── Compliance ────────────────────────────────────────────
  {
    type: "compliance_expiry_alerts",
    name: "Compliance alerts",
    category: "compliance",
    size: "half",
    description: "Top 8 licences, insurances, and qualifications expiring within 30 days.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: ComplianceAlertsWidget
  },

  // ── Safety ────────────────────────────────────────────────
  {
    type: "safety_dashboard_summary",
    name: "Safety summary",
    category: "safety",
    size: "half",
    description: "Open incidents (by severity) and open hazards (by risk level), plus overdue count.",
    defaultColSpan: 2,
    defaultRowSpan: 1,
    component: SafetySummaryWidget
  },

  // ── Project timeline ──────────────────────────────────────
  {
    type: "ops_project_timeline",
    name: "Project timeline",
    category: "operations",
    size: "full",
    description: "Active projects rendered as bars over the next 90 days, coloured by status.",
    defaultColSpan: 3,
    defaultRowSpan: 2,
    component: ProjectTimelineWidget
  }
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
