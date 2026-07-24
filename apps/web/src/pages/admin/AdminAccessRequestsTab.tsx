import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";

type AccessRequestRow = {
  id: string;
  email: string;
  displayName: string | null;
  kind: string;
  message: string | null;
  createdAt: string;
  entraOid: string | null;
};

type Role = { id: string; name: string };

/**
 * Admin — Access requests
 *
 * PENDING requests submitted by unregistered Entra users via /auth/request-access.
 * Approve creates the user (SSO-only) with the chosen role; Deny marks the row
 * DENIED. Approved / Denied rows drop out of this list on refresh.
 */
export function AdminAccessRequestsTab() {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<AccessRequestRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [selectedRoleByRow, setSelectedRoleByRow] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, rolesRes] = await Promise.all([
        authFetch("/admin/access-requests"),
        authFetch("/roles")
      ]);
      if (!reqRes.ok) throw new Error(await reqRes.text());
      if (!rolesRes.ok) throw new Error(await rolesRes.text());
      const requests = (await reqRes.json()) as AccessRequestRow[];
      const rolesData = (await rolesRes.json()) as { items: Role[] } | Role[];
      const rolesList = Array.isArray(rolesData) ? rolesData : rolesData.items;
      setRows(requests);
      setRoles(rolesList);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const defaultRoleId = useMemo(() => {
    // Pick a sensible default so admins don't have to hunt every time —
    // Viewer if present, else the alphabetically-first role.
    const viewer = roles.find((r) => r.name.toLowerCase() === "viewer");
    if (viewer) return viewer.id;
    return roles[0]?.id ?? "";
  }, [roles]);

  const approve = async (row: AccessRequestRow) => {
    const roleId = selectedRoleByRow[row.id] ?? defaultRoleId;
    if (!roleId) {
      setError("No roles available.");
      return;
    }
    setBusyRowId(row.id);
    setError(null);
    try {
      const response = await authFetch(`/admin/access-requests/${row.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ roleIds: [roleId] })
      });
      if (!response.ok) throw new Error(await response.text());
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyRowId(null);
    }
  };

  const deny = async (row: AccessRequestRow) => {
    const ok = await confirm({
      title: "Deny access request",
      message: `Deny access request from ${row.email}?`,
      confirmLabel: "Deny",
      variant: "danger"
    });
    if (!ok) return;
    setBusyRowId(row.id);
    setError(null);
    try {
      const response = await authFetch(`/admin/access-requests/${row.id}/deny`, {
        method: "POST"
      });
      if (!response.ok) throw new Error(await response.text());
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyRowId(null);
    }
  };

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <section className="s7-card">
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>
        Access requests
      </h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 16px" }}>
        Unregistered Microsoft users who have requested access. Approve creates the
        user (SSO-only) with the chosen role.
      </p>

      {error ? (
        <p style={{ color: "var(--status-danger)", marginTop: 0 }}>{error}</p>
      ) : null}

      {rows.length === 0 ? (
        <p style={{ color: "var(--text-muted)", margin: 0 }}>No pending requests.</p>
      ) : (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Message</th>
                <th>Received</th>
                <th>Role</th>
                <th style={{ width: 220 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const roleId = selectedRoleByRow[row.id] ?? defaultRoleId;
                const busy = busyRowId === row.id;
                return (
                  <tr key={row.id}>
                    <td>{row.email}</td>
                    <td>{row.displayName ?? <em style={{ color: "var(--text-muted)" }}>—</em>}</td>
                    <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>
                      {row.message ? (
                        row.message
                      ) : (
                        <em style={{ color: "var(--text-muted)" }}>(no message)</em>
                      )}
                    </td>
                    <td>{new Date(row.createdAt).toLocaleString("en-AU")}</td>
                    <td>
                      <select
                        value={roleId}
                        onChange={(event) =>
                          setSelectedRoleByRow((prev) => ({
                            ...prev,
                            [row.id]: event.target.value
                          }))
                        }
                        disabled={busy}
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="s7-btn s7-btn--primary"
                        disabled={busy || !roleId}
                        onClick={() => void approve(row)}
                      >
                        {busy ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost"
                        disabled={busy}
                        onClick={() => void deny(row)}
                      >
                        Deny
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
