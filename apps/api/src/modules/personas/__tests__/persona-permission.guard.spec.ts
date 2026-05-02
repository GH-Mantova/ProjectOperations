import { ExecutionContext, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PersonaPermissionGuard } from "../persona-permission.guard";
import { getPersonaBySlug } from "../persona-registry";

type AuthLike = { sub?: string; permissions?: string[]; isSuperUser?: boolean } | undefined;

function buildContext(slug: string | undefined, user: AuthLike): ExecutionContext {
  const request = {
    params: slug === undefined ? {} : { slug },
    user
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => ({})
    })
  } as unknown as ExecutionContext;
}

describe("PersonaPermissionGuard", () => {
  const guard = new PersonaPermissionGuard();

  it("allows when user has the matching permission for the persona", () => {
    const ctx = buildContext("tendering", {
      sub: "user-1",
      permissions: ["ai.persona.tendering"]
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows Super User regardless of granted permissions", () => {
    const ctx = buildContext("tendering", {
      sub: "user-sean",
      permissions: [],
      isSuperUser: true
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("denies (403) when user lacks the matching permission", () => {
    const ctx = buildContext("tendering", {
      sub: "user-amy",
      permissions: ["finance.view"]
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("denies (403) when user has permissions but not the one this persona requires", () => {
    // Critical anti-regression: user with a *different* persona's permission
    // must NOT be allowed to access this persona's slug.
    const ctx = buildContext("tendering", {
      sub: "user-x",
      permissions: ["ai.persona.dashboard"]
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("returns 404 when the slug does not match any registered persona", () => {
    const ctx = buildContext("nonexistent", {
      sub: "user-1",
      permissions: ["ai.persona.tendering"]
    });
    expect(() => guard.canActivate(ctx)).toThrow(NotFoundException);
  });

  it("returns 404 (not 403) for an unknown slug even when user is Super User — no existence leak via auth path", () => {
    const ctx = buildContext("nonexistent", {
      sub: "user-sean",
      isSuperUser: true
    });
    expect(() => guard.canActivate(ctx)).toThrow(NotFoundException);
  });

  it("returns 404 when the slug param is missing from the route", () => {
    const ctx = buildContext(undefined, {
      sub: "user-1",
      permissions: ["ai.persona.tendering"]
    });
    expect(() => guard.canActivate(ctx)).toThrow(NotFoundException);
  });

  it("denies when there is no authenticated user on the request", () => {
    const ctx = buildContext("tendering", undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("reads the required permission from the persona definition (not hard-coded)", () => {
    // Documents the design intent: the guard's behaviour is sourced from
    // PersonaDefinition.permissionRequired. Verified above by passing slugs
    // and observing that the guard rejects users with permissions for *other*
    // personas — but here we assert the registry value directly so a future
    // rename of the permission code can't silently break the guard contract
    // while the test passes only via stale hard-coding.
    const tendering = getPersonaBySlug("tendering");
    expect(tendering?.permissionRequired).toBe("ai.persona.tendering");

    const ctx = buildContext("tendering", {
      sub: "user-1",
      permissions: [tendering!.permissionRequired]
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
