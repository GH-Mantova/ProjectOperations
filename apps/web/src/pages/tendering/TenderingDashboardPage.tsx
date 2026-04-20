import { Link } from "react-router-dom";
import { DashboardCanvas } from "../../dashboards/DashboardCanvas";
import type { UserDashboardConfig } from "../../dashboards/types";

const DEFAULT_TENDERING_CONFIG: UserDashboardConfig = {
  period: "30d",
  widgets: [
    "ten_active_pipeline_kpi",
    "ten_submitted_mtd_kpi",
    "ten_win_rate_kpi",
    "ten_avg_lead_time_kpi",
    "ten_due_this_week",
    "ten_follow_up_queue",
    "ten_win_rate_chart",
    "ten_pipeline_by_estimator",
    "ten_recent_wins"
  ].map((type, index) => ({
    id: `${type}-default`,
    type,
    visible: true,
    order: index,
    config: { period: null, filters: {} }
  }))
};

export function TenderingDashboardPage() {
  return (
    <DashboardCanvas
      mode="by-slug"
      dashboardSlug="tendering"
      defaultName="Tender Dashboard"
      defaultConfig={DEFAULT_TENDERING_CONFIG}
      title="Tender dashboard"
      actions={<Link to="/tenders/reports" className="s7-btn s7-btn--secondary s7-btn--sm">Reports →</Link>}
    />
  );
}
