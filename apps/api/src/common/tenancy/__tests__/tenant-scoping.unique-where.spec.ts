import { TenantContextService } from "../tenant-context";
import { tenantQueryInterceptor } from "../tenant-scoping.middleware";

// Regression tests for MT-1 unique-where scoping.
//
// findUnique / findUniqueOrThrow / update / delete take a Prisma WhereUniqueInput,
// which REQUIRES at least one unique field OUTSIDE the boolean operators (AND/OR/NOT).
// The original implementation wrapped the whole where in { AND: [...] }, leaving no
// top-level unique field -> PrismaClientValidationError -> HTTP 500 on every tender
// read (tendering.service getById / delete). These tests lock in the corrected shape:
// the unique selector stays at the top level and the tenant filter is appended via AND.

async function runInterceptor(
  ctx: TenantContextService,
  model: string,
  operation: string,
  callerWhere: object | undefined
): Promise<{ where?: object }> {
  let capturedArgs: { where?: object } = {};
  await tenantQueryInterceptor(ctx, {
    model,
    operation,
    args: { where: callerWhere },
    query: async (args) => {
      capturedArgs = args;
      return null;
    },
  });
  return capturedArgs;
}

describe("tenant-scoping - unique-where operations keep a top-level unique field", () => {
  let svc: TenantContextService;
  beforeEach(() => {
    svc = new TenantContextService();
  });

  it("findUnique: unique field stays top-level, tenant filter goes in AND", async () => {
    let captured!: { where?: object };
    await svc.run("tenant-a", async () => {
      captured = await runInterceptor(svc, "Tender", "findUnique", { id: "tender-1" });
    });
    // Tender has NOT-NULL tenantId (MT-3): no shared/null branch.
    expect(captured.where).toEqual({
      id: "tender-1",
      AND: [{ tenantId: "tenant-a" }],
    });
  });

  it("findUniqueOrThrow: fail-closed (no context) restricts to shared rows, unique field top-level", async () => {
    const captured = await runInterceptor(svc, "Client", "findUniqueOrThrow", { id: "c1" });
    expect(captured.where).toEqual({
      id: "c1",
      AND: [{ tenantId: null }],
    });
  });

  it("update: unique field stays top-level, tenant filter in AND", async () => {
    let captured!: { where?: object };
    await svc.run("tenant-b", async () => {
      captured = await runInterceptor(svc, "Job", "update", { id: "j1" });
    });
    // Job has NOT-NULL tenantId (MT-3): no shared/null branch.
    expect(captured.where).toEqual({
      id: "j1",
      AND: [{ tenantId: "tenant-b" }],
    });
  });

  it("delete: merges tenant filter into an existing AND, keeping the unique field", async () => {
    let captured!: { where?: object };
    await svc.run("tenant-a", async () => {
      captured = await runInterceptor(svc, "Worker", "delete", {
        id: "w1",
        AND: [{ isActive: true }],
      });
    });
    expect(captured.where).toEqual({
      id: "w1",
      AND: [{ isActive: true }, { OR: [{ tenantId: null }, { tenantId: "tenant-a" }] }],
    });
  });

  it("never produces a where that is only { AND: [...] } for a unique-where op", async () => {
    let captured!: { where?: object };
    await svc.run("tenant-a", async () => {
      captured = await runInterceptor(svc, "Tender", "findUnique", { id: "t1" });
    });
    const where = captured.where as Record<string, unknown>;
    const keys = Object.keys(where);
    expect(keys.some((k) => k !== "AND" && k !== "OR" && k !== "NOT")).toBe(true);
    expect(where.id).toBe("t1");
  });
});
