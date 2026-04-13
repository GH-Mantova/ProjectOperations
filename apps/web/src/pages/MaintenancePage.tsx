import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type MaintenanceAsset = {
  id: string;
  name: string;
  assetCode: string;
  status: string;
  maintenanceSummary: {
    maintenanceState: string;
    schedulerImpact: string;
    openBreakdown: boolean;
    failedInspection: boolean;
  };
  maintenancePlans: Array<{
    id: string;
    title: string;
    nextDueAt?: string | null;
    status: string;
  }>;
  breakdowns: Array<{
    id: string;
    summary: string;
    status: string;
  }>;
  inspections: Array<{
    id: string;
    inspectionType: string;
    status: string;
  }>;
};

const emptyPlanForm = {
  assetId: "",
  title: "",
  description: "",
  intervalDays: 30,
  warningDays: 7,
  blockWhenOverdue: true,
  nextDueAt: "",
  status: "ACTIVE"
};

const emptyEventForm = {
  assetId: "",
  maintenancePlanId: "",
  eventType: "SERVICE",
  scheduledAt: "",
  completedAt: "",
  status: "SCHEDULED",
  notes: ""
};

const emptyInspectionForm = {
  assetId: "",
  inspectionType: "PRESTART",
  inspectedAt: "",
  status: "PASS",
  notes: ""
};

const emptyBreakdownForm = {
  assetId: "",
  reportedAt: "",
  resolvedAt: "",
  severity: "MEDIUM",
  status: "OPEN",
  summary: "",
  notes: ""
};

