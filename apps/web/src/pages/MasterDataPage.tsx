import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ClientStarRating } from "../components/ClientStarRating";

type TabKey = "clients" | "contacts" | "sites" | "resource-types" | "competencies" | "workers";

type TabConfig = {
  key: TabKey;
  label: string;
  shortLabel: string;
  subtitle: string;
  consumers: string[];
  endpoint: string;
  emptyLabel: string;
  createLabel: string;
  itemLabel: string;
  recordKind: string;
  formFields: string[];
};

type ReferenceState = {
  clients: Array<{ id: string; name: string }>;
  resourceTypes: Array<{ id: string; name: string }>;
  competencies: Array<{ id: string; name: string }>;
  workers: Array<{ id: string; firstName: string; lastName: string }>;
};

type MasterDataPageProps = {
  initialTab?: TabKey;
  allowedTabs?: TabKey[];
  title?: string;
  subtitle?: string;
  contextTitle?: string;
  contextBody?: string;
  contextLinks?: Array<{ to: string; label: string }>;
};

const tabConfigs: TabConfig[] = [
  {
    key: "clients",
    label: "Clients",
    shortLabel: "Organizations",
    subtitle: "Customer and account anchors reused across tenders, jobs, and sites",
    consumers: ["Tendering", "Jobs", "Sites"],
    endpoint: "clients",
    emptyLabel: "No clients yet.",
    createLabel: "Add organization",
    itemLabel: "client",
    recordKind: "Organization",
    formFields: ["name", "code", "status", "email", "phone", "notes"]
  },
  {
    key: "contacts",
    label: "Contacts",
    shortLabel: "People",
    subtitle: "Shared people records that can be linked into clients and workflows",
    consumers: ["Tendering", "Notifications", "Documents"],
    endpoint: "contacts",
    emptyLabel: "No contacts yet.",
    createLabel: "Add person",
    itemLabel: "contact",
    recordKind: "Contact",
    formFields: ["clientId", "firstName", "lastName", "email", "phone", "position", "notes"]
  },
  {
    key: "sites",
    label: "Sites",
    shortLabel: "Locations",
    subtitle: "Delivery and tender locations reused by Jobs and Tendering",
    consumers: ["Tendering", "Jobs", "Scheduler"],
    endpoint: "sites",
    emptyLabel: "No sites yet.",
    createLabel: "Add site",
    itemLabel: "site",
    recordKind: "Site",
    formFields: ["name", "clientId", "code", "addressLine1", "suburb", "state", "postcode", "notes"]
  },
  {
    key: "resource-types",
    label: "Resource Types",
    shortLabel: "Types",
    subtitle: "Foundational worker and asset categories reused across Resources and Assets",
    consumers: ["Resources", "Assets", "Scheduler"],
    endpoint: "resource-types",
    emptyLabel: "No resource types yet.",
    createLabel: "Add type",
    itemLabel: "resource type",
    recordKind: "Resource Type",
    formFields: ["name", "category", "code", "description"]
  },
  {
    key: "competencies",
    label: "Competencies",
    shortLabel: "Skills",
    subtitle: "Reusable competency records for scheduling and worker compliance",
    consumers: ["Resources", "Scheduler", "Forms"],
    endpoint: "competencies",
    emptyLabel: "No competencies yet.",
    createLabel: "Add competency",
    itemLabel: "competency",
    recordKind: "Competency",
    formFields: ["name", "code", "description"]
  },
  {
    key: "workers",
    label: "Workers",
    shortLabel: "People",
    subtitle: "Core worker records that power Resources and Scheduler assignment",
    consumers: ["Resources", "Scheduler", "Maintenance"],
    endpoint: "workers",
    emptyLabel: "No workers yet.",
    createLabel: "Add worker",
    itemLabel: "worker",
    recordKind: "Worker",
    formFields: ["firstName", "lastName", "resourceTypeId", "employeeCode", "email", "phone", "employmentType", "status", "notes"]
  }
];

const defaults: Record<TabKey, Record<string, string>> = {
  clients: { name: "", code: "", status: "ACTIVE", email: "", phone: "", notes: "" },
  contacts: { clientId: "", firstName: "", lastName: "", email: "", phone: "", position: "", notes: "" },
  sites: { name: "", clientId: "", code: "", addressLine1: "", suburb: "", state: "", postcode: "", notes: "" },
  "resource-types": { name: "", category: "Workers", code: "", description: "" },
  competencies: { name: "", code: "", description: "" },
  workers: {
    firstName: "",
    lastName: "",
    resourceTypeId: "",
    employeeCode: "",
    email: "",
    phone: "",
    employmentType: "Full-time",
    status: "ACTIVE",
    notes: ""
  }
};

