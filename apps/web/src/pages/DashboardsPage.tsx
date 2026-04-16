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
        startAt?: string;
        endAt?: string;
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
    promptKey?: string;
    jobId?: string;
    actionTarget?: "job" | "documents";
    nextOwnerId?: string | null;
    nextOwnerLabel?: string;
    audienceLabel?: "Assigned to me" | "Team follow-up";
    urgencyLabel?: "Urgent today" | "Due soon" | "Upcoming";
    triageState?: "OPEN" | "ACKNOWLEDGED" | "WATCH";
    manualType?: "HANDOFF" | "ESCALATION";
    reasonCode?: string;
    reasonDetail?: string | null;
    assignmentMode?: "DERIVED" | "MANUAL";
    assignedByLabel?: string | null;
    assignedAt?: string | null;
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

type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

type FollowUpPromptState = "OPEN" | "ACKNOWLEDGED" | "WATCH";

function getFollowUpStateLabel(item: SharedFollowUpItem) {
  if (item.metadata?.kind === "MANUAL_FOLLOW_UP" && item.metadata?.reasonCode === "DEPENDENCY_WAIT") {
    return {
      text: "Waiting external",
      className: "pill pill--amber"
    };
  }

  if (item.metadata?.triageState === "ACKNOWLEDGED") {
    return {
      text: "I'm handling it",
      className: "pill pill--green"
    };
  }

  if (item.metadata?.triageState === "WATCH") {
    return {
      text: "Watch continues",
      className: "pill pill--amber"
    };
  }

  return {
    text: "Open",
    className: "pill pill--slate"
  };
}

