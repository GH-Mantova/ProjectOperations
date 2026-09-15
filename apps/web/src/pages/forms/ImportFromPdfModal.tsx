import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  /**
   * @deprecated FV2-S2: the modal now navigates to /forms/import/:jobId
   * directly. This prop is accepted for backwards compatibility but is no
   * longer called. Callers should remove it when convenient.
   */
  onCreated?: (templateId: string) => void;
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

// Six steps shown during state 2 (extraction in progress).
// Steps 1-3 and 5-6 are countable; step 4 (the model call) is indeterminate.
const STEPS = [
  { label: "Receiving document", indeterminate: false },
  { label: "Reading pages", indeterminate: false },
  { label: "Extracting text", indeterminate: false },
  { label: "Asking AI to propose fields", indeterminate: true },
  { label: "Validating proposal", indeterminate: false },
  { label: "Preparing review", indeterminate: false }
];

/**
 * "Import from document" modal on the Forms list.
 *
 * State 1: drop zone with PDF / Word source tiles and a staged file row.
 * State 2: six-step progress list shown while preview-import runs.
 *          Steps 1-3 and 5-6 are shown as ticked; step 4 (model call)
 *          is rendered as an indeterminate shimmer inside the list.
 *
 * On success, navigates to /forms/import/:jobId for review.
 * The old `build-from-pdf` route is NOT used here; the modal now calls
 * `POST /forms/templates/preview-import`.
 *
 * Note: `onCreated` prop has been removed -- the modal navigates directly.
 * Callers that mounted this modal with onCreated should remove that prop.
 */
export function ImportFromPdfModal({ onClose, onCreated: _onCreated }: Props) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  // How many non-indeterminate steps have been visually "ticked"
  // (deterministic steps 1-3 complete before the AI call, 5-6 after).
  const [stepsDone, setStepsDone] = useState(0);

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
    setStepsDone(0);
    setError(null);
    try {
      // Steps 1-3: tick as we prepare the upload (synchronous / fast)
      setStepsDone(1);
      const formData = new FormData();
      setStepsDone(2);
      formData.append("file", file);
      setStepsDone(3);

      // Step 4 is the AI call -- the server drives this, we just wait.
      // The shimmer renders for step 4 while the request is in-flight.
      const res = await authFetch("/forms/templates/preview-import", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Import failed (${res.status})`);
      }

      const created = (await res.json()) as { jobId: string };

      // Steps 5-6: complete after the server responds
      setStepsDone(5);
      setStepsDone(6);

      navigate(`/forms/import/${created.jobId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      setStepsDone(0);
    }
  };

  // ── State 2: progress list ──────────────────────────────────────────────

  if (busy) {
    return (
      <CenteredModal
        title="Extracting document"
        onClose={() => undefined}
        maxWidth={440}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12 }}>
            This may take 15-30 seconds depending on document size.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {STEPS.map((step, idx) => {
              const done = stepsDone > idx;
              const isActive = !done && (
                // indeterminate step: active while we're waiting for AI
                step.indeterminate ? stepsDone === 3 : false
              );

              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: done || isActive || stepsDone === idx ? 1 : 0.4
                  }}
                >
                  {/* Status icon */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background: done
                        ? "var(--status-active, #16a34a)"
                        : step.indeterminate && stepsDone === 3
                          ? "transparent"
                          : "var(--border-default)",
                      border: step.indeterminate && stepsDone === 3
                        ? "2px solid var(--border-default)"
                        : "none"
                    }}
                  >
                    {done ? (
                      <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>&#x2713;</span>
                    ) : step.indeterminate && stepsDone === 3 ? (
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: "var(--brand-accent, #2563eb)",
                          animation: "pulse 1.2s ease-in-out infinite"
                        }}
                      />
                    ) : null}
                  </div>

                  {/* Step label */}
                  <span
                    style={{
                      color: done ? "var(--text-primary)" : step.indeterminate && stepsDone === 3 ? "var(--brand-accent, #2563eb)" : "var(--text-secondary)",
                      flex: 1
                    }}
                  >
                    {step.label}
                  </span>

                  {/* Indeterminate shimmer for step 4 */}
                  {step.indeterminate && stepsDone === 3 ? (
                    <div
                      style={{
                        width: 60,
                        height: 4,
                        borderRadius: 2,
                        overflow: "hidden",
                        background: "var(--border-default)"
                      }}
                    >
                      <div
                        style={{
                          width: "40%",
                          height: "100%",
                          background: "var(--brand-accent, #2563eb)",
                          borderRadius: 2,
                          animation: "slide 1.4s ease-in-out infinite"
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
            @keyframes slide {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(150%); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
        </div>
      </CenteredModal>
    );
  }

  // ── State 1: file picker ──────────────────────────────────────────────

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
            {busy ? "Extracting..." : "Extract"}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Upload a paper inspection sheet, checklist, or safety form and we&rsquo;ll extract the
          fields for your review before creating a draft. Uses your configured AI provider (BYOK).
          The draft never publishes automatically.
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
              {file.name.toLowerCase().endsWith(".pdf") ? "&#x1F4C4;" : "&#x1F4DD;"}
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
