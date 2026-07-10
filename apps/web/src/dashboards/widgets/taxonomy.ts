/**
 * Widget module taxonomy — used by the gallery's "Group by Module" view.
 *
 * Mirrors NAV_GROUPS ordering in ShellLayout so the module tree matches the
 * sidebar users already know. Every widget in the registry MUST have an
 * entry — assertTaxonomyCompleteness (see widgetGallery.test.ts) fails CI
 * when a future widget is missing.
 */

import { CUSTOM_WIDGET_TYPE } from "../customWidget";

/** Top-level module — mirrors NAV_GROUPS ordering. */
export type WidgetModule = "Commercial" | "Operations" | "Platform" | "Personal" | "Custom";

/** Ordered module list — must stay aligned with NAV_GROUPS in ShellLayout. */
export const WIDGET_MODULE_ORDER: WidgetModule[] = [
  "Commercial",
  "Operations",
  "Platform",
  "Personal",
  "Custom"
];

/** Submodule ordering per module — mirrors the sidebar item order. */
export const WIDGET_SUBMODULE_ORDER: Record<WidgetModule, string[]> = {
  Commercial: ["Tendering", "Contracts"],
  Operations: [
    "Projects",
    "Jobs",
    "Scheduler",
    "Sites",
    "Assets",
    "Inventory",
    "Maintenance",
    "Forms",
    "Safety"
  ],
  Platform: ["Compliance", "Documents"],
  Personal: ["My day"],
  Custom: ["Annotations"]
};

export type WidgetTaxonomyEntry = { module: WidgetModule; submodule: string };

/**
 * Central mapping of widget type -> module/submodule.
 *
 * When adding a new widget to the registry, add its type here too. The
 * completeness test in widgetGallery.test.ts fails CI otherwise.
 */
