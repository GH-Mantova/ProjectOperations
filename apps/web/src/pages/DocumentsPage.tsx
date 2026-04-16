import { useEffect, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type DocumentRecord = {
  id: string;
  linkedEntityType: string;
  linkedEntityId: string;
  module: string;
  category: string;
  status: string;
  title: string;
  description?: string | null;
  versionLabel?: string | null;
  versionNumber: number;
  isCurrentVersion: boolean;
  fileLink?: {
    name: string;
    webUrl: string;
  } | null;
  tags: Array<{ tag: string }>;
  entitySummary?: {
    title: string;
    status: string;
  } | null;
};

const emptyDocumentForm = {
  linkedEntityType: "Job",
  linkedEntityId: "",
  category: "General",
  title: "",
  description: "",
  fileName: "",
  versionLabel: "v1",
  tags: "",
  accessType: "AUTHENTICATED",
  roleName: "",
  permissionCode: "documents.view"
};

export function DocumentsPage() {
  const { authFetch } = useAuth();
  const location = useLocation();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; jobNumber: string; name: string }>>([]);
  const [assets, setAssets] = useState<Array<{ id: string; assetCode: string; name: string }>>([]);
  const [submissions, setSubmissions] = useState<Array<{ id: string; summary?: string | null; templateVersion: { template: { code: string } } }>>([]);
  const [query, setQuery] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [versionTargetId, setVersionTargetId] = useState("");
  const [versionFileName, setVersionFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const documentFocus = (location.state as {
    documentFocus?: {
      linkedEntityType?: string;
      linkedEntityId?: string;
      from?: string;
      title?: string;
    };
  } | null)?.documentFocus;

  const load = async () => {
    const [documentsResponse, jobsResponse, assetsResponse, submissionsResponse] = await Promise.all([
      authFetch(`/documents?page=1&pageSize=100${query ? `&q=${encodeURIComponent(query)}` : ""}${entityTypeFilter ? `&linkedEntityType=${encodeURIComponent(entityTypeFilter)}` : ""}`),
      authFetch("/jobs?page=1&pageSize=100"),
      authFetch("/assets?page=1&pageSize=100"),
      authFetch("/forms/submissions?page=1&pageSize=100")
    ]);

    if (!documentsResponse.ok || !jobsResponse.ok || !assetsResponse.ok || !submissionsResponse.ok) {
      throw new Error("Unable to load documents workspace.");
    }

    const [documentsData, jobsData, assetsData, submissionsData] = await Promise.all([
      documentsResponse.json(),
      jobsResponse.json(),
      assetsResponse.json(),
      submissionsResponse.json()
    ]);

    setDocuments(documentsData.items);
    setJobs(jobsData.items);
    setAssets(assetsData.items);
    setSubmissions(submissionsData.items);
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  useEffect(() => {
    if (!documentFocus?.linkedEntityId || !documentFocus?.linkedEntityType) return;

    setEntityTypeFilter(documentFocus.linkedEntityType);
    setDocumentForm((current) => ({
      ...current,
      linkedEntityType: documentFocus.linkedEntityType ?? current.linkedEntityType,
      linkedEntityId: documentFocus.linkedEntityId ?? current.linkedEntityId
    }));
  }, [documentFocus]);

  const visibleDocuments = documentFocus?.linkedEntityId
    ? documents.filter(
        (document) =>
          document.linkedEntityType === documentFocus.linkedEntityType &&
          document.linkedEntityId === documentFocus.linkedEntityId
      )
    : documents;

  const entityOptions =
    documentForm.linkedEntityType === "Asset"
      ? assets.map((asset) => ({ id: asset.id, label: `${asset.assetCode} - ${asset.name}` }))
      : documentForm.linkedEntityType === "FormSubmission"
        ? submissions.map((submission) => ({
            id: submission.id,
            label: `${submission.templateVersion.template.code} - ${submission.summary ?? submission.id}`
          }))
        : jobs.map((job) => ({ id: job.id, label: `${job.jobNumber} - ${job.name}` }));

  const submitDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/documents", {
      method: "POST",
      body: JSON.stringify({
        linkedEntityType: documentForm.linkedEntityType,
        linkedEntityId: documentForm.linkedEntityId,
        category: documentForm.category,
        title: documentForm.title,
        description: documentForm.description || undefined,
        fileName: documentForm.fileName,
        versionLabel: documentForm.versionLabel || undefined,
        tags: documentForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        accessRules: [
          {
            accessType: documentForm.accessType,
            roleName: documentForm.accessType === "ROLE" ? documentForm.roleName || undefined : undefined,
            permissionCode:
              documentForm.accessType === "PERMISSION" ? documentForm.permissionCode || undefined : undefined
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to create document.");
      return;
    }

    setDocumentForm(emptyDocumentForm);
    await load();
  };

  const createVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!versionTargetId || !versionFileName) return;
    const targetDocument = documents.find((document) => document.id === versionTargetId);

    const response = await authFetch(`/documents/${versionTargetId}/versions`, {
      method: "POST",
      body: JSON.stringify({
        fileName: versionFileName,
        versionLabel: `v${(targetDocument?.versionNumber ?? 1) + 1}`
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to create document version.");
      return;
    }

    setVersionTargetId("");
    setVersionFileName("");
    await load();
  };

  const openDocumentLink = async (documentId: string, mode: "open-link" | "download") => {
    const response = await authFetch(`/documents/${documentId}/${mode}`);
    if (!response.ok) {
      setError(`Unable to ${mode === "download" ? "download" : "open"} document.`);
      return;
    }

    const body = await response.json();
    if (body.url) {
      window.open(body.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="crm-page crm-page--operations">
      {error ? <p className="error-text">{error}</p> : null}

      <div className="crm-page__sidebar">
        <AppCard title="Documents" subtitle="SharePoint-backed files linked to jobs, assets, and forms">
          <div className="stack-grid">
            {documentFocus?.linkedEntityId ? (
              <div className="notice-banner notice-banner--warning">
                <strong>Document focus</strong>
                <p>
                  You arrived from {documentFocus.from ?? "another module"} for <strong>{documentFocus.title ?? documentFocus.linkedEntityType}</strong>.
                  The register is focused on that linked record so you can continue the operational follow-through without re-filtering.
                </p>
              </div>
            ) : null}
            <form
              className="admin-form subsection"
              onSubmit={(event) => {
                event.preventDefault();
                load().catch((loadError) => setError((loadError as Error).message));
              }}
            >
              <div className="compact-filter-grid">
                <label>
                  Search
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, description, or file name" />
                </label>
                <label>
                  Entity type
                  <select value={entityTypeFilter} onChange={(event) => setEntityTypeFilter(event.target.value)}>
                    <option value="">All entities</option>
                    <option value="Job">Job</option>
                    <option value="Asset">Asset</option>
                    <option value="FormSubmission">Form Submission</option>
                    <option value="Tender">Tender</option>
                  </select>
                </label>
              </div>
              <button type="submit">Filter Documents</button>
            </form>

            <div className="dashboard-list dashboard-list--capped">
              {visibleDocuments.map((document) => (
                <div key={document.id} className="resource-card resource-card--compact">
                  <div className="split-header">
                    <div>
                      <strong>{document.title}</strong>
                      <p className="muted-text">
                        {document.category} | {document.versionLabel ?? `v${document.versionNumber}`} | {document.entitySummary?.title ?? document.linkedEntityType}
                      </p>
                    </div>
                    <div className="asset-record__meta">
                      <span className={document.isCurrentVersion ? "pill pill--green" : "pill pill--amber"}>
                        {document.isCurrentVersion ? "Current" : "Historical"}
                      </span>
                      <span className="muted-text">{document.module}</span>
                    </div>
                  </div>
                  <p className="muted-text">{document.description ?? document.fileLink?.name ?? "No description"}</p>
                  <div className="record-row">
                    <button type="button" onClick={() => openDocumentLink(document.id, "open-link")}>
                      Open Link
                    </button>
                    <button type="button" onClick={() => openDocumentLink(document.id, "download")}>
                      Download
                    </button>
                  </div>
                </div>
              ))}
              {!visibleDocuments.length ? (
                <p className="muted-text">
                  {documentFocus?.linkedEntityId
                    ? "No documents are linked to this focused record yet."
                    : "No documents match the current filters."}
                </p>
              ) : null}
            </div>
          </div>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Register Document" subtitle="Create SharePoint-backed document metadata and access rules">
          <form className="admin-form" onSubmit={submitDocument}>
            <div className="compact-filter-grid compact-filter-grid--two">
              <label>
                Linked entity type
                <select
                  value={documentForm.linkedEntityType}
                  onChange={(event) => setDocumentForm({ ...documentForm, linkedEntityType: event.target.value, linkedEntityId: "" })}
                >
                  <option value="Job">Job</option>
                  <option value="Asset">Asset</option>
                  <option value="FormSubmission">Form Submission</option>
                </select>
              </label>
              <label>
                Linked record
                <select
                  value={documentForm.linkedEntityId}
                  onChange={(event) => setDocumentForm({ ...documentForm, linkedEntityId: event.target.value })}
                >
                  <option value="">Select record</option>
                  {entityOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Category
                <input value={documentForm.category} onChange={(event) => setDocumentForm({ ...documentForm, category: event.target.value })} />
              </label>
              <label>
                Title
                <input value={documentForm.title} onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })} />
              </label>
              <label>
                File name
                <input value={documentForm.fileName} onChange={(event) => setDocumentForm({ ...documentForm, fileName: event.target.value })} />
              </label>
              <label>
                Version label
                <input value={documentForm.versionLabel} onChange={(event) => setDocumentForm({ ...documentForm, versionLabel: event.target.value })} />
              </label>
              <label className="compact-filter-grid__wide">
                Description
                <input value={documentForm.description} onChange={(event) => setDocumentForm({ ...documentForm, description: event.target.value })} />
              </label>
              <label>
                Tags
                <input value={documentForm.tags} onChange={(event) => setDocumentForm({ ...documentForm, tags: event.target.value })} placeholder="comma,separated,tags" />
              </label>
              <label>
                Access
                <select value={documentForm.accessType} onChange={(event) => setDocumentForm({ ...documentForm, accessType: event.target.value })}>
                  <option value="AUTHENTICATED">Authenticated users</option>
                  <option value="PERMISSION">Permission-based</option>
                  <option value="ROLE">Role-based</option>
                </select>
              </label>
              {documentForm.accessType === "PERMISSION" ? (
                <label className="compact-filter-grid__wide">
                  Permission code
                  <input
                    value={documentForm.permissionCode}
                    onChange={(event) => setDocumentForm({ ...documentForm, permissionCode: event.target.value })}
                  />
                </label>
              ) : null}
              {documentForm.accessType === "ROLE" ? (
                <label className="compact-filter-grid__wide">
                  Role name
                  <input value={documentForm.roleName} onChange={(event) => setDocumentForm({ ...documentForm, roleName: event.target.value })} />
                </label>
              ) : null}
            </div>
            <button type="submit">Register Document</button>
          </form>
        </AppCard>

        <AppCard title="Versioning" subtitle="Create a next version while preserving historical traceability">
          <form className="admin-form" onSubmit={createVersion}>
            <div className="compact-filter-grid compact-filter-grid--two">
              <label className="compact-filter-grid__wide">
                Existing document
                <select value={versionTargetId} onChange={(event) => setVersionTargetId(event.target.value)}>
                  <option value="">Select document</option>
                  {documents
                    .filter((document) => document.isCurrentVersion)
                    .map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title} ({document.versionLabel ?? `v${document.versionNumber}`})
                      </option>
                    ))}
                </select>
              </label>
              <label className="compact-filter-grid__wide">
                New file name
                <input value={versionFileName} onChange={(event) => setVersionFileName(event.target.value)} placeholder="updated-file.pdf" />
              </label>
            </div>
            <button type="submit">Create Next Version</button>
          </form>
        </AppCard>
      </div>
    </div>
  );
}
