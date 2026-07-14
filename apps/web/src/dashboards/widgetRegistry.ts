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
  LossReasonsDonut,
  PipelineByEstimatorDonut,
  RecentWinsPanel,
  SubmittedMtdKpi,
  WinRateByClientBar,
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
import {
  ComplianceAlertsWidget,
  ComplianceBlockedSubcontractorsKpi,
  ComplianceExpiredKpi,
  ComplianceExpiringKpi,
  ComplianceExpiryListWidget
} from "./widgets/compliance";
import {
  SafetyOpenHazardsKpi,
  SafetyOpenIncidentsKpi,
  SafetyOverdueHazardsKpi,
  SafetyRecentIncidentsList,
  SafetySummaryWidget
} from "./widgets/safety";
import { ProjectTimelineWidget } from "./widgets/projectTimeline";
import { ProgramSnapshotWidget } from "./widgets/programSnapshotWidget";
import { AvailabilityHeatmapWidget } from "./widgets/availabilityHeatmapWidget";
import {
  AssetsByStatusDonut,
  DaysSinceLastIncidentKpi,
  HoursByProjectWeekBar,
  LeavePendingKpi,
  RecentActivityList,
  StaticHeadingWidget,
  StaticNoteWidget,
  WhoIsAwayThisWeekWidget,
  XeroSyncHealthKpi
} from "./widgets/batch1";
import {
  FormApprovalsWaitingKpi,
  FormApprovalsWaitingWidget,
  MyDayWidget,
  PreStartsTodayKpi,
  QuoteDraftsKpi,
  QuoteDraftsWidget,
  RecentSitePhotosWidget
} from "./widgets/batch2";
import { SiteWeatherWidget } from "./widgets/weather";
import { CustomBuilderWidget } from "./CustomBuilderWidget";
import { CUSTOM_WIDGET_TYPE } from "./customWidget";

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
  {
    type: "ten_win_rate_by_client",
    name: "Win rate by client",
    category: "tendering",
    size: "half",
    description: "Per-client win rate (or value won) for resolved tenders in the selected period.",
    configSchema: [
      {
        key: "period",
        label: "Period",
        type: "select",
        options: [
          { value: "90d", label: "Last 90 days" },
          { value: "6m", label: "Last 6 months" },
          { value: "12m", label: "Last 12 months" }
        ]
      },
      {
        key: "metric",
        label: "Show",
        type: "select",
        options: [
          { value: "rate", label: "Win rate (%)" },
          { value: "value", label: "Value won ($)" }
        ]
      },
      { key: "maxRows", label: "Max clients", type: "number", min: 3, max: 20, step: 1, defaultValue: 8 }
    ],
    component: WinRateByClientBar
  },
  {
    type: "ten_loss_reasons",
    name: "Loss reasons",
    category: "tendering",
    size: "half",
    description: "Distribution of recorded outcomes for lost tenders in the selected period.",
    configSchema: [
      {
        key: "period",
        label: "Period",
        type: "select",
        options: [
          { value: "90d", label: "Last 90 days" },
          { value: "6m", label: "Last 6 months" },
          { value: "12m", label: "Last 12 months" }
        ]
      },
      {
        key: "chartType",
        label: "Chart",
        type: "select",
        options: [
          { value: "donut", label: "Donut" },
          { value: "bar", label: "Bar" }
        ]
      }
    ],
    component: LossReasonsDonut
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
    type: "compliance_expiring_items",
    name: "Expiring items",
    category: "compliance",
    size: "kpi",
    description: "Licences, insurance, and qualifications expiring within 30 days.",
    component: ComplianceExpiringKpi
  },
  {
    type: "compliance_expired_items",
    name: "Expired items",
    category: "compliance",
    size: "kpi",
    description: "Licences, insurance, and qualifications already expired.",
    component: ComplianceExpiredKpi
  },
  {
    type: "compliance_blocked_subcontractors",
    name: "Blocked subcontractors",
    category: "compliance",
    size: "kpi",
    description: "Subcontractors blocked due to expired critical compliance.",
    component: ComplianceBlockedSubcontractorsKpi
  },
  {
    type: "compliance_expiry_list",
    name: "Expiry alerts",
    category: "compliance",
    size: "full",
    description: "All licence, insurance, and qualification items expiring or expired, sorted by urgency.",
    defaultColSpan: 4,
    defaultRowSpan: 2,
    component: ComplianceExpiryListWidget
  },
  {
    type: "compliance_expiry_alerts",
    name: "Compliance alerts (compact)",
    category: "compliance",
    size: "half",
    description: "Top 8 licences, insurances, and qualifications expiring within 30 days.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: ComplianceAlertsWidget
  },

  // ── Safety ────────────────────────────────────────────────
  {
    type: "safety_incidents_open",
    name: "Open incidents",
    category: "safety",
    size: "kpi",
    description: "Count of open safety incidents.",
    component: SafetyOpenIncidentsKpi
  },
  {
    type: "safety_hazards_open",
    name: "Open hazards",
    category: "safety",
    size: "kpi",
    description: "Count of open hazard observations.",
    component: SafetyOpenHazardsKpi
  },
  {
    type: "safety_overdue_hazards",
    name: "Overdue hazards",
    category: "safety",
    size: "kpi",
    description: "Hazards past due date still open.",
    component: SafetyOverdueHazardsKpi
  },
  {
    type: "safety_recent_incidents",
    name: "Recent incidents",
    category: "safety",
    size: "half",
    description: "Most recent 5 safety incidents with severity.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: SafetyRecentIncidentsList
  },
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

  // ── Custom (user-built) ───────────────────────────────────
  // Holds user-defined widgets created via the dashboard builder. The
  // configSchema is empty because the builder writes a synthetic filters
  // bag ({dataSource, metric, chartType, ...}); the widget itself parses
  // and validates that bag.
  {
    type: CUSTOM_WIDGET_TYPE,
    name: "Custom widget",
    category: "custom",
    size: "half",
    description: "A user-built widget — pick a data source, metric, and chart type.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    minColSpan: 1,
    minRowSpan: 1,
    maxColSpan: 4,
    maxRowSpan: 4,
    component: CustomBuilderWidget
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
  },
  {
    type: "ops_program_snapshot",
    name: "Program snapshot",
    category: "operations",
    size: "full",
    description: "Top active projects with their Gantt tasks over a rolling window.",
    defaultColSpan: 3,
    defaultRowSpan: 2,
    minColSpan: 2,
    minRowSpan: 1,
    maxColSpan: 4,
    maxRowSpan: 4,
    configSchema: [
      {
        key: "windowDays",
        label: "Window (days)",
        type: "select",
        defaultValue: "28",
        options: [
          { value: "14", label: "Next 14 days" },
          { value: "28", label: "Next 4 weeks" },
          { value: "56", label: "Next 8 weeks" },
          { value: "90", label: "Next 90 days" }
        ]
      },
      { key: "topN", label: "Max projects", type: "number", min: 3, max: 20, step: 1, defaultValue: 8 }
    ],
    component: ProgramSnapshotWidget
  },
  {
    type: "ops_availability_heatmap",
    name: "Worker availability heatmap",
    category: "operations",
    size: "full",
    description:
      "Top active workers x next N days — cells coloured by allocation load (free / partial / full).",
    defaultColSpan: 3,
    defaultRowSpan: 2,
    minColSpan: 2,
    minRowSpan: 1,
    maxColSpan: 4,
    maxRowSpan: 4,
    configSchema: [
      {
        key: "days",
        label: "Window (days)",
        type: "select",
        defaultValue: "14",
        options: [
          { value: "7", label: "Next 7 days" },
          { value: "14", label: "Next 14 days" },
          { value: "28", label: "Next 28 days" }
        ]
      },
      { key: "topN", label: "Max workers", type: "number", min: 3, max: 20, step: 1, defaultValue: 8 }
    ],
    component: AvailabilityHeatmapWidget
  },

  // ── Batch 1 quick wins ────────────────────────────────────
  {
    type: "hseq_days_since_last_incident",
    name: "Days since last incident",
    category: "safety",
    size: "kpi",
    description: "The classic site-board counter — days since the most recent recorded safety incident.",
    component: DaysSinceLastIncidentKpi
  },
  {
    type: "res_who_is_away_this_week",
    name: "Who's away this week",
    category: "operations",
    size: "half",
    description: "Approved leave + unavailability blocks touching the next 7 days.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: WhoIsAwayThisWeekWidget
  },
  {
    type: "res_leave_pending_kpi",
    name: "Leave pending",
    category: "operations",
    size: "kpi",
    description: "PENDING worker leave requests waiting on a decision.",
    component: LeavePendingKpi
  },
  {
    type: "fld_hours_by_project_week_bar",
    name: "Hours by project this week",
    category: "operations",
    size: "half",
    description: "Approved timesheet hours split by project for the current ISO week.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: HoursByProjectWeekBar
  },
  {
    type: "ast_by_status_donut",
    name: "Assets by status",
    category: "maintenance",
    size: "half",
    description: "Donut chart of asset counts by status (Available / In use / Down / Maintenance / Retired).",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: AssetsByStatusDonut
  },
  {
    type: "plt_xero_sync_health_kpi",
    name: "Xero sync health",
    category: "operations",
    size: "kpi",
    description: "Xero connection state and last sync result — green when connected + syncing cleanly.",
    component: XeroSyncHealthKpi
  },
  {
    type: "plt_recent_activity_list",
    name: "Recent activity",
    category: "operations",
    size: "half",
    description: "Latest audit-log entries (who did what, when). Admin-only.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: RecentActivityList
  },
  {
    type: "annot_text_heading",
    name: "Heading",
    category: "custom",
    size: "kpi",
    description: "Static heading — for section labels on shared dashboards. No data source.",
    defaultColSpan: 4,
    defaultRowSpan: 1,
    minColSpan: 1,
    minRowSpan: 1,
    maxColSpan: 4,
    maxRowSpan: 2,
    configSchema: [
      {
        key: "text",
        label: "Heading text",
        type: "text",
        defaultValue: "Section heading",
        placeholder: "e.g. Tendering this week"
      }
    ],
    component: StaticHeadingWidget
  },
  // ── Batch 2 composed ──────────────────────────────────────────
  {
    type: "forms_approvals_waiting_kpi",
    name: "Approvals waiting",
    category: "forms",
    size: "kpi",
    description: "System-wide pending form approvals with an overdue split — tap for the queue.",
    component: FormApprovalsWaitingKpi
  },
  {
    type: "forms_approvals_waiting_panel",
    name: "Approvals waiting (list)",
    category: "forms",
    size: "half",
    description: "Top 5 form approvals due soonest, with the overdue count on top.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: FormApprovalsWaitingWidget
  },
  {
    type: "ten_quote_drafts_kpi",
    name: "Draft quotes",
    category: "tendering",
    size: "kpi",
    description: "Total $ of ClientQuotes still in DRAFT — the money-on-the-table view across all tenders.",
    component: QuoteDraftsKpi
  },
  {
    type: "ten_quote_drafts_panel",
    name: "Draft quotes (list)",
    category: "tendering",
    size: "half",
    description: "Top 5 DRAFT ClientQuotes by value, with the tender number and client name.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: QuoteDraftsWidget
  },
  {
    type: "forms_prestarts_today_kpi",
    name: "Prestarts today",
    category: "forms",
    size: "kpi",
    description:
      "Count of pre-start form submissions logged today. Denominator (crews expected) is deferred to B-P0c.",
    component: PreStartsTodayKpi
  },
  {
    type: "doc_recent_site_photos",
    name: "Recent site photos",
    category: "operations",
    size: "half",
    description: "Latest image documents visible to you, as a thumbnail grid. Tap through to Documents.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: RecentSitePhotosWidget
  },
  {
    type: "personal_my_day",
    name: "My day",
    category: "operations",
    size: "half",
    description:
      "Your allocations today, approvals waiting on your decision, and forms due — all scoped to you.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    component: MyDayWidget
  },

  // ── Site weather (Open-Meteo proxy) ──────────────────────────
  //
  // First external data dependency in the platform. All calls go through
  // the API's /dashboards/weather/site/:siteId proxy — never straight from
  // the browser — and the proxy caches upstream results for 30 min. If the
  // upstream is down the widget shows "weather unavailable" rather than
  // erroring the dashboard.
  {
    type: "ops_site_weather",
    name: "Site weather",
    category: "operations",
    size: "half",
    description: "Current conditions + 5-day outlook for a site, using its postcode. Open-Meteo, no key required.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    minColSpan: 2,
    minRowSpan: 1,
    maxColSpan: 4,
    maxRowSpan: 3,
    configSchema: [
      { key: "siteId", label: "Site", type: "select", dynamicOptions: "sites" }
    ],
    component: SiteWeatherWidget
  },
  {
    type: "annot_text_note",
    name: "Note",
    category: "custom",
    size: "half",
    description: "Static text note — instructions, context, or contact info. No data source.",
    defaultColSpan: 2,
    defaultRowSpan: 2,
    minColSpan: 1,
    minRowSpan: 1,
    maxColSpan: 4,
    maxRowSpan: 4,
    configSchema: [
      {
        key: "text",
        label: "Note text",
        type: "textarea",
        defaultValue: "",
        placeholder: "Ring Marco if this row goes red."
      }
    ],
    component: StaticNoteWidget
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
