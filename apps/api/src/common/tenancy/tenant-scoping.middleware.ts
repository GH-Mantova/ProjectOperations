import { Prisma } from "@prisma/client";
import { TenantContextService } from "./tenant-context";
import { PILOT_TENANT_AWARE_MODELS } from "./tenant.constants";

/**
 * The read operations that receive the tenantId scoping filter.
 * create / createMany are intentionally excluded — write-stamping is MT-2/MT-4.
 */
const SCOPED_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

const PILOT_MODEL_SET = new Set<string>(PILOT_TENANT_AWARE_MODELS);

/**
 * Build the tenant filter clause for the given tenantId.
 *
 * Fail-closed: when tenantId is undefined or null (no context established or
 * explicit null), only shared rows (tenantId IS NULL) are visible.
 * When tenantId is a real string, shared rows AND that company's rows are visible.
 */
export function buildTenantFilter(tenantId: string | null | undefined): object {
  if (tenantId === undefined || tenantId === null) {
    // Fail-closed: no context or explicit null → only shared rows
    return { tenantId: null };
  }
  return { OR: [{ tenantId: null }, { tenantId }] };
}

/**
 * The raw interceptor function.  Called for every Prisma operation; guards on
 * pilot model set and scoped operation set, then injects the tenant filter.
 *
 * Exported separately so unit tests can call it directly without going through
 * the Prisma extension machinery (which wraps it in a closure at runtime).
 */
export async function tenantQueryInterceptor(
  ctx: TenantContextService,
  params: {
    model: string;
    operation: string;
    args: { where?: object };
    query: (args: { where?: object }) => Promise<unknown>;
  }
): Promise<unknown> {
  const { model, operation, args, query } = params;

  // Only intercept pilot models + scoped operations.
  if (!PILOT_MODEL_SET.has(model) || !SCOPED_OPERATIONS.has(operation)) {
    return query(args);
  }

  const currentTenantId = ctx.getCurrentTenantId();
  const tenantFilter = buildTenantFilter(currentTenantId);

  // Merge the caller's where with the tenant filter using AND so that
  // existing where clauses are not discarded.
  const scopedArgs = {
    ...args,
    where: {
      AND: [args.where ?? {}, tenantFilter],
    },
  };

  return query(scopedArgs);
}

/**
 * Returns a Prisma Client Extension that injects tenant-scoping on every
 * read/mutate operation for the PILOT_TENANT_AWARE_MODELS.
 *
 * Usage:  prisma.$extends(tenantScopingExtension(tenantContextService))
 */
export function tenantScopingExtension(ctx: TenantContextService) {
  return Prisma.defineExtension({
    name: "tenant-scoping",
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $allOperations(params: any) {
          return tenantQueryInterceptor(ctx, params);
        },
      },
    },
  });
}
