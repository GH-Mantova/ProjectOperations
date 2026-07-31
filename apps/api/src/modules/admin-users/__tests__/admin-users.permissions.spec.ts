/**
 * Declared-permission spec for AdminUsersController.
 *
 * Verifies each mutating endpoint carries a `@RequirePermissions(...)` gate
 * (fail-closed at the guard, before the service tier check). The service-side
 * `tierOf()` check remains as defence-in-depth and is covered by the
 * integration spec next to this file.
 */
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS_KEY } from "../../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { AdminUsersController } from "../admin-users.controller";

function contextFor(handler: Function, user?: { isSuperUser?: boolean; permissions?: string[] }) {
  const request = { user };
  return {
    getHandler: () => handler,
    getClass: () => AdminUsersController,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({})
    })
  } as unknown as ExecutionContext;
}

describe("AdminUsersController — declared permission gates", () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  const proto = AdminUsersController.prototype;

  const endpoints: Array<{ name: string; handler: Function; permission: string }> = [
    { name: "GET /admin/users", handler: proto.list, permission: "users.view" },
    { name: "POST /admin/users", handler: proto.create, permission: "users.create" },
    { name: "PATCH /admin/users/:userId", handler: proto.update, permission: "users.update" },
    { name: "DELETE /admin/users/:userId", handler: proto.deactivate, permission: "users.update" },
    { name: "POST /admin/users/:userId/reset-password", handler: proto.resetPassword, permission: "users.update" }
  ];

  describe.each(endpoints)("$name (requires $permission)", ({ handler, permission }) => {
    it("carries the @RequirePermissions decorator with the expected code", () => {
      const declared = reflector.get<string[]>(REQUIRED_PERMISSIONS_KEY, handler);
      expect(declared).toEqual([permission]);
    });

    it("rejects a caller missing the required permission with 403", () => {
      const ctx = contextFor(handler, { isSuperUser: false, permissions: [] });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("admits a caller holding the required permission", () => {
      const ctx = contextFor(handler, { isSuperUser: false, permissions: [permission] });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("admits a super user regardless of granted permissions", () => {
      const ctx = contextFor(handler, { isSuperUser: true, permissions: [] });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
