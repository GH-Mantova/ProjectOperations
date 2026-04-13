import { useEffect, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type AssetCategory = {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
};

type AssetRecord = {
  id: string;
  name: string;
  assetCode: string;
  serialNumber?: string | null;
  status: string;
  homeBase?: string | null;
  currentLocation?: string | null;
  notes?: string | null;
  category?: { id: string; name: string } | null;
  resourceType?: { id: string; name: string } | null;
  maintenanceSummary?: {
    maintenanceState: string;
    schedulerImpact: string;
    openBreakdown: boolean;
    failedInspection: boolean;
  };
  maintenancePlans?: Array<{
    id: string;
    title: string;
    nextDueAt?: string | null;
    status: string;
  }>;
  breakdowns?: Array<{
    id: string;
    summary: string;
    status: string;
  }>;
  shiftAssignments: Array<{
    id: string;
    shift: {
      id: string;
      title: string;
      startAt: string;
      job: {
        id: string;
        jobNumber: string;
        name: string;
        status: string;
      };
    };
  }>;
  linkedJobs?: Array<{ id: string; jobNumber: string; name: string; status: string }>;
  documents?: Array<{
    id: string;
    title: string;
    category: string;
    versionLabel?: string | null;
    fileLink?: { webUrl: string; name: string } | null;
    tags?: Array<{ tag: string }>;
  }>;
};

const emptyCategoryForm = {
  name: "",
  code: "",
  description: ""
};

const emptyAssetForm = {
  assetCategoryId: "",
  resourceTypeId: "",
  name: "",
  assetCode: "",
  serialNumber: "",
  status: "AVAILABLE",
  homeBase: "",
  currentLocation: "",
  notes: ""
};

export function AssetsPage() {
  const { authFetch } = useAuth();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [resourceTypes, setResourceTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [assetsResponse, categoriesResponse, referencesResponse] = await Promise.all([
      authFetch(`/assets?page=1&pageSize=100${query ? `&q=${encodeURIComponent(query)}` : ""}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""}${categoryFilter ? `&categoryId=${encodeURIComponent(categoryFilter)}` : ""}`),
      authFetch("/assets/categories"),
      authFetch("/master-data/references")
    ]);

    if (!assetsResponse.ok || !categoriesResponse.ok || !referencesResponse.ok) {
      throw new Error("Unable to load assets workspace.");
    }

    const [assetsData, categoriesData, referencesData] = await Promise.all([
      assetsResponse.json(),
      categoriesResponse.json(),
      referencesResponse.json()
    ]);

    setAssets(assetsData.items);
    setCategories(categoriesData);
    setResourceTypes(referencesData.resourceTypes);

    if (selectedAsset) {
      const refreshed = assetsData.items.find((asset: AssetRecord) => asset.id === selectedAsset.id);
      if (refreshed) {
        const detailResponse = await authFetch(`/assets/${refreshed.id}`);
        if (detailResponse.ok) {
          setSelectedAsset(await detailResponse.json());
        }
      }
    }
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  const searchAssets = async (event: React.FormEvent) => {
    event.preventDefault();
    await load().catch((loadError) => setError((loadError as Error).message));
  };

  const openAsset = async (assetId: string) => {
    const response = await authFetch(`/assets/${assetId}`);
    if (!response.ok) {
      setError("Unable to load asset detail.");
      return;
    }
    setSelectedAsset(await response.json());
  };

  const createCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/assets/categories", {
      method: "POST",
      body: JSON.stringify(categoryForm)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to save asset category.");
      return;
    }

    setCategoryForm(emptyCategoryForm);
    await load();
  };

  const createAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/assets", {
      method: "POST",
      body: JSON.stringify(assetForm)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to save asset.");
      return;
    }

    setAssetForm(emptyAssetForm);
    await load();
  };

  return (
    <div className="crm-page crm-page--operations">
      {error ? <p className="error-text">{error}</p> : null}

      <div className="crm-page__sidebar">
        <AppCard title="Asset Register" subtitle="Schedulable plant and equipment with live assignment visibility">
          <div className="scheduler-pane">
            <form className="admin-form subsection" onSubmit={searchAssets}>
              <div className="compact-filter-grid">
                <label>
                  Search assets
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, code, serial, or location" />
                </label>
                <label>
                  Status
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="ALLOCATED">Allocated</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="OUT_OF_SERVICE">Out of service</option>
                  </select>
                </label>
                <label>
                  Category
                  <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="">All categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="inline-fields">
                <span className="pill pill--blue">{assets.length} assets in view</span>
                <button type="submit">Filter Assets</button>
              </div>
            </form>

            <div className="dashboard-list dashboard-list--capped">
              {assets.map((asset) => (
                <button key={asset.id} type="button" className="asset-record" onClick={() => openAsset(asset.id)}>
                  <div>
                    <strong>{asset.name}</strong>
                    <p className="muted-text">
                      {asset.assetCode} {asset.serialNumber ? `· ${asset.serialNumber}` : ""}
                    </p>
                  </div>
                  <div className="asset-record__meta">
                    <span className={asset.status === "AVAILABLE" ? "pill pill--green" : "pill pill--amber"}>{asset.status}</span>
                    <span className="muted-text">{asset.category?.name ?? asset.resourceType?.name ?? "Uncategorised"}</span>
                    <span className="muted-text">{asset.maintenanceSummary?.maintenanceState ?? "No maintenance summary"}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </AppCard>

        <AppCard title="Asset Categories" subtitle="Manage asset classification for the register and scheduler">
          <div className="stack-grid">
            <div className="dashboard-list dashboard-list--capped-sm">
              {categories.map((category) => (
                <div key={category.id} className="resource-card resource-card--compact">
                  <div className="split-header">
                    <div>
                      <strong>{category.name}</strong>
                      <p className="muted-text">{category.code || "No code"}</p>
                    </div>
                    <span className={`pill ${category.isActive ? "pill--green" : "pill--amber"}`}>
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <form className="admin-form subsection" onSubmit={createCategory}>
              <label>
                Name
                <input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
              </label>
              <label>
                Code
                <input value={categoryForm.code} onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })} />
              </label>
              <label>
                Description
                <input value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} />
              </label>
              <button type="submit">Add Category</button>
            </form>
          </div>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Asset Detail" subtitle="Job and shift assignment visibility">
          {selectedAsset ? (
            <div className="scheduler-pane">
              <dl className="detail-list">
                <div>
                  <dt>Asset code</dt>
                  <dd>{selectedAsset.assetCode}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedAsset.status}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{selectedAsset.category?.name ?? "None"}</dd>
                </div>
                <div>
                  <dt>Home base</dt>
                  <dd>{selectedAsset.homeBase ?? "Not set"}</dd>
                </div>
                <div>
                  <dt>Current location</dt>
                  <dd>{selectedAsset.currentLocation ?? "Not set"}</dd>
                </div>
                <div>
                  <dt>Serial number</dt>
                  <dd>{selectedAsset.serialNumber ?? "Not recorded"}</dd>
                </div>
              </dl>

              <div className="subsection">
                <strong>Maintenance Status</strong>
                <div className="record-row">
                  <span>{selectedAsset.maintenanceSummary?.maintenanceState ?? "Unknown"}</span>
                  <span className="muted-text">{selectedAsset.maintenanceSummary?.schedulerImpact ?? "NONE"}</span>
                </div>
                {selectedAsset.maintenancePlans?.map((plan) => (
                  <div key={plan.id} className="record-row">
                    <div>
                      <span>{plan.title}</span>
                      <p className="muted-text">{plan.nextDueAt ? new Date(plan.nextDueAt).toLocaleString() : "No due date"}</p>
                    </div>
                    <span className="muted-text">{plan.status}</span>
                  </div>
                ))}
                {selectedAsset.breakdowns?.map((breakdown) => (
                  <div key={breakdown.id} className="record-row">
                    <span>{breakdown.summary}</span>
                    <span className="muted-text">{breakdown.status}</span>
                  </div>
                ))}
              </div>

              <div className="subsection">
                <strong>Linked Jobs</strong>
                {selectedAsset.linkedJobs?.map((job) => (
                  <div key={job.id} className="record-row">
                    <span>{job.jobNumber} - {job.name}</span>
                    <span className="muted-text">{job.status}</span>
                  </div>
                )) ?? <p className="muted-text">No linked jobs.</p>}
              </div>

              <div className="subsection">
                <strong>Shift Assignments</strong>
                {selectedAsset.shiftAssignments.map((assignment) => (
                  <div key={assignment.id} className="record-row">
                    <div>
                      <span>{assignment.shift.title}</span>
                      <p className="muted-text">{assignment.shift.job.jobNumber} - {assignment.shift.job.name}</p>
                    </div>
                    <span className="muted-text">{new Date(assignment.shift.startAt).toLocaleString()}</span>
                  </div>
                ))}
                {selectedAsset.shiftAssignments.length === 0 ? <p className="muted-text">No shift assignments yet.</p> : null}
              </div>

              <div className="subsection">
                <strong>Documents</strong>
                {selectedAsset.documents?.map((document) => (
                  <div key={document.id} className="record-row">
                    <div>
                      <span>{document.title}</span>
                      <p className="muted-text">
                        {document.category} {document.versionLabel ? `· ${document.versionLabel}` : ""}
                      </p>
                    </div>
                    <a href={document.fileLink?.webUrl ?? "#"} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </div>
                )) ?? <p className="muted-text">No linked documents.</p>}
              </div>
            </div>
          ) : (
            <p className="muted-text">Select an asset from the register to view assignment visibility.</p>
          )}
        </AppCard>

        <AppCard title="Create Asset" subtitle="Add plant or equipment into the schedulable register">
          <form className="admin-form" onSubmit={createAsset}>
            <div className="compact-filter-grid compact-filter-grid--two">
              <label>
                Name
                <input value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} />
              </label>
              <label>
                Asset code
                <input value={assetForm.assetCode} onChange={(event) => setAssetForm({ ...assetForm, assetCode: event.target.value })} />
              </label>
              <label>
                Serial number
                <input value={assetForm.serialNumber} onChange={(event) => setAssetForm({ ...assetForm, serialNumber: event.target.value })} />
              </label>
              <label>
                Category
                <select value={assetForm.assetCategoryId} onChange={(event) => setAssetForm({ ...assetForm, assetCategoryId: event.target.value })}>
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Resource type
                <select value={assetForm.resourceTypeId} onChange={(event) => setAssetForm({ ...assetForm, resourceTypeId: event.target.value })}>
                  <option value="">Select resource type</option>
                  {resourceTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={assetForm.status} onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value })}>
                  <option value="AVAILABLE">Available</option>
                  <option value="ALLOCATED">Allocated</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="OUT_OF_SERVICE">Out of service</option>
                </select>
              </label>
              <label>
                Home base
                <input value={assetForm.homeBase} onChange={(event) => setAssetForm({ ...assetForm, homeBase: event.target.value })} />
              </label>
              <label>
                Current location
                <input value={assetForm.currentLocation} onChange={(event) => setAssetForm({ ...assetForm, currentLocation: event.target.value })} />
              </label>
            </div>
            <label>
              Notes
              <input value={assetForm.notes} onChange={(event) => setAssetForm({ ...assetForm, notes: event.target.value })} />
            </label>
            <button type="submit">Create Asset</button>
          </form>
        </AppCard>
      </div>
    </div>
  );
}
