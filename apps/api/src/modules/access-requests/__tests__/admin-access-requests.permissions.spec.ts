/**
 * Declared-permission spec for AdminAccessRequestsController.
 *
 * Verifies each mutating endpoint carries a `@RequirePermissions(...)` gate
 * (fail-closed at the guard, before the service tier check). The service-side
 * tier check remains as defence-in-depth.
 */
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS_KEY } from "../../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { AdminAccessRequestsController } from "../admin-access-requests.controller";

function contextFor(handler: Function, user?: { isSuperUser?: boolean; permissions?: string[] }) {
  const request = { user };
  return {
    getHandler: () => handler,
    getClass: () => AdminAccessRequestsController,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({})
    })
  } as unknown as ExecutionContext;
}

describe("AdminAccessRequestsController — declared permission gates", () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  const proto = AdminAccessRequestsController.prototype;

  const endpoints: Array<{ name: string; handler: Function; permission: string }> = [
    { name: "GET /admin/access-requests", handler: proto.list, permission: "users.view" },
    { name: "POST /admin/access-requests/:id/approve", handler: proto.approve, permission: "users.create" },
    { name: "POST /admin/access-requests/:id/deny", handler: proto.deny, permission: "users.create" }
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
