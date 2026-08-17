import { TenantContextService } from "../tenant-context";
import { buildTenantFilter, tenantQueryInterceptor } from "../tenant-scoping.middleware";

// ---------------------------------------------------------------------------
// Minimal Prisma-extension test harness.
//
// We test `tenantQueryInterceptor` (the raw interceptor function) and
// `buildTenantFilter` (the where-clause builder) directly, without going
// through the Prisma Client Extension machinery.  This mirrors the house
// mocking style in apps/api/src/modules/directory/directory.service.spec.ts:
// construct the collaborator in-process, mock only the boundary (query/next),
// assert on what was forwarded.
// ---------------------------------------------------------------------------

/**
 * Invoke the interceptor for a given model / operation and capture the args
 * that were forwarded to the downstream `query` (next) function.
 */
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
      return [];
    },
  });

  return capturedArgs;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tenantScopingExtension — contract tests", () => {
  let svc: TenantContextService;

  beforeEach(() => {
    svc = new TenantContextService();
  });

  // -------------------------------------------------------------------------
  // buildTenantFilter — unit tests
  // -------------------------------------------------------------------------
  describe("buildTenantFilter", () => {
    it("returns { tenantId: null } for undefined (fail-closed)", () => {
      expect(buildTenantFilter(undefined)).toEqual({ tenantId: null });
    });

    it("returns { tenantId: null } for null (fail-closed)", () => {
      expect(buildTenantFilter(null)).toEqual({ tenantId: null });
    });

    it("returns OR clause for a real tenantId", () => {
      expect(buildTenantFilter("tenant-a")).toEqual({
        OR: [{ tenantId: null }, { tenantId: "tenant-a" }],
      });
    });

    it("enforced model: real tenantId -> plain { tenantId } (no shared/null branch)", () => {
      expect(buildTenantFilter("tenant-a", true)).toEqual({ tenantId: "tenant-a" });
    });

    it("enforced model: fail-closed uses a valid never-match, not an invalid null filter", () => {
      expect(buildTenantFilter(undefined, true)).toEqual({ tenantId: { in: [] } });
      expect(buildTenantFilter(null, true)).toEqual({ tenantId: { in: [] } });
    });
  });

  // -------------------------------------------------------------------------
  // 1. Company A row INVISIBLE inside run("tenant-b", ...)
  // -------------------------------------------------------------------------
  describe("cross-tenant isolation", () => {
    it("injects tenant-b filter when running as tenant-b (tenant-a rows become invisible)", async () => {
      let capturedArgs!: { where?: object };
      await svc.run("tenant-b", async () => {
        capturedArgs = await runInterceptor(svc, "Client", "findMany", undefined);
      });

      // The where must contain a tenant filter that restricts to tenant-b + null.
      // A row with tenantId="tenant-a" would NOT match tenantId=null OR tenantId="tenant-b".
      expect(capturedArgs.where).toEqual({
        AND: [
          {},
          { OR: [{ tenantId: null }, { tenantId: "tenant-b" }] },
        ],
      });
    });

    it("preserves caller's where clause in AND alongside tenant filter", async () => {
      let capturedArgs!: { where?: object };
      await svc.run("tenant-a", async () => {
        capturedArgs = await runInterceptor(svc, "Tender", "findFirst", { name: "My Tender" });
      });

      // Tender has NOT-NULL tenantId (MT-3): tenant clause is a plain { tenantId }.
      expect(capturedArgs.where).toEqual({
        AND: [
          { name: "My Tender" },
          { tenantId: "tenant-a" },
        ],
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Shared row (tenantId: null) VISIBLE to both tenant-a and tenant-b
  // -------------------------------------------------------------------------
  describe("shared-row visibility", () => {
    it("includes tenantId: null branch in filter for tenant-a — shared rows visible", async () => {
      let capturedArgs!: { where?: object };
      await svc.run("tenant-a", async () => {
        capturedArgs = await runInterceptor(svc, "Worker", "findMany", undefined);
      });

      const where = capturedArgs.where as { AND: object[] };
      const tenantClause = where.AND[1] as { OR: { tenantId: string | null }[] };
      expect(tenantClause).toEqual({ OR: [{ tenantId: null }, { tenantId: "tenant-a" }] });
      // The OR clause allows tenantId IS NULL, so shared rows (tenantId=null) match.
    });

    it("includes tenantId: null branch in filter for tenant-b — shared rows visible", async () => {
      let capturedArgs!: { where?: object };
      await svc.run("tenant-b", async () => {
        capturedArgs = await runInterceptor(svc, "Worker", "findMany", undefined);
      });

      const where = capturedArgs.where as { AND: object[] };
      const tenantClause = where.AND[1] as { OR: { tenantId: string | null }[] };
      expect(tenantClause).toEqual({ OR: [{ tenantId: null }, { tenantId: "tenant-b" }] });
    });
  });

  // -------------------------------------------------------------------------
  // 3. No run() wrapper → fail-closed: only shared rows visible
  // -------------------------------------------------------------------------
  describe("fail-closed: no context", () => {
    it("restricts to tenantId: null only when no run() context exists", async () => {
      // No svc.run() — simulates a raw Prisma call with no tenant context.
      const capturedArgs = await runInterceptor(svc, "Contact", "findMany", undefined);

      expect(capturedArgs.where).toEqual({
        AND: [{}, { tenantId: null }],
      });
    });

    it("enforced model (Job): explicit-null context fails closed with a valid never-match", async () => {
      let capturedArgs!: { where?: object };
      await svc.run(null, async () => {
        capturedArgs = await runInterceptor(svc, "Job", "findMany", undefined);
      });

      // Job has NOT-NULL tenantId (MT-3): no shared rows, so fail-closed is a
      // valid never-match filter, NOT an invalid { tenantId: null }.
      expect(capturedArgs.where).toEqual({
        AND: [{}, { tenantId: { in: [] } }],
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. Non-pilot models are NOT intercepted (pass-through)
  // -------------------------------------------------------------------------
  describe("non-pilot model pass-through", () => {
    it("does not inject tenant filter for a non-pilot model (e.g. SubcontractorSupplier)", async () => {
      let capturedArgs!: { where?: object };
      await svc.run("tenant-a", async () => {
        capturedArgs = await runInterceptor(
          svc,
          "SubcontractorSupplier",
          "findMany",
          { name: "Acme" }
        );
      });

      // Should be unchanged (no AND wrapper injected)
      expect(capturedArgs.where).toEqual({ name: "Acme" });
    });
  });

  // -------------------------------------------------------------------------
  // 5. Non-scoped operations (create) are NOT intercepted
  // -------------------------------------------------------------------------
  describe("create is not intercepted", () => {
    it("does not inject tenant filter for create operations on pilot models", async () => {
      let capturedArgs!: { where?: object };
      await svc.run("tenant-a", async () => {
        capturedArgs = await runInterceptor(svc, "Client", "create", undefined);
      });

      // Should be unchanged (where: undefined, not wrapped in AND)
      expect(capturedArgs.where).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 6. All five pilot models are covered
  // -------------------------------------------------------------------------
  describe("pilot model coverage", () => {
    const pilotModels = ["Client", "Worker", "Contact", "Tender", "Job"] as const;

    const enforcedModels = new Set(["Tender", "Job"]);
    for (const model of pilotModels) {
      it(`injects tenant filter for ${model}`, async () => {
        let capturedArgs!: { where?: object };
        await svc.run("tenant-x", async () => {
          capturedArgs = await runInterceptor(svc, model, "findMany", undefined);
        });

        // Enforced (NOT NULL) models drop the shared/null branch.
        const expectedTenantClause = enforcedModels.has(model)
          ? { tenantId: "tenant-x" }
          : { OR: [{ tenantId: null }, { tenantId: "tenant-x" }] };
        expect(capturedArgs.where).toEqual({
          AND: [{}, expectedTenantClause],
        });
      });
    }
  });
});
