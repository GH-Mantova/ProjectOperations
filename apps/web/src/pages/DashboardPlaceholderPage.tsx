import { DashboardCanvas } from "../dashboards/DashboardCanvas";
import type { UserDashboardConfig } from "../dashboards/types";

const DEFAULT_OPERATIONS_CONFIG: UserDashboardConfig = {
  period: "30d",
  widgets: [
    "ops_active_jobs_kpi",
    "ops_tender_pipeline_kpi",
    "ops_open_issues_kpi",
    "ops_upcoming_maintenance_kpi",
    "ops_jobs_by_status_donut",
    "ops_tender_pipeline_donut",
    "ops_monthly_revenue_line",
    "ops_form_submissions_bar",
    "ops_maintenance_bar"
  ].map((type, index) => ({
    id: `${type}-default`,
    type,
    visible: true,
    order: index,
    config: { period: null, filters: {} }
  }))
};

export function DashboardPlaceholderPage() {
  return (
    <DashboardCanvas
      mode="by-slug"
      dashboardSlug="operations"
      defaultName="Operations Overview"
      defaultConfig={DEFAULT_OPERATIONS_CONFIG}
      title="Operations Overview"
    />
  );
}
