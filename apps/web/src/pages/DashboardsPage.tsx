import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useNavigate } from "react-router-dom";
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

type JobPlanningRecord = {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  stages?: Array<{
    id: string;
    name: string;
    activities: Array<{
      id: string;
      name: string;
      owner?: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
      shifts: Array<{
        id: string;
        title?: string;
        lead?: {
          id: string;
          firstName: string;
          lastName: string;
        } | null;
        conflicts: Array<{
          severity: string;
        }>;
      }>;
    }>;
  }>;
};

type SharedFollowUpItem = {
  id: string;
  title: string;
  body: string;
  userId: string;
  metadata?: {
    kind?: string;
    jobId?: string;
    actionTarget?: "job" | "documents";
    nextOwnerId?: string | null;
    nextOwnerLabel?: string;
    audienceLabel?: "Assigned to me" | "Team follow-up";
    urgencyLabel?: "Urgent today" | "Due soon" | "Upcoming";
    triageState?: "OPEN" | "ACKNOWLEDGED" | "WATCH";
  } | null;
};

type ExecutionQueueItem = {
  id: string;
  jobId: string;
  jobLabel: string;
  stageId: string;
  stageName: string;
  activityId: string;
  activityName: string;
  shiftId?: string;
  shiftTitle?: string;
  stateLabel: "Blocked" | "Warning" | "Needs planning" | "Ready to update";
  tone: "red" | "amber" | "blue" | "green";
  ownerLabel: string;
  target: "jobs" | "scheduler";
};

