import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type LeaveType = "ANNUAL" | "PERSONAL" | "UNPAID" | "OTHER";

type LeaveRequest = {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  hours: number | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedAt: string | null;
  approvedBy: { firstName: string; lastName: string } | null;
  worker: { id: string; firstName: string; lastName: string };
};

const LEAVE_TYPES: LeaveType[] = ["ANNUAL", "PERSONAL", "UNPAID", "OTHER"];

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "#E2E8F0", fg: "#1F2937", label: "Pending" },
  APPROVED: { bg: "#DCFCE7", fg: "#166534", label: "Approved" },
  REJECTED: { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" }
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * Field self-service leave request page.
 * Workers submit leave and track the status of their own requests.
 */
export function FieldLeavePage() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "new">("list");
  // Worker profile id resolved from the first list response (the API scopes to self)
  const workerIdRef = useRef<string | null>(null);

  // Form state
  const [type, setType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const resp = await authFetch("/workers/leave-requests");
      if (!resp.ok) throw new Error(await resp.text());
      const body = await resp.json();
      const items = Array.isArray(body) ? body : [];
      setRows(items);
      // Capture worker id from the first item (all items belong to self when no permission)
      if (items.length > 0 && !workerIdRef.current) {
        workerIdRef.current = (items[0] as LeaveRequest).worker.id;
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      if (!workerIdRef.current) {
        throw new Error(
          "Worker profile not found. Submit a request by contacting your manager if this persists."
        );
      }
      const resp = await authFetch("/workers/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: workerIdRef.current,
          type,
          startDate,
          endDate,
          hours: hours ? parseFloat(hours) : undefined,
          reason: reason || undefined
        })
      });
      if (!resp.ok) throw new Error(await resp.text());
      setSuccess("Leave request submitted successfully.");
      setView("list");
      await loadList();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!rows && !error) return <Skeleton />;

  return (
    <div style={{ padding: "1rem", fontFamily: "Outfit, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontFamily: "Syne, sans-serif", margin: 0 }}>My Leave Requests</h2>
        {view === "list" && (
          <button
            onClick={() => { setView("new"); setError(null); setSuccess(null); }}
            style={{
              background: "#FEAA6D",
              color: "#000",
              border: "none",
              borderRadius: 6,
              padding: "0.5rem 1rem",
              cursor: "pointer",
              fontFamily: "Outfit, sans-serif",
              fontWeight: 600
            }}
          >
            + New Request
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "#DCFCE7", color: "#166534", padding: "0.75rem", borderRadius: 6, marginBottom: "1rem" }}>
          {success}
        </div>
      )}

      {view === "new" && (
        <form onSubmit={(e) => { void handleSubmit(e); }} style={{ background: "#F6F6F6", padding: "1rem", borderRadius: 8, marginBottom: "1.5rem" }}>
          <h3 style={{ fontFamily: "Syne, sans-serif", marginTop: 0 }}>Submit Leave Request</h3>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Leave Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LeaveType)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <label>
                <span style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Start Date</span>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
                />
              </label>
              <label>
                <span style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>End Date</span>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
                />
              </label>
            </div>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Hours (optional — for partial days)</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 4"
                style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Reason (optional)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc", resize: "vertical" }}
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "#FEAA6D",
                color: "#000",
                border: "none",
                borderRadius: 6,
                padding: "0.5rem 1.25rem",
                cursor: submitting ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif"
              }}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              style={{ background: "transparent", border: "1px solid #ccc", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {view === "list" && (
        <>
          {rows && rows.length === 0 && (
            <EmptyState heading="No leave requests yet" subtext="Submit one above to get started." />
          )}
          {rows && rows.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ background: "#005B61", color: "#fff", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Type</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Start</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>End</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Status</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Approved By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const pill = STATUS_PILL[row.status];
                  return (
                    <tr key={row.id} style={{ background: idx % 2 === 0 ? "#fff" : "#F6F6F6" }}>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{row.type.charAt(0) + row.type.slice(1).toLowerCase()}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{formatDate(row.startDate)}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{formatDate(row.endDate)}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span style={{ background: pill.bg, color: pill.fg, padding: "0.2rem 0.6rem", borderRadius: 12, fontSize: "0.8rem", fontWeight: 600 }}>
                          {pill.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {row.approvedBy
                          ? `${row.approvedBy.firstName} ${row.approvedBy.lastName}`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
