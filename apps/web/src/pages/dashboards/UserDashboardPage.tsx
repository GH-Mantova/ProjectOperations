import { useParams } from "react-router-dom";
import { DashboardCanvas } from "../../dashboards/DashboardCanvas";
import { useReportWidgetsHydration } from "../../dashboards/widgetRegistry";

export function UserDashboardPage() {
  const { id } = useParams<{ id: string }>();
  // Hydrate report widgets from /reporting/definitions so they appear in the
  // Add-widget gallery when the user opens it on this dashboard.
  useReportWidgetsHydration();
  if (!id) return null;
  return <DashboardCanvas mode="by-id" dashboardId={id} />;
}
