import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedRequest, AuthenticatedUser } from "./authenticated-request.interface";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const token = authorization.slice("Bearer ".length);

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser & { type?: string }>(
        token,
        {
          secret: this.configService.get<string>("auth.accessSecret", "replace-me-access")
        }
      );

      if (payload.type === "portal" || payload.type === "portal-refresh") {
        throw new UnauthorizedException("Portal tokens are not valid for staff endpoints.");
      }

      request.user = payload;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid or expired access token.");
    }
  }
}