export function MaintenancePage() {
  const { authFetch } = useAuth();
  const [assets, setAssets] = useState<MaintenanceAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [inspectionForm, setInspectionForm] = useState(emptyInspectionForm);
  const [breakdownForm, setBreakdownForm] = useState(emptyBreakdownForm);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const response = await authFetch("/maintenance/assets?page=1&pageSize=100");
    if (!response.ok) {
      throw new Error("Unable to load maintenance workspace.");
    }

    const data = await response.json();
    setAssets(data.items);
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  const filteredAssets = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        asset.name.toLowerCase().includes(searchTerm) ||
        asset.assetCode.toLowerCase().includes(searchTerm);
      const matchesState =
        stateFilter === "ALL" || asset.maintenanceSummary.maintenanceState === stateFilter;

      return matchesSearch && matchesState;
    });
  }, [assets, search, stateFilter]);

  const selectedAsset =
    filteredAssets.find((asset) => asset.id === selectedAssetId) ??
    assets.find((asset) => asset.id === selectedAssetId) ??
    filteredAssets[0] ??
    assets[0] ??
    null;

  const submit = async (path: string, body: unknown, reset: () => void) => {
    const response = await authFetch(path, {
      method: "POST",
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? "Unable to save maintenance record.");
      return;
    }

    reset();
    await load();
  };

  return (
    <div className="stack-grid">
      {error ? <p className="error-text">{error}</p> : null}

      <div className="crm-page crm-page--operations">
        <div className="crm-page__main">
          <AppCard title="Maintenance Dashboard" subtitle="Due, overdue, and blocked asset states">
            <div className="stack-grid">
              <div className="subsection">
                <div className="compact-filter-grid">
                  <label>
                    Search assets
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or asset code" />
                  </label>
                  <label>
                    Maintenance state
                    <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                      <option value="ALL">All states</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="DUE">Due</option>
                      <option value="CURRENT">Current</option>
                      <option value="BLOCK">Block</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="dashboard-list dashboard-list--capped">
                {filteredAssets.length ? filteredAssets.map((asset) => (
                  <button key={asset.id} type="button" className="asset-record" onClick={() => setSelectedAssetId(asset.id)}>
                    <div>
                      <strong>{asset.name}</strong>
                      <p className="muted-text">{asset.assetCode}</p>
                    </div>
                    <div className="asset-record__meta">
                      <span className={asset.maintenanceSummary.schedulerImpact === "BLOCK" ? "pill pill--amber" : "pill pill--green"}>
                        {asset.maintenanceSummary.maintenanceState}
                      </span>
                      <span className="muted-text">{asset.status}</span>
                    </div>
                  </button>
                )) : <p className="muted-text">No assets match the current maintenance filters.</p>}
              </div>
            </div>
          </AppCard>

          <AppCard title="Maintenance Actions" subtitle="Split work into smaller subsections instead of one tall operations wall">
            <div className="compact-two-up">
              <section className="subsection">
                <strong>Maintenance Plans</strong>
                <form className="admin-form" onSubmit={(event) => {
                  event.preventDefault();
                  void submit("/maintenance/plans", planForm, () => setPlanForm(emptyPlanForm));
                }}>
                  <div className="compact-filter-grid compact-filter-grid--two">
                    <label>
                      Asset
                      <select value={planForm.assetId} onChange={(event) => setPlanForm({ ...planForm, assetId: event.target.value })}>
                        <option value="">Select asset</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Title
                      <input value={planForm.title} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} />
                    </label>
                    <label>
                      Interval days
                      <input type="number" value={planForm.intervalDays} onChange={(event) => setPlanForm({ ...planForm, intervalDays: Number(event.target.value) })} />
                    </label>
                    <label>
                      Warning days
                      <input type="number" value={planForm.warningDays} onChange={(event) => setPlanForm({ ...planForm, warningDays: Number(event.target.value) })} />
                    </label>
                    <label className="compact-filter-grid__wide">
                      Next due
                      <input type="datetime-local" value={planForm.nextDueAt} onChange={(event) => setPlanForm({ ...planForm, nextDueAt: event.target.value })} />
                    </label>
                  </div>
                  <button type="submit">Save Plan</button>
                </form>
              </section>

              <section className="subsection">
                <strong>Maintenance Event</strong>
                <form className="admin-form" onSubmit={(event) => {
                  event.preventDefault();
                  void submit("/maintenance/events", eventForm, () => setEventForm(emptyEventForm));
                }}>
                  <div className="compact-filter-grid compact-filter-grid--two">
                    <label>
                      Asset
                      <select value={eventForm.assetId} onChange={(event) => setEventForm({ ...eventForm, assetId: event.target.value })}>
                        <option value="">Select asset</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Event type
                      <input value={eventForm.eventType} onChange={(event) => setEventForm({ ...eventForm, eventType: event.target.value })} />
                    </label>
                    <label>
                      Scheduled at
                      <input type="datetime-local" value={eventForm.scheduledAt} onChange={(event) => setEventForm({ ...eventForm, scheduledAt: event.target.value })} />
                    </label>
                    <label>
                      Completed at
                      <input type="datetime-local" value={eventForm.completedAt} onChange={(event) => setEventForm({ ...eventForm, completedAt: event.target.value })} />
                    </label>
                  </div>
                  <button type="submit">Save Event</button>
                </form>
              </section>

              <section className="subsection">
                <strong>Inspection</strong>
                <form className="admin-form" onSubmit={(event) => {
                  event.preventDefault();
                  void submit("/maintenance/inspections", inspectionForm, () => setInspectionForm(emptyInspectionForm));
                }}>
                  <div className="compact-filter-grid compact-filter-grid--two">
                    <label>
                      Asset
                      <select value={inspectionForm.assetId} onChange={(event) => setInspectionForm({ ...inspectionForm, assetId: event.target.value })}>
                        <option value="">Select asset</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Inspection type
                      <input value={inspectionForm.inspectionType} onChange={(event) => setInspectionForm({ ...inspectionForm, inspectionType: event.target.value })} />
                    </label>
                    <label>
                      Inspected at
                      <input type="datetime-local" value={inspectionForm.inspectedAt} onChange={(event) => setInspectionForm({ ...inspectionForm, inspectedAt: event.target.value })} />
                    </label>
                    <label>
                      Status
                      <select value={inspectionForm.status} onChange={(event) => setInspectionForm({ ...inspectionForm, status: event.target.value })}>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit">Save Inspection</button>
                </form>
              </section>

              <section className="subsection">
                <strong>Breakdown / Repair</strong>
                <form className="admin-form" onSubmit={(event) => {
                  event.preventDefault();
                  void submit("/maintenance/breakdowns", breakdownForm, () => setBreakdownForm(emptyBreakdownForm));
                }}>
                  <div className="compact-filter-grid compact-filter-grid--two">
                    <label>
                      Asset
                      <select value={breakdownForm.assetId} onChange={(event) => setBreakdownForm({ ...breakdownForm, assetId: event.target.value })}>
                        <option value="">Select asset</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>{asset.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Summary
                      <input value={breakdownForm.summary} onChange={(event) => setBreakdownForm({ ...breakdownForm, summary: event.target.value })} />
                    </label>
                    <label>
                      Reported at
                      <input type="datetime-local" value={breakdownForm.reportedAt} onChange={(event) => setBreakdownForm({ ...breakdownForm, reportedAt: event.target.value })} />
                    </label>
                    <label>
                      Status
                      <select value={breakdownForm.status} onChange={(event) => setBreakdownForm({ ...breakdownForm, status: event.target.value })}>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="RESOLVED">Resolved</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit">Save Breakdown</button>
                </form>
              </section>
            </div>
          </AppCard>
        </div>

        <div className="crm-page__sidebar">
          <AppCard title="Asset Maintenance Detail" subtitle="Plans, inspections, breakdowns, and scheduler effect">
            {selectedAsset ? (
              <div className="stack-grid">
                <div className="dashboard-preview">
                  <h3>{selectedAsset.name}</h3>
                  <p>
                    Scheduler impact: {selectedAsset.maintenanceSummary.schedulerImpact} | {selectedAsset.maintenanceSummary.maintenanceState}
                  </p>
                  <p>
                    Breakdown open: {selectedAsset.maintenanceSummary.openBreakdown ? "Yes" : "No"} | Inspection failed: {selectedAsset.maintenanceSummary.failedInspection ? "Yes" : "No"}
                  </p>
                </div>

                <div className="subsection">
                  <strong>Plans</strong>
                  <div className="dashboard-list dashboard-list--capped-sm">
                    {selectedAsset.maintenancePlans.length ? selectedAsset.maintenancePlans.map((plan) => (
                      <div key={plan.id} className="resource-card resource-card--compact">
                        <strong>{plan.title}</strong>
                        <span>{plan.nextDueAt ? new Date(plan.nextDueAt).toLocaleString() : "No due date"}</span>
                        <span className="muted-text">{plan.status}</span>
                      </div>
                    )) : <p className="muted-text">No plans on this asset yet.</p>}
                  </div>
                </div>

                <div className="subsection">
                  <strong>Breakdowns</strong>
                  <div className="dashboard-list dashboard-list--capped-sm">
                    {selectedAsset.breakdowns.length ? selectedAsset.breakdowns.map((breakdown) => (
                      <div key={breakdown.id} className="resource-card resource-card--compact">
                        <strong>{breakdown.summary}</strong>
                        <span className="muted-text">{breakdown.status}</span>
                      </div>
                    )) : <p className="muted-text">No breakdowns logged.</p>}
                  </div>
                </div>

                <div className="subsection">
                  <strong>Inspections</strong>
                  <div className="dashboard-list dashboard-list--capped-sm">
                    {selectedAsset.inspections.length ? selectedAsset.inspections.map((inspection) => (
                      <div key={inspection.id} className="resource-card resource-card--compact">
                        <strong>{inspection.inspectionType}</strong>
                        <span className="muted-text">{inspection.status}</span>
                      </div>
                    )) : <p className="muted-text">No inspections logged.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted-text">No maintenance records yet.</p>
            )}
          </AppCard>
        </div>
      </div>
    </div>
  );
}
