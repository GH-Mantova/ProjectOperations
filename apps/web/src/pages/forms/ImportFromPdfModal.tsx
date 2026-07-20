import { useRef, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type Props = {
  onClose: () => void;
  /** Called with the id of the newly-created DRAFT template so the caller can navigate to the designer. */
  onCreated: (templateId: string) => void;
};

/**
 * "Import from PDF" modal on the Forms list.
 *
 * Posts a single-file `multipart/form-data` upload to
 * `POST /forms/templates/build-from-pdf`. The API converts the PDF into
 * a DRAFT `FormTemplate` via the AI provider the caller has configured
 * (BYOK — same key store as the assist panel) and returns the new template
 * id, which we hand back so the caller can route to the designer for
 * review + publish. Nothing is published automatically.
 */
export function ImportFromPdfModal({ onClose, onCreated }: Props) {
  const { authFetch } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onPick = (picked: File | null) => {
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
      setError("Select a PDF file.");
      setFile(null);
      return;
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError("PDF is larger than 10 MB. Split it into smaller sections or export at a lower quality.");
      setFile(null);
      return;
    }
    setFile(picked);
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
      title="Import form from PDF"
      onClose={busy ? () => undefined : onClose}
      maxWidth={480}
      footer={
        <>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D" }}
            onClick={() => void submit()}
            disabled={!file || busy}
          >
            {busy ? "Building draft…" : "Import"}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, color: "var(--text-muted, #6B7280)" }}>
          Upload a paper inspection sheet, checklist, or safety form and we&rsquo;ll draft a form
          template you can review before publishing. Uses your configured AI provider (BYOK). The
          draft never publishes automatically.
        </p>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="s7-btn s7-btn--secondary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {file ? "Choose different PDF…" : "Choose PDF…"}
          </button>
          {file ? (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <strong>{file.name}</strong>{" "}
              <span style={{ color: "var(--text-muted, #6B7280)" }}>
                ({(file.size / 1024).toFixed(0)} KB)
              </span>
            </div>
          ) : null}
        </div>

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

        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted, #9CA3AF)" }}>
          Scanned PDFs without a text layer can&rsquo;t be imported directly &mdash; run them
          through OCR first.
        </p>
      </div>
    </CenteredModal>
  );
}
