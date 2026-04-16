import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type WorkerRecord = {
  id: string;
  employeeCode?: string | null;
  firstName: string;
  lastName: string;
  resourceType?: { name: string } | null;
  competencies: Array<{ competency: { id: string; name: string }; expiresAt?: string | null }>;
  availabilityWindows: Array<{ id: string; startAt: string; endAt: string; status: string; notes?: string | null }>;
  roleSuitabilities: Array<{ id: string; roleLabel: string; suitability: string; notes?: string | null }>;
};

const emptyAvailabilityForm = {
  workerId: "",
  startAt: "",
  endAt: "",
  status: "UNAVAILABLE",
  notes: ""
};

const emptySuitabilityForm = {
  workerId: "",
  roleLabel: "",
  suitability: "SUITABLE",
  notes: ""
};

export function ResourcesPage() {
  const { authFetch } = useAuth();
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [availabilityForm, setAvailabilityForm] = useState(emptyAvailabilityForm);
  const [suitabilityForm, setSuitabilityForm] = useState(emptySuitabilityForm);
  const [error, setError] = useState<string | null>(null);

  const load = async (search = "") => {
    const response = await authFetch(`/resources/workers?page=1&pageSize=50${search ? `&q=${encodeURIComponent(search)}` : ""}`);
    if (!response.ok) {
      throw new Error("Unable to load workers.");
    }

    const data = await response.json();
    setWorkers(data.items);
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("project-ops-resource-groups");
    if (!saved) return;

    try {
      setCollapsedGroups(JSON.parse(saved) as Record<string, boolean>);
    } catch {
      // Ignore invalid persisted state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("project-ops-resource-groups", JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    if (!workers.length) {
      setSelectedWorkerId("");
      return;
    }

    const existing = workers.find((worker) => worker.id === selectedWorkerId);
    if (!existing) {
      setSelectedWorkerId(workers[0].id);
    }
  }, [workers, selectedWorkerId]);

  const workerOptions = useMemo(
    () => workers.map((worker) => ({ id: worker.id, label: `${worker.firstName} ${worker.lastName}` })),
    [workers]
  );
  const groupedWorkers = useMemo(() => {
    const groups = new Map<string, WorkerRecord[]>();

    workers.forEach((worker) => {
      const key = worker.resourceType?.name ?? "General workers";
      const existing = groups.get(key) ?? [];
      existing.push(worker);
      groups.set(key, existing);
    });

    return Array.from(groups.entries())
      .map(([label, items]) => ({
        label,
        items: [...items].sort((left, right) =>
          `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`)
        )
      }))
      .sort((left, right) => right.items.length - left.items.length || left.label.localeCompare(right.label));
  }, [workers]);
  const selectedWorker = useMemo(
    () => workers.find((worker) => worker.id === selectedWorkerId) ?? null,
    [selectedWorkerId, workers]
  );
  const unavailableWorkers = workers.filter((worker) =>
    worker.availabilityWindows.some((entry) => entry.status === "UNAVAILABLE")
  ).length;
  const reviewSuitabilityCount = workers.filter((worker) =>
    worker.roleSuitabilities.some((entry) => entry.suitability === "REVIEW" || entry.suitability === "UNSUITABLE")
  ).length;
  const competencyCoverageCount = workers.filter((worker) => worker.competencies.length > 0).length;

  const submitAvailability = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/resources/availability-windows", {
      method: "POST",
      body: JSON.stringify(availabilityForm)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to save availability window.");
      return;
    }

    setAvailabilityForm(emptyAvailabilityForm);
    await load(query);
  };

  const submitSuitability = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/resources/role-suitabilities", {
      method: "POST",
      body: JSON.stringify(suitabilityForm)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to save role suitability.");
      return;
    }

    setSuitabilityForm(emptySuitabilityForm);
    await load(query);
  };

  const runSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await load(query);
  };

  return (
    <div className="crm-page crm-page--operations">
      {error ? <p className="error-text">{error}</p> : null}

      <div className="crm-page__sidebar">
        <AppCard title="Resource Directory" subtitle="Grouped worker rail for fast planning and resourcing checks">
          <div className="stack-grid">
            <div className="module-summary-grid">
              <div className="module-summary-card">
                <strong>{workers.length}</strong>
                <span>Workers in scope</span>
              </div>
              <div className="module-summary-card">
                <strong>{unavailableWorkers}</strong>
                <span>Unavailable right now</span>
              </div>
              <div className="module-summary-card">
                <strong>{reviewSuitabilityCount}</strong>
                <span>Coverage risks to review</span>
              </div>
              <div className="module-summary-card">
                <strong>{competencyCoverageCount}</strong>
                <span>Workers with competencies</span>
              </div>
            </div>

            <form className="admin-form subsection" onSubmit={runSearch}>
              <label>
                Search workers
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or employee code" />
              </label>
              <button type="submit">Search</button>
            </form>

            <div className="dashboard-list dashboard-list--capped">
              {groupedWorkers.length ? groupedWorkers.map((group) => {
                const groupKey = group.label.toLowerCase().replace(/\s+/g, "-");
                const isCollapsed = collapsedGroups[groupKey] ?? false;

                return (
                  <section key={group.label} className="planner-group">
                    <button
                      type="button"
                      className="planner-group__header"
                      onClick={() =>
                        setCollapsedGroups((current) => ({
                          ...current,
                          [groupKey]: !isCollapsed
                        }))
                      }
                    >
                      <div>
                        <strong>{group.label}</strong>
                        <p className="muted-text">{group.items.length} workers</p>
                      </div>
                      <span className="planner-group__toggle">{isCollapsed ? "+" : "-"}</span>
                    </button>
                    {!isCollapsed ? (
                      <div className="planner-group__body">
                        {group.items.map((worker) => (
                          <button
                            key={worker.id}
                            type="button"
                            className={`planner-list-card${selectedWorkerId === worker.id ? " planner-list-card--active" : ""}`}
                            onClick={() => setSelectedWorkerId(worker.id)}
                          >
                            <div className="split-header">
                              <strong>{worker.firstName} {worker.lastName}</strong>
                              <span className="pill pill--slate">{worker.competencies.length} skills</span>
                            </div>
                            <p className="muted-text">
                              {worker.employeeCode ?? "No code"} | {worker.resourceType?.name ?? "Worker"}
                            </p>
                            <div className="inline-fields">
                              {worker.availabilityWindows[0] ? (
                                <span className={worker.availabilityWindows[0].status === "UNAVAILABLE" ? "pill pill--amber" : "pill pill--green"}>
                                  {worker.availabilityWindows[0].status}
                                </span>
                              ) : (
                                <span className="pill pill--slate">No availability set</span>
                              )}
                              {worker.roleSuitabilities[0] ? (
                                <span className="pill pill--blue">{worker.roleSuitabilities[0].roleLabel}</span>
                              ) : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              }) : <p className="module-empty-state">No workers matched the current search.</p>}
            </div>
          </div>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard
          title="Worker Detail"
          subtitle={selectedWorker ? "Expanded operational context for the selected worker" : "Select a worker from the grouped rail"}
        >
          {selectedWorker ? (
            <div className="stack-grid">
              <div className="resource-card">
                <div className="split-header">
                  <div>
                    <strong>{selectedWorker.firstName} {selectedWorker.lastName}</strong>
                    <p className="muted-text">
                      {selectedWorker.employeeCode ?? "No employee code"} | {selectedWorker.resourceType?.name ?? "Worker"}
                    </p>
                  </div>
                  <span className="pill pill--blue">
                    {selectedWorker.competencies.length} competencies
                  </span>
                </div>
                <div className="resource-tags">
                  {selectedWorker.competencies.length ? selectedWorker.competencies.map((entry) => (
                    <span key={entry.competency.id} className="resource-tag">
                      {entry.competency.name}
                    </span>
                  )) : <span className="muted-text">No competencies recorded yet.</span>}
                </div>
              </div>

              <div className="compact-two-up">
                <section className="subsection">
                  <div className="split-header">
                    <strong>Availability windows</strong>
                    <span className="muted-text">{selectedWorker.availabilityWindows.length} entries</span>
                  </div>
                  <div className="dashboard-list dashboard-list--capped-sm">
                    {selectedWorker.availabilityWindows.map((entry) => (
                      <div key={entry.id} className="record-row record-row--card">
                        <div>
                          <span>{entry.status}</span>
                          <p className="muted-text">
                            {new Date(entry.startAt).toLocaleString()} - {new Date(entry.endAt).toLocaleString()}
                          </p>
                          {entry.notes ? <p className="muted-text">{entry.notes}</p> : null}
                        </div>
                      </div>
                    ))}
                    {!selectedWorker.availabilityWindows.length ? (
                      <p className="muted-text">No availability windows configured.</p>
                    ) : null}
                  </div>
                </section>

                <section className="subsection">
                  <div className="split-header">
                    <strong>Role suitability</strong>
                    <span className="muted-text">{selectedWorker.roleSuitabilities.length} entries</span>
                  </div>
                  <div className="dashboard-list dashboard-list--capped-sm">
                    {selectedWorker.roleSuitabilities.map((entry) => (
                      <div key={entry.id} className="record-row record-row--card">
                        <div>
                          <span>{entry.roleLabel}</span>
                          <p className="muted-text">{entry.suitability}</p>
                          {entry.notes ? <p className="muted-text">{entry.notes}</p> : null}
                        </div>
                      </div>
                    ))}
                    {!selectedWorker.roleSuitabilities.length ? (
                      <p className="muted-text">No suitability records configured.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <p className="muted-text">Select a worker from the grouped rail to review skills, availability, and suitability in one place.</p>
          )}
        </AppCard>

        <div className="compact-two-up">
          <AppCard title="Availability Windows" subtitle="Capture leave, training, or blocked periods">
            <form className="admin-form" onSubmit={submitAvailability}>
              <label>
                Worker
                <select value={availabilityForm.workerId} onChange={(event) => setAvailabilityForm({ ...availabilityForm, workerId: event.target.value })}>
                  <option value="">Select worker</option>
                  {workerOptions.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start
                <input type="datetime-local" value={availabilityForm.startAt} onChange={(event) => setAvailabilityForm({ ...availabilityForm, startAt: event.target.value })} />
              </label>
              <label>
                End
                <input type="datetime-local" value={availabilityForm.endAt} onChange={(event) => setAvailabilityForm({ ...availabilityForm, endAt: event.target.value })} />
              </label>
              <label>
                Status
                <select value={availabilityForm.status} onChange={(event) => setAvailabilityForm({ ...availabilityForm, status: event.target.value })}>
                  <option value="AVAILABLE">Available</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                </select>
              </label>
              <label>
                Notes
                <input value={availabilityForm.notes} onChange={(event) => setAvailabilityForm({ ...availabilityForm, notes: event.target.value })} />
              </label>
              <button type="submit">Save Availability</button>
            </form>
          </AppCard>

          <AppCard title="Role Suitability" subtitle="Track whether workers suit specific shift roles">
            <form className="admin-form" onSubmit={submitSuitability}>
              <label>
                Worker
                <select value={suitabilityForm.workerId} onChange={(event) => setSuitabilityForm({ ...suitabilityForm, workerId: event.target.value })}>
                  <option value="">Select worker</option>
                  {workerOptions.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Role label
                <input value={suitabilityForm.roleLabel} onChange={(event) => setSuitabilityForm({ ...suitabilityForm, roleLabel: event.target.value })} placeholder="Leading Hand" />
              </label>
              <label>
                Suitability
                <select value={suitabilityForm.suitability} onChange={(event) => setSuitabilityForm({ ...suitabilityForm, suitability: event.target.value })}>
                  <option value="SUITABLE">Suitable</option>
                  <option value="UNSUITABLE">Unsuitable</option>
                  <option value="REVIEW">Review</option>
                </select>
              </label>
              <label>
                Notes
                <input value={suitabilityForm.notes} onChange={(event) => setSuitabilityForm({ ...suitabilityForm, notes: event.target.value })} />
              </label>
              <button type="submit">Save Suitability</button>
            </form>
          </AppCard>
        </div>
      </div>
    </div>
  );
}
