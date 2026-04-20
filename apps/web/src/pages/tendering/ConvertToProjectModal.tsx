import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type TenderSummary = {
  id: string;
  tenderNumber: string;
  title: string;
  estimatedValue?: string | null;
  proposedStartDate?: string | null;
  tenderClients: Array<{ client: { id: string; name: string }; isAwarded: boolean }>;
};

type Props = {
  tender: TenderSummary;
  onClose: () => void;
  onConverted: (result: { projectId: string; projectNumber: string }) => void;
};

type ConvertResponse = {
  id: string;
  projectNumber: string;
};

type ConflictResponse = {
  message?: string;
  existingProjectId?: string;
  existingProjectNumber?: string;
};

export function ConvertToProjectModal({ tender, onClose, onConverted }: Props) {
  const { authFetch } = useAuth();
  const [nextNumber, setNextNumber] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch(`/projects/next-number`);
        if (!response.ok) throw new Error(await response.text());
        const body = (await response.json()) as { nextNumber: string };
        if (!cancelled) setNextNumber(body.nextNumber);
      } catch (err) {
        if (!cancelled) setPreviewError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const awardedClient = tender.tenderClients.find((c) => c.isAwarded)?.client ?? null;

  async function handleConvert() {
    setSubmitting(true);
    setError(null);
    setExisting(null);
    try {
      const response = await authFetch(`/tenders/${tender.id}/convert`, { method: "POST" });
      if (response.status === 409) {
        const body = (await response.json().catch(() => ({}))) as ConflictResponse;
        if (body.existingProjectId && body.existingProjectNumber) {
          setExisting({ id: body.existingProjectId, number: body.existingProjectNumber });
        }
        setError(body.message ?? "This tender has already been converted.");
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }
      const body = (await response.json()) as ConvertResponse;
      onConverted({ projectId: body.id, projectNumber: body.projectNumber });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-project-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 100
      }}
      onClick={onClose}
    >
      <div
        className="s7-card"
        style={{ width: "min(520px, 92vw)", padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="convert-project-title" className="s7-type-section-title" style={{ margin: 0 }}>
          Convert to project
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "6px 0 16px" }}>
          Allocate the next project number and snapshot the estimate, scope, and documents.
        </p>

        <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px 16px", margin: 0 }}>
          <dt style={{ color: "var(--text-muted)" }}>Source tender</dt>
          <dd style={{ margin: 0 }}>
            {tender.tenderNumber} — {tender.title}
          </dd>

          <dt style={{ color: "var(--text-muted)" }}>Awarded client</dt>
          <dd style={{ margin: 0 }}>{awardedClient ? awardedClient.name : <em>None flagged</em>}</dd>

          <dt style={{ color: "var(--text-muted)" }}>Next project #</dt>
          <dd style={{ margin: 0 }}>
            {previewError ? (
              <span style={{ color: "#A32D2D" }}>{previewError}</span>
            ) : nextNumber ? (
              <strong>{nextNumber}</strong>
            ) : (
              <span style={{ color: "var(--text-muted)" }}>Loading…</span>
            )}
          </dd>
        </dl>

        <ul style={{ marginTop: 16, paddingLeft: 20, color: "var(--text-muted)", fontSize: 13 }}>
          <li>Estimate (rates, scope items, line items) is deep-copied into a frozen snapshot.</li>
          <li>Tender documents are re-linked to the new project.</li>
          <li>The project manager (if set) is notified.</li>
        </ul>

        {error ? (
          <div
            role="alert"
            style={{
              background: "#FCEBEB",
              color: "#A32D2D",
              padding: "10px 12px",
              borderRadius: 6,
              marginTop: 12,
              fontSize: 13
            }}
          >
            <p style={{ margin: 0 }}>{error}</p>
            {existing ? (
              <p style={{ margin: "6px 0 0" }}>
                <a href={`/projects/${existing.id}`} style={{ color: "#A32D2D", textDecoration: "underline" }}>
                  Open {existing.number}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void handleConvert()}
            disabled={submitting || !!existing}
          >
            {submitting ? "Converting…" : "Convert to project"}
          </button>
        </div>
      </div>
    </div>
  );
}
