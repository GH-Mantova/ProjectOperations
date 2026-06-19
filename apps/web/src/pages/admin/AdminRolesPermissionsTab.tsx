import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  buildMatrixRoles,
  groupPermissionsByModule,
  permissionCount,
  roleHasPermission,
  unwrapRoles,
  type MatrixPermission,
  type MatrixRole,
  type RoleListResponse
} from "./roleMatrix";

/**
 * Read-only role → permission matrix.
 *
 * Loads /roles (each role carries its permissions) and /permissions
 * (the canonical list), then renders a grid: permissions grouped by
 * module on the y-axis, roles on the x-axis, ✓ where granted.
 *
 * Per-user permission overrides are not in scope for v1 — the Prisma
 * schema has no UserPermission model, so granting permissions outside
 * of role assignment is tracked as a follow-up.
 */
export function AdminRolesPermissionsTab() {
  const { authFetch } = useAuth();
  const [roles, setRoles] = useState<MatrixRole[]>([]);
  const [permissions, setPermissions] = useState<MatrixPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <p style={{ color: "var(--text-muted)", marginTop: 6, fontSize: 13 }}>
        Read-only view of which permission codes each role grants. Edit role membership from the
        Users tab; per-user permission overrides are not yet supported.
      </p>

      <div style={{ overflowX: "auto", marginTop: 12, borderTop: "1px solid var(--border, #e5e7eb)" }}>
        <table
          data-testid="roles-permissions-matrix"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}
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
                  minWidth: 240
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
                    minWidth: 88
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
              <ModuleRows key={g.module} module={g.module} permissions={g.permissions} roles={roles} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ModuleRows({
  module,
  permissions,
  roles
}: {
  module: string;
  permissions: MatrixPermission[];
  roles: MatrixRole[];
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
          {module}
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
            <div>
              <code style={{ fontSize: 12 }}>{p.code}</code>
            </div>
            {p.description ? (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.description}</div>
            ) : null}
          </th>
          {roles.map((r) => {
            const has = roleHasPermission(r, p.id);
            return (
              <td
                key={r.id}
                style={{ padding: "8px 12px", textAlign: "center" }}
                aria-label={has ? `${r.name} grants ${p.code}` : `${r.name} does not grant ${p.code}`}
              >
                {has ? (
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
