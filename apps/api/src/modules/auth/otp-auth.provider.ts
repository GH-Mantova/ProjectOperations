import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { randomInt } from "crypto";
import { PasswordService } from "../../common/security/password.service";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { AuthenticatedPrincipal } from "./auth-provider.interface";
import { RequestOtpDto, VerifyOtpDto } from "./dto/otp-login.dto";
import { OTP_DELIVERY_PORT, OtpDeliveryPort } from "./otp-delivery.port";

// FIELD-worker OTP knobs. Kept as module constants (not env) for this
// slice — a future PR can promote to config if operations needs to tune
// them per environment.
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_CODE_LENGTH = 6;

@Injectable()
export class OtpAuthProvider {
  private readonly logger = new Logger(OtpAuthProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    @Inject(OTP_DELIVERY_PORT) private readonly delivery: OtpDeliveryPort
  ) {}

  // Issue a code for a personal email. We do NOT reveal whether the
  // email belongs to a user — the response shape is identical either
  // way, so an attacker cannot enumerate FIELD accounts by hitting this
  // endpoint. A code is only actually generated + delivered when the
  // email matches an active user; otherwise we silently no-op.
  async requestCode(input: RequestOtpDto): Promise<{ status: "sent"; expiresAt: string }> {
    const email = input.email.trim().toLowerCase();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const user = await this.usersService.findByEmailWithSecurity(email);

    if (user && user.isActive) {
      const code = this.generateCode();
      const codeHash = this.passwordService.hashToken(code);

      await this.prisma.otpChallenge.create({
        data: { email, codeHash, expiresAt }
      });

      try {
        await this.delivery.deliverCode({ email, code, expiresAt });
      } catch (err) {
        // Delivery failure is not surfaced to the client (uniform
        // response prevents oracle attacks). It IS logged so ops can
        // see a delivery-adapter regression.
        this.logger.warn(
          `otp delivery failed for ${email}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return { status: "sent", expiresAt: expiresAt.toISOString() };
  }

  async verifyCode(input: VerifyOtpDto): Promise<AuthenticatedPrincipal> {
    const email = input.email.trim().toLowerCase();
    const codeHash = this.passwordService.hashToken(input.code);
    const now = new Date();

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!challenge) {
      throw new UnauthorizedException("Invalid or expired code.");
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException("Invalid or expired code.");
    }

    if (challenge.codeHash !== codeHash) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } }
      });
      throw new UnauthorizedException("Invalid or expired code.");
    }

    const user = await this.usersService.findByEmailWithSecurity(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid or expired code.");
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: now }
    });

    return {
      user,
      permissions: this.usersService.flattenPermissions(user)
    };
  }

  private generateCode(): string {
    // 6-digit numeric, zero-padded. randomInt is CSPRNG-backed.
    const max = 10 ** OTP_CODE_LENGTH;
    return randomInt(0, max).toString().padStart(OTP_CODE_LENGTH, "0");
  }
}
