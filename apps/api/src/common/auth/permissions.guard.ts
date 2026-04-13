import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator";
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

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const grantedPermissions = new Set(request.user?.permissions ?? []);
    const missingPermission = requiredPermissions.find((permission) => !grantedPermissions.has(permission));

    if (missingPermission) {
      throw new ForbiddenException(`Missing required permission: ${missingPermission}`);
    }

    return true;
  }
}
