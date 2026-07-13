/**
 * Pure-logic specs for the role → permission matrix helpers.
 *
 * The matrix view itself is exercised manually via the smoke checklist
 * in the PR body — these specs cover the data shaping the component
 * relies on (paginated vs flat /roles response, permission grouping,
 * pending-change composition, and the diff for the save call).
 */
import { describe, expect, it } from "vitest";
import {
  buildMatrixRoles,
  diffPending,
  effectiveHasPermission,
  groupPermissionsByModule,
  pendingKey,
  permissionCount,
  roleHasPermission,
  togglePending,
  unwrapRoles,
  type MatrixPermission,
  type PendingChanges,
  type RoleListRow
} from "../roleMatrix";

function perm(overrides: Partial<MatrixPermission> = {}): MatrixPermission {
  return {
    id: "p1",
    code: "users.view",
    label: "View user accounts",
    description: null,
    module: "users",
    moduleLabel: "Users",
    isHighRisk: false,
    ...overrides
  };
}

describe("unwrapRoles", () => {
  it("returns items[] for a paginated response", () => {
    const rows: RoleListRow[] = [{ id: "r1", name: "Admin" }];
    expect(unwrapRoles({ items: rows, total: 1, page: 1, pageSize: 10 })).toBe(rows);
  });

  it("returns the array verbatim when the API returns a flat list", () => {
    const rows: RoleListRow[] = [{ id: "r1", name: "Admin" }];
    expect(unwrapRoles(rows)).toBe(rows);
  });

  it("falls back to [] when items is missing", () => {
    expect(unwrapRoles({} as never)).toEqual([]);
  });
});

describe("buildMatrixRoles", () => {
  it("reads the flat permissions array (the shape /roles returns today)", () => {
    const [role] = buildMatrixRoles([
      {
        id: "r1",
        name: "Admin",
        description: "All perms",
        isSystem: true,
        permissions: [{ id: "p1" }, { id: "p2" }]
      }
    ]);
    expect(role!.permissionIds.has("p1")).toBe(true);
    expect(role!.permissionIds.has("p2")).toBe(true);
    expect(role!.permissionIds.has("p3")).toBe(false);
    expect(role!.isSystem).toBe(true);
  });

  it("also reads rolePermissions[].permission.id when present (raw Prisma shape)", () => {
    const [role] = buildMatrixRoles([
      {
        id: "r1",
        name: "Planner",
        rolePermissions: [{ permissionId: "p1" }, { permission: { id: "p2" } }]
      }
    ]);
    expect(role!.permissionIds.has("p1")).toBe(true);
    expect(role!.permissionIds.has("p2")).toBe(true);
  });

  it("defaults isSystem to false and description to null when omitted", () => {
    const [role] = buildMatrixRoles([{ id: "r1", name: "Custom" }]);
    expect(role!.isSystem).toBe(false);
    expect(role!.description).toBeNull();
    expect(role!.permissionIds.size).toBe(0);
  });
});

describe("groupPermissionsByModule", () => {
  const perms: MatrixPermission[] = [
    perm({ id: "p1", code: "users.view", module: "users", moduleLabel: "Users" }),
    perm({ id: "p2", code: "users.create", module: "users", moduleLabel: "Users" }),
    perm({ id: "p3", code: "roles.view", module: "roles", moduleLabel: "Roles" }),
    perm({ id: "p4", code: "ad-hoc", module: "", moduleLabel: undefined })
  ];

  it("groups by module name and sorts by module label", () => {
    const groups = groupPermissionsByModule(perms);
    expect(groups.map((g) => g.module)).toEqual(["other", "roles", "users"]);
  });

  it("exposes the display label for each group", () => {
    const groups = groupPermissionsByModule(perms);
    expect(groups.find((g) => g.module === "users")?.moduleLabel).toBe("Users");
  });

  it("preserves the input order within each group", () => {
    const groups = groupPermissionsByModule(perms);
    const users = groups.find((g) => g.module === "users");
    expect(users?.permissions.map((p) => p.code)).toEqual(["users.view", "users.create"]);
  });

  it("falls back to 'other' for permissions with an empty module string", () => {
    const groups = groupPermissionsByModule(perms);
    expect(groups.find((g) => g.module === "other")?.permissions[0]?.code).toBe("ad-hoc");
  });
});

describe("roleHasPermission / permissionCount", () => {
  it("returns true only when the permission id is in the role's set", () => {
    const [role] = buildMatrixRoles([
      { id: "r1", name: "Viewer", permissions: [{ id: "p1" }] }
    ]);
    expect(roleHasPermission(role!, "p1")).toBe(true);
    expect(roleHasPermission(role!, "p2")).toBe(false);
  });

  it("counts granted permissions for the column header", () => {
    const [role] = buildMatrixRoles([
      { id: "r1", name: "Viewer", permissions: [{ id: "p1" }, { id: "p2" }, { id: "p3" }] }
    ]);
    expect(permissionCount(role!)).toBe(3);
  });
});

// ─── Editable-matrix helpers ────────────────────────────────────────────────

describe("togglePending / effectiveHasPermission", () => {
  const [role] = buildMatrixRoles([
    { id: "r1", name: "Estimator", permissions: [{ id: "p1" }] }
  ]);

  it("toggling an ungranted permission stages a grant", () => {
    const pending = togglePending(new Map(), role!, "p2");
    expect(pending.get(pendingKey("r1", "p2"))).toBe(true);
    expect(effectiveHasPermission(role!, "p2", pending)).toBe(true);
  });

  it("toggling a granted permission stages a revoke", () => {
    const pending = togglePending(new Map(), role!, "p1");
    expect(pending.get(pendingKey("r1", "p1"))).toBe(false);
    expect(effectiveHasPermission(role!, "p1", pending)).toBe(false);
  });

  it("toggling back to the base state clears the pending entry (no phantom unsaved change)", () => {
    let pending: PendingChanges = togglePending(new Map(), role!, "p1"); // stage revoke
    pending = togglePending(pending, role!, "p1"); // toggle back to granted
    expect(pending.size).toBe(0);
    expect(effectiveHasPermission(role!, "p1", pending)).toBe(true);
  });

  it("effectiveHasPermission returns pending target when set, otherwise base state", () => {
    const pending: PendingChanges = new Map([[pendingKey("r1", "p2"), true]]);
    expect(effectiveHasPermission(role!, "p1", pending)).toBe(true); // base
    expect(effectiveHasPermission(role!, "p2", pending)).toBe(true); // pending grant
    expect(effectiveHasPermission(role!, "p3", pending)).toBe(false); // neither
  });
});

describe("diffPending", () => {
  it("splits pending changes into grant / revoke lists for the API", () => {
    const pending: PendingChanges = new Map([
      [pendingKey("r1", "p1"), true],
      [pendingKey("r1", "p2"), false],
      [pendingKey("r2", "p3"), true]
    ]);
    const diff = diffPending(pending);
    expect(diff.toGrant).toEqual(
      expect.arrayContaining([
        { roleId: "r1", permissionId: "p1" },
        { roleId: "r2", permissionId: "p3" }
      ])
    );
    expect(diff.toRevoke).toEqual([{ roleId: "r1", permissionId: "p2" }]);
  });

  it("returns empty lists when no changes are pending", () => {
    expect(diffPending(new Map())).toEqual({ toGrant: [], toRevoke: [] });
  });
});
