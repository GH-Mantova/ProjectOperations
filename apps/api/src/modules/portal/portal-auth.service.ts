import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PasswordService } from "../../common/security/password.service";
import { AuditService } from "../audit/audit.service";
import {
  PortalAcceptInviteDto,
  PortalLoginDto,
  PortalRefreshDto,
  PortalResetPasswordDto
} from "./dto/portal-login.dto";
import { CreatePortalInviteDto } from "./dto/portal-invite.dto";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

// A precomputed scrypt hash used to keep login response timing constant when
// the looked-up email does not exist. Comparing against this on missing users
// burns the same CPU as a real verify — without it, attackers could enumerate
// valid emails by response-time delta.
const DUMMY_PASSWORD_HASH =
  "00000000000000000000000000000000:" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000";

type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService
  ) {}

  async login(input: PortalLoginDto) {
    const user = await this.prisma.clientPortalUser.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    // Always perform a password comparison even on missing/inactive users so
    // response timing is constant — verifyPassword is scrypt-based, so skipping
    // it would let attackers enumerate valid emails by timing alone.
    const passwordOk = user
      ? this.passwordService.verifyPassword(input.password, user.passwordHash)
      : (this.passwordService.verifyPassword(input.password, DUMMY_PASSWORD_HASH), false);

    if (!user || !user.isActive || !passwordOk || user.forcePasswordReset) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return this.finishLogin(user.id, user.email, user.clientId);
  }

  async refresh(input: PortalRefreshDto) {
    const refreshSecret = this.configService.get<string>(
      "auth.portalRefreshSecret",
      this.configService.get<string>("auth.refreshSecret", "replace-me-refresh")
    );

    let payload: { sub: string; email: string; clientId: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(input.refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    if (payload.type !== "portal-refresh") {
      throw new UnauthorizedException("Invalid refresh token type.");
    }

    const stored = await this.prisma.portalSession.findFirst({
      where: {
        portalUserId: payload.sub,
        tokenHash: this.passwordService.hashToken(input.refreshToken),
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { portalUser: true }
    });

    if (!stored || !stored.portalUser.isActive) {
      throw new UnauthorizedException("Refresh token is no longer valid.");
    }

    const tokens = await this.issueTokens(
      stored.portalUser.id,
      stored.portalUser.email,
      stored.portalUser.clientId
    );

    await this.prisma.$transaction([
      this.prisma.portalSession.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() }
      }),
      this.prisma.portalSession.create({
        data: {
          portalUserId: stored.portalUser.id,
          tokenHash: this.passwordService.hashToken(tokens.refreshToken),
          expiresAt: tokens.refreshTokenExpiresAt
        }
      })
    ]);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toSafeUser(stored.portalUser)
    };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return { ok: true };
    await this.prisma.portalSession.updateMany({
      where: {
        tokenHash: this.passwordService.hashToken(refreshToken),
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
    return { ok: true };
  }

  async createInvite(input: CreatePortalInviteDto, invitedById: string) {
    const client = await this.prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw new NotFoundException("Client not found.");

    const email = input.email.toLowerCase();
    const existingUser = await this.prisma.clientPortalUser.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestException("Portal user already exists for this email.");
    }

    const rawToken = randomBytes(24).toString("hex");
    const tokenHash = this.passwordService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const invite = await this.prisma.portalInvite.create({
      data: {
        clientId: input.clientId,
        contactId: input.contactId ?? null,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        tokenHash,
        expiresAt,
        invitedById
      }
    });

    await this.auditService.write({
      actorId: invitedById,
      action: "portal.invite.created",
      entityType: "PortalInvite",
      entityId: invite.id,
      metadata: { clientId: input.clientId, email }
    });

    if (input.contactId) {
      await this.prisma.contact.update({
        where: { id: input.contactId },
        data: { hasPortalAccess: true }
      }).catch(() => undefined);
    }

    const baseUrl = this.configService.get<string>("portal.publicUrl", "http://localhost:5173");
    const inviteUrl = `${baseUrl}/portal/accept-invite?token=${rawToken}`;

    return { invite: { id: invite.id, expiresAt }, inviteUrl };
  }

  async acceptInvite(input: PortalAcceptInviteDto) {
    const tokenHash = this.passwordService.hashToken(input.token);
    const invite = await this.prisma.portalInvite.findFirst({
      where: { tokenHash, acceptedAt: null, expiresAt: { gt: new Date() } }
    });

    if (!invite) {
      throw new BadRequestException("Invitation is invalid, expired, or already used.");
    }

    const existing = await this.prisma.clientPortalUser.findUnique({
      where: { email: invite.email }
    });
    if (existing) {
      throw new BadRequestException("Portal user already exists for this email.");
    }

    const passwordHash = this.passwordService.hashPassword(input.password);

    const user = await this.prisma.clientPortalUser.create({
      data: {
        clientId: invite.clientId,
        email: invite.email,
        passwordHash,
        firstName: invite.firstName,
        lastName: invite.lastName
      }
    });

    await this.prisma.portalInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() }
    });

    await this.auditService.write({
      actorId: user.id,
      action: "portal.invite.accepted",
      entityType: "ClientPortalUser",
      entityId: user.id,
      metadata: { email: invite.email, clientId: invite.clientId }
    });

    return this.finishLogin(user.id, user.email, user.clientId);
  }

  async requestPasswordReset(email: string) {
    const generic = {
      success: true,
      message: "If that email is registered, a password reset link has been sent."
    };

    const user = await this.prisma.clientPortalUser.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || !user.isActive) return generic;

    const secret = this.configService.get<string>(
      "auth.portalResetSecret",
      this.configService.get<string>("auth.accessSecret", "replace-me-access")
    );
    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, type: "portal-reset" },
      { secret, expiresIn: Math.floor(RESET_TTL_MS / 1000) }
    );

    const baseUrl = this.configService.get<string>("portal.publicUrl", "http://localhost:5173");
    const resetUrl = `${baseUrl}/portal/reset-password?token=${token}`;

    // Until the email service is wired, log the URL server-side only. Never
    // return it in the response — that would let an unauthenticated caller
    // take over any account by submitting an email.
    this.logger.log(`Portal password reset link generated for ${user.email}: ${resetUrl}`);

    await this.auditService.write({
      actorId: user.id,
      action: "portal.password.reset-requested",
      entityType: "ClientPortalUser",
      entityId: user.id,
      metadata: { email: user.email }
    });

    return generic;
  }

  async resetPassword(input: PortalResetPasswordDto) {
    const secret = this.configService.get<string>(
      "auth.portalResetSecret",
      this.configService.get<string>("auth.accessSecret", "replace-me-access")
    );

    let payload: { sub: string; email: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(input.token, { secret });
    } catch {
      throw new UnauthorizedException("Reset token is invalid or has expired.");
    }
    if (payload.type !== "portal-reset") {
      throw new UnauthorizedException("Reset token is not valid for this action.");
    }

    const user = await this.prisma.clientPortalUser.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account is not available.");
    }

    await this.prisma.$transaction([
      this.prisma.clientPortalUser.update({
        where: { id: user.id },
        data: {
          passwordHash: this.passwordService.hashPassword(input.newPassword),
          forcePasswordReset: false
        }
      }),
      // Revoke every outstanding refresh token for this user — a pre-compromise
      // session must not survive the reset.
      this.prisma.portalSession.updateMany({
        where: { portalUserId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    await this.auditService.write({
      actorId: user.id,
      action: "portal.password.reset-completed",
      entityType: "ClientPortalUser",
      entityId: user.id,
      metadata: { email: user.email }
    });

    return this.finishLogin(user.id, user.email, user.clientId);
  }

  async me(userId: string) {
    const user = await this.prisma.clientPortalUser.findUnique({
      where: { id: userId },
      include: { client: true }
    });
    if (!user) throw new UnauthorizedException("Portal user not found.");
    return {
      ...this.toSafeUser(user),
      client: { id: user.client.id, name: user.client.name }
    };
  }

  private async finishLogin(userId: string, email: string, clientId: string) {
    const tokens = await this.issueTokens(userId, email, clientId);

    await this.prisma.$transaction([
      this.prisma.clientPortalUser.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      }),
      this.prisma.portalSession.create({
        data: {
          portalUserId: userId,
          tokenHash: this.passwordService.hashToken(tokens.refreshToken),
          expiresAt: tokens.refreshTokenExpiresAt
        }
      })
    ]);

    await this.auditService.write({
      actorId: userId,
      action: "portal.login",
      entityType: "ClientPortalUser",
      entityId: userId,
      metadata: { email, clientId }
    });

    const user = await this.prisma.clientPortalUser.findUnique({
      where: { id: userId },
      include: { client: true }
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: user
        ? { ...this.toSafeUser(user), client: { id: user.client.id, name: user.client.name } }
        : null
    };
  }

  private async issueTokens(
    userId: string,
    email: string,
    clientId: string
  ): Promise<IssuedTokens> {
    const accessSecret = this.configService.get<string>(
      "auth.portalAccessSecret",
      this.configService.get<string>("auth.accessSecret", "replace-me-access")
    );
    const refreshSecret = this.configService.get<string>(
      "auth.portalRefreshSecret",
      this.configService.get<string>("auth.refreshSecret", "replace-me-refresh")
    );
    const accessTtl = this.configService.get<string>("auth.portalAccessTtl", "30m");

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, clientId, type: "portal" },
      { secret: accessSecret, expiresIn: accessTtl as never }
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email, clientId, type: "portal-refresh" },
      { secret: refreshSecret, expiresIn: "7d" as never }
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TTL_MS)
    };
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    clientId: string;
    phone: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      clientId: user.clientId,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt
    };
  }
}
