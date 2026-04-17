import { ForbiddenException, Injectable } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { EntraTokenValidatorService } from "./entra-token-validator.service";

@Injectable()
export class EntraAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly entraTokenValidatorService: EntraTokenValidatorService
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
}
