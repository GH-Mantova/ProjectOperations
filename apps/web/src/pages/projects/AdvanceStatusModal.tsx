import { FormEvent, useMemo, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "../../constants/statuses";

type ProjectLite = {
  id: string;
  projectNumber: string;
  status: string;
  actualStartDate: string | null;
  practicalCompletionDate: string | null;
  closedDate: string | null;
};

type Props = {
  project: ProjectLite;
  onClose: () => void;
  onSaved: () => void;
};

const NEXT_STATUS: Record<ProjectStatus, ProjectStatus | null> = {
  MOBILISING: "ACTIVE",
  ACTIVE: "PRACTICAL_COMPLETION",
  PRACTICAL_COMPLETION: "DEFECTS",
  DEFECTS: "CLOSED",
  CLOSED: null
};

const STATUS_LABEL = PROJECT_STATUS_LABELS;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdvanceStatusModal({ project, onClose, onSaved }: Props) {
  const { authFetch } = useAuth();
  const current = project.status as ProjectStatus;
  const next = NEXT_STATUS[current];

  const [actualStartDate, setActualStartDate] = useState<string>(todayIso());
  const [practicalCompletionDate, setPracticalCompletionDate] = useState<string>(todayIso());
  const [closedDate, setClosedDate] = useState<string>(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredField = useMemo<"actualStartDate" | "practicalCompletionDate" | "closedDate" | null>(() => {
    if (current === "MOBILISING" && next === "ACTIVE") return "actualStartDate";
    if (current === "ACTIVE" && next === "PRACTICAL_COMPLETION") return "practicalCompletionDate";
    if (current === "DEFECTS" && next === "CLOSED") return "closedDate";
    return null;
  }, [current, next]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!next) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = { status: next };
      if (requiredField === "actualStartDate") body.actualStartDate = actualStartDate;
      if (requiredField === "practicalCompletionDate") body.practicalCompletionDate = practicalCompletionDate;
      if (requiredField === "closedDate") body.closedDate = closedDate;

      const response = await authFetch(`/projects/${project.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed (${response.status})`);
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const subtitle = `${project.projectNumber} is currently ${STATUS_LABEL[current] ?? current}.`;

  return (
    <CenteredModal
      title="Advance status"
      subtitle={subtitle}
      onClose={onClose}
      busy={submitting}
      maxWidth={480}
    >
      {!next ? (
        <p style={{ color: "var(--text-muted)" }}>
          This project is closed. No further transitions are available.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p style={{ marginTop: 0 }}>
            Move status to <strong>{STATUS_LABEL[next]}</strong>?
          </p>

          {requiredField === "actualStartDate" ? (
            <label style={{ display: "block", marginBottom: 12 }}>
              <span className="s7-type-label">Actual start date</span>
              <input
                type="date"
                className="s7-input"
                value={actualStartDate}
                onChange={(e) => setActualStartDate(e.target.value)}
                required
                style={{ marginTop: 4, width: "100%" }}
              />
            </label>
          ) : null}

          {requiredField === "practicalCompletionDate" ? (
            <label style={{ display: "block", marginBottom: 12 }}>
              <span className="s7-type-label">Practical completion date</span>
              <input
                type="date"
                className="s7-input"
                value={practicalCompletionDate}
                onChange={(e) => setPracticalCompletionDate(e.target.value)}
                required
                style={{ marginTop: 4, width: "100%" }}
              />
            </label>
          ) : null}

          {requiredField === "closedDate" ? (
            <label style={{ display: "block", marginBottom: 12 }}>
              <span className="s7-type-label">Closed date</span>
              <input
                type="date"
                className="s7-input"
                value={closedDate}
                onChange={(e) => setClosedDate(e.target.value)}
                required
                style={{ marginTop: 4, width: "100%" }}
              />
            </label>
          ) : null}

          {error ? (
            <div
              role="alert"
              style={{
                background: "#FCEBEB",
                color: "#A32D2D",
                padding: "8px 12px",
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 13
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="s7-button s7-button--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="s7-button s7-button--primary" disabled={submitting}>
              {submitting ? "Saving…" : `Move to ${STATUS_LABEL[next]}`}
            </button>
          </div>
        </form>
      )}
    </CenteredModal>
  );
}
