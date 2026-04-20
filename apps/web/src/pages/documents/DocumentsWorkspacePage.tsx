import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type DocumentItem = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  module: string;
  status: string;
  versionLabel?: string | null;
  versionNumber: number;
  isCurrentVersion: boolean;
  documentFamilyKey?: string | null;
  linkedEntityType: string;
  linkedEntityId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  folderLink?: {
    id: string;
    relativePath: string;
  } | null;
  fileLink?: {
    id: string;
    name: string;
    webUrl: string;
    sizeBytes?: number | null;
    mimeType?: string | null;
  } | null;
};

type DocumentsResponse = {
  items: DocumentItem[];
  total: number;
};

const ENTITY_LABELS: Record<string, string> = {
  Job: "Jobs",
  Asset: "Assets",
  FormSubmission: "Form submissions",
  Tender: "Tenders",
  Site: "Sites",
  Worker: "Workers",
  Client: "Clients"
};

const ENTITY_ORDER = ["Job", "Tender", "Asset", "FormSubmission", "Site", "Worker", "Client"];

function extensionOf(name: string | undefined | null): string {
  if (!name) return "file";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "file";
}

const EXTENSION_COLOR: Record<string, string> = {
  pdf: "#EF4444",
  doc: "#3B82F6",
  docx: "#3B82F6",
  xls: "#1D9E75",
  xlsx: "#1D9E75",
  csv: "#1D9E75",
  png: "#F59E0B",
  jpg: "#F59E0B",
  jpeg: "#F59E0B",
  gif: "#F59E0B",
  heic: "#F59E0B",
  zip: "#6B7280",
  txt: "#6B7280"
};

function fileTypeIcon(name: string | undefined | null): { ext: string; color: string } {
  const ext = extensionOf(name);
  return { ext, color: EXTENSION_COLOR[ext] ?? "var(--text-secondary, #6B7280)" };
}

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.heic,.zip,.txt";
const ACCEPTED_EXT = new Set(
  ACCEPT.split(",").map((s) => s.replace(/^\./, "").toLowerCase())
);

