import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
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
  sourceTender?: { tenderNumber: string; title: string } | null;
  projectManager?: { firstName: string; lastName: string } | null;
  supervisor?: { firstName: string; lastName: string } | null;
  conversion?: {
    carriedDocuments: boolean;
    tenderClient: {
      client: { name: string };
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

export function JobsPage() {
  const { authFetch } = useAuth();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState({ status: "ACTIVE", note: "" });
  const [stageForm, setStageForm] = useState({ name: "", description: "", status: "PLANNED" });
  const [activityForm, setActivityForm] = useState({ jobStageId: "", name: "", status: "PLANNED" });
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

  const selectJob = async (id: string) => {
    const response = await authFetch(`/jobs/${id}`);
    if (!response.ok) return;
    setSelectedJob(await response.json());
  };

  useEffect(() => {
    Promise.all([
      authFetch("/jobs?page=1&pageSize=50"),
      authFetch("/users?page=1&pageSize=100"),
      authFetch("/master-data/sites?page=1&pageSize=100")
    ])
      .then(async ([jobsResponse, usersResponse, sitesResponse]) => {
        if (!jobsResponse.ok || !usersResponse.ok || !sitesResponse.ok) {
          throw new Error("Unable to load jobs.");
        }

        const jobsData = await jobsResponse.json();
        const usersData = await usersResponse.json();
        const sitesData = await sitesResponse.json();
        setJobs(jobsData.items);
        setUsers(usersData.items);
        setSites(sitesData.items);
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
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter]);

  const visibleJobs = filteredJobs.slice(0, 10);

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
              <div className="inline-fields">
                <span className="pill pill--blue">{filteredJobs.length} matching jobs</span>
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
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job) => (
                    <tr key={job.id} onClick={() => selectJob(job.id)}>
                      <td>{job.jobNumber} - {job.name}</td>
                      <td>{job.client.name}</td>
                      <td>{job.status}</td>
                    </tr>
                  ))}
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
            <h3>{selectedJob.jobNumber} - {selectedJob.name}</h3>
            <p>Client: {selectedJob.client.name}</p>
            <p>Site: {selectedJob.site?.name ?? "Unassigned"}</p>
            <p>
              Source tender:{" "}
              {selectedJob.sourceTender
                ? `${selectedJob.sourceTender.tenderNumber} - ${selectedJob.sourceTender.title}`
                : "None"}
            </p>
            <p>
              Project manager:{" "}
              {selectedJob.projectManager
                ? `${selectedJob.projectManager.firstName} ${selectedJob.projectManager.lastName}`
                : "Unassigned"}
            </p>
            <p>
              Supervisor:{" "}
              {selectedJob.supervisor
                ? `${selectedJob.supervisor.firstName} ${selectedJob.supervisor.lastName}`
                : "Unassigned"}
            </p>
            <p>Awarded client: {selectedJob.conversion?.tenderClient.client.name ?? "Unknown"}</p>
            <p>Carried documents: {selectedJob.conversion?.carriedDocuments ? "Yes" : "No"}</p>
            <p>Closeout: {selectedJob.closeout ? `${selectedJob.closeout.status}${selectedJob.closeout.archivedAt ? ` · ${new Date(selectedJob.closeout.archivedAt).toLocaleString()}` : ""}` : "Open"}</p>
            <p>
              Documents:{" "}
              {selectedJob.documents
                ?.map((document) => `${document.title}${document.versionLabel ? ` (${document.versionLabel})` : ""}`)
                .join("; ") || "None"}
            </p>

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
            </div>

            <div className="subsection">
              <strong>Stages and activities</strong>
              {selectedJob.stages?.map((stage) => (
                <div key={stage.id} className="record-row">
                  <div>
                    <strong>{stage.name}</strong>
                    <p className="muted-text">
                      {stage.status}
                      {stage.startDate ? `, ${new Date(stage.startDate).toLocaleDateString()}` : ""}
                    </p>
                    <p className="muted-text">
                      Activities: {stage.activities.map((activity) => `${activity.name} [${activity.status}]`).join("; ") || "None"}
                    </p>
                  </div>
                </div>
              ))}

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
                  setActivityForm({ jobStageId: "", name: "", status: "PLANNED" });
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
                <button type="submit">Add Activity</button>
              </form>
            </div>

            <div className="subsection">
              <strong>Issues and variations</strong>
              <p className="muted-text">
                Issues: {selectedJob.issues?.map((issue) => `${issue.title} [${issue.severity}/${issue.status}]`).join("; ") || "None"}
              </p>
              <p className="muted-text">
                Variations: {selectedJob.variations?.map((variation) => `${variation.reference} ${variation.title} [${variation.status}]`).join("; ") || "None"}
              </p>

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
              <strong>Daily notes and history</strong>
              <p className="muted-text">
                Progress: {selectedJob.progressEntries?.map((entry) => `${entry.entryType} ${new Date(entry.entryDate).toLocaleDateString()} - ${entry.summary}`).join("; ") || "None"}
              </p>
              <p className="muted-text">
                Status history: {selectedJob.statusHistory?.map((entry) => `${entry.fromStatus ?? "N/A"} -> ${entry.toStatus}`).join("; ") || "None"}
              </p>
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
