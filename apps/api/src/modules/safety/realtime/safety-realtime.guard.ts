import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type {
  AuthenticatedRequest,
  AuthenticatedUser
} from "../../../common/auth/authenticated-request.interface";

/**
 * SSE-specific auth guard.
 *
 * The browser `EventSource` API cannot set custom request headers, so the
 * usual `Authorization: Bearer …` path used by `JwtAuthGuard` is not
 * available on SSE endpoints. This guard accepts the access token via the
 * `?token=` query parameter, validates it exactly as `JwtAuthGuard` does
 * (same secret path, same portal-token rejection), and enforces
 * `safety.view` before the stream opens. Superusers bypass the permission
 * check — matching the app-wide convention.
 */
@Injectable()
export class SafetyRealtimeAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { query?: Record<string, unknown> }>();

    const rawToken = request.query?.token;
    const token = typeof rawToken === "string" ? rawToken : "";
    if (!token) throw new UnauthorizedException("Missing access token.");

    let payload: AuthenticatedUser & { type?: string };
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser & { type?: string }>(token, {
        secret: this.configService.get<string>("auth.accessSecret", "replace-me-access")
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired access token.");
    }

    if (payload.type === "portal" || payload.type === "portal-refresh") {
      throw new UnauthorizedException("Portal tokens are not valid for staff endpoints.");
    }

    request.user = payload;

    if (payload.isSuperUser) return true;
    const permissions = new Set(payload.permissions ?? []);
    if (!permissions.has("safety.view")) {
      throw new ForbiddenException("Missing required permission: safety.view");
    }
    return true;
  }
}
