/**
 * Pure helpers for the admin role → permission matrix view.
 *
 * Kept free of React / network code so they can be unit-tested without a
 * DOM or HTTP mock. The matrix is built from the existing /roles (each
 * role carries a `permissions` array) and /permissions endpoints.
 *
 * Editable variant (2026-07-13): pending changes are tracked as a set of
 * `${roleId}::${permissionId}` keys with a target state, so a single Save
 * can apply per-row grants and revokes against the additive/subtractive
 * server endpoints.
 */

export type MatrixPermission = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  module: string;
  moduleLabel?: string;
  isHighRisk?: boolean;
};

export type MatrixRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionIds: Set<string>;
};

export type MatrixModuleGroup = {
  module: string;
  moduleLabel: string;
  permissions: MatrixPermission[];
};

export type RoleListResponse =
  | { items: RoleListRow[]; total?: number; page?: number; pageSize?: number }
  | RoleListRow[];

export type RoleListRow = {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  permissions?: { id: string }[];
  rolePermissions?: { permissionId?: string; permission?: { id: string } }[];
};

/** `roleId::permissionId` → target state (true = grant, false = revoke). */
export type PendingChanges = Map<string, boolean>;

/** Extract roles regardless of paginated vs flat-array response. */
export function unwrapRoles(body: RoleListResponse): RoleListRow[] {
  return Array.isArray(body) ? body : body.items ?? [];
}

/** Build the matrix `MatrixRole[]` from the /roles list response. */
export function buildMatrixRoles(rows: RoleListRow[]): MatrixRole[] {
  return rows.map((r) => {
    const ids = new Set<string>();
    if (r.permissions) {
      for (const p of r.permissions) ids.add(p.id);
    }
    if (r.rolePermissions) {
      for (const rp of r.rolePermissions) {
        const pid = rp.permissionId ?? rp.permission?.id;
        if (pid) ids.add(pid);
      }
    }
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      isSystem: r.isSystem ?? false,
      permissionIds: ids
    };
  });
}

/** Group permissions by `module`, preserving the input order within each group. */
export function groupPermissionsByModule(permissions: MatrixPermission[]): MatrixModuleGroup[] {
  const groups = new Map<string, MatrixPermission[]>();
  const labels = new Map<string, string>();
  for (const p of permissions) {
    const key = p.module || "other";
    labels.set(key, p.moduleLabel ?? labels.get(key) ?? key);
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b))
    .map(([module, perms]) => ({ module, moduleLabel: labels.get(module) ?? module, permissions: perms }));
}

/** Compose base state + pending changes into the effective granted state. */
export function effectiveHasPermission(
  role: MatrixRole,
  permissionId: string,
  pending: PendingChanges
): boolean {
  const key = pendingKey(role.id, permissionId);
  if (pending.has(key)) return pending.get(key)!;
  return role.permissionIds.has(permissionId);
}

/** True when the given role grants the given permission (base state, no pending). */
export function roleHasPermission(role: MatrixRole, permissionId: string): boolean {
  return role.permissionIds.has(permissionId);
}

/** Count of permissions granted by a role (base state), for the role-column header. */
export function permissionCount(role: MatrixRole): number {
  return role.permissionIds.size;
}

export function pendingKey(roleId: string, permissionId: string): string {
  return `${roleId}::${permissionId}`;
}

/**
 * Apply a click to the pending-changes map.
 *
 * If toggling would return to the base state, remove the key entirely so
 * the "unsaved changes" indicator honestly reflects that nothing is
 * different anymore.
 */
export function togglePending(
  pending: PendingChanges,
  role: MatrixRole,
  permissionId: string
): PendingChanges {
  const next = new Map(pending);
  const key = pendingKey(role.id, permissionId);
  const current = next.has(key) ? next.get(key)! : role.permissionIds.has(permissionId);
  const target = !current;
  const baseGranted = role.permissionIds.has(permissionId);
  if (target === baseGranted) {
    next.delete(key);
  } else {
    next.set(key, target);
  }
  return next;
}

export type PendingDiff = {
  toGrant: Array<{ roleId: string; permissionId: string }>;
  toRevoke: Array<{ roleId: string; permissionId: string }>;
};

/** Split pending changes into grant / revoke lists for the API. */
export function diffPending(pending: PendingChanges): PendingDiff {
  const toGrant: PendingDiff["toGrant"] = [];
  const toRevoke: PendingDiff["toRevoke"] = [];
  for (const [key, target] of pending.entries()) {
    const [roleId, permissionId] = key.split("::");
    if (target) toGrant.push({ roleId, permissionId });
    else toRevoke.push({ roleId, permissionId });
  }
  return { toGrant, toRevoke };
}
