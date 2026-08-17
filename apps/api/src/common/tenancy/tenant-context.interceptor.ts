import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import type { AuthenticatedRequest } from "../auth/authenticated-request.interface";
import { TenantContextService } from "./tenant-context";

/**
 * MT-2: TenantContextInterceptor
 *
 * Runs after JwtAuthGuard has decoded the access token into request.user.
 * For every authenticated request it reads `request.user.tenantId` (populated
 * by MT-2's issueTokens change) and wraps the remainder of the request
 * lifecycle in `TenantContextService.run(tenantId, ...)`.
 *
 * Fail-closed contract (inherited from TenantContextService):
 *   - Unauthenticated requests (no request.user): run() is called with null,
 *     so the async context is still established but scoped to shared-only.
 *   - Authenticated requests without a tenantId claim (tokens issued before
 *     MT-2 was deployed, or users with no homeTenantId): also null → shared-only.
 *   - Authenticated requests with tenantId: that tenant's rows + shared rows.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.user?.tenantId ?? null;

    return new Observable((subscriber) => {
      this.tenantContextService.run(tenantId, () => {
        next
          .handle()
          .subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete()
          });
      });
    });
  }
}
