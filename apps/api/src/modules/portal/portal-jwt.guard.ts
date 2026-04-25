import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { PortalAuthenticatedRequest, PortalUserPayload } from "./portal-auth.types";

@Injectable()
export class PortalJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PortalAuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing portal bearer token.");
    }

    const token = authorization.slice("Bearer ".length);
    const secret = this.configService.get<string>(
      "auth.portalAccessSecret",
      this.configService.get<string>("auth.accessSecret", "replace-me-access")
    );

    try {
      const payload = await this.jwtService.verifyAsync<PortalUserPayload>(token, { secret });

      if (payload.type !== "portal") {
        throw new UnauthorizedException("Invalid portal token type.");
      }

      request.portalUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired portal token.");
    }
  }
}
