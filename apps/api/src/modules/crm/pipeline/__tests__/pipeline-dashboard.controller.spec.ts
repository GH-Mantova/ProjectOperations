import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { PipelineDashboardController } from "../pipeline-dashboard.controller";
import { PipelineDashboardService } from "../pipeline-dashboard.service";
import { PermissionsGuard } from "../../../../common/auth/permissions.guard";
import { JwtAuthGuard } from "../../../../common/auth/jwt-auth.guard";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeUser(permissions: string[]) {
  return { sub: "u-1", email: "user@test", permissions, isSuperUser: false };
}

// A JwtAuthGuard stub that injects a user from the execution context's fake request.
// The real guard verifies JWTs; in unit scope we skip token validation entirely.
class FakeJwtGuard {
  canActivate(context: ExecutionContext) {
    // The test sets up the request via the PermissionsGuard's context; we just pass.
    return true;
  }
}

// ── module setup ──────────────────────────────────────────────────────────────

// These tests exercise the REAL PermissionsGuard against the real controller
// metadata so that the @RequireAnyPermission decorator is validated end-to-end.
// We use NestJS's Reflector-based guard directly, wrapping it around a mock HTTP
// context to avoid spinning up a full Express server.

function makeContext(permissions: string[]): ExecutionContext {
  const handler = PipelineDashboardController.prototype.getDashboard;
  return {
    getHandler: () => handler,
    getClass: () => PipelineDashboardController,
    switchToHttp: () => ({
      getRequest: () => ({ user: makeUser(permissions) })
    })
  } as unknown as ExecutionContext;
}

function buildGuard(): PermissionsGuard {
  const reflector = new Reflector();
  return new PermissionsGuard(reflector);
}

// ── GET /crm/pipeline/dashboard permission tests ──────────────────────────────

describe("PipelineDashboardController — @RequireAnyPermission gate on getDashboard", () => {
  let guard: PermissionsGuard;

  beforeEach(() => {
    guard = buildGuard();
  });

  it("allows a user who holds tenders.view (and NOT crm.view)", () => {
    const ctx = makeContext(["tenders.view"]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows a user who holds crm.view (and NOT tenders.view)", () => {
    const ctx = makeContext(["crm.view"]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("throws 403 for a user who holds neither tenders.view nor crm.view", () => {
    const ctx = makeContext(["reports.view"]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("allows a user who holds both tenders.view and crm.view", () => {
    const ctx = makeContext(["tenders.view", "crm.view"]);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

// ── Controller delegates to service ──────────────────────────────────────────

describe("PipelineDashboardController — delegation", () => {
  it("getDashboard delegates to PipelineDashboardService.getDashboard", async () => {
    const service = {
      getDashboard: jest.fn(async () => ({ byStage: {}, winRates: {}, stalled: {}, relationshipCoverage: {} })),
      getPipelineByStage: jest.fn(async () => ({})),
      getWinRates: jest.fn(async () => []),
      getStalledOpportunities: jest.fn(async () => []),
      getRelationshipCoverage: jest.fn(async () => ({}))
    } as unknown as PipelineDashboardService;

    const controller = new PipelineDashboardController(service);
    await controller.getDashboard({});
    expect(service.getDashboard).toHaveBeenCalledWith({});
  });
});
