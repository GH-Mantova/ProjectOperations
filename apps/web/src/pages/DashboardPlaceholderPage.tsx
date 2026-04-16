import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

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
      status: string;
      plannedDate?: string | null;
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
  activityStatus: string;
  activityPlannedDate?: string | null;
  activityOwnerId?: string;
  shiftId?: string;
  shiftTitle?: string;
  stateLabel: "Blocked" | "Warning" | "Needs planning" | "Ready to update";
  tone: "red" | "amber" | "blue" | "green";
  ownerLabel: string;
  target: "jobs" | "scheduler";
};

function getUrgencyPillClass(urgencyLabel?: "Urgent today" | "Due soon" | "Upcoming") {
  if (urgencyLabel === "Urgent today") {
    return "pill pill--red";
  }

  if (urgencyLabel === "Due soon") {
    return "pill pill--amber";
  }

  return "pill pill--blue";
}

export function DashboardPlaceholderPage() {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPlanningRecord[]>([]);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);

  const load = async () => {
    const [jobsResponse, followUpsResponse] = await Promise.all([
      authFetch("/jobs?page=1&pageSize=50"),
      authFetch("/notifications/follow-ups/shared")
    ]);

    if (!jobsResponse.ok || !followUpsResponse.ok) {
      setJobs([]);
      setSharedFollowUps([]);
      return;
    }

    const jobsData = await jobsResponse.json();
    const followUpsData = await followUpsResponse.json();
    setJobs(jobsData.items);
    setSharedFollowUps(followUpsData);
  };

  useEffect(() => {
    void load();
  }, [authFetch]);

  const homeSignals = useMemo(() => {
    const summaries = jobs.map((job) => {
      const activities =
        job.stages?.flatMap((stage) =>
          stage.activities.map((activity) => ({
            stageName: stage.name,
            ...activity
          }))
        ) ?? [];
      const shifts = activities.flatMap((activity) => activity.shifts);

      return {
        id: job.id,
        label: `${job.jobNumber} - ${job.name}`,
        blocked: shifts.filter((shift) => shift.conflicts.some((conflict) => conflict.severity === "RED")).length,
        warning: shifts.filter(
          (shift) =>
            !shift.conflicts.some((conflict) => conflict.severity === "RED") &&
            shift.conflicts.some((conflict) => conflict.severity === "AMBER")
        ).length,
        unscheduled: activities.filter((activity) => activity.shifts.length === 0).length
      };
    });

    const prompts = sharedFollowUps
      .filter((item) => item.metadata?.kind === "LIVE_FOLLOW_UP")
      .map((item) => ({
        ...item,
        audienceLabel:
          (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? "Assigned to me" : "Team follow-up",
        urgencyLabel: item.metadata?.urgencyLabel ?? "Upcoming"
      }));

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
                activityStatus: activity.status,
                activityPlannedDate: activity.plannedDate ?? null,
                activityOwnerId: activity.owner?.id,
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
                  activityStatus: activity.status,
                  activityPlannedDate: activity.plannedDate ?? null,
                  activityOwnerId: activity.owner?.id,
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

    const executionQueue = [...myActivities, ...myShifts]
      .sort((left, right) => {
        const toneRank = (tone: ExecutionQueueItem["tone"]) =>
          tone === "red" ? 0 : tone === "amber" ? 1 : tone === "blue" ? 2 : 3;
        return toneRank(left.tone) - toneRank(right.tone);
      })
      .slice(0, 5);

    return {
      blockedJobs: summaries.filter((job) => job.blocked > 0).length,
      warningJobs: summaries.filter((job) => job.blocked === 0 && job.warning > 0).length,
      needsPlanningJobs: summaries.filter((job) => job.blocked === 0 && job.warning === 0 && job.unscheduled > 0).length,
      assignedToMe: prompts.filter((item) => item.audienceLabel === "Assigned to me").length,
      urgentToday: prompts.filter((item) => item.urgencyLabel === "Urgent today").length,
      myActivities: myActivities.length,
      myShifts: myShifts.length,
      executionQueue,
      topActions: prompts.slice(0, 4),
      topRisks: summaries
        .filter((job) => job.blocked > 0 || job.warning > 0 || job.unscheduled > 0)
        .sort((left, right) => right.blocked * 10 + right.warning * 3 + right.unscheduled - (left.blocked * 10 + left.warning * 3 + left.unscheduled))
        .slice(0, 4)
    };
  }, [jobs, sharedFollowUps, user?.id]);

  const primaryRoleLabel = user?.roles[0]?.name ?? "Operations";

  const roleRecommendations = useMemo(() => {
    if (!user) {
      return [];
    }

    if (user.permissions.includes("scheduler.manage")) {
      return [
        "Start with the action center and clear urgent planning blockers.",
        "Jump into Scheduler when a shift needs direct intervention.",
        "Use Notifications to coordinate watch-only versus handled items."
      ];
    }

    if (user.permissions.includes("jobs.manage")) {
      return [
        "Review blocked and warning jobs first, then move into delivery follow-through.",
        "Use Jobs to confirm activity state after planning is resolved.",
        "Open Documents when active work is missing delivery file continuity."
      ];
    }

    return [
      "Use the action center to pick up the highest-signal follow-up first.",
      "Open Dashboards for portfolio-level planning and delivery health.",
      "Move into Notifications when you need the full shared coordination view."
    ];
  }, [user]);

  const openSharedAction = (item: SharedFollowUpItem) => {
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
            from: "overview",
            title: "Focused job documents"
          }
        }
      });
      return;
    }

    navigate("/jobs", {
      state: {
        jobFocus: {
          jobId,
          from: "overview"
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
          from: "overview"
        }
      }
    });
  };

  const updateExecutionItem = async (item: ExecutionQueueItem, action: "mark-active" | "log-progress") => {
    if (action === "mark-active") {
      await authFetch(`/jobs/${item.jobId}/activities/${item.activityId}`, {
        method: "PATCH",
        body: JSON.stringify({
          jobStageId: item.stageId,
          name: item.activityName,
          status: "ACTIVE",
          plannedDate: item.activityPlannedDate ?? undefined,
          ownerUserId: item.activityOwnerId ?? user?.id ?? undefined
        })
      });
    } else {
      await authFetch(`/jobs/${item.jobId}/progress-entries`, {
        method: "POST",
        body: JSON.stringify({
          entryType: "DAILY_NOTE",
          entryDate: new Date().toISOString().slice(0, 10),
          summary: `Execution update for ${item.activityName}: progress reviewed from Overview.`
        })
      });
    }

    await load();
  };

  return (
    <div className="crm-page crm-page--operations">
      <div className="crm-page__sidebar">
        <AppCard title="Operational Home" subtitle={`Welcome ${user?.firstName ?? "User"}. This workspace is tuned for ${primaryRoleLabel}.`}>
          <div className="tendering-overview-summary">
            <div className="tendering-overview-summary__hero">
              <span className="pill pill--blue">Live workspace</span>
              <h4>Start from the work that needs attention now.</h4>
              <p className="muted-text">
                Your home view now pulls together shared action prompts, planning risk, and the most relevant next moves across the ERP.
              </p>
            </div>
            <div className="tendering-overview-summary__metrics">
              <div className="tendering-overview-summary__metric">
                <strong>{homeSignals.assignedToMe}</strong>
                <span>Assigned to me</span>
              </div>
              <div className="tendering-overview-summary__metric">
                <strong>{homeSignals.urgentToday}</strong>
                <span>Urgent today</span>
              </div>
              <div className="tendering-overview-summary__metric">
                <strong>{homeSignals.blockedJobs}</strong>
                <span>Blocked jobs</span>
              </div>
              <div className="tendering-overview-summary__metric">
                <strong>{homeSignals.needsPlanningJobs}</strong>
                <span>Need planning</span>
              </div>
              <div className="tendering-overview-summary__metric">
                <strong>{homeSignals.myActivities}</strong>
                <span>My activities</span>
              </div>
              <div className="tendering-overview-summary__metric">
                <strong>{homeSignals.myShifts}</strong>
                <span>My shifts</span>
              </div>
            </div>
          </div>
          <div className="tendering-overview-list">
            {roleRecommendations.map((item) => (
              <div key={item} className="tendering-overview-list__item">
                <strong>Recommended next step</strong>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </AppCard>

        <AppCard title="Priority Actions" subtitle="Shared follow-ups already filtered through the live coordination engine">
          <div className="dashboard-list dashboard-list--capped">
            {homeSignals.topActions.map((item) => (
              <div key={item.id} className="tendering-focus-list__item">
                <div className="split-header">
                  <strong>{item.title}</strong>
                  <span className={getUrgencyPillClass(item.urgencyLabel)}>{item.urgencyLabel}</span>
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
                  <button type="button" onClick={() => openSharedAction(item)}>
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
            {!homeSignals.topActions.length ? (
              <p className="muted-text">No live actions are surfacing right now.</p>
            ) : null}
          </div>
        </AppCard>

        <AppCard title="My Execution Queue" subtitle="Daily work surfaced from activity ownership and shift lead responsibility">
          <div className="dashboard-list dashboard-list--capped">
            {homeSignals.executionQueue.map((item) => (
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
                <div className="inline-fields">
                  <button type="button" onClick={() => openExecutionItem(item)}>
                    {item.target === "scheduler" ? "Open in Scheduler" : "Open in Jobs"}
                  </button>
                  {item.target === "jobs" ? (
                    <>
                      {item.activityStatus === "PLANNED" ? (
                        <button type="button" onClick={() => void updateExecutionItem(item, "mark-active")}>
                          Mark Active
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void updateExecutionItem(item, "log-progress")}>
                        Log progress
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {!homeSignals.executionQueue.length ? (
              <p className="muted-text">No execution items are currently owned by the signed-in user.</p>
            ) : null}
          </div>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Planning and Delivery Snapshot" subtitle="Cross-job signal for the work most likely to need attention next">
          <div className="tendering-overview-pulse-grid tendering-overview-pulse-grid--communication">
            <div className="tendering-overview-pulse-card tendering-overview-pulse-card--communication">
              <strong>{homeSignals.blockedJobs}</strong>
              <span>Blocked jobs</span>
              <p>Jobs with hard planning conflicts still preventing clean execution.</p>
            </div>
            <div className="tendering-overview-pulse-card tendering-overview-pulse-card--communication">
              <strong>{homeSignals.warningJobs}</strong>
              <span>Warning jobs</span>
              <p>Jobs that can probably proceed, but still have planning watchpoints.</p>
            </div>
            <div className="tendering-overview-pulse-card tendering-overview-pulse-card--communication">
              <strong>{homeSignals.needsPlanningJobs}</strong>
              <span>Need first shift</span>
              <p>Activities still waiting for their first shift to be created.</p>
            </div>
            <div className="tendering-overview-pulse-card tendering-overview-pulse-card--communication">
              <strong>{homeSignals.assignedToMe}</strong>
              <span>My queue</span>
              <p>Live action items currently aimed at the signed-in user.</p>
            </div>
          </div>
        </AppCard>

        <AppCard title="At-Risk Jobs" subtitle="Fast jump into the jobs most likely to need intervention">
          <div className="dashboard-list dashboard-list--capped">
            {homeSignals.topRisks.map((job) => (
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
                <button
                  type="button"
                  onClick={() =>
                    navigate("/jobs", {
                      state: {
                        jobFocus: {
                          jobId: job.id,
                          from: "overview"
                        }
                      }
                    })
                  }
                >
                  Open in Jobs
                </button>
              </div>
            ))}
            {!homeSignals.topRisks.length ? (
              <p className="muted-text">No active jobs are surfacing delivery or planning risk right now.</p>
            ) : null}
          </div>
        </AppCard>

        <AppCard title="Quick Navigation" subtitle="Move directly into the part of the ERP that matches today’s likely work">
          <div className="compact-two-up">
            <div className="resource-card resource-card--compact">
              <strong>Notifications</strong>
              <p className="muted-text">Open the full shared coordination feed with triage history and ownership.</p>
              <button type="button" onClick={() => navigate("/notifications")}>
                Open Notifications
              </button>
            </div>
            <div className="resource-card resource-card--compact">
              <strong>Dashboards</strong>
              <p className="muted-text">Move to portfolio-level planning and delivery visibility.</p>
              <button type="button" onClick={() => navigate("/dashboards")}>
                Open Dashboards
              </button>
            </div>
            <div className="resource-card resource-card--compact">
              <strong>Jobs</strong>
              <p className="muted-text">Review delivery follow-through, blockers, and planning pressure job by job.</p>
              <button type="button" onClick={() => navigate("/jobs")}>
                Open Jobs
              </button>
            </div>
            <div className="resource-card resource-card--compact">
              <strong>Scheduler</strong>
              <p className="muted-text">Go straight into planning resolution and shift-level execution control.</p>
              <button type="button" onClick={() => navigate("/scheduler")}>
                Open Scheduler
              </button>
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}
