import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";

// Fail-closed contract:
//   undefined  = run() was never entered — treat like no tenant (only shared rows visible).
//   null       = explicit null passed to run() — same safe default (only shared rows visible).
//   string     = active tenant; rows where tenantId IS NULL or = this string are visible.
const storage = new AsyncLocalStorage<{ tenantId: string | null }>();

@Injectable()
export class TenantContextService {
  /**
   * Execute `fn` inside a tenant context.  All code running synchronously or
   * asynchronously within `fn` (including Prisma queries) will see the given
   * `tenantId` via `getCurrentTenantId()`.
   */
  run<T>(tenantId: string | null, fn: () => T): T {
    return storage.run({ tenantId }, fn);
  }

  /**
   * Returns the tenantId for the current async context.
   *   undefined → no run() context established (fail-closed — show only shared)
   *   null      → explicit null context (fail-closed — show only shared)
   *   string    → show rows for this tenant + shared (tenantId IS NULL) rows
   */
  getCurrentTenantId(): string | null | undefined {
    const store = storage.getStore();
    if (store === undefined) {
      return undefined;
    }
    return store.tenantId;
  }
}
