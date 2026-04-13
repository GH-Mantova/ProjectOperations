import { useEffect, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type Dashboard = {
  id: string;
  name: string;
  description?: string | null;
  scope: string;
  ownerRole?: { id: string; name: string } | null;
  widgets: Array<{ id: string; title: string; type: string; description?: string | null; config?: { metricKey?: string } | null }>;
  render: Array<{
    type: string;
    data:
      | { kind: "kpi"; metricKey: string; value: number }
      | { kind: "chart"; metricKey: string; points: Array<{ label: string; value: number }> }
      | { kind: "table"; metricKey: string; columns: string[]; rows: string[][] }
      | { kind: "unsupported"; metricKey: string };
  }>;
};

export function DashboardsPage() {
  const { authFetch } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    scope: "USER",
    ownerRoleId: "",
    preset: "operations-overview"
  });

  const load = async () => {
    const [dashboardsResponse, rolesResponse] = await Promise.all([authFetch("/dashboards"), authFetch("/roles?page=1&pageSize=50")]);

    if (!dashboardsResponse.ok || !rolesResponse.ok) {
      setDashboards([]);
      return;
    }

    const dashboardsData = await dashboardsResponse.json();
    const rolesData = await rolesResponse.json();
    setDashboards(dashboardsData);
    setRoles(rolesData.items);
  };

  useEffect(() => {
    load();
  }, []);

  const presets: Record<string, Array<{ type: string; title: string; description: string; position: number; width?: number; height?: number; config: { metricKey: string } }>> = {
    "operations-overview": [
      { type: "kpi", title: "Tender Pipeline", description: "Open tenders", position: 0, config: { metricKey: "tender.pipeline" } },
      { type: "kpi", title: "Active Jobs", description: "Currently active jobs", position: 1, config: { metricKey: "jobs.active" } },
      { type: "chart", title: "Jobs by Status", description: "Live jobs status chart", position: 2, width: 2, config: { metricKey: "jobs.byStatus" } },
      { type: "table", title: "Scheduler Summary", description: "Upcoming shifts", position: 3, width: 2, config: { metricKey: "scheduler.summary" } }
    ],
    "planner-view": [
      { type: "kpi", title: "Scheduler Conflicts", description: "Red and amber conflicts", position: 0, config: { metricKey: "scheduler.conflicts" } },
      { type: "kpi", title: "Resource Utilisation", description: "Assigned worker count", position: 1, config: { metricKey: "resources.utilization" } },
      { type: "chart", title: "Tender Status Mix", description: "Tender pipeline", position: 2, width: 2, config: { metricKey: "tenders.byStatus" } },
      { type: "table", title: "Maintenance Due List", description: "Due maintenance", position: 3, width: 2, config: { metricKey: "maintenance.dueList" } }
    ]
  };

  const createDashboard = async (event: React.FormEvent) => {
    event.preventDefault();

    const response = await authFetch("/dashboards", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        scope: form.scope,
        ownerRoleId: form.scope === "ROLE" ? form.ownerRoleId || undefined : undefined,
        widgets: presets[form.preset]
      })
    });

    if (!response.ok) {
      return;
    }

    setForm({ name: "", description: "", scope: "USER", ownerRoleId: "", preset: "operations-overview" });
    await load();
  };

  return (
    <div className="crm-page crm-page--operations">
      <div className="crm-page__sidebar">
        <AppCard title="Dashboards" subtitle="Live operational dashboards driven from current system data">
          <div className="dashboard-list dashboard-list--capped">
            {dashboards.map((dashboard) => (
              <section key={dashboard.id} className="dashboard-preview">
                <h3>{dashboard.name}</h3>
                <p>{dashboard.description}</p>
                <p className="muted-text">
                  {dashboard.scope}
                  {dashboard.ownerRole ? ` | ${dashboard.ownerRole.name}` : ""}
                </p>
                <div className="compact-two-up">
                  {dashboard.widgets.map((widget, index) => {
                    const rendered = dashboard.render[index]?.data;

                    return (
                      <div key={widget.id} className="resource-card resource-card--compact">
                        <div className="split-header">
                          <div>
                            <strong>{widget.title}</strong>
                            <p className="muted-text">{widget.description}</p>
                          </div>
                          <span className="pill pill--green">{widget.type}</span>
                        </div>
                        {rendered?.kind === "kpi" ? <p className="dashboard-kpi">{rendered.value}</p> : null}
                        {rendered?.kind === "chart" ? (
                          <div className="subsection">
                            {rendered.points.map((point) => (
                              <div key={`${widget.id}-${point.label}`} className="record-row">
                                <span>{point.label}</span>
                                <span className="muted-text">{point.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {rendered?.kind === "table" ? (
                          <div className="subsection">
                            {rendered.rows.slice(0, 5).map((row, rowIndex) => (
                              <div key={`${widget.id}-row-${rowIndex}`} className="record-row">
                                {row.map((value, valueIndex) => (
                                  <span key={`${widget.id}-${rowIndex}-${valueIndex}`} className="muted-text">
                                    {value}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Create Dashboard" subtitle="Save user or role dashboards with live widget presets">
          <form className="admin-form" onSubmit={createDashboard}>
            <div className="compact-filter-grid compact-filter-grid--two">
              <label>
                Name
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label>
                Description
                <input
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
              <label>
                Scope
                <select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })}>
                  <option value="USER">User</option>
                  <option value="ROLE">Role</option>
                  <option value="GLOBAL">Global</option>
                </select>
              </label>
              {form.scope === "ROLE" ? (
                <label>
                  Role owner
                  <select value={form.ownerRoleId} onChange={(event) => setForm({ ...form, ownerRoleId: event.target.value })}>
                    <option value="">Select role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="compact-filter-grid__wide">
                Widget preset
                <select value={form.preset} onChange={(event) => setForm({ ...form, preset: event.target.value })}>
                  <option value="operations-overview">Operations overview</option>
                  <option value="planner-view">Planner view</option>
                </select>
              </label>
            </div>
            <button type="submit">Create Dashboard</button>
          </form>
        </AppCard>
      </div>
    </div>
  );
}
