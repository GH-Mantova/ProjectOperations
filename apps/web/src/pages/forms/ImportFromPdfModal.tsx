import { useRef, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ACCEPTED_MIMETYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

type Props = {
  onClose: () => void;
  /** Called with the id of the newly-created DRAFT template so the caller can navigate to the designer. */
  onCreated: (templateId: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sourceLabel(mimetype: string): string {
  if (mimetype === "application/pdf") return "PDF";
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "Word";
  return mimetype;
}

/**
 * "Import from document" modal on the Forms list.
 *
 * State 1: drop zone with PDF / Word source tiles and a staged file row.
 * State 2 (S2, chained): six-step progress list after upload. Not shipped here.
 *
 * Posts a single-file `multipart/form-data` upload to
 * `POST /forms/templates/build-from-pdf`. The API converts the document into
 * a DRAFT `FormTemplate` via the AI provider the caller has configured
 * (BYOK -- same key store as the assist panel) and returns the new template
 * id, which we hand back so the caller can route to the designer for
 * review + publish. Nothing is published automatically.
 *
 * Note: the route name `build-from-pdf` is intentionally preserved for
 * backwards compatibility (see controller comment). Word documents are
 * accepted by the same endpoint.
 */
export function ImportFromPdfModal({ onClose, onCreated }: Props) {
  const { authFetch } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pickFile = (picked: File | null) => {
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    const nameLower = picked.name.toLowerCase();
    const extOk = ACCEPTED_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
    const typeOk = ACCEPTED_MIMETYPES.includes(picked.type);
    if (!typeOk && !extOk) {
      setError("Select a PDF or Word (.docx) file.");
      setFile(null);
      return;
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError("File is larger than 10 MB. Split it into smaller sections or export at a lower quality.");
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0] ?? null;
    pickFile(dropped);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch("/forms/templates/build-from-pdf", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Import failed (${res.status})`);
      }
      const created = (await res.json()) as { id: string };
      onCreated(created.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CenteredModal
      title="Import form from document"
      onClose={busy ? () => undefined : onClose}
      maxWidth={520}
      footer={
        <>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "var(--brand-accent)", color: "#242424", borderColor: "var(--brand-accent)" }}
            onClick={() => void submit()}
            disabled={!file || busy}
          >
            {busy ? "Building draft..." : "Import"}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Upload a paper inspection sheet, checklist, or safety form and we&rsquo;ll draft a form
          template you can review before publishing. Uses your configured AI provider (BYOK). The
          draft never publishes automatically.
        </p>

        {/* Source tiles */}
        <div style={{ display: "flex", gap: 8 }}>
          {/* PDF tile */}
          <div
            style={{
              flex: 1,
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-card)"
            }}
          >
            <span style={{ fontSize: 20 }}>&#x1F4C4;</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>PDF</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>.pdf</div>
            </div>
          </div>

          {/* Word tile */}
          <div
            style={{
              flex: 1,
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-card)"
            }}
          >
            <span style={{ fontSize: 20 }}>&#x1F4DD;</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>Word</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>.docx</div>
            </div>
          </div>

          {/* Cognito tile -- disabled, API only */}
          <div
            style={{
              flex: 1,
              border: "1px dashed var(--border-default)",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-subtle)",
              opacity: 0.6
            }}
            title="Cognito Forms integration is available via the API only"
          >
            <span style={{ fontSize: 20 }}>&#x1F517;</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-secondary)" }}>Cognito</div>
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>API only</div>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a PDF or Word document here, or click to choose a file"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          style={{
            border: `2px dashed ${dragging ? "var(--brand-accent)" : "var(--border-default)"}`,
            borderRadius: 8,
            padding: "20px 16px",
            textAlign: "center",
            cursor: busy ? "not-allowed" : "pointer",
            background: dragging ? "color-mix(in srgb, var(--brand-accent) 6%, transparent)" : "var(--surface-card)",
            transition: "border-color 0.15s, background 0.15s",
            color: "var(--text-secondary)"
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_MIMETYPES.join(",") + "," + ACCEPTED_EXTENSIONS.join(",")}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
            disabled={busy}
          />
          <div style={{ fontSize: 12 }}>
            {file
              ? "Drop a different file, or click to browse"
              : "Drop a PDF or Word document here, or click to browse"}
          </div>
        </div>

        {/* Staged file row */}
        {file ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: "var(--surface-subtle)",
              borderRadius: 6,
              fontSize: 12
            }}
          >
            <span style={{ fontSize: 16 }}>
              {file.name.toLowerCase().endsWith(".pdf") ? "📄" : "📝"}
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <strong>{file.name}</strong>
            </span>
            <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              {formatBytes(file.size)}
            </span>
            <span
              style={{
                background: "var(--border-default)",
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 11,
                whiteSpace: "nowrap"
              }}
            >
              {sourceLabel(file.type)}
            </span>
            {!busy ? (
              <button
                type="button"
                aria-label="Remove file"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "0 2px",
                  fontSize: 14,
                  lineHeight: 1
                }}
                onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
              >
                &times;
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Busy label */}
        {busy ? (
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Building draft...
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            style={{
              padding: 10,
              background: "#FEE2E2",
              color: "#991B1B",
              borderRadius: 6,
              fontSize: 12
            }}
          >
            {error}
          </div>
        ) : null}

        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
          Scanned PDFs without a text layer can&rsquo;t be imported directly &mdash; run them
          through OCR first.
        </p>
      </div>
    </CenteredModal>
  );
}
