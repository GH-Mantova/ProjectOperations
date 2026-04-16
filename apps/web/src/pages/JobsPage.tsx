import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
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
    activityId?: string | null;
    nextOwnerId?: string | null;
    nextOwnerLabel?: string | null;
    manualType?: "HANDOFF" | "ESCALATION";
    reasonCode?: string;
    reasonDetail?: string | null;
    outcomeCode?:
      | "UNBLOCKED"
      | "WAITING_EXTERNAL"
      | "REASSIGNED"
      | "WATCH_CONTINUES"
      | "ACCEPTED_HANDOFF"
      | "ACCEPTED_ESCALATION"
      | null;
    resolutionNote?: string | null;
    assignmentMode?: "DERIVED" | "MANUAL";
    assignedByLabel?: string | null;
    assignedAt?: string | null;
  } | null;
};

type SiteOption = {
  id: string;
  name: string;
};

type JobRecord = {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  client: { name: string };
  site?: { name: string } | null;
  sourceTender?: {
    tenderNumber: string;
    title: string;
    status: string;
    dueDate?: string | null;
    estimatedValue?: string | number | null;
    probability?: number | null;
    estimator?: { firstName: string; lastName: string } | null;
  } | null;
  projectManager?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  supervisor?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  conversion?: {
    carriedDocuments: boolean;
    tenderClient: {
      client: { name: string };
      contact?: { name: string; email?: string | null; phone?: string | null } | null;
      relationshipType?: string | null;
      notes?: string | null;
    };
  } | null;
  documents?: Array<{
    id: string;
    title: string;
    category: string;
    versionLabel?: string | null;
    fileLink?: { webUrl: string; name: string } | null;
  }>;
  stages?: Array<{
    id: string;
    name: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    activities: Array<{
      id: string;
      name: string;
      status: string;
      plannedDate?: string | null;
      owner?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
      shifts: Array<{
        id: string;
        title: string;
        status: string;
        startAt: string;
        endAt: string;
        lead?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
        conflicts: Array<{
          id: string;
          severity: string;
          code: string;
          message: string;
        }>;
      }>;
    }>;
  }>;
  issues?: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
  variations?: Array<{
    id: string;
    reference: string;
    title: string;
    status: string;
    amount?: string | null;
  }>;
  progressEntries?: Array<{
    id: string;
    entryType: string;
    entryDate: string;
    summary: string;
    percentComplete?: number | null;
  }>;
  statusHistory?: Array<{
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    note?: string | null;
    changedAt: string;
  }>;
  closeout?: {
    id: string;
    status: string;
    summary?: string | null;
    archivedAt?: string | null;
    readOnlyFrom?: string | null;
  } | null;
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not set";
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  const amount = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(amount)) {
    return "Not set";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(amount);
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

function getPillClass(status: string) {
  if (status.includes("COMPLETE") || status.includes("CLOSED")) {
    return "pill pill--green";
  }

  if (status.includes("HOLD") || status.includes("ARCHIVED")) {
    return "pill pill--amber";
  }

  if (status.includes("OPEN") || status.includes("HIGH")) {
    return "pill pill--red";
  }

  return "pill pill--blue";
}

function getCoordinationOutcomeLabel(summary: string) {
  if (summary.startsWith("Execution escalation accepted")) {
    return {
      title: "Escalation accepted",
      pillClass: "pill pill--red"
    };
  }

  if (summary.startsWith("Execution handoff accepted")) {
    return {
      title: "Handoff accepted",
      pillClass: "pill pill--amber"
    };
  }

  if (summary.startsWith("Execution escalation resolved")) {
    return {
      title: "Escalation outcome",
      pillClass: "pill pill--red"
    };
  }

  if (summary.startsWith("Execution handoff resolved")) {
    return {
      title: "Handoff outcome",
      pillClass: "pill pill--amber"
    };
  }

  return null;
}

export function JobsPage() {
  const { authFetch, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const [followUpAssignmentDrafts, setFollowUpAssignmentDrafts] = useState<Record<string, string>>({});
  const [manualResolutionDrafts, setManualResolutionDrafts] = useState<
    Record<string, { outcomeCode: "UNBLOCKED" | "WAITING_EXTERNAL" | "REASSIGNED" | "WATCH_CONTINUES"; resolutionNote: string }>
  >({});
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState({ status: "ACTIVE", note: "" });
  const [ownershipForm, setOwnershipForm] = useState({ projectManagerId: "", supervisorId: "" });
  const [stageForm, setStageForm] = useState({ name: "", description: "", status: "PLANNED" });
  const [activityForm, setActivityForm] = useState({ jobStageId: "", name: "", status: "PLANNED", ownerUserId: "" });
  const [issueForm, setIssueForm] = useState({ title: "", severity: "MEDIUM", status: "OPEN" });
  const [variationForm, setVariationForm] = useState({ reference: "", title: "", status: "PROPOSED", amount: "" });
  const [progressForm, setProgressForm] = useState({ entryType: "DAILY_NOTE", entryDate: "", summary: "", percentComplete: "" });
  const [archiveJobs, setArchiveJobs] = useState<JobRecord[]>([]);
  const [closeoutForm, setCloseoutForm] = useState({
    status: "ARCHIVED",
    summary: "",
    checklistNotes: "Drawings uploaded; final report issued; compliance records complete."
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [workFilter, setWorkFilter] = useState<"ALL" | "MY_ACTIVITIES">("ALL");
  const [focusedActivityStatus, setFocusedActivityStatus] = useState("PLANNED");
  const [focusedActivityOwnerId, setFocusedActivityOwnerId] = useState("");
  const [focusedProgressSummary, setFocusedProgressSummary] = useState("");
  const jobFocus = (location.state as {
    jobFocus?: {
      jobId?: string;
      stageId?: string;
      activityId?: string;
      shiftId?: string;
      from?: string;
    };
  } | null)?.jobFocus;

  const selectJob = async (id: string) => {
    const response = await authFetch(`/jobs/${id}`);
    if (!response.ok) return;
    setSelectedJob(await response.json());
  };

  const loadSharedFollowUps = async () => {
    const response = await authFetch("/notifications/follow-ups/shared");
    if (!response.ok) {
      setSharedFollowUps([]);
      return;
    }

    setSharedFollowUps(await response.json());
  };

  useEffect(() => {
    Promise.all([
      authFetch("/jobs?page=1&pageSize=50"),
      authFetch("/users?page=1&pageSize=100"),
      authFetch("/master-data/sites?page=1&pageSize=100"),
      authFetch("/notifications/follow-ups/shared")
    ])
      .then(async ([jobsResponse, usersResponse, sitesResponse, followUpsResponse]) => {
        if (!jobsResponse.ok || !usersResponse.ok || !sitesResponse.ok) {
          throw new Error("Unable to load jobs.");
        }

        const jobsData = await jobsResponse.json();
        const usersData = await usersResponse.json();
        const sitesData = await sitesResponse.json();
        setJobs(jobsData.items);
        setUsers(usersData.items);
        setSites(sitesData.items);
        if (followUpsResponse.ok) {
          setSharedFollowUps(await followUpsResponse.json());
        }
        const archiveResponse = await authFetch("/jobs/archive?page=1&pageSize=50");
        if (archiveResponse.ok) {
          const archiveData = await archiveResponse.json();
          setArchiveJobs(archiveData.items);
        }

        if (jobsData.items[0]) {
          await selectJob(jobsData.items[0].id);
        }
      })
      .catch((loadError) => setError((loadError as Error).message));
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    setStatusForm((current) => ({
      ...current,
      status: selectedJob.status
    }));
    setOwnershipForm({
      projectManagerId: selectedJob.projectManager?.id ?? "",
      supervisorId: selectedJob.supervisor?.id ?? ""
    });
  }, [selectedJob]);

  useEffect(() => {
    if (!jobFocus?.jobId || !jobs.length) return;
    if (selectedJob?.id === jobFocus.jobId) return;
    void selectJob(jobFocus.jobId);
  }, [jobFocus?.jobId, jobs, selectedJob?.id]);

  useEffect(() => {
    setFollowUpAssignmentDrafts((current) => {
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

  useEffect(() => {
    setManualResolutionDrafts((current) => {
      const next = { ...current };
      for (const item of sharedFollowUps) {
        if (item.metadata?.kind === "MANUAL_FOLLOW_UP" && !next[item.id]) {
          next[item.id] = {
            outcomeCode: "UNBLOCKED",
            resolutionNote: ""
          };
        }
      }
      return next;
    });
  }, [sharedFollowUps]);

  const reloadJobs = async (focusJobId?: string) => {
    const response = await authFetch("/jobs?page=1&pageSize=50");
    if (!response.ok) {
      setError("Unable to refresh jobs.");
      return;
    }

    const data = await response.json();
    setJobs(data.items);
    const archiveResponse = await authFetch("/jobs/archive?page=1&pageSize=50");
    if (archiveResponse.ok) {
      const archiveData = await archiveResponse.json();
      setArchiveJobs(archiveData.items);
    }
    const targetId = focusJobId ?? selectedJob?.id ?? data.items[0]?.id;
    if (targetId) {
      await selectJob(targetId);
    }
  };

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

  const updateFollowUpAssignment = async (promptKey: string) => {
    const sharedItem = sharedFollowUpsByPrompt.get(promptKey);
    const targetUserId = followUpAssignmentDrafts[promptKey];
    if (!sharedItem || !targetUserId) {
      return;
    }

    const assignee = users.find((item) => item.id === targetUserId);
    await authFetch(`/notifications/follow-ups/${sharedItem.id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({
        userId: targetUserId,
        userLabel: assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : undefined
      })
    });

    await loadSharedFollowUps();
  };

  const resolveManualFollowUp = async (item: SharedFollowUpItem) => {
    const resolution = manualResolutionDrafts[item.id] ?? {
      outcomeCode: "UNBLOCKED" as const,
      resolutionNote: ""
    };

    await authFetch(`/notifications/follow-ups/${item.id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({
        outcomeCode: resolution.outcomeCode,
        resolutionNote: resolution.resolutionNote || undefined
      })
    });

    if (selectedJob && focusedDeliveryContext?.activity) {
      const activityLabel = focusedDeliveryContext.activity.name;
      const outcomeLabel = resolution.outcomeCode.replaceAll("_", " ").toLowerCase();
      await submitToJob(`/jobs/${selectedJob.id}/progress-entries`, {
        entryType: "DAILY_NOTE",
        entryDate: new Date().toISOString().slice(0, 10),
        summary: `${
          item.metadata?.manualType === "ESCALATION" ? "Execution escalation" : "Execution handoff"
        } resolved for ${activityLabel}: ${outcomeLabel}${resolution.resolutionNote ? ` - ${resolution.resolutionNote}` : ""}`
      });
    }

    await loadSharedFollowUps();
  };

  const acceptManualHandoff = async (item: SharedFollowUpItem) => {
    await authFetch(`/notifications/follow-ups/${item.id}/accept-handoff`, {
      method: "PATCH"
    });

    await loadSharedFollowUps();
    await reloadJobs(selectedJob?.id);
  };

  const acceptManualEscalation = async (item: SharedFollowUpItem) => {
    await authFetch(`/notifications/follow-ups/${item.id}/accept-escalation`, {
      method: "PATCH"
    });

    if (selectedJob && focusedDeliveryContext?.activity) {
      await submitToJob(`/jobs/${selectedJob.id}/progress-entries`, {
        entryType: "DAILY_NOTE",
        entryDate: new Date().toISOString().slice(0, 10),
        summary: `Execution escalation accepted for ${focusedDeliveryContext.activity.name}: ownership claimed by ${
          user ? `${user.firstName} ${user.lastName}` : "current user"
        }.`
      });
    }

    await loadSharedFollowUps();
    await reloadJobs(selectedJob?.id);
  };

  const renderFollowUpAssignment = (promptKey: string, emptyStateLabel: string) => {
    const sharedItem = sharedFollowUpsByPrompt.get(promptKey);

    if (!sharedItem) {
      return <p className="muted-text">{emptyStateLabel}</p>;
    }

    return (
      <>
        <div className="inline-fields">
          <span className={`pill ${sharedItem.metadata?.assignmentMode === "MANUAL" ? "pill--blue" : "pill--slate"}`}>
            {sharedItem.metadata?.assignmentMode === "MANUAL" ? "Manual assignment" : "Derived owner"}
          </span>
          <span className="pill pill--slate">{sharedItem.metadata?.nextOwnerLabel ?? "Team owner"}</span>
          {sharedItem.metadata?.assignedByLabel ? (
            <span className="muted-text">
              reassigned by {sharedItem.metadata.assignedByLabel}
              {sharedItem.metadata.assignedAt ? ` on ${formatDateTime(sharedItem.metadata.assignedAt)}` : ""}
            </span>
          ) : null}
        </div>
        <div className="inline-fields">
          <select
            value={followUpAssignmentDrafts[promptKey] ?? sharedItem.metadata?.nextOwnerId ?? sharedItem.userId}
            onChange={(event) =>
              setFollowUpAssignmentDrafts((current) => ({
                ...current,
                [promptKey]: event.target.value
              }))
            }
          >
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.firstName} {item.lastName}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void updateFollowUpAssignment(promptKey)}>
            Reassign owner
          </button>
        </div>
      </>
    );
  };

  const submitToJob = async (path: string, body: Record<string, unknown>) => {
    if (!selectedJob) return;

    const response = await authFetch(path, {
      method: path.includes("/status") || path.includes("/issues/") || path.includes("/stages/") || path.includes("/activities/") || path.includes("/variations/") ? "PATCH" : path === `/jobs/${selectedJob.id}` ? "PATCH" : "POST",
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      setError(errorBody?.message ?? "Unable to save job update.");
      return;
    }

    await reloadJobs(selectedJob.id);
  };

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch = query
        ? [
            job.jobNumber,
            job.name,
            job.client.name,
            job.projectManager ? `${job.projectManager.firstName} ${job.projectManager.lastName}` : "",
            job.supervisor ? `${job.supervisor.firstName} ${job.supervisor.lastName}` : ""
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        : true;
      const matchesStatus = statusFilter === "ALL" || job.status === statusFilter;
      const matchesWorkFilter =
        workFilter === "ALL" ||
        Boolean(
          user?.id &&
            job.stages?.some((stage) =>
              stage.activities.some((activity) => activity.owner?.id === user.id)
            )
        );
      return matchesSearch && matchesStatus && matchesWorkFilter;
    });
  }, [jobs, search, statusFilter, user?.id, workFilter]);

  const jobRegisterHealth = useMemo(
    () =>
      new Map(
        jobs.map((job) => {
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

          let tone: "green" | "amber" | "blue" | "red" = "green";
          let label = "Ready";

          if (blocked > 0) {
            tone = "red";
            label = "Blocked";
          } else if (warning > 0 || unscheduled > 0) {
            tone = "amber";
            label = warning > 0 ? "Warning" : "Needs planning";
          } else if (!shifts.length) {
            tone = "blue";
            label = "No shifts yet";
          }

          return [
            job.id,
            {
              blocked,
              warning,
              unscheduled,
              shiftCount: shifts.length,
              tone,
              label
            }
          ];
        })
      ),
    [jobs]
  );

  const visibleJobs = filteredJobs.slice(0, 10);
  const myActivityJobCount = useMemo(
    () =>
      user?.id
        ? jobs.filter((job) =>
            job.stages?.some((stage) => stage.activities.some((activity) => activity.owner?.id === user.id))
          ).length
        : 0,
    [jobs, user?.id]
  );
  const stageMetrics = useMemo(() => {
    const stages = selectedJob?.stages ?? [];
    const activities = stages.flatMap((stage) => stage.activities ?? []);
    return {
      stageCount: stages.length,
      activeStages: stages.filter((stage) => stage.status === "ACTIVE").length,
      completeStages: stages.filter((stage) => stage.status === "COMPLETE").length,
      activityCount: activities.length,
      plannedActivities: activities.filter((activity) => activity.status === "PLANNED").length,
      activeActivities: activities.filter((activity) => activity.status === "ACTIVE").length
    };
  }, [selectedJob]);

  const issueMetrics = useMemo(() => {
    const issues = selectedJob?.issues ?? [];
    const variations = selectedJob?.variations ?? [];
    const variationAmount = variations.reduce((sum, variation) => {
      const amount = variation.amount ? Number(variation.amount) : 0;
      return Number.isNaN(amount) ? sum : sum + amount;
    }, 0);

    return {
      openIssues: issues.filter((issue) => issue.status === "OPEN").length,
      highSeverityIssues: issues.filter((issue) => issue.severity === "HIGH").length,
      variationCount: variations.length,
      approvedVariations: variations.filter((variation) => variation.status === "APPROVED").length,
      variationAmount
    };
  }, [selectedJob]);

  const progressMetrics = useMemo(() => {
    const progressEntries = selectedJob?.progressEntries ?? [];
    const latestProgress = progressEntries.find((entry) => entry.entryType === "PROGRESS");
    const recentHistory = (selectedJob?.statusHistory ?? []).slice(0, 3);

    return {
      entryCount: progressEntries.length,
      latestPercent: latestProgress?.percentComplete ?? null,
      latestEntryDate: progressEntries[0]?.entryDate ?? null,
      recentHistory
    };
  }, [selectedJob]);

  const schedulingMetrics = useMemo(() => {
    const activities =
      selectedJob?.stages?.flatMap((stage) =>
        stage.activities.map((activity) => ({
          stageId: stage.id,
          stageName: stage.name,
          ...activity
        }))
      ) ?? [];
    const shifts = activities.flatMap((activity) =>
      activity.shifts.map((shift) => ({
        ...shift,
        activityId: activity.id,
        activityName: activity.name,
        stageId: activity.stageId,
        stageName: activity.stageName
      }))
    );
    const upcomingShifts = [...shifts]
      .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
      .slice(0, 4);

    return {
      activityCount: activities.length,
      unscheduledActivities: activities.filter((activity) => activity.shifts.length === 0).length,
      shiftCount: shifts.length,
      allShifts: shifts,
      readyShifts: shifts.filter((shift) => shift.conflicts.length === 0).length,
      blockedShifts: shifts.filter((shift) => shift.conflicts.some((conflict) => conflict.severity === "RED"))
        .length,
      warningShifts: shifts.filter(
        (shift) =>
          !shift.conflicts.some((conflict) => conflict.severity === "RED") &&
          shift.conflicts.some((conflict) => conflict.severity === "AMBER")
      ).length,
      upcomingShifts
    };
  }, [selectedJob]);

  const planningSnapshot = useMemo(() => {
    const monthAnchor = startOfMonth(new Date());
    const nextMonth = addMonths(monthAnchor, 1);
    const lastDay = new Date(nextMonth.getTime() - 1).getDate();
    const monthDays = Array.from({ length: lastDay }, (_, index) => {
      const day = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), index + 1);
      return {
        key: formatMonthDayKey(day),
        date: day,
        dayNumber: index + 1,
        shortLabel: day.toLocaleDateString([], { weekday: "short" })
      };
    });

    const shiftsInMonth = schedulingMetrics.allShifts.filter((shift) => {
      const start = new Date(shift.startAt);
      return start >= monthAnchor && start < nextMonth;
    });

    const matrixCells = new Map<
      string,
      {
        shifts: typeof schedulingMetrics.allShifts;
        blocked: boolean;
        warning: boolean;
      }
    >();

    shiftsInMonth.forEach((shift) => {
      const key = formatMonthDayKey(new Date(shift.startAt));
      const existing = matrixCells.get(key) ?? { shifts: [], blocked: false, warning: false };
      existing.shifts.push(shift);
      existing.blocked ||= shift.conflicts.some((conflict) => conflict.severity === "RED");
      existing.warning ||= shift.conflicts.some((conflict) => conflict.severity === "AMBER");
      matrixCells.set(key, existing);
    });

    const stageRows =
      selectedJob?.stages
        ?.map((stage) => {
          const stageShifts = stage.activities.flatMap((activity) =>
            activity.shifts
              .filter((shift) => {
                const start = new Date(shift.startAt);
                return start >= monthAnchor && start < nextMonth;
              })
              .map((shift) => ({ shift, activity }))
          );

          if (!stageShifts.length) {
            return null;
          }

          const sorted = [...stageShifts].sort(
            (left, right) => new Date(left.shift.startAt).getTime() - new Date(right.shift.startAt).getTime()
          );
          const startDay = new Date(sorted[0].shift.startAt).getDate();
          const endDay = new Date(sorted[sorted.length - 1].shift.endAt).getDate();
          const blocked = sorted.some(({ shift }) => shift.conflicts.some((conflict) => conflict.severity === "RED"));
          const warning =
            !blocked && sorted.some(({ shift }) => shift.conflicts.some((conflict) => conflict.severity === "AMBER"));

          return {
            id: stage.id,
            name: stage.name,
            shiftCount: sorted.length,
            startDay,
            spanDays: Math.max(endDay - startDay + 1, 1),
            tone: blocked ? "red" : warning ? "amber" : "blue",
            firstShiftId: sorted[0].shift.id,
            firstActivityId: sorted[0].activity.id
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)) ?? [];

    return {
      monthLabel: monthAnchor.toLocaleDateString([], { month: "long", year: "numeric" }),
      monthDays,
      matrixCells,
      stageRows
    };
  }, [schedulingMetrics.allShifts, selectedJob]);

  const planningBlockers = useMemo(() => {
    const blockedItems = schedulingMetrics.allShifts.flatMap((shift) =>
      shift.conflicts
        .filter((conflict) => conflict.severity === "RED")
        .map((conflict) => ({
          shiftId: shift.id,
          shiftTitle: shift.title,
          stageId: shift.stageId,
          stageName: shift.stageName,
          activityId: shift.activityId,
          activityName: shift.activityName,
          startAt: shift.startAt,
          severity: conflict.severity,
          code: conflict.code,
          message: conflict.message
        }))
    );
    const warningItems = schedulingMetrics.allShifts.flatMap((shift) =>
      shift.conflicts
        .filter((conflict) => conflict.severity === "AMBER")
        .map((conflict) => ({
          shiftId: shift.id,
          shiftTitle: shift.title,
          stageId: shift.stageId,
          stageName: shift.stageName,
          activityId: shift.activityId,
          activityName: shift.activityName,
          startAt: shift.startAt,
          severity: conflict.severity,
          code: conflict.code,
          message: conflict.message
        }))
    );

    return {
      blockedItems,
      warningItems,
      topSignals: [...blockedItems, ...warningItems]
        .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
        .slice(0, 5)
    };
  }, [schedulingMetrics]);

  const unscheduledActivities = useMemo(
    () =>
      selectedJob?.stages?.flatMap((stage) =>
        stage.activities
          .filter((activity) => activity.shifts.length === 0)
          .map((activity) => ({
            stageId: stage.id,
            stageName: stage.name,
            activityId: activity.id,
            activityName: activity.name
          }))
      ) ?? [],
    [selectedJob]
  );

  const focusedDeliveryContext = useMemo(() => {
    if (!selectedJob || !jobFocus) return null;

    const stage = selectedJob.stages?.find((item) => item.id === jobFocus.stageId) ?? null;
    const activity = stage?.activities.find((item) => item.id === jobFocus.activityId) ?? null;
    const shift = activity?.shifts.find((item) => item.id === jobFocus.shiftId) ?? null;

    return { stage, activity, shift, from: jobFocus.from };
  }, [jobFocus, selectedJob]);

  const focusedManualFollowUps = useMemo(() => {
    if (!selectedJob || !focusedDeliveryContext?.activity) {
      return [];
    }

    return sharedFollowUps
      .filter(
        (item) =>
          item.metadata?.kind === "MANUAL_FOLLOW_UP" &&
          item.metadata?.jobId === selectedJob.id &&
          item.metadata?.activityId === focusedDeliveryContext.activity?.id
      )
      .sort((left, right) => {
        const leftTime = new Date(left.metadata?.assignedAt ?? 0).getTime();
        const rightTime = new Date(right.metadata?.assignedAt ?? 0).getTime();
        return rightTime - leftTime;
      });
  }, [focusedDeliveryContext?.activity, selectedJob, sharedFollowUps]);

  const focusedRecommendations = useMemo(() => {
    if (!focusedDeliveryContext?.activity) {
      return [];
    }

    const shift = focusedDeliveryContext.shift;
    const hasBlockingConflicts = shift?.conflicts.some((conflict) => conflict.severity === "RED") ?? false;
    const hasWarnings = shift?.conflicts.some((conflict) => conflict.severity === "AMBER") ?? false;
    const latestProgressPercent = progressMetrics.latestPercent;
    const recommendations: Array<{
      id: string;
      title: string;
      description: string;
      actionLabel: string;
      tone: "green" | "amber" | "blue";
    }> = [];

    if (hasBlockingConflicts && shift) {
      recommendations.push({
        id: "return-to-scheduler",
        title: "Resolve the blocked shift first",
        description: "The selected shift still has a hard planner blocker. Reopen it in Scheduler before changing delivery status.",
        actionLabel: "Back to Scheduler",
        tone: "amber"
      });
    }

    if (!hasBlockingConflicts && focusedDeliveryContext.activity.status === "PLANNED") {
      recommendations.push({
        id: "mark-active",
        title: "Mark the activity Active",
        description: "Planning is clear enough to move this delivery activity out of Planned and into active execution.",
        actionLabel: "Use active status",
        tone: "green"
      });
    }

    if (!hasBlockingConflicts && (latestProgressPercent === null || latestProgressPercent === undefined)) {
      recommendations.push({
        id: "log-first-progress",
        title: "Capture the first delivery update",
        description: "A quick first-site or first-shift note will help delivery leads and planners stay aligned on what changed.",
        actionLabel: "Prefill note",
        tone: "blue"
      });
    }

    if (!hasBlockingConflicts && hasWarnings) {
      recommendations.push({
        id: "log-watchpoints",
        title: "Record remaining watchpoints",
        description: "The shift is workable but still carries warnings. Capture the watchpoints in a short follow-up note for delivery visibility.",
        actionLabel: "Prefill watchpoints",
        tone: "amber"
      });
    }

    return recommendations.slice(0, 3);
  }, [focusedDeliveryContext, progressMetrics.latestPercent]);

  useEffect(() => {
    if (!focusedDeliveryContext?.activity) {
      setFocusedActivityStatus("PLANNED");
      setFocusedActivityOwnerId("");
      setFocusedProgressSummary("");
      return;
    }

    setFocusedActivityStatus(focusedDeliveryContext.activity.status);
    setFocusedActivityOwnerId(focusedDeliveryContext.activity.owner?.id ?? "");
    setFocusedProgressSummary(
      focusedDeliveryContext.shift
        ? `Planner follow-up for ${focusedDeliveryContext.shift.title}: `
        : `Planner follow-up for ${focusedDeliveryContext.activity.name}: `
    );
  }, [focusedDeliveryContext]);

  const openSchedulerForActivity = (stageId: string, activityId: string, activityName: string) => {
    if (!selectedJob) return;

    navigate("/scheduler", {
      state: {
        plannerFocus: {
          jobId: selectedJob.id,
          stageId,
          activityId
        },
        prefillShift: {
          jobId: selectedJob.id,
          jobStageId: stageId,
          jobActivityId: activityId,
          title: activityName
        }
      }
    });
  };

  const saveOwnership = async () => {
    if (!selectedJob) return;

    const response = await authFetch(`/jobs/${selectedJob.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        projectManagerId: ownershipForm.projectManagerId || undefined,
        supervisorId: ownershipForm.supervisorId || undefined
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to update job ownership.");
      return;
    }

    await reloadJobs(selectedJob.id);
    await loadSharedFollowUps();
  };

  const openSchedulerForShift = (stageId: string, activityId: string, shiftId: string) => {
    if (!selectedJob) return;

    navigate("/scheduler", {
      state: {
        plannerFocus: {
          jobId: selectedJob.id,
          stageId,
          activityId,
          shiftId
        }
      }
    });
  };

  const openDocumentsForJob = () => {
    if (!selectedJob) return;

    navigate("/documents", {
      state: {
        documentFocus: {
          linkedEntityType: "Job",
          linkedEntityId: selectedJob.id,
          from: "jobs",
          title: `${selectedJob.jobNumber} - ${selectedJob.name}`
        }
      }
    });
  };

  const applyFocusedRecommendation = (recommendationId: string) => {
    if (!focusedDeliveryContext?.activity) return;

    if (recommendationId === "return-to-scheduler" && focusedDeliveryContext.shift && focusedDeliveryContext.stage) {
      openSchedulerForShift(
        focusedDeliveryContext.stage.id,
        focusedDeliveryContext.activity.id,
        focusedDeliveryContext.shift.id
      );
      return;
    }

    if (recommendationId === "mark-active") {
      setFocusedActivityStatus("ACTIVE");
      return;
    }

    if (recommendationId === "log-first-progress") {
      setFocusedProgressSummary(
        focusedDeliveryContext.shift
          ? `First delivery update after planner clearance for ${focusedDeliveryContext.shift.title}: `
          : `First delivery update for ${focusedDeliveryContext.activity.name}: `
      );
      return;
    }

    if (recommendationId === "log-watchpoints") {
      setFocusedProgressSummary(
        focusedDeliveryContext.shift
          ? `Watchpoints remaining on ${focusedDeliveryContext.shift.title}: `
          : `Watchpoints remaining for ${focusedDeliveryContext.activity.name}: `
      );
    }
  };

  return (
    <div className="crm-page crm-page--operations">
      <div className="crm-page__sidebar">
        <AppCard title="Job Register" subtitle="Tender-converted jobs ready for delivery planning">
          {error ? <p className="error-text">{error}</p> : null}
          <div className="stack-grid">
            <div className="subsection">
              <div className="compact-filter-grid">
                <label>
                  Search jobs
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, client, PM, or supervisor" />
                </label>
                <label>
                  Status
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="ALL">All statuses</option>
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On hold</option>
                    <option value="COMPLETE">Complete</option>
                  </select>
                </label>
              </div>
              <div className="tab-row">
                <button
                  type="button"
                  className={workFilter === "ALL" ? "tab-button tab-button--active" : "tab-button"}
                  onClick={() => setWorkFilter("ALL")}
                >
                  All jobs
                </button>
                <button
                  type="button"
                  className={workFilter === "MY_ACTIVITIES" ? "tab-button tab-button--active" : "tab-button"}
                  onClick={() => setWorkFilter("MY_ACTIVITIES")}
                >
                  My activities
                </button>
              </div>
              <div className="inline-fields">
                <span className="pill pill--blue">{filteredJobs.length} matching jobs</span>
                {user ? <span className="pill pill--slate">{myActivityJobCount} jobs with my activities</span> : null}
                <span className="muted-text">Showing the first 10 with a dedicated register scroll.</span>
              </div>
            </div>

            <div className="table-shell table-shell--capped">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Planning health</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job) => {
                    const health = jobRegisterHealth.get(job.id);
                    return (
                      <tr key={job.id} onClick={() => selectJob(job.id)}>
                        <td>{job.jobNumber} - {job.name}</td>
                        <td>{job.client.name}</td>
                        <td>{job.status}</td>
                        <td>
                          {health ? (
                            <div className="stack-grid">
                              <span className={`pill pill--${health.tone}`}>{health.label}</span>
                              <span className="muted-text">
                                {health.blocked} blocked | {health.warning} warning | {health.unscheduled} unscheduled
                              </span>
                            </div>
                          ) : (
                            <span className="muted-text">No planning signal</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visibleJobs.length ? <p className="muted-text">No jobs match the current filters.</p> : null}
            </div>
          </div>
        </AppCard>

        <AppCard title="Archive" subtitle="Historical read-only jobs preserved for reporting and audit visibility">
          <div className="dashboard-list dashboard-list--capped">
            {archiveJobs.map((job) => (
              <div key={job.id} className="resource-card">
                <div className="split-header">
                  <div>
                    <strong>{job.jobNumber} - {job.name}</strong>
                    <p className="muted-text">{job.client.name}</p>
                  </div>
                  <span className="pill pill--amber">{job.closeout?.status ?? job.status}</span>
                </div>
                <p className="muted-text">
                  Archived: {job.closeout?.archivedAt ? new Date(job.closeout.archivedAt).toLocaleString() : "Not archived"}
                </p>
                <p className="muted-text">{job.closeout?.summary ?? "No closeout summary recorded."}</p>
              </div>
            ))}
            {archiveJobs.length === 0 ? <p className="muted-text">No archived jobs yet.</p> : null}
          </div>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Job Detail" subtitle="Module 7 foundation for downstream jobs and delivery">
        {selectedJob ? (
          <div className="dashboard-preview">
            <div className="split-header">
              <div>
                <h3>{selectedJob.jobNumber} - {selectedJob.name}</h3>
                <p className="muted-text">
                  {selectedJob.client.name} | {selectedJob.site?.name ?? "Site unassigned"}
                </p>
              </div>
              <span className={`pill ${selectedJob.closeout?.readOnlyFrom ? "pill--amber" : "pill--green"}`}>
                {selectedJob.closeout?.status ?? selectedJob.status}
              </span>
            </div>

            <div className="tendering-dashboard-band">
              <div className="tendering-dashboard-band__intro">
                <span className="eyebrow">Delivery handover</span>
                <h3>Commercial context carried forward from Tendering</h3>
                <p>
                  This job now carries its source tender, awarded relationship, and conversion signal into delivery so teams do not restart from a blank operational workspace.
                </p>
              </div>
              <div className="tendering-dashboard-band__stats">
                <article className="tendering-stat-card">
                  <strong>{selectedJob.sourceTender?.tenderNumber ?? "No source tender"}</strong>
                  <span>Source tender</span>
                </article>
                <article className="tendering-stat-card">
                  <strong>{formatCurrency(selectedJob.sourceTender?.estimatedValue)}</strong>
                  <span>Estimated value</span>
                </article>
                <article className="tendering-stat-card">
                  <strong>
                    {selectedJob.sourceTender?.probability !== null && selectedJob.sourceTender?.probability !== undefined
                      ? `${selectedJob.sourceTender.probability}%`
                      : "Not set"}
                  </strong>
                  <span>Win confidence</span>
                </article>
                <article className="tendering-stat-card">
                  <strong>{selectedJob.conversion?.carriedDocuments ? "Included" : "Not carried"}</strong>
                  <span>Carried documents</span>
                </article>
              </div>
            </div>

            <div className="tendering-insight-grid">
              <section className="subsection">
                <div className="split-header">
                  <strong>Delivery brief</strong>
                  <span className="muted-text">Operational ownership and source context</span>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Source tender</dt>
                    <dd>
                      {selectedJob.sourceTender
                        ? `${selectedJob.sourceTender.tenderNumber} - ${selectedJob.sourceTender.title}`
                        : "None"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tender due date</dt>
                    <dd>{formatDate(selectedJob.sourceTender?.dueDate)}</dd>
                  </div>
                  <div>
                    <dt>Estimator</dt>
                    <dd>
                      {selectedJob.sourceTender?.estimator
                        ? `${selectedJob.sourceTender.estimator.firstName} ${selectedJob.sourceTender.estimator.lastName}`
                        : "Unassigned"}
                    </dd>
                  </div>
                  <div>
                    <dt>Project manager</dt>
                    <dd>
                      {selectedJob.projectManager
                        ? `${selectedJob.projectManager.firstName} ${selectedJob.projectManager.lastName}`
                        : "Unassigned"}
                    </dd>
                  </div>
                  <div>
                    <dt>Supervisor</dt>
                    <dd>
                      {selectedJob.supervisor
                        ? `${selectedJob.supervisor.firstName} ${selectedJob.supervisor.lastName}`
                        : "Unassigned"}
                    </dd>
                  </div>
                  <div>
                    <dt>Site</dt>
                    <dd>{selectedJob.site?.name ?? "Unassigned"}</dd>
                  </div>
                </dl>
              </section>
              <section className="subsection">
                <div className="split-header">
                  <strong>Handover brief</strong>
                  <span className="muted-text">Awarded relationship and communication carryover</span>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Awarded client</dt>
                    <dd>{selectedJob.conversion?.tenderClient.client.name ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Primary contact</dt>
                    <dd>{selectedJob.conversion?.tenderClient.contact?.name ?? "Not captured"}</dd>
                  </div>
                  <div>
                    <dt>Relationship role</dt>
                    <dd>{selectedJob.conversion?.tenderClient.relationshipType ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Contact email</dt>
                    <dd>{selectedJob.conversion?.tenderClient.contact?.email ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Contact phone</dt>
                    <dd>{selectedJob.conversion?.tenderClient.contact?.phone ?? "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Stakeholder notes</dt>
                    <dd>{selectedJob.conversion?.tenderClient.notes ?? "No stakeholder notes carried through."}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <div className="subsection">
              <div className="split-header">
                <strong>Documents and closeout state</strong>
                <span className="muted-text">Delivery record continuity from conversion through archive</span>
              </div>
              <div className="inline-fields">
                <span className={`pill ${selectedJob.documents?.length ? "pill--blue" : "pill--amber"}`}>
                  {selectedJob.documents?.length ?? 0} linked documents
                </span>
                <span className={`pill ${selectedJob.closeout ? "pill--amber" : "pill--green"}`}>
                  {selectedJob.closeout ? selectedJob.closeout.status : "Open"}
                </span>
                {selectedJob.closeout?.archivedAt ? (
                  <span className="muted-text">Archived {formatDateTime(selectedJob.closeout.archivedAt)}</span>
                ) : null}
              </div>
              <p className="muted-text">
                {selectedJob.documents
                  ?.map((document) => `${document.title}${document.versionLabel ? ` (${document.versionLabel})` : ""}`)
                  .join("; ") || "No linked job documents yet."}
              </p>
              <div className="inline-fields">
                <button type="button" onClick={openDocumentsForJob}>
                  Open Job Documents
                </button>
                <span className="muted-text">
                  Jump into the SharePoint-backed document workspace already focused on this job.
                </span>
              </div>
              {selectedJob.status === "ACTIVE" && (selectedJob.documents?.length ?? 0) === 0 ? (
                <div className="subsection">
                  <div className="split-header">
                    <strong>Document follow-up owner</strong>
                    <span className="muted-text">Route the missing-document prompt without leaving the job workspace</span>
                  </div>
                  {renderFollowUpAssignment(
                    `documents-${selectedJob.id}`,
                    "No live document follow-up prompt is currently active for this job."
                  )}
                </div>
              ) : null}
            </div>

            <div className="tendering-activity-band">
              <div className="tendering-activity-band__intro">
                <span className="eyebrow">Delivery control</span>
                <h4>Operational pulse for stages, risk, and progress</h4>
                <p className="muted-text">
                  Use this snapshot to orient delivery before making updates. It turns the raw job records into the next-action view the delivery team actually needs.
                </p>
              </div>
              <div className="tendering-activity-band__stats">
                <div className="tendering-activity-band__stat">
                  <strong>{stageMetrics.activeStages}/{stageMetrics.stageCount}</strong>
                  <span>Active stages</span>
                </div>
                <div className="tendering-activity-band__stat">
                  <strong>{issueMetrics.openIssues}</strong>
                  <span>Open issues</span>
                </div>
                <div className="tendering-activity-band__stat">
                  <strong>
                    {progressMetrics.latestPercent !== null && progressMetrics.latestPercent !== undefined
                      ? `${progressMetrics.latestPercent}%`
                      : "No progress"}
                  </strong>
                  <span>Latest progress</span>
                </div>
              </div>
            </div>

            {focusedDeliveryContext ? (
              <div className="notice-banner notice-banner--warning">
                <strong>Delivery focus</strong>
                <p>
                  You arrived from {focusedDeliveryContext.from === "scheduler" ? "Scheduler" : "another workspace"} with
                  <strong> {focusedDeliveryContext.activity?.name ?? "a delivery activity"}</strong>
                  {focusedDeliveryContext.stage ? <> in <strong>{focusedDeliveryContext.stage.name}</strong></> : null}
                  {focusedDeliveryContext.shift ? <> and shift <strong>{focusedDeliveryContext.shift.title}</strong></> : null}
                  . Use the planning and delivery sections below to resolve the issue without losing context.
                </p>
              </div>
            ) : null}

            {jobFocus?.from === "dashboard" && selectedJob && !focusedDeliveryContext ? (
              <div className="notice-banner notice-banner--warning">
                <strong>Portfolio focus</strong>
                <p>
                  You arrived from Dashboards to review <strong>{selectedJob.jobNumber}</strong>. Use the planning, delivery,
                  and risk sections below to work through the highest-signal issues for this job.
                </p>
              </div>
            ) : null}

            {focusedDeliveryContext?.activity && selectedJob ? (
              <div className="subsection">
                <div className="split-header">
                  <strong>Focused delivery action</strong>
                  <span className="muted-text">Close the loop from planning into delivery execution</span>
                </div>
                <div className="tendering-focus-list tendering-focus-list--activity">
                  <div className="tendering-focus-list__item">
                    <strong>{focusedDeliveryContext.activity.name}</strong>
                    <span>Selected activity</span>
                  </div>
                  <div className="tendering-focus-list__item">
                    <strong>{focusedDeliveryContext.stage?.name ?? "No stage"}</strong>
                    <span>Delivery stage</span>
                  </div>
                  <div className="tendering-focus-list__item">
                    <strong>{focusedDeliveryContext.shift?.title ?? "No linked shift"}</strong>
                    <span>Shift context</span>
                  </div>
                  <div className="tendering-focus-list__item">
                    <strong>
                      {focusedDeliveryContext.activity.owner
                        ? `${focusedDeliveryContext.activity.owner.firstName} ${focusedDeliveryContext.activity.owner.lastName}`
                        : "Unassigned"}
                    </strong>
                    <span>Activity owner</span>
                  </div>
                </div>
                <p className="muted-text">
                  {focusedDeliveryContext.activity.owner
                    ? focusedDeliveryContext.activity.owner.id === user?.id
                      ? "You own the next delivery follow-through for this activity, so status updates and progress notes should come from here."
                      : `${focusedDeliveryContext.activity.owner.firstName} ${focusedDeliveryContext.activity.owner.lastName} currently owns the next delivery follow-through for this activity.`
                    : "No activity owner is set yet, so the next delivery follow-through is still unassigned."}
                </p>
                {focusedManualFollowUps.length ? (
                  <div className="dashboard-list">
                    {focusedManualFollowUps.map((item) => (
                      <div key={item.id} className="tendering-focus-list__item">
                        <div className="split-header">
                          <strong>{item.metadata?.manualType === "ESCALATION" ? "Execution escalation" : "Execution handoff"}</strong>
                          <span className={`pill ${item.metadata?.manualType === "ESCALATION" ? "pill--red" : "pill--amber"}`}>
                            {item.metadata?.manualType === "ESCALATION" ? "Escalated" : "Handed off"}
                          </span>
                        </div>
                        <p className="muted-text">{item.body}</p>
                        <p className="muted-text">
                          Routed to {item.metadata?.nextOwnerLabel ?? "team owner"}
                          {item.metadata?.assignedByLabel ? ` by ${item.metadata.assignedByLabel}` : ""}
                          {item.metadata?.assignedAt ? ` on ${formatDateTime(item.metadata.assignedAt)}` : ""}.
                        </p>
                        {item.metadata?.reasonCode || item.metadata?.reasonDetail ? (
                          <p className="muted-text">
                            Why: {item.metadata?.reasonCode?.replaceAll("_", " ").toLowerCase() ?? "manual follow-up"}
                            {item.metadata?.reasonDetail ? ` - ${item.metadata.reasonDetail}` : ""}
                          </p>
                        ) : null}
                        <div className="inline-fields">
                          <select
                            value={manualResolutionDrafts[item.id]?.outcomeCode ?? "UNBLOCKED"}
                            onChange={(event) =>
                              setManualResolutionDrafts((current) => ({
                                ...current,
                                [item.id]: {
                                  outcomeCode: event.target.value as
                                    | "UNBLOCKED"
                                    | "WAITING_EXTERNAL"
                                    | "REASSIGNED"
                                    | "WATCH_CONTINUES",
                                  resolutionNote: current[item.id]?.resolutionNote ?? ""
                                }
                              }))
                            }
                          >
                            <option value="UNBLOCKED">Unblocked</option>
                            <option value="WAITING_EXTERNAL">Waiting external</option>
                            <option value="REASSIGNED">Reassigned</option>
                            <option value="WATCH_CONTINUES">Watch continues</option>
                          </select>
                          <input
                            value={manualResolutionDrafts[item.id]?.resolutionNote ?? ""}
                            onChange={(event) =>
                              setManualResolutionDrafts((current) => ({
                                ...current,
                                [item.id]: {
                                  outcomeCode: current[item.id]?.outcomeCode ?? "UNBLOCKED",
                                  resolutionNote: event.target.value
                                }
                              }))
                            }
                            placeholder="Resolution note"
                          />
                        </div>
                        <div className="inline-fields">
                          <button type="button" onClick={() => void resolveManualFollowUp(item)}>
                            Resolve prompt
                          </button>
                          {item.metadata?.manualType === "HANDOFF" &&
                          (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? (
                            <button type="button" onClick={() => void acceptManualHandoff(item)}>
                              Accept handoff
                            </button>
                          ) : null}
                          {item.metadata?.manualType === "ESCALATION" &&
                          (item.metadata?.nextOwnerId ?? item.userId) === user?.id ? (
                            <button type="button" onClick={() => void acceptManualEscalation(item)}>
                              Accept escalation
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setFocusedProgressSummary(
                                item.metadata?.manualType === "ESCALATION"
                                  ? `Escalation resolved for ${focusedDeliveryContext.activity!.name}: `
                                  : `Handoff settled for ${focusedDeliveryContext.activity!.name}: `
                              )
                            }
                          >
                            Draft follow-up note
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {focusedRecommendations.length ? (
                  <div className="dashboard-list">
                    {focusedRecommendations.map((recommendation) => (
                      <div key={recommendation.id} className="tendering-focus-list__item">
                        <div className="split-header">
                          <strong>{recommendation.title}</strong>
                          <span className={`pill pill--${recommendation.tone}`}>Recommended</span>
                        </div>
                        <p className="muted-text">{recommendation.description}</p>
                        <button
                          type="button"
                          onClick={() => applyFocusedRecommendation(recommendation.id)}
                        >
                          {recommendation.actionLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="tendering-insight-grid">
                  <section className="subsection">
                    <div className="split-header">
                      <strong>Update activity status</strong>
                      <span className="muted-text">Reflect the latest delivery/planning state</span>
                    </div>
                    <form
                      className="admin-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitToJob(`/jobs/${selectedJob.id}/activities/${focusedDeliveryContext.activity!.id}`, {
                          jobStageId: focusedDeliveryContext.stage?.id ?? "",
                          name: focusedDeliveryContext.activity!.name,
                          status: focusedActivityStatus,
                          plannedDate: focusedDeliveryContext.activity!.plannedDate ?? undefined,
                          ownerUserId: focusedActivityOwnerId || undefined
                        });
                      }}
                    >
                      <label>
                        Activity status
                        <select
                          value={focusedActivityStatus}
                          onChange={(event) => setFocusedActivityStatus(event.target.value)}
                        >
                          <option value="PLANNED">Planned</option>
                          <option value="ACTIVE">Active</option>
                          <option value="COMPLETE">Complete</option>
                        </select>
                      </label>
                      <label>
                        Activity owner
                        <select
                          value={focusedActivityOwnerId}
                          onChange={(event) => setFocusedActivityOwnerId(event.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {users.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.firstName} {item.lastName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit">Update Focused Activity</button>
                    </form>
                  </section>
                  <section className="subsection">
                    <div className="split-header">
                      <strong>Post planner follow-up</strong>
                      <span className="muted-text">Capture the handoff outcome as a delivery note</span>
                    </div>
                    <form
                      className="admin-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitToJob(`/jobs/${selectedJob.id}/progress-entries`, {
                          entryType: "DAILY_NOTE",
                          entryDate: new Date().toISOString().slice(0, 10),
                          summary: focusedProgressSummary
                        }).then(() => {
                          setFocusedProgressSummary(
                            focusedDeliveryContext.shift
                              ? `Planner follow-up for ${focusedDeliveryContext.shift.title}: `
                              : `Planner follow-up for ${focusedDeliveryContext.activity!.name}: `
                          );
                        });
                      }}
                    >
                      <label>
                        Follow-up note
                        <input
                          value={focusedProgressSummary}
                          onChange={(event) => setFocusedProgressSummary(event.target.value)}
                        />
                      </label>
                      <button type="submit">Add Follow-up Note</button>
                    </form>
                  </section>
                </div>
              </div>
            ) : null}

              <div className="subsection">
                <div className="split-header">
                  <strong>Scheduling readiness</strong>
                  <span className="muted-text">
                    {schedulingMetrics.shiftCount} shifts linked across {schedulingMetrics.activityCount} activities
                </span>
              </div>
              <div className="tendering-focus-list tendering-focus-list--activity">
                <div className="tendering-focus-list__item">
                  <strong>{schedulingMetrics.unscheduledActivities}</strong>
                  <span>Activities still needing shifts</span>
                </div>
                <div className="tendering-focus-list__item">
                  <strong>{schedulingMetrics.readyShifts}</strong>
                  <span>Shifts ready to run</span>
                </div>
                <div className="tendering-focus-list__item">
                  <strong>{schedulingMetrics.warningShifts}</strong>
                  <span>Warning shifts</span>
                </div>
                  <div className="tendering-focus-list__item">
                    <strong>{schedulingMetrics.blockedShifts}</strong>
                    <span>Blocked shifts</span>
                  </div>
                </div>
                <div className="subsection">
                  <div className="split-header">
                    <strong>Schedule shape snapshot</strong>
                    <span className="muted-text">{planningSnapshot.monthLabel}</span>
                  </div>
                  <div className="job-planning-strip">
                    {planningSnapshot.monthDays.map((day) => {
                      const cell = planningSnapshot.matrixCells.get(day.key);
                      const toneClass = cell?.blocked
                        ? "job-planning-strip__cell job-planning-strip__cell--red"
                        : cell?.warning
                          ? "job-planning-strip__cell job-planning-strip__cell--amber"
                          : cell?.shifts.length
                            ? "job-planning-strip__cell job-planning-strip__cell--blue"
                            : "job-planning-strip__cell";

                      return (
                        <button
                          key={day.key}
                          type="button"
                          className={toneClass}
                          disabled={!cell?.shifts.length}
                          onClick={() => {
                            if (!cell?.shifts[0]) return;
                            openSchedulerForShift(cell.shifts[0].stageId, cell.shifts[0].activityId, cell.shifts[0].id);
                          }}
                        >
                          <strong>{day.dayNumber}</strong>
                          <span>{cell?.shifts.length ?? 0}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="job-program-mini">
                    {planningSnapshot.stageRows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className="job-program-mini__row"
                        onClick={() => openSchedulerForShift(row.id, row.firstActivityId, row.firstShiftId)}
                      >
                        <div className="job-program-mini__label">
                          <strong>{row.name}</strong>
                          <span>{row.shiftCount} shifts in month</span>
                        </div>
                        <div className="job-program-mini__track">
                          <span
                            className={`job-program-mini__bar job-program-mini__bar--${row.tone}`}
                            style={{
                              left: `${((row.startDay - 1) / planningSnapshot.monthDays.length) * 100}%`,
                              width: `${(row.spanDays / planningSnapshot.monthDays.length) * 100}%`
                            }}
                          />
                        </div>
                      </button>
                    ))}
                    {!planningSnapshot.stageRows.length ? (
                      <p className="muted-text">
                        No stage spans fall inside the current month yet. Use Scheduler when you are ready to shape the first delivery plan.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="tendering-insight-grid">
                  <section className="subsection">
                  <div className="split-header">
                    <strong>Planning blockers digest</strong>
                    <span className="muted-text">Why planning is stuck right now</span>
                  </div>
                  <div className="dashboard-list">
                    {planningBlockers.topSignals.map((blocker) => (
                      <div key={`${blocker.shiftId}-${blocker.code}-${blocker.message}`} className="tendering-focus-list__item">
                        <div className="split-header">
                          <strong>{blocker.shiftTitle}</strong>
                          <span className={blocker.severity === "RED" ? "pill pill--red" : "pill pill--amber"}>
                            {blocker.code}
                          </span>
                        </div>
                        <p className="muted-text">
                          {blocker.stageName} | {blocker.activityName} | {formatDateTime(blocker.startAt)}
                        </p>
                        <p className="muted-text">{blocker.message}</p>
                        <button
                          type="button"
                          onClick={() => openSchedulerForShift(blocker.stageId, blocker.activityId, blocker.shiftId)}
                        >
                          Open in Scheduler
                        </button>
                        <div className="subsection">
                          <div className="split-header">
                            <strong>Planning owner</strong>
                            <span className="muted-text">Adjust shared ownership from the blocker itself</span>
                          </div>
                          {renderFollowUpAssignment(
                            `${blocker.severity === "RED" ? "blocked" : "warning"}-${selectedJob.id}-${blocker.shiftId}`,
                            "No live planning follow-up is currently active for this blocker."
                          )}
                        </div>
                      </div>
                    ))}
                    {!planningBlockers.topSignals.length ? (
                      <p className="muted-text">
                        No planning blockers are currently surfaced on linked shifts. This job is either ready to dispatch or still waiting on the first shift to be created.
                      </p>
                    ) : null}
                  </div>
                </section>
                <section className="subsection">
                  <div className="split-header">
                    <strong>Planning pressure</strong>
                    <span className="muted-text">Quick triage for delivery leads</span>
                  </div>
                  <div className="dashboard-list">
                    <div className="tendering-focus-list__item">
                      <div className="split-header">
                        <strong>{planningBlockers.blockedItems.length}</strong>
                        <span className="pill pill--red">Blocked</span>
                      </div>
                      <p className="muted-text">
                        Shifts with hard conflicts that need planner intervention before dispatch.
                      </p>
                    </div>
                    <div className="tendering-focus-list__item">
                      <div className="split-header">
                        <strong>{planningBlockers.warningItems.length}</strong>
                        <span className="pill pill--amber">Warning</span>
                      </div>
                      <p className="muted-text">
                        Shifts that can probably proceed, but need a quick check on resource, maintenance, or timing risk.
                      </p>
                    </div>
                    <div className="tendering-focus-list__item">
                      <div className="split-header">
                        <strong>{unscheduledActivities.length}</strong>
                        <span className="pill pill--amber">Needs planning</span>
                      </div>
                      <p className="muted-text">
                        Delivery activities still waiting for their first shift to be created in Scheduler.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
              <div className="dashboard-list">
                {schedulingMetrics.upcomingShifts.map((shift) => (
                  <div key={shift.id} className="tendering-focus-list__item">
                    <div className="split-header">
                      <strong>{shift.title}</strong>
                      <span className={getPillClass(shift.status)}>{shift.status}</span>
                    </div>
                    <p className="muted-text">
                      {shift.stageName} · {shift.activityName} · {formatDateTime(shift.startAt)}
                    </p>
                    <div className="inline-fields">
                      <span className={`pill ${
                        shift.conflicts.some((conflict) => conflict.severity === "RED")
                          ? "pill--red"
                          : shift.conflicts.some((conflict) => conflict.severity === "AMBER")
                            ? "pill--amber"
                            : "pill--green"
                      }`}>
                        {shift.conflicts.length
                          ? shift.conflicts.map((conflict) => conflict.code).join(", ")
                          : "Ready"}
                      </span>
                      <button
                        type="button"
                        onClick={() => openSchedulerForShift(shift.stageId, shift.activityId, shift.id)}
                      >
                        Open in Scheduler
                      </button>
                    </div>
                  </div>
                ))}
                {!schedulingMetrics.upcomingShifts.length ? (
                  <p className="muted-text">
                    No shifts linked yet. The next operational step is to start attaching shifts to delivery activities in Scheduler.
                  </p>
                ) : null}
              </div>
              <div className="dashboard-list">
                {unscheduledActivities.slice(0, 4).map((activity) => (
                  <div key={activity.activityId} className="tendering-focus-list__item">
                    <div className="split-header">
                      <strong>{activity.activityName}</strong>
                      <span className="pill pill--amber">Needs shift</span>
                    </div>
                    <p className="muted-text">{activity.stageName}</p>
                    <button
                      type="button"
                      onClick={() =>
                        openSchedulerForActivity(activity.stageId, activity.activityId, activity.activityName)
                      }
                    >
                      Plan in Scheduler
                    </button>
                  </div>
                ))}
                {!unscheduledActivities.length ? (
                  <p className="muted-text">Every current activity already has at least one linked shift.</p>
                ) : null}
              </div>
            </div>

            <div className="subsection">
              <strong>Status and ownership</strong>
              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitToJob(`/jobs/${selectedJob.id}/status`, statusForm);
                }}
              >
                <label>
                  Status
                  <select
                    value={statusForm.status}
                    onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value })}
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETE">Complete</option>
                  </select>
                </label>
                <label>
                  Status note
                  <input
                    value={statusForm.note}
                    onChange={(event) => setStatusForm({ ...statusForm, note: event.target.value })}
                  />
                </label>
                <button type="submit">Update Status</button>
              </form>
              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveOwnership();
                }}
              >
                <label>
                  Planning owner
                  <select
                    value={ownershipForm.supervisorId}
                    onChange={(event) =>
                      setOwnershipForm((current) => ({
                        ...current,
                        supervisorId: event.target.value
                      }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Document owner
                  <select
                    value={ownershipForm.projectManagerId}
                    onChange={(event) =>
                      setOwnershipForm((current) => ({
                        ...current,
                        projectManagerId: event.target.value
                      }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Save Owners</button>
              </form>
              <p className="muted-text">
                Planning prompts now derive from the job&apos;s planning owner, and missing-document prompts derive from the document owner, before any manual follow-up overrides are applied.
              </p>
            </div>

            <div className="subsection">
              <div className="split-header">
                <strong>Stages and activities</strong>
                <span className="muted-text">
                  {stageMetrics.activityCount} activities · {stageMetrics.plannedActivities} planned · {stageMetrics.activeActivities} active
                </span>
              </div>
              <div className="tendering-focus-list tendering-focus-list--activity">
                <div className="tendering-focus-list__item">
                  <strong>{stageMetrics.stageCount}</strong>
                  <span>Total stages</span>
                </div>
                <div className="tendering-focus-list__item">
                  <strong>{stageMetrics.completeStages}</strong>
                  <span>Completed stages</span>
                </div>
              </div>
              <div className="dashboard-list">
                {selectedJob.stages?.map((stage) => (
                  <div key={stage.id} className="tendering-focus-list__item">
                    <div className="split-header">
                      <strong>{stage.name}</strong>
                      <span className={getPillClass(stage.status)}>{stage.status}</span>
                    </div>
                    <p className="muted-text">
                      Window: {formatDate(stage.startDate)} to {formatDate(stage.endDate)}
                    </p>
                    <p className="muted-text">
                      Activities:{" "}
                      {stage.activities
                        .map(
                          (activity) =>
                            `${activity.name} [${activity.status}]${activity.owner ? ` -> ${activity.owner.firstName} ${activity.owner.lastName}` : ""}`
                        )
                        .join("; ") || "None"}
                    </p>
                  </div>
                ))}
                {!selectedJob.stages?.length ? <p className="muted-text">No delivery stages have been added yet.</p> : null}
              </div>

              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitToJob(`/jobs/${selectedJob.id}/stages`, stageForm);
                  setStageForm({ name: "", description: "", status: "PLANNED" });
                }}
              >
                <label>
                  Stage name
                  <input value={stageForm.name} onChange={(event) => setStageForm({ ...stageForm, name: event.target.value })} />
                </label>
                <label>
                  Description
                  <input value={stageForm.description} onChange={(event) => setStageForm({ ...stageForm, description: event.target.value })} />
                </label>
                <label>
                  Status
                  <select value={stageForm.status} onChange={(event) => setStageForm({ ...stageForm, status: event.target.value })}>
                    <option value="PLANNED">Planned</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETE">Complete</option>
                  </select>
                </label>
                <button type="submit">Add Stage</button>
              </form>

              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitToJob(`/jobs/${selectedJob.id}/activities`, activityForm);
                  setActivityForm({ jobStageId: "", name: "", status: "PLANNED", ownerUserId: "" });
                }}
              >
                <label>
                  Stage
                  <select
                    value={activityForm.jobStageId}
                    onChange={(event) => setActivityForm({ ...activityForm, jobStageId: event.target.value })}
                  >
                    <option value="">Select stage</option>
                    {selectedJob.stages?.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Activity
                  <input value={activityForm.name} onChange={(event) => setActivityForm({ ...activityForm, name: event.target.value })} />
                </label>
                <label>
                  Status
                  <select value={activityForm.status} onChange={(event) => setActivityForm({ ...activityForm, status: event.target.value })}>
                    <option value="PLANNED">Planned</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETE">Complete</option>
                  </select>
                </label>
                <label>
                  Activity owner
                  <select
                    value={activityForm.ownerUserId}
                    onChange={(event) => setActivityForm({ ...activityForm, ownerUserId: event.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Add Activity</button>
              </form>
            </div>

            <div className="subsection">
              <div className="split-header">
                <strong>Issues and variations</strong>
                <span className="muted-text">
                  {issueMetrics.highSeverityIssues} high-severity issues · {formatCurrency(issueMetrics.variationAmount)} variation value
                </span>
              </div>
              <div className="tendering-focus-list tendering-focus-list--activity">
                <div className="tendering-focus-list__item">
                  <strong>{issueMetrics.openIssues}</strong>
                  <span>Open issues</span>
                </div>
                <div className="tendering-focus-list__item">
                  <strong>{issueMetrics.approvedVariations}/{issueMetrics.variationCount}</strong>
                  <span>Approved variations</span>
                </div>
              </div>
              <div className="dashboard-list">
                {(selectedJob.issues ?? []).slice(0, 4).map((issue) => (
                  <div key={issue.id} className="tendering-focus-list__item">
                    <div className="split-header">
                      <strong>{issue.title}</strong>
                      <span className={getPillClass(issue.severity)}>{issue.severity}</span>
                    </div>
                    <span className={getPillClass(issue.status)}>{issue.status}</span>
                  </div>
                ))}
                {!selectedJob.issues?.length ? <p className="muted-text">No issues logged yet.</p> : null}
              </div>
              <div className="dashboard-list">
                {(selectedJob.variations ?? []).slice(0, 4).map((variation) => (
                  <div key={variation.id} className="tendering-focus-list__item">
                    <div className="split-header">
                      <strong>{variation.reference} {variation.title}</strong>
                      <span className={getPillClass(variation.status)}>{variation.status}</span>
                    </div>
                    <p className="muted-text">{formatCurrency(variation.amount)}</p>
                  </div>
                ))}
                {!selectedJob.variations?.length ? <p className="muted-text">No variations logged yet.</p> : null}
              </div>

              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitToJob(`/jobs/${selectedJob.id}/issues`, issueForm);
                  setIssueForm({ title: "", severity: "MEDIUM", status: "OPEN" });
                }}
              >
                <label>
                  Issue title
                  <input value={issueForm.title} onChange={(event) => setIssueForm({ ...issueForm, title: event.target.value })} />
                </label>
                <label>
                  Severity
                  <select value={issueForm.severity} onChange={(event) => setIssueForm({ ...issueForm, severity: event.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </label>
                <button type="submit">Add Issue</button>
              </form>

              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitToJob(`/jobs/${selectedJob.id}/variations`, variationForm);
                  setVariationForm({ reference: "", title: "", status: "PROPOSED", amount: "" });
                }}
              >
                <label>
                  Variation reference
                  <input value={variationForm.reference} onChange={(event) => setVariationForm({ ...variationForm, reference: event.target.value })} />
                </label>
                <label>
                  Title
                  <input value={variationForm.title} onChange={(event) => setVariationForm({ ...variationForm, title: event.target.value })} />
                </label>
                <label>
                  Amount
                  <input value={variationForm.amount} onChange={(event) => setVariationForm({ ...variationForm, amount: event.target.value })} />
                </label>
                <button type="submit">Add Variation</button>
              </form>
            </div>

            <div className="subsection">
              <div className="split-header">
                <strong>Daily notes and history</strong>
                <span className="muted-text">
                  {progressMetrics.entryCount} entries · latest update {formatDate(progressMetrics.latestEntryDate)}
                </span>
              </div>
              <div className="tendering-focus-list tendering-focus-list--activity">
                <div className="tendering-focus-list__item">
                  <strong>
                    {progressMetrics.latestPercent !== null && progressMetrics.latestPercent !== undefined
                      ? `${progressMetrics.latestPercent}%`
                      : "No progress"}
                  </strong>
                  <span>Latest completion signal</span>
                </div>
                <div className="tendering-focus-list__item">
                  <strong>{progressMetrics.recentHistory.length}</strong>
                  <span>Recent status moves</span>
                </div>
              </div>
              <div className="dashboard-list">
                {(selectedJob.progressEntries ?? []).slice(0, 4).map((entry) => (
                  <div key={entry.id} className="tendering-focus-list__item">
                    <div className="split-header">
                      <strong>{entry.entryType}</strong>
                      <span className="muted-text">{formatDate(entry.entryDate)}</span>
                    </div>
                    {getCoordinationOutcomeLabel(entry.summary) ? (
                      <div className="inline-fields">
                        <span className={getCoordinationOutcomeLabel(entry.summary)!.pillClass}>
                          {getCoordinationOutcomeLabel(entry.summary)!.title}
                        </span>
                      </div>
                    ) : null}
                    <p className="muted-text">{entry.summary}</p>
                  </div>
                ))}
                {!selectedJob.progressEntries?.length ? <p className="muted-text">No progress entries yet.</p> : null}
              </div>
              <div className="dashboard-list">
                {progressMetrics.recentHistory.map((entry) => (
                  <div key={entry.id} className="tendering-focus-list__item">
                    <strong>{entry.fromStatus ?? "N/A"} to {entry.toStatus}</strong>
                    <p className="muted-text">{entry.note ?? "No status note recorded."}</p>
                    <span className="muted-text">{formatDateTime(entry.changedAt)}</span>
                  </div>
                ))}
                {!progressMetrics.recentHistory.length ? <p className="muted-text">No status history yet.</p> : null}
              </div>
              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitToJob(`/jobs/${selectedJob.id}/progress-entries`, {
                    ...progressForm,
                    entryDate: progressForm.entryDate || new Date().toISOString().slice(0, 10),
                    percentComplete: progressForm.percentComplete ? Number(progressForm.percentComplete) : undefined
                  });
                  setProgressForm({ entryType: "DAILY_NOTE", entryDate: "", summary: "", percentComplete: "" });
                }}
              >
                <label>
                  Entry type
                  <select value={progressForm.entryType} onChange={(event) => setProgressForm({ ...progressForm, entryType: event.target.value })}>
                    <option value="DAILY_NOTE">Daily Note</option>
                    <option value="PROGRESS">Progress</option>
                  </select>
                </label>
                <label>
                  Date
                  <input type="date" value={progressForm.entryDate} onChange={(event) => setProgressForm({ ...progressForm, entryDate: event.target.value })} />
                </label>
                <label>
                  Summary
                  <input value={progressForm.summary} onChange={(event) => setProgressForm({ ...progressForm, summary: event.target.value })} />
                </label>
                <label>
                  Percent complete
                  <input value={progressForm.percentComplete} onChange={(event) => setProgressForm({ ...progressForm, percentComplete: event.target.value })} />
                </label>
                <button type="submit">Add Entry</button>
              </form>
            </div>

            <div className="subsection">
              <strong>Closeout and archive</strong>
              {selectedJob.closeout?.readOnlyFrom ? (
                <p className="muted-text">
                  Read-only from {new Date(selectedJob.closeout.readOnlyFrom).toLocaleString()}
                </p>
              ) : (
                <p className="muted-text">Job remains editable until closeout is completed.</p>
              )}
              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitToJob(`/jobs/${selectedJob.id}/closeout`, {
                    status: closeoutForm.status,
                    summary: closeoutForm.summary,
                    checklistJson: {
                      notes: closeoutForm.checklistNotes,
                      items: [
                        { key: "documents_complete", label: "Documents complete", completed: true },
                        { key: "forms_complete", label: "Forms complete", completed: true },
                        { key: "handover_complete", label: "Handover complete", completed: true }
                      ]
                    }
                  });
                }}
              >
                <label>
                  Closeout status
                  <select value={closeoutForm.status} onChange={(event) => setCloseoutForm({ ...closeoutForm, status: event.target.value })}>
                    <option value="CLOSED">Closed</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </label>
                <label>
                  Summary
                  <input value={closeoutForm.summary} onChange={(event) => setCloseoutForm({ ...closeoutForm, summary: event.target.value })} />
                </label>
                <label>
                  Checklist notes
                  <input value={closeoutForm.checklistNotes} onChange={(event) => setCloseoutForm({ ...closeoutForm, checklistNotes: event.target.value })} />
                </label>
                <button type="submit">Close Out Job</button>
              </form>
            </div>
          </div>
        ) : (
          <p className="muted-text">Select a job to review its conversion details.</p>
        )}
        </AppCard>
      </div>
    </div>
  );
}

