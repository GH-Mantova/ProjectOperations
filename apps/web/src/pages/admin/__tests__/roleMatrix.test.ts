/**
 * Pure-logic specs for the role → permission matrix helpers.
 *
 * The matrix view itself is exercised manually via the smoke checklist
 * in the PR body — these specs cover the data shaping the component
 * relies on (paginated vs flat /roles response, permission grouping,
 * and the granted/not-granted predicate).
 */
import { describe, expect, it } from "vitest";
import {
  buildMatrixRoles,
  groupPermissionsByModule,
  permissionCount,
  roleHasPermission,
  unwrapRoles,
  type MatrixPermission,
  type RoleListRow
} from "../roleMatrix";

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
        rolePermissions: [
          { permissionId: "p1" },
          { permission: { id: "p2" } }
        ]
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
    { id: "p1", code: "users.view", description: null, module: "users" },
    { id: "p2", code: "users.create", description: null, module: "users" },
    { id: "p3", code: "roles.view", description: null, module: "roles" },
    { id: "p4", code: "ad-hoc", description: null, module: "" }
  ];

  it("groups by module name and returns sorted groups", () => {
    const groups = groupPermissionsByModule(perms);
    expect(groups.map((g) => g.module)).toEqual(["other", "roles", "users"]);
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