function getRecordId(item: Record<string, unknown>, index: number) {
  return String(item.id ?? index);
}

function getTabConfig(tab: TabKey) {
  return tabConfigs.find((config) => config.key === tab) ?? tabConfigs[0];
}

function getDisplayName(tab: TabKey, item: Record<string, unknown>) {
  switch (tab) {
    case "clients":
      return String(item.name ?? "Untitled client");
    case "contacts": {
      const firstName = String(item.firstName ?? "").trim();
      const lastName = String(item.lastName ?? "").trim();
      return `${firstName} ${lastName}`.trim() || String(item.email ?? "Untitled contact");
    }
    case "sites":
      return String(item.name ?? "Untitled site");
    case "resource-types":
      return String(item.name ?? "Untitled type");
    case "competencies":
      return String(item.name ?? "Untitled competency");
    case "workers": {
      const firstName = String(item.firstName ?? "").trim();
      const lastName = String(item.lastName ?? "").trim();
      return `${firstName} ${lastName}`.trim() || String(item.employeeCode ?? "Untitled worker");
    }
    default:
      return "Untitled";
  }
}

function getMeta(tab: TabKey, item: Record<string, unknown>) {
  switch (tab) {
    case "clients":
      return [item.code ? `Code ${String(item.code)}` : null, item.status ? String(item.status) : "ACTIVE"].filter(Boolean);
    case "contacts": {
      const client = item.client as { name?: string } | null | undefined;
      return [client?.name ? `Client ${client.name}` : null, item.email ? String(item.email) : null].filter(Boolean);
    }
    case "sites": {
      const client = item.client as { name?: string } | null | undefined;
      return [client?.name ? `Client ${client.name}` : null, item.state ? String(item.state) : "Location"].filter(Boolean);
    }
    case "resource-types":
      return [item.category ? String(item.category) : "Category", item.code ? `Code ${String(item.code)}` : null].filter(Boolean);
    case "competencies":
      return [item.code ? `Code ${String(item.code)}` : null, item.workerCompetencies ? `${(item.workerCompetencies as unknown[]).length} links` : null].filter(Boolean);
    case "workers": {
      const resourceType = item.resourceType as { name?: string } | null | undefined;
      return [resourceType?.name ?? null, item.status ? String(item.status) : "ACTIVE"].filter(Boolean);
    }
    default:
      return [];
  }
}

function getHighlights(tab: TabKey, item: Record<string, unknown>) {
  switch (tab) {
    case "clients":
      return [
        { label: "Status", value: String(item.status ?? "ACTIVE") },
        { label: "Code", value: String(item.code ?? "Not set") }
      ];
    case "contacts": {
      const client = item.client as { name?: string } | null | undefined;
      return [
        { label: "Email", value: String(item.email ?? "Not set") },
        { label: "Client", value: client?.name ?? "Not linked" }
      ];
    }
    case "sites": {
      const client = item.client as { name?: string } | null | undefined;
      return [
        { label: "Client", value: client?.name ?? "Unassigned" },
        { label: "State", value: String(item.state ?? "Not set") }
      ];
    }
    case "resource-types":
      return [
        { label: "Category", value: String(item.category ?? "Not set") },
        { label: "Code", value: String(item.code ?? "Not set") }
      ];
    case "competencies":
      return [
        { label: "Code", value: String(item.code ?? "Not set") },
        { label: "Assignments", value: String((item.workerCompetencies as unknown[] | undefined)?.length ?? 0) }
      ];
    case "workers": {
      const resourceType = item.resourceType as { name?: string } | null | undefined;
      return [
        { label: "Type", value: resourceType?.name ?? "Not assigned" },
        { label: "Status", value: String(item.status ?? "ACTIVE") }
      ];
    }
    default:
      return [];
  }
}

