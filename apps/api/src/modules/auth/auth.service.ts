import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { PasswordService } from "../../common/security/password.service";
import { AuditService } from "../audit/audit.service";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService
  ) {}

  async login(input: LoginDto) {
    const user = await this.usersService.findByEmailWithSecurity(input.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    if (!this.passwordService.verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const permissions = this.usersService.flattenPermissions(user);
    const tokens = await this.issueTokens(user.id, user.email, permissions);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.passwordService.hashToken(tokens.refreshToken),
          expiresAt: tokens.refreshTokenExpiresAt
        }
      })
    ]);

    await this.auditService.write({
      actorId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email }
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toSafeUser(user, permissions)
    };
  }

  async refresh(input: RefreshTokenDto) {
    const refreshSecret = this.configService.get<string>("JWT_REFRESH_SECRET", "replace-me-refresh");

    let payload: { sub: string; email: string };

    try {
      payload = await this.jwtService.verifyAsync(input.refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash: this.passwordService.hashToken(input.refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!storedToken || !storedToken.user.isActive) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const permissions = this.usersService.flattenPermissions(storedToken.user);
    const tokens = await this.issueTokens(storedToken.user.id, storedToken.user.email, permissions);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() }
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: storedToken.user.id,
          tokenHash: this.passwordService.hashToken(tokens.refreshToken),
          expiresAt: tokens.refreshTokenExpiresAt
        }
      })
    ]);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toSafeUser(storedToken.user, permissions)
    };
  }

  async me(userId: string) {
    const user = await this.usersService.findByIdWithRelations(userId);

    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    return this.usersService.toSafeUser(user);
  }

  private async issueTokens(userId: string, email: string, permissions: string[]) {
    const accessSecret = this.configService.get<string>("JWT_ACCESS_SECRET", "replace-me-access");
    const refreshSecret = this.configService.get<string>("JWT_REFRESH_SECRET", "replace-me-refresh");
    const accessTtl = this.configService.get<string>("JWT_ACCESS_TTL", "15m");
    const refreshTtl = this.configService.get<string>("JWT_REFRESH_TTL", "7d");

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, permissions },
      { secret: accessSecret, expiresIn: accessTtl as never }
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email },
      { secret: refreshSecret, expiresIn: refreshTtl as never }
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }
}
