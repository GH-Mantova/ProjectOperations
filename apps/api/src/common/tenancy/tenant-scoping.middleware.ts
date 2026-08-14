import { Prisma } from "@prisma/client";
import { TenantContextService } from "./tenant-context";
import { PILOT_TENANT_AWARE_MODELS } from "./tenant.constants";

/**
 * The read/mutate operations that receive the tenantId scoping filter.
 * create / createMany are intentionally excluded - write-stamping is MT-2/MT-4.
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

/**
 * Operations whose `where` is a unique input (Prisma WhereUniqueInput). Prisma
 * requires at least one unique field to stay at the TOP LEVEL of `where`, OUTSIDE
 * the boolean operators (AND/OR/NOT); a `where` that is only `{ AND: [...] }` with
 * no top-level unique field is rejected with PrismaClientValidationError. So for
 * these ops we keep the caller's unique selector at the top level and append the
 * tenant filter via AND (Prisma's supported "filtered unique query" - the
 * documented pattern for permission checks). Non-unique ops accept a plain
 * WhereInput and are simply AND-wrapped.
 */
const UNIQUE_WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
]);

const PILOT_MODEL_SET = new Set<string>(PILOT_TENANT_AWARE_MODELS);

/**
 * Build the tenant filter clause for the given tenantId.
 *
 * Fail-closed: when tenantId is undefined or null (no context established or
 * explicit null), only shared rows (tenantId IS NULL) are visible. When tenantId
 * is a real string, shared rows AND that company's rows are visible.
 */
export function buildTenantFilter(tenantId: string | null | undefined): object {
  if (tenantId === undefined || tenantId === null) {
    // Fail-closed: no context or explicit null -> only shared rows
    return { tenantId: null };
  }
  return { OR: [{ tenantId: null }, { tenantId }] };
}

/**
 * Merge the tenant filter into the caller's `where`.
 *
 * - Non-unique ops (findMany/findFirst/count/updateMany/deleteMany): wrap in AND.
 * - Unique-where ops (findUnique/findUniqueOrThrow/update/delete): keep the
 *   caller's fields (the unique selector) at the top level and append the tenant
 *   filter to an AND array, so a unique field remains OUTSIDE the boolean
 *   operators as Prisma's WhereUniqueInput requires.
 */
export function applyTenantScope(
  operation: string,
  where: Record<string, unknown> | undefined,
  tenantFilter: object
): object {
  if (UNIQUE_WHERE_OPERATIONS.has(operation)) {
    const existing: Record<string, unknown> = where ?? {};
    const existingAnd = Array.isArray(existing.AND)
      ? (existing.AND as unknown[])
      : existing.AND !== undefined
        ? [existing.AND]
        : [];
    return { ...existing, AND: [...existingAnd, tenantFilter] };
  }
  return { AND: [where ?? {}, tenantFilter] };
}

/**
 * The raw interceptor function. Called for every Prisma operation; guards on the
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

  const scopedArgs = {
    ...args,
    where: applyTenantScope(
      operation,
      args.where as Record<string, unknown> | undefined,
      tenantFilter
    ),
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
