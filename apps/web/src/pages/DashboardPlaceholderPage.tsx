import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

const priorities = [
  "Tender management with multi-client workflows",
  "Contract-driven job conversion",
  "Scheduler-first planning workspace",
  "Resources, assets, forms, and documents"
];

export function DashboardPlaceholderPage() {
  const { user } = useAuth();

  return (
    <div className="dashboard-grid">
      <AppCard
        title="Foundation Ready"
        subtitle={`Welcome ${user?.firstName ?? "User"}. The shell is progressing through the required module order.`}
      >
        <ul className="feature-list">
          {priorities.map((priority) => (
            <li key={priority}>{priority}</li>
          ))}
        </ul>
      </AppCard>

      <AppCard title="Tendering Live" subtitle="Multi-client tender tracking is now active.">
        <p>
          Tender list, detail, follow-up, pricing, clarification, and multi-client linking now sit
          on top of the shared platform and master data foundations.
        </p>
      </AppCard>

      <AppCard title="Scheduler Status" subtitle="Primary workspace placeholder">
        <p>
          The scheduler workspace is now implemented as a planning surface with jobs, shifts,
          resource panels, and visible conflict signals.
        </p>
      </AppCard>
    </div>
  );
}
