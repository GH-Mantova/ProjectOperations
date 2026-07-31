/**
 * Declared-permission spec for GlobalListsController.
 *
 * Verifies each mutating endpoint (create list, add item, update item,
 * archive item, reorder) carries a `@RequirePermissions("masterdata.manage")`
 * gate — the primary fail-closed check that runs before the service-side
 * `assertEditable` creator/admin check (which remains as defence-in-depth).
 */
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS_KEY } from "../../../common/auth/permissions.decorator";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { GlobalListsController } from "../global-lists.controller";

function contextFor(handler: Function, user?: { isSuperUser?: boolean; permissions?: string[] }) {
  const request = { user };
  return {
    getHandler: () => handler,
    getClass: () => GlobalListsController,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({})
    })
  } as unknown as ExecutionContext;
}

describe("GlobalListsController — declared permission gates", () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  const proto = GlobalListsController.prototype;
  const REQUIRED = "masterdata.manage";

  const endpoints: Array<{ name: string; handler: Function }> = [
    { name: "POST /lists", handler: proto.create },
    { name: "POST /lists/:slug/items", handler: proto.createItem },
    { name: "PATCH /lists/:slug/items/:itemId", handler: proto.updateItem },
    { name: "DELETE /lists/:slug/items/:itemId", handler: proto.archiveItem },
    { name: "POST /lists/:slug/items/reorder", handler: proto.reorder }
  ];

  describe.each(endpoints)("$name", ({ handler }) => {
    it(`carries @RequirePermissions("${REQUIRED}")`, () => {
      const declared = reflector.get<string[]>(REQUIRED_PERMISSIONS_KEY, handler);
      expect(declared).toEqual([REQUIRED]);
    });

    it("rejects a caller missing masterdata.manage with 403", () => {
      const ctx = contextFor(handler, { isSuperUser: false, permissions: [] });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("rejects a caller with only .view permissions (fail-closed)", () => {
      const ctx = contextFor(handler, { isSuperUser: false, permissions: ["masterdata.view"] });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("admits a caller holding masterdata.manage", () => {
      const ctx = contextFor(handler, { isSuperUser: false, permissions: [REQUIRED] });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it("admits a super user regardless of granted permissions", () => {
      const ctx = contextFor(handler, { isSuperUser: true, permissions: [] });
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
