import { Fragment, useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type ShiftRecord = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  lead?: { id: string; firstName: string; lastName: string } | null;
  notes?: string | null;
  workInstructions?: string | null;
  roleRequirements: Array<{
    id: string;
    roleLabel: string;
    requiredCount: number;
    competency?: { id: string; name: string } | null;
  }>;
  workerAssignments: Array<{
    roleLabel?: string | null;
    worker: {
      id: string;
      firstName: string;
      lastName: string;
      competencies: Array<{ competency: { id: string; name: string }; expiresAt?: string | null }>;
      availabilityWindows: Array<{ id: string; startAt: string; endAt: string; status: string }>;
      roleSuitabilities: Array<{ id: string; roleLabel: string; suitability: string }>;
    };
  }>;
  assetAssignments: Array<{ asset: { id: string; name: string } }>;
  conflicts: Array<{ severity: string; code: string; message: string }>;
};

type ActivityRecord = {
  id: string;
  name: string;
  owner?: { id: string; firstName: string; lastName: string } | null;
  shifts: ShiftRecord[];
};

type StageRecord = {
  id: string;
  name: string;
  activities: ActivityRecord[];
};

type JobRecord = {
  id: string;
  jobNumber: string;
  name: string;
  projectManager?: { id: string; firstName: string; lastName: string } | null;
  supervisor?: { id: string; firstName: string; lastName: string } | null;
  stages: StageRecord[];
};

type WorkerRecord = {
  id: string;
  firstName: string;
  lastName: string;
  resourceType?: { name: string } | null;
  competencies: Array<{ competency: { id: string; name: string }; expiresAt?: string | null }>;
  availabilityWindows: Array<{ id: string; startAt: string; endAt: string; status: string }>;
  roleSuitabilities: Array<{ id: string; roleLabel: string; suitability: string }>;
};

type AssetRecord = {
  id: string;
  name: string;
  status: string;
  homeBase?: string | null;
  currentLocation?: string | null;
  category?: { id: string; name: string } | null;
  resourceType?: { name: string } | null;
  maintenancePlans: Array<{
    nextDueAt?: string | null;
    warningDays: number;
    blockWhenOverdue: boolean;
    status: string;
  }>;
  inspections: Array<{ status: string }>;
  breakdowns: Array<{ status: string }>;
};

type AssignableUser = {
  id: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
};

type SharedFollowUpItem = {
  id: string;
  userId: string;
  metadata?: {
    kind?: string;
    promptKey?: string;
    nextOwnerId?: string | null;
    nextOwnerLabel?: string | null;
    assignmentMode?: "DERIVED" | "MANUAL";
    assignedByLabel?: string | null;
    assignedAt?: string | null;
  } | null;
};

type ShiftRequirementRecord = {
  id: string;
  roleLabel: string;
  requiredCount: number;
  competency?: { id: string; name: string } | null;
};

const emptyShiftForm = {
  jobId: "",
  jobStageId: "",
  jobActivityId: "",
  leadUserId: "",
  title: "",
  startAt: "",
  endAt: "",
  status: "PLANNED",
  notes: "",
  workInstructions: ""
};

const emptyRequirementForm = {
  id: "",
  roleLabel: "",
  competencyId: "",
  requiredCount: "1"
};

const emptyAssignment = {
  workerId: "",
  assetId: "",
  roleLabel: ""
};

function getShiftSignalClass(shift: ShiftRecord) {
  if (shift.conflicts.some((conflict) => conflict.severity === "RED")) {
    return "pill pill--red";
  }

  if (shift.conflicts.some((conflict) => conflict.severity === "AMBER")) {
    return "pill pill--amber";
  }

  return "pill pill--green";
}

