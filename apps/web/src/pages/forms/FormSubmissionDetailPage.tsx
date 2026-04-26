import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type Field = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
};

type Section = {
  id: string;
  title: string;
  description?: string | null;
  sectionOrder: number;
  fields: Field[];
};

type Approval = {
  id: string;
  stepNumber: number;
  status: "pending" | "approved" | "rejected" | "skipped";
  comment: string | null;
  decidedAt: string | null;
  dueAt: string | null;
  assignedToId: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
};

type TriggeredRecord = {
  id: string;
  recordType: string;
  recordId: string;
  createdAt: string;
};

type Submission = {
  id: string;
  status: string;
  submittedAt: string | null;
  submittedById: string | null;
  submittedBy?: { id: string; firstName: string; lastName: string } | null;
  context?: Record<string, string | undefined> | null;
  gpsLat: string | number | null;
  gpsLng: string | number | null;
  values: Array<{
    fieldKey: string;
    valueText: string | null;
    valueNumber: string | number | null;
    valueBoolean: boolean | null;
    valueDateTime: string | null;
    valueJson: unknown;
    filePath: string | null;
  }>;
  approvals: Approval[];
  triggeredRecords: TriggeredRecord[];
  templateVersion: {
    id: string;
    versionNumber: number;
    template: { id: string; name: string; category?: string | null };
    sections: Section[];
  };
};

const STATUS_BANNER: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#E2E8F0", fg: "#1F2937", label: "Draft — not yet submitted" },
  submitted: { bg: "color-mix(in srgb, #3B82F6 18%, transparent)", fg: "#1D4ED8", label: "Submitted — awaiting review" },
  under_review: { bg: "color-mix(in srgb, #F59E0B 18%, transparent)", fg: "#B45309", label: "Under review" },
  approved: { bg: "#DCFCE7", fg: "#166534", label: "✓ Approved" },
  rejected: { bg: "#FEE2E2", fg: "#B91C1C", label: "✗ Rejected" }
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

function valueOf(submission: Submission, fieldKey: string): unknown {
  const v = submission.values.find((x) => x.fieldKey === fieldKey);
  if (!v) return undefined;
  if (v.valueText !== null) return v.valueText;
  if (v.valueNumber !== null) return Number(v.valueNumber);
  if (v.valueBoolean !== null) return v.valueBoolean;
  if (v.valueDateTime !== null) return v.valueDateTime;
  if (v.valueJson !== null) return v.valueJson;
  if (v.filePath !== null) return v.filePath;
  return undefined;
}

function renderValue(field: Field, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  switch (field.fieldType) {
    case "toggle":
      return value ? "Yes" : "No";
    case "rating":
      return "★".repeat(Number(value)) + "☆".repeat(Math.max(0, 5 - Number(value)));
    case "date":
      return new Date(String(value)).toLocaleDateString();
    case "datetime":
      return fmt(String(value));
    case "signature":
      return typeof value === "string" && value.startsWith("data:image") ? (
        <img src={value} alt="Signature" style={{ maxHeight: 80, border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: 6 }} />
      ) : (
        <span style={{ color: "var(--text-muted)" }}>(signed)</span>
      );
    case "photo":
    case "file":
      if (Array.isArray(value)) {
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(value as string[]).map((src, i) =>
              src.startsWith("data:image") ? (
                <img key={i} src={src} alt={`Attachment ${i + 1}`} style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 6 }} />
              ) : (
                <a key={i} href={src} target="_blank" rel="noreferrer">Attachment {i + 1}</a>
              )
            )}
          </div>
        );
      }
      return String(value);
    case "address":
      if (typeof value === "object") {
        const v = value as Record<string, string>;
        return [v.street, v.suburb, v.state, v.postcode].filter(Boolean).join(", ");
      }
      return String(value);
    case "multi_select":
    case "checkbox":
      if (Array.isArray(value)) return value.join(", ");
      return String(value);
    default:
      return String(value);
  }
}