export function DashboardsPage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [jobs, setJobs] = useState<JobPlanningRecord[]>([]);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    scope: "USER",
    ownerRoleId: "",
    preset: "operations-overview"
  });

  const load = async () => {
    const [dashboardsResponse, rolesResponse, jobsResponse, followUpsResponse] = await Promise.all([
      authFetch("/dashboards"),
      authFetch("/roles?page=1&pageSize=50"),
      authFetch("/jobs?page=1&pageSize=50"),
      authFetch("/notifications/follow-ups/shared")
    ]);

    if (!dashboardsResponse.ok || !rolesResponse.ok || !jobsResponse.ok || !followUpsResponse.ok) {
      setDashboards([]);
      return;
    }

    const dashboardsData = await dashboardsResponse.json();
    const rolesData = await rolesResponse.json();
    const jobsData = await jobsResponse.json();
    const followUpsData = await followUpsResponse.json();
    setDashboards(dashboardsData);
    setRoles(rolesData.items);
    setJobs(jobsData.items);
    setSharedFollowUps(followUpsData);
  };

  useEffect(() => {
    load();
  }, []);

  const planningHealth = useMemo(() => {
    const summaries = jobs.map((job) => {
      const activities =
        job.stages?.flatMap((stage) =>
          stage.activities.map((activity) => ({
            stageName: stage.name,
            ...activity
          }))
        ) ?? [];
      const shifts = activities.flatMap((activity) =>
        activity.shifts.map((shift) => ({
          ...shift,
          activityName: activity.name,
          stageName: activity.stageName
        }))
      );
      const blocked = shifts.filter((shift) =>
        shift.conflicts.some((conflict) => conflict.severity === "RED")
      ).length;
      const warning = shifts.filter(
        (shift) =>
          !shift.conflicts.some((conflict) => conflict.severity === "RED") &&
          shift.conflicts.some((conflict) => conflict.severity === "AMBER")
      ).length;
      const unscheduled = activities.filter((activity) => activity.shifts.length === 0).length;

      return {
        id: job.id,
        label: `${job.jobNumber} - ${job.name}`,
        blocked,
        warning,
        unscheduled
      };
    });

    return {
      blockedJobs: summaries.filter((job) => job.blocked > 0).length,
      warningJobs: summaries.filter((job) => job.blocked === 0 && job.warning > 0).length,
      needsPlanningJobs: summaries.filter((job) => job.blocked === 0 && job.warning === 0 && job.unscheduled > 0).length,
      readyJobs: summaries.filter((job) => job.blocked === 0 && job.warning === 0 && job.unscheduled === 0).length,
      topRisks: summaries
        .filter((job) => job.blocked > 0 || job.warning > 0 || job.unscheduled > 0)
        .sort((left, right) => (right.blocked * 10 + right.warning * 3 + right.unscheduled) - (left.blocked * 10 + left.warning * 3 + left.unscheduled))
        .slice(0, 5)
    };
  }, [jobs]);

  const executionOwnership = useMemo(() => {
    const myActivities = user?.id
      ? jobs.flatMap((job) =>
          (job.stages ?? []).flatMap((stage) =>
            stage.activities
              .filter((activity) => activity.owner?.id === user.id)
              .map((activity) => ({
                id: `activity-${activity.id}`,
                jobId: job.id,
                jobLabel: `${job.jobNumber} - ${job.name}`,
                stageId: stage.id,
                stageName: stage.name,
                activityId: activity.id,
                activityName: activity.name,
                shiftId: activity.shifts[0]?.id,
                shiftTitle: activity.shifts[0]?.title ?? undefined,
                stateLabel:
                  activity.shifts.length === 0
                    ? "Needs planning"
                    : activity.shifts.some((shift) =>
                          shift.conflicts.some((conflict) => conflict.severity === "RED")
                        )
                      ? "Blocked"
                      : activity.shifts.some((shift) =>
                            shift.conflicts.some((conflict) => conflict.severity === "AMBER")
                          )
                        ? "Warning"
                        : "Ready to update" as ExecutionQueueItem["stateLabel"],
                tone:
                  activity.shifts.length === 0
                    ? "blue"
                    : activity.shifts.some((shift) =>
                          shift.conflicts.some((conflict) => conflict.severity === "RED")
                        )
                      ? "red"
                      : activity.shifts.some((shift) =>
                            shift.conflicts.some((conflict) => conflict.severity === "AMBER")
                          )
                        ? "amber"
                        : "green" as ExecutionQueueItem["tone"],
                ownerLabel: "Activity owner",
                target:
                  activity.shifts.length === 0 ||
                  activity.shifts.some((shift) =>
                    shift.conflicts.some((conflict) => conflict.severity === "RED" || conflict.severity === "AMBER")
                  )
                    ? "scheduler"
                    : "jobs" as ExecutionQueueItem["target"]
              }))
          )
        )
      : [];

    const myShifts = user?.id
      ? jobs.flatMap((job) =>
          (job.stages ?? []).flatMap((stage) =>
            stage.activities.flatMap((activity) =>
              activity.shifts
                .filter((shift) => shift.lead?.id === user.id)
                .map((shift) => ({
                  id: `shift-${shift.id}`,
                  jobId: job.id,
                  jobLabel: `${job.jobNumber} - ${job.name}`,
                  stageId: stage.id,
                  stageName: stage.name,
                  activityId: activity.id,
                  activityName: activity.name,
                  shiftId: shift.id,
                  shiftTitle: shift.title,
                  stateLabel: shift.conflicts.some((conflict) => conflict.severity === "RED")
                    ? "Blocked"
                    : shift.conflicts.some((conflict) => conflict.severity === "AMBER")
                      ? "Warning"
                      : "Ready to update" as ExecutionQueueItem["stateLabel"],
                  tone: shift.conflicts.some((conflict) => conflict.severity === "RED")
                    ? "red"
                    : shift.conflicts.some((conflict) => conflict.severity === "AMBER")
                      ? "amber"
                      : "green" as ExecutionQueueItem["tone"],
                  ownerLabel: "Shift lead",
                  target: shift.conflicts.some((conflict) => conflict.severity === "RED" || conflict.severity === "AMBER")
                    ? "scheduler"
                    : "jobs" as ExecutionQueueItem["target"]
                }))
            )
          )
        )
      : [];

    const queue = [...myActivities, ...myShifts]
      .sort((left, right) => {
        const toneRank = (tone: ExecutionQueueItem["tone"]) =>
          tone === "red" ? 0 : tone === "amber" ? 1 : tone === "blue" ? 2 : 3;
        return toneRank(left.tone) - toneRank(right.tone);
      })
      .slice(0, 5);

    return {
      myActivities: myActivities.length,
      myShifts: myShifts.length,
      queue
    };
  }, [jobs, user?.id]);

  const dashboardActionCenter = useMemo(() => {
    const prompts = sharedFollowUps
      .filter((item) => item.metadata?.kind === "LIVE_FOLLOW_UP")
      .map((item) => ({
        ...item,
        audienceLabel:
          (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? "Assigned to me" : "Team follow-up",
        urgencyLabel: item.metadata?.urgencyLabel ?? "Upcoming"
      }))
      .slice(0, 5);

    return {
      prompts,
      assignedToMe: prompts.filter((item) => item.audienceLabel === "Assigned to me").length,
      urgentToday: prompts.filter((item) => item.urgencyLabel === "Urgent today").length
    };
  }, [sharedFollowUps, user?.id]);

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

  const openJobFromDashboard = (jobId: string) => {
    navigate("/jobs", {
      state: {
        jobFocus: {
          jobId,
          from: "dashboard"
        }
      }
    });
  };

  const openFollowUpFromDashboard = (item: SharedFollowUpItem) => {
    const jobId = item.metadata?.jobId;
    if (!jobId) {
      navigate("/notifications");
      return;
    }

    if (item.metadata?.actionTarget === "documents") {
      navigate("/documents", {
        state: {
          documentFocus: {
            linkedEntityType: "Job",
            linkedEntityId: jobId,
            from: "dashboard-action-center",
            title: "Focused job documents"
          }
        }
      });
      return;
    }

    openJobFromDashboard(jobId);
  };

  const openExecutionItem = (item: ExecutionQueueItem) => {
    if (item.target === "scheduler") {
      navigate("/scheduler", {
        state: {
          plannerFocus: {
            jobId: item.jobId,
            stageId: item.stageId,
            activityId: item.activityId,
            shiftId: item.shiftId
          }
        }
      });
      return;
    }

    navigate("/jobs", {
      state: {
        jobFocus: {
          jobId: item.jobId,
          stageId: item.stageId,
          activityId: item.activityId,
          shiftId: item.shiftId,
          from: "dashboard"
        }
      }
    });
  };

  const updateFollowUpTriage = async (item: SharedFollowUpItem, triageState: "OPEN" | "ACKNOWLEDGED" | "WATCH") => {
    await authFetch(`/notifications/follow-ups/${item.id}/triage`, {
      method: "PATCH",
      body: JSON.stringify({ triageState })
    });
    await load();
  };

  return (
    <div className="crm-page crm-page--operations">
      <div className="crm-page__sidebar">
        <AppCard title="Dashboards" subtitle="Live operational dashboards driven from current system data">
          <div className="subsection">
            <div className="split-header">
              <strong>Action center snapshot</strong>
              <span className="muted-text">Shared live follow-ups across the platform</span>
            </div>
            <div className="tendering-focus-list tendering-focus-list--activity">
              <div className="tendering-focus-list__item">
                <strong>{dashboardActionCenter.prompts.length}</strong>
                <span>Live prompts</span>
              </div>
              <div className="tendering-focus-list__item">
                <strong>{dashboardActionCenter.assignedToMe}</strong>
                <span>Assigned to me</span>
              </div>
              <div className="tendering-focus-list__item">
                <strong>{dashboardActionCenter.urgentToday}</strong>
                <span>Urgent today</span>
              </div>
              <div className="tendering-focus-list__item">
                <strong>{executionOwnership.myActivities}</strong>
                <span>My activities</span>
              </div>
              <div className="tendering-focus-list__item">
                <strong>{executionOwnership.myShifts}</strong>
                <span>My shifts</span>
              </div>
            </div>
            <div className="dashboard-list">
              {dashboardActionCenter.prompts.map((item) => (
                <div key={item.id} className="tendering-focus-list__item">
                  <div className="split-header">
                    <strong>{item.title}</strong>
                    <span
                      className={
                        item.urgencyLabel === "Urgent today"
                          ? "pill pill--red"
                          : item.urgencyLabel === "Due soon"
                            ? "pill pill--amber"
                            : "pill pill--blue"
                      }
                    >
                      {item.urgencyLabel}
                    </span>
                  </div>
                  <p className="muted-text">{item.body}</p>
                  <div className="inline-fields">
                    <span className={`pill ${item.audienceLabel === "Assigned to me" ? "pill--green" : "pill--slate"}`}>
                      {item.audienceLabel}
                    </span>
                    <span className="pill pill--slate">{item.metadata?.nextOwnerLabel ?? "Team owner"}</span>
                    <span
                      className={`pill ${
                        item.metadata?.triageState === "ACKNOWLEDGED"
                          ? "pill--green"
                          : item.metadata?.triageState === "WATCH"
                            ? "pill--amber"
                            : "pill--slate"
                      }`}
                    >
                      {item.metadata?.triageState === "ACKNOWLEDGED"
                        ? "I'm handling it"
                        : item.metadata?.triageState === "WATCH"
                          ? "Watch only"
                          : "Open"}
                    </span>
                  </div>
                  <div className="inline-fields">
                    <button type="button" onClick={() => openFollowUpFromDashboard(item)}>
                      Open action
                    </button>
                    <button type="button" onClick={() => void updateFollowUpTriage(item, "ACKNOWLEDGED")}>
                      I'm handling this
                    </button>
                    <button type="button" onClick={() => void updateFollowUpTriage(item, "WATCH")}>
                      Watch only
                    </button>
                    {item.metadata?.triageState && item.metadata.triageState !== "OPEN" ? (
                      <button type="button" onClick={() => void updateFollowUpTriage(item, "OPEN")}>
                        Reset
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {!dashboardActionCenter.prompts.length ? (
                <p className="muted-text">No live coordination prompts are surfacing right now.</p>
              ) : null}
            </div>
          </div>
          <div className="subsection">
            <div className="split-header">
              <strong>Execution ownership snapshot</strong>
              <span className="muted-text">The signed-in user&apos;s activity and shift responsibilities</span>
            </div>
            <div className="dashboard-list">
              {executionOwnership.queue.map((item) => (
                <div key={item.id} className="tendering-focus-list__item">
                  <div className="split-header">
                    <strong>{item.activityName}</strong>
                    <span className={`pill pill--${item.tone}`}>{item.stateLabel}</span>
                  </div>
                  <p className="muted-text">
                    {item.jobLabel} | {item.stageName}
                    {item.shiftTitle ? ` | ${item.shiftTitle}` : ""}
                  </p>
                  <div className="inline-fields">
                    <span className="pill pill--slate">{item.ownerLabel}</span>
                    <span className="muted-text">
                      {item.target === "scheduler" ? "Best handled in Scheduler" : "Best handled in Jobs"}
                    </span>
                  </div>
                  <button type="button" onClick={() => openExecutionItem(item)}>
                    {item.target === "scheduler" ? "Open in Scheduler" : "Open in Jobs"}
                  </button>
                </div>
              ))}
              {!executionOwnership.queue.length ? (
                <p className="muted-text">No execution items are currently assigned to the signed-in user.</p>
              ) : null}
            </div>
          </div>
          <div className="subsection">
            <div className="split-header">
              <strong>Delivery and planning health</strong>
              <span className="muted-text">Cross-job operational signal</span>
            </div>
            <div className="tendering-focus-list tendering-focus-list--activity">
              <div className="tendering-focus-list__item">
                <strong>{planningHealth.blockedJobs}</strong>
                <span>Blocked jobs</span>
              </div>
              <div className="tendering-focus-list__item">
                <strong>{planningHealth.warningJobs}</strong>
                <span>Warning jobs</span>
              </div>
              <div className="tendering-focus-list__item">
                <strong>{planningHealth.needsPlanningJobs}</strong>
                <span>Need planning</span>
              </div>
              <div className="tendering-focus-list__item">
                <strong>{planningHealth.readyJobs}</strong>
                <span>Ready jobs</span>
              </div>
            </div>
            <div className="dashboard-list">
              {planningHealth.topRisks.map((job) => (
                <div key={job.id} className="tendering-focus-list__item">
                  <div className="split-header">
                    <strong>{job.label}</strong>
                    <span className={job.blocked > 0 ? "pill pill--red" : job.warning > 0 ? "pill pill--amber" : "pill pill--blue"}>
                      {job.blocked > 0 ? "Blocked" : job.warning > 0 ? "Warning" : "Needs planning"}
                    </span>
                  </div>
                  <p className="muted-text">
                    {job.blocked} blocked | {job.warning} warning | {job.unscheduled} unscheduled
                  </p>
                  <button type="button" onClick={() => openJobFromDashboard(job.id)}>
                    Open in Jobs
                  </button>
                </div>
              ))}
              {!planningHealth.topRisks.length ? (
                <p className="muted-text">No current delivery or planning risks are surfacing across active jobs.</p>
              ) : null}
            </div>
          </div>
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
