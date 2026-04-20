import { useMemo, useRef, useState, type DragEvent } from "react";
import { useAuth } from "../../auth/AuthContext";

const ACCEPTED = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".dwg", ".png", ".jpg", ".jpeg"];
const MAX_BYTES = 100 * 1024 * 1024;
const DWG_PATTERN = /\.dwg$/i;
const READABLE_PATTERN = /\.(pdf|docx?|xlsx?|png|jpe?g)$/i;

export type DocumentRecord = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  createdAt?: string;
  fileLink?: {
    name: string;
    webUrl: string;
    sizeBytes?: number | null;
    mimeType?: string | null;
  } | null;
};

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isMockSharePoint(webUrl?: string): boolean {
  return !webUrl || webUrl.includes("sharepoint.local");
}

export function TenderDocumentsPanel({
  tenderId,
  documents,
  onDocumentsChanged,
  canManage,
  onDraftRequest,
  drafting,
  draftBadgeState,
  showInlineUploadOnly
}: {
  tenderId: string;
  documents: DocumentRecord[];
  onDocumentsChanged: () => void;
  canManage: boolean;
  onDraftRequest: () => void;
  drafting: boolean;
  draftBadgeState: "none" | "new" | "reviewed";
  showInlineUploadOnly?: boolean;
}) {
  const { authFetch } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const hasReadableDoc = useMemo(
    () =>
      documents.some((d) => {
        const name = d.fileLink?.name ?? d.title;
        return READABLE_PATTERN.test(name);
      }),
    [documents]
  );

  const draftButtonTooltip = documents.length === 0
    ? "Upload at least one document first"
    : !hasReadableDoc
      ? "DWG files cannot be read by Claude — upload a PDF or image of the drawings"
      : null;

  const uploadFile = async (file: File) => {
    if (file.size > MAX_BYTES) throw new Error(`${file.name} exceeds the 100 MB limit.`);
    const form = new FormData();
    form.append("file", file);
    form.append("category", "tender");
    form.append("title", file.name);
    form.append("fileName", file.name);
    form.append("mimeType", file.type || "application/octet-stream");
    const response = await authFetch(`/tenders/${tenderId}/documents`, { method: "POST", body: form });
    if (!response.ok) throw new Error(`${file.name}: ${await response.text()}`);
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!canManage) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of list) await uploadFile(file);
      onDocumentsChanged();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      void handleFiles(event.dataTransfer.files);
    }
  };

  const removeDocument = async (docId: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      const response = await authFetch(`/tenders/${tenderId}/documents/${docId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      onDocumentsChanged();
    } catch (err) {
      setUploadError((err as Error).message);
    }
  };

  const openDocument = (doc: DocumentRecord) => {
    if (isMockSharePoint(doc.fileLink?.webUrl)) {
      setToast(
        "Document preview requires SharePoint connection. Contact your administrator to configure SharePoint."
      );
      window.setTimeout(() => setToast(null), 4500);
      return;
    }
    window.open(doc.fileLink!.webUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="s7-card" aria-label="Tender documents">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Documents</h3>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {documents.length} uploaded
        </span>
      </div>

      {canManage ? (
        <div
          className={`doc-upload-zone${dragOver ? " doc-upload-zone--drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FEAA6D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M17 8l-5-5-5 5" />
            <path d="M12 3v12" />
          </svg>
          <p style={{ margin: 0, fontSize: 14 }}>
            <span style={{ color: "#FEAA6D", fontWeight: 500 }}>Drag &amp; drop files here, or browse</span>
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            PDF, Word, Excel, DWG, PNG, JPG · up to 100 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept={ACCEPTED.join(",")}
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading ? <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Uploading…</p> : null}
        </div>
      ) : null}

      {uploadError ? (
        <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{uploadError}</p>
      ) : null}

      {documents.length > 0 ? (
        <ul className="doc-upload-list">
          {documents.map((doc) => {
            const name = doc.fileLink?.name ?? doc.title;
            const isDwg = DWG_PATTERN.test(name);
            return (
              <li key={doc.id}>
                <div className="doc-upload-list__main">
                  <strong>{name}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatSize(doc.fileLink?.sizeBytes ?? null)}
                    {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString()}` : ""}
                    {isDwg ? " · Preview not available" : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="s7-btn s7-btn--secondary s7-btn--sm"
                  onClick={() => openDocument(doc)}
                >
                  Open
                </button>
                {canManage ? (
                  <button
                    type="button"
                    className="s7-btn s7-btn--danger s7-btn--sm"
                    onClick={() => void removeDocument(doc.id, name)}
                    aria-label={`Delete ${name}`}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {showInlineUploadOnly ? null : (
        <div className="draft-scope-panel">
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>✨ Draft scope with Claude</div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Claude reads the uploaded docs and proposes SO/Str/Asb/Civ/Prv items with descriptions &amp; quantities.
            </p>
          </div>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => onDraftRequest()}
            disabled={!!draftButtonTooltip || drafting || !canManage}
            title={draftButtonTooltip ?? undefined}
          >
            {drafting
              ? "Claude is reading…"
              : draftBadgeState === "new"
                ? "View drafted scope →"
                : draftBadgeState === "reviewed"
                  ? "Re-draft scope →"
                  : "Draft scope →"}
          </button>
        </div>
      )}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: "#242424",
            color: "#FFFFFF",
            padding: "10px 16px",
            borderRadius: 8,
            maxWidth: 360,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            fontSize: 13
          }}
        >
          {toast}
        </div>
      ) : null}
    </section>
  );
}
