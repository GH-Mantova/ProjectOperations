import { useParams } from "react-router-dom";
import { DashboardCanvas } from "../../dashboards/DashboardCanvas";

export function UserDashboardPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <DashboardCanvas mode="by-id" dashboardId={id} />;
}
