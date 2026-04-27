import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { DraftBanner, SaveDraftButton, useFormDraft } from "../../drafts";

type Leave = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  approvedBy: { firstName: string; lastName: string } | null;
};

type Unavailability = {
  id: string;
  reason: string;
  startDate: string;
  endDate: string;
  recurringDay: number | null;
};

const LEAVE_TYPES = ["annual", "sick", "personal", "long_service", "unpaid", "other"] as const;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export function AvailabilitySection({
  workerProfileId,
  canManage
}: {
  workerProfileId: string;
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [holds, setHolds] = useState<Unavailability[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<"leave" | "hold" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [lr, ur] = await Promise.all([
        authFetch(`/workers/leaves?workerProfileId=${workerProfileId}`),
        authFetch(`/workers/unavailability?workerProfileId=${workerProfileId}`)
      ]);
      if (lr.ok) setLeaves(await lr.json());
      if (ur.ok) setHolds(await ur.json());
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, workerProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setLeaveStatus = async (id: string, status: string) => {
    const r = await authFetch(`/workers/leaves/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!r.ok) {
      setError(await r.text());
      return;
    }
    void load();
  };

  return (
    <section className="s7-card" style={{ marginTop: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Availability
        </h3>
        {canManage ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => setAdding("leave")}>
              + Leave
            </button>
            <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => setAdding("hold")}>
              + Unavailability
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Leaves</div>
          {leaves.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No leave on file.</p>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted, #f6f6f6)" }}>
                  <th style={{ textAlign: "left", padding: 6 }}>Type</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Window</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Status</th>
                  {canManage ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={{ padding: 6, textTransform: "capitalize" }}>{l.leaveType}</td>
                    <td style={{ padding: 6 }}>
                      {fmt(l.startDate)} – {fmt(l.endDate)}
                    </td>
                    <td style={{ padding: 6 }}>{l.status}</td>
                    {canManage ? (
                      <td style={{ padding: 6, textAlign: "right" }}>
                        {l.status === "PENDING" ? (
                          <>
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost s7-btn--sm"
                              onClick={() => void setLeaveStatus(l.id, "APPROVED")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost s7-btn--sm"
                              onClick={() => void setLeaveStatus(l.id, "DECLINED")}
                            >
                              Decline
                            </button>
                          </>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Unavailability</div>
          {holds.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No unavailability on file.</p>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted, #f6f6f6)" }}>
                  <th style={{ textAlign: "left", padding: 6 }}>Reason</th>
                  <th style={{ textAlign: "left", padding: 6 }}>Window / Recurrence</th>
                </tr>
              </thead>
              <tbody>
                {holds.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={{ padding: 6 }}>{u.reason}</td>
                    <td style={{ padding: 6 }}>
                      {u.recurringDay !== null ? (
                        <span>
                          Every {DAYS[u.recurringDay]} ({fmt(u.startDate)} – {fmt(u.endDate)})
                        </span>
                      ) : (
                        <span>
                          {fmt(u.startDate)} – {fmt(u.endDate)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {adding ? (
        <AddModal
          mode={adding}
          workerProfileId={workerProfileId}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function AddModal({
  mode,
  workerProfileId,
  onClose,
  onSaved
}: {
  mode: "leave" | "hold";
  workerProfileId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { authFetch, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]>("annual");
  const [reason, setReason] = useState("");
  const [recurringDay, setRecurringDay] = useState<string>("");
  const [notes, setNotes] = useState("");

  // PR #111 — separate draft per mode (leave / unavailability) so the
  // user can have one of each in flight at the same time.
  const formType = mode === "leave" ? "worker_leave_create" : "worker_unavailability_create";
  const { hasDraft, lastSavedAt, saveDraft, restoreDraft, discardDraft } = useFormDraft({
    formType,
    contextKey: workerProfileId,
    schemaVersion: 1,
    getValues: () => ({ startDate, endDate, leaveType, reason, recurringDay, notes }),
    setValues: (d) => {
      const data = d as {
        startDate: string;
        endDate: string;
        leaveType: (typeof LEAVE_TYPES)[number];
        reason: string;
        recurringDay: string;
        notes: string;
      };
      setStartDate(data.startDate);
      setEndDate(data.endDate);
      setLeaveType(data.leaveType);
      setReason(data.reason);
      setRecurringDay(data.recurringDay);
      setNotes(data.notes);
    }
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setErr("Start and end dates are required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const url = mode === "leave" ? "/workers/leaves" : "/workers/unavailability";
      const body =
        mode === "leave"
          ? { workerProfileId, leaveType, startDate, endDate, notes: notes || undefined }
          : {
              workerProfileId,
              reason,
              startDate,
              endDate,
              recurringDay: recurringDay !== "" ? Number(recurringDay) : undefined
            };
      const r = await authFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(await r.text());
      await discardDraft();
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
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="s7-card"
        style={{ padding: 18, width: "min(440px, 92vw)" }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: "0 0 12px" }}>
          {mode === "leave" ? "Add leave" : "Add unavailability"}
        </h3>

        {hasDraft ? (
          <DraftBanner
            userId={user?.id ?? null}
            formType={formType}
            onRestore={restoreDraft}
            onDiscard={discardDraft}
          />
        ) : null}

        {mode === "leave" ? (
          <label style={{ display: "block", marginBottom: 10, fontSize: 13 }}>
            Type
            <select
              className="s7-input"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as (typeof LEAVE_TYPES)[number])}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label style={{ display: "block", marginBottom: 10, fontSize: 13 }}>
            Reason
            <input
              className="s7-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
            />
          </label>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ fontSize: 13 }}>
            Start
            <input
              className="s7-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label style={{ fontSize: 13 }}>
            End
            <input
              className="s7-input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </label>
        </div>

        {mode === "hold" ? (
          <label style={{ display: "block", marginTop: 10, fontSize: 13 }}>
            Recurring day (optional)
            <select
              className="s7-input"
              value={recurringDay}
              onChange={(e) => setRecurringDay(e.target.value)}
            >
              <option value="">None (one-off range)</option>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  Every {d}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label style={{ display: "block", marginTop: 10, fontSize: 13 }}>
            Notes
            <textarea
              className="s7-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </label>
        )}

        {err ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{err}</p> : null}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <SaveDraftButton onSave={saveDraft} lastSavedAt={lastSavedAt} disabled={submitting} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
