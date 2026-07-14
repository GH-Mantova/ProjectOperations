import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { EntraPrincipal, EntraTokenValidatorService } from "./entra-token-validator.service";

@Injectable()
export class EntraAuthService {
  private readonly logger = new Logger(EntraAuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly entraTokenValidatorService: EntraTokenValidatorService,
    private readonly prisma: PrismaService
  ) {}

  async authenticate(idToken: string) {
    const principal = await this.entraTokenValidatorService.validateIdToken(idToken);
    const user = await this.resolveProvisionedUser(principal);

    return {
      user,
      permissions: this.usersService.flattenPermissions(user),
      principal
    };
  }

  // Gated SSO: a valid Entra token with no active internal user is NOT
  // auto-provisioned. It throws ENTRA_NOT_REGISTERED so the client can
  // route the user to the request-access screen. Existing active users
  // sign in normally; deactivated accounts still see the tailored 403.
  async authenticateWithSso(idToken: string) {
    const principal = await this.entraTokenValidatorService.validateIdToken(idToken);
    const user = await this.resolveProvisionedUser(principal);

    return {
      user,
      permissions: this.usersService.flattenPermissions(user),
      principal
    };
  }

  getPublicConfiguration() {
    return this.entraTokenValidatorService.getPublicConfiguration();
  }

  private async resolveProvisionedUser(principal: EntraPrincipal) {
    const normalizedEmail = principal.email.trim().toLowerCase();
    const user = await this.usersService.findByEmailWithSecurity(normalizedEmail);

    if (!user) {
      throw new ForbiddenException({
        code: "ENTRA_NOT_REGISTERED",
        email: normalizedEmail,
        displayName: principal.displayName ?? null,
        message: "Not a registered user."
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        "Access denied. Your Microsoft account exists but is deactivated."
      );
    }

    return user;
  }

  // Public helper: derive first/last name from Entra display name, or
  // fall back to the email local-part when Microsoft returned nothing.
  // Used by the admin approve-access-request path to seed the new user
  // record without duplicating the parsing rule.
  splitDisplayName(displayName: string | null, fallbackEmail: string) {
    const source = displayName?.trim() || fallbackEmail.split("@")[0];
    const parts = source.split(/\s+/);
    const firstName = parts[0] ?? "SSO";
    const lastName = parts.slice(1).join(" ") || "User";
    return { firstName, lastName };
  }
}
