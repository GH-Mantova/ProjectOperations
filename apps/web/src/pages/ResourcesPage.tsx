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

  const workerOptions = useMemo(
    () => workers.map((worker) => ({ id: worker.id, label: `${worker.firstName} ${worker.lastName}` })),
    [workers]
  );

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
    <div className="stack-grid">
      {error ? <p className="error-text">{error}</p> : null}

      <AppCard title="Resource Directory" subtitle="Worker skills, availability, and assignment suitability">
        <div className="scheduler-pane">
          <form className="admin-form" onSubmit={runSearch}>
            <label>
              Search workers
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or employee code" />
            </label>
            <button type="submit">Search</button>
          </form>

          <div className="dashboard-list">
            {workers.map((worker) => (
              <div key={worker.id} className="resource-card">
                <div className="split-header">
                  <div>
                    <strong>{worker.firstName} {worker.lastName}</strong>
                    <p className="muted-text">
                      {worker.employeeCode ?? "No code"} · {worker.resourceType?.name ?? "Worker"}
                    </p>
                  </div>
                </div>
                <div className="resource-tags">
                  {worker.competencies.map((entry) => (
                    <span key={entry.competency.id} className="resource-tag">
                      {entry.competency.name}
                    </span>
                  ))}
                  {worker.competencies.length === 0 ? <span className="muted-text">No competencies recorded</span> : null}
                </div>
                <div className="detail-list">
                  <div>
                    <dt>Availability</dt>
                    <dd>
                      {worker.availabilityWindows[0]
                        ? `${worker.availabilityWindows[0].status} until ${new Date(worker.availabilityWindows[0].endAt).toLocaleString()}`
                        : "No windows configured"}
                    </dd>
                  </div>
                  <div>
                    <dt>Role Suitability</dt>
                    <dd>
                      {worker.roleSuitabilities[0]
                        ? `${worker.roleSuitabilities[0].roleLabel}: ${worker.roleSuitabilities[0].suitability}`
                        : "No suitability records"}
                    </dd>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppCard>

      <div className="admin-grid">
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
  );
}