function formatSize(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsWorkspacePage() {
  const { authFetch } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<{ type: string; id: string } | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(ENTITY_ORDER));
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<{ document: DocumentItem | null } | null>(null);
  const [dragHover, setDragHover] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/documents?page=1&pageSize=100");
      if (!response.ok) throw new Error("Could not load documents.");
      const data = (await response.json()) as DocumentsResponse;
      setDocuments(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch]);

  const tree = useMemo(() => {
    const byType = new Map<string, Map<string, DocumentItem[]>>();
    for (const doc of documents) {
      if (!byType.has(doc.linkedEntityType)) byType.set(doc.linkedEntityType, new Map());
      const inner = byType.get(doc.linkedEntityType)!;
      if (!inner.has(doc.linkedEntityId)) inner.set(doc.linkedEntityId, []);
      inner.get(doc.linkedEntityId)!.push(doc);
    }
    return byType;
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    if (selectedContext === "all") return documents;
    return documents.filter((d) => d.linkedEntityType === selectedContext.type && d.linkedEntityId === selectedContext.id);
  }, [documents, selectedContext]);

  const sortedEntityTypes = useMemo(() => {
    const keys = Array.from(tree.keys());
    keys.sort((a, b) => {
      const ai = ENTITY_ORDER.indexOf(a);
      const bi = ENTITY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return keys;
  }, [tree]);

  const toggleExpand = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDropToList = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragHover(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return;
    const invalid = files.filter((f) => !ACCEPTED_EXT.has(extensionOf(f.name)));
    if (invalid.length > 0) {
      setError(`Unsupported file type: ${invalid.map((f) => f.name).join(", ")}`);
      return;
    }
    if (selectedContext === "all") {
      setError("Pick a job / asset / form on the left before uploading, or use the Upload button on an existing document to add a new version.");
      return;
    }
    // Open the upload slide-over with the first dropped file pre-selected
    setUploadTarget({ document: null });
    setUploadOpen(true);
    setTimeout(() => window.dispatchEvent(new CustomEvent("s7-docs-prefill", { detail: files[0] })), 0);
  };

  const downloadDocument = async (doc: DocumentItem) => {
    try {
      const response = await authFetch(`/documents/${doc.id}/download`);
      if (!response.ok) throw new Error("Could not generate download URL.");
      const body = await response.json();
      if (body.url) {
        window.open(body.url, "_blank", "noopener");
      } else if (doc.fileLink?.webUrl) {
        window.open(doc.fileLink.webUrl, "_blank", "noopener");
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="docs-page">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Data</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Documents</h1>
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => {
            if (selectedContext === "all") {
              setError("Pick a job, asset, tender, site, or worker on the left before uploading.");
              return;
            }
            setUploadTarget({ document: null });
            setUploadOpen(true);
          }}
        >
          + Upload
        </button>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <div className="docs-split">
        <aside className="docs-tree">
          <header className="docs-tree__head">
            <span className="s7-type-label">Contexts</span>
          </header>
          <div className="docs-tree__body">
            {loading ? (
              <Skeleton height={24} />
            ) : (
              <>
                <button
                  type="button"
                  className={selectedContext === "all" ? "docs-tree__item docs-tree__item--active" : "docs-tree__item"}
                  onClick={() => setSelectedContext("all")}
                >
                  <strong>All documents</strong>
                  <span className="sched-hierarchy__count">{documents.length}</span>
                </button>
                {sortedEntityTypes.map((type) => {
                  const entities = tree.get(type)!;
                  const isOpen = expanded.has(type);
                  return (
                    <div key={type} className="docs-tree__group">
                      <button
                        type="button"
                        className="docs-tree__group-head"
                        onClick={() => toggleExpand(type)}
                        aria-expanded={isOpen}
                      >
                        <span className="docs-tree__caret">{isOpen ? "▾" : "▸"}</span>
                        <span className="docs-tree__group-label">{ENTITY_LABELS[type] ?? type}</span>
                        <span className="sched-hierarchy__count">{entities.size}</span>
                      </button>
                      {isOpen ? (
                        <ul className="docs-tree__entities">
                          {Array.from(entities.entries()).map(([entityId, docs]) => {
                            const active = selectedContext !== "all" && selectedContext.type === type && selectedContext.id === entityId;
                            const firstDoc = docs[0];
                            const pathHint = firstDoc.folderLink?.relativePath.split("/").slice(-2, -1)[0] ?? entityId.slice(0, 10);
                            return (
                              <li key={entityId}>
                                <button
                                  type="button"
                                  className={active ? "docs-tree__item docs-tree__item--active" : "docs-tree__item"}
                                  onClick={() => setSelectedContext({ type, id: entityId })}
                                  title={entityId}
                                >
                                  <span>{pathHint}</span>
                                  <span className="sched-hierarchy__count">{docs.length}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        <section
          className={dragHover ? "docs-list docs-list--drag-over" : "docs-list"}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              setDragHover(true);
            }
          }}
          onDragLeave={() => setDragHover(false)}
          onDrop={handleDropToList}
        >
          <div className="docs-list__dropzone" aria-hidden>
            Drop a file anywhere on this pane to upload to the selected context
            <span className="docs-list__dropzone-sub">Accepted: {ACCEPT}</span>
          </div>

          {loading ? (
            <div className="docs-list__body">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`doc-skel-${index}`} className="docs-row">
                  <Skeleton width={28} height={28} radius={6} />
                  <Skeleton width="60%" height={14} />
                  <Skeleton width={60} height={14} />
                </div>
              ))}
            </div>
          ) : visibleDocuments.length === 0 ? (
            <EmptyState
              heading="No documents here yet"
              subtext={selectedContext === "all" ? "Upload a file or pick a context to see its documents." : "Drop a file onto this pane to upload the first document."}
            />
          ) : (
            <ul className="docs-list__body">
              {visibleDocuments.map((doc) => {
                const icon = fileTypeIcon(doc.fileLink?.name);
                return (
                  <li key={doc.id} className={doc.isCurrentVersion ? "docs-row" : "docs-row docs-row--superseded"}>
                    <span className="docs-row__icon" style={{ background: `${icon.color}15`, color: icon.color }} aria-hidden>
                      {icon.ext.toUpperCase().slice(0, 4)}
                    </span>
                    <div className="docs-row__meta">
                      <strong className="docs-row__name">{doc.title}</strong>
                      <span className="docs-row__sub">
                        {ENTITY_LABELS[doc.linkedEntityType] ?? doc.linkedEntityType}
                        {" · "}{doc.category}
                        {doc.fileLink?.sizeBytes ? ` · ${formatSize(doc.fileLink.sizeBytes)}` : ""}
                      </span>
                    </div>
                    <span className="s7-badge s7-badge--neutral">{doc.versionLabel ?? `v${doc.versionNumber}`}</span>
                    <span className="docs-row__uploader">
                      {doc.createdBy ? `${doc.createdBy.firstName} ${doc.createdBy.lastName}` : "—"}
                    </span>
                    <span className="docs-row__date">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="docs-row__actions">
                      <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={() => void downloadDocument(doc)}>
                        Download
                      </button>
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => {
                          setUploadTarget({ document: doc });
                          setUploadOpen(true);
                        }}
                      >
                        New version
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {uploadOpen ? (
        <UploadSlideOver
          onClose={() => {
            setUploadOpen(false);
            setUploadTarget(null);
          }}
          onUploaded={() => {
            setUploadOpen(false);
            setUploadTarget(null);
            void reload();
          }}
          context={selectedContext === "all" ? null : selectedContext}
          existing={uploadTarget?.document ?? null}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

type UploadSlideOverProps = {
  onClose: () => void;
  onUploaded: () => void;
  context: { type: string; id: string } | null;
  existing: DocumentItem | null;
  onError: (message: string) => void;
};

function UploadSlideOver({ onClose, onUploaded, context, existing, onError }: UploadSlideOverProps) {
  const { authFetch } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? "General");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [versionLabel, setVersionLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<File>).detail;
      if (detail instanceof File) {
        setFile(detail);
        if (!existing) setTitle(detail.name);
      }
    };
    window.addEventListener("s7-docs-prefill", handler);
    return () => window.removeEventListener("s7-docs-prefill", handler);
  }, [existing]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (!file) {
      setLocalError("Select a file to upload.");
      return;
    }
    if (!existing && !context) {
      setLocalError("Pick a context to attach the new document to.");
      return;
    }
    if (!ACCEPTED_EXT.has(extensionOf(file.name))) {
      setLocalError(`Unsupported file type: .${extensionOf(file.name)}`);
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      if (existing) {
        body.append("fileName", file.name);
        if (versionLabel) body.append("versionLabel", versionLabel);
        const response = await authFetch(`/documents/${existing.id}/versions`, {
          method: "POST",
          headers: {},
          body: body as unknown as BodyInit
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message ?? "Upload failed.");
        }
      } else {
        if (!context) return;
        body.append("linkedEntityType", context.type);
        body.append("linkedEntityId", context.id);
        body.append("title", title || file.name);
        body.append("category", category);
        body.append("fileName", file.name);
        if (description) body.append("description", description);
        const response = await authFetch("/documents", {
          method: "POST",
          headers: {},
          body: body as unknown as BodyInit
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message ?? "Upload failed.");
        }
      }
      onUploaded();
    } catch (err) {
      const message = (err as Error).message;
      setLocalError(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Upload document" onClick={onClose}>
      <div ref={panelRef} className="slide-over" onClick={(event) => event.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>
              {existing ? `New version · ${existing.title}` : "Upload document"}
            </h2>
            <p className="slide-over__subtitle">
              {existing
                ? `Current version: ${existing.versionLabel ?? `v${existing.versionNumber}`}`
                : context
                ? `Target: ${context.type} · ${context.id}`
                : "Pick a context first"}
            </p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <form onSubmit={submit} className="slide-over__body tender-form">
          {error ? <div className="login-card__error" role="alert">{error}</div> : null}

          <label className="tender-form__field">
            <span className="s7-type-label">File</span>
            <input
              type="file"
              accept={ACCEPT}
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                setFile(picked);
                if (picked && !existing && !title) setTitle(picked.name);
              }}
            />
            {file ? <span className="form-submit__photo-name">{file.name} · {formatSize(file.size)}</span> : null}
          </label>

          {!existing ? (
            <>
              <label className="tender-form__field">
                <span className="s7-type-label">Title</span>
                <input className="s7-input" value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Category</span>
                <input className="s7-input" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="General" />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Description</span>
                <textarea className="s7-textarea" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
            </>
          ) : (
            <label className="tender-form__field">
              <span className="s7-type-label">Version label (optional)</span>
              <input className="s7-input" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder={`v${existing.versionNumber + 1}`} />
            </label>
          )}

          <footer className="slide-over__footer">
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting || !file}>
              {submitting ? "Uploading…" : existing ? "Upload new version" : "Upload"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
