import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "./authenticated-request.interface";

// Restrict access to super-users only. Used by routes that mutate
// platform-level integration config (e.g. SharePoint folder mappings)
// where "everyone with a permission code" is too loose — a super-user
// signal is a positive assertion that the actor is root-tier, not
// merely granted a permission by another admin.
@Injectable()
export class SuperUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.isSuperUser) {
      return true;
    }
    throw new ForbiddenException("Super-user required.");
  }
}
