import { useCallback, useEffect, useMemo, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";
import {
  copyTextToClipboard,
  performAdminResetPassword,
  ResetPasswordError
} from "./resetUserPassword";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  isSuperUser: boolean;
  role: { id: string; name: string } | null;
};

type Role = { id: string; name: string };

export function AdminUsersTab() {
  const { authFetch, user } = useAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [resetting, setResetting] = useState<Row | null>(null);
  const [resetResult, setResetResult] = useState<{ user: Row; temporaryPassword: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const viewerIsSuper = useMemo(() => {
    // Super-user status isn't reflected in the JWT permissions array today,
    // so we look it up against /admin/users/me via email as a fallback.
    const email = user?.email ?? "";
    return rows.find((r) => r.email === email)?.isSuperUser ?? false;
  }, [rows, user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        authFetch("/admin/users"),
        authFetch("/roles")
      ]);
      if (!usersRes.ok) throw new Error(await usersRes.text());
      setRows((await usersRes.json()) as Row[]);
      if (rolesRes.ok) {
        const body = (await rolesRes.json()) as { items?: Role[] } | Role[];
        setRoles(Array.isArray(body) ? body : body.items ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const availableRoles = useMemo(() => {
    return viewerIsSuper ? roles : roles.filter((r) => r.name !== "Admin");
  }, [roles, viewerIsSuper]);

  const lockedCount = useMemo(() => {
    if (viewerIsSuper) return 0;
    return rows.filter((r) => r.isSuperUser || r.role?.name === "Admin").length;
  }, [rows, viewerIsSuper]);

  const toggleActive = async (row: Row) => {
    const next = !row.isActive;
    const label = next ? "Reactivate" : "Deactivate";
    if (!next) {
      const ok = await confirm({
        title: "Deactivate user",
        message: `Deactivate ${row.firstName} ${row.lastName}? They will lose access immediately.`,
        confirmLabel: "Deactivate",
        variant: "danger"
      });
      if (!ok) return;
    }
    try {
      const response = await authFetch(`/admin/users/${row.id}`, {
        method: next ? "PATCH" : "DELETE",
        body: next ? JSON.stringify({ isActive: true }) : undefined
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
      showToast(`${label}d ${row.firstName} ${row.lastName}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const currentUserEmail = user?.email;

  return (
    <section className="s7-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Users</h2>
        <button type="button" className="s7-btn s7-btn--primary" onClick={() => setAddOpen(true)}>
          + Add user
        </button>
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {!viewerIsSuper && lockedCount > 0 ? (
        <div
          role="note"
          data-testid="admin-tier-banner"
          style={{
            margin: "0 0 12px",
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(254,170,109,0.12)",
            border: "1px solid #FEAA6D",
            fontSize: 12,
            color: "var(--text)"
          }}
        >
          <strong>Tier restriction.</strong> Accounts marked 🔒 are Admins or Super Users —
          only Super Users can change their role, reset their password, or deactivate them.
          You'll see a lock icon on those rows.
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#005B61",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            zIndex: 100
          }}
        >
          {toast}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
            <tr>
              {["Name", "Email", "Role", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isSelf = r.email === currentUserEmail;
              const locked = !viewerIsSuper && (r.isSuperUser || r.role?.name === "Admin");
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)", opacity: r.isActive ? 1 : 0.55 }}>
                  <td style={{ padding: "8px 10px" }}>
                    <strong>{r.firstName} {r.lastName}</strong>
                    {r.isSuperUser ? (
                      <span style={{ marginLeft: 6, padding: "1px 6px", background: "#FEAA6D", color: "#000", borderRadius: 999, fontSize: 10, fontWeight: 700 }}>SU</span>
                    ) : null}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>{r.email}</td>
                  <td style={{ padding: "8px 10px" }}>{r.role?.name ?? "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ padding: "1px 8px", borderRadius: 999, background: r.isActive ? "#005B61" : "#9CA3AF", color: "#fff", fontSize: 11, fontWeight: 600 }}>
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    {locked ? (
                      <span
                        title="Admins and Super Users can only be modified by a Super User"
                        aria-label="Locked — manageable only by a Super User"
                        style={{ color: "var(--text-muted)", fontSize: 12 }}
                      >
                        🔒
                      </span>
                    ) : (
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => setEditing(r)}>Edit</button>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          disabled={isSelf || !r.isActive}
                          title={
                            isSelf
                              ? "Use the standard reset flow for your own account"
                              : !r.isActive
                                ? "Reactivate the user before resetting their password"
                                : undefined
                          }
                          onClick={() => setResetting(r)}
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          disabled={isSelf}
                          title={isSelf ? "Cannot deactivate your own account" : undefined}
                          onClick={() => void toggleActive(r)}
                        >
                          {r.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {addOpen ? (
        <UserFormModal
          mode="create"
          roles={availableRoles}
          onClose={() => setAddOpen(false)}
          onSaved={async () => {
            setAddOpen(false);
            await load();
            showToast("User created");
          }}
        />
      ) : null}
      {editing ? (
        <UserFormModal
          mode="edit"
          user={editing}
          roles={availableRoles}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
            showToast("User updated");
          }}
        />
      ) : null}
      {resetting ? (
        <ResetPasswordConfirmModal
          user={resetting}
          onClose={() => setResetting(null)}
          onSuccess={(temporaryPassword) => {
            const user = resetting;
            setResetting(null);
            setResetResult({ user, temporaryPassword });
          }}
          onError={(message) => {
            setResetting(null);
            setError(message);
            showToast("Reset failed");
          }}
        />
      ) : null}
      {resetResult ? (
        <ResetPasswordResultModal
          user={resetResult.user}
          temporaryPassword={resetResult.temporaryPassword}
          onClose={() => setResetResult(null)}
          onCopied={() => showToast("Copied to clipboard")}
        />
      ) : null}
    </section>
  );
}

function UserFormModal({
  mode,
  user,
  roles,
  onClose,
  onSaved
}: {
  mode: "create" | "edit";
  user?: Row;
  roles: Role[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { authFetch } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [roleId, setRoleId] = useState(user?.role?.id ?? roles[0]?.id ?? "");
  const [temporaryPassword, setTempPassword] = useState("");
  const [forcePasswordReset, setForceReset] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch(mode === "create" ? "/admin/users" : `/admin/users/${user!.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        body: JSON.stringify(
          mode === "create"
            ? { firstName, lastName, email, roleId, temporaryPassword, forcePasswordReset }
            : { firstName, lastName, email, roleId }
        )
      });
      if (!response.ok) throw new Error(await response.text());
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CenteredModal
      title={mode === "create" ? "Add user" : `Edit ${user?.firstName} ${user?.lastName}`}
      onClose={onClose}
      busy={saving}
      maxWidth={460}
      footer={
        <>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </button>
        </>
      }
    >
      <label className="estimate-editor__field">
        <span>First name</span>
        <input className="s7-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
      </label>
      <label className="estimate-editor__field">
        <span>Last name</span>
        <input className="s7-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </label>
      <label className="estimate-editor__field">
        <span>Email</span>
        <input className="s7-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="estimate-editor__field">
        <span>Role</span>
        <select className="s7-input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      {mode === "create" ? (
        <>
          <label className="estimate-editor__field">
            <span>Temporary password (min 8 chars)</span>
            <input className="s7-input" type="text" value={temporaryPassword} onChange={(e) => setTempPassword(e.target.value)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={forcePasswordReset} onChange={(e) => setForceReset(e.target.checked)} />
            Force password reset on first login
          </label>
        </>
      ) : null}
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
    </CenteredModal>
  );
}

function ResetPasswordConfirmModal({
  user,
  onClose,
  onSuccess,
  onError
}: {
  user: Row;
  onClose: () => void;
  onSuccess: (temporaryPassword: string) => void;
  onError: (message: string) => void;
}) {
  const { authFetch } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const result = await performAdminResetPassword(authFetch, user.id);
      onSuccess(result.temporaryPassword);
    } catch (err) {
      const message =
        err instanceof ResetPasswordError ? err.message : (err as Error).message;
      onError(message || "Reset failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CenteredModal
      title={`Reset password for ${user.firstName} ${user.lastName}?`}
      onClose={onClose}
      busy={submitting}
      maxWidth={460}
      dataTestId="reset-password-confirm"
      footer={
        <>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void confirm()}
            disabled={submitting}
          >
            {submitting ? "Resetting…" : "Reset password"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
        We'll generate a temporary password for <strong>{user.email}</strong>. Share it with
        them through a secure channel — they'll be prompted to change it the next time they
        sign in.
      </p>
    </CenteredModal>
  );
}

function ResetPasswordResultModal({
  user,
  temporaryPassword,
  onClose,
  onCopied
}: {
  user: Row;
  temporaryPassword: string;
  onClose: () => void;
  onCopied: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(temporaryPassword);
    if (ok) {
      setCopyState("copied");
      onCopied();
    } else {
      setCopyState("failed");
    }
  };

  return (
    <CenteredModal
      title={`Temporary password for ${user.firstName} ${user.lastName}`}
      onClose={onClose}
      maxWidth={460}
      dataTestId="reset-password-result"
      footer={
        <>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={() => void handleCopy()}>
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy to clipboard"}
          </button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
        Share this password with <strong>{user.email}</strong> through a secure channel. They'll
        be prompted to change it the next time they sign in. The password is shown once — you
        can't retrieve it later.
      </p>
      <pre
        data-testid="reset-password-result-value"
        style={{
          marginTop: 16,
          marginBottom: 0,
          padding: "10px 12px",
          background: "var(--surface-muted, #F6F6F6)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 6,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 14,
          userSelect: "all",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all"
        }}
      >
        {temporaryPassword}
      </pre>
    </CenteredModal>
  );
}
