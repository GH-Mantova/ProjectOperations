/**
 * Pure helpers for the admin role → permission matrix view.
 *
 * Kept free of React / network code so they can be unit-tested without a
 * DOM or HTTP mock. The matrix is built from the existing /roles (each
 * role carries a `permissions` array) and /permissions endpoints — no
 * new API surface is required.
 */

export type MatrixPermission = {
  id: string;
  code: string;
  description: string | null;
  module: string;
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
  for (const p of permissions) {
    const key = p.module || "other";
    const list = groups.get(key);
    if (list) list.push(p);
    else groups.set(key, [p]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, perms]) => ({ module, permissions: perms }));
}

/** True when the given role grants the given permission. */
export function roleHasPermission(role: MatrixRole, permissionId: string): boolean {
  return role.permissionIds.has(permissionId);
}

/** Count of permissions granted by a role, for the role-column header. */
export function permissionCount(role: MatrixRole): number {
  return role.permissionIds.size;
}