function getDetailRows(tab: TabKey, item: Record<string, unknown>) {
  switch (tab) {
    case "clients":
      return [
        { label: "Name", value: String(item.name ?? "Untitled client") },
        { label: "Code", value: String(item.code ?? "Not set") },
        { label: "Email", value: String(item.email ?? "Not set") },
        { label: "Phone", value: String(item.phone ?? "Not set") }
      ];
    case "contacts": {
      const client = item.client as { name?: string } | null | undefined;
      return [
        { label: "First name", value: String(item.firstName ?? "Not set") },
        { label: "Last name", value: String(item.lastName ?? "Not set") },
        { label: "Email", value: String(item.email ?? "Not set") },
        { label: "Client", value: client?.name ?? "Not linked" }
      ];
    }
    case "sites": {
      const client = item.client as { name?: string } | null | undefined;
      return [
        { label: "Site", value: String(item.name ?? "Untitled site") },
        { label: "Client", value: client?.name ?? "Not linked" },
        { label: "Address", value: String(item.addressLine1 ?? "Not set") },
        { label: "Suburb / State", value: `${String(item.suburb ?? "Not set")} / ${String(item.state ?? "Not set")}` }
      ];
    }
    case "resource-types":
      return [
        { label: "Name", value: String(item.name ?? "Untitled type") },
        { label: "Category", value: String(item.category ?? "Not set") },
        { label: "Code", value: String(item.code ?? "Not set") },
        { label: "Description", value: String(item.description ?? "Not set") }
      ];
    case "competencies":
      return [
        { label: "Name", value: String(item.name ?? "Untitled competency") },
        { label: "Code", value: String(item.code ?? "Not set") },
        { label: "Description", value: String(item.description ?? "Not set") },
        { label: "Assignments", value: String((item.workerCompetencies as unknown[] | undefined)?.length ?? 0) }
      ];
    case "workers": {
      const resourceType = item.resourceType as { name?: string } | null | undefined;
      return [
        { label: "Name", value: getDisplayName(tab, item) },
        { label: "Employee code", value: String(item.employeeCode ?? "Not set") },
        { label: "Type", value: resourceType?.name ?? "Not assigned" },
        { label: "Email", value: String(item.email ?? "Not set") }
      ];
    }
    default:
      return [];
  }
}

function getContextCopy(tab: TabKey) {
  switch (tab) {
    case "clients":
      return "Use this account record as the commercial anchor for tenders, contacts, and award flow.";
    case "contacts":
      return "Link this person into clarifications, tender relationship mapping, and shared communication records.";
    case "sites":
      return "Reuse this site in tender capture, job setup, and delivery planning without retyping location details.";
    case "resource-types":
      return "Keep worker and asset categories consistent across Resources, Assets, and Scheduler.";
    case "competencies":
      return "These competency records power worker suitability, compliance, and scheduling filters.";
    case "workers":
      return "This worker master record feeds the operational resources and scheduler assignment flows.";
    default:
      return "";
  }
}

