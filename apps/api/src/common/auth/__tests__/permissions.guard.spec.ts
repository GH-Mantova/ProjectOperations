import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "../permissions.guard";
import { ANY_PERMISSIONS_KEY, REQUIRED_PERMISSIONS_KEY } from "../permissions.decorator";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeReflector(
  required: string[] | undefined,
  any: string[] | undefined
): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === REQUIRED_PERMISSIONS_KEY) return required;
      if (key === ANY_PERMISSIONS_KEY) return any;
      return undefined;
    })
  } as unknown as Reflector;
}

function makeContext(user: {
  permissions?: string[];
  isSuperUser?: boolean;
}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user })
    })
  } as unknown as ExecutionContext;
}

function makeGuard(required: string[] | undefined, any: string[] | undefined): PermissionsGuard {
  return new PermissionsGuard(makeReflector(required, any));
}

// ── no decorators → always allowed ───────────────────────────────────────────

describe("PermissionsGuard — no decorators", () => {
  it("passes when neither decorator is present on a handler", () => {
    const guard = makeGuard(undefined, undefined);
    expect(guard.canActivate(makeContext({ permissions: [] }))).toBe(true);
  });
});

// ── AND (RequirePermissions) — existing behaviour unchanged ──────────────────

describe("PermissionsGuard — AND (RequirePermissions)", () => {
  it("passes when the user holds all required permissions", () => {
    const guard = makeGuard(["crm.view", "reports.view"], undefined);
    expect(guard.canActivate(makeContext({ permissions: ["crm.view", "reports.view"] }))).toBe(true);
  });

  it("throws 403 when the user holds only one of two required permissions", () => {
    const guard = makeGuard(["crm.view", "reports.view"], undefined);
    expect(() =>
      guard.canActivate(makeContext({ permissions: ["crm.view"] }))
    ).toThrow(ForbiddenException);
  });

  it("throws 403 when the user holds none of the required permissions", () => {
    const guard = makeGuard(["crm.view"], undefined);
    expect(() =>
      guard.canActivate(makeContext({ permissions: [] }))
    ).toThrow(ForbiddenException);
  });
});

// ── OR (RequireAnyPermission) ────────────────────────────────────────────────

describe("PermissionsGuard — OR (RequireAnyPermission)", () => {
  it("passes when the user holds the first listed permission", () => {
    const guard = makeGuard(undefined, ["tenders.view", "crm.view"]);
    expect(guard.canActivate(makeContext({ permissions: ["tenders.view"] }))).toBe(true);
  });

  it("passes when the user holds the second listed permission", () => {
    const guard = makeGuard(undefined, ["tenders.view", "crm.view"]);
    expect(guard.canActivate(makeContext({ permissions: ["crm.view"] }))).toBe(true);
  });

  it("throws 403 when the user holds none of the any-permissions", () => {
    const guard = makeGuard(undefined, ["tenders.view", "crm.view"]);
    expect(() =>
      guard.canActivate(makeContext({ permissions: ["reports.view"] }))
    ).toThrow(ForbiddenException);
  });
});

// ── Both decorators: AND + OR must both be satisfied ─────────────────────────

describe("PermissionsGuard — AND + OR combined", () => {
  // If a handler carries BOTH @RequirePermissions and @RequireAnyPermission,
  // ALL of the AND set AND at least one of the ANY set must be satisfied.

  it("passes when user satisfies all AND codes and at least one ANY code", () => {
    const guard = makeGuard(["admin.access"], ["tenders.view", "crm.view"]);
    expect(
      guard.canActivate(makeContext({ permissions: ["admin.access", "tenders.view"] }))
    ).toBe(true);
  });

  it("throws 403 when user satisfies all AND codes but none of the ANY codes", () => {
    const guard = makeGuard(["admin.access"], ["tenders.view", "crm.view"]);
    expect(() =>
      guard.canActivate(makeContext({ permissions: ["admin.access"] }))
    ).toThrow(ForbiddenException);
  });

  it("throws 403 when user satisfies the ANY code but misses an AND code", () => {
    const guard = makeGuard(["admin.access"], ["tenders.view", "crm.view"]);
    expect(() =>
      guard.canActivate(makeContext({ permissions: ["tenders.view"] }))
    ).toThrow(ForbiddenException);
  });
});

// ── Super-user bypass ────────────────────────────────────────────────────────

describe("PermissionsGuard — super-user bypass", () => {
  it("passes for a super user even when they hold no permissions at all", () => {
    const guard = makeGuard(["crm.view"], ["tenders.view"]);
    expect(
      guard.canActivate(makeContext({ permissions: [], isSuperUser: true }))
    ).toBe(true);
  });
});