function toDateTimeLocalString(value: Date) {
  const offsetMinutes = value.getTimezoneOffset();
  const localValue = new Date(value.getTime() - offsetMinutes * 60_000);
  return localValue.toISOString().slice(0, 16);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function formatMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function buildAssetPlanningState(asset: AssetRecord) {
  const now = new Date();
  const openBreakdown = asset.breakdowns.some((breakdown) => breakdown.status !== "RESOLVED");
  const failedInspection = asset.inspections.some((inspection) => inspection.status === "FAIL");

  let maintenanceState = "COMPLIANT";
  let schedulerImpact: "NONE" | "WARN" | "BLOCK" = "NONE";

  for (const plan of asset.maintenancePlans.filter((item) => item.status === "ACTIVE" && item.nextDueAt)) {
    if (!plan.nextDueAt) continue;
    const nextDueAt = new Date(plan.nextDueAt);

    if (nextDueAt < now) {
      maintenanceState = "OVERDUE";
      schedulerImpact = plan.blockWhenOverdue ? "BLOCK" : "WARN";
      break;
    }

    const warningAt = new Date(nextDueAt);
    warningAt.setDate(warningAt.getDate() - plan.warningDays);
    if (warningAt <= now && maintenanceState !== "OVERDUE") {
      maintenanceState = "DUE_SOON";
      schedulerImpact = "WARN";
    }
  }

  if (openBreakdown || failedInspection || asset.status === "OUT_OF_SERVICE") {
    maintenanceState = "UNAVAILABLE";
    schedulerImpact = "BLOCK";
  } else if (asset.status === "MAINTENANCE" && schedulerImpact !== "BLOCK") {
    maintenanceState = "IN_MAINTENANCE";
    schedulerImpact = "WARN";
  }

  return {
    maintenanceState,
    schedulerImpact
  };
}

export function SchedulerPage() {
  const { authFetch, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [sharedFollowUps, setSharedFollowUps] = useState<SharedFollowUpItem[]>([]);
  const [followUpAssignmentDrafts, setFollowUpAssignmentDrafts] = useState<Record<string, string>>({});
  const [planningOwnerDraft, setPlanningOwnerDraft] = useState("");
  const [shiftLeadDraft, setShiftLeadDraft] = useState("");
  const [selectedShift, setSelectedShift] = useState<ShiftRecord | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "calendar" | "gantt">("timeline");
  const [planningMode, setPlanningMode] = useState<"weekly" | "monthly">("weekly");
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [resourceView, setResourceView] = useState<"project" | "resource">("project");
  const [shiftOwnershipFilter, setShiftOwnershipFilter] = useState<"ALL" | "MY_SHIFTS">("ALL");
  const [collapsedJobs, setCollapsedJobs] = useState<Record<string, boolean>>({});
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [workerSearch, setWorkerSearch] = useState("");
  const [competencyFilter, setCompetencyFilter] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("");
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [assignment, setAssignment] = useState(emptyAssignment);
  const [requirementForm, setRequirementForm] = useState(emptyRequirementForm);
  const [error, setError] = useState<string | null>(null);
  const routeState = location.state as {
    plannerFocus?: { jobId?: string; stageId?: string; activityId?: string; shiftId?: string };
    prefillShift?: Partial<typeof emptyShiftForm>;
  } | null;
  const plannerFocus = routeState?.plannerFocus;
  const prefillShift = routeState?.prefillShift;

  const findShiftInJobs = (jobItems: JobRecord[], shiftId: string) =>
    jobItems
      .flatMap((job) => job.stages)
      .flatMap((stage) => stage.activities)
      .flatMap((activity) => activity.shifts)
      .find((shift) => shift.id === shiftId) ?? null;

  const load = async () => {
    const [workspaceResponse, usersResponse, followUpsResponse] = await Promise.all([
      authFetch("/scheduler/workspace?page=1&pageSize=100"),
      authFetch("/users?page=1&pageSize=100"),
      authFetch("/notifications/follow-ups/shared")
    ]);
    if (!workspaceResponse.ok) {
      throw new Error("Unable to load scheduler workspace.");
    }

    const data = await workspaceResponse.json();
    setJobs(data.items.jobs);
    setWorkers(data.items.workers);
    setAssets(data.items.assets);
    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      setUsers(usersData.items.filter((item: AssignableUser) => item.isActive !== false));
    }
    if (followUpsResponse.ok) {
      setSharedFollowUps(await followUpsResponse.json());
    }
    return data.items.jobs as JobRecord[];
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  useEffect(() => {
    const savedJobs = window.localStorage.getItem("project-ops-scheduler-jobs");
    const savedStages = window.localStorage.getItem("project-ops-scheduler-stages");

    if (savedJobs) {
      try {
        setCollapsedJobs(JSON.parse(savedJobs) as Record<string, boolean>);
      } catch {
        // Ignore invalid persisted state.
      }
    }

    if (savedStages) {
      try {
        setCollapsedStages(JSON.parse(savedStages) as Record<string, boolean>);
      } catch {
        // Ignore invalid persisted state.
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("project-ops-scheduler-jobs", JSON.stringify(collapsedJobs));
  }, [collapsedJobs]);

  useEffect(() => {
    window.localStorage.setItem("project-ops-scheduler-stages", JSON.stringify(collapsedStages));
  }, [collapsedStages]);

  useEffect(() => {
    if (!plannerFocus?.shiftId || !jobs.length) return;

    const focusedShift = findShiftInJobs(jobs, plannerFocus.shiftId);
    if (focusedShift) {
      setSelectedShift(focusedShift);
      setViewMode("timeline");
      setPlanningMode("weekly");
    }
  }, [jobs, plannerFocus?.shiftId]);

  useEffect(() => {
    if (!prefillShift) return;

    const defaultStart = new Date();
    defaultStart.setMinutes(0, 0, 0);
    defaultStart.setHours(defaultStart.getHours() + 1);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setHours(defaultEnd.getHours() + 8);

    setShiftForm((current) => ({
      ...current,
      ...prefillShift,
      startAt: prefillShift.startAt || current.startAt || toDateTimeLocalString(defaultStart),
      endAt: prefillShift.endAt || current.endAt || toDateTimeLocalString(defaultEnd),
      notes:
        prefillShift.notes ||
        current.notes ||
        "Created from the Jobs delivery handover. Confirm access, workforce coverage, and site constraints before dispatch.",
      workInstructions:
        prefillShift.workInstructions ||
        current.workInstructions ||
        "Start from the selected delivery activity, confirm role coverage, and capture blockers before dispatch."
    }));
    setViewMode("timeline");
    setPlanningMode("weekly");
  }, [prefillShift]);

  useEffect(() => {
    if (!selectedShift) {
      setRequirementForm(emptyRequirementForm);
      setAssignment(emptyAssignment);
      return;
    }

    const firstRequirement = selectedShift.roleRequirements[0];
    setRequirementForm(
      firstRequirement
        ? {
            id: firstRequirement.id,
            roleLabel: firstRequirement.roleLabel,
            competencyId: firstRequirement.competency?.id ?? "",
            requiredCount: String(firstRequirement.requiredCount)
          }
        : emptyRequirementForm
    );
  }, [selectedShift]);

  useEffect(() => {
    if (!requirementForm.roleLabel) {
      setAssignment((current) => ({ ...current, roleLabel: "" }));
      return;
    }

    setAssignment((current) => ({
      ...current,
      roleLabel: requirementForm.roleLabel
    }));
  }, [requirementForm.roleLabel]);

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

  const loadSharedFollowUps = async () => {
    const response = await authFetch("/notifications/follow-ups/shared");
    if (!response.ok) {
      setSharedFollowUps([]);
      return;
    }

    setSharedFollowUps(await response.json());
  };

  const allShifts = useMemo(
    () =>
      jobs.flatMap((job) =>
        job.stages.flatMap((stage) =>
          stage.activities.flatMap((activity) =>
            activity.shifts.map((shift) => ({
              ...shift,
              jobNumber: job.jobNumber,
              activityName: activity.name
            }))
          )
        )
      ),
    [jobs]
  );

  const visibleShifts = useMemo(() => {
    const ownershipFiltered =
      shiftOwnershipFilter === "MY_SHIFTS" && user?.id
        ? allShifts.filter((shift) => shift.lead?.id === user.id)
        : allShifts;

    const sorted = [...ownershipFiltered].sort(
      (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()
    );

    if (planningMode === "weekly") {
      return sorted.slice(0, 7);
    }

    return sorted;
  }, [allShifts, planningMode, shiftOwnershipFilter, user?.id]);

  const monthDays = useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: lastDay }, (_, index) => {
      const day = new Date(year, month, index + 1);
      return {
        key: formatMonthKey(day) + `-${String(index + 1).padStart(2, "0")}`,
        date: day,
        dayNumber: index + 1,
        shortLabel: day.toLocaleDateString([], { weekday: "short" })
      };
    });
  }, [monthAnchor]);

  const ganttRows = useMemo(() => {
    const monthStart = startOfMonth(monthAnchor);
    const nextMonth = addMonths(monthStart, 1);
    const monthEnd = new Date(nextMonth.getTime() - 1);
    const totalDays = monthDays.length;

    return jobs
      .flatMap((job) =>
        job.stages.flatMap((stage) => {
          const stageShifts = stage.activities.flatMap((activity) =>
            activity.shifts
              .filter((shift) => {
                const shiftStart = new Date(shift.startAt);
                return shiftStart >= monthStart && shiftStart < nextMonth;
              })
              .map((shift) => ({ shift, activity }))
          );

          if (!stageShifts.length && plannerFocus?.stageId !== stage.id) {
            return [];
          }

          const sorted = [...stageShifts].sort(
            (left, right) => new Date(left.shift.startAt).getTime() - new Date(right.shift.startAt).getTime()
          );
          const firstShift = sorted[0]?.shift;
          const lastShift = sorted[sorted.length - 1]?.shift;
          const start = firstShift ? new Date(firstShift.startAt) : monthStart;
          const end = lastShift ? new Date(lastShift.endAt) : start;
          const clampedStart = start < monthStart ? monthStart : start;
          const clampedEnd = end > monthEnd ? monthEnd : end;
          const startDay = Math.max(clampedStart.getDate(), 1);
          const endDay = Math.min(clampedEnd.getDate(), totalDays);
          const spanDays = Math.max(endDay - startDay + 1, 1);
          const blocked = sorted.some(({ shift }) => shift.conflicts.some((conflict) => conflict.severity === "RED"));
          const warning =
            !blocked &&
            sorted.some(({ shift }) => shift.conflicts.some((conflict) => conflict.severity === "AMBER"));

          return [
            {
              id: `${job.id}:${stage.id}`,
              label: `${job.jobNumber} | ${stage.name}`,
              meta: `${stage.activities.length} activities | ${sorted.length} shifts`,
              barLabel: sorted.length ? `${sorted.length} shifts scheduled` : "No shifts in month",
              startDay,
              spanDays,
              tone: blocked ? "red" : warning ? "amber" : "blue",
              stageId: stage.id,
              shiftId: firstShift?.id ?? null,
              activityOwnerLabel:
                sorted[0]?.activity.owner
                  ? `${sorted[0].activity.owner.firstName} ${sorted[0].activity.owner.lastName}`
                  : job.supervisor
                    ? `${job.supervisor.firstName} ${job.supervisor.lastName}`
                    : "No owner"
            }
          ];
        })
      )
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [jobs, monthAnchor, monthDays.length, plannerFocus?.stageId]);

  const myShiftCount = useMemo(
    () => (user?.id ? allShifts.filter((shift) => shift.lead?.id === user.id).length : 0),
    [allShifts, user?.id]
  );

  const competencyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    workers.forEach((worker) =>
      worker.competencies.forEach((entry) => {
        seen.set(entry.competency.id, entry.competency.name);
      })
    );
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [workers]);

  const filteredWorkers = useMemo(
    () =>
      workers.filter((worker) => {
        const searchMatch =
          !workerSearch ||
          `${worker.firstName} ${worker.lastName}`.toLowerCase().includes(workerSearch.toLowerCase());

        const effectiveCompetencyFilter = competencyFilter || requirementForm.competencyId;
        const competencyMatch =
          !effectiveCompetencyFilter ||
          worker.competencies.some((entry) => entry.competency.id === effectiveCompetencyFilter);

        return searchMatch && competencyMatch;
      }),
    [workers, workerSearch, competencyFilter, requirementForm.competencyId]
  );

  const assetCategoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    assets.forEach((asset) => {
      if (asset.category) {
        seen.set(asset.category.id, asset.category.name);
      }
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [assets]);

  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const searchMatch =
          !assetSearch ||
          `${asset.name} ${asset.homeBase ?? ""} ${asset.currentLocation ?? ""}`.toLowerCase().includes(assetSearch.toLowerCase());
        const categoryMatch = !assetCategoryFilter || asset.category?.id === assetCategoryFilter;
        return searchMatch && categoryMatch;
      }),
    [assets, assetSearch, assetCategoryFilter]
  );

  const plannerSelection = useMemo(() => {
    if (!plannerFocus?.jobId) return null;

    const job = jobs.find((item) => item.id === plannerFocus.jobId);
    if (!job) return null;

    const stage = job.stages.find((item) => item.id === plannerFocus.stageId) ?? null;
    const activity = stage?.activities.find((item) => item.id === plannerFocus.activityId) ?? null;
    const shift = plannerFocus.shiftId ? activity?.shifts.find((item) => item.id === plannerFocus.shiftId) ?? null : null;

    return { job, stage, activity, shift };
  }, [jobs, plannerFocus]);

  useEffect(() => {
    if (!plannerSelection) return;

    setCollapsedJobs((current) => ({
      ...current,
      [plannerSelection.job.id]: false
    }));

    if (plannerSelection.stage) {
      const stageKey = `${plannerSelection.job.id}:${plannerSelection.stage.id}`;
      setCollapsedStages((current) => ({
        ...current,
        [stageKey]: false
      }));
    }
  }, [plannerSelection]);

  useEffect(() => {
    if (!plannerSelection?.activity?.owner?.id) {
      return;
    }

    setShiftForm((current) => ({
      ...current,
      leadUserId: current.leadUserId || plannerSelection.activity?.owner?.id || ""
    }));
  }, [plannerSelection?.activity?.owner?.id]);

  const jobPlanningSummaries = useMemo(
    () =>
      jobs.map((job) => {
        const activities = job.stages.flatMap((stage) =>
          stage.activities.map((activity) => ({
            stageName: stage.name,
            ...activity
          }))
        );
        const shifts = activities.flatMap((activity) =>
          activity.shifts.map((shift) => ({
            ...shift,
            activityName: activity.name,
            stageName: activity.stageName
          }))
        );

        return {
          id: job.id,
          jobNumber: job.jobNumber,
          name: job.name,
          stageCount: job.stages.length,
          activityCount: activities.length,
          unscheduledActivities: activities.filter((activity) => activity.shifts.length === 0).length,
          shiftCount: shifts.length,
          readyShifts: shifts.filter((shift) => shift.conflicts.length === 0).length,
          blockedShifts: shifts.filter((shift) =>
            shift.conflicts.some((conflict) => conflict.severity === "RED")
          ).length,
          warningShifts: shifts.filter(
            (shift) =>
              !shift.conflicts.some((conflict) => conflict.severity === "RED") &&
              shift.conflicts.some((conflict) => conflict.severity === "AMBER")
          ).length
        };
      }),
    [jobs]
  );

  const shiftCoverage = useMemo(() => {
    if (!selectedShift) {
      return null;
    }

    const openRequirements = selectedShift.roleRequirements.map((requirement) => {
      const matchingAssignments = selectedShift.workerAssignments.filter(
        (assignment) => assignment.roleLabel?.toLowerCase() === requirement.roleLabel.toLowerCase()
      );
      const competencyReady = requirement.competency
        ? matchingAssignments.filter((assignment) =>
            assignment.worker.competencies.some(
              (entry) => entry.competency.id === requirement.competency?.id
            )
          ).length
        : matchingAssignments.length;

      return {
        ...requirement,
        assignedCount: matchingAssignments.length,
        competencyReady,
        remainingCount: Math.max(requirement.requiredCount - matchingAssignments.length, 0)
      };
    });

    const redConflicts = selectedShift.conflicts.filter((conflict) => conflict.severity === "RED").length;
    const amberConflicts = selectedShift.conflicts.filter((conflict) => conflict.severity === "AMBER").length;

    return {
      assignedWorkers: selectedShift.workerAssignments.length,
      assignedAssets: selectedShift.assetAssignments.length,
      openRequirementCount: openRequirements.filter((requirement) => requirement.remainingCount > 0).length,
      redConflicts,
      amberConflicts,
      openRequirements
    };
  }, [selectedShift]);

  const groupedAssignments = useMemo(() => {
    if (!selectedShift) {
      return [];
    }

    const roleMap = new Map<
      string,
      {
        roleLabel: string;
        requirement?: ShiftRequirementRecord;
        workers: ShiftRecord["workerAssignments"];
      }
    >();

    selectedShift.roleRequirements.forEach((requirement) => {
      roleMap.set(requirement.roleLabel, {
        roleLabel: requirement.roleLabel,
        requirement,
        workers: []
      });
    });

    selectedShift.workerAssignments.forEach((assignment) => {
      const roleLabel = assignment.roleLabel || "Unallocated role";
      const existing = roleMap.get(roleLabel);

      if (existing) {
        existing.workers.push(assignment);
        return;
      }

      roleMap.set(roleLabel, {
        roleLabel,
        workers: [assignment]
      });
    });

    return [...roleMap.values()];
  }, [selectedShift]);

  const recommendedWorkers = useMemo(() => {
    if (!selectedShift || !assignment.roleLabel) {
      return [];
    }

    const requiredCompetencyId = requirementForm.competencyId || null;

    return filteredWorkers
      .map((worker) => {
        const suitability = worker.roleSuitabilities.find(
          (entry) => entry.roleLabel.toLowerCase() === assignment.roleLabel.toLowerCase()
        );
        const hasCompetency = requiredCompetencyId
          ? worker.competencies.some((entry) => entry.competency.id === requiredCompetencyId)
          : true;
        const isAlreadyAssigned = selectedShift.workerAssignments.some(
          (entry) => entry.worker.id === worker.id
        );

        let score = 0;
        if (suitability?.suitability === "SUITABLE") score += 3;
        if (suitability?.suitability === "LIMITED") score += 1;
        if (hasCompetency) score += 3;
        if (!isAlreadyAssigned) score += 2;
        if (worker.availabilityWindows.some((window) => window.status === "AVAILABLE")) score += 1;

        return {
          worker,
          suitability: suitability?.suitability ?? "UNASSESSED",
          hasCompetency,
          isAlreadyAssigned,
          score
        };
      })
      .filter((entry) => !entry.isAlreadyAssigned)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
  }, [assignment.roleLabel, filteredWorkers, requirementForm.competencyId, selectedShift]);

  const recommendedAssets = useMemo(() => {
    if (!selectedShift) {
      return [];
    }

    return filteredAssets
      .map((asset) => {
        const isAlreadyAssigned = selectedShift.assetAssignments.some(
          (assignment) => assignment.asset.id === asset.id
        );
        const planningState = buildAssetPlanningState(asset);

        let score = 0;
        if (planningState.schedulerImpact === "NONE") score += 4;
        if (planningState.schedulerImpact === "WARN") score += 1;
        if (planningState.schedulerImpact === "BLOCK") score -= 4;
        if (asset.status === "AVAILABLE") score += 4;
        if (asset.status === "IN_SERVICE") score += 3;
        if (asset.category?.name) score += 1;
        if (asset.currentLocation || asset.homeBase) score += 1;
        if (!isAlreadyAssigned) score += 2;

        return {
          asset,
          isAlreadyAssigned,
          planningState,
          score
        };
      })
      .filter((entry) => !entry.isAlreadyAssigned)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
  }, [filteredAssets, selectedShift]);

  const shiftConflictSummary = useMemo(() => {
    if (!selectedShift) {
      return {
        red: [],
        amber: []
      };
    }

    return {
      red: selectedShift.conflicts.filter((conflict) => conflict.severity === "RED"),
      amber: selectedShift.conflicts.filter((conflict) => conflict.severity === "AMBER")
    };
  }, [selectedShift]);

  const selectedShiftContext = useMemo(() => {
    if (!selectedShift) return null;

    for (const job of jobs) {
      for (const stage of job.stages) {
        for (const activity of stage.activities) {
          const shift = activity.shifts.find((item) => item.id === selectedShift.id);
          if (shift) {
            return { job, stage, activity, shift };
          }
        }
      }
    }

    return null;
  }, [jobs, selectedShift]);

  const shiftContextById = useMemo(() => {
    const contextMap = new Map<
      string,
      {
        job: JobRecord;
        stage: StageRecord;
        activity: ActivityRecord;
      }
    >();

    jobs.forEach((job) => {
      job.stages.forEach((stage) => {
        stage.activities.forEach((activity) => {
          activity.shifts.forEach((shift) => {
            contextMap.set(shift.id, { job, stage, activity });
          });
        });
      });
    });

    return contextMap;
  }, [jobs]);

  const schedulerSignals = useMemo(() => {
    const blocked = allShifts.filter((shift) => shift.conflicts.some((conflict) => conflict.severity === "RED")).length;
    const warning = allShifts.filter(
      (shift) =>
        !shift.conflicts.some((conflict) => conflict.severity === "RED") &&
        shift.conflicts.some((conflict) => conflict.severity === "AMBER")
    ).length;
    const unscheduled = jobPlanningSummaries.reduce((total, summary) => total + summary.unscheduledActivities, 0);

    return {
      visibleShifts: visibleShifts.length,
      blocked,
      warning,
      unscheduled
    };
  }, [allShifts, jobPlanningSummaries, visibleShifts.length]);

  const monthlyMatrixRows = useMemo(() => {
    const monthStart = startOfMonth(monthAnchor);
    const nextMonth = addMonths(monthStart, 1);
    const shiftsInMonth = allShifts.filter((shift) => {
      const shiftStart = new Date(shift.startAt);
      return shiftStart >= monthStart && shiftStart < nextMonth;
    });

    const dayKeyForShift = (shift: ShiftRecord) => {
      const shiftStart = new Date(shift.startAt);
      return `${formatMonthKey(shiftStart)}-${String(shiftStart.getDate()).padStart(2, "0")}`;
    };

    if (resourceView === "project") {
      const rows = jobs.flatMap((job) =>
        job.stages.flatMap((stage) =>
          stage.activities.map((activity) => {
            const rowShifts = activity.shifts.filter((shift) => {
              const shiftStart = new Date(shift.startAt);
              return shiftStart >= monthStart && shiftStart < nextMonth;
            });
            const cells = new Map<string, ShiftRecord[]>();
            rowShifts.forEach((shift) => {
              const key = dayKeyForShift(shift);
              const existing = cells.get(key) ?? [];
              existing.push(shift);
              cells.set(key, existing);
            });

            return {
              id: activity.id,
              label: activity.name,
              meta: `${job.jobNumber} | ${stage.name}`,
              ownerLabel: activity.owner ? `${activity.owner.firstName} ${activity.owner.lastName}` : "No owner",
              shifts: rowShifts,
              cells
            };
          })
        )
      );

      return rows.filter((row) => row.shifts.length > 0 || plannerFocus?.activityId === row.id);
    }

    const grouped = new Map<
      string,
      {
        id: string;
        label: string;
        meta: string;
        ownerLabel: string;
        shifts: ShiftRecord[];
        cells: Map<string, ShiftRecord[]>;
      }
    >();

    shiftsInMonth.forEach((shift) => {
      const context = shiftContextById.get(shift.id);
      const owner =
        shift.lead
          ? `${shift.lead.firstName} ${shift.lead.lastName}`
          : context?.activity.owner
            ? `${context.activity.owner.firstName} ${context.activity.owner.lastName}`
            : context?.job.supervisor
              ? `${context.job.supervisor.firstName} ${context.job.supervisor.lastName}`
              : "Unassigned owner";
      const id = shift.lead?.id ?? context?.activity.owner?.id ?? context?.job.supervisor?.id ?? `unassigned-${owner}`;
      const existing =
        grouped.get(id) ??
        {
          id,
          label: owner,
          meta: shift.lead ? "Shift lead view" : context?.activity.owner ? "Activity owner fallback" : "Planning owner fallback",
          ownerLabel: owner,
          shifts: [],
          cells: new Map<string, ShiftRecord[]>()
        };

      existing.shifts.push(shift);
      const cellKey = dayKeyForShift(shift);
      const current = existing.cells.get(cellKey) ?? [];
      current.push(shift);
      existing.cells.set(cellKey, current);
      grouped.set(id, existing);
    });

    return Array.from(grouped.values()).sort((left, right) => right.shifts.length - left.shifts.length || left.label.localeCompare(right.label));
  }, [allShifts, jobs, monthAnchor, plannerFocus?.activityId, resourceView, shiftContextById]);

  useEffect(() => {
    setPlanningOwnerDraft(selectedShiftContext?.job.supervisor?.id ?? "");
  }, [selectedShiftContext?.job.supervisor?.id]);

  useEffect(() => {
    setShiftLeadDraft(selectedShift?.lead?.id ?? plannerSelection?.activity?.owner?.id ?? "");
  }, [plannerSelection?.activity?.owner?.id, selectedShift?.lead?.id]);

  const sharedFollowUpsByPrompt = useMemo(
    () =>
      new Map(
        sharedFollowUps
          .filter((item) => item.metadata?.kind === "LIVE_FOLLOW_UP" && item.metadata?.promptKey)
          .map((item) => [item.metadata?.promptKey as string, item])
      ),
    [sharedFollowUps]
  );

  const selectedShiftFollowUpPromptKey = useMemo(() => {
    if (!selectedShiftContext) {
      return null;
    }

    if (shiftConflictSummary.red.length) {
      return `blocked-${selectedShiftContext.job.id}-${selectedShiftContext.shift.id}`;
    }

    if (shiftConflictSummary.amber.length) {
      return `warning-${selectedShiftContext.job.id}-${selectedShiftContext.shift.id}`;
    }

    return null;
  }, [selectedShiftContext, shiftConflictSummary.amber.length, shiftConflictSummary.red.length]);

  const submitShift = async (event: React.FormEvent) => {
    event.preventDefault();

    const response = await authFetch("/scheduler/shifts", {
      method: "POST",
      body: JSON.stringify({
        ...shiftForm,
        leadUserId: shiftForm.leadUserId || undefined
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to create shift.");
      return;
    }

    setShiftForm(emptyShiftForm);
    await load();
  };

  const assignResources = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedShift) return;

    if (assignment.workerId) {
      await authFetch(`/scheduler/shifts/${selectedShift.id}/workers`, {
        method: "POST",
        body: JSON.stringify({
          workerId: assignment.workerId,
          roleLabel: assignment.roleLabel || undefined
        })
      });
    }

    if (assignment.assetId) {
      await authFetch(`/scheduler/shifts/${selectedShift.id}/assets`, {
        method: "POST",
        body: JSON.stringify({ assetId: assignment.assetId })
      });
    }

    setAssignment((current) => ({ ...emptyAssignment, roleLabel: current.roleLabel }));
    await load();
  };

  const submitRequirement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedShift) return;

    const path = requirementForm.id
      ? `/resources/shifts/${selectedShift.id}/requirements/${requirementForm.id}`
      : `/resources/shifts/${selectedShift.id}/requirements`;
    const method = requirementForm.id ? "PATCH" : "POST";

    const response = await authFetch(path, {
      method,
      body: JSON.stringify({
        roleLabel: requirementForm.roleLabel,
        competencyId: requirementForm.competencyId || undefined,
        requiredCount: Number(requirementForm.requiredCount || "1")
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to save shift requirement.");
      return;
    }

    const refreshedJobs = await load();
    const refreshedShift = findShiftInJobs(refreshedJobs, selectedShift.id);
    if (refreshedShift) {
      setSelectedShift(refreshedShift);
    }
    setRequirementForm(emptyRequirementForm);
  };

  const refreshSelectedShift = async (shiftId: string) => {
    const refreshedJobs = await load();
    const refreshedShift = findShiftInJobs(refreshedJobs, shiftId);
    if (refreshedShift) {
      setSelectedShift(refreshedShift);
    }
  };

  const unassignWorker = async (workerId: string) => {
    if (!selectedShift) return;

    const response = await authFetch(`/scheduler/shifts/${selectedShift.id}/workers/${workerId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to unassign worker.");
      return;
    }

    await refreshSelectedShift(selectedShift.id);
  };

  const unassignAsset = async (assetId: string) => {
    if (!selectedShift) return;

    const response = await authFetch(`/scheduler/shifts/${selectedShift.id}/assets/${assetId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to unassign asset.");
      return;
    }

    await refreshSelectedShift(selectedShift.id);
  };

  const conflictClass = (shift: ShiftRecord) => {
    if (shift.conflicts.some((conflict) => conflict.severity === "RED")) return "scheduler-block scheduler-block--red";
    if (shift.conflicts.some((conflict) => conflict.severity === "AMBER")) return "scheduler-block scheduler-block--amber";
    return "scheduler-block scheduler-block--green";
  };

  const openSelectedShiftInJobs = () => {
    if (!selectedShiftContext) return;

    navigate("/jobs", {
      state: {
        jobFocus: {
          jobId: selectedShiftContext.job.id,
          stageId: selectedShiftContext.stage.id,
          activityId: selectedShiftContext.activity.id,
          shiftId: selectedShiftContext.shift.id,
          from: "scheduler"
        }
      }
    });
  };

  const updateSelectedShiftFollowUpAssignment = async () => {
    if (!selectedShiftFollowUpPromptKey) {
      return;
    }

    const sharedItem = sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey);
    const targetUserId = followUpAssignmentDrafts[selectedShiftFollowUpPromptKey];
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

  const updateSelectedShiftPlanningOwner = async () => {
    if (!selectedShiftContext) {
      return;
    }

    const response = await authFetch(`/jobs/${selectedShiftContext.job.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        supervisorId: planningOwnerDraft || undefined
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to update planning owner.");
      return;
    }

    const refreshedJobs = await load();
    const refreshedShift = findShiftInJobs(refreshedJobs, selectedShiftContext.shift.id);
    if (refreshedShift) {
      setSelectedShift(refreshedShift);
    }
    await loadSharedFollowUps();
  };

  const updateSelectedShiftLead = async () => {
    if (!selectedShift) {
      return;
    }

    const response = await authFetch(`/scheduler/shifts/${selectedShift.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        jobId: selectedShiftContext?.job.id ?? shiftForm.jobId,
        jobStageId: selectedShiftContext?.stage.id ?? null,
        jobActivityId: selectedShiftContext?.activity.id ?? shiftForm.jobActivityId,
        title: selectedShift.title,
        startAt: selectedShift.startAt,
        endAt: selectedShift.endAt,
        status: selectedShift.status,
        notes: selectedShift.notes ?? undefined,
        workInstructions: selectedShift.workInstructions ?? undefined,
        leadUserId: shiftLeadDraft || undefined
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to update shift lead.");
      return;
    }

    await refreshSelectedShift(selectedShift.id);
    await loadSharedFollowUps();
  };

  return (
    <div className="scheduler-shell">
      {error ? <p className="error-text">{error}</p> : null}
      <div className="scheduler-toolbar">
        <div className="tab-row">
          <button className={viewMode === "timeline" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setViewMode("timeline")}>
            Timeline
          </button>
          <button className={viewMode === "calendar" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setViewMode("calendar")}>
            Calendar
          </button>
          <button className={viewMode === "gantt" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setViewMode("gantt")}>
            Program
          </button>
        </div>
        <div className="tab-row">
          <button className={resourceView === "project" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setResourceView("project")}>
            Job View
          </button>
          <button className={resourceView === "resource" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setResourceView("resource")}>
            Resource View
          </button>
        </div>
        <div className="tab-row">
          <button className={planningMode === "weekly" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setPlanningMode("weekly")}>
            Weekly
          </button>
          <button className={planningMode === "monthly" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setPlanningMode("monthly")}>
            Monthly
          </button>
        </div>
        <div className="tab-row">
          <button className={shiftOwnershipFilter === "ALL" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setShiftOwnershipFilter("ALL")}>
            All shifts
          </button>
          <button className={shiftOwnershipFilter === "MY_SHIFTS" ? "tab-button tab-button--active" : "tab-button"} onClick={() => setShiftOwnershipFilter("MY_SHIFTS")}>
            My shifts
          </button>
        </div>
      </div>

      <div className="scheduler-overview-band">
        <div className="scheduler-overview-band__intro">
          <span className="eyebrow">Planner workspace</span>
          <h3>Keep the scheduler dense, but much easier to scan.</h3>
          <p className="muted-text">
            The left rail now behaves more like a real planning directory, while the live shift canvas stays focused on execution.
          </p>
        </div>
        <div className="scheduler-overview-band__stats">
          <div className="scheduler-overview-stat">
            <strong>{schedulerSignals.visibleShifts}</strong>
            <span>Visible shifts</span>
          </div>
          <div className="scheduler-overview-stat">
            <strong>{schedulerSignals.blocked}</strong>
            <span>Blocked shifts</span>
          </div>
          <div className="scheduler-overview-stat">
            <strong>{schedulerSignals.warning}</strong>
            <span>Warning shifts</span>
          </div>
          <div className="scheduler-overview-stat">
            <strong>{schedulerSignals.unscheduled}</strong>
            <span>Unscheduled activities</span>
          </div>
        </div>
      </div>

      <div className="scheduler-grid">
        <AppCard title="Jobs / Stages / Activities" subtitle="Planning hierarchy">
          <div className="scheduler-pane">
            {jobs.map((job) => (
              <div key={job.id} className="scheduler-tree">
                {(() => {
                  const summary = jobPlanningSummaries.find((item) => item.id === job.id);
                  if (!summary) return null;

                  const isJobCollapsed = collapsedJobs[job.id] ?? false;
                  const signalClass =
                    summary.blockedShifts > 0
                      ? "pill pill--red"
                      : summary.warningShifts > 0 || summary.unscheduledActivities > 0
                        ? "pill pill--amber"
                        : "pill pill--green";
                  const signalLabel =
                    summary.blockedShifts > 0
                      ? `${summary.blockedShifts} blocked`
                      : summary.warningShifts > 0
                        ? `${summary.warningShifts} warnings`
                        : summary.unscheduledActivities > 0
                          ? `${summary.unscheduledActivities} unscheduled`
                          : "Ready";

                  return (
                    <>
                      <button
                        type="button"
                        className="scheduler-tree__header"
                        onClick={() =>
                          setCollapsedJobs((current) => ({
                            ...current,
                            [job.id]: !isJobCollapsed
                          }))
                        }
                      >
                        <div>
                          <strong>{job.jobNumber} - {job.name}</strong>
                          <p className="muted-text">
                            {summary.stageCount} stages | {summary.activityCount} activities | {summary.shiftCount} shifts
                          </p>
                        </div>
                        <div className="scheduler-tree__header-meta">
                          <span className={signalClass}>{signalLabel}</span>
                          <span className="scheduler-tree__toggle">{isJobCollapsed ? "+" : "-"}</span>
                        </div>
                      </button>
                      {!isJobCollapsed ? (
                        <>
                          {job.stages.map((stage) => {
                            const stageKey = `${job.id}:${stage.id}`;
                            const isStageCollapsed = collapsedStages[stageKey] ?? false;
                            const unscheduledCount = stage.activities.filter((activity) => activity.shifts.length === 0).length;

                            return (
                              <div key={stage.id} className="scheduler-tree__branch">
                                <button
                                  type="button"
                                  className="scheduler-tree__stage"
                                  onClick={() =>
                                    setCollapsedStages((current) => ({
                                      ...current,
                                      [stageKey]: !isStageCollapsed
                                    }))
                                  }
                                >
                                  <div>
                                    <strong>{stage.name}</strong>
                                    <p className="muted-text">{stage.activities.length} activities</p>
                                  </div>
                                  <div className="scheduler-tree__header-meta">
                                    <span className="pill pill--slate">{unscheduledCount} unscheduled</span>
                                    <span className="scheduler-tree__toggle">{isStageCollapsed ? "+" : "-"}</span>
                                  </div>
                                </button>
                                {!isStageCollapsed
                                  ? stage.activities.map((activity) => (
                                      <button
                                        key={activity.id}
                                        type="button"
                                        className={`scheduler-tree__leaf${plannerFocus?.activityId === activity.id ? " scheduler-tree__leaf--active" : ""}`}
                                        onClick={() =>
                                          setShiftForm((current) => ({
                                            ...current,
                                            jobId: job.id,
                                            jobStageId: stage.id,
                                            jobActivityId: activity.id,
                                            title: current.title || activity.name
                                          }))
                                        }
                                      >
                                        <div className="split-header">
                                          <strong>{activity.name}</strong>
                                          <span className="pill pill--slate">{activity.shifts.length} shifts</span>
                                        </div>
                                        <p className="muted-text">
                                          {activity.owner
                                            ? `Owner ${activity.owner.firstName} ${activity.owner.lastName}`
                                            : "No explicit owner"}
                                        </p>
                                        <p className="muted-text">
                                          {activity.shifts.length
                                            ? `${activity.shifts.filter((shift) => shift.conflicts.length === 0).length} ready`
                                            : "No shifts yet"}
                                        </p>
                                      </button>
                                    ))
                                  : null}
                              </div>
                            );
                          })}
                        </>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </AppCard>

        <AppCard
          title={viewMode === "timeline" ? "Timeline Workspace" : viewMode === "calendar" ? "Calendar Workspace" : "Program Workspace"}
          subtitle={
            shiftOwnershipFilter === "MY_SHIFTS"
              ? `Focused on shifts led by you${myShiftCount ? ` (${myShiftCount})` : ""}`
              : planningMode === "weekly"
                ? "Weekly planning mode"
                : "Monthly planning mode"
          }
        >
          <div className="scheduler-pane">
            {plannerSelection ? (
              <div className="tendering-activity-band">
                <div className="tendering-activity-band__intro">
                  <span className="eyebrow">Planner handoff</span>
                  <h4>
                    {plannerSelection.job.jobNumber} | {plannerSelection.activity?.name ?? "Selected activity"}
                  </h4>
                  <p className="muted-text">
                    You arrived from Jobs with a planning gap selected. The shift form is prefilled so you can move straight from delivery intent into scheduling.
                  </p>
                </div>
                <div className="tendering-activity-band__stats">
                  <div className="tendering-activity-band__stat">
                    <strong>{plannerSelection.stage?.name ?? "No stage"}</strong>
                    <span>Stage</span>
                  </div>
                  <div className="tendering-activity-band__stat">
                    <strong>{plannerSelection.shift?.title ?? plannerSelection.activity?.shifts.length ?? 0}</strong>
                    <span>{plannerSelection.shift ? "Focused shift" : "Existing shifts"}</span>
                  </div>
                  <div className="tendering-activity-band__stat">
                    <strong>{plannerSelection.activity?.name ?? "Not selected"}</strong>
                    <span>Planning focus</span>
                  </div>
                </div>
              </div>
            ) : null}

            <form className="admin-form" onSubmit={submitShift}>
              <label>
                Shift title
                <input value={shiftForm.title} onChange={(event) => setShiftForm({ ...shiftForm, title: event.target.value })} />
              </label>
              <label>
                Start
                <input type="datetime-local" value={shiftForm.startAt} onChange={(event) => setShiftForm({ ...shiftForm, startAt: event.target.value })} />
              </label>
              <label>
                End
                <input type="datetime-local" value={shiftForm.endAt} onChange={(event) => setShiftForm({ ...shiftForm, endAt: event.target.value })} />
              </label>
              <label>
                Work instructions
                <input value={shiftForm.workInstructions} onChange={(event) => setShiftForm({ ...shiftForm, workInstructions: event.target.value })} />
              </label>
              <label>
                Shift lead
                <select
                  value={shiftForm.leadUserId}
                  onChange={(event) => setShiftForm({ ...shiftForm, leadUserId: event.target.value })}
                >
                  <option value="">Unassigned</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.firstName} {item.lastName}
                    </option>
                  ))}
                </select>
              </label>
              {plannerSelection ? (
                <div className="notice-banner notice-banner--warning">
                  <strong>Planning note</strong>
                  <p>
                    Build this shift around <strong>{plannerSelection.activity?.name ?? "the selected activity"}</strong> in{" "}
                    <strong>{plannerSelection.stage?.name ?? "the selected stage"}</strong>
                    {plannerSelection.activity?.owner ? (
                      <> with <strong>{plannerSelection.activity.owner.firstName} {plannerSelection.activity.owner.lastName}</strong> currently owning that activity</>
                    ) : null}
                    {plannerSelection.shift ? (
                      <>. The selected shift is <strong>{plannerSelection.shift.title}</strong>, so you can work straight on the flagged plan instead of searching for it.</>
                    ) : (
                      <> then use the resource panel to clear warnings before dispatch.</>
                    )}
                  </p>
                </div>
              ) : null}
              <button type="submit">Create Shift</button>
            </form>
            {viewMode === "gantt" ? (
              <div className="scheduler-gantt-shell">
                <div className="scheduler-matrix-toolbar">
                  <div>
                    <strong>{monthAnchor.toLocaleDateString([], { month: "long", year: "numeric" })}</strong>
                    <p className="muted-text">
                      Program view across stages, using the same monthly window as the allocation matrix.
                    </p>
                  </div>
                  <div className="inline-fields">
                    <button type="button" className="tab-button" onClick={() => setMonthAnchor((current) => addMonths(current, -1))}>
                      Previous month
                    </button>
                    <button type="button" className="tab-button" onClick={() => setMonthAnchor(startOfMonth(new Date()))}>
                      This month
                    </button>
                    <button type="button" className="tab-button" onClick={() => setMonthAnchor((current) => addMonths(current, 1))}>
                      Next month
                    </button>
                  </div>
                </div>

                <div className="scheduler-gantt">
                  <div className="scheduler-gantt__header scheduler-gantt__header--stub">
                    <span>Stage program</span>
                  </div>
                  {monthDays.map((day) => (
                    <div key={`gantt-${day.key}`} className="scheduler-gantt__header">
                      <strong>{day.dayNumber}</strong>
                      <span>{day.shortLabel}</span>
                    </div>
                  ))}

                  {ganttRows.map((row) => (
                    <Fragment key={row.id}>
                      <div className="scheduler-gantt__label">
                        <strong>{row.label}</strong>
                        <span>{row.meta}</span>
                        <small>{row.activityOwnerLabel}</small>
                      </div>
                      <button
                        type="button"
                        className="scheduler-gantt__track"
                        style={{ gridColumn: `2 / span ${monthDays.length}` }}
                        onClick={() => {
                          if (row.shiftId) {
                            const shift = allShifts.find((item) => item.id === row.shiftId);
                            if (shift) {
                              setSelectedShift(shift);
                              setViewMode("timeline");
                              return;
                            }
                          }

                          const stageJob = jobs.find((job) => job.stages.some((stage) => stage.id === row.stageId));
                          const stage = stageJob?.stages.find((item) => item.id === row.stageId);
                          const firstActivity = stage?.activities[0];
                          if (stageJob && stage && firstActivity) {
                            setShiftForm((current) => ({
                              ...current,
                              jobId: stageJob.id,
                              jobStageId: stage.id,
                              jobActivityId: firstActivity.id,
                              title: current.title || firstActivity.name
                            }));
                          }
                        }}
                      >
                        <span
                          className={`scheduler-gantt__bar scheduler-gantt__bar--${row.tone}`}
                          style={{
                            left: `calc(${((row.startDay - 1) / monthDays.length) * 100}% + 4px)`,
                            width: `calc(${(row.spanDays / monthDays.length) * 100}% - 8px)`
                          }}
                        >
                          {row.barLabel}
                        </span>
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>
            ) : planningMode === "monthly" ? (
              <div className="scheduler-matrix-shell">
                <div className="scheduler-matrix-toolbar">
                  <div>
                    <strong>{monthAnchor.toLocaleDateString([], { month: "long", year: "numeric" })}</strong>
                    <p className="muted-text">
                      {resourceView === "project"
                        ? "Activity rows with day-by-day shift density"
                        : "Ownership rows showing who carries the monthly workload"}
                    </p>
                  </div>
                  <div className="inline-fields">
                    <button type="button" className="tab-button" onClick={() => setMonthAnchor((current) => addMonths(current, -1))}>
                      Previous month
                    </button>
                    <button type="button" className="tab-button" onClick={() => setMonthAnchor(startOfMonth(new Date()))}>
                      This month
                    </button>
                    <button type="button" className="tab-button" onClick={() => setMonthAnchor((current) => addMonths(current, 1))}>
                      Next month
                    </button>
                  </div>
                </div>

                <div className="scheduler-matrix">
                  <div className="scheduler-matrix__header scheduler-matrix__header--stub">
                    <span>{resourceView === "project" ? "Activity" : "Owner"}</span>
                  </div>
                  {monthDays.map((day) => (
                    <div key={day.key} className="scheduler-matrix__header">
                      <strong>{day.dayNumber}</strong>
                      <span>{day.shortLabel}</span>
                    </div>
                  ))}

                  {monthlyMatrixRows.map((row) => (
                    <Fragment key={row.id}>
                      <div key={`${row.id}-stub`} className="scheduler-matrix__row-label">
                        <strong>{row.label}</strong>
                        <span>{row.meta}</span>
                        <small>{row.shifts.length} shifts | {row.ownerLabel}</small>
                      </div>
                      {monthDays.map((day) => {
                        const cellShifts = row.cells.get(day.key) ?? [];
                        const hasRed = cellShifts.some((shift) => shift.conflicts.some((conflict) => conflict.severity === "RED"));
                        const hasAmber = cellShifts.some(
                          (shift) =>
                            !shift.conflicts.some((conflict) => conflict.severity === "RED") &&
                            shift.conflicts.some((conflict) => conflict.severity === "AMBER")
                        );
                        const cellClass = hasRed
                          ? "scheduler-matrix__cell scheduler-matrix__cell--red"
                          : hasAmber
                            ? "scheduler-matrix__cell scheduler-matrix__cell--amber"
                            : cellShifts.length
                              ? "scheduler-matrix__cell scheduler-matrix__cell--green"
                              : "scheduler-matrix__cell";

                        return (
                          <button
                            key={`${row.id}-${day.key}`}
                            type="button"
                            className={cellClass}
                            onClick={() => {
                              if (!cellShifts.length) return;
                              setSelectedShift(cellShifts[0]);
                              setViewMode("timeline");
                            }}
                            disabled={!cellShifts.length}
                          >
                            {cellShifts.length ? (
                              <>
                                <strong>{cellShifts.length}</strong>
                                <span>{hasRed ? "Blocked" : hasAmber ? "Watch" : "Ready"}</span>
                              </>
                            ) : (
                              <span>-</span>
                            )}
                          </button>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className={viewMode === "timeline" ? "scheduler-timeline" : "scheduler-calendar"}>
                {visibleShifts.map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    className={`${conflictClass(shift)}${selectedShift?.id === shift.id ? " scheduler-block--focused" : ""}`}
                    onClick={() => setSelectedShift(shift)}
                  >
                    <div className="split-header">
                      <strong>{shift.title}</strong>
                      {selectedShift?.id === shift.id ? <span className="pill pill--blue">Focused shift</span> : null}
                    </div>
                    {shiftContextById.get(shift.id) ? (
                      <span className="scheduler-shift-meta">
                        {shiftContextById.get(shift.id)?.job.jobNumber} | {shiftContextById.get(shift.id)?.stage.name} | {shiftContextById.get(shift.id)?.activity.name}
                      </span>
                    ) : null}
                    <span>{new Date(shift.startAt).toLocaleString()} - {new Date(shift.endAt).toLocaleTimeString()}</span>
                    <span>{shift.workerAssignments.length} workers / {shift.assetAssignments.length} assets</span>
                    <span>{shift.roleRequirements.map((requirement) => `${requirement.roleLabel}${requirement.competency ? ` - ${requirement.competency.name}` : ""}`).join(", ") || "No role requirements"}</span>
                    <span className={getShiftSignalClass(shift)}>
                      {shift.conflicts.map((conflict) => conflict.code).join(", ") || "Ready"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </AppCard>

        <AppCard title="Resources Panel" subtitle="Workers and assets for fast assignment">
          <div className="scheduler-pane">
            {selectedShift ? (
              <div className="dashboard-preview">
                <h3>{selectedShift.title}</h3>
                <p>{selectedShift.notes || "No notes"}</p>
                <p>Instructions: {selectedShift.workInstructions || "None"}</p>
                {selectedShiftContext ? (
                  <p>
                    Job context: {selectedShiftContext.job.jobNumber} | {selectedShiftContext.stage.name} | {selectedShiftContext.activity.name}
                  </p>
                ) : null}
                <p>
                  Activity owner: {selectedShiftContext?.activity.owner ? `${selectedShiftContext.activity.owner.firstName} ${selectedShiftContext.activity.owner.lastName}` : "Unassigned"} | Shift lead: {selectedShift.lead ? `${selectedShift.lead.firstName} ${selectedShift.lead.lastName}` : "Unassigned"}
                </p>
                <p className="muted-text">
                  {selectedShift.lead
                    ? selectedShift.lead.id === user?.id
                      ? "You currently lead this shift, so planning follow-up will route to you first."
                      : `${selectedShift.lead.firstName} ${selectedShift.lead.lastName} is currently carrying the execution lead for this shift.`
                    : selectedShiftContext?.activity.owner
                      ? `No shift lead is set yet, so ${selectedShiftContext.activity.owner.firstName} ${selectedShiftContext.activity.owner.lastName} is still the best execution owner for follow-up.`
                      : "No shift lead is set yet, so follow-up will keep falling back to broader planning ownership."}
                </p>
                <p>
                  Requirements: {selectedShift.roleRequirements.map((requirement) => `${requirement.roleLabel} x${requirement.requiredCount}${requirement.competency ? ` (${requirement.competency.name})` : ""}`).join("; ") || "None"}
                </p>
                <p>
                  Conflicts: {selectedShift.conflicts.map((conflict) => `${conflict.severity} ${conflict.message}`).join("; ") || "None"}
                </p>
                {selectedShiftContext ? (
                  <button type="button" onClick={openSelectedShiftInJobs}>
                    Open in Jobs
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="muted-text">Select a shift card to assign resources.</p>
            )}

            {selectedShift ? (
              <div className="subsection">
                <div className="split-header">
                  <strong>Why this shift is flagged</strong>
                  <span className="muted-text">
                    {shiftConflictSummary.red.length} blocking | {shiftConflictSummary.amber.length} warning
                  </span>
                </div>
                <div className="dashboard-list">
                  {shiftConflictSummary.red.map((conflict) => (
                    <div key={`${conflict.code}-${conflict.message}`} className="tendering-feed-item tendering-feed-item--amber">
                      <div className="split-header">
                        <strong>{conflict.code}</strong>
                        <span className="pill pill--red">Blocking</span>
                      </div>
                      <p className="muted-text">{conflict.message}</p>
                    </div>
                  ))}
                  {shiftConflictSummary.amber.map((conflict) => (
                    <div key={`${conflict.code}-${conflict.message}`} className="tendering-feed-item tendering-feed-item--blue">
                      <div className="split-header">
                        <strong>{conflict.code}</strong>
                        <span className="pill pill--amber">Warning</span>
                      </div>
                      <p className="muted-text">{conflict.message}</p>
                    </div>
                  ))}
                  {!shiftConflictSummary.red.length && !shiftConflictSummary.amber.length ? (
                    <div className="tendering-feed-item tendering-feed-item--green">
                      <div className="split-header">
                        <strong>Ready to dispatch</strong>
                        <span className="pill pill--green">Clear</span>
                      </div>
                      <p className="muted-text">
                        No blocking or warning conflicts are currently attached to this shift.
                      </p>
                    </div>
                  ) : null}
                </div>
                {selectedShiftFollowUpPromptKey ? (
                  <div className="subsection">
                    <div className="split-header">
                      <strong>Planning owner</strong>
                      <span className="muted-text">Update the parent job&apos;s planning owner, or override this one prompt directly</span>
                    </div>
                    <div className="inline-fields">
                      <span className="pill pill--slate">
                        Job owner:{" "}
                        {selectedShiftContext?.job.supervisor
                          ? `${selectedShiftContext.job.supervisor.firstName} ${selectedShiftContext.job.supervisor.lastName}`
                          : "Unassigned"}
                      </span>
                    </div>
                    <div className="inline-fields">
                      <select
                        value={planningOwnerDraft}
                        onChange={(event) => setPlanningOwnerDraft(event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {users.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.firstName} {item.lastName}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => void updateSelectedShiftPlanningOwner()}>
                        Save job planning owner
                      </button>
                    </div>
                    {sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey) ? (
                      <>
                        <div className="inline-fields">
                          <span
                            className={`pill ${
                              sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey)?.metadata?.assignmentMode === "MANUAL"
                                ? "pill--blue"
                                : "pill--slate"
                            }`}
                          >
                            {sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey)?.metadata?.assignmentMode === "MANUAL"
                              ? "Manual assignment"
                              : "Derived owner"}
                          </span>
                          <span className="pill pill--slate">
                            {sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey)?.metadata?.nextOwnerLabel ?? "Team owner"}
                          </span>
                          {sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey)?.metadata?.assignedByLabel ? (
                            <span className="muted-text">
                              reassigned by {sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey)?.metadata?.assignedByLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="inline-fields">
                          <select
                            value={
                              followUpAssignmentDrafts[selectedShiftFollowUpPromptKey] ??
                              sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey)?.metadata?.nextOwnerId ??
                              sharedFollowUpsByPrompt.get(selectedShiftFollowUpPromptKey)?.userId ??
                              ""
                            }
                            onChange={(event) =>
                              setFollowUpAssignmentDrafts((current) => ({
                                ...current,
                                [selectedShiftFollowUpPromptKey]: event.target.value
                              }))
                            }
                          >
                            {users.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.firstName} {item.lastName}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => void updateSelectedShiftFollowUpAssignment()}>
                            Reassign owner
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="muted-text">No shared follow-up is currently active for this shift.</p>
                    )}
                  </div>
                ) : null}
                <div className="subsection">
                  <div className="split-header">
                    <strong>Shift lead</strong>
                    <span className="muted-text">Set the execution lead for this shift</span>
                  </div>
                  <div className="inline-fields">
                    <select value={shiftLeadDraft} onChange={(event) => setShiftLeadDraft(event.target.value)}>
                      <option value="">Unassigned</option>
                      {users.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.firstName} {item.lastName}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => void updateSelectedShiftLead()}>
                      Save shift lead
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {shiftCoverage ? (
              <div className="subsection">
                <div className="split-header">
                  <strong>Coverage guidance</strong>
                  <span className="muted-text">
                    {shiftCoverage.assignedWorkers} workers | {shiftCoverage.assignedAssets} assets assigned
                  </span>
                </div>
                <div className="tendering-focus-list tendering-focus-list--activity">
                  <div className="tendering-focus-list__item">
                    <strong>{shiftCoverage.openRequirementCount}</strong>
                    <span>Open role requirements</span>
                  </div>
                  <div className="tendering-focus-list__item">
                    <strong>{shiftCoverage.redConflicts}</strong>
                    <span>Blocking conflicts</span>
                  </div>
                  <div className="tendering-focus-list__item">
                    <strong>{shiftCoverage.amberConflicts}</strong>
                    <span>Warnings to clear</span>
                  </div>
                  <div className="tendering-focus-list__item">
                    <strong>{filteredWorkers.length}</strong>
                    <span>Filtered workers available</span>
                  </div>
                </div>
                <div className="dashboard-list">
                  {shiftCoverage.openRequirements.map((requirement) => (
                    <div key={requirement.id} className="tendering-focus-list__item">
                      <div className="split-header">
                        <strong>{requirement.roleLabel}</strong>
                        <span
                          className={
                            requirement.remainingCount > 0 ? "pill pill--amber" : "pill pill--green"
                          }
                        >
                          {requirement.assignedCount}/{requirement.requiredCount} covered
                        </span>
                      </div>
                      <p className="muted-text">
                        {requirement.competency
                          ? `${requirement.competencyReady} competency-ready for ${requirement.competency.name}`
                          : "No competency gate on this requirement"}
                      </p>
                    </div>
                  ))}
                  {!shiftCoverage.openRequirements.length ? (
                    <p className="muted-text">
                      No explicit role requirements have been defined yet for this shift. Use the planner context and assignment panel to build the first crew.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {selectedShift ? (
              <div className="subsection">
                <div className="split-header">
                  <strong>Assigned crew by role</strong>
                  <span className="muted-text">Review coverage and remove mismatches quickly</span>
                </div>
                <div className="dashboard-list">
                  {groupedAssignments.map((group) => {
                    const requiredCount = group.requirement?.requiredCount ?? 0;
                    const coveredCount = group.workers.length;
                    const coverageClass =
                      requiredCount > 0 && coveredCount < requiredCount ? "pill pill--amber" : "pill pill--green";

                    return (
                      <div key={group.roleLabel} className="tendering-focus-list__item">
                        <div className="split-header">
                          <strong>{group.roleLabel}</strong>
                          <span className={coverageClass}>
                            {requiredCount > 0 ? `${coveredCount}/${requiredCount} covered` : `${coveredCount} assigned`}
                          </span>
                        </div>
                        <div className="dashboard-list">
                          {group.workers.map((assignment) => (
                            <div key={assignment.worker.id} className="record-row">
                              <div>
                                <span>
                                  {assignment.worker.firstName} {assignment.worker.lastName}
                                </span>
                                <p className="muted-text">
                                  {assignment.worker.competencies.map((entry) => entry.competency.name).join(", ") ||
                                    "No competencies"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void unassignWorker(assignment.worker.id)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          {!group.workers.length ? (
                            <p className="muted-text">No workers assigned to this role yet.</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {!groupedAssignments.length ? (
                    <p className="muted-text">No worker assignments yet for this shift.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {selectedShift ? (
              <div className="subsection">
                <div className="split-header">
                  <strong>Shift role requirements</strong>
                  <span className="muted-text">Define the crew shape this shift needs</span>
                </div>
                <div className="dashboard-list">
                  {selectedShift.roleRequirements.map((requirement) => (
                    <button
                      key={requirement.id}
                      type="button"
                      className="tendering-focus-list__item"
                      onClick={() =>
                        {
                          setRequirementForm({
                            id: requirement.id,
                            roleLabel: requirement.roleLabel,
                            competencyId: requirement.competency?.id ?? "",
                            requiredCount: String(requirement.requiredCount)
                          });
                          setAssignment((current) => ({
                            ...current,
                            roleLabel: requirement.roleLabel
                          }));
                        }
                      }
                    >
                      <div className="split-header">
                        <strong>{requirement.roleLabel}</strong>
                        <span className="pill pill--blue">{requirement.requiredCount} required</span>
                      </div>
                      <p className="muted-text">
                        {requirement.competency ? requirement.competency.name : "No competency requirement"}
                      </p>
                    </button>
                  ))}
                  {!selectedShift.roleRequirements.length ? (
                    <p className="muted-text">
                      No role requirements yet. Add the first crew requirement below so the coverage panel can guide planning properly.
                    </p>
                  ) : null}
                </div>
                <form className="admin-form" onSubmit={submitRequirement}>
                  <label>
                    Role label
                    <input
                      value={requirementForm.roleLabel}
                      onChange={(event) =>
                        setRequirementForm({ ...requirementForm, roleLabel: event.target.value })
                      }
                      placeholder="Operator, Supervisor, Spotter"
                    />
                  </label>
                  <label>
                    Competency
                    <select
                      value={requirementForm.competencyId}
                      onChange={(event) =>
                        setRequirementForm({ ...requirementForm, competencyId: event.target.value })
                      }
                    >
                      <option value="">No competency requirement</option>
                      {competencyOptions.map((competency) => (
                        <option key={competency.id} value={competency.id}>
                          {competency.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Required count
                    <input
                      type="number"
                      min="1"
                      value={requirementForm.requiredCount}
                      onChange={(event) =>
                        setRequirementForm({ ...requirementForm, requiredCount: event.target.value })
                      }
                    />
                  </label>
                  <div className="inline-fields">
                    <button type="submit">
                      {requirementForm.id ? "Update requirement" : "Add requirement"}
                    </button>
                    {requirementForm.id ? (
                      <button
                        type="button"
                        onClick={() => setRequirementForm(emptyRequirementForm)}
                      >
                        New requirement
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            ) : null}

            <form className="admin-form" onSubmit={assignResources}>
              <label>
                Assign against role
                <select
                  value={assignment.roleLabel}
                  onChange={(event) => setAssignment({ ...assignment, roleLabel: event.target.value })}
                >
                  <option value="">No role label</option>
                  {selectedShift?.roleRequirements.map((requirement) => (
                    <option key={requirement.id} value={requirement.roleLabel}>
                      {requirement.roleLabel}
                      {requirement.competency ? ` (${requirement.competency.name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search workers
                <input value={workerSearch} onChange={(event) => setWorkerSearch(event.target.value)} placeholder="Filter workers" />
              </label>
              <label>
                Competency
                <select value={competencyFilter} onChange={(event) => setCompetencyFilter(event.target.value)}>
                  <option value="">{requirementForm.competencyId ? "Requirement competency" : "All competencies"}</option>
                  {competencyOptions.map((competency) => (
                    <option key={competency.id} value={competency.id}>
                      {competency.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Worker
                <select value={assignment.workerId} onChange={(event) => setAssignment({ ...assignment, workerId: event.target.value })}>
                  <option value="">Select worker</option>
                  {filteredWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.firstName} {worker.lastName} {worker.resourceType ? `(${worker.resourceType.name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {assignment.roleLabel ? (
                <p className="muted-text">
                  Worker assignments will count toward <strong>{assignment.roleLabel}</strong>.
                  {requirementForm.competencyId ? " The worker list is also narrowed by the selected requirement competency unless you override the filter." : ""}
                </p>
              ) : null}
              <label>
                Asset
                <select value={assignment.assetId} onChange={(event) => setAssignment({ ...assignment, assetId: event.target.value })}>
                  <option value="">Select asset</option>
                  {filteredAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} {asset.category ? `(${asset.category.name})` : asset.resourceType ? `(${asset.resourceType.name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={!selectedShift}>
                Assign Resources
              </button>
            </form>

            {assignment.roleLabel ? (
              <div className="subsection">
                <div className="split-header">
                  <strong>Best-fit worker suggestions</strong>
                  <span className="muted-text">
                    Suggested for {assignment.roleLabel}
                  </span>
                </div>
                <div className="dashboard-list">
                  {recommendedWorkers.map(({ worker, suitability, hasCompetency }) => (
                    <button
                      key={worker.id}
                      type="button"
                      className="tendering-focus-list__item"
                      onClick={() => setAssignment((current) => ({ ...current, workerId: worker.id }))}
                    >
                      <div className="split-header">
                        <strong>
                          {worker.firstName} {worker.lastName}
                        </strong>
                        <span
                          className={
                            suitability === "SUITABLE"
                              ? "pill pill--green"
                              : suitability === "LIMITED"
                                ? "pill pill--amber"
                                : "pill pill--blue"
                          }
                        >
                          {suitability}
                        </span>
                      </div>
                      <p className="muted-text">
                        {worker.competencies.map((entry) => entry.competency.name).join(", ") || "No competencies"}
                      </p>
                      <div className="inline-fields">
                        <span className={hasCompetency ? "pill pill--green" : "pill pill--amber"}>
                          {hasCompetency ? "Competency ready" : "Competency missing"}
                        </span>
                        <span className="muted-text">Click to assign</span>
                      </div>
                    </button>
                  ))}
                  {!recommendedWorkers.length ? (
                    <p className="muted-text">
                      No unassigned workers match the current role and competency filters closely enough to recommend automatically.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="subsection">
              <div className="split-header">
                <strong>Best-fit asset suggestions</strong>
                <span className="muted-text">Suggested plant for this shift</span>
              </div>
              <div className="dashboard-list">
                {recommendedAssets.map(({ asset, planningState }) => (
                  <button
                    key={asset.id}
                    type="button"
                    className="tendering-focus-list__item"
                    onClick={() => setAssignment((current) => ({ ...current, assetId: asset.id }))}
                  >
                    <div className="split-header">
                      <strong>{asset.name}</strong>
                      <span
                        className={
                          planningState.schedulerImpact === "BLOCK"
                            ? "pill pill--red"
                            : planningState.schedulerImpact === "WARN"
                              ? "pill pill--amber"
                              : asset.status === "AVAILABLE" || asset.status === "IN_SERVICE"
                            ? "pill pill--green"
                            : "pill pill--amber"
                        }
                      >
                        {planningState.schedulerImpact === "BLOCK"
                          ? planningState.maintenanceState
                          : planningState.schedulerImpact === "WARN"
                            ? planningState.maintenanceState
                            : asset.status}
                      </span>
                    </div>
                    <p className="muted-text">
                      {asset.category?.name ?? asset.resourceType?.name ?? "Asset"}
                    </p>
                    <div className="inline-fields">
                      <span
                        className={
                          planningState.schedulerImpact === "BLOCK"
                            ? "pill pill--red"
                            : planningState.schedulerImpact === "WARN"
                              ? "pill pill--amber"
                              : "pill pill--green"
                        }
                      >
                        {planningState.schedulerImpact === "NONE"
                          ? "Dispatch ready"
                          : planningState.schedulerImpact === "WARN"
                            ? "Review before dispatch"
                            : "Do not dispatch"}
                      </span>
                      <span className="muted-text">
                        {asset.currentLocation ?? asset.homeBase ?? "Location not set"}
                      </span>
                      <span className="muted-text">Click to assign</span>
                    </div>
                  </button>
                ))}
                {!recommendedAssets.length ? (
                  <p className="muted-text">
                    No unassigned assets are currently available in the filtered list to recommend automatically.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="subsection">
              <strong>{resourceView === "project" ? "Workers" : "Resource-centric worker list"}</strong>
              {filteredWorkers.map((worker) => (
                <div key={worker.id} className="record-row">
                  <div>
                    <span>{worker.firstName} {worker.lastName}</span>
                    <p className="muted-text">
                      {worker.competencies.map((entry) => entry.competency.name).join(", ") || "No competencies"}
                    </p>
                  </div>
                  <span className="muted-text">
                    {worker.roleSuitabilities[0]
                      ? `${worker.roleSuitabilities[0].roleLabel}: ${worker.roleSuitabilities[0].suitability}`
                      : worker.resourceType?.name ?? "Worker"}
                  </span>
                </div>
              ))}
            </div>

            <div className="subsection">
              <strong>Assets</strong>
              <label>
                Search assets
                <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Filter assets" />
              </label>
              <label>
                Asset category
                <select value={assetCategoryFilter} onChange={(event) => setAssetCategoryFilter(event.target.value)}>
                  <option value="">All categories</option>
                  {assetCategoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              {filteredAssets.map((asset) => (
                <div key={asset.id} className="record-row">
                  <div>
                    <span>{asset.name}</span>
                    <p className="muted-text">{asset.currentLocation ?? asset.homeBase ?? "Location not set"}</p>
                  </div>
                  <span className="muted-text">{asset.category?.name ?? asset.resourceType?.name ?? "Asset"} - {asset.status}</span>
                </div>
              ))}
              {selectedShift?.assetAssignments.length ? (
                <div className="dashboard-list">
                  {selectedShift.assetAssignments.map((assignment) => (
                    <div key={assignment.asset.id} className="record-row">
                      <div>
                        <span>{assignment.asset.name}</span>
                        <p className="muted-text">Assigned to selected shift</p>
                      </div>
                      <button type="button" onClick={() => void unassignAsset(assignment.asset.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}

