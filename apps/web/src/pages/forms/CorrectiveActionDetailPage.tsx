import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type CorrectiveAction = {
  id: string;
  title: string;
  description?: string | null;
  status: "open" | "in_progress" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  sourceFieldKey?: string | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null;
  assignedToRole?: string | null;
  dueAt?: string | null;
  closedAt?: string | null;
  closedBy?: { id: string; firstName: string; lastName: string } | null;
  closeOutNote?: string | null;
  evidencePath?: string | null;
  submission?: {
    id: string;
    submittedAt?: string | null;
    templateVersion: { template: { id: string; name: string; code: string } };
  } | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed"
};

const STATUS_BG: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#FEF3C7", fg: "#92400E" },
  in_progress: { bg: "color-mix(in srgb, #3B82F6 18%, transparent)", fg: "#1D4ED8" },
  closed: { bg: "#DCFCE7", fg: "#166534" }
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "#6B7280",
  medium: "#D97706",
  high: "#DC2626",
  critical: "#7C3AED"
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function CorrectiveActionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [action, setAction] = useState<CorrectiveAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [evidencePath, setEvidencePath] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await authFetch(`/forms/corrective-actions/${id}`);
      if (!res.ok) throw new Error(await res.text());
      setAction((await res.json()) as CorrectiveAction);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = user?.isSuperUser || user?.permissions?.includes("forms.manage");

  const advanceStatus = async () => {
    if (!action || !canManage) return;
    const next = action.status === "open" ? "in_progress" : null;
    if (!next) return;
    setStatusBusy(true);
    try {
      const res = await authFetch(`/forms/corrective-actions/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStatusBusy(false);
    }
  };

  const closeOut = async () => {
    if (!action || !canManage) return;
    if (!closeNote.trim()) {
      setError("A close-out note is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/forms/corrective-actions/${action.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closeOutNote: closeNote.trim(), evidencePath: evidencePath.trim() || undefined })
      });
      if (!res.ok) throw new Error(await res.text());
      setShowCloseModal(false);
      setCloseNote("");
      setEvidencePath("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !action) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "var(--status-danger)" }}>{error}</p>
        <Link to="/forms/corrective-actions" className="s7-btn s7-btn--ghost">
          Back to register
        </Link>
      </div>
    );
  }
  if (!action) {
    return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</div>;
  }

  const statusStyle = STATUS_BG[action.status] ?? STATUS_BG.open;
  const overdue = action.status !== "closed" && action.dueAt && new Date(action.dueAt) < new Date();

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <Link to="/forms/corrective-actions" className="s7-btn s7-btn--ghost s7-btn--sm" style={{ alignSelf: "flex-start" }}>
        Back to register
      </Link>

      {/* Status banner */}
      <div
        style={{
          background: statusStyle.bg,
          color: statusStyle.fg,
          padding: 14,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <strong>{STATUS_LABEL[action.status] ?? action.status}</strong>
        {overdue ? (
          <span style={{ marginLeft: 8, fontWeight: 700, color: "var(--status-danger, #DC2626)" }}>OVERDUE</span>
        ) : null}
      </div>

      {error ? <div style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</div> : null}

      {/* Main card */}
      <section className="s7-card" style={{ padding: 16 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 20 }}>{action.title}</h1>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          ID: {action.id.slice(0, 8)}… · Created: {fmt(action.createdAt)}
        </div>
        {action.description ? (
          <p style={{ marginTop: 12, fontSize: 14, whiteSpace: "pre-wrap" }}>{action.description}</p>
        ) : null}

        <dl style={{ display: "grid", gridTemplateColumns: "minmax(140px, 180px) 1fr", gap: "8px 12px", marginTop: 14, fontSize: 13 }}>
          <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Priority</dt>
          <dd style={{ margin: 0, fontWeight: 600, color: PRIORITY_COLOR[action.priority] ?? "#6B7280", textTransform: "capitalize" }}>
            {action.priority}
          </dd>

          <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Assigned to</dt>
          <dd style={{ margin: 0 }}>
            {action.assignedTo
              ? `${action.assignedTo.firstName} ${action.assignedTo.lastName}`
              : action.assignedToRole
                ? action.assignedToRole
                : "Unassigned"}
          </dd>

          <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Due date</dt>
          <dd style={{ margin: 0, color: overdue ? "var(--status-danger, #DC2626)" : undefined }}>
            {fmtDate(action.dueAt)}
          </dd>

          {action.sourceFieldKey ? (
            <>
              <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Source field</dt>
              <dd style={{ margin: 0, fontFamily: "monospace", fontSize: 12 }}>{action.sourceFieldKey}</dd>
            </>
          ) : null}

          {action.submission ? (
            <>
              <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>From submission</dt>
              <dd style={{ margin: 0 }}>
                <Link to={`/forms/submissions/${action.submission.id}`} style={{ color: "var(--color-teal, #005B61)" }}>
                  {action.submission.templateVersion.template.name}
                </Link>
                {action.submission.submittedAt ? ` · ${fmt(action.submission.submittedAt)}` : ""}
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      {/* Close-out details (only when closed) */}
      {action.status === "closed" && (action.closeOutNote || action.closedAt) ? (
        <section className="s7-card" style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#166534" }}>Close-out record</h3>
          <dl style={{ display: "grid", gridTemplateColumns: "minmax(140px, 180px) 1fr", gap: "8px 12px", fontSize: 13 }}>
            <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Closed at</dt>
            <dd style={{ margin: 0 }}>{fmt(action.closedAt)}</dd>

            <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Closed by</dt>
            <dd style={{ margin: 0 }}>
              {action.closedBy
                ? `${action.closedBy.firstName} ${action.closedBy.lastName}`
                : "—"}
            </dd>

            {action.closeOutNote ? (
              <>
                <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Note</dt>
                <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{action.closeOutNote}</dd>
              </>
            ) : null}

            {action.evidencePath ? (
              <>
                <dt style={{ color: "var(--text-muted)", fontSize: 12, textTransform: "uppercase" }}>Evidence</dt>
                <dd style={{ margin: 0 }}>
                  <a href={action.evidencePath} target="_blank" rel="noreferrer" style={{ color: "var(--color-teal, #005B61)" }}>
                    View evidence
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}

      {/* Action bar */}
      {canManage && action.status !== "closed" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {action.status === "open" ? (
            <button
              type="button"
              className="s7-btn s7-btn--secondary"
              disabled={statusBusy}
              onClick={() => void advanceStatus()}
            >
              Mark In Progress
            </button>
          ) : null}
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "#16A34A", color: "#fff", borderColor: "#16A34A" }}
            onClick={() => {
              setCloseNote("");
              setEvidencePath("");
              setShowCloseModal(true);
            }}
          >
            Close Out
          </button>
        </div>
      ) : null}

      {/* Close-out modal */}
      {showCloseModal ? (
        <CenteredModal
          title="Close out corrective action"
          onClose={() => setShowCloseModal(false)}
          busy={busy}
          maxWidth={480}
          footer={
            <>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setShowCloseModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                style={{ background: "#16A34A", color: "#fff", borderColor: "#16A34A" }}
                disabled={busy}
                onClick={() => void closeOut()}
              >
                Confirm Close
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Close-out note <span style={{ color: "var(--status-danger, #DC2626)" }}>*</span>
              </label>
              <textarea
                className="s7-textarea"
                rows={4}
                placeholder="Describe what was done to resolve this action…"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Evidence URL / path (optional)
              </label>
              <input
                type="text"
                className="s7-input"
                placeholder="https://… or file path"
                value={evidencePath}
                onChange={(e) => setEvidencePath(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            {error ? <div style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</div> : null}
          </div>
        </CenteredModal>
      ) : null}
    </div>
  );
}
