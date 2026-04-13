import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type ShiftRecord = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
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
};

const emptyShiftForm = {
  jobId: "",
  jobStageId: "",
  jobActivityId: "",
  title: "",
  startAt: "",
  endAt: "",
  status: "PLANNED",
  notes: "",
  workInstructions: ""
};

export function SchedulerPage() {
  const { authFetch } = useAuth();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftRecord | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "calendar">("timeline");
  const [planningMode, setPlanningMode] = useState<"weekly" | "monthly">("weekly");
  const [resourceView, setResourceView] = useState<"project" | "resource">("project");
  const [workerSearch, setWorkerSearch] = useState("");
  const [competencyFilter, setCompetencyFilter] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("");
  const [shiftForm, setShiftForm] = useState(emptyShiftForm);
  const [assignment, setAssignment] = useState({ workerId: "", assetId: "" });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const response = await authFetch("/scheduler/workspace?page=1&pageSize=100");
    if (!response.ok) {
      throw new Error("Unable to load scheduler workspace.");
    }

    const data = await response.json();
    setJobs(data.items.jobs);
    setWorkers(data.items.workers);
    setAssets(data.items.assets);
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

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
    const sorted = [...allShifts].sort(
      (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()
    );

    if (planningMode === "weekly") {
      return sorted.slice(0, 7);
    }

    return sorted;
  }, [allShifts, planningMode]);

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

        const competencyMatch =
          !competencyFilter ||
          worker.competencies.some((entry) => entry.competency.id === competencyFilter);

        return searchMatch && competencyMatch;
      }),
    [workers, workerSearch, competencyFilter]
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

  const submitShift = async (event: React.FormEvent) => {
    event.preventDefault();

    const response = await authFetch("/scheduler/shifts", {
      method: "POST",
      body: JSON.stringify(shiftForm)
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
        body: JSON.stringify({ workerId: assignment.workerId })
      });
    }

    if (assignment.assetId) {
      await authFetch(`/scheduler/shifts/${selectedShift.id}/assets`, {
        method: "POST",
        body: JSON.stringify({ assetId: assignment.assetId })
      });
    }

    setAssignment({ workerId: "", assetId: "" });
    await load();
  };

  const conflictClass = (shift: ShiftRecord) => {
    if (shift.conflicts.some((conflict) => conflict.severity === "RED")) return "scheduler-block scheduler-block--red";
    if (shift.conflicts.some((conflict) => conflict.severity === "AMBER")) return "scheduler-block scheduler-block--amber";
    return "scheduler-block scheduler-block--green";
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
      </div>

      <div className="scheduler-grid">
        <AppCard title="Jobs / Stages / Activities" subtitle="Planning hierarchy">
          <div className="scheduler-pane">
            {jobs.map((job) => (
              <div key={job.id} className="scheduler-tree">
                <strong>{job.jobNumber} - {job.name}</strong>
                {job.stages.map((stage) => (
                  <div key={stage.id} className="scheduler-tree__branch">
                    <span>{stage.name}</span>
                    {job.stages
                      .find((item) => item.id === stage.id)
                      ?.activities.map((activity) => (
                        <button
                          key={activity.id}
                          type="button"
                          className="scheduler-tree__leaf"
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
                          {activity.name} ({activity.shifts.length})
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </AppCard>

        <AppCard
          title={viewMode === "timeline" ? "Timeline Workspace" : "Calendar Workspace"}
          subtitle={planningMode === "weekly" ? "Weekly planning mode" : "Monthly planning mode"}
        >
          <div className="scheduler-pane">
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
              <button type="submit">Create Shift</button>
            </form>

            <div className={viewMode === "timeline" ? "scheduler-timeline" : "scheduler-calendar"}>
              {visibleShifts.map((shift) => (
                <button
                  key={shift.id}
                  type="button"
                  className={conflictClass(shift)}
                  onClick={() => setSelectedShift(shift)}
                >
                  <strong>{shift.title}</strong>
                  <span>{new Date(shift.startAt).toLocaleString()} - {new Date(shift.endAt).toLocaleTimeString()}</span>
                  <span>{shift.workerAssignments.length} workers / {shift.assetAssignments.length} assets</span>
                  <span>{shift.roleRequirements.map((requirement) => `${requirement.roleLabel}${requirement.competency ? ` - ${requirement.competency.name}` : ""}`).join(", ") || "No role requirements"}</span>
                  <span>{shift.conflicts.map((conflict) => conflict.code).join(", ") || "Ready"}</span>
                </button>
              ))}
            </div>
          </div>
        </AppCard>

        <AppCard title="Resources Panel" subtitle="Workers and assets for fast assignment">
          <div className="scheduler-pane">
            {selectedShift ? (
              <div className="dashboard-preview">
                <h3>{selectedShift.title}</h3>
                <p>{selectedShift.notes || "No notes"}</p>
                <p>Instructions: {selectedShift.workInstructions || "None"}</p>
                <p>
                  Requirements: {selectedShift.roleRequirements.map((requirement) => `${requirement.roleLabel} x${requirement.requiredCount}${requirement.competency ? ` (${requirement.competency.name})` : ""}`).join("; ") || "None"}
                </p>
                <p>
                  Conflicts: {selectedShift.conflicts.map((conflict) => `${conflict.severity} ${conflict.message}`).join("; ") || "None"}
                </p>
              </div>
            ) : (
              <p className="muted-text">Select a shift card to assign resources.</p>
            )}

            <form className="admin-form" onSubmit={assignResources}>
              <label>
                Search workers
                <input value={workerSearch} onChange={(event) => setWorkerSearch(event.target.value)} placeholder="Filter workers" />
              </label>
              <label>
                Competency
                <select value={competencyFilter} onChange={(event) => setCompetencyFilter(event.target.value)}>
                  <option value="">All competencies</option>
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
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}
