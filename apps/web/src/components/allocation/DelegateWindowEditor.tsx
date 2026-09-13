/**
 * DelegateWindowEditor
 *
 * Renders a list of existing delegate windows (active + future) and a form to
 * create a new one. Accessible only to tenders.allocate holders (guarded by
 * the parent CapacityBoardPage — this component does not re-check).
 *
 * Delegate CRUD uses the hooks exposed from useCapacityBoard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AllocatorDelegate } from "../../hooks/useCapacityBoard";
import { useAuth } from "../../auth/AuthContext";

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  listDelegates: () => Promise<AllocatorDelegate[]>;
  createDelegate: (delegateId: string, startDate: string, endDate: string) => Promise<AllocatorDelegate>;
  deleteDelegate: (id: string) => Promise<void>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function isActiveOrFuture(endDate: string): boolean {
  return new Date(endDate) >= new Date(new Date().toDateString());
}

export function DelegateWindowEditor({ listDelegates, createDelegate, deleteDelegate }: Props) {
  const { authFetch } = useAuth();
  const [delegates, setDelegates] = useState<AllocatorDelegate[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingDelegates, setLoadingDelegates] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New delegate form
  const [newDelegateId, setNewDelegateId] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoadingDelegates(true);
    try {
      const [delegateRows, usersRes] = await Promise.all([
        listDelegates(),
        authFetch("/users?page=1&pageSize=100")
      ]);
      if (!mountedRef.current) return;
      setDelegates(delegateRows.filter((d) => isActiveOrFuture(d.endDate)));
      if (usersRes.ok) {
        const body = (await usersRes.json()) as { items: UserOption[] } | UserOption[];
        const items = Array.isArray(body) ? body : body.items ?? [];
        setUsers(items);
      }
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message ?? "Failed to load delegates");
    } finally {
      if (mountedRef.current) setLoadingDelegates(false);
    }
  }, [listDelegates, authFetch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Validate dates
  const dateError = (() => {
    if (!newStartDate || !newEndDate) return null;
    if (new Date(newStartDate) > new Date(newEndDate)) return "Start date must be on or before end date.";
    if (new Date(newEndDate) < new Date(new Date().toDateString())) return "End date must be in the future.";
    return null;
  })();

  const canSubmit =
    newDelegateId &&
    newStartDate &&
    newEndDate &&
    !dateError &&
    !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await createDelegate(newDelegateId, newStartDate, newEndDate);
      setNewDelegateId("");
      setNewStartDate("");
      setNewEndDate("");
      await loadData();
    } catch (err) {
      setFormError((err as Error).message ?? "Failed to create delegate");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDelegate(id);
      setDelegates((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as Error).message ?? "Failed to delete delegate");
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontSize: 13 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Delegate windows</h3>

      {error && (
        <p role="alert" style={{ margin: 0, color: "var(--status-danger, #B91C1C)", fontSize: 12 }}>
          {error}
        </p>
      )}

      {/* Existing delegates list */}
      {loadingDelegates ? (
        <p style={{ color: "var(--text-muted, #9CA3AF)" }}>Loading…</p>
      ) : delegates.length === 0 ? (
        <p style={{ color: "var(--text-muted, #9CA3AF)" }}>No active or upcoming delegate windows.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-default, #E5E7EB)" }}>
              {["Delegate", "Start", "End", "Granted by", ""].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--text-secondary, #4B5563)"
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {delegates.map((d) => {
              const isActive =
                new Date(d.startDate) <= new Date() && new Date(d.endDate) >= new Date();
              return (
                <tr
                  key={d.id}
                  style={{ borderBottom: "1px solid var(--border-subtle, #F3F4F6)" }}
                >
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ fontWeight: 500 }}>{d.delegateName}</span>
                    {isActive && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 11,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "#D1FAE5",
                          color: "#065F46"
                        }}
                      >
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{formatDate(d.startDate)}</td>
                  <td style={{ padding: "8px 10px" }}>{formatDate(d.endDate)}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary, #4B5563)" }}>
                    {d.grantedByName}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <button
                      type="button"
                      className="s7-btn s7-btn--sm s7-btn--ghost"
                      style={{ color: "var(--status-danger, #B91C1C)" }}
                      onClick={() => { void handleDelete(d.id); }}
                      disabled={deletingId === d.id}
                      aria-label={`Revoke delegate window for ${d.delegateName}`}
                    >
                      {deletingId === d.id ? "Revoking…" : "Revoke"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* New delegate form */}
      <fieldset
        style={{
          border: "1px solid var(--border-default, #E5E7EB)",
          borderRadius: 8,
          padding: "16px",
          margin: 0
        }}
      >
        <legend style={{ fontWeight: 600, padding: "0 6px", fontSize: 13 }}>
          Grant new delegate window
        </legend>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 500 }}>Delegate user</span>
            <select
              value={newDelegateId}
              onChange={(e) => setNewDelegateId(e.target.value)}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border-default, #D1D5DB)",
                borderRadius: 6,
                fontSize: 13,
                background: "var(--surface, #fff)"
              }}
            >
              <option value="">-- Select user --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 500 }}>Start date</span>
            <input
              type="date"
              value={newStartDate}
              min={today}
              onChange={(e) => setNewStartDate(e.target.value)}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border-default, #D1D5DB)",
                borderRadius: 6,
                fontSize: 13
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 500 }}>End date</span>
            <input
              type="date"
              value={newEndDate}
              min={newStartDate || today}
              onChange={(e) => setNewEndDate(e.target.value)}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border-default, #D1D5DB)",
                borderRadius: 6,
                fontSize: 13
              }}
            />
          </label>
        </div>

        {dateError && (
          <p role="alert" style={{ margin: "8px 0 0", fontSize: 12, color: "var(--status-danger, #B91C1C)" }}>
            {dateError}
          </p>
        )}
        {formError && (
          <p role="alert" style={{ margin: "8px 0 0", fontSize: 12, color: "var(--status-danger, #B91C1C)" }}>
            {formError}
          </p>
        )}

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => { void handleCreate(); }}
            disabled={!canSubmit}
          >
            {submitting ? "Granting…" : "Grant window"}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
