import { useCallback, useEffect, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { NoAccess } from "../../components/NoAccess";
import { useConfirm } from "../../hooks/useConfirm";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tenant = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type TenantUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  homeTenantId: string | null;
};

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * AdminCompaniesPage — MT-5.
 *
 * Super-user only page for creating and managing Tenant rows.
 * Lists all tenants with create/rename/deactivate actions, and a per-company
 * "assigned users" panel with an add-user control.
 *
 * Route: /settings/companies (added to SettingsShell Company section).
 * Guard: SuperUserOnly at the route level in App.tsx.
 */
export function AdminCompaniesPage() {
  const { user, authFetch } = useAuth();
  const confirm = useConfirm();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit form state
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Per-company user panel
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Super-user gate
  if (!user) return null;
  if (!user.isSuperUser) {
    return (
      <NoAccess required="super-user" title="Companies management is restricted to super users" />
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/tenants");
      if (!res.ok) throw new Error(await res.text());
      setTenants((await res.json()) as Tenant[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const loadTenantUsers = useCallback(
    async (tenantId: string) => {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const res = await authFetch(`/tenants/${tenantId}/users`);
        if (!res.ok) throw new Error(await res.text());
        setTenantUsers((await res.json()) as TenantUser[]);
      } catch (err) {
        setUsersError((err as Error).message);
      } finally {
        setUsersLoading(false);
      }
    },
    [authFetch]
  );

  const openUserPanel = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setTenantUsers([]);
    setAssignUserId("");
    setAssignError(null);
    void loadTenantUsers(tenant.id);
  };

  const closeUserPanel = () => {
    setSelectedTenant(null);
    setTenantUsers([]);
    setAssignUserId("");
    setAssignError(null);
  };

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      setCreateError("Name is required.");
      return;
    }
    setCreateSaving(true);
    setCreateError(null);
    try {
      const res = await authFetch("/tenants", {
        method: "POST",
        body: JSON.stringify({ name, code: createCode.trim() || undefined })
      });
      if (!res.ok) throw new Error(await res.text());
      setCreateOpen(false);
      setCreateName("");
      setCreateCode("");
      await loadTenants();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreateSaving(false);
    }
  };

  const openEdit = (tenant: Tenant) => {
    setEditTenant(tenant);
    setEditName(tenant.name);
    setEditCode(tenant.code ?? "");
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editTenant) return;
    const name = editName.trim();
    if (!name) {
      setEditError("Name is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await authFetch(`/tenants/${editTenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, code: editCode.trim() || undefined })
      });
      if (!res.ok) throw new Error(await res.text());
      setEditTenant(null);
      await loadTenants();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleActive = async (tenant: Tenant) => {
    const action = tenant.isActive ? "deactivate" : "reactivate";
    const ok = await confirm({
      title: `${tenant.isActive ? "Deactivate" : "Reactivate"} company`,
      message: `${tenant.isActive ? "Deactivate" : "Reactivate"} "${tenant.name}"?`,
      confirmLabel: tenant.isActive ? "Deactivate" : "Reactivate",
      variant: tenant.isActive ? "danger" : "default"
    });
    if (!ok) return;
    try {
      const res = await authFetch(`/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !tenant.isActive })
      });
      if (!res.ok) throw new Error(await res.text());
      await loadTenants();
    } catch (err) {
      setError(`Failed to ${action} company: ${(err as Error).message}`);
    }
  };

  const handleAssignUser = async () => {
    const userId = assignUserId.trim();
    if (!userId || !selectedTenant) return;
    setAssignSaving(true);
    setAssignError(null);
    try {
      const res = await authFetch(`/tenants/${selectedTenant.id}/assign-user`, {
        method: "PATCH",
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error(await res.text());
      setAssignUserId("");
      await loadTenantUsers(selectedTenant.id);
    } catch (err) {
      setAssignError((err as Error).message);
    } finally {
      setAssignSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 className="s7-type-page-heading" style={{ margin: 0 }}>
          Companies
        </h1>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => {
            setCreateName("");
            setCreateCode("");
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          + New company
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", marginTop: 0, marginBottom: 24 }}>
        Tenant companies in this platform. Create, rename, or deactivate companies, and manage
        which users belong to each company.
      </p>

      {error && (
        <div
          style={{
            background: "#ffebee",
            color: "#c62828",
            padding: 8,
            borderRadius: 4,
            marginBottom: 12
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading companies…</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt, #f6f6f6)" }}>
              <th style={{ textAlign: "left", padding: "8px 10px" }}>Name</th>
              <th style={{ textAlign: "left", padding: "8px 10px" }}>Code</th>
              <th style={{ textAlign: "left", padding: "8px 10px" }}>Status</th>
              <th style={{ textAlign: "left", padding: "8px 10px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: "12px 10px", color: "var(--text-muted)" }}
                >
                  No companies found. Create the first one.
                </td>
              </tr>
            )}
            {tenants.map((tenant) => (
              <tr key={tenant.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                  {tenant.name}
                  {!tenant.isActive && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: "var(--text-muted)",
                        padding: "1px 6px",
                        background: "var(--surface-alt, #f6f6f6)",
                        borderRadius: 4
                      }}
                    >
                      inactive
                    </span>
                  )}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>
                  {tenant.code ?? "—"}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: tenant.isActive ? "#e8f5e9" : "#fafafa",
                      color: tenant.isActive ? "#2e7d32" : "var(--text-muted)",
                      border: tenant.isActive ? "1px solid #a5d6a7" : "1px solid #e0e0e0"
                    }}
                  >
                    {tenant.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => openEdit(tenant)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => openUserPanel(tenant)}
                    >
                      Users
                    </button>
                    <button
                      type="button"
                      style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        background: "transparent",
                        border: `1px solid ${tenant.isActive ? "#c62828" : "#005B61"}`,
                        color: tenant.isActive ? "#c62828" : "#005B61",
                        borderRadius: 4,
                        cursor: "pointer"
                      }}
                      onClick={() => void handleToggleActive(tenant)}
                    >
                      {tenant.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Create modal ─────────────────────────────────────────────────── */}
      {createOpen && (
        <CenteredModal
          title="New company"
          onClose={() => setCreateOpen(false)}
          busy={createSaving}
          dataTestId="create-tenant-modal"
          maxWidth={460}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setCreateOpen(false)}
                disabled={createSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-tenant-form"
                className="s7-btn s7-btn--primary"
                disabled={createSaving || !createName.trim()}
              >
                {createSaving ? "Creating…" : "Create"}
              </button>
            </>
          }
        >
          <form
            id="create-tenant-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {createError && (
              <div
                style={{
                  background: "#ffebee",
                  color: "#c62828",
                  padding: 8,
                  borderRadius: 4,
                  fontSize: 13
                }}
              >
                {createError}
              </div>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Company name</span>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                autoFocus
                placeholder="e.g. Initial Services Pty Ltd"
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Code (optional, must be unique)</span>
              <input
                type="text"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="e.g. IS"
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
          </form>
        </CenteredModal>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {editTenant && (
        <CenteredModal
          title={`Edit "${editTenant.name}"`}
          onClose={() => setEditTenant(null)}
          busy={editSaving}
          dataTestId="edit-tenant-modal"
          maxWidth={460}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setEditTenant(null)}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-tenant-form"
                className="s7-btn s7-btn--primary"
                disabled={editSaving || !editName.trim()}
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          <form
            id="edit-tenant-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleEdit();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {editError && (
              <div
                style={{
                  background: "#ffebee",
                  color: "#c62828",
                  padding: 8,
                  borderRadius: 4,
                  fontSize: 13
                }}
              >
                {editError}
              </div>
            )}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Company name</span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Code (optional, must be unique)</span>
              <input
                type="text"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="Leave blank to clear"
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
          </form>
        </CenteredModal>
      )}

      {/* ── Users panel modal ────────────────────────────────────────────── */}
      {selectedTenant && (
        <CenteredModal
          title={`Users — ${selectedTenant.name}`}
          onClose={closeUserPanel}
          busy={usersLoading}
          dataTestId="tenant-users-modal"
          maxWidth={560}
          footer={
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={closeUserPanel}
            >
              Close
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Assign user */}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)" }}>
                Enter a user ID to assign them to this company (sets their home company).
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  placeholder="User ID"
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13
                  }}
                />
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={() => void handleAssignUser()}
                  disabled={assignSaving || !assignUserId.trim()}
                  style={{ fontSize: 13 }}
                >
                  {assignSaving ? "Assigning…" : "Assign"}
                </button>
              </div>
              {assignError && (
                <p style={{ color: "#c62828", fontSize: 12, margin: "4px 0 0" }}>{assignError}</p>
              )}
            </div>

            {/* User list */}
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Assigned users</h3>
              {usersError && (
                <p style={{ color: "#c62828", fontSize: 13 }}>{usersError}</p>
              )}
              {usersLoading ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
              ) : tenantUsers.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  No users assigned to this company yet.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-alt, #f6f6f6)" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Name</th>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Email</th>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantUsers.map((tenantUser) => (
                      <tr
                        key={tenantUser.id}
                        style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}
                      >
                        <td style={{ padding: "6px 8px" }}>
                          {tenantUser.firstName} {tenantUser.lastName}
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>
                          {tenantUser.email}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: tenantUser.isActive ? "#e8f5e9" : "#fafafa",
                              color: tenantUser.isActive ? "#2e7d32" : "var(--text-muted)",
                              border: tenantUser.isActive
                                ? "1px solid #a5d6a7"
                                : "1px solid #e0e0e0"
                            }}
                          >
                            {tenantUser.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </CenteredModal>
      )}
    </div>
  );
}
