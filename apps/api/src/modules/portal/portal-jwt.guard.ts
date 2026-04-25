import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import type { PortalAuthenticatedRequest, PortalUserPayload } from "./portal-auth.types";

@Injectable()
export class PortalJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
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

    let payload: PortalUserPayload;
    try {
      payload = await this.jwtService.verifyAsync<PortalUserPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException("Invalid or expired portal token.");
    }

    if (payload.type !== "portal") {
      throw new UnauthorizedException("Invalid portal token type.");
    }

    // Re-check on every request: admin deactivation must take effect immediately,
    // not after the 30-min access token expires. Also rejects if the token's
    // clientId no longer matches the user's clientId (defence against stale or
    // tampered tokens).
    const user = await this.prisma.clientPortalUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, clientId: true }
    });
    if (!user || !user.isActive || user.clientId !== payload.clientId) {
      throw new UnauthorizedException("Portal account is no longer active.");
    }

    request.portalUser = payload;
    return true;
  }
}
