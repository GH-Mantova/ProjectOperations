import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

// Case management slice 1 — detail page.
// Shows full case details, status transitions, comments thread, and assignment.

type UserSummary = { id: string; firstName: string; lastName: string };

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: UserSummary;
};

type CaseDetail = {
  id: string;
  number: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  raisedBy: UserSummary;
  assignedTo: UserSummary | null;
  client: { id: string; name: string } | null;
  job: { id: string; jobNumber: string; name: string } | null;
  project: { id: string; projectNumber: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
};

const TYPE_LABEL: Record<string, string> = {
  defect: "Defect",
  warranty: "Warranty",
  rfi: "RFI",
  complaint: "Complaint",
  other: "Other"
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed"
};

const PRIORITY_COLOUR: Record<string, string> = {
  low: "#16a34a",
  medium: "#eab308",
  high: "#f97316",
  urgent: "#dc2626"
};

// Valid next statuses per current status (mirrors server-side transitions)
const NEXT_STATUSES: Record<string, string[]> = {
  open: ["in_progress", "waiting", "closed"],
  in_progress: ["waiting", "resolved", "closed"],
  waiting: ["open", "in_progress", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: []
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comment state
  const [commentBody, setCommentBody] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Status transition
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const commentRef = useRef<HTMLTextAreaElement>(null);

  const loadCase = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/cases/${id}`);
      if (res.status === 404) {
        setError("Case not found. It may have been deleted.");
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to load case: ${msg}`);
      }
      setCaseData((await res.json()) as CaseDetail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  async function handleStatusTransition(newStatus: string) {
    if (!id || !caseData) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const res = await authFetch(`/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg);
      }
      const updated = (await res.json()) as CaseDetail;
      setCaseData((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setTransitionError((err as Error).message);
    } finally {
      setTransitioning(false);
    }
  }

  async function handleAddComment() {
    if (!id || !commentBody.trim()) return;
    setSubmittingComment(true);
    setCommentError(null);
    try {
      const res = await authFetch(`/cases/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() })
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg);
      }
      const comment = (await res.json()) as Comment;
      setCommentBody("");
      setCaseData((prev) =>
        prev ? { ...prev, comments: [...prev.comments, comment] } : prev
      );
    } catch (err) {
      setCommentError((err as Error).message);
    } finally {
      setSubmittingComment(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, color: "var(--text-muted, #666)" }}>Loading case...</div>
    );
  }

  if (error || !caseData) {
    return (
      <div style={{ padding: 32 }}>
        <button
          onClick={() => navigate("/cases")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-orange, #FEAA6D)", marginBottom: 16 }}
        >
          &larr; Back to Cases
        </button>
        <div role="alert" style={{ color: "#dc2626", padding: 16, background: "#fef2f2", borderRadius: 6 }}>
          {error ?? "Case not found."}
        </div>
      </div>
    );
  }

  const nextStatuses = NEXT_STATUSES[caseData.status] ?? [];

  return (
    <div style={{ padding: "24px 32px", maxWidth: 860 }}>
      {/* Back nav */}
      <button
        onClick={() => navigate("/cases")}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-orange, #FEAA6D)", marginBottom: 16, padding: 0 }}
      >
        &larr; Back to Cases
      </button>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: "var(--text-muted, #555)", fontSize: 14 }}>{caseData.number}</span>
          <span style={{ background: "#f3f4f6", borderRadius: 4, padding: "2px 8px", fontSize: 13 }}>
            {TYPE_LABEL[caseData.type] ?? caseData.type}
          </span>
          <span
            style={{
              background: "#e0f2fe",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {STATUS_LABEL[caseData.status] ?? caseData.status}
          </span>
          <span
            style={{
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: PRIORITY_COLOUR[caseData.priority] ?? "#999"
            }}
          >
            {caseData.priority.charAt(0).toUpperCase() + caseData.priority.slice(1)}
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 22, margin: "0 0 6px" }}>
          {caseData.title}
        </h1>
        {caseData.description && (
          <p style={{ margin: 0, color: "var(--text-muted, #555)", lineHeight: 1.5 }}>{caseData.description}</p>
        )}
      </div>

      {/* Meta grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
          padding: 16,
          background: "#f9fafb",
          borderRadius: 6,
          marginBottom: 20,
          fontSize: 13
        }}
      >
        <div><span style={{ color: "var(--text-muted, #888)" }}>Raised by</span><br />{caseData.raisedBy.firstName} {caseData.raisedBy.lastName}</div>
        <div>
          <span style={{ color: "var(--text-muted, #888)" }}>Assigned to</span><br />
          {caseData.assignedTo
            ? `${caseData.assignedTo.firstName} ${caseData.assignedTo.lastName}`
            : <span style={{ color: "var(--text-muted, #bbb)" }}>Unassigned</span>}
        </div>
        {caseData.client && <div><span style={{ color: "var(--text-muted, #888)" }}>Client</span><br />{caseData.client.name}</div>}
        {caseData.job && <div><span style={{ color: "var(--text-muted, #888)" }}>Job</span><br />{caseData.job.jobNumber} — {caseData.job.name}</div>}
        {caseData.project && <div><span style={{ color: "var(--text-muted, #888)" }}>Project</span><br />{caseData.project.projectNumber} — {caseData.project.name}</div>}
        {caseData.dueAt && <div><span style={{ color: "var(--text-muted, #888)" }}>SLA Due</span><br />{fmtDateShort(caseData.dueAt)}</div>}
        {caseData.resolvedAt && <div><span style={{ color: "var(--text-muted, #888)" }}>Resolved</span><br />{fmtDateShort(caseData.resolvedAt)}</div>}
        <div><span style={{ color: "var(--text-muted, #888)" }}>Created</span><br />{fmtDateShort(caseData.createdAt)}</div>
      </div>

      {/* Resolution notes */}
      {caseData.resolution && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#16a34a" }}>Resolution</div>
          <p style={{ margin: 0 }}>{caseData.resolution}</p>
        </div>
      )}

      {/* Status transitions */}
      {nextStatuses.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Move to:</div>
          {transitionError && (
            <div role="alert" style={{ color: "#dc2626", marginBottom: 8, fontSize: 13 }}>{transitionError}</div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => void handleStatusTransition(s)}
                disabled={transitioning}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  minHeight: 40,
                  opacity: transitioning ? 0.6 : 1
                }}
              >
                {STATUS_LABEL[s] ?? s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Comments thread */}
      <div>
        <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 16, marginBottom: 16 }}>
          Comments ({caseData.comments.length})
        </h2>

        {caseData.comments.length === 0 && (
          <p style={{ color: "var(--text-muted, #888)", fontSize: 13 }}>No comments yet.</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {caseData.comments.map((c) => (
            <div
              key={c.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 14
              }}
            >
              <div style={{ fontSize: 13, color: "var(--text-muted, #666)", marginBottom: 6 }}>
                <strong>{c.author.firstName} {c.author.lastName}</strong> &bull; {fmtDate(c.createdAt)}
              </div>
              <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</p>
            </div>
          ))}
        </div>

        {/* Add comment */}
        <div style={{ background: "#f9fafb", borderRadius: 6, padding: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
            Add a comment
          </label>
          {commentError && (
            <div role="alert" style={{ color: "#dc2626", marginBottom: 8, fontSize: 13 }}>{commentError}</div>
          )}
          <textarea
            ref={commentRef}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Type your comment..."
            rows={3}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 4,
              border: "1px solid #d1d5db",
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: "inherit"
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button
              onClick={() => void handleAddComment()}
              disabled={submittingComment || !commentBody.trim()}
              style={{
                padding: "10px 20px",
                borderRadius: 6,
                border: "none",
                background: "var(--color-orange, #FEAA6D)",
                cursor: "pointer",
                fontWeight: 600,
                minHeight: 44,
                opacity: submittingComment || !commentBody.trim() ? 0.5 : 1
              }}
            >
              {submittingComment ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
