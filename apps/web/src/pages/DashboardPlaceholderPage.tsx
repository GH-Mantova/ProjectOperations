import { DashboardCanvas } from "../dashboards/DashboardCanvas";

export function DashboardPlaceholderPage() {
  return (
    <DashboardCanvas
      mode="by-slug"
      dashboardSlug="operations"
      title="Operations Overview"
    />
  );
}
