import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Qualification = {
  id: string;
  qualType: string;
  licenceNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  status: "not_set" | "active" | "expiring_30" | "expiring_7" | "expired";
};

type QualType =
  | "white_card"
  | "asbestos_a"
  | "asbestos_b"
  | "forklift"
  | "ewp"
  | "rigger"
  | "scaffolder"
  | "first_aid"
  | "warden"
  | "dogman"
  | "crane"
  | "electrical"
  | "plumbing"
  | "other";

const QUAL_TYPE_LABELS: Record<QualType, string> = {
  white_card: "White Card (General Construction Induction)",
  asbestos_a: "Asbestos Removal — Class A",
  asbestos_b: "Asbestos Removal — Class B",
  forklift: "Forklift Licence",
  ewp: "EWP (Elevated Work Platform)",
  rigger: "Rigger Licence",
  scaffolder: "Scaffolder Licence",
  first_aid: "First Aid Certificate",
  warden: "Fire Warden Certificate",
  dogman: "Dogman Licence",
  crane: "Crane Operator Licence",
  electrical: "Electrical Licence",
  plumbing: "Plumbing Licence",
  other: "Other"
};

const STATUS_TONES: Record<Qualification["status"], { bg: string; label: string }> = {
  not_set: { bg: "#94A3B8", label: "No expiry" },
  active: { bg: "#16a34a", label: "Active" },
  expiring_30: { bg: "#eab308", label: "Expiring soon" },
  expiring_7: { bg: "#f97316", label: "Expiring soon" },
  expired: { bg: "#dc2626", label: "Expired" }
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function QualificationsSection({
  workerProfileId,
  canManage
}: {
  workerProfileId: string;
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Qualification | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/compliance/workers/${workerProfileId}/qualifications`);
      if (!response.ok) throw new Error(await response.text());
      setItems((await response.json()) as Qualification[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, workerProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (q: Qualification) => {
    const label = QUAL_TYPE_LABELS[q.qualType as QualType] ?? q.qualType;
    if (!window.confirm(`Delete ${label}?`)) return;
    const response = await authFetch(`/compliance/workers/${workerProfileId}/qualifications/${q.id}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  return (
    <section className="s7-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 0 }}>
          Qualifications
        </h3>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => setCreating(true)}
          >
            + Add qualification
          </button>
        ) : null}
      </div>

      {error ? <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No qualifications recorded yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
              <tr>
                {["Type", "Licence #", "Authority", "Issued", "Expiry", "Status", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-muted)"
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((q) => {
                const tone = STATUS_TONES[q.status];
                return (
                  <tr key={q.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={{ padding: "6px 8px" }}>
                      <strong>{QUAL_TYPE_LABELS[q.qualType as QualType] ?? q.qualType}</strong>
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{q.licenceNumber ?? "—"}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{q.issuingAuthority ?? "—"}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{fmtDate(q.issueDate)}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{fmtDate(q.expiryDate)}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          background: tone.bg,
                          color: "#fff",
                          borderRadius: 999,
                          textTransform: "uppercase"
                        }}
                      >
                        {tone.label}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="s7-btn s7-btn--ghost s7-btn--sm"
                            onClick={() => setEditing(q)}
                            aria-label="Edit"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="s7-btn s7-btn--ghost s7-btn--sm"
                            onClick={() => void remove(q)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            ×
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating || editing ? (
        <QualificationModal
          workerProfileId={workerProfileId}
          existing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function QualificationModal({
  workerProfileId,
  existing,
  onClose,
  onSaved
}: {
  workerProfileId: string;
  existing: Qualification | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    qualType: (existing?.qualType ?? "white_card") as QualType,
    licenceNumber: existing?.licenceNumber ?? "",
    issuingAuthority: existing?.issuingAuthority ?? "",
    issueDate: existing?.issueDate ? existing.issueDate.slice(0, 10) : "",
    expiryDate: existing?.expiryDate ? existing.expiryDate.slice(0, 10) : "",
    notes: existing?.notes ?? ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const payload = {
        qualType: form.qualType,
        licenceNumber: form.licenceNumber.trim() || null,
        issuingAuthority: form.issuingAuthority.trim() || null,
        issueDate: form.issueDate || null,
        expiryDate: form.expiryDate || null,
        notes: form.notes.trim() || null
      };
      const url = existing
        ? `/compliance/workers/${workerProfileId}/qualifications/${existing.id}`
        : `/compliance/workers/${workerProfileId}/qualifications`;
      const method = existing ? "PATCH" : "POST";
      const response = await authFetch(url, { method, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await response.text());
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1100,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="s7-card"
        style={{ padding: 20, width: "min(540px, 90vw)", maxHeight: "90vh", overflow: "auto" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>
          {existing ? "Edit qualification" : "Add qualification"}
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Type *</span>
            <select
              className="s7-select"
              value={form.qualType}
              onChange={(e) => setForm({ ...form, qualType: e.target.value as QualType })}
              required
            >
              {(Object.entries(QUAL_TYPE_LABELS) as Array<[QualType, string]>).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Licence number</span>
            <input
              className="s7-input"
              value={form.licenceNumber}
              onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Issuing authority</span>
            <input
              className="s7-input"
              value={form.issuingAuthority}
              onChange={(e) => setForm({ ...form, issuingAuthority: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Issue date</span>
            <input
              className="s7-input"
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Expiry date</span>
            <input
              className="s7-input"
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span>Notes</span>
            <textarea
              className="s7-textarea"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>

        {err ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{err}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
            {submitting ? "Saving…" : existing ? "Save changes" : "Add qualification"}
          </button>
        </div>
      </form>
    </div>
  );
}