export function FormSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openComment, setOpenComment] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await authFetch(`/forms/submissions/${id}`);
      if (!res.ok) throw new Error(await res.text());
      setSubmission((await res.json()) as Submission);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "var(--status-danger)" }}>{error}</p>
        <Link to="/forms" className="s7-btn s7-btn--ghost">← Back to forms</Link>
      </div>
    );
  }
  if (!submission) {
    return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</div>;
  }

  const statusKey = submission.status.toLowerCase();
  const banner = STATUS_BANNER[statusKey] ?? STATUS_BANNER.draft;
  const sections = [...submission.templateVersion.sections].sort((a, b) => a.sectionOrder - b.sectionOrder);
  const ctx = submission.context ?? {};
  const isOwner = submission.submittedById && user?.id === submission.submittedById;
  const nextPending = submission.approvals.find((a) => a.status === "pending");
  const canDecide =
    nextPending &&
    Boolean(user?.permissions?.includes("forms.approve") || user?.isSuperUser) &&
    (!nextPending.assignedToId || nextPending.assignedToId === user?.id);

  const decide = async (mode: "approve" | "reject") => {
    if (!submission) return;
    if (mode === "reject" && comment.trim().length < 1) {
      setError("A comment is required when rejecting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/forms/submissions/${submission.id}/${mode}`, {
        method: "POST",
        body: JSON.stringify({ comment: comment.trim() || undefined })
      });
      if (!res.ok) throw new Error(await res.text());
      setOpenComment(null);
      setComment("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <Link to="/forms" className="s7-btn s7-btn--ghost s7-btn--sm" style={{ alignSelf: "flex-start" }}>
        ← Back to forms
      </Link>

      <div style={{ background: banner.bg, color: banner.fg, padding: 14, borderRadius: 8 }}>
        <strong>{banner.label}</strong>
        {statusKey === "rejected" && submission.approvals.find((a) => a.status === "rejected")?.comment ? (
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {submission.approvals.find((a) => a.status === "rejected")?.comment}
          </div>
        ) : null}
      </div>

      <section className="s7-card" style={{ padding: 14 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{submission.templateVersion.template.name}</h1>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          v{submission.templateVersion.versionNumber} · Reference: {submission.id.slice(0, 8)}…
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginTop: 12, fontSize: 13 }}>
          <Info label="Submitted by" value={submission.submittedBy ? `${submission.submittedBy.firstName} ${submission.submittedBy.lastName}` : "—"} />
          <Info label="Submitted at" value={fmt(submission.submittedAt)} />
          {ctx.jobId ? <Info label="Job" value={String(ctx.jobId)} /> : null}
          {ctx.projectId ? <Info label="Project" value={String(ctx.projectId)} /> : null}
          {submission.gpsLat && submission.gpsLng ? (
            <Info label="GPS" value={`${Number(submission.gpsLat).toFixed(5)}, ${Number(submission.gpsLng).toFixed(5)}`} />
          ) : null}
        </div>
      </section>

      {/* Form values */}
      {sections.map((section) => (
        <section key={section.id} className="s7-card" style={{ padding: 14 }}>
          <h2 style={{ margin: "0 0 8px", color: "#005B61", fontSize: 16, borderBottom: "2px solid #005B61", paddingBottom: 4 }}>
            {section.title}
          </h2>
          {section.description ? (
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 0 }}>{section.description}</p>
          ) : null}
          <dl style={{ display: "grid", gridTemplateColumns: "minmax(160px, 200px) 1fr", gap: "8px 12px", margin: 0 }}>
            {section.fields
              .slice()
              .sort((a, b) => a.fieldOrder - b.fieldOrder)
              .filter((f) => f.fieldType !== "section_header" && f.fieldType !== "divider" && f.fieldType !== "instructions")
              .map((field) => {
                const v = valueOf(submission, field.fieldKey);
                if (v === undefined || v === null || v === "") return null;
                return (
                  <FieldRow key={field.id} field={field} value={v} />
                );
              })}
          </dl>
        </section>
      ))}

      {/* Triggered records */}
      {submission.triggeredRecords.length > 0 ? (
        <section className="s7-card" style={{ padding: 14 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>This submission created</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {submission.triggeredRecords.map((r) => (
              <li key={r.id}>
                <strong>{r.recordType.replace(/_/g, " ")}</strong> · {r.recordId.slice(0, 8)}… ·{" "}
                {fmt(r.createdAt)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Approval chain */}
      {submission.approvals.length > 0 ? (
        <section className="s7-card" style={{ padding: 14 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Approval chain</h3>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            {submission.approvals
              .slice()
              .sort((a, b) => a.stepNumber - b.stepNumber)
              .map((a) => (
                <li key={a.id}>
                  <strong>Step {a.stepNumber}:</strong>{" "}
                  {a.status === "approved" ? (
                    <span style={{ color: "#166534" }}>
                      ✓ Approved {a.assignedTo ? `by ${a.assignedTo.firstName} ${a.assignedTo.lastName}` : ""} · {fmt(a.decidedAt)}
                    </span>
                  ) : a.status === "rejected" ? (
                    <span style={{ color: "#B91C1C" }}>
                      ✗ Rejected {a.assignedTo ? `by ${a.assignedTo.firstName} ${a.assignedTo.lastName}` : ""} · {fmt(a.decidedAt)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>
                      Pending · Due {fmt(a.dueAt)}
                    </span>
                  )}
                  {a.comment ? <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{a.comment}</div> : null}
                </li>
              ))}
          </ol>

          {canDecide ? (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="s7-btn"
                style={{ background: "#16A34A", color: "#fff", borderColor: "#16A34A" }}
                onClick={() => {
                  setOpenComment("approve");
                  setComment("");
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="s7-btn"
                style={{ background: "#DC2626", color: "#fff", borderColor: "#DC2626" }}
                onClick={() => {
                  setOpenComment("reject");
                  setComment("");
                }}
              >
                Reject
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Action bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href={`/api/v1/forms/submissions/${submission.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="s7-btn s7-btn--secondary"
        >
          Download PDF
        </a>
        {statusKey === "rejected" && isOwner ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D" }}
            onClick={() => navigate(`/forms/fill/${submission.id}`)}
          >
            Resubmit
          </button>
        ) : null}
      </div>

      {openComment ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenComment(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="s7-card"
            style={{ padding: 18, width: "min(420px, 92vw)" }}
          >
            <h3 style={{ margin: "0 0 8px" }}>{openComment === "approve" ? "Approve submission" : "Reject submission"}</h3>
            <textarea
              className="s7-textarea"
              rows={3}
              placeholder={openComment === "approve" ? "Optional comment for the submitter…" : "Required — explain why this is being rejected."}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setOpenComment(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                disabled={busy}
                onClick={() => void decide(openComment)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  );
}

function FieldRow({ field, value }: { field: Field; value: unknown }) {
  return (
    <>
      <dt style={{ color: "var(--text-muted)", fontSize: 12 }}>{field.label}</dt>
      <dd style={{ margin: 0, fontSize: 13 }}>{renderValue(field, value)}</dd>
    </>
  );
}