export const WIDGET_TAXONOMY: Record<string, WidgetTaxonomyEntry> = {
  // ── Operations — Jobs ─────────────────────────────────────
  ops_active_jobs_kpi: { module: "Operations", submodule: "Jobs" },
  ops_open_issues_kpi: { module: "Operations", submodule: "Jobs" },
  ops_jobs_by_status_donut: { module: "Operations", submodule: "Jobs" },
  jobs_active_count_kpi: { module: "Operations", submodule: "Jobs" },
  jobs_completion_rate_kpi: { module: "Operations", submodule: "Jobs" },
  jobs_open_issues_kpi: { module: "Operations", submodule: "Jobs" },
  jobs_stage_progress_bar: { module: "Operations", submodule: "Jobs" },

  // ── Operations — Projects ─────────────────────────────────
  ops_active_projects_kpi: { module: "Operations", submodule: "Projects" },
  ops_project_timeline: { module: "Operations", submodule: "Projects" },
  ops_program_snapshot: { module: "Operations", submodule: "Projects" },
  ops_monthly_revenue_line: { module: "Operations", submodule: "Projects" },

  // ── Operations — Scheduler ────────────────────────────────
  ops_availability_heatmap: { module: "Operations", submodule: "Scheduler" },
  res_who_is_away_this_week: { module: "Operations", submodule: "Scheduler" },
  res_leave_pending_kpi: { module: "Operations", submodule: "Scheduler" },
  fld_hours_by_project_week_bar: { module: "Operations", submodule: "Scheduler" },
  ops_timesheets_pending_kpi: { module: "Operations", submodule: "Scheduler" },

  // ── Operations — Sites ────────────────────────────────────
  ops_site_weather: { module: "Operations", submodule: "Sites" },

  // ── Operations — Assets ───────────────────────────────────
  ast_by_status_donut: { module: "Operations", submodule: "Assets" },

  // ── Operations — Maintenance ──────────────────────────────
  ops_upcoming_maintenance_kpi: { module: "Operations", submodule: "Maintenance" },
  ops_maintenance_bar: { module: "Operations", submodule: "Maintenance" },
  maint_overdue_count_kpi: { module: "Operations", submodule: "Maintenance" },
  maint_upcoming_bar: { module: "Operations", submodule: "Maintenance" },
  maint_breakdown_count_kpi: { module: "Operations", submodule: "Maintenance" },

  // ── Operations — Forms ────────────────────────────────────
  ops_form_submissions_bar: { module: "Operations", submodule: "Forms" },
  forms_submissions_kpi: { module: "Operations", submodule: "Forms" },
  forms_by_template_bar: { module: "Operations", submodule: "Forms" },
  forms_approvals_waiting_kpi: { module: "Operations", submodule: "Forms" },
  forms_approvals_waiting_panel: { module: "Operations", submodule: "Forms" },
  forms_prestarts_today_kpi: { module: "Operations", submodule: "Forms" },

  // ── Operations — Safety ───────────────────────────────────
  safety_incidents_open: { module: "Operations", submodule: "Safety" },
  safety_hazards_open: { module: "Operations", submodule: "Safety" },
  safety_overdue_hazards: { module: "Operations", submodule: "Safety" },
  safety_recent_incidents: { module: "Operations", submodule: "Safety" },
  safety_dashboard_summary: { module: "Operations", submodule: "Safety" },
  hseq_days_since_last_incident: { module: "Operations", submodule: "Safety" },

  // ── Commercial — Tendering ────────────────────────────────
  ops_tender_pipeline_kpi: { module: "Commercial", submodule: "Tendering" },
  ops_tender_pipeline_donut: { module: "Commercial", submodule: "Tendering" },
  ten_active_pipeline_kpi: { module: "Commercial", submodule: "Tendering" },
  ten_submitted_mtd_kpi: { module: "Commercial", submodule: "Tendering" },
  ten_win_rate_kpi: { module: "Commercial", submodule: "Tendering" },
  ten_avg_lead_time_kpi: { module: "Commercial", submodule: "Tendering" },
  ten_due_this_week: { module: "Commercial", submodule: "Tendering" },
  ten_follow_up_queue: { module: "Commercial", submodule: "Tendering" },
  ten_win_rate_chart: { module: "Commercial", submodule: "Tendering" },
  ten_pipeline_by_estimator: { module: "Commercial", submodule: "Tendering" },
  ten_recent_wins: { module: "Commercial", submodule: "Tendering" },
  ten_win_rate_by_client: { module: "Commercial", submodule: "Tendering" },
  ten_loss_reasons: { module: "Commercial", submodule: "Tendering" },
  ten_quote_drafts_kpi: { module: "Commercial", submodule: "Tendering" },
  ten_quote_drafts_panel: { module: "Commercial", submodule: "Tendering" },

  // ── Commercial — Contracts ────────────────────────────────
  // fin_contracts_summary_kpi is registered with category "tendering" for
  // legacy reasons but semantically lives with contracts — the taxonomy is
  // the source of truth for the Module view.
  fin_contracts_summary_kpi: { module: "Commercial", submodule: "Contracts" },

  // ── Platform — Compliance ─────────────────────────────────
  compliance_expiring_items: { module: "Platform", submodule: "Compliance" },
  compliance_expired_items: { module: "Platform", submodule: "Compliance" },
  compliance_blocked_subcontractors: { module: "Platform", submodule: "Compliance" },
  compliance_expiry_list: { module: "Platform", submodule: "Compliance" },
  compliance_expiry_alerts: { module: "Platform", submodule: "Compliance" },

  // ── Platform — Documents ──────────────────────────────────
  doc_recent_site_photos: { module: "Platform", submodule: "Documents" },
  plt_xero_sync_health_kpi: { module: "Platform", submodule: "Documents" },
  plt_recent_activity_list: { module: "Platform", submodule: "Documents" },

  // ── Personal — My day ─────────────────────────────────────
  personal_my_day: { module: "Personal", submodule: "My day" },

  // ── Custom — Annotations ──────────────────────────────────
  annot_text_heading: { module: "Custom", submodule: "Annotations" },
  annot_text_note: { module: "Custom", submodule: "Annotations" },
  [CUSTOM_WIDGET_TYPE]: { module: "Custom", submodule: "Annotations" }
};

/** Fallback used ONLY when a widget lacks a taxonomy entry — never in tests,
 *  which assert completeness. Keeps the UI from crashing if a hot-fix ships a
 *  widget without a taxonomy row. */
export const FALLBACK_TAXONOMY: WidgetTaxonomyEntry = {
  module: "Custom",
  submodule: "Annotations"
};

export function taxonomyFor(type: string): WidgetTaxonomyEntry {
  return WIDGET_TAXONOMY[type] ?? FALLBACK_TAXONOMY;
}
