import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { PasswordService } from "../../common/security/password.service";
import { AuditService } from "../audit/audit.service";
import { UsersService } from "../users/users.service";
import { AuthProviderService } from "./auth-provider.service";
import { EntraAuthService } from "./entra-auth.service";
import { EntraLoginDto } from "./dto/entra-login.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly authProviderService: AuthProviderService,
    private readonly entraAuthService: EntraAuthService
  ) {}

  async login(input: LoginDto) {
    const { user, permissions } = await this.authProviderService.authenticate(input);
    if (user.forcePasswordReset) {
      const tempToken = await this.issueResetToken(user.id, user.email);
      await this.auditService.write({
        actorId: user.id,
        action: "auth.login.reset-required",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email }
      });
      return { requiresPasswordReset: true, tempToken };
    }
    return this.finishLogin(user.id, user.email, permissions, user, {
      provider: "local"
    });
  }

  async resetPassword(input: ResetPasswordDto) {
    const resetSecret = this.configService.get<string>("auth.accessSecret", "replace-me-access");
    let payload: { sub: string; email: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(input.tempToken, { secret: resetSecret });
    } catch {
      throw new UnauthorizedException("Reset token is invalid or has expired.");
    }
    if (payload.purpose !== "password-reset") {
      throw new UnauthorizedException("Reset token is not valid for this action.");
    }

    const user = await this.usersService.findByIdWithRelations(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User is not available.");
    }
    if (!user.forcePasswordReset) {
      throw new BadRequestException("Password reset is not required for this account.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: this.passwordService.hashPassword(input.newPassword),
        forcePasswordReset: false
      }
    });

    const permissions = this.usersService.flattenPermissions(user);
    return this.finishLogin(user.id, user.email, permissions, user, {
      provider: "local",
      flow: "password-reset"
    });
  }

  private async issueResetToken(userId: string, email: string): Promise<string> {
    const secret = this.configService.get<string>("auth.accessSecret", "replace-me-access");
    return this.jwtService.signAsync(
      { sub: userId, email, purpose: "password-reset" },
      { secret, expiresIn: "15m" as never }
    );
  }

  async loginWithEntra(input: EntraLoginDto) {
    const { user, permissions, principal } = await this.entraAuthService.authenticate(input.idToken);
    return this.finishLogin(user.id, user.email, permissions, user, {
      provider: "entra",
      issuer: principal.issuer,
      audience: principal.audience,
      entraSubject: principal.subject
    });
  }

  async loginWithSso(input: { idToken: string }) {
    const { user, permissions, principal } = await this.entraAuthService.authenticateWithSso(input.idToken);
    return this.finishLogin(user.id, user.email, permissions, user, {
      provider: "sso",
      issuer: principal.issuer,
      audience: principal.audience,
      entraSubject: principal.subject
    });
  }

  getLoginConfiguration() {
    const mode = this.configService.get<string>("auth.mode", "local");

    if (mode !== "entra") {
      return { mode: "local" as const };
    }

    return {
      mode: "entra" as const,
      entra: this.entraAuthService.getPublicConfiguration()
    };
  }

  async refresh(input: RefreshTokenDto) {
    const refreshSecret = this.configService.get<string>("auth.refreshSecret", "replace-me-refresh");

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
    const tokens = await this.issueTokens(
      storedToken.user.id,
      storedToken.user.email,
      permissions,
      storedToken.user.isSuperUser
    );

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

  private async finishLogin(
    userId: string,
    email: string,
    permissions: string[],
    user: Parameters<UsersService["toSafeUser"]>[0],
    metadata: Record<string, unknown>
  ) {
    const tokens = await this.issueTokens(userId, email, permissions, Boolean(user.isSuperUser));

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      }),
      this.prisma.refreshToken.create({
        data: {
          userId,
          tokenHash: this.passwordService.hashToken(tokens.refreshToken),
          expiresAt: tokens.refreshTokenExpiresAt
        }
      })
    ]);

    await this.auditService.write({
      actorId: userId,
      action: "auth.login",
      entityType: "User",
      entityId: userId,
      metadata: { email, ...metadata }
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toSafeUser(user, permissions)
    };
  }

  private async issueTokens(
    userId: string,
    email: string,
    permissions: string[],
    isSuperUser = false
  ) {
    const accessSecret = this.configService.get<string>("auth.accessSecret", "replace-me-access");
    const refreshSecret = this.configService.get<string>("auth.refreshSecret", "replace-me-refresh");
    const accessTtl = this.configService.get<string>("auth.accessTtl", "15m");
    const refreshTtl = this.configService.get<string>("auth.refreshTtl", "7d");

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, permissions, isSuperUser },
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
