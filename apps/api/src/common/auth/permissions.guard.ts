import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ANY_PERMISSIONS_KEY, REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator";
import type { AuthenticatedRequest } from "./authenticated-request.interface";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    const anyPermissions =
      this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredPermissions.length === 0 && anyPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Super users bypass all permission checks. This is the "root" tier used for
    // platform administration — new permission codes introduced by migrations
    // become accessible immediately without needing a token refresh.
    if (request.user?.isSuperUser) {
      return true;
    }

    const grantedPermissions = new Set(request.user?.permissions ?? []);

    // AND check: every code in requiredPermissions must be present.
    // This path is unchanged from before — do not alter its semantics.
    const missingPermission = requiredPermissions.find((permission) => !grantedPermissions.has(permission));
    if (missingPermission) {
      throw new ForbiddenException(`Missing required permission: ${missingPermission}`);
    }

    // OR check: at least one code in anyPermissions must be present.
    // If BOTH decorators are on a handler, ALL of the AND set AND at least one of
    // the ANY set must be satisfied — the checks are independent and cumulative.
    if (anyPermissions.length > 0) {
      const holdsAny = anyPermissions.some((permission) => grantedPermissions.has(permission));
      if (!holdsAny) {
        throw new ForbiddenException(
          `Requires at least one of the following permissions: ${anyPermissions.join(", ")}`
        );
      }
    }

    return true;
  }
}