function getSharedFollowUpSortScore(item: SharedFollowUpItem, userId?: string) {
  const isMine = (item.metadata?.nextOwnerId ?? item.userId) === userId;
  const isRecentManualAssignment =
    item.metadata?.assignmentMode === "MANUAL" &&
    Boolean(item.metadata?.assignedAt) &&
    Date.now() - new Date(item.metadata?.assignedAt ?? 0).getTime() <= 24 * 60 * 60 * 1000;
  const triageScore =
    item.metadata?.triageState === "ACKNOWLEDGED"
      ? 1
      : item.metadata?.triageState === "WATCH"
        ? 2
        : 0;
  const urgencyScore =
    item.metadata?.urgencyLabel === "Urgent today"
      ? 0
      : item.metadata?.urgencyLabel === "Due soon"
        ? 1
        : 2;
  const waitingExternalPenalty = item.metadata?.reasonCode === "DEPENDENCY_WAIT" ? 4 : 0;
  const recentManualBoost = isMine && isRecentManualAssignment ? -3 : 0;
  const mineBoost = isMine ? -1 : 0;

  return recentManualBoost + mineBoost + triageScore + urgencyScore + waitingExternalPenalty;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function formatMonthDayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function getPortfolioScheduleRecommendation(job: { blocked: number; warning: number; activeDays: number; densestDay: number }) {
  if (job.blocked > 0) {
    return {
      label: "Open in Scheduler",
      detail: "Planning risk is already active, so the next best move is inside Scheduler.",
      guidance: "Act now",
      toneClass: "pill pill--red",
      target: "scheduler" as const
    };
  }

  if (job.warning > 0 || job.activeDays <= 3 || job.densestDay >= 3) {
    return {
      label: "Open in Scheduler",
      detail:
        job.activeDays <= 3
          ? "This job is still thinly scheduled for the month, so planning depth should be reviewed."
          : "The month shape is bunching up, so check the planner before execution absorbs the risk.",
      guidance: "Plan next",
      toneClass: "pill pill--amber",
      target: "scheduler" as const
    };
  }

  if (job.activeDays >= 6 && job.densestDay <= 2) {
    return {
      label: "Watch only",
      detail: "The schedule shape is balanced enough for now, so this can stay in portfolio watch rather than active intervention.",
      guidance: "Healthy",
      toneClass: "pill pill--green",
      target: "watch" as const
    };
  }

  return {
    label: "Open in Jobs",
    detail: "The schedule is present enough that delivery follow-through is likely the better next step.",
    guidance: "Delivery follow-through",
    toneClass: "pill pill--blue",
    target: "jobs" as const
  };
}

export function DashboardsPage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [jobs, setJobs] = useState<JobPlanningRecord[]>([]);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [manualReasonDrafts, setManualReasonDrafts] = useState<
    Record<string, { reasonCode: string; reasonDetail: string }>
  >({});
  const [form, setForm] = useState({
    name: "",
    description: "",
    scope: "USER",
    ownerRoleId: "",
    preset: "operations-overview"
  });

  const load = async () => {
    const [dashboardsResponse, rolesResponse, jobsResponse, followUpsResponse, usersResponse] = await Promise.all([
      authFetch("/dashboards"),
      authFetch("/roles?page=1&pageSize=50"),
      authFetch("/jobs?page=1&pageSize=50"),
      authFetch("/notifications/follow-ups/shared"),
      authFetch("/users?page=1&pageSize=100")
    ]);

    if (!dashboardsResponse.ok || !rolesResponse.ok || !jobsResponse.ok || !followUpsResponse.ok || !usersResponse.ok) {
      setDashboards([]);
      return;
    }

    const dashboardsData = await dashboardsResponse.json();
    const rolesData = await rolesResponse.json();
    const jobsData = await jobsResponse.json();
    const followUpsData = await followUpsResponse.json();
    const usersData = await usersResponse.json();
    setDashboards(dashboardsData);
    setRoles(rolesData.items);
    setJobs(jobsData.items);
    setSharedFollowUps(followUpsData);
    setAssignableUsers(usersData.items.filter((item: AssignableUser) => item.isActive));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setAssignmentDrafts((current) => {
      const next = { ...current };
      for (const item of sharedFollowUps) {
        const promptKey = item.metadata?.promptKey;
        if (promptKey && !next[promptKey]) {
          next[promptKey] = item.metadata?.nextOwnerId ?? item.userId;
        }
      }

      return next;
    });
  }, [sharedFollowUps]);

  const sharedFollowUpsByPrompt = useMemo(
    () =>
      new Map(
        sharedFollowUps
          .filter(
            (item) =>
              (item.metadata?.kind === "LIVE_FOLLOW_UP" || item.metadata?.kind === "MANUAL_FOLLOW_UP") &&
              item.metadata?.promptKey
          )
          .map((item) => [item.metadata?.promptKey as string, item])
      ),
    [sharedFollowUps]
  );

  const getExecutionPromptKey = (item: ExecutionQueueItem) => {
    if (item.stateLabel === "Blocked" && item.shiftId) {
      return `blocked-${item.jobId}-${item.shiftId}`;
    }

    if (item.stateLabel === "Warning" && item.shiftId) {
      return `warning-${item.jobId}-${item.shiftId}`;
    }

    if (item.stateLabel === "Needs planning") {
      return `planning-${item.jobId}-${item.activityId}`;
    }

    return null;
  };

  const getExecutionPromptState = (item: ExecutionQueueItem): FollowUpPromptState => {
    const promptKey = getExecutionPromptKey(item);
    if (!promptKey) {
      return "OPEN";
    }

    return (sharedFollowUpsByPrompt.get(promptKey)?.metadata?.triageState as FollowUpPromptState | undefined) ?? "OPEN";
  };

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

  const portfolioScheduleShape = useMemo(() => {
    const monthAnchor = startOfMonth(new Date());
    const nextMonth = addMonths(monthAnchor, 1);
    const lastDay = new Date(nextMonth.getTime() - 1).getDate();
    const dayKeys = Array.from({ length: lastDay }, (_, index) =>
      formatMonthDayKey(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), index + 1))
    );

    const summaries = jobs
      .map((job) => {
        const shifts =
          job.stages?.flatMap((stage) =>
            stage.activities.flatMap((activity) =>
              activity.shifts
                .filter((shift) => {
                  const pseudoDate = (shift as { startAt?: string }).startAt;
                  if (!pseudoDate) return false;
                  const start = new Date(pseudoDate);
                  return start >= monthAnchor && start < nextMonth;
                })
                .map((shift) => ({
                  ...shift,
                  activityName: activity.name,
                  stageName: stage.name,
                  startAt: (shift as { startAt?: string }).startAt as string
                }))
            )
          ) ?? [];

        const density = new Map<string, number>();
        shifts.forEach((shift) => {
          const key = formatMonthDayKey(new Date(shift.startAt));
          density.set(key, (density.get(key) ?? 0) + 1);
        });

        const activeDays = density.size;
        const densestDay = Math.max(...density.values(), 0);
        const blocked = shifts.filter((shift) => shift.conflicts.some((conflict) => conflict.severity === "RED")).length;
        const warning = shifts.filter(
          (shift) =>
            !shift.conflicts.some((conflict) => conflict.severity === "RED") &&
            shift.conflicts.some((conflict) => conflict.severity === "AMBER")
        ).length;

        return {
          id: job.id,
          label: `${job.jobNumber} - ${job.name}`,
          activeDays,
          densestDay,
          blocked,
          warning,
          density
        };
      })
      .filter((job) => job.activeDays > 0)
      .sort((left, right) => right.densestDay + right.blocked * 3 - (left.densestDay + left.blocked * 3))
      .slice(0, 5);

    return {
      monthLabel: monthAnchor.toLocaleDateString([], { month: "long", year: "numeric" }),
      dayKeys,
      summaries,
      thinlyScheduled: summaries.filter((job) => job.activeDays <= 3).length,
      clusteredRisk: summaries.filter((job) => job.densestDay >= 2 || job.blocked > 0).length
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

    const queue = [...myActivities, ...myShifts]
      .sort((left, right) => {
        const toneRank = (tone: ExecutionQueueItem["tone"]) =>
          tone === "red" ? 0 : tone === "amber" ? 1 : tone === "blue" ? 2 : 3;
        const promptRank = (item: ExecutionQueueItem) => {
          const prompt = getExecutionPromptKey(item)
            ? sharedFollowUpsByPrompt.get(getExecutionPromptKey(item) ?? "")
            : null;
          if (!prompt) {
            return 0;
          }
          return getSharedFollowUpSortScore(prompt, user?.id);
        };

        return promptRank(left) - promptRank(right) || toneRank(left.tone) - toneRank(right.tone);
      })
      .slice(0, 5);

    return {
      myActivities: myActivities.length,
      myShifts: myShifts.length,
      queue
    };
  }, [jobs, sharedFollowUpsByPrompt, user?.id]);

  const dashboardActionCenter = useMemo(() => {
    const prompts = sharedFollowUps
      .filter((item) => item.metadata?.kind === "LIVE_FOLLOW_UP" || item.metadata?.kind === "MANUAL_FOLLOW_UP")
      .map((item) => ({
        ...item,
        audienceLabel:
          (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? "Assigned to me" : "Team follow-up",
        urgencyLabel: item.metadata?.urgencyLabel ?? "Upcoming"
      }))
      .sort((left, right) => getSharedFollowUpSortScore(left, user?.id) - getSharedFollowUpSortScore(right, user?.id))
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
          summary: `Execution update for ${item.activityName}: progress reviewed from Dashboards.`
        })
      });
    }

    await load();
  };

  const openJobInScheduler = (jobId: string) => {
    navigate("/scheduler", {
      state: {
        plannerFocus: {
          jobId
        }
      }
    });
  };

  const createManualExecutionFollowUp = async (
    item: ExecutionQueueItem,
    mode: "handoff" | "escalate"
  ) => {
    const promptKey = getExecutionPromptKey(item);
    const draftKey = promptKey ?? item.id;
    const selectedOwnerId =
      assignmentDrafts[draftKey] ??
      assignableUsers.find((entry) => entry.id !== user?.id)?.id ??
      user?.id;
    const reasonDraft = manualReasonDrafts[draftKey] ?? {
      reasonCode: mode === "handoff" ? "OWNER_CAPACITY" : "BLOCKER_NEEDS_SUPPORT",
      reasonDetail: ""
    };

    if (!selectedOwnerId) {
      return;
    }

    const assignee = assignableUsers.find((entry) => entry.id === selectedOwnerId);
    await authFetch("/notifications/follow-ups/manual", {
      method: "POST",
      body: JSON.stringify({
        userId: selectedOwnerId,
        jobId: item.jobId,
        activityId: item.activityId,
        title:
          mode === "handoff"
            ? `${item.jobLabel} needs execution handoff`
            : `${item.jobLabel} needs execution escalation`,
        body:
          mode === "handoff"
            ? `${item.activityName} in ${item.stageName} needs a delivery handoff. Review the job context and pick up the next operational step.`
            : `${item.activityName} in ${item.stageName} needs escalation from the execution queue. Review the delivery context and unblock the next action.`,
        severity: mode === "handoff" ? "MEDIUM" : "HIGH",
        manualType: mode === "handoff" ? "HANDOFF" : "ESCALATION",
        reasonCode: reasonDraft.reasonCode,
        reasonDetail: reasonDraft.reasonDetail || undefined,
        actionTarget: "job",
        nextOwnerLabel: assignee ? `${assignee.firstName} ${assignee.lastName}` : "Team owner",
        ownerRole: mode === "handoff" ? "Activity owner" : "Planning owner",
        urgencyLabel: mode === "handoff" ? "Due soon" : "Urgent today",
        linkUrl: `/jobs?jobId=${item.jobId}`
      })
    });

    await load();
  };

  const resolveManualFollowUp = async (item: SharedFollowUpItem) => {
    await authFetch(`/notifications/follow-ups/${item.id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({
        outcomeCode: "UNBLOCKED"
      })
    });
    await load();
  };

  const acceptManualHandoff = async (item: SharedFollowUpItem) => {
    await authFetch(`/notifications/follow-ups/${item.id}/accept-handoff`, {
      method: "PATCH"
    });
    await load();
  };

  const acceptManualEscalation = async (item: SharedFollowUpItem) => {
    await authFetch(`/notifications/follow-ups/${item.id}/accept-escalation`, {
      method: "PATCH"
    });
    await load();
  };

  const markExecutionItemBlocked = async (item: ExecutionQueueItem) => {
    await authFetch(`/jobs/${item.jobId}/activities/${item.activityId}`, {
      method: "PATCH",
      body: JSON.stringify({
        jobStageId: item.stageId,
        name: item.activityName,
        status: "BLOCKED",
        plannedDate: item.activityPlannedDate ?? undefined,
        ownerUserId: item.activityOwnerId ?? user?.id ?? undefined
      })
    });

    await load();
  };

  const updateExecutionPromptState = async (item: ExecutionQueueItem, triageState: FollowUpPromptState) => {
    const promptKey = getExecutionPromptKey(item);
    if (!promptKey) {
      return;
    }

    const sharedItem = sharedFollowUpsByPrompt.get(promptKey);
    if (!sharedItem) {
      return;
    }

    await authFetch(`/notifications/follow-ups/${sharedItem.id}/triage`, {
      method: "PATCH",
      body: JSON.stringify({ triageState })
    });
    await load();
  };

  const updateExecutionPromptAssignment = async (item: ExecutionQueueItem) => {
    const promptKey = getExecutionPromptKey(item);
    if (!promptKey) {
      return;
    }

    const sharedItem = sharedFollowUpsByPrompt.get(promptKey);
    const targetUserId = assignmentDrafts[promptKey];

    if (!sharedItem || !targetUserId) {
      return;
    }

    const assignee = assignableUsers.find((entry) => entry.id === targetUserId);
    await authFetch(`/notifications/follow-ups/${sharedItem.id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({
        userId: targetUserId,
        userLabel: assignee ? `${assignee.firstName} ${assignee.lastName}` : undefined
      })
    });
    await load();
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
                  {(() => {
                    const stateLabel = getFollowUpStateLabel(item);
                    return (
                      <>
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
                  {item.metadata?.kind === "MANUAL_FOLLOW_UP" ? (
                    <p className="muted-text">
                      {item.metadata?.manualType === "ESCALATION" ? "Escalated" : "Handed off"}
                      {item.metadata?.assignedByLabel ? ` by ${item.metadata.assignedByLabel}` : ""}
                      {item.metadata?.reasonCode ? ` because ${item.metadata.reasonCode.replaceAll("_", " ").toLowerCase()}` : ""}.
                    </p>
                  ) : null}
                  <div className="inline-fields">
                    <span className={`pill ${item.audienceLabel === "Assigned to me" ? "pill--green" : "pill--slate"}`}>
                      {item.audienceLabel}
                    </span>
                    <span className="pill pill--slate">{item.metadata?.nextOwnerLabel ?? "Team owner"}</span>
                    <span className={stateLabel.className}>{stateLabel.text}</span>
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
                    {item.metadata?.kind === "MANUAL_FOLLOW_UP" ? (
                      <button type="button" onClick={() => void resolveManualFollowUp(item)}>
                        Resolve
                      </button>
                    ) : null}
                    {item.metadata?.kind === "MANUAL_FOLLOW_UP" &&
                    item.metadata?.manualType === "HANDOFF" &&
                    (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? (
                      <button type="button" onClick={() => void acceptManualHandoff(item)}>
                        Accept handoff
                      </button>
                    ) : null}
                    {item.metadata?.kind === "MANUAL_FOLLOW_UP" &&
                    item.metadata?.manualType === "ESCALATION" &&
                    (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? (
                      <button type="button" onClick={() => void acceptManualEscalation(item)}>
                        Accept escalation
                      </button>
                    ) : null}
                  </div>
                      </>
                    );
                  })()}
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
                  {getExecutionPromptKey(item) ? (
                      <span
                        className={
                          getFollowUpStateLabel(
                            sharedFollowUpsByPrompt.get(getExecutionPromptKey(item) ?? "") ?? {
                              id: item.id,
                              title: item.activityName,
                              body: "",
                              userId: user?.id ?? "",
                              metadata: null
                            }
                          ).className
                        }
                      >
                        {
                          getFollowUpStateLabel(
                            sharedFollowUpsByPrompt.get(getExecutionPromptKey(item) ?? "") ?? {
                              id: item.id,
                              title: item.activityName,
                              body: "",
                              userId: user?.id ?? "",
                              metadata: null
                            }
                          ).text
                        }
                      </span>
                    ) : null}
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
                        <button type="button" onClick={() => void markExecutionItemBlocked(item)}>
                          Blocked
                        </button>
                      </>
                    ) : null}
                    {item.target === "scheduler" && getExecutionPromptKey(item) ? (
                      <>
                        <button type="button" onClick={() => void updateExecutionPromptState(item, "ACKNOWLEDGED")}>
                          I'm handling this
                        </button>
                        <button type="button" onClick={() => void updateExecutionPromptState(item, "WATCH")}>
                          Watch only
                        </button>
                        {getExecutionPromptState(item) !== "OPEN" ? (
                          <button type="button" onClick={() => void updateExecutionPromptState(item, "OPEN")}>
                            Reset
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                  {item.target === "scheduler" && getExecutionPromptKey(item) ? (
                    <div className="inline-fields">
                      <select
                        value={
                          assignmentDrafts[getExecutionPromptKey(item) ?? ""] ??
                          sharedFollowUpsByPrompt.get(getExecutionPromptKey(item) ?? "")?.metadata?.nextOwnerId ??
                          ""
                        }
                        onChange={(event) =>
                          setAssignmentDrafts((current) => ({
                            ...current,
                            [getExecutionPromptKey(item) ?? ""]: event.target.value
                          }))
                        }
                      >
                        {assignableUsers.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.firstName} {entry.lastName}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => void updateExecutionPromptAssignment(item)}>
                        Hand off
                      </button>
                    </div>
                  ) : null}
                  {item.target === "scheduler" && getExecutionPromptKey(item) ? (
                    <p className="muted-text">
                      Shared follow-up owner:{" "}
                      {sharedFollowUpsByPrompt.get(getExecutionPromptKey(item) ?? "")?.metadata?.nextOwnerLabel ?? item.ownerLabel}
                    </p>
                  ) : null}
                  {item.target === "scheduler" && !getExecutionPromptKey(item) ? (
                    <div className="inline-fields">
                      <button type="button" onClick={() => navigate("/notifications")}>
                        Open in Notifications
                      </button>
                    </div>
                  ) : null}
                  {item.target === "jobs" ? (
                    <div className="inline-fields">
                      <select
                        value={
                          assignmentDrafts[item.id] ??
                          assignableUsers.find((entry) => entry.id !== user?.id)?.id ??
                          user?.id ??
                          ""
                        }
                        onChange={(event) =>
                          setAssignmentDrafts((current) => ({
                            ...current,
                            [item.id]: event.target.value
                          }))
                        }
                      >
                        {assignableUsers.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.firstName} {entry.lastName}
                          </option>
                          ))}
                        </select>
                        <select
                          value={manualReasonDrafts[item.id]?.reasonCode ?? "OWNER_CAPACITY"}
                          onChange={(event) =>
                            setManualReasonDrafts((current) => ({
                              ...current,
                              [item.id]: {
                                reasonCode: event.target.value,
                                reasonDetail: current[item.id]?.reasonDetail ?? ""
                              }
                            }))
                          }
                        >
                          <option value="OWNER_CAPACITY">Owner capacity</option>
                          <option value="SKILL_MATCH">Skill match needed</option>
                          <option value="CROSS_TEAM_HANDOFF">Cross-team handoff</option>
                          <option value="BLOCKER_NEEDS_SUPPORT">Blocker needs support</option>
                          <option value="DEPENDENCY_WAIT">Dependency waiting</option>
                          <option value="CLIENT_RISK">Client or site risk</option>
                        </select>
                        <input
                          value={manualReasonDrafts[item.id]?.reasonDetail ?? ""}
                          onChange={(event) =>
                            setManualReasonDrafts((current) => ({
                              ...current,
                              [item.id]: {
                                reasonCode: current[item.id]?.reasonCode ?? "OWNER_CAPACITY",
                                reasonDetail: event.target.value
                              }
                            }))
                          }
                          placeholder="Reason detail"
                        />
                        <button type="button" onClick={() => void createManualExecutionFollowUp(item, "handoff")}>
                          Needs handoff
                        </button>
                      <button type="button" onClick={() => void createManualExecutionFollowUp(item, "escalate")}>
                        Escalate
                      </button>
                    </div>
                  ) : null}
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
            <div className="subsection">
              <div className="split-header">
                <strong>Monthly schedule shape</strong>
                <span className="muted-text">{portfolioScheduleShape.monthLabel}</span>
              </div>
              <div className="tendering-focus-list tendering-focus-list--activity">
                <div className="tendering-focus-list__item">
                  <strong>{portfolioScheduleShape.summaries.length}</strong>
                  <span>Jobs with shifts this month</span>
                </div>
                <div className="tendering-focus-list__item">
                  <strong>{portfolioScheduleShape.thinlyScheduled}</strong>
                  <span>Thinly scheduled</span>
                </div>
                <div className="tendering-focus-list__item">
                  <strong>{portfolioScheduleShape.clusteredRisk}</strong>
                  <span>Clustered or risky</span>
                </div>
              </div>
                <div className="dashboard-list">
                  {portfolioScheduleShape.summaries.map((job) => (
                    <div key={job.id} className="tendering-focus-list__item">
                      {(() => {
                        const recommendation = getPortfolioScheduleRecommendation(job);

                        return (
                          <>
                            <div className="split-header">
                              <strong>{job.label}</strong>
                              <div className="inline-fields inline-fields--tight">
                                <span
                                  className={
                                    job.blocked > 0 ? "pill pill--red" : job.warning > 0 ? "pill pill--amber" : "pill pill--blue"
                                  }
                                >
                                  {job.blocked > 0 ? "Risk clustered" : job.densestDay >= 2 ? "Front-loaded" : "Distributed"}
                                </span>
                                <span className={recommendation.toneClass}>{recommendation.guidance}</span>
                              </div>
                            </div>
                            <p className="muted-text">
                              {job.activeDays} active days | busiest day {job.densestDay} shifts | {job.blocked} blocked | {job.warning} warning
                            </p>
                            <div className="job-planning-strip">
                              {portfolioScheduleShape.dayKeys.map((dayKey, index) => {
                                const density = job.density.get(dayKey) ?? 0;
                                const toneClass =
                                  job.blocked > 0 && density > 0
                                    ? "job-planning-strip__cell job-planning-strip__cell--red"
                                    : density >= 2
                                      ? "job-planning-strip__cell job-planning-strip__cell--amber"
                                      : density === 1
                                        ? "job-planning-strip__cell job-planning-strip__cell--blue"
                                        : "job-planning-strip__cell";

                                return (
                                  <button
                                    key={`${job.id}-${dayKey}`}
                                    type="button"
                                    className={toneClass}
                                    onClick={() => openJobFromDashboard(job.id)}
                                  >
                                    <strong>{index + 1}</strong>
                                    <span>{density}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="muted-text">{recommendation.detail}</p>
                            {recommendation.target === "watch" ? (
                              <p className="muted-text">Watch only for now. Let the month develop unless a blocker or clustering signal appears.</p>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  recommendation.target === "scheduler" ? openJobInScheduler(job.id) : openJobFromDashboard(job.id)
                                }
                              >
                                {recommendation.label}
                              </button>
                            )}
                          </>
                        );
                      })()}
                  </div>
                ))}
                {!portfolioScheduleShape.summaries.length ? (
                  <p className="muted-text">No jobs have scheduled shifts inside the current month window yet.</p>
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
