// CRM SLICE 6 — admin screen for the DropReason managed list.
// Reads from GET /crm/drop-reasons; mutates via POST (add) and PATCH (edit/toggle).
// No hard-delete button — the API guards in-use rows; soft-disable is the
// operator-visible alternative.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { listDropReasons, type DropReason } from "./crm-api";

// ─── pure helpers (also exported for unit tests) ───────────────────────────

/** Return a human-readable sortOrder string for display (no change). */
export function fmtSortOrder(n: number): string {
  return String(n);
}

/** Produce the PATCH body for toggling isActive. */
export function buildToggleBody(current: boolean): { isActive: boolean } {
  return { isActive: !current };
}

/** Validate an add-form submission: label must be non-empty. */
export function validateAddForm(label: string): string | null {
  if (!label.trim()) return "Label is required.";
  if (label.trim().length > 200) return "Label must be 200 characters or fewer.";
  return null;
}

// ─── types ─────────────────────────────────────────────────────────────────

type EditState = {
  id: string;
  label: string;
  sortOrder: string;
};

// ─── component ─────────────────────────────────────────────────────────────

export function DropReasonAdminPage() {
  const { authFetch } = useAuth();

  const [reasons, setReasons] = useState<DropReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [addLabel, setAddLabel] = useState("");
  const [addSortOrder, setAddSortOrder] = useState("0");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Inline edit — at most one row at a time
  const [editing, setEditing] = useState<EditState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Toggle busy set (row ids currently being toggled)
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDropReasons(authFetch);
      setReasons(rows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { void load(); }, [load]);

  // ── add ──────────────────────────────────────────────────────────────────

  async function handleAdd() {
    const err = validateAddForm(addLabel);
    if (err) { setAddError(err); return; }
    setAdding(true);
    setAddError(null);
    try {
      const res = await authFetch("/crm/drop-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: addLabel.trim(),
          sortOrder: Number(addSortOrder) || 0
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setAddLabel("");
      setAddSortOrder("0");
      await load();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  // ── inline edit ───────────────────────────────────────────────────────────

  function startEdit(r: DropReason) {
    setEditing({ id: r.id, label: r.label, sortOrder: String(r.sortOrder) });
    setEditError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.label.trim()) { setEditError("Label is required."); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await authFetch(`/crm/drop-reasons/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editing.label.trim(),
          sortOrder: Number(editing.sortOrder) || 0
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setEditing(null);
      await load();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  // ── toggle isActive ───────────────────────────────────────────────────────

  async function toggleActive(r: DropReason) {
    setToggling((prev) => new Set([...prev, r.id]));
    try {
      const res = await authFetch(`/crm/drop-reasons/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildToggleBody(r.isActive))
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    }
  }

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 20, margin: "0 0 4px" }}>
        CRM drop reasons
      </h2>
      <p style={{ color: "var(--text-muted, #666)", fontSize: 13, margin: "0 0 20px" }}>
        Managed list of "don't pursue" reasons shown to staff when closing an opportunity.
        Disable a reason to hide it from the picker without losing historical records.
      </p>

      {error && (
        <div role="alert" style={{ color: "#dc2626", padding: 12, background: "#fef2f2", borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── Add form ────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24
        }}
      >
        <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 14 }}>Add new reason</p>

        {addError && (
          <div role="alert" style={{ color: "#dc2626", padding: 8, background: "#fef2f2", borderRadius: 4, marginBottom: 10, fontSize: 13 }}>
            {addError}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <label htmlFor="add-label" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Label *
            </label>
            <input
              id="add-label"
              type="text"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="e.g. Price / budget"
              maxLength={200}
              style={inputStyle}
              disabled={adding}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            />
          </div>
          <div style={{ width: 100 }}>
            <label htmlFor="add-sort-order" style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Sort order
            </label>
            <input
              id="add-sort-order"
              type="number"
              value={addSortOrder}
              onChange={(e) => setAddSortOrder(e.target.value)}
              style={inputStyle}
              disabled={adding}
            />
          </div>
          <button
            onClick={() => void handleAdd()}
            disabled={adding}
            style={{
              padding: "9px 18px",
              borderRadius: 6,
              border: "none",
              background: "var(--color-teal, #005B61)",
              color: "#fff",
              fontWeight: 600,
              cursor: adding ? "not-allowed" : "pointer",
              minHeight: 40,
              opacity: adding ? 0.6 : 1,
              flexShrink: 0
            }}
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {loading ? (
        <p style={{ color: "var(--text-muted, #666)" }}>Loading…</p>
      ) : reasons.length === 0 ? (
        <p style={{ color: "var(--text-muted, #666)" }}>No drop reasons yet. Add one above.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ ...thStyle, textAlign: "left" }}>Label</th>
              <th style={{ ...thStyle, width: 90 }}>Sort order</th>
              <th style={{ ...thStyle, width: 80 }}>Active</th>
              <th style={{ ...thStyle, width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reasons.map((r) => {
              const isEditingRow = editing?.id === r.id;
              const isTogglingRow = toggling.has(r.id);

              return (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    background: isEditingRow ? "#f0fdf4" : r.isActive ? "#fff" : "#f9fafb",
                    opacity: r.isActive ? 1 : 0.65
                  }}
                >
                  {/* Label cell */}
                  <td style={tdStyle}>
                    {isEditingRow ? (
                      <input
                        type="text"
                        value={editing.label}
                        onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                        autoFocus
                        style={{ ...inputStyle, fontSize: 13 }}
                        disabled={editSaving}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      <span style={{ color: r.isActive ? "#111" : "var(--text-muted, #666)" }}>
                        {r.label}
                      </span>
                    )}
                    {isEditingRow && editError && (
                      <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{editError}</div>
                    )}
                  </td>

                  {/* Sort order cell */}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {isEditingRow ? (
                      <input
                        type="number"
                        value={editing.sortOrder}
                        onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })}
                        style={{ ...inputStyle, fontSize: 13, width: 70 }}
                        disabled={editSaving}
                      />
                    ) : (
                      fmtSortOrder(r.sortOrder)
                    )}
                  </td>

                  {/* Active toggle */}
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button
                      onClick={() => void toggleActive(r)}
                      disabled={isTogglingRow || isEditingRow}
                      aria-label={r.isActive ? `Disable ${r.label}` : `Enable ${r.label}`}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 12,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isTogglingRow || isEditingRow ? "not-allowed" : "pointer",
                        background: r.isActive ? "#dcfce7" : "#f3f4f6",
                        color: r.isActive ? "#166534" : "#6b7280",
                        opacity: isTogglingRow ? 0.6 : 1
                      }}
                    >
                      {isTogglingRow ? "…" : r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>

                  {/* Actions */}
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {isEditingRow ? (
                      <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => void saveEdit()}
                          disabled={editSaving}
                          style={btnSmallPrimary}
                        >
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={editSaving}
                          style={btnSmallSecondary}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => startEdit(r)}
                        disabled={editing !== null}
                        style={btnSmallSecondary}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── shared styles ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 4,
  border: "1px solid #ccc",
  boxSizing: "border-box"
};

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 13,
  color: "var(--text-muted, #555)"
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px"
};

const btnSmallPrimary: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 4,
  border: "none",
  background: "var(--color-teal, #005B61)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  minHeight: 32
};

const btnSmallSecondary: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 4,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  minHeight: 32
};