function getFieldLabel(field: string) {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/-/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

export function MasterDataPage({
  initialTab = "clients",
  allowedTabs,
  title = "Master Data",
  subtitle = "Reference-data hub for reusable records shared across tendering, jobs, resources, assets, and forms",
  contextTitle,
  contextBody,
  contextLinks = []
}: MasterDataPageProps) {
  const { authFetch } = useAuth();
  const visibleTabs = allowedTabs ? tabConfigs.filter((tab) => allowedTabs.includes(tab.key)) : tabConfigs;
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(defaults.clients);
  const [references, setReferences] = useState<ReferenceState>({
    clients: [],
    resourceTypes: [],
    competencies: [],
    workers: []
  });

  const activeConfig = getTabConfig(activeTab);

  const load = async (tab: TabKey) => {
    const tabConfig = getTabConfig(tab);
    const [listResponse, refResponse] = await Promise.all([
      authFetch(`/master-data/${tabConfig.endpoint}`),
      authFetch("/master-data/references")
    ]);

    if (listResponse.ok) {
      const listData = await listResponse.json();
      const nextItems = listData.items as Record<string, unknown>[];
      setItems(nextItems);
      setSelectedItemId((current) => current ?? (nextItems[0] ? getRecordId(nextItems[0], 0) : null));
    } else {
      setItems([]);
      setSelectedItemId(null);
    }

    if (refResponse.ok) {
      setReferences(await refResponse.json());
    }
  };

  useEffect(() => {
    setForm(defaults[activeTab]);
    setSelectedItemId(null);
    void load(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? initialTab);
    }
  }, [activeTab, initialTab, visibleTabs]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== "")
    );

    const response = await authFetch(`/master-data/${activeConfig.endpoint}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      setForm(defaults[activeTab]);
      await load(activeTab);
    }
  };

  const selectedItem = useMemo(() => {
    return items.find((item, index) => getRecordId(item, index) === selectedItemId) ?? items[0] ?? null;
  }, [items, selectedItemId]);

  const selectedTitle = selectedItem ? getDisplayName(activeTab, selectedItem) : `No ${activeConfig.itemLabel} selected`;
  const selectedMeta = selectedItem ? getMeta(activeTab, selectedItem) : [];
  const selectedHighlights = selectedItem ? getHighlights(activeTab, selectedItem) : [];
  const selectedDetails = selectedItem ? getDetailRows(activeTab, selectedItem) : [];

  const renderField = (field: string) => {
    const value = form[field] ?? "";

    if (field === "clientId") {
      return (
        <select value={value} onChange={(event) => setForm({ ...form, [field]: event.target.value })}>
          <option value="">Select client</option>
          {references.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      );
    }

    if (field === "resourceTypeId") {
      return (
        <select value={value} onChange={(event) => setForm({ ...form, [field]: event.target.value })}>
          <option value="">Select resource type</option>
          {references.resourceTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      );
    }

    if (field === "status" && activeTab === "workers") {
      return (
        <select value={value} onChange={(event) => setForm({ ...form, [field]: event.target.value })}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      );
    }

    if (field === "status" && activeTab === "clients") {
      return (
        <select value={value} onChange={(event) => setForm({ ...form, [field]: event.target.value })}>
          <option value="ACTIVE">Active</option>
          <option value="PROSPECT">Prospect</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      );
    }

    if (field === "category" && activeTab === "resource-types") {
      return (
        <select value={value} onChange={(event) => setForm({ ...form, [field]: event.target.value })}>
          <option value="Workers">Workers</option>
          <option value="Assets">Assets</option>
          <option value="Plant">Plant</option>
          <option value="Vehicles">Vehicles</option>
        </select>
      );
    }

    if (field === "notes" || field === "description") {
      return <textarea value={value} onChange={(event) => setForm({ ...form, [field]: event.target.value })} rows={3} />;
    }

    return <input value={value} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />;
  };

  return (
    <div className="crm-page crm-page--operations">
      <div className="crm-page__sidebar">
        <AppCard title={title} subtitle={subtitle}>
          <div className="crm-toolbar">
            <div className="crm-toolbar__metric">
              <span>Domains</span>
              <strong>{visibleTabs.length}</strong>
            </div>
            <div className="crm-toolbar__metric">
              <span>Active area</span>
              <strong>{activeConfig.label}</strong>
            </div>
          </div>
          {contextTitle || contextBody || contextLinks.length ? (
            <div className="crm-context-banner">
              {contextTitle ? <strong>{contextTitle}</strong> : null}
              {contextBody ? <p className="muted-text">{contextBody}</p> : null}
              {contextLinks.length ? (
                <div className="crm-context-banner__links">
                  {contextLinks.map((item) => (
                    <Link key={`${item.to}-${item.label}`} className="tendering-inline-link" to={item.to}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="subsection">
            <strong>Used by</strong>
            <div className="inline-fields">
              {activeConfig.consumers.map((consumer) => (
                <span key={consumer} className="pill pill--blue">{consumer}</span>
              ))}
            </div>
            <p className="muted-text">
              This is the shared reference-data layer, not the Tendering workflow screen. Maintain reusable records here, then consume them downstream in the operational modules.
            </p>
          </div>
          <div className="crm-nav">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={tab.key === activeTab ? "crm-nav__item crm-nav__item--active" : "crm-nav__item"}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{tab.label}</span>
                <small>{tab.subtitle}</small>
              </button>
            ))}
          </div>
        </AppCard>

        <AppCard title={activeConfig.createLabel} subtitle={`Create a reusable ${activeConfig.itemLabel} record without leaving the reference-data workspace.`}>
          <form className="admin-form crm-composer" onSubmit={submit}>
            {activeConfig.formFields.map((field) => (
              <label key={field}>
                {getFieldLabel(field)}
                {renderField(field)}
              </label>
            ))}
            <button type="submit">Save {activeConfig.itemLabel}</button>
          </form>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title={activeConfig.label} subtitle={activeConfig.subtitle}>
          <div className="crm-toolbar">
            <div className="crm-toolbar__metric">
              <span>Total records</span>
              <strong>{items.length}</strong>
            </div>
            <div className="crm-toolbar__metric">
              <span>Selected</span>
              <strong>{selectedItem ? "Open" : "None"}</strong>
            </div>
          </div>
          <div className="crm-directory">
            {items.length ? (
              items.map((item, index) => {
                const id = getRecordId(item, index);
                const displayName = getDisplayName(activeTab, item);
                const meta = getMeta(activeTab, item);

                return (
                  <button
                    key={id}
                    type="button"
                    className={id === selectedItemId || (!selectedItemId && index === 0) ? "crm-directory__item crm-directory__item--active" : "crm-directory__item"}
                    onClick={() => setSelectedItemId(id)}
                  >
                    <div className="crm-directory__avatar">{displayName.slice(0, 2).toUpperCase()}</div>
                    <div className="crm-directory__content">
                      <strong>{displayName}</strong>
                      <span>{meta[0] ?? `No ${activeConfig.itemLabel} metadata yet`}</span>
                    </div>
                    {meta[1] ? <span className="pill pill--blue">{meta[1]}</span> : null}
                  </button>
                );
              })
            ) : (
              <div className="crm-empty">
                <strong>{activeConfig.emptyLabel}</strong>
                <p>Create the first record from the composer on the left to start building the shared ERP reference foundation.</p>
              </div>
            )}
          </div>
        </AppCard>

        <AppCard title={selectedTitle} subtitle={`Read-first ${activeConfig.itemLabel} workspace for shared master records.`}>
          {selectedItem ? (
            <div className="crm-record">
              <div className="crm-record__hero">
                <div>
                  <span className="tendering-section-label tendering-section-label--muted">{activeConfig.recordKind}</span>
                  <h3>{selectedTitle}</h3>
                  <p className="muted-text">{selectedMeta.join(" | ") || `No ${activeConfig.itemLabel} metadata captured yet.`}</p>
                </div>
                <div className="crm-record__pills">
                  {selectedHighlights.map((item) => (
                    <div key={item.label} className="crm-record__pill-card">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="crm-record__body">
                <div className="crm-record__panel">
                  <strong>Summary</strong>
                  <div className="crm-record__details">
                    {selectedDetails.map((item) => (
                      <div key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="crm-record__panel">
                  <strong>Operational context</strong>
                  <p className="muted-text">{getContextCopy(activeTab)}</p>
                </div>
              </div>

              {activeTab === "clients" ? (
                <ClientPreferencePanel
                  item={selectedItem}
                  onSaved={() => void load(activeTab)}
                />
              ) : null}
            </div>
          ) : (
            <div className="crm-empty crm-empty--detail">
              <strong>No {activeConfig.itemLabel} selected.</strong>
              <p>Choose a record from the list to open its shared master-data detail panel.</p>
            </div>
          )}
        </AppCard>
      </div>
    </div>
  );
}

function ClientPreferencePanel({
  item,
  onSaved
}: {
  item: Record<string, unknown>;
  onSaved: () => void;
}) {
  const { authFetch } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = typeof item.id === "string" ? item.id : null;
  const name = typeof item.name === "string" ? item.name : "";
  const preferenceScore =
    typeof item.preferenceScore === "number" ? item.preferenceScore : null;
  const winCount = typeof item.winCount === "number" ? item.winCount : 0;
  const tenderCount = typeof item.tenderCount === "number" ? item.tenderCount : 0;
  const winRateRaw = item.winRate;
  const winRate =
    typeof winRateRaw === "number"
      ? winRateRaw
      : typeof winRateRaw === "string" && winRateRaw !== ""
        ? Number(winRateRaw)
        : null;

  const setScore = async (next: number) => {
    if (!id || !name) return;
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch(`/master-data/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, preferenceScore: next })
      });
      if (!response.ok) throw new Error(await response.text());
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crm-record__panel">
      <strong>Preference</strong>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <ClientStarRating
          score={preferenceScore}
          onChange={saving ? undefined : setScore}
          ariaLabel={`${name || "Client"} preference score`}
        />
        {saving ? <span className="muted-text">Saving…</span> : null}
      </div>
      <p className="muted-text" style={{ marginTop: 6 }}>
        {tenderCount > 0 && winRate !== null && Number.isFinite(winRate)
          ? `Win rate: ${winRate.toFixed(0)}% (${winCount} won of ${tenderCount} quoted)`
          : "No tender history"}
      </p>
      {error ? (
        <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{error}</p>
      ) : null}
    </div>
  );
}
