import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  buildMatrixRoles,
  diffPending,
  effectiveHasPermission,
  groupPermissionsByModule,
  pendingKey,
  permissionCount,
  togglePending,
  unwrapRoles,
  type MatrixPermission,
  type MatrixRole,
  type PendingChanges,
  type RoleListResponse
} from "./roleMatrix";

/**
 * Role → permission matrix, editable by super-users.
 *
 * Loads /roles + /permissions, renders permissions grouped by module on
 * the y-axis and roles on the x-axis. Super-users can tick / untick cells
 * — changes batch until Save. Per-row grants and revokes are POSTed and
 * DELETEd against the additive server endpoints, so a single tick does
 * not require rewriting the whole role.
 *
 * Non-super-users see the matrix read-only with a banner explaining why.
 * The server also enforces super-user-only on the write endpoints — the
 * disabled UI is UX, not access control.
 */
export function AdminRolesPermissionsTab() {
  const { authFetch, user } = useAuth();
  const isSuperUser = Boolean(user?.isSuperUser);

  const [roles, setRoles] = useState<MatrixRole[]>([]);
  const [permissions, setPermissions] = useState<MatrixPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChanges>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        authFetch("/roles?page=1&pageSize=100"),
        authFetch("/permissions")
      ]);
      if (!rolesRes.ok) throw new Error(await rolesRes.text());
      if (!permsRes.ok) throw new Error(await permsRes.text());
      const rolesBody = (await rolesRes.json()) as RoleListResponse;
      const permsBody = (await permsRes.json()) as MatrixPermission[];
      setRoles(buildMatrixRoles(unwrapRoles(rolesBody)));
      setPermissions(permsBody);
      setPending(new Map());
      setSaveError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupPermissionsByModule(permissions), [permissions]);
  const permissionById = useMemo(
    () => new Map(permissions.map((p) => [p.id, p])),
    [permissions]
  );
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const pendingCount = pending.size;

  const handleToggle = useCallback(
    (role: MatrixRole, permission: MatrixPermission) => {
      if (!isSuperUser || saving) return;

      const currentlyGranted = effectiveHasPermission(role, permission.id, pending);
      const willGrant = !currentlyGranted;

      // Require an explicit confirm before staging a grant for a high-risk
      // permission. Revokes don't confirm — reducing access is the safe
      // direction and delay would frustrate the escalation path.
      if (willGrant && permission.isHighRisk) {
        const ok = window.confirm(
          `"${permission.label || permission.code}" is a high-risk permission (${permission.description ?? permission.code}).\n\n` +
            `Grant it to "${role.name}"?`
        );
        if (!ok) return;
      }

      setPending((prev) => togglePending(prev, role, permission.id));
      setSaveNotice(null);
      setSaveError(null);
    },
    [isSuperUser, pending, saving]
  );

  const handleDiscard = useCallback(() => {
    setPending(new Map());
    setSaveError(null);
    setSaveNotice(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (pending.size === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);

    const { toGrant, toRevoke } = diffPending(pending);
    const errors: string[] = [];
    const applied = new Set<string>();

    // Serial so audit log ordering + guardrail evaluation are deterministic.
    for (const change of toGrant) {
      const res = await authFetch(
        `/roles/${encodeURIComponent(change.roleId)}/permissions/${encodeURIComponent(change.permissionId)}`,
        { method: "PUT" }
      );
      if (res.ok) {
        applied.add(pendingKey(change.roleId, change.permissionId));
      } else {
        const body = await res.text();
        const perm = permissionById.get(change.permissionId);
        const role = roleById.get(change.roleId);
        errors.push(`Grant ${role?.name ?? change.roleId} → ${perm?.code ?? change.permissionId}: ${body}`);
      }
    }
    for (const change of toRevoke) {
      const res = await authFetch(
        `/roles/${encodeURIComponent(change.roleId)}/permissions/${encodeURIComponent(change.permissionId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        applied.add(pendingKey(change.roleId, change.permissionId));
      } else {
        const body = await res.text();
        const perm = permissionById.get(change.permissionId);
        const role = roleById.get(change.roleId);
        errors.push(`Revoke ${role?.name ?? change.roleId} → ${perm?.code ?? change.permissionId}: ${body}`);
      }
    }

    setSaving(false);

    // Reload to pick up authoritative server state; keep any pending changes
    // that failed to apply so the user can see what still needs attention.
    const remainingPending: PendingChanges = new Map();
    for (const [key, target] of pending.entries()) {
      if (!applied.has(key)) remainingPending.set(key, target);
    }
    setPending(remainingPending);

    if (errors.length > 0) {
      setSaveError(errors.join(" · "));
    } else {
      setSaveNotice(`Saved ${applied.size} change${applied.size === 1 ? "" : "s"}.`);
    }
    await load();
  }, [pending, saving, authFetch, load, permissionById, roleById]);

  if (loading) {
    return (
      <section className="s7-card" data-testid="roles-permissions-loading">
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Roles &amp; permissions</h2>
        <MatrixSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className="s7-card">
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Roles &amp; permissions</h2>
        <p style={{ color: "var(--status-danger)" }}>{error}</p>
        <button type="button" className="s7-btn s7-btn--ghost" onClick={() => void load()}>Retry</button>
      </section>
    );
  }

  if (roles.length === 0 || permissions.length === 0) {
    return (
      <section className="s7-card">
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Roles &amp; permissions</h2>
        <EmptyState />
      </section>
    );
  }

  return (
    <section className="s7-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Roles &amp; permissions</h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {roles.length} roles · {permissions.length} permissions
        </span>
      </div>
      {isSuperUser ? (
        <p style={{ color: "var(--text-muted)", marginTop: 6, fontSize: 13 }}>
          Tick a cell to grant, untick to revoke. Changes are staged locally until you Save. Each
          change writes an audit entry. High-risk permissions (marked with ⚠) require confirmation
          before granting.
        </p>
      ) : (
        <p
          data-testid="matrix-readonly-banner"
          style={{
            color: "var(--text-muted)",
            marginTop: 6,
            padding: "8px 12px",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 4,
            fontSize: 13
          }}
        >
          Read-only. Only a super-user can edit the role-permission matrix. The API rejects direct
          grant/revoke calls from non-super-users, so this restriction is enforced server-side.
        </p>
      )}

      {isSuperUser ? (
        <SaveBar
          pendingCount={pendingCount}
          saving={saving}
          onSave={() => void handleSave()}
          onDiscard={handleDiscard}
          error={saveError}
          notice={saveNotice}
        />
      ) : null}

      <div style={{ overflowX: "auto", marginTop: 12, borderTop: "1px solid var(--border, #e5e7eb)" }}>
        <table
          data-testid="roles-permissions-matrix"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}
        >
          <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
            <tr>
              <th
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  position: "sticky",
                  left: 0,
                  background: "var(--surface-muted, #F6F6F6)",
                  minWidth: 280
                }}
              >
                Permission
              </th>
              {roles.map((r) => (
                <th
                  key={r.id}
                  scope="col"
                  style={{
                    padding: "10px 12px",
                    textAlign: "center",
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    minWidth: 96
                  }}
                  title={r.description ?? r.name}
                >
                  {r.name}
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>
                    {permissionCount(r)} perms{r.isSystem ? " · system" : ""}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <ModuleRows
                key={g.module}
                moduleLabel={g.moduleLabel}
                permissions={g.permissions}
                roles={roles}
                pending={pending}
                isSuperUser={isSuperUser}
                saving={saving}
                onToggle={handleToggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SaveBar({
  pendingCount,
  saving,
  onSave,
  onDiscard,
  error,
  notice
}: {
  pendingCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  error: string | null;
  notice: string | null;
}) {
  const hasPending = pendingCount > 0;
  return (
    <div
      data-testid="matrix-save-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
        padding: "8px 12px",
        borderRadius: 4,
        border: "1px solid var(--border, #e5e7eb)",
        background: hasPending ? "rgba(255, 200, 0, 0.06)" : "transparent",
        fontSize: 13
      }}
    >
      <span style={{ flex: 1 }}>
        {hasPending
          ? `${pendingCount} unsaved change${pendingCount === 1 ? "" : "s"}`
          : notice ?? "No changes"}
        {error ? (
          <span style={{ color: "var(--status-danger)", display: "block", marginTop: 4 }}>
            {error}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        className="s7-btn s7-btn--ghost"
        onClick={onDiscard}
        disabled={!hasPending || saving}
        data-testid="matrix-discard"
      >
        Discard
      </button>
      <button
        type="button"
        className="s7-btn s7-btn--primary"
        onClick={onSave}
        disabled={!hasPending || saving}
        data-testid="matrix-save"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function ModuleRows({
  moduleLabel,
  permissions,
  roles,
  pending,
  isSuperUser,
  saving,
  onToggle
}: {
  moduleLabel: string;
  permissions: MatrixPermission[];
  roles: MatrixRole[];
  pending: PendingChanges;
  isSuperUser: boolean;
  saving: boolean;
  onToggle: (role: MatrixRole, permission: MatrixPermission) => void;
}) {
  return (
    <>
      <tr style={{ background: "rgba(0,91,97,0.04)" }}>
        <th
          colSpan={roles.length + 1}
          scope="colgroup"
          style={{
            padding: "8px 12px",
            textAlign: "left",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--brand-primary, #005B61)",
            textTransform: "uppercase",
            letterSpacing: 0.4,
            position: "sticky",
            left: 0
          }}
        >
          {moduleLabel}
        </th>
      </tr>
      {permissions.map((p) => (
        <tr key={p.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
          <th
            scope="row"
            style={{
              padding: "8px 12px",
              textAlign: "left",
              fontWeight: 500,
              position: "sticky",
              left: 0,
              background: "var(--surface-card, #fff)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>{p.label || p.code}</span>
              {p.isHighRisk ? (
                <span
                  title="High-risk permission — grants an override or elevated write. Confirm required before granting."
                  aria-label="high risk"
                  style={{ color: "var(--status-danger, #B4231C)", fontSize: 12 }}
                >
                  ⚠
                </span>
              ) : null}
            </div>
            {p.description ? (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.description}</div>
            ) : null}
            <div style={{ marginTop: 4 }}>
              <code
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  background: "var(--surface-muted, #F6F6F6)",
                  borderRadius: 3,
                  color: "var(--text-muted)"
                }}
              >
                {p.code}
              </code>
            </div>
          </th>
          {roles.map((r) => {
            const has = effectiveHasPermission(r, p.id, pending);
            const baseHas = r.permissionIds.has(p.id);
            const isPending = has !== baseHas;
            return (
              <td
                key={r.id}
                style={{ padding: "8px 12px", textAlign: "center" }}
                aria-label={has ? `${r.name} grants ${p.code}` : `${r.name} does not grant ${p.code}`}
              >
                {isSuperUser ? (
                  <label
                    style={{
                      display: "inline-flex",
                      cursor: saving ? "wait" : "pointer",
                      padding: 4,
                      borderRadius: 3,
                      background: isPending ? "rgba(255, 200, 0, 0.16)" : "transparent"
                    }}
                    title={isPending ? "Unsaved change" : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={has}
                      disabled={saving}
                      onChange={() => onToggle(r, p)}
                      aria-label={`${has ? "Revoke" : "Grant"} ${p.code} for ${r.name}`}
                      data-testid={`matrix-cell-${r.id}-${p.id}`}
                    />
                  </label>
                ) : has ? (
                  <span style={{ color: "var(--brand-primary, #005B61)", fontWeight: 700 }} aria-hidden>
                    ✓
                  </span>
                ) : (
                  <span style={{ color: "var(--border, #e5e7eb)" }} aria-hidden>
                    ·
                  </span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function MatrixSkeleton() {
  return (
    <div role="status" aria-label="Loading role and permission matrix" style={{ marginTop: 12 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            height: 28,
            background: "var(--surface-muted, #F6F6F6)",
            borderRadius: 4,
            marginBottom: 8,
            opacity: 0.6
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: "32px 12px", textAlign: "center", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>
        🛡️
      </div>
      <p style={{ margin: 0, fontWeight: 600, color: "var(--text)" }}>No roles or permissions loaded</p>
      <p style={{ margin: "4px 0 0", fontSize: 12 }}>
        Run the seed to populate the canonical role and permission set, then reload this tab.
      </p>
    </div>
  );
}
