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

function getUrgencyPillClass(urgencyLabel?: "Urgent today" | "Due soon" | "Upcoming") {
  if (urgencyLabel === "Urgent today") {
    return "pill pill--red";
  }

  if (urgencyLabel === "Due soon") {
    return "pill pill--amber";
  }

  return "pill pill--blue";
}

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

export function DashboardPlaceholderPage() {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPlanningRecord[]>([]);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [manualReasonDrafts, setManualReasonDrafts] = useState<
    Record<string, { reasonCode: string; reasonDetail: string }>
  >({});

  const load = async () => {
    const [jobsResponse, followUpsResponse, usersResponse] = await Promise.all([
      authFetch("/jobs?page=1&pageSize=50"),
      authFetch("/notifications/follow-ups/shared"),
      authFetch("/users?page=1&pageSize=100")
    ]);

    if (!jobsResponse.ok || !followUpsResponse.ok || !usersResponse.ok) {
      setJobs([]);
      setSharedFollowUps([]);
      setAssignableUsers([]);
      return;
    }

    const jobsData = await jobsResponse.json();
    const followUpsData = await followUpsResponse.json();
    const usersData = await usersResponse.json();
    setJobs(jobsData.items);
    setSharedFollowUps(followUpsData);
    setAssignableUsers(usersData.items.filter((item: AssignableUser) => item.isActive));
  };

  useEffect(() => {
    void load();
  }, [authFetch]);

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
      .filter((item) => item.metadata?.kind === "LIVE_FOLLOW_UP" || item.metadata?.kind === "MANUAL_FOLLOW_UP")
      .map((item) => ({
        ...item,
        audienceLabel:
          (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? "Assigned to me" : "Team follow-up",
        urgencyLabel: item.metadata?.urgencyLabel ?? "Upcoming"
      }))
      .sort((left, right) => getSharedFollowUpSortScore(left, user?.id) - getSharedFollowUpSortScore(right, user?.id));

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

    const monthAnchor = startOfMonth(new Date());
    const nextMonth = addMonths(monthAnchor, 1);
    const lastDay = new Date(nextMonth.getTime() - 1).getDate();
    const dayKeys = Array.from({ length: lastDay }, (_, index) =>
      formatMonthDayKey(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), index + 1))
    );
    const scheduleShape = summaries
      .map((job) => {
        const sourceJob = jobs.find((entry) => entry.id === job.id);
        const shifts =
          sourceJob?.stages?.flatMap((stage) =>
            stage.activities.flatMap((activity) =>
              activity.shifts
                .filter((shift) => {
                  if (!shift.startAt) return false;
                  const start = new Date(shift.startAt);
                  return start >= monthAnchor && start < nextMonth;
                })
                .map((shift) => ({
                  ...shift,
                  stageName: stage.name,
                  activityName: activity.name
                }))
            )
          ) ?? [];

        const density = new Map<string, number>();
        shifts.forEach((shift) => {
          if (!shift.startAt) return;
          const key = formatMonthDayKey(new Date(shift.startAt));
          density.set(key, (density.get(key) ?? 0) + 1);
        });

        return {
          id: job.id,
          label: job.label,
          blocked: job.blocked,
          warning: job.warning,
          activeDays: density.size,
          densestDay: Math.max(...density.values(), 0),
          density
        };
      })
      .filter((job) => job.activeDays > 0)
      .sort((left, right) => right.densestDay + right.blocked * 3 - (left.densestDay + left.blocked * 3))
      .slice(0, 4);

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
        .slice(0, 4),
      scheduleShapeMonth: monthAnchor.toLocaleDateString([], { month: "long", year: "numeric" }),
      scheduleShapeDayKeys: dayKeys,
      scheduleShape
    };
    }, [jobs, sharedFollowUps, sharedFollowUpsByPrompt, user?.id]);

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

  const openSchedulerForJob = (jobId: string) => {
    navigate("/scheduler", {
      state: {
        plannerFocus: {
          jobId
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
                {(() => {
                  const stateLabel = getFollowUpStateLabel(item);
                  return (
                    <>
                <div className="split-header">
                  <strong>{item.title}</strong>
                  <span className={getUrgencyPillClass(item.urgencyLabel)}>{item.urgencyLabel}</span>
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
                      value={
                        manualReasonDrafts[item.id]?.reasonCode ??
                        "OWNER_CAPACITY"
                      }
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

        <AppCard title="Monthly Schedule Shape" subtitle="Quick portfolio read on how work is distributed this month">
          <div className="stack-grid">
            <div className="split-header">
              <strong>{homeSignals.scheduleShapeMonth}</strong>
              <span className="muted-text">Thin scheduling and clustered load stand out here before you open the full planner.</span>
            </div>
            <div className="dashboard-list">
                {homeSignals.scheduleShape.map((job) => (
                  <div key={job.id} className="tendering-focus-list__item">
                    {(() => {
                      const recommendation = getPortfolioScheduleRecommendation(job);

                      return (
                        <>
                          <div className="split-header">
                            <strong>{job.label}</strong>
                            <div className="inline-fields inline-fields--tight">
                              <span
                                className={job.blocked > 0 ? "pill pill--red" : job.densestDay >= 2 ? "pill pill--amber" : "pill pill--blue"}
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
                            {homeSignals.scheduleShapeDayKeys.map((dayKey, index) => {
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
                                recommendation.target === "scheduler"
                                  ? openSchedulerForJob(job.id)
                                  : navigate("/jobs", {
                                      state: {
                                        jobFocus: {
                                          jobId: job.id,
                                          from: "overview"
                                        }
                                      }
                                    })
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
              {!homeSignals.scheduleShape.length ? (
                <p className="muted-text">No jobs have scheduled shifts inside the current month window yet.</p>
              ) : null}
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
