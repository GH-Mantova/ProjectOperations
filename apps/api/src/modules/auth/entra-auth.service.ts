import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { EntraTokenValidatorService } from "./entra-token-validator.service";

const SSO_DEFAULT_ROLE_PRIORITY = ["Viewer", "Field", "Planner", "Admin"];

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
    const user = await this.resolveProvisionedUser(principal.email);

    return {
      user,
      permissions: this.usersService.flattenPermissions(user),
      principal
    };
  }

  async authenticateWithSso(idToken: string) {
    const principal = await this.entraTokenValidatorService.validateIdToken(idToken);
    const user = await this.resolveOrProvisionUser(principal.email, principal.displayName);

    return {
      user,
      permissions: this.usersService.flattenPermissions(user),
      principal
    };
  }

  getPublicConfiguration() {
    return this.entraTokenValidatorService.getPublicConfiguration();
  }

  private async resolveProvisionedUser(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmailWithSecurity(normalizedEmail);

    if (!user || !user.isActive) {
      throw new ForbiddenException(
        "Access denied. Your Microsoft account is not provisioned for Project Operations."
      );
    }

    return user;
  }

  private async resolveOrProvisionUser(email: string, displayName: string | null) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.usersService.findByEmailWithSecurity(normalizedEmail);

    if (existing) {
      if (!existing.isActive) {
        throw new ForbiddenException(
          "Access denied. Your Microsoft account exists but is deactivated."
        );
      }
      return existing;
    }

    const defaultRole = await this.findLowestPrivilegeRole();
    if (!defaultRole) {
      throw new ForbiddenException(
        "SSO provisioning is unavailable: no lowest-privilege role is configured."
      );
    }

    const { firstName, lastName } = this.splitDisplayName(displayName, normalizedEmail);

    await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName,
        lastName,
        passwordHash: "",
        isActive: true,
        ssoOnly: true,
        userRoles: {
          create: [{ roleId: defaultRole.id }]
        }
      }
    });

    this.logger.log(`Provisioned new SSO user ${normalizedEmail} with role ${defaultRole.name}.`);

    const created = await this.usersService.findByEmailWithSecurity(normalizedEmail);
    if (!created) {
      throw new ForbiddenException("SSO provisioning failed.");
    }
    return created;
  }

  private async findLowestPrivilegeRole() {
    const roles = await this.prisma.role.findMany({
      where: { name: { in: SSO_DEFAULT_ROLE_PRIORITY } }
    });
    for (const name of SSO_DEFAULT_ROLE_PRIORITY) {
      const match = roles.find((role) => role.name === name);
      if (match) return match;
    }
    return null;
  }

  private splitDisplayName(displayName: string | null, fallbackEmail: string) {
    const source = displayName?.trim() || fallbackEmail.split("@")[0];
    const parts = source.split(/\s+/);
    const firstName = parts[0] ?? "SSO";
    const lastName = parts.slice(1).join(" ") || "User";
    return { firstName, lastName };
  }
}
